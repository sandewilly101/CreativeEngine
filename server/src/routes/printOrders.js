import express from 'express';
import { query, queryOne, execute, transaction } from '../config/db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { logActivity } from '../services/activityLog.js';
import { notifyOrganisation, notifyByPermission } from '../services/notifications.js';
import { calculateTotals, areaSqm } from '../utils/money.js';
import {
  ApiError, asyncHandler, generateReference, parsePagination,
  paginatedResponse, safeSort, parseJsonFields,
} from '../utils/helpers.js';

const router = express.Router();
router.use(authenticate);

/**
 * Price one print line.
 *
 * Large format is per square metre: area x rate, with the substrate modifier
 * applied per sqm and finishing charged by its own unit (per metre of edge,
 * per eyelet, per item). A minimum charge protects small jobs, since setup
 * time does not scale down.
 */
function priceLine(product, line) {
  const qty = Number(line.quantity || 1);
  const substrates = typeof product.substrates === 'string'
    ? JSON.parse(product.substrates || '[]') : (product.substrates || []);
  const finishingOptions = typeof product.finishing_options === 'string'
    ? JSON.parse(product.finishing_options || '[]') : (product.finishing_options || []);

  const substrate = substrates.find((s) => s.name === line.substrate);
  const substrateModifier = Number(substrate?.price_modifier_cents || 0);

  let base = 0;
  let area = null;

  if (product.pricing_basis === 'per_sqm') {
    area = areaSqm(line.width_mm, line.height_mm, qty);
    const ratePerSqm = Number(product.base_price_cents) + substrateModifier;
    base = Math.round(area * ratePerSqm);
    if (line.sides === 'double') base = Math.round(base * 1.8); // second side is cheaper than the first
  } else {
    base = Math.round((Number(product.base_price_cents) + substrateModifier) * qty);
  }

  // Finishing: each selected option carries its own quantity in its own unit.
  let finishing = 0;
  const selected = line.finishing || [];
  for (const choice of selected) {
    const option = finishingOptions.find((f) => f.name === choice.name);
    if (!option) continue;
    const count = Number(choice.quantity ?? 1);
    finishing += Math.round(Number(option.price_cents) * count);
  }

  let total = base + finishing;
  const minCharge = Number(product.min_charge_cents || 0);
  if (minCharge > 0 && total < minCharge) total = minCharge;

  return {
    area_sqm: area,
    base_cents: base,
    finishing_cents: finishing,
    line_total_cents: total,
    unit_price_cents: qty > 0 ? Math.round(total / qty) : total,
  };
}

// ---------------------------------------------------------------- QUOTE
/** Live price calculator for the public print shop and the admin builder. */
router.post('/calculate', asyncHandler(async (req, res) => {
  const { items = [], is_rush = false } = req.body;
  const priced = [];
  let subtotal = 0;

  for (const line of items) {
    const product = await queryOne(
      'SELECT * FROM print_products WHERE id = ? AND deleted_at IS NULL',
      [line.product_id]
    );
    if (!product) continue;
    const result = priceLine(product, line);
    subtotal += result.line_total_cents;
    priced.push({
      ...line,
      product_name: product.name,
      turnaround_days: product.turnaround_days,
      bleed_mm: product.bleed_mm,
      min_dpi: product.min_dpi,
      ...result,
    });
  }

  // Rush surcharge uses the highest rate among the products ordered.
  let rushCents = 0;
  if (is_rush && priced.length) {
    const products = await query(
      `SELECT rush_surcharge_percent FROM print_products WHERE id IN (${items.map(() => '?').join(',')})`,
      items.map((i) => i.product_id)
    );
    const maxPercent = Math.max(0, ...products.map((p) => Number(p.rush_surcharge_percent)));
    rushCents = Math.round((subtotal * maxPercent) / 100);
  }

  const totals = calculateTotals({
    items: [{ quantity: 1, unit_price_cents: subtotal, is_taxable: true }],
    discountType: req.body.discount_type || 'none',
    discountValue: req.body.discount_value || 0,
    vatRate: req.body.vat_rate ?? 18,
    extraCharges: rushCents + Number(req.body.delivery_cents || 0) + Number(req.body.installation_cents || 0),
  });

  res.json({
    data: {
      items: priced,
      rush_cents: rushCents,
      delivery_cents: Number(req.body.delivery_cents || 0),
      installation_cents: Number(req.body.installation_cents || 0),
      ...totals,
    },
  });
}));

