import express from 'express';
import { query, queryOne } from '../config/db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { asyncHandler } from '../utils/helpers.js';

/**
 * Management dashboard. The KPI set follows section 10 of the business
 * blueprint: sales, recurring, creative, digital, AI, events, production
 * and finance, each answering "is this division healthy this month?".
 */
const router = express.Router();
router.use(authenticate);

router.get('/', requirePermission('dashboard.view'), asyncHandler(async (req, res) => {
  const period = req.query.period || '30'; // days
  const days = Math.min(365, Math.max(1, parseInt(period, 10) || 30));

  const [
    sales, recurring, receivables, projects, equipment, print, events, ai, cash,
  ] = await Promise.all([
    // SALES — leads, pipeline value, win rate
    queryOne(
      `SELECT
         (SELECT COUNT(*) FROM leads WHERE deleted_at IS NULL AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)) AS new_leads,
         (SELECT COUNT(*) FROM leads WHERE deleted_at IS NULL AND status='qualified') AS qualified_leads,
         (SELECT COALESCE(SUM(total_cents),0) FROM quotes WHERE deleted_at IS NULL AND status IN ('sent','viewed')) AS pipeline_cents,
         (SELECT COUNT(*) FROM quotes WHERE deleted_at IS NULL AND status='accepted' AND responded_at >= DATE_SUB(NOW(), INTERVAL ? DAY)) AS quotes_won,
         (SELECT COUNT(*) FROM quotes WHERE deleted_at IS NULL AND status='rejected' AND responded_at >= DATE_SUB(NOW(), INTERVAL ? DAY)) AS quotes_lost,
         (SELECT COALESCE(AVG(total_cents),0) FROM quotes WHERE deleted_at IS NULL AND status='accepted') AS avg_deal_cents`,
      [days, days, days]
    ),
    // RECURRING — the blueprint's central metric
    queryOne('SELECT * FROM v_mrr'),
    queryOne(
      `SELECT
         COALESCE(SUM(balance_cents),0) AS outstanding_cents,
         COALESCE(SUM(CASE WHEN due_date < CURDATE() THEN balance_cents END),0) AS overdue_cents,
         COUNT(*) AS open_invoices
       FROM invoices
      WHERE deleted_at IS NULL AND status IN ('sent','viewed','partial','overdue')`
    ),
    queryOne(
      `SELECT
         COUNT(*) AS total,
         SUM(status='active') AS active,
         SUM(status='completed' AND completed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)) AS completed_period,
         SUM(health='at_risk') AS at_risk,
         SUM(health='off_track') AS off_track,
         SUM(due_date < CURDATE() AND status NOT IN ('completed','cancelled')) AS overdue
       FROM projects WHERE deleted_at IS NULL`,
      [days]
    ),
    queryOne(
      `SELECT
         (SELECT COUNT(*) FROM equipment WHERE deleted_at IS NULL AND status='available') AS items,
         (SELECT COUNT(*) FROM bookings WHERE deleted_at IS NULL AND status IN ('confirmed','dispatched','on_hire')) AS active_bookings,
         (SELECT COALESCE(SUM(total_cents),0) FROM bookings WHERE deleted_at IS NULL
            AND status IN ('completed','returned') AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)) AS revenue_cents,
         (SELECT COUNT(*) FROM equipment_maintenance WHERE status IN ('scheduled','in_progress')) AS in_maintenance`,
      [days]
    ),
    queryOne(
      `SELECT
         COUNT(*) AS orders,
         SUM(status IN ('approved','in_production')) AS in_production,
         SUM(is_rush = 1 AND status NOT IN ('completed','cancelled')) AS rush_jobs,
         COALESCE(SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) THEN total_cents END),0) AS revenue_cents
       FROM print_orders WHERE deleted_at IS NULL`,
      [days]
    ),
    queryOne(
      `SELECT
         COUNT(*) AS total,
         SUM(status IN ('planning','confirmed')) AS upcoming,
         SUM(start_datetime BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 30 DAY)) AS next_30_days,
         (SELECT COUNT(*) FROM event_registrations r JOIN events e ON e.id = r.event_id
           WHERE e.deleted_at IS NULL AND r.status != 'cancelled') AS total_registrations
       FROM events WHERE deleted_at IS NULL`
    ),
    queryOne(
      `SELECT
         (SELECT COUNT(*) FROM ai_assistants WHERE deleted_at IS NULL AND is_active=1) AS active_assistants,
         (SELECT COUNT(*) FROM ai_conversations WHERE started_at >= DATE_SUB(NOW(), INTERVAL ? DAY)) AS conversations,
         (SELECT COUNT(*) FROM ai_conversations WHERE lead_id IS NOT NULL AND started_at >= DATE_SUB(NOW(), INTERVAL ? DAY)) AS leads_captured,
         (SELECT COUNT(*) FROM ai_conversations WHERE was_escalated=1 AND started_at >= DATE_SUB(NOW(), INTERVAL ? DAY)) AS escalations`,
      [days, days, days]
    ),
    queryOne(
      `SELECT
         (SELECT COALESCE(SUM(amount_cents),0) FROM payments
           WHERE status='confirmed' AND paid_at >= DATE_SUB(NOW(), INTERVAL ? DAY)) AS collected_cents,
         (SELECT COALESCE(SUM(amount_cents),0) FROM expenses
           WHERE status IN ('approved','paid') AND expense_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)) AS expenses_cents`,
      [days, days]
    ),
  ]);

  const winRate = (Number(sales.quotes_won) + Number(sales.quotes_lost)) > 0
    ? Number(((Number(sales.quotes_won) / (Number(sales.quotes_won) + Number(sales.quotes_lost))) * 100).toFixed(1))
    : 0;

  const grossMargin = Number(cash.collected_cents) > 0
    ? Number((((Number(cash.collected_cents) - Number(cash.expenses_cents)) / Number(cash.collected_cents)) * 100).toFixed(1))
    : 0;

  res.json({
    data: {
      period_days: days,
      sales: { ...sales, win_rate_percent: winRate },
      recurring,
      receivables,
      projects,
      equipment,
      print,
      events,
      ai,
      finance: { ...cash, gross_margin_percent: grossMargin },
    },
  });
}));

