import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { money, date, dateTime, timeAgo, humanise, number } from '../../utils/format';
import {
  Card, Button, Badge, Progress, Spinner, Empty, Tabs, Modal,
  Field, Input, Textarea, Select, Avatar, DataTable, ConfirmDialog,
} from '../../components/UI';
import MediaPicker from '../../components/MediaPicker';
import ProofViewer from '../../components/ProofViewer';

const STAGES = ['discover', 'strategy', 'create', 'build', 'activate', 'measure', 'optimize'];
const TASK_STATUSES = ['todo', 'in_progress', 'review', 'blocked', 'done'];

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currency, toast, user } = useApp();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [staff, setStaff] = useState([]);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [internalNote, setInternalNote] = useState(false);

  const [taskModal, setTaskModal] = useState(null);
  const [deliverableModal, setDeliverableModal] = useState(null);
  const [proofing, setProofing] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [res, commentsRes] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get(`/projects/${id}/comments`).catch(() => ({ data: [] })),
      ]);
      setProject(res.data);
      setComments(commentsRes.data || []);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get('/users?limit=100')
      .then((res) => setStaff((res.data || []).filter((u) => u.role_slug !== 'client')))
      .catch(() => setStaff([]));
  }, []);

  const patchProject = async (patch) => {
    try {
      await api.patch(`/projects/${id}`, patch);
      toast('Updated', 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const saveTask = async () => {
    try {
      if (taskModal.id) {
        await api.patch(`/tasks/${taskModal.id}`, taskModal);
      } else {
        await api.post('/tasks', { ...taskModal, project_id: Number(id) });
      }
      toast('Task saved', 'success');
      setTaskModal(null);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const setTaskStatus = async (task, status) => {
    try {
      await api.patch(`/tasks/${task.id}`, { status });
      load();
      await api.post(`/projects/${id}/recalculate-progress`);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const deleteTask = async (taskId) => {
    try {
      await api.delete(`/tasks/${taskId}`);
      toast('Task deleted', 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const saveDeliverable = async () => {
    try {
      await api.post(`/projects/${id}/deliverables`, deliverableModal);
      toast('Deliverable created', 'success');
      setDeliverableModal(null);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const postComment = async () => {
    if (!newComment.trim()) return;
    try {
      await api.post(`/projects/${id}/comments`, {
        body: newComment,
        is_internal: internalNote,
      });
      setNewComment('');
      const res = await api.get(`/projects/${id}/comments`);
      setComments(res.data || []);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/projects/${id}`);
      toast('Project moved to trash', 'success');
      navigate('/admin/projects');
    } catch (err) {
      toast(err.message, 'error');
      setDeleting(false);
    }
  };

  if (loading) return <Spinner center />;
  if (!project) {
    return <Empty title="Project not found" action={<Link to="/admin/projects" className="btn btn-primary">Back</Link>} />;
  }

  const margin = Number(project.budget_cents) > 0
    ? ((Number(project.budget_cents) - Number(project.cost_cents)) / Number(project.budget_cents)) * 100
    : null;

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'tasks', label: 'Tasks', count: project.tasks?.length },
    { key: 'deliverables', label: 'Deliverables', count: project.deliverables?.length },
    { key: 'files', label: 'Files', count: project.files?.length },
    { key: 'comments', label: 'Messages', count: comments.length },
    { key: 'finance', label: 'Finance' },
  ];

  return (
    <div className="stack-lg">
      <div className="row-between row-wrap">
        <div>
          <Link to="/admin/projects" className="small muted">← Projects</Link>
          <div className="row row-wrap" style={{ gap: 'var(--s3)', marginTop: 4 }}>
            <h2>{project.name}</h2>
            <Badge status={project.status} />
            <Badge status={project.health} />
          </div>
          <p className="small muted" style={{ marginTop: 4 }}>
            {project.reference} · {project.organisation_name}
            {project.quote_reference && ` · from ${project.quote_reference}`}
          </p>
        </div>

        <div className="row" style={{ gap: 'var(--s2)' }}>
          <Button variant="outline" onClick={() => setDeleting(true)} style={{ color: 'var(--danger)' }}>
            Delete
          </Button>
        </div>
      </div>

      {/* --------------------------------------------------- STAGE TRACKER */}
      <Card pad>
        <div className="row row-wrap" style={{ gap: 'var(--s2)' }}>
          {STAGES.map((stage, i) => {
            const active = project.stage === stage;
            const passed = STAGES.indexOf(project.stage) > i;
            return (
              <button
                key={stage}
                onClick={() => patchProject({ stage })}
                className="btn btn-sm"
                style={{
                  background: active ? 'var(--orange-500)' : passed ? 'var(--ink-200)' : 'transparent',
                  color: active ? 'white' : passed ? 'var(--ink-700)' : 'var(--ink-500)',
                  border: `1px solid ${active ? 'var(--orange-500)' : 'var(--border)'}`,
                }}
              >
                {humanise(stage)}
              </button>
            );
          })}
        </div>

        <div className="row-between row-wrap" style={{ marginTop: 'var(--s5)', gap: 'var(--s6)' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="row-between tiny" style={{ marginBottom: 4 }}>
              <span className="muted">Progress</span>
              <span className="bold">{project.progress_percent}%</span>
            </div>
            <Progress value={project.progress_percent} />
          </div>
          <div className="row" style={{ gap: 'var(--s6)' }}>
            <div>
              <div className="tiny muted">Budget</div>
              <div className="bold">{money(project.budget_cents, currency, project.currency)}</div>
            </div>
            <div>
              <div className="tiny muted">Cost</div>
              <div className="bold">{money(project.cost_cents, currency, project.currency)}</div>
            </div>
            {margin !== null && (
              <div>
                <div className="tiny muted">Margin</div>
                <div className="bold" style={{
                  color: margin < 20 ? 'var(--danger)' : margin < 35 ? 'var(--warning)' : 'var(--success)',
                }}>
                  {margin.toFixed(0)}%
                </div>
              </div>
            )}
            <div>
              <div className="tiny muted">Due</div>
              <div className="bold">{date(project.due_date)}</div>
            </div>
          </div>
        </div>
      </Card>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {/* ------------------------------------------------------- OVERVIEW */}
      {tab === 'overview' && (
        <div className="grid grid-2">
          <Card>
            <div className="card-header"><h4>Brief</h4></div>
            <div className="card-body">
              <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                {project.brief || project.description || <span className="muted">No brief recorded yet.</span>}
              </p>
            </div>
          </Card>

          <div className="stack">
            <Card>
              <div className="card-header"><h4>Settings</h4></div>
              <div className="card-body">
                <div className="field-row">
                  <Field label="Status">
                    <Select
                      value={project.status}
                      onChange={(e) => patchProject({ status: e.target.value })}
                      options={['planning', 'active', 'on_hold', 'review', 'completed', 'cancelled']
                        .map((s) => ({ value: s, label: humanise(s) }))}
                    />
                  </Field>
                  <Field label="Health">
                    <Select
                      value={project.health}
                      onChange={(e) => patchProject({ health: e.target.value })}
                      options={['on_track', 'at_risk', 'off_track'].map((h) => ({ value: h, label: humanise(h) }))}
                    />
                  </Field>
                </div>
                <Field label="Visible in the client portal" hint="Turn off to work on it privately first">
                  <Select
                    value={project.is_client_visible ? '1' : '0'}
                    onChange={(e) => patchProject({ is_client_visible: e.target.value === '1' })}
                    options={[{ value: '1', label: 'Yes, client can see it' }, { value: '0', label: 'No, internal only' }]}
                  />
                </Field>
              </div>
            </Card>

            <Card>
              <div className="card-header"><h4>Milestones</h4></div>
              <div className="card-body">
                {project.milestones?.length ? (
                  <div className="stack" style={{ gap: 'var(--s3)' }}>
                    {project.milestones.map((ms) => (
                      <div key={ms.id} className="row-between">
                        <div>
                          <div className="small bold">{ms.name}</div>
                          <div className="tiny muted">{date(ms.due_date)}</div>
                        </div>
                        <Badge tone={ms.completed_at ? 'success' : 'neutral'}>
                          {ms.completed_at ? 'Done' : 'Open'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : <p className="small muted">No milestones set.</p>}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------- TASKS */}
      {tab === 'tasks' && (
        <Card>
          <div className="card-header">
            <h4>Tasks</h4>
            <Button size="sm" variant="primary" onClick={() => setTaskModal({ status: 'todo', priority: 'normal' })}>
              + Add task
            </Button>
          </div>
          <DataTable
            rows={project.tasks || []}
            empty={<Empty title="No tasks yet" description="Break the project into steps so nothing is missed." />}
            columns={[
              {
                key: 'title',
                label: 'Task',
                render: (row) => (
                  <div style={{ minWidth: 0 }}>
                    <div className="bold truncate" style={{
                      textDecoration: row.status === 'done' ? 'line-through' : 'none',
                      opacity: row.status === 'done' ? 0.6 : 1,
                    }}>
                      {row.title}
                    </div>
                    {row.description && <div className="tiny muted truncate">{row.description}</div>}
                  </div>
                ),
              },
              {
                key: 'assignee_name',
                label: 'Assigned',
                render: (row) => (row.assignee_name
                  ? <div className="row" style={{ gap: 6 }}>
                      <Avatar name={row.assignee_name} size="sm" />
                      <span className="small">{row.assignee_name}</span>
                    </div>
                  : <span className="muted small">Unassigned</span>),
              },
              { key: 'due_date', label: 'Due', render: (row) => <span className="small">{date(row.due_date)}</span> },
              { key: 'priority', label: 'Priority', render: (row) => <Badge tone={row.priority === 'urgent' ? 'danger' : row.priority === 'high' ? 'warning' : 'neutral'}>{humanise(row.priority)}</Badge> },
              {
                key: 'status',
                label: 'Status',
                render: (row) => (
                  <select
                    className="select"
                    value={row.status}
                    onChange={(e) => setTaskStatus(row, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ width: 'auto', padding: '0.25rem 1.8rem 0.25rem 0.6rem', fontSize: 12 }}
                  >
                    {TASK_STATUSES.map((s) => <option key={s} value={s}>{humanise(s)}</option>)}
                  </select>
                ),
              },
              {
                key: '_actions',
                label: '',
                render: (row) => (
                  <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                    <Button size="sm" variant="ghost" onClick={() => setTaskModal(row)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteTask(row.id)} style={{ color: 'var(--danger)' }}>
                      Delete
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </Card>
      )}

      {/* --------------------------------------------------- DELIVERABLES */}
      {tab === 'deliverables' && (
        <Card>
          <div className="card-header">
            <div>
              <h4>Deliverables</h4>
              <span className="tiny muted">Upload work for the client to review and approve</span>
            </div>
            <Button size="sm" variant="primary" onClick={() => setDeliverableModal({ type: 'design' })}>
              + Add deliverable
            </Button>
          </div>
          <div className="card-body">
            {project.deliverables?.length ? (
              <div className="grid grid-3">
                {project.deliverables.map((item) => (
                  <button
                    key={item.id}
                    className="card card-hover"
                    onClick={() => setProofing(item)}
                    style={{ textAlign: 'left', cursor: 'pointer', padding: 0, border: '1px solid var(--border)' }}
                  >
                    <div style={{
                      aspectRatio: '4/3',
                      background: 'var(--ink-100)',
                      display: 'grid', placeItems: 'center',
                      fontSize: 28, color: 'var(--ink-400)',
                    }}>
                      ◫
                    </div>
                    <div className="card-pad">
                      <div className="row-between">
                        <span className="bold small truncate">{item.name}</span>
                        <Badge status={item.status} />
                      </div>
                      <div className="tiny muted" style={{ marginTop: 4 }}>
                        v{item.current_version} · {item.version_count} version{item.version_count === 1 ? '' : 's'}
                        {item.revision_limit && ` · ${item.revision_count}/${item.revision_limit} revisions`}
                      </div>
                      {item.revision_limit && item.revision_count >= item.revision_limit && (
                        <div className="tiny" style={{ color: 'var(--warning)', marginTop: 4 }}>
                          Revision limit reached — further rounds are billable
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <Empty
                title="No deliverables yet"
                description="Upload designs, documents or video for the client to review."
              />
            )}
          </div>
        </Card>
      )}

      {/* ---------------------------------------------------------- FILES */}
      {tab === 'files' && (
        <Card>
          <div className="card-header"><h4>Files</h4></div>
          <div className="card-body">
            {project.files?.length ? (
              <div className="grid grid-4">
                {project.files.map((file) => (
                  <a
                    key={file.id}
                    href={file.public_url}
                    target="_blank"
                    rel="noreferrer"
                    className="card card-hover"
                    style={{ padding: 0 }}
                  >
                    <div style={{
                      aspectRatio: '4/3',
                      background: file.kind === 'image' && file.thumb_url
                        ? `url(${file.thumb_url}) center/cover`
                        : 'var(--ink-100)',
                      display: 'grid', placeItems: 'center', fontSize: 24, color: 'var(--ink-400)',
                    }}>
                      {file.kind !== 'image' && '◫'}
                    </div>
                    <div style={{ padding: 'var(--s3)' }}>
                      <div className="tiny bold truncate">{file.original_name}</div>
                      <div style={{ fontSize: 10 }} className="muted">{humanise(file.category)}</div>
                    </div>
                  </a>
                ))}
              </div>
            ) : <Empty title="No files attached" />}
          </div>
        </Card>
      )}

      {/* ------------------------------------------------------- COMMENTS */}
      {tab === 'comments' && (
        <Card>
          <div className="card-header"><h4>Messages</h4></div>
          <div className="card-body">
            <div style={{ marginBottom: 'var(--s6)' }}>
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a message…"
                rows={3}
              />
              <div className="row-between" style={{ marginTop: 'var(--s3)' }}>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={internalNote}
                    onChange={(e) => setInternalNote(e.target.checked)}
                  />
                  <span className="small">Internal note — the client will not see this</span>
                </label>
                <Button variant="primary" size="sm" onClick={postComment} disabled={!newComment.trim()}>
                  Post
                </Button>
              </div>
            </div>

            {comments.length === 0 ? (
              <Empty title="No messages yet" description="Discussion with the client and the team lives here." />
            ) : (
              <div className="stack">
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    style={{
                      padding: 'var(--s4)',
                      borderRadius: 'var(--radius)',
                      background: comment.is_internal ? 'var(--warning-bg)' : 'var(--ink-50)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div className="row-between" style={{ marginBottom: 'var(--s2)' }}>
                      <div className="row" style={{ gap: 'var(--s2)' }}>
                        <Avatar src={comment.author_avatar} name={comment.author_name} size="sm" />
                        <span className="small bold">{comment.author_name}</span>
                        {comment.author_role === 'client' && <span className="badge badge-info">Client</span>}
                        {comment.is_internal === 1 && <span className="badge badge-warning">Internal</span>}
                      </div>
                      <span className="tiny muted">{timeAgo(comment.created_at)}</span>
                    </div>
                    <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{comment.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* --------------------------------------------------------- FINANCE */}
      {tab === 'finance' && (
        <Card>
          <div className="card-header"><h4>Invoices for this project</h4></div>
          <DataTable
            rows={project.invoices || []}
            empty={<Empty title="No invoices raised yet" />}
            columns={[
              { key: 'reference', label: 'Invoice', render: (row) => <span className="bold mono">{row.reference}</span> },
              { key: 'due_date', label: 'Due', render: (row) => <span className="small">{date(row.due_date)}</span> },
              { key: 'total_cents', label: 'Total', align: 'right', render: (row) => money(row.total_cents, currency, row.currency) },
              {
                key: 'balance_cents',
                label: 'Balance',
                align: 'right',
                render: (row) => (
                  <span style={{ color: Number(row.balance_cents) > 0 ? 'var(--danger)' : 'var(--success)' }}>
                    {money(row.balance_cents, currency, row.currency)}
                  </span>
                ),
              },
              { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} /> },
              {
                key: '_actions',
                label: '',
                render: (row) => (
                  <Link to={`/admin/invoices/${row.id}`} className="btn btn-ghost btn-sm">Open</Link>
                ),
              },
            ]}
          />
        </Card>
      )}

      {/* ---------------------------------------------------------- MODALS */}
      <Modal
        open={!!taskModal}
        onClose={() => setTaskModal(null)}
        title={taskModal?.id ? 'Edit task' : 'New task'}
        footer={
          <>
            <Button variant="outline" onClick={() => setTaskModal(null)}>Cancel</Button>
            <Button variant="primary" onClick={saveTask}>Save</Button>
          </>
        }
      >
        {taskModal && (
          <>
            <Field label="Task title" required>
              <Input
                value={taskModal.title || ''}
                onChange={(e) => setTaskModal({ ...taskModal, title: e.target.value })}
              />
            </Field>
            <Field label="Description">
              <Textarea
                value={taskModal.description || ''}
                onChange={(e) => setTaskModal({ ...taskModal, description: e.target.value })}
                rows={3}
              />
            </Field>
            <div className="field-row">
              <Field label="Assign to">
                <Select
                  value={taskModal.assigned_to || ''}
                  onChange={(e) => setTaskModal({ ...taskModal, assigned_to: e.target.value })}
                  placeholder="Nobody yet"
                  options={staff.map((s) => ({ value: s.id, label: `${s.first_name} ${s.last_name}` }))}
                />
              </Field>
              <Field label="Due date">
                <Input
                  type="date"
                  value={taskModal.due_date ? String(taskModal.due_date).slice(0, 10) : ''}
                  onChange={(e) => setTaskModal({ ...taskModal, due_date: e.target.value })}
                />
              </Field>
            </div>
            <div className="field-row">
              <Field label="Status">
                <Select
                  value={taskModal.status || 'todo'}
                  onChange={(e) => setTaskModal({ ...taskModal, status: e.target.value })}
                  options={TASK_STATUSES.map((s) => ({ value: s, label: humanise(s) }))}
                />
              </Field>
              <Field label="Priority">
                <Select
                  value={taskModal.priority || 'normal'}
                  onChange={(e) => setTaskModal({ ...taskModal, priority: e.target.value })}
                  options={['low', 'normal', 'high', 'urgent'].map((p) => ({ value: p, label: humanise(p) }))}
                />
              </Field>
              <Field label="Estimated hours">
                <Input
                  type="number" step="0.5"
                  value={taskModal.estimated_hours || ''}
                  onChange={(e) => setTaskModal({ ...taskModal, estimated_hours: e.target.value })}
                />
              </Field>
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={!!taskModal.is_client_visible}
                onChange={(e) => setTaskModal({ ...taskModal, is_client_visible: e.target.checked ? 1 : 0 })}
              />
              <span className="small">Show this task in the client portal</span>
            </label>
          </>
        )}
      </Modal>

      <Modal
        open={!!deliverableModal}
        onClose={() => setDeliverableModal(null)}
        title="New deliverable"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeliverableModal(null)}>Cancel</Button>
            <Button variant="primary" onClick={saveDeliverable}>Create</Button>
          </>
        }
      >
        {deliverableModal && (
          <>
            <Field label="Name" required>
              <Input
                value={deliverableModal.name || ''}
                onChange={(e) => setDeliverableModal({ ...deliverableModal, name: e.target.value })}
                placeholder="Logo concepts round 1"
              />
            </Field>
            <Field label="Type">
              <Select
                value={deliverableModal.type}
                onChange={(e) => setDeliverableModal({ ...deliverableModal, type: e.target.value })}
                options={['design', 'video', 'document', 'website', 'print_proof', 'mockup', 'other']
                  .map((t) => ({ value: t, label: humanise(t) }))}
              />
            </Field>
            <Field label="File" hint="Uploading here immediately sends it for client review">
              <MediaPicker
                value={deliverableModal.media_id}
                onChange={(mediaId) => setDeliverableModal({ ...deliverableModal, media_id: mediaId })}
                kind="all"
              />
            </Field>
            <Field label="Revision limit" hint="Rounds included before extra work becomes billable">
              <Input
                type="number"
                value={deliverableModal.revision_limit || ''}
                onChange={(e) => setDeliverableModal({ ...deliverableModal, revision_limit: e.target.value })}
              />
            </Field>
            <Field label="Notes to the client">
              <Textarea
                value={deliverableModal.notes || ''}
                onChange={(e) => setDeliverableModal({ ...deliverableModal, notes: e.target.value })}
                rows={2}
              />
            </Field>
          </>
        )}
      </Modal>

      {proofing && (
        <ProofViewer
          projectId={id}
          deliverableId={proofing.id}
          onClose={() => { setProofing(null); load(); }}
        />
      )}

      <ConfirmDialog
        open={deleting}
        onCancel={() => setDeleting(false)}
        onConfirm={confirmDelete}
        title="Move this project to trash?"
        message="Tasks and deliverables go with it. You can restore it later."
        confirmLabel="Move to trash"
      />
    </div>
  );
}