// ------------------------------------------------------------------ LIST
router.get('/', requirePermission('print.view'), asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { column, direction } = safeSort(req.query.sort,
    ['id', 'reference', 'created_at', 'required_by', 'total_cents', 'status'], 'created_at');

  const where = ['po.deleted_at IS NULL'];
  const params = [];
  if (req.query.status) {
    const list = String(req.query.status).split(',');
    where.push(`po.status IN (${list.map(() => '?').join(',')})`);
    params.push(...list);
  }
  if (req.query.organisation_id) { where.push('po.organisation_id = ?'); params.push(req.query.organisation_id); }
  if (req.query.is_rush === 'true') where.push('po.is_rush = 1');
  if (req.query.search) {
    where.push('(po.reference LIKE ? OR po.contact_name LIKE ? OR o.name LIKE ?)');
    const t = `%${req.query.search}%`;
    params.push(t, t, t);
  }
  if (req.user.role_slug === 'client') {
    where.push('po.organisation_id = ?');
    params.push(req.user.organisation_id);
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const rows = await query(
    `SELECT po.*, o.name AS organisation_name, s.name AS supplier_name,
            (SELECT COUNT(*) FROM print_order_items WHERE order_id = po.id) AS item_count
       FROM print_orders po
  LEFT JOIN organisations o ON o.id = po.organisation_id
  LEFT JOIN suppliers s ON s.id = po.supplier_id
       ${whereSql} ORDER BY po.\`${column}\` ${direction} LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  const countRow = await queryOne(
    `SELECT COUNT(*) AS total FROM print_orders po LEFT JOIN organisations o ON o.id = po.organisation_id ${whereSql}`,
    params
  );
  res.json(paginatedResponse(rows, countRow.total, { page, limit }));
}));

/** Production queue, grouped by what the workshop needs to do next. */
router.get('/production-queue', requirePermission('print.view'), asyncHandler(async (_req, res) => {
  const rows = await query(
    `SELECT poi.*, po.reference, po.required_by, po.is_rush, po.status AS order_status,
            o.name AS organisation_name, pp.name AS product_name,
            ma.public_url AS artwork_url, ma.thumb_url AS artwork_thumb
       FROM print_order_items poi
       JOIN print_orders po ON po.id = poi.order_id
  LEFT JOIN organisations o ON o.id = po.organisation_id
  LEFT JOIN print_products pp ON pp.id = poi.product_id
  LEFT JOIN media ma ON ma.id = poi.artwork_media_id
      WHERE po.deleted_at IS NULL
        AND po.status IN ('approved','in_production')
      ORDER BY po.is_rush DESC, po.required_by ASC`
  );
  res.json({ data: rows });
}));

// ------------------------------------------------------------------ READ
router.get('/:id', requirePermission('print.view'), asyncHandler(async (req, res) => {
  const scope = req.user.role_slug === 'client' ? ' AND po.organisation_id = ?' : '';
  const params = req.user.role_slug === 'client'
    ? [req.params.id, req.user.organisation_id] : [req.params.id];

  const order = await queryOne(
    `SELECT po.*, o.name AS organisation_name, s.name AS supplier_name, p.name AS project_name
       FROM print_orders po
  LEFT JOIN organisations o ON o.id = po.organisation_id
  LEFT JOIN suppliers s ON s.id = po.supplier_id
  LEFT JOIN projects p ON p.id = po.project_id
      WHERE po.id = ? AND po.deleted_at IS NULL${scope}`,
    params
  );
  if (!order) throw ApiError.notFound('Print order not found');

  const items = await query(
    `SELECT poi.*, pp.name AS product_name, pp.bleed_mm, pp.min_dpi, pp.safe_margin_mm,
            ma.public_url AS artwork_url, ma.thumb_url AS artwork_thumb, ma.original_name AS artwork_name,
            mm.public_url AS mockup_url, mp.public_url AS proof_url
       FROM print_order_items poi
  LEFT JOIN print_products pp ON pp.id = poi.product_id
  LEFT JOIN media ma ON ma.id = poi.artwork_media_id
  LEFT JOIN media mm ON mm.id = poi.mockup_media_id
  LEFT JOIN media mp ON mp.id = poi.proof_media_id
      WHERE poi.order_id = ? ORDER BY poi.sort_order, poi.id`,
    [order.id]
  );

  res.json({
    data: {
      ...order,
      items: items.map((i) => parseJsonFields(i, ['finishing'])),
    },
  });
}));

// ---------------------------------------------------------------- CREATE
router.post('/', requirePermission('print.create'), asyncHandler(async (req, res) => {
  const { items = [], contact_name } = req.body;
  if (!items.length) throw ApiError.badRequest('Add at least one item to the order');
  if (!contact_name?.trim()) throw ApiError.badRequest('A contact name is required');

  const created = await transaction(async (tx) => {
    const reference = await generateReference('print_order', tx);
    let subtotal = 0;
    const prepared = [];

    for (const line of items) {
      const product = await tx.queryOne('SELECT * FROM print_products WHERE id = ?', [line.product_id]);
      if (!product) throw ApiError.badRequest(`Product ${line.product_id} not found`);
      const priced = priceLine(product, line);
      subtotal += priced.line_total_cents;
      prepared.push({ line, priced, product });
    }

    let rushCents = 0;
    if (req.body.is_rush) {
      const maxPercent = Math.max(0, ...prepared.map((p) => Number(p.product.rush_surcharge_percent)));
      rushCents = Math.round((subtotal * maxPercent) / 100);
    }

    const totals = calculateTotals({
      items: [{ quantity: 1, unit_price_cents: subtotal, is_taxable: true }],
      discountType: req.body.discount_type || 'none',
      discountValue: req.body.discount_value || 0,
      vatRate: req.body.vat_rate ?? 18,
      extraCharges: rushCents + Number(req.body.delivery_cents || 0) + Number(req.body.installation_cents || 0),
    });

    const result = await tx.execute(
      `INSERT INTO print_orders
         (reference, organisation_id, project_id, contact_name, contact_email, contact_phone,
          currency, subtotal_cents, rush_cents, delivery_cents, installation_cents,
          discount_cents, vat_rate, vat_cents, total_cents, status, is_rush, required_by,
          delivery_method, delivery_address, production_notes, supplier_id, assigned_to, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        reference, req.body.organisation_id || null, req.body.project_id || null,
        contact_name.trim(), req.body.contact_email || null, req.body.contact_phone || null,
        req.body.currency || 'TZS', subtotal, rushCents,
        Number(req.body.delivery_cents || 0), Number(req.body.installation_cents || 0),
        totals.discount_cents, req.body.vat_rate ?? 18, totals.vat_cents, totals.total_cents,
        req.body.status || 'draft', req.body.is_rush ? 1 : 0, req.body.required_by || null,
        req.body.delivery_method || 'pickup', req.body.delivery_address || null,
        req.body.production_notes || null, req.body.supplier_id || null,
        req.body.assigned_to || null, req.user.id,
      ]
    );

    for (const [i, { line, priced }] of prepared.entries()) {
      await tx.execute(
        `INSERT INTO print_order_items
           (order_id, product_id, description, quantity, width_mm, height_mm, area_sqm,
            substrate, finishing, sides, unit_price_cents, line_total_cents,
            artwork_media_id, mockup_media_id, sort_order)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          result.insertId, line.product_id, line.description || prepared[i].product.name,
          Number(line.quantity || 1), line.width_mm || null, line.height_mm || null,
          priced.area_sqm, line.substrate || null,
          line.finishing ? JSON.stringify(line.finishing) : null,
          line.sides || 'single', priced.unit_price_cents, priced.line_total_cents,
          line.artwork_media_id || null, line.mockup_media_id || null, i,
        ]
      );
    }
    return { id: result.insertId, reference };
  });

  await logActivity(req, 'created', 'print_orders', created.id, created.reference);
  const order = await queryOne('SELECT * FROM print_orders WHERE id = ?', [created.id]);
  res.status(201).json({ data: order, message: `Print order ${created.reference} created` });
}));

// ---------------------------------------------------------------- UPDATE
router.patch('/:id', requirePermission('print.update'), asyncHandler(async (req, res) => {
  const existing = await queryOne('SELECT * FROM print_orders WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
  if (!existing) throw ApiError.notFound('Print order not found');

  const fields = ['organisation_id', 'project_id', 'contact_name', 'contact_email', 'contact_phone',
    'status', 'is_rush', 'required_by', 'delivery_method', 'delivery_address',
    'production_notes', 'supplier_id', 'supplier_cost_cents', 'assigned_to',
    'delivery_cents', 'installation_cents', 'discount_cents'];
  const updates = {};
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  if (updates.status === 'completed' && existing.status !== 'completed') {
    updates.completed_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
  }
  if (Object.keys(updates).length === 0) throw ApiError.badRequest('Nothing to update');

  const clause = Object.keys(updates).map((k) => `\`${k}\` = ?`).join(', ');
  await execute(`UPDATE print_orders SET ${clause} WHERE id = ?`, [...Object.values(updates), req.params.id]);

  if (updates.status && updates.status !== existing.status && existing.organisation_id) {
    await notifyOrganisation(existing.organisation_id, {
      type: 'print.status',
      title: `Print order ${existing.reference}: ${String(updates.status).replace(/_/g, ' ')}`,
      linkUrl: `/portal/print-orders/${existing.id}`,
      entityType: 'print_orders', entityId: existing.id, icon: 'printer',
    });
  }

  await logActivity(req, 'updated', 'print_orders', req.params.id, existing.reference, { after: updates });
  const order = await queryOne('SELECT * FROM print_orders WHERE id = ?', [req.params.id]);
  res.json({ data: order, message: 'Print order updated' });
}));

