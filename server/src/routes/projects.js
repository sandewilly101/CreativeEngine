import express from 'express';
import { query, queryOne, execute, transaction } from '../config/db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { logActivity } from '../services/activityLog.js';
import { notifyOrganisation, notifyByPermission, notify } from '../services/notifications.js';
import {
  ApiError, asyncHandler, generateReference, parsePagination,
  paginatedResponse, safeSort, parseJsonRows,
} from '../utils/helpers.js';

const router = express.Router();
router.use(authenticate);

/** Clients may only ever touch their own organisation's projects. */
async function assertProjectAccess(projectId, req) {
  const project = await queryOne(
    'SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL',
    [projectId]
  );
  if (!project) throw ApiError.notFound('Project not found');
  if (req.user.role_slug === 'client') {
    if (project.organisation_id !== req.user.organisation_id || !project.is_client_visible) {
      throw ApiError.forbidden();
    }
  }
  return project;
}

// ------------------------------------------------------------------ LIST
router.get('/', requirePermission('projects.view'), asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { column, direction } = safeSort(req.query.sort,
    ['id', 'name', 'due_date', 'start_date', 'created_at', 'progress_percent', 'budget_cents'], 'created_at');

  const where = ['p.deleted_at IS NULL'];
  const params = [];
  if (req.query.status) {
    const list = String(req.query.status).split(',');
    where.push(`p.status IN (${list.map(() => '?').join(',')})`);
    params.push(...list);
  }
  if (req.query.stage) { where.push('p.stage = ?'); params.push(req.query.stage); }
  if (req.query.organisation_id) { where.push('p.organisation_id = ?'); params.push(req.query.organisation_id); }
  if (req.query.division_id) { where.push('p.division_id = ?'); params.push(req.query.division_id); }
  if (req.query.manager_id) { where.push('p.project_manager_id = ?'); params.push(req.query.manager_id); }
  if (req.query.health) { where.push('p.health = ?'); params.push(req.query.health); }
  if (req.query.search) {
    where.push('(p.name LIKE ? OR p.reference LIKE ? OR o.name LIKE ?)');
    const t = `%${req.query.search}%`;
    params.push(t, t, t);
  }
  if (req.user.role_slug === 'client') {
    where.push('p.organisation_id = ?', 'p.is_client_visible = 1');
    params.push(req.user.organisation_id);
  } else if (req.query.mine === 'true') {
    where.push('(p.project_manager_id = ? OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = ?))');
    params.push(req.user.id, req.user.id);
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const rows = await query(
    `SELECT p.*, o.name AS organisation_name, d.name AS division_name, d.color_hex AS division_color,
            CONCAT(u.first_name,' ',u.last_name) AS manager_name,
            m.public_url AS cover_url,
            (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.deleted_at IS NULL) AS task_count,
            (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status='done' AND t.deleted_at IS NULL) AS tasks_done,
            (SELECT COUNT(*) FROM deliverables dl WHERE dl.project_id = p.id AND dl.status='in_review' AND dl.deleted_at IS NULL) AS awaiting_approval
       FROM projects p
       JOIN organisations o ON o.id = p.organisation_id
  LEFT JOIN divisions d ON d.id = p.division_id
  LEFT JOIN users u ON u.id = p.project_manager_id
  LEFT JOIN media m ON m.id = p.cover_media_id
       ${whereSql} ORDER BY p.\`${column}\` ${direction} LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  const countRow = await queryOne(
    `SELECT COUNT(*) AS total FROM projects p JOIN organisations o ON o.id = p.organisation_id ${whereSql}`,
    params
  );
  res.json(paginatedResponse(rows, countRow.total, { page, limit }));
}));

// ------------------------------------------------------------------ READ
router.get('/:id', requirePermission('projects.view'), asyncHandler(async (req, res) => {
  const project = await assertProjectAccess(req.params.id, req);

  const clientFilter = req.user.role_slug === 'client' ? 'AND is_client_visible = 1' : '';
  const [full, members, milestones, tasks, deliverables, files, invoices] = await Promise.all([
    queryOne(
      `SELECT p.*, o.name AS organisation_name, d.name AS division_name, d.color_hex AS division_color,
              CONCAT(u.first_name,' ',u.last_name) AS manager_name, m.public_url AS cover_url,
              q.reference AS quote_reference
         FROM projects p
         JOIN organisations o ON o.id = p.organisation_id
    LEFT JOIN divisions d ON d.id = p.division_id
    LEFT JOIN users u ON u.id = p.project_manager_id
    LEFT JOIN media m ON m.id = p.cover_media_id
    LEFT JOIN quotes q ON q.id = p.quote_id
        WHERE p.id = ?`, [project.id]),
    query(
      `SELECT pm.role, u.id, u.first_name, u.last_name, u.job_title, u.division, m.public_url AS avatar_url
         FROM project_members pm JOIN users u ON u.id = pm.user_id
    LEFT JOIN media m ON m.id = u.avatar_media_id
        WHERE pm.project_id = ?`, [project.id]),
    query(`SELECT * FROM project_milestones WHERE project_id = ? ${clientFilter} ORDER BY sort_order, due_date`, [project.id]),
    query(
      `SELECT t.*, CONCAT(u.first_name,' ',u.last_name) AS assignee_name, m.public_url AS assignee_avatar
         FROM tasks t LEFT JOIN users u ON u.id = t.assigned_to
    LEFT JOIN media m ON m.id = u.avatar_media_id
        WHERE t.project_id = ? AND t.deleted_at IS NULL
          ${req.user.role_slug === 'client' ? 'AND t.is_client_visible = 1' : ''}
        ORDER BY t.sort_order, t.id`, [project.id]),
    query(
      `SELECT d.*, (SELECT COUNT(*) FROM deliverable_versions v WHERE v.deliverable_id = d.id) AS version_count,
              (SELECT media_id FROM deliverable_versions v WHERE v.deliverable_id = d.id ORDER BY version DESC LIMIT 1) AS latest_media_id
         FROM deliverables d WHERE d.project_id = ? AND d.deleted_at IS NULL ORDER BY d.id DESC`, [project.id]),
    query(
      `SELECT pf.*, m.public_url, m.thumb_url, m.original_name, m.kind, m.size_bytes
         FROM project_files pf JOIN media m ON m.id = pf.media_id
        WHERE pf.project_id = ? ${req.user.role_slug === 'client' ? 'AND pf.is_client_visible = 1' : ''}
        ORDER BY pf.created_at DESC`, [project.id]),
    query(
      `SELECT id, reference, total_cents, balance_cents, status, due_date, currency
         FROM invoices WHERE project_id = ? AND deleted_at IS NULL
         ${req.user.role_slug === 'client' ? "AND status != 'draft'" : ''} ORDER BY issue_date DESC`, [project.id]),
  ]);

  res.json({ data: { ...full, members, milestones, tasks, deliverables, files, invoices } });
}));

// ---------------------------------------------------------------- CREATE
router.post('/', requirePermission('projects.create'), asyncHandler(async (req, res) => {
  const { organisation_id, name } = req.body;
  if (!organisation_id) throw ApiError.badRequest('A client organisation is required');
  if (!name?.trim()) throw ApiError.badRequest('A project name is required');

  const created = await transaction(async (tx) => {
    const reference = await generateReference('project', tx);
    const result = await tx.execute(
      `INSERT INTO projects
         (reference, organisation_id, quote_id, division_id, name, description, brief,
          stage, status, priority, start_date, due_date, budget_cents, currency,
          project_manager_id, cover_media_id, is_client_visible, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        reference, organisation_id, req.body.quote_id || null, req.body.division_id || null,
        name.trim(), req.body.description || null, req.body.brief || null,
        req.body.stage || 'discover', req.body.status || 'planning', req.body.priority || 'normal',
        req.body.start_date || null, req.body.due_date || null,
        req.body.budget_cents || 0, req.body.currency || 'TZS',
        req.body.project_manager_id || req.user.id, req.body.cover_media_id || null,
        req.body.is_client_visible === false ? 0 : 1, req.user.id,
      ]
    );

    for (const userId of req.body.member_ids || []) {
      await tx.execute(
        'INSERT IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)',
        [result.insertId, userId]
      );
    }
    return { id: result.insertId, reference };
  });

  await logActivity(req, 'created', 'projects', created.id, created.reference);
  const project = await queryOne('SELECT * FROM projects WHERE id = ?', [created.id]);
  res.status(201).json({ data: project, message: `Project ${created.reference} created` });
}));

