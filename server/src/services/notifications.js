import { query, execute } from '../config/db.js';

/** Create one in-app notification. */
export async function notify({ userId, type, title, body = null, linkUrl = null, entityType = null, entityId = null, icon = null }) {
  if (!userId) return null;
  const result = await execute(
    `INSERT INTO notifications (user_id, type, title, body, link_url, entity_type, entity_id, icon)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, type, title, body, linkUrl, entityType, entityId, icon]
  );
  return result.insertId;
}

/** Notify every user holding a given permission (via their role). */
export async function notifyByPermission(permissionSlug, payload) {
  const users = await query(
    `SELECT DISTINCT u.id
       FROM users u
       JOIN role_permissions rp ON rp.role_id = u.role_id
       JOIN permissions p ON p.id = rp.permission_id
      WHERE p.slug = ? AND u.is_active = 1 AND u.deleted_at IS NULL`,
    [permissionSlug]
  );
  return Promise.all(users.map((u) => notify({ ...payload, userId: u.id })));
}

/** Notify everyone attached to a client organisation. */
export async function notifyOrganisation(organisationId, payload) {
  const users = await query(
    `SELECT id FROM users
      WHERE organisation_id = ? AND is_active = 1 AND deleted_at IS NULL`,
    [organisationId]
  );
  return Promise.all(users.map((u) => notify({ ...payload, userId: u.id })));
}

export async function notifyAdmins(payload) {
  const users = await query(
    `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
      WHERE r.slug = 'admin' AND u.is_active = 1 AND u.deleted_at IS NULL`
  );
  return Promise.all(users.map((u) => notify({ ...payload, userId: u.id })));
}
