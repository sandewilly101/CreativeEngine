import express from 'express';
import { query, queryOne, execute } from '../config/db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { logActivity } from '../services/activityLog.js';
import { getRates, refreshRates, setManualRate, clearManualRate, getRateHistory } from '../services/fxService.js';
import { ApiError, asyncHandler } from '../utils/helpers.js';

const router = express.Router();
router.use(authenticate);

// -------------------------------------------------------------- SETTINGS
router.get('/', requirePermission('settings.view'), asyncHandler(async (_req, res) => {
  const rows = await query('SELECT * FROM settings ORDER BY group_key, sort_order, setting_key');
  const grouped = {};
  for (const row of rows) {
    grouped[row.group_key] ??= [];
    grouped[row.group_key].push(row);
  }
  res.json({ data: grouped });
}));

router.patch('/', requirePermission('settings.update'), asyncHandler(async (req, res) => {
  const updates = req.body.settings || [];
  if (!Array.isArray(updates) || updates.length === 0) {
    throw ApiError.badRequest('Provide a settings array of { group_key, setting_key, setting_value }');
  }

  for (const item of updates) {
    const value = (item.setting_value !== null && typeof item.setting_value === 'object')
      ? JSON.stringify(item.setting_value)
      : String(item.setting_value ?? '');
    await execute(
      `INSERT INTO settings (group_key, setting_key, setting_value, value_type, label, is_public, updated_by)
       VALUES (?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
      [
        item.group_key, item.setting_key, value, item.value_type || 'string',
        item.label || null, item.is_public === false ? 0 : 1, req.user.id,
      ]
    );
  }
  await logActivity(req, 'updated', 'settings', null, `${updates.length} setting(s)`);
  res.json({ message: `${updates.length} setting(s) saved` });
}));

router.delete('/:groupKey/:settingKey', requirePermission('settings.update'), asyncHandler(async (req, res) => {
  await execute('DELETE FROM settings WHERE group_key = ? AND setting_key = ?',
    [req.params.groupKey, req.params.settingKey]);
  res.json({ message: 'Setting removed' });
}));

// ------------------------------------------------------------ FX / RATES
router.get('/rates', asyncHandler(async (_req, res) => {
  const rates = await getRates();
  const meta = await query(
    `SELECT base_currency, rate, source, is_manual, valid_date, fetched_at
       FROM exchange_rates
      WHERE quote_currency = 'TZS'
        AND valid_date = (SELECT MAX(valid_date) FROM exchange_rates WHERE quote_currency='TZS')
      ORDER BY base_currency`
  );
  res.json({ data: { base: 'TZS', rates, detail: meta } });
}));

router.post('/rates/refresh', requirePermission('settings.update'), asyncHandler(async (req, res) => {
  const result = await refreshRates();
  await logActivity(req, 'refreshed', 'exchange_rates', null, result.source);
  res.json({ data: result, message: `Rates refreshed from ${result.source}` });
}));

router.post('/rates/manual', requirePermission('settings.update'), asyncHandler(async (req, res) => {
  const { currency, rate, valid_date } = req.body;
  if (!currency || !rate) throw ApiError.badRequest('A currency and rate are required');
  const result = await setManualRate(currency, rate, valid_date);
  await logActivity(req, 'manual_rate_set', 'exchange_rates', null, `${currency} = ${rate} TZS`);
  res.json({ data: result, message: `Manual rate set: 1 ${result.currency} = TZS ${result.rate}` });
}));

router.delete('/rates/manual/:currency', requirePermission('settings.update'), asyncHandler(async (req, res) => {
  await clearManualRate(req.params.currency, req.query.date);
  res.json({ message: 'Manual override cleared; live rates resumed' });
}));

router.get('/rates/history', asyncHandler(async (req, res) => {
  const rows = await getRateHistory(req.query.currency || 'USD', req.query.days || 30);
  res.json({ data: rows });
}));

// ----------------------------------------------------- ROLES & PERMISSIONS
router.get('/roles', requirePermission('users.view'), asyncHandler(async (_req, res) => {
  const roles = await query(
    `SELECT r.*, (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id AND u.deleted_at IS NULL) AS user_count
       FROM roles r ORDER BY r.id`
  );
  const permissions = await query('SELECT * FROM permissions ORDER BY module, slug');
  const rolePerms = await query('SELECT role_id, permission_id FROM role_permissions');

  const byRole = {};
  for (const rp of rolePerms) {
    byRole[rp.role_id] ??= [];
    byRole[rp.role_id].push(rp.permission_id);
  }

  const grouped = {};
  for (const p of permissions) {
    grouped[p.module] ??= [];
    grouped[p.module].push(p);
  }

  res.json({
    data: {
      roles: roles.map((r) => ({ ...r, permission_ids: byRole[r.id] || [] })),
      permissions_by_module: grouped,
    },
  });
}));

router.put('/roles/:id/permissions', requirePermission('roles.manage'), asyncHandler(async (req, res) => {
  const role = await queryOne('SELECT * FROM roles WHERE id = ?', [req.params.id]);
  if (!role) throw ApiError.notFound('Role not found');
  if (role.slug === 'admin') throw ApiError.badRequest('The administrator role always holds every permission');

  const ids = (req.body.permission_ids || []).map(Number).filter(Boolean);
  await execute('DELETE FROM role_permissions WHERE role_id = ?', [req.params.id]);
  for (const permissionId of ids) {
    await execute('INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
      [req.params.id, permissionId]);
  }
  await logActivity(req, 'updated_permissions', 'roles', req.params.id, role.name, { count: ids.length });
  res.json({ message: `${ids.length} permission(s) assigned to ${role.name}` });
}));

router.post('/roles', requirePermission('roles.manage'), asyncHandler(async (req, res) => {
  const { slug, name, description } = req.body;
  if (!slug || !name) throw ApiError.badRequest('A slug and name are required');
  const result = await execute(
    'INSERT INTO roles (slug, name, description, is_system) VALUES (?,?,?,0)',
    [slug, name, description || null]
  );
  res.status(201).json({ data: { id: result.insertId }, message: 'Role created' });
}));

router.delete('/roles/:id', requirePermission('roles.manage'), asyncHandler(async (req, res) => {
  const role = await queryOne('SELECT * FROM roles WHERE id = ?', [req.params.id]);
  if (!role) throw ApiError.notFound('Role not found');
  if (role.is_system) throw ApiError.badRequest('System roles cannot be deleted');
  const inUse = await queryOne('SELECT COUNT(*) AS c FROM users WHERE role_id = ?', [req.params.id]);
  if (Number(inUse.c) > 0) throw ApiError.conflict(`${inUse.c} user(s) still hold this role`);
  await execute('DELETE FROM roles WHERE id = ?', [req.params.id]);
  res.json({ message: 'Role deleted' });
}));

/** Per-user permission overrides on top of their role. */
router.put('/users/:id/permissions', requirePermission('roles.manage'), asyncHandler(async (req, res) => {
  const overrides = req.body.overrides || []; // [{permission_id, effect}]
  await execute('DELETE FROM user_permissions WHERE user_id = ?', [req.params.id]);
  for (const o of overrides) {
    await execute(
      'INSERT INTO user_permissions (user_id, permission_id, effect) VALUES (?,?,?)',
      [req.params.id, o.permission_id, o.effect === 'deny' ? 'deny' : 'allow']
    );
  }
  res.json({ message: 'Permission overrides saved' });
}));

// ------------------------------------------------------- EMAIL TEMPLATES
router.get('/email-templates', requirePermission('settings.view'), asyncHandler(async (_req, res) => {
  const rows = await query('SELECT * FROM email_templates ORDER BY name');
  res.json({ data: rows });
}));

router.patch('/email-templates/:id', requirePermission('settings.update'), asyncHandler(async (req, res) => {
  const fields = ['name', 'subject', 'body_html', 'is_active'];
  const updates = {};
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  if (Object.keys(updates).length === 0) throw ApiError.badRequest('Nothing to update');

  const clause = Object.keys(updates).map((k) => `\`${k}\` = ?`).join(', ');
  await execute(`UPDATE email_templates SET ${clause} WHERE id = ?`, [...Object.values(updates), req.params.id]);
  await logActivity(req, 'updated', 'email_templates', req.params.id, updates.name || null);
  res.json({ message: 'Template saved' });
}));

// --------------------------------------------------------------- SYSTEM
router.get('/system', requirePermission('settings.view'), asyncHandler(async (_req, res) => {
  const counts = await queryOne(
    `SELECT
       (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL) AS users,
       (SELECT COUNT(*) FROM organisations WHERE deleted_at IS NULL) AS organisations,
       (SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL) AS projects,
       (SELECT COUNT(*) FROM media WHERE deleted_at IS NULL) AS media_files,
       (SELECT COALESCE(SUM(size_bytes),0) FROM media WHERE deleted_at IS NULL) AS media_bytes,
       (SELECT COUNT(*) FROM activity_log) AS activity_entries`
  );
  res.json({
    data: {
      counts,
      node_version: process.version,
      uptime_seconds: Math.round(process.uptime()),
      memory_mb: Math.round(process.memoryUsage().heapUsed / 1048576),
    },
  });
}));

/** Recycle bin across the main tables. */
router.get('/trash', requirePermission('settings.view'), asyncHandler(async (_req, res) => {
  const tables = [
    ['projects', 'name'], ['quotes', 'reference'], ['invoices', 'reference'],
    ['organisations', 'name'], ['services', 'name'], ['posts', 'title'],
    ['portfolio_items', 'title'], ['equipment', 'name'], ['media', 'original_name'],
    ['bookings', 'reference'], ['print_orders', 'reference'], ['users', 'email'],
  ];
  const result = {};
  for (const [table, labelCol] of tables) {
    result[table] = await query(
      `SELECT id, \`${labelCol}\` AS label, deleted_at FROM \`${table}\`
        WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 25`
    );
  }
  res.json({ data: result });
}));

router.post('/trash/empty', requirePermission('settings.update'), asyncHandler(async (req, res) => {
  const olderThanDays = Number(req.body.older_than_days ?? 30);
  const tables = ['projects', 'quotes', 'invoices', 'services', 'posts', 'portfolio_items',
    'equipment', 'bookings', 'print_orders'];
  let total = 0;
  for (const table of tables) {
    const result = await execute(
      `DELETE FROM \`${table}\` WHERE deleted_at IS NOT NULL AND deleted_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [olderThanDays]
    );
    total += result.affectedRows;
  }
  await logActivity(req, 'emptied_trash', 'system', null, `${total} records`);
  res.json({ message: `${total} record(s) permanently deleted` });
}));

export default router;
