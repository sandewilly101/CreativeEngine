import express from 'express';
import { query, queryOne, execute, transaction } from '../config/db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { createCrudRouter } from '../services/crudFactory.js';
import { logActivity } from '../services/activityLog.js';
import { notifyByPermission } from '../services/notifications.js';
import { calculateTotals } from '../utils/money.js';
import {
  ApiError, asyncHandler, generateReference, parsePagination,
  paginatedResponse, safeSort, daysBetween, parseJsonRows,
} from '../utils/helpers.js';

const router = express.Router();

// ---------------------------------------------------- EQUIPMENT CATALOGUE
router.use('/equipment', createCrudRouter({
  table: 'equipment',
  module: 'equipment',
  fields: ['category_id', 'sku', 'slug', 'name', 'description', 'specifications',
    'cover_media_id', 'gallery', 'total_units', 'daily_rate_cents', 'half_day_rate_cents',
    'weekly_rate_cents', 'monthly_rate_cents', 'unit_of_measure', 'deposit_cents',
    'damage_waiver_percent', 'replacement_value_cents', 'requires_operator',
    'operator_day_rate_cents', 'requires_transport', 'transport_cents', 'setup_hours',
    'power_requirement', 'weight_kg', 'dimensions', 'min_rental_days', 'ownership',
    'supplier_id', 'supplier_cost_cents', 'condition_notes', 'status', 'is_published',
    'is_featured'],
  searchable: ['name', 'sku', 'description'],
  filterable: ['category_id', 'status', 'is_published', 'ownership', 'is_featured'],
  sortable: ['id', 'name', 'sku', 'daily_rate_cents', 'utilisation_days', 'created_at'],
  jsonFields: ['specifications', 'gallery'],
  slugFrom: 'name',
  defaultSort: 'name',
  listSelect: `SELECT equipment.*, c.name AS category_name, m.public_url AS cover_url,
                      m.thumb_url AS cover_thumb, s.name AS supplier_name
                 FROM equipment
            LEFT JOIN equipment_categories c ON c.id = equipment.category_id
            LEFT JOIN media m ON m.id = equipment.cover_media_id
            LEFT JOIN suppliers s ON s.id = equipment.supplier_id`,
}));

// --------------------------------------------------------- AVAILABILITY
/**
 * Compute free units for a date window. Setup and teardown extend the block,
 * because gear leaving the store the day before an event is not available
 * to anyone else on that day.
 */
async function availableUnits(equipmentId, start, end, excludeBookingId = null) {
  const item = await queryOne(
    'SELECT id, name, total_units FROM equipment WHERE id = ? AND deleted_at IS NULL',
    [equipmentId]
  );
  if (!item) throw ApiError.badRequest(`Equipment ${equipmentId} not found`);

  const params = [equipmentId, end, start];
  let excludeSql = '';
  if (excludeBookingId) {
    excludeSql = ' AND b.id != ?';
    params.push(excludeBookingId);
  }

  const booked = await queryOne(
    `SELECT COALESCE(SUM(bi.quantity), 0) AS qty
       FROM booking_items bi
       JOIN bookings b ON b.id = bi.booking_id
      WHERE bi.equipment_id = ?
        AND b.status IN ('confirmed','dispatched','on_hire')
        AND b.deleted_at IS NULL
        AND COALESCE(b.setup_date, b.start_date) < ?
        AND COALESCE(b.teardown_date, b.end_date) > ?${excludeSql}`,
    params
  );

  const maintenance = await queryOne(
    `SELECT COUNT(*) AS units FROM equipment_maintenance
      WHERE equipment_id = ? AND status IN ('scheduled','in_progress')
        AND start_date < ? AND end_date > ?`,
    [equipmentId, end, start]
  );

  const available = Math.max(0, item.total_units - Number(booked.qty) - Number(maintenance.units));
  return { ...item, booked: Number(booked.qty), maintenance: Number(maintenance.units), available };
}

