import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { money, date, timeAgo, humanise } from '../../utils/format';
import {
  Card, Spinner, Badge, Progress, Empty, Tabs, Button,
  Textarea, Avatar, DataTable,
} from '../../components/UI';
import ProofViewer from '../../components/ProofViewer';

const STAGES = ['discover', 'strategy', 'create', 'build', 'activate', 'measure', 'optimize'];

export default function PortalProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [newComment, setNewComment] = useState('');
  const [proofing, setProofing] = useState(null);
  const { currency, toast } = useApp();

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

  const postComment = async () => {
    if (!newComment.trim()) return;
    try {
      await api.post(`/projects/${id}/comments`, { body: newComment });
      setNewComment('');
      const res = await api.get(`/projects/${id}/comments`);
      setComments(res.data || []);
      toast('Message sent', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  if (loading) return <Spinner center />;
  if (!project) {
    return (
      <Empty
        title="Project not found"
        action={<Link to="/portal/projects" className="btn btn-primary">Back to projects</Link>}
      />
    );
  }

  const pendingApproval = (project.deliverables || []).filter((d) => d.status === 'in_review');

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'deliverables', label: 'To review', count: pendingApproval.length || undefined },
    { key: 'files', label: 'Files', count: project.files?.length },
    { key: 'messages', label: 'Messages', count: comments.length },
    { key: 'invoices', label: 'Invoices', count: project.invoices?.length },
  ];

  return (
    <div className="stack-lg">
      <div>
        <Link to="/portal/projects" className="small muted">← Your projects</Link>
        <div className="row row-wrap" style={{ gap: 'var(--s3)', marginTop: 4 }}>
          <h2>{project.name}</h2>
          <Badge status={project.status} />
        </div>
        <p className="small muted" style={{ marginTop: 4 }}>{project.reference}</p>
      </div>

      <Card pad>
        <div className="row row-wrap" style={{ gap: 'var(--s2)', marginBottom: 'var(--s5)' }}>
          {STAGES.map((stage, i) => {
            const active = project.stage === stage;
            const passed = STAGES.indexOf(project.stage) > i;
            return (
              <span
                key={stage}
                className="badge"
                style={{
                  background: active ? 'var(--orange-500)' : passed ? 'var(--ink-200)' : 'var(--ink-100)',
                  color: active ? 'white' : passed ? 'var(--ink-700)' : 'var(--ink-400)',
                }}
              >
                {humanise(stage)}
              </span>
            );
          })}
        </div>

        <div className="row-between tiny" style={{ marginBottom: 4 }}>
          <span className="muted">Progress</span>
          <span className="bold">{project.progress_percent}%</span>
        </div>
        <Progress value={project.progress_percent} />

        <div className="row row-wrap" style={{ gap: 'var(--s8)', marginTop: 'var(--s5)' }}>
          <div>
            <div className="tiny muted">Started</div>
            <div className="small bold">{date(project.start_date)}</div>
          </div>
          <div>
            <div className="tiny muted">Due</div>
            <div className="small bold">{date(project.due_date)}</div>
          </div>
          {project.manager_name && (
            <div>
              <div className="tiny muted">Your contact</div>
              <div className="small bold">{project.manager_name}</div>
            </div>
          )}
        </div>
      </Card>

      {pendingApproval.length > 0 && (
        <Card style={{ borderColor: 'var(--orange-500)', borderWidth: 2 }}>
          <div className="card-body">
            <div className="row-between row-wrap" style={{ gap: 'var(--s4)' }}>
              <div>
                <h4>{pendingApproval.length} item{pendingApproval.length === 1 ? '' : 's'} waiting for you</h4>
                <p className="small muted" style={{ marginTop: 4 }}>
                  We have paused on these until you have had a look.
                </p>
              </div>
              <Button variant="primary" onClick={() => setTab('deliverables')}>Review now</Button>
            </div>
          </div>
        </Card>
      )}

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div className="grid grid-2">
          <Card>
            <div className="card-header"><h4>The brief</h4></div>
            <div className="card-body">
              <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                {project.brief || project.description || <span className="muted">No brief recorded.</span>}
              </p>
            </div>
          </Card>

          <Card>
            <div className="card-header"><h4>Milestones</h4></div>
            <div className="card-body">
              {project.milestones?.length ? (
                <div className="stack" style={{ gap: 'var(--s4)' }}>
                  {project.milestones.map((ms) => (
                    <div key={ms.id} className="row" style={{ gap: 'var(--s3)', alignItems: 'flex-start' }}>
                      <span style={{
                        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                        background: ms.completed_at ? 'var(--success)' : 'var(--ink-200)',
                        color: 'white', display: 'grid', placeItems: 'center', fontSize: 11,
                      }}>
                        {ms.completed_at ? '✓' : ''}
                      </span>
                      <div>
                        <div className="small bold">{ms.name}</div>
                        <div className="tiny muted">{date(ms.due_date)}</div>
                        {ms.description && <p className="tiny muted" style={{ marginTop: 2 }}>{ms.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="small muted">No milestones set for this project.</p>}
            </div>
          </Card>
        </div>
      )}

      {tab === 'deliverables' && (
        <Card>
          <div className="card-header"><h4>Work for your review</h4></div>
          <div className="card-body">
            {project.deliverables?.length ? (
              <div className="grid grid-3">
                {project.deliverables.map((item) => (
                  <button
                    key={item.id}
                    className="card card-hover"
                    onClick={() => setProofing(item)}
                    style={{
                      textAlign: 'left', cursor: 'pointer', padding: 0,
                      border: item.status === 'in_review' ? '2px solid var(--orange-500)' : '1px solid var(--border)',
                    }}
                  >
                    <div style={{
                      aspectRatio: '4/3', background: 'var(--ink-100)',
                      display: 'grid', placeItems: 'center', fontSize: 28, color: 'var(--ink-400)',
                    }}>
                      ◫
                    </div>
                    <div className="card-pad">
                      <div className="row-between">
                        <span className="bold small truncate">{item.name}</span>
                        <Badge status={item.status} />
                      </div>
                      <div className="tiny muted" style={{ marginTop: 4 }}>
                        Version {item.current_version}
                      </div>
                      {item.status === 'in_review' && (
                        <div className="tiny bold" style={{ color: 'var(--orange-500)', marginTop: 4 }}>
                          Needs your decision →
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <Empty title="Nothing to review yet" description="Work appears here when it is ready for you." />
            )}
          </div>
        </Card>
      )}

      {tab === 'files' && (
        <Card>
          <div className="card-header"><h4>Project files</h4></div>
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
            ) : <Empty title="No files shared yet" />}
          </div>
        </Card>
      )}

      {tab === 'messages' && (
        <Card>
          <div className="card-header"><h4>Messages</h4></div>
          <div className="card-body">
            <div style={{ marginBottom: 'var(--s6)' }}>
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Ask a question or leave feedback…"
                rows={3}
              />
              <Button
                variant="primary"
                size="sm"
                onClick={postComment}
                disabled={!newComment.trim()}
                style={{ marginTop: 'var(--s3)' }}
              >
                Send message
              </Button>
            </div>

            {comments.length === 0 ? (
              <Empty title="No messages yet" description="Anything you write here reaches the project team." />
            ) : (
              <div className="stack">
                {comments.map((comment) => (
                  <div key={comment.id} className="card card-pad" style={{ background: 'var(--ink-50)' }}>
                    <div className="row-between" style={{ marginBottom: 'var(--s2)' }}>
                      <div className="row" style={{ gap: 'var(--s2)' }}>
                        <Avatar src={comment.author_avatar} name={comment.author_name} size="sm" />
                        <span className="small bold">{comment.author_name}</span>
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

      {tab === 'invoices' && (
        <Card>
          <div className="card-header"><h4>Invoices for this project</h4></div>
          <DataTable
            rows={project.invoices || []}
            empty={<Empty title="No invoices raised yet" />}
            columns={[
              { key: 'reference', label: 'Invoice', render: (row) => <span className="bold mono">{row.reference}</span> },
              { key: 'due_date', label: 'Due', render: (row) => <span className="small">{date(row.due_date)}</span> },
              {
                key: 'total_cents',
                label: 'Total',
                align: 'right',
                render: (row) => money(row.total_cents, currency, row.currency),
              },
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
            ]}
          />
        </Card>
      )}

      {proofing && (
        <ProofViewer
          projectId={id}
          deliverableId={proofing.id}
          onClose={() => { setProofing(null); load(); }}
        />
      )}
    </div>
  );
}
