import express from 'express';
import { query, queryOne, execute } from '../config/db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { logActivity } from './activityLog.js';
import {
  ApiError, asyncHandler, parsePagination, paginatedResponse,
  safeSort, parseJsonFields, parseJsonRows, pickDefined,
  buildUpdateSet, uniqueSlug,
} from '../utils/helpers.js';

/**
 * Builds a complete REST resource: list, read, create, update, delete,
 * restore, bulk delete and reorder — with permission checks, audit logging,
 * soft deletes and search/filter/sort. Every admin-managed table uses this,
 * so behaviour stays identical across the platform.
 *
 * @param {object} cfg
 * @param {string} cfg.table          MySQL table name (never user-supplied)
 * @param {string} cfg.module         permission module prefix, e.g. 'cms'
 * @param {string[]} cfg.fields       columns writable on create/update
 * @param {string[]} [cfg.searchable] columns included in ?search=
 * @param {string[]} [cfg.filterable] columns accepted as exact-match filters
 * @param {string[]} [cfg.sortable]   columns accepted in ?sort=field:dir
 * @param {string[]} [cfg.jsonFields] columns to JSON.parse on the way out
 * @param {boolean}  [cfg.softDelete] use deleted_at instead of hard DELETE
 * @param {boolean}  [cfg.slugFrom]   field to auto-generate a unique slug from
 * @param {string}   [cfg.labelField] column used as a human label in the audit log
 * @param {string}   [cfg.defaultSort]
 * @param {string}   [cfg.listSelect] custom SELECT for list (joins, computed cols)
 * @param {string}   [cfg.singleSelect] custom SELECT for a single record
 * @param {Function} [cfg.beforeCreate] async (data, req) => data
 * @param {Function} [cfg.afterCreate]  async (row, req) => void
 * @param {Function} [cfg.beforeUpdate] async (data, req, existing) => data
 * @param {Function} [cfg.afterUpdate]  async (row, req, existing) => void
 * @param {Function} [cfg.beforeDelete] async (row, req) => void
 * @param {Function} [cfg.scopeFilter]  (req) => ({ clause, params }) | null
 */
