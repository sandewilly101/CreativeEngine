import express from 'express';
import { query, queryOne, execute, transaction } from '../config/db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { logActivity } from '../services/activityLog.js';
import { notifyOrganisation } from '../services/notifications.js';
import { getRate } from '../services/fxService.js';
import { calculateTotals } from '../utils/money.js';
import {
  ApiError, asyncHandler, generateReference, parsePagination,
  paginatedResponse, safeSort, randomToken, addDays, toMysqlDate,
} from '../utils/helpers.js';

/**
 * Quotes carry line items, so they need transactional create/update rather
 * than the generic CRUD factory. Totals are always recomputed server-side —
 * a client can never post its own total.
 */
const router = express.Router();
router.use(authenticate);

async function recalcAndSave(quoteId, tx) {
  const q = tx || { query, queryOne, execute };
  const quote = await q.queryOne('SELECT * FROM quotes WHERE id = ?', [quoteId]);
  const items = await q.query('SELECT * FROM quote_items WHERE quote_id = ?', [quoteId]);

  const totals = calculateTotals({
    items: items.map((i) => ({
      quantity: i.quantity,
      unit_price_cents: i.unit_price_cents,
      is_taxable: i.is_taxable,
    })),
    discountType: quote.discount_type,
    discountValue: quote.discount_value,
    vatRate: quote.vat_rate,
  });

  await q.execute(
    `UPDATE quotes SET subtotal_cents = ?, discount_cents = ?, vat_cents = ?, total_cents = ?
      WHERE id = ?`,
    [totals.subtotal_cents, totals.discount_cents, totals.vat_cents, totals.total_cents, quoteId]
  );
  return totals;
}