router.get('/availability', authenticate, requirePermission('bookings.view'), asyncHandler(async (req, res) => {
  const { start, end, equipment_ids } = req.query;
  if (!start || !end) throw ApiError.badRequest('start and end dates are required');

  const ids = equipment_ids
    ? String(equipment_ids).split(',').map(Number).filter(Boolean)
    : (await query("SELECT id FROM equipment WHERE deleted_at IS NULL AND status='available'")).map((r) => r.id);

  const results = await Promise.all(
    ids.map((id) => availableUnits(id, start, end, req.query.exclude_booking_id || null))
  );
  res.json({ data: results });
}));

/** Calendar feed: every booking touching a date range. */
router.get('/calendar', authenticate, requirePermission('bookings.view'), asyncHandler(async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) throw ApiError.badRequest('start and end dates are required');

  const rows = await query(
    `SELECT b.id, b.reference, b.event_name, b.venue, b.start_date, b.end_date,
            b.setup_date, b.teardown_date, b.status, b.total_cents, b.currency,
            o.name AS organisation_name,
            GROUP_CONCAT(CONCAT(e.name, ' x', bi.quantity) SEPARATOR ', ') AS equipment_summary
       FROM bookings b
  LEFT JOIN organisations o ON o.id = b.organisation_id
  LEFT JOIN booking_items bi ON bi.booking_id = b.id
  LEFT JOIN equipment e ON e.id = bi.equipment_id
      WHERE b.deleted_at IS NULL
        AND COALESCE(b.setup_date, b.start_date) < ?
        AND COALESCE(b.teardown_date, b.end_date) > ?
      GROUP BY b.id
      ORDER BY b.start_date`,
    [end, start]
  );
  res.json({ data: rows });
}));

// -------------------------------------------------------------- BOOKINGS
router.use(authenticate);