// ---------------------------------------------------------------- ARTWORK
router.post('/:id/items/:itemId/artwork', requirePermission('print.update'), asyncHandler(async (req, res) => {
  const { media_id } = req.body;
  if (!media_id) throw ApiError.badRequest('An artwork file is required');

  const item = await queryOne(
    'SELECT * FROM print_order_items WHERE id = ? AND order_id = ?',
    [req.params.itemId, req.params.id]
  );
  if (!item) throw ApiError.notFound('Order item not found');

  const media = await queryOne('SELECT * FROM media WHERE id = ?', [media_id]);
  const product = await queryOne('SELECT * FROM print_products WHERE id = ?', [item.product_id]);

  // Preflight: the main thing that goes wrong on large format is resolution.
  // Effective DPI = pixels / physical inches at final print size.
  const warnings = [];
  let status = 'passed';
  let effectiveDpi = null;

  if (media?.width && item.width_mm) {
    const widthInches = Number(item.width_mm) / 25.4;
    effectiveDpi = Math.round(media.width / widthInches);
    const minDpi = Number(product?.min_dpi || 100);
    if (effectiveDpi < minDpi * 0.6) {
      warnings.push(`Resolution is ${effectiveDpi} DPI at final size; ${minDpi} DPI is recommended. This will look soft.`);
      status = 'failed';
    } else if (effectiveDpi < minDpi) {
      warnings.push(`Resolution is ${effectiveDpi} DPI against a ${minDpi} DPI target. Acceptable at viewing distance, but not ideal.`);
      status = 'warnings';
    }
  }

  if (media?.mime_type?.startsWith('image/') && media.mime_type !== 'image/tiff') {
    warnings.push('Supplied as a raster image. A press-ready PDF with outlined fonts is preferred.');
    if (status === 'passed') status = 'warnings';
  }

  if (media?.width && media?.height && item.width_mm && item.height_mm) {
    const artworkRatio = media.width / media.height;
    const targetRatio = Number(item.width_mm) / Number(item.height_mm);
    if (Math.abs(artworkRatio - targetRatio) / targetRatio > 0.05) {
      warnings.push('Artwork proportions differ from the ordered size by more than 5%. It will need cropping or scaling.');
      if (status === 'passed') status = 'warnings';
    }
  }

  await execute(
    `UPDATE print_order_items
        SET artwork_media_id = ?, preflight_status = ?, preflight_notes = ?,
            artwork_dpi = ?, artwork_colorspace = ?
      WHERE id = ?`,
    [media_id, status, warnings.join(' ') || null, effectiveDpi, req.body.colorspace || null, req.params.itemId]
  );

  res.json({
    data: { preflight_status: status, warnings, effective_dpi: effectiveDpi },
    message: status === 'passed'
      ? 'Artwork received and passed preflight'
      : 'Artwork received with preflight notes',
  });
}));