export function createCrudRouter(cfg) {
  const {
    table,
    module,
    fields,
    searchable = [],
    filterable = [],
    sortable = ['id', 'created_at', 'updated_at'],
    jsonFields = [],
    softDelete = true,
    slugFrom = null,
    labelField = 'name',
    defaultSort = 'created_at',
    listSelect = null,
    singleSelect = null,
    beforeCreate = null,
    afterCreate = null,
    beforeUpdate = null,
    afterUpdate = null,
    beforeDelete = null,
    scopeFilter = null,
    allowRestore = true,
    reorderable = false,
  } = cfg;

  const router = express.Router();
  router.use(authenticate);

  const perm = (action) => requirePermission(`${module}.${action}`);
  const softClause = softDelete ? `${table}.deleted_at IS NULL` : '1=1';

  // ---------------------------------------------------------------- LIST
  router.get('/', perm('view'), asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePagination(req.query);
    const { column, direction } = safeSort(req.query.sort, sortable, defaultSort);

    const where = [];
    const params = [];

    // Soft-deleted rows are hidden unless explicitly requested (trash view).
    if (softDelete) {
      where.push(req.query.trashed === 'true'
        ? `${table}.deleted_at IS NOT NULL`
        : `${table}.deleted_at IS NULL`);
    }

    if (req.query.search && searchable.length) {
      const term = `%${req.query.search}%`;
      where.push(`(${searchable.map((f) => `${table}.\`${f}\` LIKE ?`).join(' OR ')})`);
      searchable.forEach(() => params.push(term));
    }

    for (const field of filterable) {
      const value = req.query[field];
      if (value === undefined || value === '') continue;
      if (String(value).includes(',')) {
        const list = String(value).split(',');
        where.push(`${table}.\`${field}\` IN (${list.map(() => '?').join(',')})`);
        params.push(...list);
      } else {
        where.push(`${table}.\`${field}\` = ?`);
        params.push(value);
      }
    }

    // Date range filtering on any date-ish column
    if (req.query.date_from && req.query.date_field) {
      const f = sortable.includes(req.query.date_field) ? req.query.date_field : 'created_at';
      where.push(`${table}.\`${f}\` >= ?`);
      params.push(req.query.date_from);
    }
    if (req.query.date_to && req.query.date_field) {
      const f = sortable.includes(req.query.date_field) ? req.query.date_field : 'created_at';
      where.push(`${table}.\`${f}\` <= ?`);
      params.push(req.query.date_to);
    }

    const scope = scopeFilter?.(req);
    if (scope) {
      where.push(scope.clause);
      params.push(...scope.params);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const baseSelect = listSelect || `SELECT ${table}.* FROM ${table}`;

    const rows = await query(
      `${baseSelect} ${whereSql} ORDER BY ${table}.\`${column}\` ${direction} LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    const countRow = await queryOne(
      `SELECT COUNT(*) AS total FROM ${table} ${whereSql}`,
      params
    );

    res.json(paginatedResponse(parseJsonRows(rows, jsonFields), countRow.total, { page, limit }));
  }));

  // ---------------------------------------------------------------- READ
  router.get('/:id', perm('view'), asyncHandler(async (req, res) => {
    const baseSelect = singleSelect || `SELECT ${table}.* FROM ${table}`;
    const scope = scopeFilter?.(req);
    const extra = scope ? ` AND ${scope.clause}` : '';
    const params = scope ? [req.params.id, ...scope.params] : [req.params.id];

    const row = await queryOne(
      `${baseSelect} WHERE ${table}.id = ?${extra}`,
      params
    );
    if (!row) throw ApiError.notFound(`${module} record not found`);
    res.json({ data: parseJsonFields(row, jsonFields) });
  }));

  // -------------------------------------------------------------- CREATE
  router.post('/', perm('create'), asyncHandler(async (req, res) => {
    let data = pickDefined(req.body, fields);

    if (slugFrom && !data.slug && data[slugFrom]) {
      data.slug = await uniqueSlug(table, data[slugFrom]);
    } else if (data.slug) {
      data.slug = await uniqueSlug(table, data.slug);
    }

    if (beforeCreate) data = await beforeCreate(data, req);

    const keys = Object.keys(data);
    if (keys.length === 0) throw ApiError.badRequest('No valid fields supplied');

    const values = keys.map((k) => {
      const v = data[k];
      return (v !== null && typeof v === 'object') ? JSON.stringify(v) : v;
    });

    const result = await execute(
      `INSERT INTO ${table} (${keys.map((k) => `\`${k}\``).join(', ')})
       VALUES (${keys.map(() => '?').join(', ')})`,
      values
    );

    const row = await queryOne(`SELECT * FROM ${table} WHERE id = ?`, [result.insertId]);
    await logActivity(req, 'created', table, result.insertId, row?.[labelField] || row?.title || null, { after: data });
    if (afterCreate) await afterCreate(row, req);

    res.status(201).json({ data: parseJsonFields(row, jsonFields), message: 'Created successfully' });
  }));

  // -------------------------------------------------------------- UPDATE
  router.patch('/:id', perm('update'), asyncHandler(async (req, res) => {
    const existing = await queryOne(`SELECT * FROM ${table} WHERE id = ?`, [req.params.id]);
    if (!existing) throw ApiError.notFound(`${module} record not found`);

    let data = pickDefined(req.body, fields);
    if (data.slug) data.slug = await uniqueSlug(table, data.slug, req.params.id);
    if (beforeUpdate) data = await beforeUpdate(data, req, existing);

    const set = buildUpdateSet(data);
    if (!set) throw ApiError.badRequest('No valid fields supplied');

    await execute(`UPDATE ${table} SET ${set.clause} WHERE id = ?`, [...set.values, req.params.id]);
    const row = await queryOne(`SELECT * FROM ${table} WHERE id = ?`, [req.params.id]);

    await logActivity(req, 'updated', table, req.params.id, row?.[labelField] || null, {
      before: Object.fromEntries(Object.keys(data).map((k) => [k, existing[k]])),
      after: data,
    });
    if (afterUpdate) await afterUpdate(row, req, existing);

    res.json({ data: parseJsonFields(row, jsonFields), message: 'Updated successfully' });
  }));

  // -------------------------------------------------------------- DELETE
  router.delete('/:id', perm('delete'), asyncHandler(async (req, res) => {
    const row = await queryOne(`SELECT * FROM ${table} WHERE id = ?`, [req.params.id]);
    if (!row) throw ApiError.notFound(`${module} record not found`);
    if (beforeDelete) await beforeDelete(row, req);

    // ?permanent=true bypasses the recycle bin, for admins clearing trash.
    const permanent = req.query.permanent === 'true' || !softDelete;
    if (permanent) {
      await execute(`DELETE FROM ${table} WHERE id = ?`, [req.params.id]);
    } else {
      await execute(`UPDATE ${table} SET deleted_at = NOW() WHERE id = ?`, [req.params.id]);
    }

    await logActivity(req, permanent ? 'deleted_permanently' : 'deleted', table,
      req.params.id, row?.[labelField] || null, { before: row });

    res.json({ message: permanent ? 'Permanently deleted' : 'Moved to trash', id: Number(req.params.id) });
  }));

  // ------------------------------------------------------------- RESTORE
  if (softDelete && allowRestore) {
    router.post('/:id/restore', perm('update'), asyncHandler(async (req, res) => {
      const row = await queryOne(`SELECT * FROM ${table} WHERE id = ?`, [req.params.id]);
      if (!row) throw ApiError.notFound('Record not found');
      await execute(`UPDATE ${table} SET deleted_at = NULL WHERE id = ?`, [req.params.id]);
      await logActivity(req, 'restored', table, req.params.id, row?.[labelField] || null);
      res.json({ message: 'Restored successfully', id: Number(req.params.id) });
    }));
  }

  // ---------------------------------------------------------- BULK ACTIONS
  router.post('/bulk/delete', perm('delete'), asyncHandler(async (req, res) => {
    const ids = (req.body.ids || []).map(Number).filter(Boolean);
    if (!ids.length) throw ApiError.badRequest('No ids supplied');
    const placeholders = ids.map(() => '?').join(',');

    if (req.query.permanent === 'true' || !softDelete) {
      await execute(`DELETE FROM ${table} WHERE id IN (${placeholders})`, ids);
    } else {
      await execute(`UPDATE ${table} SET deleted_at = NOW() WHERE id IN (${placeholders})`, ids);
    }
    await logActivity(req, 'bulk_deleted', table, null, `${ids.length} records`, { ids });
    res.json({ message: `${ids.length} record(s) deleted`, ids });
  }));

  router.post('/bulk/update', perm('update'), asyncHandler(async (req, res) => {
    const ids = (req.body.ids || []).map(Number).filter(Boolean);
    const data = pickDefined(req.body.data || {}, fields);
    if (!ids.length) throw ApiError.badRequest('No ids supplied');
    const set = buildUpdateSet(data);
    if (!set) throw ApiError.badRequest('No valid fields supplied');

    const placeholders = ids.map(() => '?').join(',');
    await execute(`UPDATE ${table} SET ${set.clause} WHERE id IN (${placeholders})`,
      [...set.values, ...ids]);
    await logActivity(req, 'bulk_updated', table, null, `${ids.length} records`, { ids, after: data });
    res.json({ message: `${ids.length} record(s) updated`, ids });
  }));

  // -------------------------------------------------------------- REORDER
  if (reorderable) {
    router.post('/reorder', perm('update'), asyncHandler(async (req, res) => {
      const items = req.body.items || []; // [{id, sort_order}]
      for (const item of items) {
        await execute(`UPDATE ${table} SET sort_order = ? WHERE id = ?`,
          [Number(item.sort_order), Number(item.id)]);
      }
      await logActivity(req, 'reordered', table, null, `${items.length} records`);
      res.json({ message: 'Order updated' });
    }));
  }

  return router;
}