async function saveItems(quoteId, items, tx) {
  await tx.execute('DELETE FROM quote_items WHERE quote_id = ?', [quoteId]);
  for (const [index, item] of (items || []).entries()) {
    const qty = Number(item.quantity ?? 1);
    const unitPrice = Number(item.unit_price_cents ?? 0);
    await tx.execute(
      `INSERT INTO quote_items
         (quote_id, service_id, package_id, equipment_id, item_type, description, detail,
          quantity, unit, unit_price_cents, line_total_cents, is_taxable, is_optional, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        quoteId, item.service_id || null, item.package_id || null, item.equipment_id || null,
        item.item_type || 'custom', item.description || 'Item', item.detail || null,
        qty, item.unit || 'item', unitPrice, Math.round(qty * unitPrice),
        item.is_taxable === false ? 0 : 1, item.is_optional ? 1 : 0, item.sort_order ?? index,
      ]
    );
  }
}

// ------------------------------------------------------------------ LIST
router.get('/', requirePermission('quotes.view'), asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { column, direction } = safeSort(req.query.sort,
    ['id', 'reference', 'created_at', 'total_cents', 'valid_until', 'status'], 'created_at');

  const where = ['q.deleted_at IS NULL'];
  const params = [];
  if (req.query.status) { where.push('q.status = ?'); params.push(req.query.status); }
  if (req.query.organisation_id) { where.push('q.organisation_id = ?'); params.push(req.query.organisation_id); }
  if (req.query.search) {
    where.push('(q.reference LIKE ? OR q.title LIKE ? OR o.name LIKE ?)');
    const t = `%${req.query.search}%`;
    params.push(t, t, t);
  }
  if (req.user.role_slug === 'client') {
    where.push('q.organisation_id = ?');
    params.push(req.user.organisation_id);
    where.push("q.status != 'draft'");
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const rows = await query(
    `SELECT q.*, o.name AS organisation_name,
            CONCAT(u.first_name,' ',u.last_name) AS created_by_name,
            (SELECT COUNT(*) FROM quote_items WHERE quote_id = q.id) AS item_count
       FROM quotes q
       JOIN organisations o ON o.id = q.organisation_id
  LEFT JOIN users u ON u.id = q.created_by
       ${whereSql}
      ORDER BY q.\`${column}\` ${direction} LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  const countRow = await queryOne(
    `SELECT COUNT(*) AS total FROM quotes q JOIN organisations o ON o.id = q.organisation_id ${whereSql}`,
    params
  );
  res.json(paginatedResponse(rows, countRow.total, { page, limit }));
}));

// ----------------------------------------------------------------- STATS
router.get('/stats', requirePermission('quotes.view'), asyncHandler(async (_req, res) => {
  const byStatus = await query(
    `SELECT status, COUNT(*) AS count, COALESCE(SUM(total_cents),0) AS value_cents
       FROM quotes WHERE deleted_at IS NULL GROUP BY status`
  );
  const conversion = await queryOne(
    `SELECT
       SUM(status = 'accepted') AS accepted,
       SUM(status IN ('sent','viewed','accepted','rejected')) AS responded_pool
     FROM quotes WHERE deleted_at IS NULL`
  );
  const winRate = Number(conversion.responded_pool) > 0
    ? Number(((Number(conversion.accepted) / Number(conversion.responded_pool)) * 100).toFixed(1))
    : 0;
  res.json({ data: { by_status: byStatus, win_rate_percent: winRate } });
}));

// ------------------------------------------------------------------ READ
router.get('/:id', requirePermission('quotes.view'), asyncHandler(async (req, res) => {
  const scope = req.user.role_slug === 'client' ? ' AND q.organisation_id = ?' : '';
  const params = req.user.role_slug === 'client'
    ? [req.params.id, req.user.organisation_id] : [req.params.id];

  const quote = await queryOne(
    `SELECT q.*, o.name AS organisation_name, o.email AS organisation_email,
            o.tin AS buyer_tin, o.vrn AS buyer_vrn, o.address_line1, o.city,
            CONCAT(u.first_name,' ',u.last_name) AS created_by_name
       FROM quotes q
       JOIN organisations o ON o.id = q.organisation_id
  LEFT JOIN users u ON u.id = q.created_by
      WHERE q.id = ? AND q.deleted_at IS NULL${scope}`,
    params
  );
  if (!quote) throw ApiError.notFound('Quote not found');

  const items = await query('SELECT * FROM quote_items WHERE quote_id = ? ORDER BY sort_order, id', [quote.id]);
  const revisions = await query(
    'SELECT id, reference, version, status, total_cents, created_at FROM quotes WHERE parent_quote_id = ? OR id = ? ORDER BY version',
    [quote.parent_quote_id || quote.id, quote.parent_quote_id || quote.id]
  );
  res.json({ data: { ...quote, items, revisions } });
}));

// ---------------------------------------------------------------- CREATE
router.post('/', requirePermission('quotes.create'), asyncHandler(async (req, res) => {
  const { organisation_id, title, items = [] } = req.body;
  if (!organisation_id) throw ApiError.badRequest('A client organisation is required');
  if (!title?.trim()) throw ApiError.badRequest('A quote title is required');

  const currency = req.body.currency || 'TZS';
  const fxRate = currency === 'TZS' ? 1 : await getRate(currency);

  const created = await transaction(async (tx) => {
    const reference = await generateReference('quote', tx);
    const validDays = Number(req.body.validity_days || 30);

    const result = await tx.execute(
      `INSERT INTO quotes
         (reference, organisation_id, lead_id, title, intro, terms, notes, currency,
          fx_rate_to_tzs, discount_type, discount_value, vat_rate, valid_until,
          status, public_token, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        reference, organisation_id, req.body.lead_id || null, title.trim(),
        req.body.intro || null, req.body.terms || null, req.body.notes || null,
        currency, fxRate,
        req.body.discount_type || 'none', req.body.discount_value || 0,
        req.body.vat_rate ?? 18,
        toMysqlDate(addDays(new Date(), validDays)),
        'draft', randomToken(24), req.user.id,
      ]
    );
    await saveItems(result.insertId, items, tx);
    await recalcAndSave(result.insertId, tx);
    return { id: result.insertId, reference };
  });

  await logActivity(req, 'created', 'quotes', created.id, created.reference);
  const quote = await queryOne('SELECT * FROM quotes WHERE id = ?', [created.id]);
  res.status(201).json({ data: quote, message: `Quote ${created.reference} created` });
}));

// ---------------------------------------------------------------- UPDATE
router.patch('/:id', requirePermission('quotes.update'), asyncHandler(async (req, res) => {
  const existing = await queryOne('SELECT * FROM quotes WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
  if (!existing) throw ApiError.notFound('Quote not found');
  if (['accepted', 'rejected'].includes(existing.status)) {
    throw ApiError.badRequest('A quote that has been responded to cannot be edited. Create a revision instead.');
  }

  await transaction(async (tx) => {
    const fields = ['title', 'intro', 'terms', 'notes', 'discount_type', 'discount_value',
      'vat_rate', 'valid_until', 'status', 'lead_id'];
    const updates = {};
    for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];

    if (req.body.currency && req.body.currency !== existing.currency) {
      updates.currency = req.body.currency;
      updates.fx_rate_to_tzs = req.body.currency === 'TZS' ? 1 : await getRate(req.body.currency);
    }

    if (Object.keys(updates).length) {
      const clause = Object.keys(updates).map((k) => `\`${k}\` = ?`).join(', ');
      await tx.execute(`UPDATE quotes SET ${clause} WHERE id = ?`, [...Object.values(updates), req.params.id]);
    }
    if (req.body.items) await saveItems(req.params.id, req.body.items, tx);
    await recalcAndSave(req.params.id, tx);
  });

  await logActivity(req, 'updated', 'quotes', req.params.id, existing.reference);
  const quote = await queryOne('SELECT * FROM quotes WHERE id = ?', [req.params.id]);
  const items = await query('SELECT * FROM quote_items WHERE quote_id = ? ORDER BY sort_order', [req.params.id]);
  res.json({ data: { ...quote, items }, message: 'Quote updated' });
}));