/** Client signs off a proof before it goes to the press. */
router.post('/:id/items/:itemId/approve', requirePermission('print.view'), asyncHandler(async (req, res) => {
  const item = await queryOne(
    'SELECT * FROM print_order_items WHERE id = ? AND order_id = ?',
    [req.params.itemId, req.params.id]
  );
  if (!item) throw ApiError.notFound('Order item not found');

  await execute(
    'UPDATE print_order_items SET approved_at = NOW(), approved_by = ? WHERE id = ?',
    [req.user.id, req.params.itemId]
  );

  // Once everything on the order is signed off, move it into production.
  const pending = await queryOne(
    'SELECT COUNT(*) AS c FROM print_order_items WHERE order_id = ? AND approved_at IS NULL',
    [req.params.id]
  );
  if (Number(pending.c) === 0) {
    await execute("UPDATE print_orders SET status = 'approved' WHERE id = ?", [req.params.id]);
    await notifyByPermission('print.update', {
      type: 'print.approved',
      title: 'Print order fully approved and ready for production',
      linkUrl: `/admin/print-orders/${req.params.id}`,
      entityType: 'print_orders', entityId: Number(req.params.id), icon: 'check-circle',
    });
  }
  res.json({ message: 'Proof approved', data: { all_approved: Number(pending.c) === 0 } });
}));

