import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import sharp from 'sharp';
import { query, queryOne, execute } from '../config/db.js';
import { config } from '../config/env.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { upload, mediaKind, publicUrlFor, fileChecksum, deleteFileQuietly, currentUploadDir } from '../middleware/upload.js';
import { logActivity } from '../services/activityLog.js';
import { slotStatus, SLOT_PREFIX } from '../services/mediaSlots.js';
import {
  ApiError, asyncHandler, parsePagination, paginatedResponse,
  safeSort, parseJsonRows, parseJsonFields,
} from '../utils/helpers.js';

const router = express.Router();
router.use(authenticate);

const THUMB_WIDTH = 480;

/**
 * Generate a thumbnail for raster images. SVGs are served as-is.
 *
 * The source is read into a buffer rather than handed to sharp as a path:
 * on Windows a failed decode otherwise leaves the file handle open, and the
 * subsequent cleanup unlink fails with EBUSY.
 */
async function makeThumbnail(absolutePath, filename) {
  try {
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.svg') return null;

    const thumbName = `thumb-${filename.replace(/\.[^.]+$/, '')}.webp`;
    const thumbPath = path.join(path.dirname(absolutePath), thumbName);
    const buffer = await fs.promises.readFile(absolutePath);

    await sharp(buffer)
      .rotate()                        // honour EXIF orientation
      .resize(THUMB_WIDTH, null, { withoutEnlargement: true })
      .webp({ quality: 78 })
      .toFile(thumbPath);
    return publicUrlFor(thumbPath);
  } catch (err) {
    console.warn('[media] thumbnail failed:', err.message);
    return null;
  }
}

async function imageDimensions(absolutePath) {
  try {
    const buffer = await fs.promises.readFile(absolutePath);
    const meta = await sharp(buffer).metadata();
    return { width: meta.width ?? null, height: meta.height ?? null };
  } catch {
    return { width: null, height: null };
  }
}