// ------------------------------------------------------------------ SEND
router.post('/:id/send', requirePermission('quotes.send'), asyncHandler(async (req, res) => {
  const quote = await queryOne('SELECT * FROM quotes WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
  if (!quote) throw ApiError.notFound('Quote not found');

  const itemCount = await queryOne('SELECT COUNT(*) AS c FROM quote_items WHERE quote_id = ?', [quote.id]);
  if (Number(itemCount.c) === 0) throw ApiError.badRequest('Add at least one line item before sending');

  const token = quote.public_token || randomToken(24);
  await execute(
    "UPDATE quotes SET status = 'sent', sent_at = NOW(), public_token = ? WHERE id = ?",
    [token, quote.id]
  );
  await notifyOrganisation(quote.organisation_id, {
    type: 'quote.received',
    title: `Quote ${quote.reference} is ready for review`,
    body: quote.title,
    linkUrl: `/portal/quotes/${quote.id}`,
    entityType: 'quotes', entityId: quote.id, icon: 'file-text',
  });
  await logActivity(req, 'sent', 'quotes', quote.id, quote.reference);

  res.json({
    message: 'Quote sent',
    data: { public_url: `/q/${token}` },
  });
}));

// -------------------------------------------------------------- REVISION
router.post('/:id/revise', requirePermission('quotes.create'), asyncHandler(async (req, res) => {
  const original = await queryOne('SELECT * FROM quotes WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
  if (!original) throw ApiError.notFound('Quote not found');

  const created = await transaction(async (tx) => {
    const reference = await generateReference('quote', tx);
    const rootId = original.parent_quote_id || original.id;
    const maxVersion = await tx.queryOne(
      'SELECT COALESCE(MAX(version),1) AS v FROM quotes WHERE parent_quote_id = ? OR id = ?',
      [rootId, rootId]
    );

    const result = await tx.execute(
      `INSERT INTO quotes
         (reference, organisation_id, lead_id, title, intro, terms, notes, currency, fx_rate_to_tzs,
          discount_type, discount_value, vat_rate, valid_until, status, public_token,
          version, parent_quote_id, created_by)
       SELECT ?, organisation_id, lead_id, title, intro, terms, notes, currency, fx_rate_to_tzs,
              discount_type, discount_value, vat_rate, valid_until, 'draft', ?, ?, ?, ?
         FROM quotes WHERE id = ?`,
      [reference, randomToken(24), Number(maxVersion.v) + 1, rootId, req.user.id, original.id]
    );

    await tx.execute(
      `INSERT INTO quote_items
         (quote_id, service_id, package_id, equipment_id, item_type, description, detail,
          quantity, unit, unit_price_cents, line_total_cents, is_taxable, is_optional, sort_order)
       SELECT ?, service_id, package_id, equipment_id, item_type, description, detail,
              quantity, unit, unit_price_cents, line_total_cents, is_taxable, is_optional, sort_order
         FROM quote_items WHERE quote_id = ?`,
      [result.insertId, original.id]
    );

    await tx.execute("UPDATE quotes SET status = 'revised' WHERE id = ?", [original.id]);
    await recalcAndSave(result.insertId, tx);
    return { id: result.insertId, reference };
  });

  res.status(201).json({ data: { id: created.id }, message: `Revision ${created.reference} created` });
}));

// -------------------------------------------- CONVERT TO PROJECT/INVOICE
router.post('/:id/convert-to-project', requirePermission('projects.create'), asyncHandler(async (req, res) => {
  const quote = await queryOne('SELECT * FROM quotes WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
  if (!quote) throw ApiError.notFound('Quote not found');
  if (quote.status !== 'accepted') throw ApiError.badRequest('Only an accepted quote can become a project');

  const existing = await queryOne('SELECT id FROM projects WHERE quote_id = ? AND deleted_at IS NULL', [quote.id]);
  if (existing) throw ApiError.conflict('A project already exists for this quote', { project_id: existing.id });

  const created = await transaction(async (tx) => {
    const reference = await generateReference('project', tx);
    const result = await tx.execute(
      `INSERT INTO projects
         (reference, organisation_id, quote_id, division_id, name, description,
          budget_cents, currency, status, start_date, due_date, project_manager_id, created_by)
       VALUES (?,?,?,?,?,?,?,?,'planning',?,?,?,?)`,
      [
        reference, quote.organisation_id, quote.id, req.body.division_id || null,
        req.body.name || quote.title, quote.intro || null,
        quote.total_cents, quote.currency,
        req.body.start_date || toMysqlDate(new Date()),
        req.body.due_date || null,
        req.body.project_manager_id || req.user.id, req.user.id,
      ]
    );

    // Each quote line becomes a starter task so nothing is forgotten.
    const items = await tx.query('SELECT * FROM quote_items WHERE quote_id = ? ORDER BY sort_order', [quote.id]);
    for (const [i, item] of items.entries()) {
      await tx.execute(
        `INSERT INTO tasks (project_id, title, description, status, sort_order, created_by)
         VALUES (?,?,?,'todo',?,?)`,
        [result.insertId, item.description.slice(0, 250), item.detail || null, i, req.user.id]
      );
    }
    return { id: result.insertId, reference };
  });

  await logActivity(req, 'converted', 'quotes', quote.id, quote.reference, { to_project: created.id });
  res.status(201).json({ data: { project_id: created.id, reference: created.reference }, message: 'Project created from quote' });
}));

router.post('/:id/convert-to-invoice', requirePermission('invoices.create'), asyncHandler(async (req, res) => {
  const quote = await queryOne('SELECT * FROM quotes WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
  if (!quote) throw ApiError.notFound('Quote not found');

  const org = await queryOne('SELECT * FROM organisations WHERE id = ?', [quote.organisation_id]);
  const seller = await query("SELECT setting_key, setting_value FROM settings WHERE group_key = 'finance' AND setting_key IN ('company_tin','company_vrn')");
  const sellerMap = Object.fromEntries(seller.map((s) => [s.setting_key, s.setting_value]));

  const created = await transaction(async (tx) => {
    const reference = await generateReference('invoice', tx);
    const termDays = Number(req.body.payment_terms_days ?? org.payment_terms_days ?? 30);

    const result = await tx.execute(
      `INSERT INTO invoices
         (reference, organisation_id, project_id, quote_id, type, title, currency, fx_rate_to_tzs,
          fx_captured_at, subtotal_cents, discount_cents, vat_rate, vat_cents, total_cents,
          balance_cents, issue_date, due_date, status, public_token, terms,
          seller_tin, seller_vrn, buyer_tin, buyer_vrn, created_by)
       VALUES (?,?,?,?,?,?,?,?,NOW(),?,?,?,?,?,?,CURDATE(),?,?,?,?,?,?,?,?,?)`,
      [
        reference, quote.organisation_id, req.body.project_id || null, quote.id,
        req.body.type || 'standard', quote.title, quote.currency, quote.fx_rate_to_tzs,
        quote.subtotal_cents, quote.discount_cents, quote.vat_rate, quote.vat_cents,
        quote.total_cents, quote.total_cents,
        toMysqlDate(addDays(new Date(), termDays)),
        'draft', randomToken(24), quote.terms,
        sellerMap.company_tin || null, sellerMap.company_vrn || null,
        org.tin || null, org.vrn || null, req.user.id,
      ]
    );

    await tx.execute(
      `INSERT INTO invoice_items (invoice_id, service_id, description, detail, quantity, unit,
                                  unit_price_cents, line_total_cents, is_taxable, sort_order)
       SELECT ?, service_id, description, detail, quantity, unit,
              unit_price_cents, line_total_cents, is_taxable, sort_order
         FROM quote_items WHERE quote_id = ? AND is_optional = 0`,
      [result.insertId, quote.id]
    );
    return { id: result.insertId, reference };
  });

  await logActivity(req, 'converted', 'quotes', quote.id, quote.reference, { to_invoice: created.id });
  res.status(201).json({ data: { invoice_id: created.id, reference: created.reference }, message: 'Invoice created from quote' });
}));

// ---------------------------------------------------------------- DELETE
router.delete('/:id', requirePermission('quotes.delete'), asyncHandler(async (req, res) => {
  const quote = await queryOne('SELECT * FROM quotes WHERE id = ?', [req.params.id]);
  if (!quote) throw ApiError.notFound('Quote not found');
  await execute('UPDATE quotes SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
  await logActivity(req, 'deleted', 'quotes', req.params.id, quote.reference);
  res.json({ message: 'Quote moved to trash' });
}));

export default router;