router.get('/', requirePermission('bookings.view'), asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { column, direction } = safeSort(req.query.sort,
    ['id', 'reference', 'start_date', 'end_date', 'total_cents', 'status', 'created_at'], 'start_date');

  const where = ['b.deleted_at IS NULL'];
  const params = [];
  if (req.query.status) {
    const list = String(req.query.status).split(',');
    where.push(`b.status IN (${list.map(() => '?').join(',')})`);
    params.push(...list);
  }
  if (req.query.organisation_id) { where.push('b.organisation_id = ?'); params.push(req.query.organisation_id); }
  if (req.query.date_from) { where.push('b.end_date >= ?'); params.push(req.query.date_from); }
  if (req.query.date_to) { where.push('b.start_date <= ?'); params.push(req.query.date_to); }
  if (req.query.search) {
    where.push('(b.reference LIKE ? OR b.event_name LIKE ? OR b.contact_name LIKE ? OR b.venue LIKE ?)');
    const t = `%${req.query.search}%`;
    params.push(t, t, t, t);
  }
  if (req.user.role_slug === 'client') {
    where.push('b.organisation_id = ?');
    params.push(req.user.organisation_id);
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const rows = await query(
    `SELECT b.*, o.name AS organisation_name,
            (SELECT COUNT(*) FROM booking_items WHERE booking_id = b.id) AS item_count
       FROM bookings b LEFT JOIN organisations o ON o.id = b.organisation_id
       ${whereSql} ORDER BY b.\`${column}\` ${direction} LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  const countRow = await queryOne(`SELECT COUNT(*) AS total FROM bookings b ${whereSql}`, params);
  res.json(paginatedResponse(rows, countRow.total, { page, limit }));
}));

router.get('/:id', requirePermission('bookings.view'), asyncHandler(async (req, res) => {
  const scope = req.user.role_slug === 'client' ? ' AND b.organisation_id = ?' : '';
  const params = req.user.role_slug === 'client'
    ? [req.params.id, req.user.organisation_id] : [req.params.id];

  const booking = await queryOne(
    `SELECT b.*, o.name AS organisation_name, p.name AS project_name,
            CONCAT(u.first_name,' ',u.last_name) AS handler_name
       FROM bookings b
  LEFT JOIN organisations o ON o.id = b.organisation_id
  LEFT JOIN projects p ON p.id = b.project_id
  LEFT JOIN users u ON u.id = b.handled_by
      WHERE b.id = ? AND b.deleted_at IS NULL${scope}`,
    params
  );
  if (!booking) throw ApiError.notFound('Booking not found');

  const items = await query(
    `SELECT bi.*, e.name AS equipment_name, e.sku, e.unit_of_measure, e.deposit_cents,
            m.thumb_url AS equipment_thumb, eu.asset_tag
       FROM booking_items bi
       JOIN equipment e ON e.id = bi.equipment_id
  LEFT JOIN media m ON m.id = e.cover_media_id
  LEFT JOIN equipment_units eu ON eu.id = bi.unit_id
      WHERE bi.booking_id = ?`,
    [booking.id]
  );
  res.json({ data: { ...booking, items } });
}));

/** Price a booking without saving — used by the live quote builder. */
router.post('/calculate', requirePermission('bookings.view'), asyncHandler(async (req, res) => {
  const { start_date, end_date, items = [] } = req.body;
  if (!start_date || !end_date) throw ApiError.badRequest('Start and end dates are required');

  const days = daysBetween(start_date, end_date);
  const lines = [];
  let transport = 0;
  let operator = 0;
  let deposit = 0;

  for (const item of items) {
    const equipment = await queryOne('SELECT * FROM equipment WHERE id = ?', [item.equipment_id]);
    if (!equipment) continue;

    const qty = Number(item.quantity || 1);
    const measure = Number(item.measure_qty || 1);

    // Weekly rate applies from 7 days when it is cheaper than day-rate stacking.
    let rateType = item.rate_type || 'daily';
    let rate = Number(equipment.daily_rate_cents);
    let chargeDays = days;

    if (rateType === 'half_day') { rate = Number(equipment.half_day_rate_cents); chargeDays = 1; }
    else if (days >= 7 && Number(equipment.weekly_rate_cents) > 0) {
      const weeks = Math.floor(days / 7);
      const remainder = days % 7;
      const weeklyTotal = weeks * Number(equipment.weekly_rate_cents) + remainder * rate;
      if (weeklyTotal < days * rate) {
        rateType = 'weekly';
        lines.push({
          equipment_id: equipment.id, name: equipment.name, quantity: qty,
          measure_qty: measure, rate_type: rateType,
          rate_cents: Number(equipment.weekly_rate_cents), days,
          line_total_cents: Math.round(weeklyTotal * qty * measure),
        });
        transport += Number(equipment.transport_cents) * (equipment.requires_transport ? 1 : 0);
        operator += equipment.requires_operator ? Number(equipment.operator_day_rate_cents) * days : 0;
        deposit += Number(equipment.deposit_cents) * qty;
        continue;
      }
    }

    const lineTotal = Math.round(rate * chargeDays * qty * measure);
    lines.push({
      equipment_id: equipment.id, name: equipment.name, quantity: qty,
      measure_qty: measure, rate_type: rateType, rate_cents: rate,
      days: chargeDays, line_total_cents: lineTotal,
    });
    transport += equipment.requires_transport ? Number(equipment.transport_cents) : 0;
    operator += equipment.requires_operator ? Number(equipment.operator_day_rate_cents) * days : 0;
    deposit += Number(equipment.deposit_cents) * qty;
  }

  const totals = calculateTotals({
    items: lines.map((l) => ({ quantity: 1, unit_price_cents: l.line_total_cents, is_taxable: true })),
    discountType: req.body.discount_type || 'none',
    discountValue: req.body.discount_value || 0,
    vatRate: req.body.vat_rate ?? 18,
    extraCharges: transport + operator,
  });

  res.json({
    data: {
      rental_days: days, lines,
      transport_cents: transport, operator_cents: operator, deposit_cents: deposit,
      ...totals,
    },
  });
}));

// ---------------------------------------------------------------- CREATE
router.post('/', requirePermission('bookings.create'), asyncHandler(async (req, res) => {
  const { start_date, end_date, items = [], contact_name } = req.body;
  if (!start_date || !end_date) throw ApiError.badRequest('Start and end dates are required');
  if (new Date(end_date) <= new Date(start_date)) throw ApiError.badRequest('The end date must be after the start date');
  if (!contact_name?.trim()) throw ApiError.badRequest('A contact name is required');
  if (!items.length) throw ApiError.badRequest('Add at least one item of equipment');

  const blockStart = req.body.setup_date || start_date;
  const blockEnd = req.body.teardown_date || end_date;

  // Reject the whole booking if any single line cannot be met.
  const conflicts = [];
  for (const item of items) {
    const avail = await availableUnits(item.equipment_id, blockStart, blockEnd);
    if (Number(item.quantity || 1) > avail.available) {
      conflicts.push({
        equipment_id: item.equipment_id, name: avail.name,
        requested: Number(item.quantity || 1), available: avail.available,
      });
    }
  }
  if (conflicts.length) {
    throw ApiError.conflict('Some equipment is not available for those dates', { conflicts });
  }

  const days = daysBetween(start_date, end_date);
  const created = await transaction(async (tx) => {
    const reference = await generateReference('booking', tx);

    let subtotal = 0;
    let transport = 0;
    let operator = 0;
    let deposit = 0;
    const prepared = [];

    for (const item of items) {
      const equipment = await tx.queryOne('SELECT * FROM equipment WHERE id = ?', [item.equipment_id]);
      const qty = Number(item.quantity || 1);
      const measure = Number(item.measure_qty || 1);
      const rateType = item.rate_type || 'daily';
      const rateColumn = {
        daily: 'daily_rate_cents', half_day: 'half_day_rate_cents',
        weekly: 'weekly_rate_cents', monthly: 'monthly_rate_cents',
      }[rateType];
      const rate = Number(item.rate_cents ?? equipment[rateColumn] ?? equipment.daily_rate_cents);
      const chargeDays = rateType === 'half_day' ? 1 : (rateType === 'weekly' ? Math.ceil(days / 7) : days);
      const lineTotal = Math.round(rate * chargeDays * qty * measure);

      subtotal += lineTotal;
      transport += equipment.requires_transport ? Number(equipment.transport_cents) : 0;
      operator += equipment.requires_operator ? Number(equipment.operator_day_rate_cents) * days : 0;
      deposit += Number(equipment.deposit_cents) * qty;

      prepared.push({ ...item, qty, measure, rateType, rate, chargeDays, lineTotal });
    }

    const totals = calculateTotals({
      items: [{ quantity: 1, unit_price_cents: subtotal, is_taxable: true }],
      discountType: req.body.discount_type || 'none',
      discountValue: req.body.discount_value || 0,
      vatRate: req.body.vat_rate ?? 18,
      extraCharges: transport + operator,
    });

    const result = await tx.execute(
      `INSERT INTO bookings
         (reference, organisation_id, project_id, contact_name, contact_email, contact_phone,
          event_name, venue, venue_address, start_date, end_date, setup_date, teardown_date,
          rental_days, currency, subtotal_cents, transport_cents, operator_cents,
          discount_cents, vat_rate, vat_cents, total_cents, deposit_cents, status,
          dispatch_notes, handled_by, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        reference, req.body.organisation_id || null, req.body.project_id || null,
        contact_name.trim(), req.body.contact_email || null, req.body.contact_phone || null,
        req.body.event_name || null, req.body.venue || null, req.body.venue_address || null,
        start_date, end_date, req.body.setup_date || null, req.body.teardown_date || null,
        days, req.body.currency || 'TZS',
        subtotal, transport, operator, totals.discount_cents,
        req.body.vat_rate ?? 18, totals.vat_cents, totals.total_cents, deposit,
        req.body.status || 'enquiry', req.body.dispatch_notes || null,
        req.body.handled_by || req.user.id, req.user.id,
      ]
    );

    for (const p of prepared) {
      await tx.execute(
        `INSERT INTO booking_items
           (booking_id, equipment_id, quantity, measure_qty, rate_type, rate_cents, days,
            line_total_cents, notes)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [result.insertId, p.equipment_id, p.qty, p.measure, p.rateType, p.rate, p.chargeDays,
         p.lineTotal, p.notes || null]
      );
    }
    return { id: result.insertId, reference };
  });

  await logActivity(req, 'created', 'bookings', created.id, created.reference);
  const booking = await queryOne('SELECT * FROM bookings WHERE id = ?', [created.id]);
  res.status(201).json({ data: booking, message: `Booking ${created.reference} created` });
}));

// ---------------------------------------------------------------- UPDATE
router.patch('/:id', requirePermission('bookings.update'), asyncHandler(async (req, res) => {
  const existing = await queryOne('SELECT * FROM bookings WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
  if (!existing) throw ApiError.notFound('Booking not found');

  // Re-check availability if the dates move, ignoring this booking's own hold.
  if (req.body.start_date || req.body.end_date || req.body.setup_date || req.body.teardown_date) {
    const start = req.body.setup_date || req.body.start_date || existing.setup_date || existing.start_date;
    const end = req.body.teardown_date || req.body.end_date || existing.teardown_date || existing.end_date;
    const items = await query('SELECT * FROM booking_items WHERE booking_id = ?', [req.params.id]);
    const conflicts = [];
    for (const item of items) {
      const avail = await availableUnits(item.equipment_id, start, end, req.params.id);
      if (item.quantity > avail.available) {
        conflicts.push({ name: avail.name, requested: item.quantity, available: avail.available });
      }
    }
    if (conflicts.length) throw ApiError.conflict('Equipment is not available for the new dates', { conflicts });
  }

  const fields = ['organisation_id', 'project_id', 'contact_name', 'contact_email', 'contact_phone',
    'event_name', 'venue', 'venue_address', 'start_date', 'end_date', 'setup_date', 'teardown_date',
    'status', 'dispatch_notes', 'return_notes', 'damage_report', 'damage_charge_cents',
    'deposit_paid', 'deposit_refunded_cents', 'handled_by', 'discount_cents'];
  const updates = {};
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];

  if (updates.status === 'dispatched' && existing.status !== 'dispatched') {
    updates.dispatched_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
  }
  if (updates.status === 'returned' && existing.status !== 'returned') {
    updates.returned_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
  }
  if (Object.keys(updates).length === 0) throw ApiError.badRequest('Nothing to update');

  const clause = Object.keys(updates).map((k) => `\`${k}\` = ?`).join(', ');
  await execute(`UPDATE bookings SET ${clause} WHERE id = ?`, [...Object.values(updates), req.params.id]);

  // Once returned, credit utilisation so the buy-vs-rent view stays accurate.
  if (updates.status === 'completed' || updates.status === 'returned') {
    await execute(
      `UPDATE equipment e
         JOIN booking_items bi ON bi.equipment_id = e.id
          SET e.utilisation_days = e.utilisation_days + ?
        WHERE bi.booking_id = ?`,
      [existing.rental_days, req.params.id]
    );
  }

  await logActivity(req, 'updated', 'bookings', req.params.id, existing.reference, { after: updates });
  const booking = await queryOne('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
  res.json({ data: booking, message: 'Booking updated' });
}));

/** Assign specific serialised units at dispatch. */
router.post('/:id/dispatch', requirePermission('bookings.update'), asyncHandler(async (req, res) => {
  const booking = await queryOne('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
  if (!booking) throw ApiError.notFound('Booking not found');

  await transaction(async (tx) => {
    for (const assignment of req.body.assignments || []) {
      await tx.execute(
        'UPDATE booking_items SET unit_id = ?, condition_out = ? WHERE id = ? AND booking_id = ?',
        [assignment.unit_id || null, assignment.condition || 'good', assignment.item_id, req.params.id]
      );
      if (assignment.unit_id) {
        await tx.execute("UPDATE equipment_units SET status = 'on_hire' WHERE id = ?", [assignment.unit_id]);
      }
    }
    await tx.execute(
      "UPDATE bookings SET status = 'dispatched', dispatched_at = NOW(), dispatch_notes = ? WHERE id = ?",
      [req.body.notes || booking.dispatch_notes, req.params.id]
    );
  });
  await logActivity(req, 'dispatched', 'bookings', req.params.id, booking.reference);
  res.json({ message: 'Booking dispatched' });
}));

/** Check gear back in, recording condition and any damage charge. */
router.post('/:id/return', requirePermission('bookings.update'), asyncHandler(async (req, res) => {
  const booking = await queryOne('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
  if (!booking) throw ApiError.notFound('Booking not found');

  let damageCharge = 0;
  await transaction(async (tx) => {
    for (const ret of req.body.returns || []) {
      await tx.execute(
        'UPDATE booking_items SET returned_qty = ?, condition_in = ?, notes = ? WHERE id = ? AND booking_id = ?',
        [ret.returned_qty ?? 0, ret.condition || 'good', ret.notes || null, ret.item_id, req.params.id]
      );
      if (ret.unit_id) {
        const unitStatus = ['damaged', 'lost'].includes(ret.condition) ? 'maintenance' : 'available';
        await tx.execute(
          'UPDATE equipment_units SET status = ?, unit_condition = ? WHERE id = ?',
          [unitStatus, ret.condition || 'good', ret.unit_id]
        );
      }
      damageCharge += Number(ret.damage_charge_cents || 0);
    }

    const refund = Math.max(0, Number(booking.deposit_cents) - damageCharge);
    await tx.execute(
      `UPDATE bookings SET status = 'returned', returned_at = NOW(), return_notes = ?,
              damage_report = ?, damage_charge_cents = ?, deposit_refunded_cents = ?
        WHERE id = ?`,
      [req.body.notes || null, req.body.damage_report || null, damageCharge, refund, req.params.id]
    );
  });

  await logActivity(req, 'returned', 'bookings', req.params.id, booking.reference, { damage_charge_cents: damageCharge });
  res.json({
    message: 'Return recorded',
    data: {
      damage_charge_cents: damageCharge,
      deposit_refund_cents: Math.max(0, Number(booking.deposit_cents) - damageCharge),
    },
  });
}));

router.delete('/:id', requirePermission('bookings.delete'), asyncHandler(async (req, res) => {
  const booking = await queryOne('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
  if (!booking) throw ApiError.notFound('Booking not found');
  if (['dispatched', 'on_hire'].includes(booking.status)) {
    throw ApiError.badRequest('Equipment is currently out. Record the return before deleting this booking.');
  }
  await execute('UPDATE bookings SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
  await logActivity(req, 'deleted', 'bookings', req.params.id, booking.reference);
  res.json({ message: 'Booking moved to trash' });
}));

// ------------------------------------------------------------ MAINTENANCE
router.post('/maintenance', requirePermission('equipment.update'), asyncHandler(async (req, res) => {
  const { equipment_id, reason, start_date, end_date } = req.body;
  if (!equipment_id || !reason || !start_date || !end_date) {
    throw ApiError.badRequest('Equipment, reason, start and end dates are all required');
  }
  const result = await execute(
    `INSERT INTO equipment_maintenance (equipment_id, unit_id, reason, start_date, end_date,
                                        cost_cents, status, notes, created_by)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [equipment_id, req.body.unit_id || null, reason, start_date, end_date,
     req.body.cost_cents || 0, req.body.status || 'scheduled', req.body.notes || null, req.user.id]
  );
  res.status(201).json({ data: { id: result.insertId }, message: 'Maintenance scheduled' });
}));

router.get('/maintenance/list', requirePermission('equipment.view'), asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT em.*, e.name AS equipment_name, eu.asset_tag
       FROM equipment_maintenance em
       JOIN equipment e ON e.id = em.equipment_id
  LEFT JOIN equipment_units eu ON eu.id = em.unit_id
      WHERE (? IS NULL OR em.status = ?)
      ORDER BY em.start_date DESC`,
    [req.query.status || null, req.query.status || null]
  );
  res.json({ data: rows });
}));

// -------------------------------------------------------- UTILISATION VIEW
router.get('/reports/utilisation', requirePermission('reports.view'), asyncHandler(async (_req, res) => {
  const rows = await query('SELECT * FROM v_equipment_utilisation ORDER BY lifetime_revenue_cents DESC');
  res.json({ data: rows });
}));

export default router;