// ------------------------------------------------------------------ LIST
router.get('/', requirePermission('media.view'), asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query, 40);
  const { column, direction } = safeSort(req.query.sort, ['created_at', 'filename', 'size_bytes', 'title'], 'created_at');

  const where = ['m.deleted_at IS NULL'];
  const params = [];

  if (req.query.kind) { where.push('m.kind = ?'); params.push(req.query.kind); }
  if (req.query.folder_id === 'null') where.push('m.folder_id IS NULL');
  else if (req.query.folder_id) { where.push('m.folder_id = ?'); params.push(req.query.folder_id); }

  if (req.query.search) {
    where.push('(m.original_name LIKE ? OR m.title LIKE ? OR m.alt_text LIKE ? OR m.caption LIKE ?)');
    const term = `%${req.query.search}%`;
    params.push(term, term, term, term);
  }

  // Clients only ever see public assets or ones tagged to their own organisation.
  if (req.user.role_slug === 'client') {
    where.push('(m.is_public = 1 OR m.organisation_id = ?)');
    params.push(req.user.organisation_id);
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const rows = await query(
    `SELECT m.*, u.first_name AS uploader_first, u.last_name AS uploader_last, f.name AS folder_name
       FROM media m
  LEFT JOIN users u ON u.id = m.uploaded_by
  LEFT JOIN media_folders f ON f.id = m.folder_id
       ${whereSql}
      ORDER BY m.\`${column}\` ${direction}
      LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  const countRow = await queryOne(`SELECT COUNT(*) AS total FROM media m ${whereSql}`, params);

  res.json(paginatedResponse(parseJsonRows(rows, ['tags']), countRow.total, { page, limit }));
}));

// ------------------------------------------------------------- STATISTICS
router.get('/stats', requirePermission('media.view'), asyncHandler(async (_req, res) => {
  const byKind = await query(
    `SELECT kind, COUNT(*) AS count, COALESCE(SUM(size_bytes),0) AS bytes
       FROM media WHERE deleted_at IS NULL GROUP BY kind`
  );
  const totals = await queryOne(
    `SELECT COUNT(*) AS files, COALESCE(SUM(size_bytes),0) AS bytes
       FROM media WHERE deleted_at IS NULL`
  );
  res.json({ data: { by_kind: byKind, total_files: Number(totals.files), total_bytes: Number(totals.bytes) } });
}));

/**
 * Which image slots are filled, and the filename to upload for each.
 * Placed before /:id so "slots" is not read as a media id.
 */
router.get('/slots', requirePermission('media.view'), asyncHandler(async (_req, res) => {
  res.json({ data: await slotStatus(), prefix: SLOT_PREFIX });
}));

// ---------------------------------------------------------------- FOLDERS
router.get('/folders', requirePermission('media.view'), asyncHandler(async (_req, res) => {
  const folders = await query(
    `SELECT f.*, (SELECT COUNT(*) FROM media WHERE folder_id = f.id AND deleted_at IS NULL) AS file_count
       FROM media_folders f ORDER BY f.path ASC`
  );
  res.json({ data: folders });
}));

router.post('/folders', requirePermission('media.upload'), asyncHandler(async (req, res) => {
  const { name, parent_id = null } = req.body;
  if (!name?.trim()) throw ApiError.badRequest('Folder name is required');

  let folderPath = `/${name.trim()}`;
  if (parent_id) {
    const parent = await queryOne('SELECT path FROM media_folders WHERE id = ?', [parent_id]);
    if (!parent) throw ApiError.badRequest('Parent folder not found');
    folderPath = `${parent.path}/${name.trim()}`;
  }

  const result = await execute(
    'INSERT INTO media_folders (parent_id, name, path, created_by) VALUES (?, ?, ?, ?)',
    [parent_id || null, name.trim(), folderPath, req.user.id]
  );
  await logActivity(req, 'created', 'media_folders', result.insertId, name);
  res.status(201).json({ data: await queryOne('SELECT * FROM media_folders WHERE id = ?', [result.insertId]) });
}));

router.patch('/folders/:id', requirePermission('media.update'), asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) throw ApiError.badRequest('Folder name is required');
  const folder = await queryOne('SELECT * FROM media_folders WHERE id = ?', [req.params.id]);
  if (!folder) throw ApiError.notFound('Folder not found');

  const newPath = folder.path.replace(/[^/]+$/, name.trim());
  await execute('UPDATE media_folders SET name = ?, path = ? WHERE id = ?', [name.trim(), newPath, req.params.id]);
  await logActivity(req, 'updated', 'media_folders', req.params.id, name);
  res.json({ message: 'Folder renamed' });
}));

router.delete('/folders/:id', requirePermission('media.delete'), asyncHandler(async (req, res) => {
  const folder = await queryOne('SELECT * FROM media_folders WHERE id = ?', [req.params.id]);
  if (!folder) throw ApiError.notFound('Folder not found');
  // Files survive; they simply return to the library root.
  await execute('UPDATE media SET folder_id = NULL WHERE folder_id = ?', [req.params.id]);
  await execute('DELETE FROM media_folders WHERE id = ?', [req.params.id]);
  await logActivity(req, 'deleted', 'media_folders', req.params.id, folder.name);
  res.json({ message: 'Folder deleted. Its files were moved to the library root.' });
}));

// ----------------------------------------------------------------- UPLOAD
router.post('/upload', requirePermission('media.upload'),
  upload.array('files', 20),
  asyncHandler(async (req, res) => {
    if (!req.files?.length) throw ApiError.badRequest('No files received');

    const folderId = req.body.folder_id || null;
    const isPublic = req.body.is_public === 'false' ? 0 : 1;
    const organisationId = req.body.organisation_id || null;
    const created = [];

    for (const file of req.files) {
      const kind = mediaKind(file.mimetype);
      const publicUrl = publicUrlFor(file.path);
      let thumbUrl = null;
      let width = null;
      let height = null;

      if (kind === 'image') {
        const dims = await imageDimensions(file.path);
        width = dims.width;
        height = dims.height;
        thumbUrl = await makeThumbnail(file.path, file.filename);
      }

      const checksum = fileChecksum(file.path);

      // Re-uploading an identical file returns the existing record instead of
      // creating a duplicate — the library stays clean over years of use.
      const duplicate = await queryOne(
        'SELECT * FROM media WHERE checksum_sha256 = ? AND deleted_at IS NULL LIMIT 1',
        [checksum]
      );
      if (duplicate) {
        deleteFileQuietly(file.path);
        created.push({ ...parseJsonFields(duplicate, ['tags']), was_duplicate: true });
        continue;
      }

      const result = await execute(
        `INSERT INTO media
           (folder_id, filename, original_name, mime_type, kind, extension, size_bytes,
            width, height, storage_path, public_url, thumb_url, title, alt_text,
            is_public, organisation_id, checksum_sha256, uploaded_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          folderId, file.filename, file.originalname, file.mimetype, kind,
          path.extname(file.originalname).slice(1).toLowerCase(), file.size,
          width, height, file.path, publicUrl, thumbUrl,
          req.body.title || file.originalname.replace(/\.[^.]+$/, ''),
          req.body.alt_text || null,
          isPublic, organisationId, checksum, req.user.id,
        ]
      );

      const row = await queryOne('SELECT * FROM media WHERE id = ?', [result.insertId]);
      created.push(parseJsonFields(row, ['tags']));
      await logActivity(req, 'uploaded', 'media', result.insertId, file.originalname);
    }

    res.status(201).json({
      data: created,
      message: `${created.length} file(s) uploaded`,
    });
  })
);