/** Revenue by month for the trend chart. */
router.get('/revenue-trend', requirePermission('reports.view'), asyncHandler(async (req, res) => {
  const months = Math.min(24, Math.max(3, parseInt(req.query.months, 10) || 12));
  const rows = await query(
    `SELECT DATE_FORMAT(paid_at, '%Y-%m') AS month,
            COALESCE(SUM(amount_cents),0) AS collected_cents,
            COUNT(*) AS payment_count
       FROM payments
      WHERE status = 'confirmed' AND paid_at >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
      GROUP BY month ORDER BY month`,
    [months]
  );
  const expenses = await query(
    `SELECT DATE_FORMAT(expense_date, '%Y-%m') AS month, COALESCE(SUM(amount_cents),0) AS expense_cents
       FROM expenses
      WHERE status IN ('approved','paid') AND expense_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
      GROUP BY month ORDER BY month`,
    [months]
  );
  res.json({ data: { revenue: rows, expenses } });
}));

/** Revenue split across the five divisions. */
router.get('/division-performance', requirePermission('reports.view'), asyncHandler(async (req, res) => {
  const days = Math.min(365, parseInt(req.query.days, 10) || 90);
  const rows = await query(
    `SELECT d.id, d.name, d.color_hex, d.code,
            COUNT(DISTINCT p.id) AS project_count,
            COALESCE(SUM(p.budget_cents),0) AS budget_cents,
            COALESCE(SUM(p.cost_cents),0) AS cost_cents
       FROM divisions d
  LEFT JOIN projects p ON p.division_id = d.id AND p.deleted_at IS NULL
        AND p.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      WHERE d.is_active = 1 AND d.deleted_at IS NULL
      GROUP BY d.id ORDER BY d.sort_order`,
    [days]
  );
  res.json({ data: rows });
}));

/** What needs attention today. */
router.get('/attention', requirePermission('dashboard.view'), asyncHandler(async (req, res) => {
  const [overdueInvoices, expiringHosting, awaitingApproval, upcomingBookings, followUps, lowStock] = await Promise.all([
    query(
      `SELECT i.id, i.reference, i.balance_cents, i.currency, i.due_date, o.name AS organisation_name,
              DATEDIFF(CURDATE(), i.due_date) AS days_overdue
         FROM invoices i JOIN organisations o ON o.id = i.organisation_id
        WHERE i.deleted_at IS NULL AND i.due_date < CURDATE()
          AND i.status IN ('sent','viewed','partial','overdue')
        ORDER BY i.due_date LIMIT 10`
    ),
    query(
      `SELECT h.id, h.domain, h.type, h.expires_at, o.name AS organisation_name,
              DATEDIFF(h.expires_at, CURDATE()) AS days_left
         FROM hosting_accounts h JOIN organisations o ON o.id = h.organisation_id
        WHERE h.deleted_at IS NULL AND h.status='active'
          AND h.expires_at <= DATE_ADD(CURDATE(), INTERVAL 45 DAY)
        ORDER BY h.expires_at LIMIT 10`
    ),
    query(
      `SELECT d.id, d.name, d.project_id, p.name AS project_name, o.name AS organisation_name, d.updated_at
         FROM deliverables d
         JOIN projects p ON p.id = d.project_id
         JOIN organisations o ON o.id = p.organisation_id
        WHERE d.deleted_at IS NULL AND d.status = 'in_review'
        ORDER BY d.updated_at LIMIT 10`
    ),
    query(
      `SELECT b.id, b.reference, b.event_name, b.venue, b.start_date, b.status,
              o.name AS organisation_name
         FROM bookings b LEFT JOIN organisations o ON o.id = b.organisation_id
        WHERE b.deleted_at IS NULL AND b.status IN ('confirmed','dispatched')
          AND b.start_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 14 DAY)
        ORDER BY b.start_date LIMIT 10`
    ),
    query(
      `SELECT l.id, l.reference, l.contact_name, l.company_name, l.next_followup_at, l.status
         FROM leads l
        WHERE l.deleted_at IS NULL AND l.next_followup_at IS NOT NULL
          AND l.next_followup_at <= DATE_ADD(NOW(), INTERVAL 3 DAY)
          AND l.status NOT IN ('won','lost','spam')
        ORDER BY l.next_followup_at LIMIT 10`
    ),
    query(
      `SELECT s.id, s.reference, s.name, s.capacity_units, s.capacity_used, o.name AS organisation_name
         FROM subscriptions s JOIN organisations o ON o.id = s.organisation_id
        WHERE s.deleted_at IS NULL AND s.status='active' AND s.capacity_units IS NOT NULL
          AND s.capacity_used >= s.capacity_units * 0.8
        ORDER BY (s.capacity_used / s.capacity_units) DESC LIMIT 10`
    ),
  ]);

  res.json({
    data: {
      overdue_invoices: overdueInvoices,
      expiring_hosting: expiringHosting,
      awaiting_approval: awaitingApproval,
      upcoming_bookings: upcomingBookings,
      lead_followups: followUps,
      subscriptions_near_capacity: lowStock,
    },
  });
}));

