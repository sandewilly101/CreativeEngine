import express from 'express';
import { query, queryOne, execute, transaction } from '../config/db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { logActivity } from '../services/activityLog.js';
import { notifyOrganisation, notifyByPermission } from '../services/notifications.js';
import { getRate } from '../services/fxService.js';
import { calculateTotals } from '../utils/money.js';
import {
  ApiError, asyncHandler, generateReference, parsePagination,
  paginatedResponse, safeSort, randomToken, addDays, toMysqlDate,
} from '../utils/helpers.js';

const router = express.Router();
router.use(authenticate);

async function recalcInvoice(invoiceId, tx) {
  const q = tx || { query, queryOne, execute };
  const invoice = await q.queryOne('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
  const items = await q.query('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoiceId]);

  const totals = calculateTotals({
    items: items.map((i) => ({
      quantity: i.quantity, unit_price_cents: i.unit_price_cents, is_taxable: i.is_taxable,
    })),
    discountType: 'fixed',
    discountValue: invoice.discount_cents,
    vatRate: invoice.vat_rate,
  });

  const withholding = Math.round((totals.total_cents * Number(invoice.withholding_percent || 0)) / 100);
  const total = totals.total_cents;
  const paid = Number(invoice.paid_cents || 0);

  await q.execute(
    `UPDATE invoices SET subtotal_cents = ?, vat_cents = ?, withholding_cents = ?,
            total_cents = ?, balance_cents = ? WHERE id = ?`,
    [totals.subtotal_cents, totals.vat_cents, withholding, total, Math.max(0, total - paid), invoiceId]
  );
  return totals;
}

/** Recompute paid/balance and move the status accordingly. */
async function syncPaymentState(invoiceId, tx) {
  const q = tx || { query, queryOne, execute };
  const invoice = await q.queryOne('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
  const sum = await q.queryOne(
    "SELECT COALESCE(SUM(amount_cents),0) AS paid FROM payments WHERE invoice_id = ? AND status = 'confirmed'",
    [invoiceId]
  );
  const paid = Number(sum.paid);
  const total = Number(invoice.total_cents);
  const balance = Math.max(0, total - paid);

  // Money actually received always moves the status, even on an invoice still
  // marked draft — a walk-in client can pay before the invoice is formally sent.
  // Cancelled and refunded are terminal and are left alone.
  let status = invoice.status;
  if (!['cancelled', 'refunded'].includes(status)) {
    if (paid >= total && total > 0) status = 'paid';
    else if (paid > 0) status = 'partial';
    else if (status === 'draft') status = 'draft';
    else if (new Date(invoice.due_date) < new Date()) status = 'overdue';
    else if (invoice.viewed_at) status = 'viewed';
    else if (invoice.sent_at) status = 'sent';
  }

  await q.execute(
    `UPDATE invoices SET paid_cents = ?, balance_cents = ?, status = ?,
            paid_at = IF(? = 'paid' AND paid_at IS NULL, NOW(), paid_at) WHERE id = ?`,
    [paid, balance, status, status, invoiceId]
  );
  return { paid, balance, status };
}

// ------------------------------------------------------------------ LIST
router.get('/', requirePermission('invoices.view'), asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { column, direction } = safeSort(req.query.sort,
    ['id', 'reference', 'issue_date', 'due_date', 'total_cents', 'balance_cents', 'status'], 'issue_date');

  const where = ['i.deleted_at IS NULL'];
  const params = [];
  if (req.query.status) {
    const list = String(req.query.status).split(',');
    where.push(`i.status IN (${list.map(() => '?').join(',')})`);
    params.push(...list);
  }
  if (req.query.organisation_id) { where.push('i.organisation_id = ?'); params.push(req.query.organisation_id); }
  if (req.query.overdue === 'true') {
    where.push("i.due_date < CURDATE() AND i.status IN ('sent','viewed','partial','overdue')");
  }
  if (req.query.date_from) { where.push('i.issue_date >= ?'); params.push(req.query.date_from); }
  if (req.query.date_to) { where.push('i.issue_date <= ?'); params.push(req.query.date_to); }
  if (req.query.search) {
    where.push('(i.reference LIKE ? OR i.title LIKE ? OR o.name LIKE ?)');
    const t = `%${req.query.search}%`;
    params.push(t, t, t);
  }
  if (req.user.role_slug === 'client') {
    where.push('i.organisation_id = ?', "i.status != 'draft'");
    params.push(req.user.organisation_id);
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const rows = await query(
    `SELECT i.*, o.name AS organisation_name,
            DATEDIFF(CURDATE(), i.due_date) AS days_overdue
       FROM invoices i JOIN organisations o ON o.id = i.organisation_id
       ${whereSql} ORDER BY i.\`${column}\` ${direction} LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  const countRow = await queryOne(
    `SELECT COUNT(*) AS total FROM invoices i JOIN organisations o ON o.id = i.organisation_id ${whereSql}`,
    params
  );
  res.json(paginatedResponse(rows, countRow.total, { page, limit }));
}));

// ----------------------------------------------------------------- STATS
router.get('/stats', requirePermission('invoices.view'), asyncHandler(async (_req, res) => {
  const summary = await queryOne(
    `SELECT
       COALESCE(SUM(CASE WHEN status='paid' THEN total_cents END),0)                        AS collected_cents,
       COALESCE(SUM(CASE WHEN status IN ('sent','viewed','partial','overdue') THEN balance_cents END),0) AS outstanding_cents,
       COALESCE(SUM(CASE WHEN due_date < CURDATE() AND status IN ('sent','viewed','partial','overdue') THEN balance_cents END),0) AS overdue_cents,
       COALESCE(SUM(CASE WHEN status='draft' THEN total_cents END),0)                       AS draft_cents,
       COUNT(*) AS total_invoices
     FROM invoices WHERE deleted_at IS NULL`
  );
  const aging = await query(
    `SELECT
       CASE
         WHEN DATEDIFF(CURDATE(), due_date) <= 0  THEN 'current'
         WHEN DATEDIFF(CURDATE(), due_date) <= 30 THEN '1-30'
         WHEN DATEDIFF(CURDATE(), due_date) <= 60 THEN '31-60'
         WHEN DATEDIFF(CURDATE(), due_date) <= 90 THEN '61-90'
         ELSE '90+'
       END AS bucket,
       COUNT(*) AS count, COALESCE(SUM(balance_cents),0) AS amount_cents
     FROM invoices
    WHERE deleted_at IS NULL AND status IN ('sent','viewed','partial','overdue')
    GROUP BY bucket`
  );
  res.json({ data: { summary, aging } });
}));

// ------------------------------------------------------------------ READ
router.get('/:id', requirePermission('invoices.view'), asyncHandler(async (req, res) => {
  const scope = req.user.role_slug === 'client' ? ' AND i.organisation_id = ?' : '';
  const params = req.user.role_slug === 'client'
    ? [req.params.id, req.user.organisation_id] : [req.params.id];

  const invoice = await queryOne(
    `SELECT i.*, o.name AS organisation_name, o.email AS organisation_email,
            o.address_line1, o.address_line2, o.city, o.tin AS org_tin, o.vrn AS org_vrn,
            p.name AS project_name
       FROM invoices i
       JOIN organisations o ON o.id = i.organisation_id
  LEFT JOIN projects p ON p.id = i.project_id
      WHERE i.id = ? AND i.deleted_at IS NULL${scope}`,
    params
  );
  if (!invoice) throw ApiError.notFound('Invoice not found');

  const items = await query('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order, id', [invoice.id]);
  const payments = await query(
    `SELECT p.*, CONCAT(u.first_name,' ',u.last_name) AS recorded_by_name
       FROM payments p LEFT JOIN users u ON u.id = p.recorded_by
      WHERE p.invoice_id = ? ORDER BY p.paid_at DESC`,
    [invoice.id]
  );
  res.json({ data: { ...invoice, items, payments } });
}));

// ---------------------------------------------------------------- CREATE
router.post('/', requirePermission('invoices.create'), asyncHandler(async (req, res) => {
  const { organisation_id, items = [] } = req.body;
  if (!organisation_id) throw ApiError.badRequest('A client organisation is required');

  const org = await queryOne('SELECT * FROM organisations WHERE id = ?', [organisation_id]);
  if (!org) throw ApiError.badRequest('Organisation not found');

  const settings = await query(
    "SELECT setting_key, setting_value FROM settings WHERE group_key='finance' AND setting_key IN ('company_tin','company_vrn','payment_terms_days')"
  );
  const sMap = Object.fromEntries(settings.map((s) => [s.setting_key, s.setting_value]));

  const currency = req.body.currency || org.preferred_currency || 'TZS';
  const fxRate = currency === 'TZS' ? 1 : await getRate(currency);
  const termDays = Number(req.body.payment_terms_days ?? org.payment_terms_days ?? sMap.payment_terms_days ?? 30);

  const created = await transaction(async (tx) => {
    const reference = await generateReference('invoice', tx);
    const result = await tx.execute(
      `INSERT INTO invoices
         (reference, organisation_id, project_id, quote_id, booking_id, print_order_id,
          subscription_id, type, title, currency, fx_rate_to_tzs, fx_captured_at,
          discount_cents, vat_rate, withholding_percent, issue_date, due_date, status,
          public_token, notes, terms, payment_instructions,
          seller_tin, seller_vrn, buyer_tin, buyer_vrn, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,NOW(),?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        reference, organisation_id, req.body.project_id || null, req.body.quote_id || null,
        req.body.booking_id || null, req.body.print_order_id || null, req.body.subscription_id || null,
        req.body.type || 'standard', req.body.title || null, currency, fxRate,
        req.body.discount_cents || 0, req.body.vat_rate ?? 18, req.body.withholding_percent || 0,
        req.body.issue_date || toMysqlDate(new Date()),
        req.body.due_date || toMysqlDate(addDays(new Date(), termDays)),
        'draft', randomToken(24), req.body.notes || null, req.body.terms || null,
        req.body.payment_instructions || null,
        sMap.company_tin || null, sMap.company_vrn || null,
        org.tin || null, org.vrn || null, req.user.id,
      ]
    );

    for (const [i, item] of items.entries()) {
      const qty = Number(item.quantity ?? 1);
      const unit = Number(item.unit_price_cents ?? 0);
      await tx.execute(
        `INSERT INTO invoice_items (invoice_id, service_id, description, detail, quantity,
                                    unit, unit_price_cents, line_total_cents, is_taxable, sort_order)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          result.insertId, item.service_id || null, item.description || 'Item', item.detail || null,
          qty, item.unit || 'item', unit, Math.round(qty * unit),
          item.is_taxable === false ? 0 : 1, item.sort_order ?? i,
        ]
      );
    }
    await recalcInvoice(result.insertId, tx);
    return { id: result.insertId, reference };
  });

  await logActivity(req, 'created', 'invoices', created.id, created.reference);
  const invoice = await queryOne('SELECT * FROM invoices WHERE id = ?', [created.id]);
  res.status(201).json({ data: invoice, message: `Invoice ${created.reference} created` });
}));

// ---------------------------------------------------------------- UPDATE
router.patch('/:id', requirePermission('invoices.update'), asyncHandler(async (req, res) => {
  const existing = await queryOne('SELECT * FROM invoices WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
  if (!existing) throw ApiError.notFound('Invoice not found');
  if (existing.status === 'paid' && req.query.force !== 'true') {
    throw ApiError.badRequest('A paid invoice cannot be edited. Issue a credit note instead.');
  }

  await transaction(async (tx) => {
    const fields = ['title', 'notes', 'terms', 'payment_instructions', 'due_date', 'issue_date',
      'discount_cents', 'vat_rate', 'withholding_percent', 'status', 'project_id',
      'fiscal_receipt_no', 'fiscal_verification_code', 'fiscal_device_no'];
    const updates = {};
    for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
    if (req.body.fiscal_receipt_no) updates.fiscalised_at = new Date().toISOString().slice(0, 19).replace('T', ' ');

    if (Object.keys(updates).length) {
      const clause = Object.keys(updates).map((k) => `\`${k}\` = ?`).join(', ');
      await tx.execute(`UPDATE invoices SET ${clause} WHERE id = ?`, [...Object.values(updates), req.params.id]);
    }

    if (req.body.items) {
      await tx.execute('DELETE FROM invoice_items WHERE invoice_id = ?', [req.params.id]);
      for (const [i, item] of req.body.items.entries()) {
        const qty = Number(item.quantity ?? 1);
        const unit = Number(item.unit_price_cents ?? 0);
        await tx.execute(
          `INSERT INTO invoice_items (invoice_id, service_id, description, detail, quantity,
                                      unit, unit_price_cents, line_total_cents, is_taxable, sort_order)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [req.params.id, item.service_id || null, item.description || 'Item', item.detail || null,
           qty, item.unit || 'item', unit, Math.round(qty * unit),
           item.is_taxable === false ? 0 : 1, item.sort_order ?? i]
        );
      }
    }
    await recalcInvoice(req.params.id, tx);
    await syncPaymentState(req.params.id, tx);
  });

  await logActivity(req, 'updated', 'invoices', req.params.id, existing.reference);
  const invoice = await queryOne('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
  const items = await query('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order', [req.params.id]);
  res.json({ data: { ...invoice, items }, message: 'Invoice updated' });
}));

// ------------------------------------------------------------------ SEND
router.post('/:id/send', requirePermission('invoices.send'), asyncHandler(async (req, res) => {
  const invoice = await queryOne('SELECT * FROM invoices WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
  if (!invoice) throw ApiError.notFound('Invoice not found');

  const token = invoice.public_token || randomToken(24);
  await execute(
    "UPDATE invoices SET status = IF(status='draft','sent',status), sent_at = NOW(), public_token = ? WHERE id = ?",
    [token, invoice.id]
  );
  await notifyOrganisation(invoice.organisation_id, {
    type: 'invoice.received',
    title: `Invoice ${invoice.reference} is due`,
    body: `Due ${invoice.due_date}`,
    linkUrl: `/portal/invoices/${invoice.id}`,
    entityType: 'invoices', entityId: invoice.id, icon: 'receipt',
  });
  await logActivity(req, 'sent', 'invoices', invoice.id, invoice.reference);
  res.json({ message: 'Invoice sent', data: { public_url: `/i/${token}` } });
}));

router.post('/:id/remind', requirePermission('invoices.send'), asyncHandler(async (req, res) => {
  const invoice = await queryOne('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
  if (!invoice) throw ApiError.notFound('Invoice not found');
  await execute(
    'UPDATE invoices SET reminder_count = reminder_count + 1, last_reminder_at = NOW() WHERE id = ?',
    [req.params.id]
  );
  await notifyOrganisation(invoice.organisation_id, {
    type: 'invoice.reminder',
    title: `Reminder: invoice ${invoice.reference}`,
    body: `Balance outstanding, due ${invoice.due_date}`,
    linkUrl: `/portal/invoices/${invoice.id}`,
    entityType: 'invoices', entityId: invoice.id, icon: 'bell',
  });
  res.json({ message: 'Reminder sent' });
}));

// -------------------------------------------------------------- PAYMENTS
router.post('/:id/payments', requirePermission('payments.create'), asyncHandler(async (req, res) => {
  const invoice = await queryOne('SELECT * FROM invoices WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
  if (!invoice) throw ApiError.notFound('Invoice not found');

  const amount = Number(req.body.amount_cents);
  if (!amount || amount <= 0) throw ApiError.badRequest('A positive payment amount is required');

  const created = await transaction(async (tx) => {
    const reference = await generateReference('payment', tx);
    const result = await tx.execute(
      `INSERT INTO payments
         (reference, invoice_id, organisation_id, amount_cents, currency, fx_rate_to_tzs,
          method, provider_ref, payer_name, payer_phone, paid_at, status, notes,
          receipt_media_id, recorded_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        reference, invoice.id, invoice.organisation_id, amount,
        req.body.currency || invoice.currency, invoice.fx_rate_to_tzs,
        req.body.method || 'mpesa', req.body.provider_ref || null,
        req.body.payer_name || null, req.body.payer_phone || null,
        req.body.paid_at || new Date().toISOString().slice(0, 19).replace('T', ' '),
        req.body.status || 'confirmed', req.body.notes || null,
        req.body.receipt_media_id || null, req.user.id,
      ]
    );
    const state = await syncPaymentState(invoice.id, tx);
    return { id: result.insertId, reference, state };
  });

  await logActivity(req, 'payment_recorded', 'invoices', invoice.id, invoice.reference,
    { amount_cents: amount, method: req.body.method });

  if (created.state.status === 'paid') {
    await notifyByPermission('invoices.view', {
      type: 'invoice.paid',
      title: `Invoice ${invoice.reference} paid in full`,
      linkUrl: `/admin/invoices/${invoice.id}`,
      entityType: 'invoices', entityId: invoice.id, icon: 'check-circle',
    });
  }

  res.status(201).json({
    data: { payment_id: created.id, reference: created.reference, ...created.state },
    message: 'Payment recorded',
  });
}));

router.delete('/:id/payments/:paymentId', requirePermission('payments.delete'), asyncHandler(async (req, res) => {
  const payment = await queryOne('SELECT * FROM payments WHERE id = ? AND invoice_id = ?',
    [req.params.paymentId, req.params.id]);
  if (!payment) throw ApiError.notFound('Payment not found');

  await transaction(async (tx) => {
    await tx.execute('DELETE FROM payments WHERE id = ?', [req.params.paymentId]);
    await syncPaymentState(req.params.id, tx);
  });
  await logActivity(req, 'payment_deleted', 'invoices', req.params.id, payment.reference);
  res.json({ message: 'Payment removed' });
}));

// -------------------------------------------------------------- DELETE
router.delete('/:id', requirePermission('invoices.delete'), asyncHandler(async (req, res) => {
  const invoice = await queryOne('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
  if (!invoice) throw ApiError.notFound('Invoice not found');
  if (Number(invoice.paid_cents) > 0) {
    throw ApiError.badRequest('An invoice with recorded payments cannot be deleted. Cancel it instead.');
  }
  await execute('UPDATE invoices SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
  await logActivity(req, 'deleted', 'invoices', req.params.id, invoice.reference);
  res.json({ message: 'Invoice moved to trash' });
}));

export default router;