// ------------------------------------------------------------------ READ
router.get('/:id', requirePermission('media.view'), asyncHandler(async (req, res) => {
  const row = await queryOne(
    `SELECT m.*, u.first_name AS uploader_first, u.last_name AS uploader_last
       FROM media m LEFT JOIN users u ON u.id = m.uploaded_by
      WHERE m.id = ? AND m.deleted_at IS NULL`,
    [req.params.id]
  );
  if (!row) throw ApiError.notFound('File not found');
  res.json({ data: parseJsonFields(row, ['tags']) });
}));

// ---------------------------------------------------------------- UPDATE
router.patch('/:id', requirePermission('media.update'), asyncHandler(async (req, res) => {
  const allowed = ['title', 'alt_text', 'caption', 'credit', 'tags', 'folder_id', 'is_public', 'organisation_id'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      updates[key] = key === 'tags' && req.body[key] !== null
        ? JSON.stringify(req.body[key])
        : req.body[key];
    }
  }
  if (Object.keys(updates).length === 0) throw ApiError.badRequest('Nothing to update');

  const clause = Object.keys(updates).map((k) => `\`${k}\` = ?`).join(', ');
  await execute(`UPDATE media SET ${clause} WHERE id = ?`, [...Object.values(updates), req.params.id]);
  await logActivity(req, 'updated', 'media', req.params.id, null, { after: updates });

  const row = await queryOne('SELECT * FROM media WHERE id = ?', [req.params.id]);
  res.json({ data: parseJsonFields(row, ['tags']), message: 'Media updated' });
}));

// ------------------------------------------------------------- BULK MOVE
router.post('/bulk/move', requirePermission('media.update'), asyncHandler(async (req, res) => {
  const ids = (req.body.ids || []).map(Number).filter(Boolean);
  if (!ids.length) throw ApiError.badRequest('No files selected');
  const placeholders = ids.map(() => '?').join(',');
  await execute(
    `UPDATE media SET folder_id = ? WHERE id IN (${placeholders})`,
    [req.body.folder_id || null, ...ids]
  );
  res.json({ message: `${ids.length} file(s) moved` });
}));

// ---------------------------------------------------------------- DELETE
router.delete('/:id', requirePermission('media.delete'), asyncHandler(async (req, res) => {
  const row = await queryOne('SELECT * FROM media WHERE id = ?', [req.params.id]);
  if (!row) throw ApiError.notFound('File not found');

  // Refuse to delete an asset still referenced by published content.
  const usage = await queryOne(
    `SELECT
       (SELECT COUNT(*) FROM services WHERE hero_media_id = ?) +
       (SELECT COUNT(*) FROM portfolio_items WHERE cover_media_id = ?) +
       (SELECT COUNT(*) FROM posts WHERE cover_media_id = ?) +
       (SELECT COUNT(*) FROM equipment WHERE cover_media_id = ?) +
       (SELECT COUNT(*) FROM print_products WHERE cover_media_id = ?) AS uses`,
    [req.params.id, req.params.id, req.params.id, req.params.id, req.params.id]
  );
  if (Number(usage.uses) > 0 && req.query.force !== 'true') {
    throw ApiError.conflict(
      `This file is used in ${usage.uses} place(s). Pass force=true to delete it anyway.`,
      { uses: Number(usage.uses) }
    );
  }

  if (req.query.permanent === 'true') {
    deleteFileQuietly(row.storage_path);
    if (row.thumb_url) {
      deleteFileQuietly(path.join(config.uploads.dir, row.thumb_url.replace(`${config.uploads.publicPath}/`, '')));
    }
    await execute('DELETE FROM media WHERE id = ?', [req.params.id]);
  } else {
    await execute('UPDATE media SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
  }

  await logActivity(req, 'deleted', 'media', req.params.id, row.original_name);
  res.json({ message: 'File deleted' });
}));

router.post('/:id/restore', requirePermission('media.update'), asyncHandler(async (req, res) => {
  await execute('UPDATE media SET deleted_at = NULL WHERE id = ?', [req.params.id]);
  res.json({ message: 'File restored' });
}));

export default router;
