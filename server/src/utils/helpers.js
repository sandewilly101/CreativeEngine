import crypto from 'node:crypto';
import { transaction } from '../config/db.js';

/** Wrap an async route handler so rejected promises reach the error middleware. */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** An error carrying an HTTP status code. */
export class ApiError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
  static badRequest(msg = 'Bad request', details) { return new ApiError(400, msg, details); }
  static unauthorized(msg = 'Not authenticated') { return new ApiError(401, msg); }
  static forbidden(msg = 'You do not have permission to do that') { return new ApiError(403, msg); }
  static notFound(msg = 'Not found') { return new ApiError(404, msg); }
  static conflict(msg = 'Conflict', details) { return new ApiError(409, msg, details); }
}

/** URL-safe slug. Keeps Swahili/Latin letters, drops everything else. */
export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 200);
}

/** Ensure a slug is unique within a table, appending -2, -3 … as needed. */
export async function uniqueSlug(tableName, base, excludeId = null) {
  const { query } = await import('../config/db.js');
  let slug = slugify(base) || 'item';
  let suffix = 1;
  // Table name is never user-supplied — it comes from our own resource configs.
  for (;;) {
    const sql = excludeId
      ? `SELECT id FROM \`${tableName}\` WHERE slug = ? AND id != ? LIMIT 1`
      : `SELECT id FROM \`${tableName}\` WHERE slug = ? LIMIT 1`;
    const rows = await query(sql, excludeId ? [slug, excludeId] : [slug]);
    if (rows.length === 0) return slug;
    suffix += 1;
    slug = `${slugify(base)}-${suffix}`;
  }
}

export function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

/**
 * Generate a sequential, human-readable reference such as INV-2026-0001.
 * Uses a counters row locked inside a transaction so two concurrent requests
 * can never receive the same number.
 */
const PREFIXES = {
  lead: 'LEAD', quote: 'QT', project: 'PRJ', invoice: 'INV', payment: 'PAY',
  booking: 'BK', print_order: 'PO', event: 'EV', purchase_order: 'SPO',
  expense: 'EXP', subscription: 'SUB', service_request: 'REQ',
};

export async function generateReference(entity, tx = null) {
  const year = new Date().getFullYear();
  const prefix = PREFIXES[entity] || entity.toUpperCase().slice(0, 4);

  const run = async (t) => {
    await t.execute(
      `INSERT INTO counters (entity, year, last_number) VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE last_number = last_number + 1`,
      [entity, year]
    );
    const row = await t.queryOne(
      'SELECT last_number FROM counters WHERE entity = ? AND year = ?',
      [entity, year]
    );
    return `${prefix}-${year}-${String(row.last_number).padStart(4, '0')}`;
  };

  return tx ? run(tx) : transaction(run);
}

/** Parse ?page= and ?limit= into safe SQL values. */
export function parsePagination(queryParams, defaultLimit = 25, maxLimit = 200) {
  const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(queryParams.limit, 10) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}

export function paginatedResponse(rows, total, { page, limit }) {
  return {
    data: rows,
    pagination: {
      page,
      limit,
      total: Number(total),
      pages: Math.ceil(Number(total) / limit) || 1,
      hasNext: page * limit < Number(total),
      hasPrev: page > 1,
    },
  };
}

/** Columns the caller may sort by must be whitelisted to avoid SQL injection. */
export function safeSort(requested, allowed, fallback = 'created_at') {
  const [field, dir] = String(requested || '').split(':');
  const column = allowed.includes(field) ? field : fallback;
  const direction = String(dir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  return { column, direction };
}

/** MySQL JSON columns arrive as strings on some driver versions. */
export function parseJsonFields(row, fields) {
  if (!row) return row;
  const out = { ...row };
  for (const field of fields) {
    const value = out[field];
    if (typeof value === 'string') {
      try { out[field] = JSON.parse(value); } catch { out[field] = null; }
    }
  }
  return out;
}

export function parseJsonRows(rows, fields) {
  return rows.map((row) => parseJsonFields(row, fields));
}

/** Strip keys that are undefined so partial updates only touch sent fields. */
export function pickDefined(obj, allowedKeys) {
  const out = {};
  for (const key of allowedKeys) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}

/** Build "a = ?, b = ?" plus the matching values array. */
export function buildUpdateSet(data) {
  const keys = Object.keys(data);
  if (keys.length === 0) return null;
  return {
    clause: keys.map((k) => `\`${k}\` = ?`).join(', '),
    values: keys.map((k) => {
      const v = data[k];
      return (v !== null && typeof v === 'object') ? JSON.stringify(v) : v;
    }),
  };
}

export function daysBetween(start, end) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.ceil(ms / 86400000));
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function toMysqlDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}

export function toMysqlDateTime(date) {
  return new Date(date).toISOString().slice(0, 19).replace('T', ' ');
}