/** Client portal summary. */
router.get('/client', asyncHandler(async (req, res) => {
  if (req.user.role_slug !== 'client') {
    return res.status(403).json({ error: 'This dashboard is for client accounts' });
  }
  const orgId = req.user.organisation_id;

  const [projects, invoices, requests, subscriptions, approvals] = await Promise.all([
    query(
      `SELECT id, reference, name, status, stage, progress_percent, due_date
         FROM projects WHERE organisation_id = ? AND deleted_at IS NULL AND is_client_visible = 1
        ORDER BY updated_at DESC LIMIT 10`, [orgId]),
    queryOne(
      `SELECT COUNT(*) AS open_count, COALESCE(SUM(balance_cents),0) AS outstanding_cents,
              COALESCE(SUM(CASE WHEN due_date < CURDATE() THEN balance_cents END),0) AS overdue_cents
         FROM invoices WHERE organisation_id = ? AND deleted_at IS NULL
           AND status IN ('sent','viewed','partial','overdue')`, [orgId]),
    query(
      `SELECT id, reference, title, status, priority, created_at
         FROM service_requests WHERE organisation_id = ? AND deleted_at IS NULL
        ORDER BY created_at DESC LIMIT 5`, [orgId]),
    query(
      `SELECT id, reference, name, type, amount_cents, currency, billing_interval,
              capacity_units, capacity_used, next_billing_date, status
         FROM subscriptions WHERE organisation_id = ? AND deleted_at IS NULL AND status='active'`, [orgId]),
    query(
      `SELECT d.id, d.name, d.status, p.name AS project_name, p.id AS project_id
         FROM deliverables d JOIN projects p ON p.id = d.project_id
        WHERE p.organisation_id = ? AND d.status = 'in_review' AND d.deleted_at IS NULL
        ORDER BY d.updated_at DESC LIMIT 10`, [orgId]),
  ]);

  res.json({ data: { projects, invoices, requests, subscriptions, awaiting_your_approval: approvals } });
}));

// --------------------------------------------------------- NOTIFICATIONS
router.get('/notifications', asyncHandler(async (req, res) => {
  const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);
  const rows = await query(
    `SELECT * FROM notifications WHERE user_id = ?
      ${req.query.unread === 'true' ? 'AND is_read = 0' : ''}
      ORDER BY created_at DESC LIMIT ${limit}`,
    [req.user.id]
  );
  const unread = await queryOne(
    'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0',
    [req.user.id]
  );
  res.json({ data: rows, unread_count: Number(unread.count) });
}));

router.post('/notifications/:id/read', asyncHandler(async (req, res) => {
  const { execute } = await import('../config/db.js');
  await execute(
    'UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id]
  );
  res.json({ message: 'Marked as read' });
}));

router.post('/notifications/read-all', asyncHandler(async (req, res) => {
  const { execute } = await import('../config/db.js');
  await execute(
    'UPDATE notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0',
    [req.user.id]
  );
  res.json({ message: 'All notifications marked as read' });
}));

// ------------------------------------------------------------ ACTIVITY LOG
router.get('/activity', requirePermission('activity.view'), asyncHandler(async (req, res) => {
  const limit = Math.min(100, parseInt(req.query.limit, 10) || 50);
  const where = [];
  const params = [];
  if (req.query.entity_type) { where.push('a.entity_type = ?'); params.push(req.query.entity_type); }
  if (req.query.entity_id) { where.push('a.entity_id = ?'); params.push(req.query.entity_id); }
  if (req.query.user_id) { where.push('a.user_id = ?'); params.push(req.query.user_id); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await query(
    `SELECT a.*, CONCAT(u.first_name,' ',u.last_name) AS user_name, u.email AS user_email
       FROM activity_log a LEFT JOIN users u ON u.id = a.user_id
       ${whereSql} ORDER BY a.created_at DESC LIMIT ${limit}`,
    params
  );
  res.json({ data: rows });
}));

export default router;