router.patch('/:id/items/:itemId', requirePermission('print.update'), asyncHandler(async (req, res) => {
  const fields = ['description', 'quantity', 'width_mm', 'height_mm', 'substrate', 'sides',
    'unit_price_cents', 'line_total_cents', 'mockup_media_id', 'proof_media_id',
    'production_status', 'preflight_notes'];
  const updates = {};
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  if (req.body.finishing !== undefined) updates.finishing = JSON.stringify(req.body.finishing);
  if (Object.keys(updates).length === 0) throw ApiError.badRequest('Nothing to update');

  const clause = Object.keys(updates).map((k) => `\`${k}\` = ?`).join(', ');
  await execute(`UPDATE print_order_items SET ${clause} WHERE id = ? AND order_id = ?`,
    [...Object.values(updates), req.params.itemId, req.params.id]);
  res.json({ message: 'Item updated' });
}));

router.delete('/:id/items/:itemId', requirePermission('print.update'), asyncHandler(async (req, res) => {
  await execute('DELETE FROM print_order_items WHERE id = ? AND order_id = ?', [req.params.itemId, req.params.id]);
  res.json({ message: 'Item removed' });
}));

router.delete('/:id', requirePermission('print.delete'), asyncHandler(async (req, res) => {
  const order = await queryOne('SELECT * FROM print_orders WHERE id = ?', [req.params.id]);
  if (!order) throw ApiError.notFound('Print order not found');
  if (['in_production', 'ready'].includes(order.status)) {
    throw ApiError.badRequest('This order is already in production and cannot be deleted. Cancel it instead.');
  }
  await execute('UPDATE print_orders SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
  await logActivity(req, 'deleted', 'print_orders', req.params.id, order.reference);
  res.json({ message: 'Print order moved to trash' });
}));

export default router;