// ---------------------------------------------------------------- UPDATE
router.patch('/:id', requirePermission('projects.update'), asyncHandler(async (req, res) => {
  const existing = await queryOne('SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
  if (!existing) throw ApiError.notFound('Project not found');

  const fields = ['name', 'description', 'brief', 'division_id', 'stage', 'status', 'health',
    'priority', 'progress_percent', 'start_date', 'due_date', 'budget_cents', 'cost_cents',
    'currency', 'project_manager_id', 'cover_media_id', 'is_client_visible'];
  const updates = {};
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  if (updates.status === 'completed' && existing.status !== 'completed') {
    updates.completed_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
    updates.progress_percent = 100;
  }
  if (Object.keys(updates).length === 0 && !req.body.member_ids) {
    throw ApiError.badRequest('Nothing to update');
  }

  if (Object.keys(updates).length) {
    const clause = Object.keys(updates).map((k) => `\`${k}\` = ?`).join(', ');
    await execute(`UPDATE projects SET ${clause} WHERE id = ?`, [...Object.values(updates), req.params.id]);
  }
  if (req.body.member_ids) {
    await execute('DELETE FROM project_members WHERE project_id = ?', [req.params.id]);
    for (const userId of req.body.member_ids) {
      await execute('INSERT IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)', [req.params.id, userId]);
    }
  }

  await logActivity(req, 'updated', 'projects', req.params.id, existing.reference, { after: updates });
  if (updates.status && updates.status !== existing.status) {
    await notifyOrganisation(existing.organisation_id, {
      type: 'project.status',
      title: `${existing.name} is now ${String(updates.status).replace('_', ' ')}`,
      linkUrl: `/portal/projects/${existing.id}`,
      entityType: 'projects', entityId: existing.id, icon: 'activity',
    });
  }

  const project = await queryOne('SELECT * FROM projects WHERE id = ?', [req.params.id]);
  res.json({ data: project, message: 'Project updated' });
}));

// --------------------------------------------------- PROGRESS FROM TASKS
router.post('/:id/recalculate-progress', requirePermission('projects.update'), asyncHandler(async (req, res) => {
  const counts = await queryOne(
    `SELECT COUNT(*) AS total, SUM(status = 'done') AS done
       FROM tasks WHERE project_id = ? AND deleted_at IS NULL AND status != 'cancelled'`,
    [req.params.id]
  );
  const percent = Number(counts.total) > 0
    ? Math.round((Number(counts.done) / Number(counts.total)) * 100) : 0;
  await execute('UPDATE projects SET progress_percent = ? WHERE id = ?', [percent, req.params.id]);
  res.json({ data: { progress_percent: percent }, message: 'Progress recalculated' });
}));

// ---------------------------------------------------------- DELIVERABLES
router.post('/:id/deliverables', requirePermission('deliverables.create'), asyncHandler(async (req, res) => {
  const project = await assertProjectAccess(req.params.id, req);
  const { name, media_id } = req.body;
  if (!name?.trim()) throw ApiError.badRequest('A deliverable name is required');

  const created = await transaction(async (tx) => {
    const result = await tx.execute(
      `INSERT INTO deliverables (project_id, task_id, name, description, type,
                                 revision_limit, due_date, status)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        project.id, req.body.task_id || null, name.trim(), req.body.description || null,
        req.body.type || 'design', req.body.revision_limit || null, req.body.due_date || null,
        media_id ? 'in_review' : 'draft',
      ]
    );
    if (media_id) {
      await tx.execute(
        `INSERT INTO deliverable_versions (deliverable_id, version, media_id, notes, uploaded_by)
         VALUES (?, 1, ?, ?, ?)`,
        [result.insertId, media_id, req.body.notes || null, req.user.id]
      );
    }
    return result.insertId;
  });

  if (media_id) {
    await notifyOrganisation(project.organisation_id, {
      type: 'deliverable.review',
      title: `${name} is ready for your review`,
      body: project.name,
      linkUrl: `/portal/projects/${project.id}`,
      entityType: 'deliverables', entityId: created, icon: 'eye',
    });
  }
  await logActivity(req, 'created', 'deliverables', created, name);
  res.status(201).json({ data: { id: created }, message: 'Deliverable created' });
}));

router.get('/:id/deliverables/:deliverableId', requirePermission('deliverables.view'), asyncHandler(async (req, res) => {
  await assertProjectAccess(req.params.id, req);
  const deliverable = await queryOne(
    'SELECT * FROM deliverables WHERE id = ? AND project_id = ? AND deleted_at IS NULL',
    [req.params.deliverableId, req.params.id]
  );
  if (!deliverable) throw ApiError.notFound('Deliverable not found');

  const versions = await query(
    `SELECT v.*, m.public_url, m.thumb_url, m.mime_type, m.width, m.height, m.original_name,
            CONCAT(u.first_name,' ',u.last_name) AS uploaded_by_name
       FROM deliverable_versions v
  LEFT JOIN media m ON m.id = v.media_id
  LEFT JOIN users u ON u.id = v.uploaded_by
      WHERE v.deliverable_id = ? ORDER BY v.version DESC`,
    [deliverable.id]
  );
  const versionIds = versions.map((v) => v.id);
  const annotations = versionIds.length
    ? await query(
        `SELECT a.*, CONCAT(u.first_name,' ',u.last_name) AS author_name, m.public_url AS author_avatar
           FROM annotations a
      LEFT JOIN users u ON u.id = a.user_id
      LEFT JOIN media m ON m.id = u.avatar_media_id
          WHERE a.version_id IN (${versionIds.map(() => '?').join(',')})
          ORDER BY a.created_at`,
        versionIds
      )
    : [];

  res.json({ data: { ...deliverable, versions, annotations: parseJsonRows(annotations, ['shape_data']) } });
}));

/** Upload a new version. Counts against the revision limit. */
router.post('/:id/deliverables/:deliverableId/versions', requirePermission('deliverables.create'), asyncHandler(async (req, res) => {
  const project = await assertProjectAccess(req.params.id, req);
  const deliverable = await queryOne(
    'SELECT * FROM deliverables WHERE id = ? AND project_id = ?',
    [req.params.deliverableId, req.params.id]
  );
  if (!deliverable) throw ApiError.notFound('Deliverable not found');
  if (!req.body.media_id) throw ApiError.badRequest('A file is required');

  const nextVersion = deliverable.current_version + 1;
  const overLimit = deliverable.revision_limit !== null
    && deliverable.revision_count >= deliverable.revision_limit;

  await transaction(async (tx) => {
    await tx.execute(
      "UPDATE deliverable_versions SET status = 'superseded' WHERE deliverable_id = ? AND status = 'pending'",
      [deliverable.id]
    );
    await tx.execute(
      `INSERT INTO deliverable_versions (deliverable_id, version, media_id, notes, uploaded_by)
       VALUES (?,?,?,?,?)`,
      [deliverable.id, nextVersion, req.body.media_id, req.body.notes || null, req.user.id]
    );
    await tx.execute(
      `UPDATE deliverables SET current_version = ?, status = 'in_review',
              revision_count = revision_count + 1 WHERE id = ?`,
      [nextVersion, deliverable.id]
    );
  });

  await notifyOrganisation(project.organisation_id, {
    type: 'deliverable.review',
    title: `${deliverable.name} v${nextVersion} is ready for review`,
    linkUrl: `/portal/projects/${project.id}`,
    entityType: 'deliverables', entityId: deliverable.id, icon: 'eye',
  });

  res.status(201).json({
    data: { version: nextVersion, over_revision_limit: overLimit },
    message: overLimit
      ? `Version ${nextVersion} uploaded. This exceeds the agreed revision limit and is billable.`
      : `Version ${nextVersion} uploaded`,
  });
}));

/** Client approves or requests changes. */
router.post('/:id/deliverables/:deliverableId/review', requirePermission('deliverables.view'), asyncHandler(async (req, res) => {
  const project = await assertProjectAccess(req.params.id, req);
  const deliverable = await queryOne(
    'SELECT * FROM deliverables WHERE id = ? AND project_id = ?',
    [req.params.deliverableId, req.params.id]
  );
  if (!deliverable) throw ApiError.notFound('Deliverable not found');

  const { decision, comment } = req.body;
  if (!['approve', 'request_changes'].includes(decision)) {
    throw ApiError.badRequest("decision must be 'approve' or 'request_changes'");
  }

  const latest = await queryOne(
    'SELECT * FROM deliverable_versions WHERE deliverable_id = ? ORDER BY version DESC LIMIT 1',
    [deliverable.id]
  );

  if (decision === 'approve') {
    await transaction(async (tx) => {
      await tx.execute(
        "UPDATE deliverables SET status='approved', approved_at=NOW(), approved_by=? WHERE id = ?",
        [req.user.id, deliverable.id]
      );
      if (latest) {
        await tx.execute("UPDATE deliverable_versions SET status='approved' WHERE id = ?", [latest.id]);
      }
    });
  } else {
    await transaction(async (tx) => {
      await tx.execute("UPDATE deliverables SET status='changes_requested' WHERE id = ?", [deliverable.id]);
      if (latest) {
        await tx.execute("UPDATE deliverable_versions SET status='changes_requested' WHERE id = ?", [latest.id]);
      }
    });
  }

  if (comment?.trim() && latest) {
    await execute(
      'INSERT INTO annotations (version_id, user_id, body) VALUES (?,?,?)',
      [latest.id, req.user.id, comment.trim()]
    );
  }

  await notifyByPermission('deliverables.view', {
    type: `deliverable.${decision}`,
    title: decision === 'approve'
      ? `${deliverable.name} approved`
      : `Changes requested on ${deliverable.name}`,
    body: comment?.slice(0, 160) || project.name,
    linkUrl: `/admin/projects/${project.id}`,
    entityType: 'deliverables', entityId: deliverable.id,
    icon: decision === 'approve' ? 'check-circle' : 'message-circle',
  });
  await logActivity(req, decision, 'deliverables', deliverable.id, deliverable.name);

  res.json({ message: decision === 'approve' ? 'Approved. Thank you.' : 'Your change request has been sent.' });
}));

// ----------------------------------------------------------- ANNOTATIONS
router.post('/:id/versions/:versionId/annotations', requirePermission('deliverables.view'), asyncHandler(async (req, res) => {
  await assertProjectAccess(req.params.id, req);
  if (!req.body.body?.trim()) throw ApiError.badRequest('A comment is required');

  const result = await execute(
    `INSERT INTO annotations (version_id, user_id, parent_id, body, pos_x, pos_y, shape,
                              shape_data, page_number, timecode_secs)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      req.params.versionId, req.user.id, req.body.parent_id || null, req.body.body.trim(),
      req.body.pos_x ?? null, req.body.pos_y ?? null, req.body.shape || 'pin',
      req.body.shape_data ? JSON.stringify(req.body.shape_data) : null,
      req.body.page_number ?? null, req.body.timecode_secs ?? null,
    ]
  );
  const annotation = await queryOne(
    `SELECT a.*, CONCAT(u.first_name,' ',u.last_name) AS author_name
       FROM annotations a LEFT JOIN users u ON u.id = a.user_id WHERE a.id = ?`,
    [result.insertId]
  );
  res.status(201).json({ data: annotation, message: 'Comment added' });
}));

router.patch('/:id/annotations/:annotationId/resolve', requirePermission('deliverables.update'), asyncHandler(async (req, res) => {
  await execute(
    'UPDATE annotations SET is_resolved = ?, resolved_by = ?, resolved_at = NOW() WHERE id = ?',
    [req.body.is_resolved === false ? 0 : 1, req.user.id, req.params.annotationId]
  );
  res.json({ message: 'Comment updated' });
}));

router.delete('/:id/annotations/:annotationId', requirePermission('deliverables.update'), asyncHandler(async (req, res) => {
  const annotation = await queryOne('SELECT * FROM annotations WHERE id = ?', [req.params.annotationId]);
  if (!annotation) throw ApiError.notFound('Comment not found');
  // Authors can remove their own comment; otherwise it takes an admin.
  if (annotation.user_id !== req.user.id && req.user.role_slug !== 'admin') throw ApiError.forbidden();
  await execute('DELETE FROM annotations WHERE id = ?', [req.params.annotationId]);
  res.json({ message: 'Comment deleted' });
}));

// ----------------------------------------------------------------- FILES
router.post('/:id/files', requirePermission('projects.update'), asyncHandler(async (req, res) => {
  await assertProjectAccess(req.params.id, req);
  const { media_id, category = 'asset' } = req.body;
  if (!media_id) throw ApiError.badRequest('A file is required');

  const result = await execute(
    `INSERT INTO project_files (project_id, media_id, category, is_client_visible, uploaded_by)
     VALUES (?,?,?,?,?)`,
    [req.params.id, media_id, category, req.body.is_client_visible === false ? 0 : 1, req.user.id]
  );
  res.status(201).json({ data: { id: result.insertId }, message: 'File attached' });
}));

router.delete('/:id/files/:fileId', requirePermission('projects.update'), asyncHandler(async (req, res) => {
  await execute('DELETE FROM project_files WHERE id = ? AND project_id = ?', [req.params.fileId, req.params.id]);
  res.json({ message: 'File removed from project' });
}));

// ------------------------------------------------------------ TIME ENTRIES
router.post('/:id/time', requirePermission('tasks.update'), asyncHandler(async (req, res) => {
  const { hours, entry_date, description, task_id } = req.body;
  if (!hours || Number(hours) <= 0) throw ApiError.badRequest('Hours must be greater than zero');

  const result = await execute(
    `INSERT INTO time_entries (task_id, project_id, user_id, description, hours, entry_date,
                               is_billable, rate_cents)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      task_id || null, req.params.id, req.user.id, description || null, Number(hours),
      entry_date || new Date().toISOString().slice(0, 10),
      req.body.is_billable === false ? 0 : 1, req.body.rate_cents || 0,
    ]
  );
  if (task_id) {
    await execute(
      'UPDATE tasks SET logged_hours = (SELECT COALESCE(SUM(hours),0) FROM time_entries WHERE task_id = ?) WHERE id = ?',
      [task_id, task_id]
    );
  }
  res.status(201).json({ data: { id: result.insertId }, message: 'Time logged' });
}));

router.get('/:id/time', requirePermission('projects.view'), asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT te.*, CONCAT(u.first_name,' ',u.last_name) AS user_name, t.title AS task_title
       FROM time_entries te
       JOIN users u ON u.id = te.user_id
  LEFT JOIN tasks t ON t.id = te.task_id
      WHERE te.project_id = ? ORDER BY te.entry_date DESC`,
    [req.params.id]
  );
  const totals = await queryOne(
    `SELECT COALESCE(SUM(hours),0) AS total_hours,
            COALESCE(SUM(CASE WHEN is_billable=1 THEN hours END),0) AS billable_hours
       FROM time_entries WHERE project_id = ?`,
    [req.params.id]
  );
  res.json({ data: rows, totals });
}));

// -------------------------------------------------------------- COMMENTS
router.get('/:id/comments', requirePermission('projects.view'), asyncHandler(async (req, res) => {
  await assertProjectAccess(req.params.id, req);
  const internalFilter = req.user.role_slug === 'client' ? 'AND c.is_internal = 0' : '';
  const rows = await query(
    `SELECT c.*, CONCAT(u.first_name,' ',u.last_name) AS author_name, m.public_url AS author_avatar,
            r.slug AS author_role
       FROM comments c
  LEFT JOIN users u ON u.id = c.user_id
  LEFT JOIN roles r ON r.id = u.role_id
  LEFT JOIN media m ON m.id = u.avatar_media_id
      WHERE c.entity_type = 'project' AND c.entity_id = ? AND c.deleted_at IS NULL ${internalFilter}
      ORDER BY c.created_at`,
    [req.params.id]
  );
  res.json({ data: parseJsonRows(rows, ['attachments']) });
}));

router.post('/:id/comments', requirePermission('projects.view'), asyncHandler(async (req, res) => {
  const project = await assertProjectAccess(req.params.id, req);
  if (!req.body.body?.trim()) throw ApiError.badRequest('A message is required');
  // Clients can never post an internal-only note.
  const isInternal = req.user.role_slug === 'client' ? 0 : (req.body.is_internal ? 1 : 0);

  const result = await execute(
    `INSERT INTO comments (entity_type, entity_id, user_id, parent_id, body, attachments, is_internal)
     VALUES ('project',?,?,?,?,?,?)`,
    [
      req.params.id, req.user.id, req.body.parent_id || null, req.body.body.trim(),
      req.body.attachments ? JSON.stringify(req.body.attachments) : null, isInternal,
    ]
  );

  if (!isInternal) {
    if (req.user.role_slug === 'client') {
      await notifyByPermission('projects.view', {
        type: 'project.comment',
        title: `New message on ${project.name}`,
        body: req.body.body.slice(0, 160),
        linkUrl: `/admin/projects/${project.id}`,
        entityType: 'projects', entityId: project.id, icon: 'message-square',
      });
    } else {
      await notifyOrganisation(project.organisation_id, {
        type: 'project.comment',
        title: `New message on ${project.name}`,
        body: req.body.body.slice(0, 160),
        linkUrl: `/portal/projects/${project.id}`,
        entityType: 'projects', entityId: project.id, icon: 'message-square',
      });
    }
  }
  res.status(201).json({ data: { id: result.insertId }, message: 'Message posted' });
}));

// ---------------------------------------------------------------- DELETE
router.delete('/:id', requirePermission('projects.delete'), asyncHandler(async (req, res) => {
  const project = await queryOne('SELECT * FROM projects WHERE id = ?', [req.params.id]);
  if (!project) throw ApiError.notFound('Project not found');
  await execute('UPDATE projects SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
  await logActivity(req, 'deleted', 'projects', req.params.id, project.reference);
  res.json({ message: 'Project moved to trash' });
}));

router.post('/:id/restore', requirePermission('projects.update'), asyncHandler(async (req, res) => {
  await execute('UPDATE projects SET deleted_at = NULL WHERE id = ?', [req.params.id]);
  res.json({ message: 'Project restored' });
}));

export default router;
