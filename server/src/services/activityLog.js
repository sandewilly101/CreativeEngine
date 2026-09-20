import { execute } from '../config/db.js';

/**
 * Record an auditable action. Never throws: a logging failure must not
 * roll back or fail the operation the user actually asked for.
 */
export async function logActivity(req, action, entityType, entityId, entityLabel = null, changes = null) {
  try {
    await execute(
      `INSERT INTO activity_log
         (user_id, action, entity_type, entity_id, entity_label, changes, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req?.user?.id ?? null,
        action,
        entityType,
        entityId ?? null,
        entityLabel ? String(entityLabel).slice(0, 255) : null,
        changes ? JSON.stringify(redactSensitive(changes)) : null,
        req?.ip?.slice(0, 45) ?? null,
        req?.headers?.['user-agent']?.slice(0, 255) ?? null,
      ]
    );
  } catch (err) {
    console.error('[activity-log] failed to record:', err.message);
  }
}

const SENSITIVE = ['password', 'password_hash', 'reset_token', 'api_key', 'secret', 'token', 'signature_data'];

function redactSensitive(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redactSensitive);
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE.some((s) => key.toLowerCase().includes(s))) out[key] = '[redacted]';
    else if (value && typeof value === 'object') out[key] = redactSensitive(value);
    else out[key] = value;
  }
  return out;
}
