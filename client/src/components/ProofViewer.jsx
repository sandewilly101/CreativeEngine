import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../utils/api';
import { useApp } from '../context/AppContext';
import { timeAgo, humanise, date } from '../utils/format';
import { Modal, Button, Badge, Spinner, Avatar, Textarea, Field } from './UI';
import MediaPicker from './MediaPicker';

/**
 * Proofing viewer.
 *
 * Click anywhere on the artwork to drop a numbered pin and attach a comment.
 * Pin positions are stored as percentages so they land correctly at any
 * screen size. Staff upload new versions; clients approve or request changes.
 */
export default function ProofViewer({ projectId, deliverableId, onClose }) {
  const [deliverable, setDeliverable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeVersion, setActiveVersion] = useState(null);
  const [pendingPin, setPendingPin] = useState(null);
  const [pinComment, setPinComment] = useState('');
  const [generalComment, setGeneralComment] = useState('');
  const [uploading, setUploading] = useState(false);
  const [newVersionMedia, setNewVersionMedia] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const imageRef = useRef(null);

  const { toast, isClient, user } = useApp();

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/projects/${projectId}/deliverables/${deliverableId}`);
      setDeliverable(res.data);
      setActiveVersion((current) => current || res.data.versions?.[0]?.id || null);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId, deliverableId, toast]);

  useEffect(() => { load(); }, [load]);

  const version = deliverable?.versions?.find((v) => v.id === activeVersion) || deliverable?.versions?.[0];
  const annotations = (deliverable?.annotations || []).filter((a) => a.version_id === version?.id);
  const pins = annotations.filter((a) => a.pos_x !== null && !a.parent_id);
  const generalComments = annotations.filter((a) => a.pos_x === null && !a.parent_id);

  const placePin = (e) => {
    if (!imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return;
    setPendingPin({ x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) });
    setPinComment('');
  };

  const savePin = async () => {
    if (!pinComment.trim() || !version) return;
    try {
      await api.post(`/projects/${projectId}/versions/${version.id}/annotations`, {
        body: pinComment,
        pos_x: pendingPin.x,
        pos_y: pendingPin.y,
        shape: 'pin',
      });
      setPendingPin(null);
      setPinComment('');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const saveGeneralComment = async () => {
    if (!generalComment.trim() || !version) return;
    try {
      await api.post(`/projects/${projectId}/versions/${version.id}/annotations`, {
        body: generalComment,
      });
      setGeneralComment('');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const resolveAnnotation = async (annotation) => {
    try {
      await api.patch(`/projects/${projectId}/annotations/${annotation.id}/resolve`, {
        is_resolved: !annotation.is_resolved,
      });
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const review = async (decision) => {
    try {
      const res = await api.post(`/projects/${projectId}/deliverables/${deliverableId}/review`, {
        decision,
        comment: generalComment || undefined,
      });
      toast(res.message, 'success');
      setGeneralComment('');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const uploadVersion = async () => {
    if (!newVersionMedia) return;
    setUploading(true);
    try {
      const res = await api.post(`/projects/${projectId}/deliverables/${deliverableId}/versions`, {
        media_id: newVersionMedia,
      });
      toast(res.message, res.data.over_revision_limit ? 'error' : 'success');
      setShowUpload(false);
      setNewVersionMedia(null);
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={deliverable?.name || 'Proof'}
      size="xl"
      footer={
        <div className="row-between" style={{ width: '100%' }}>
          <div className="row" style={{ gap: 'var(--s2)' }}>
            {deliverable && <Badge status={deliverable.status} />}
            {deliverable?.revision_limit && (
              <span className="tiny muted">
                {deliverable.revision_count} of {deliverable.revision_limit} revisions used
              </span>
            )}
          </div>
          <div className="row" style={{ gap: 'var(--s2)' }}>
            <Button variant="outline" onClick={onClose}>Close</Button>
            {!isClient && (
              <Button variant="dark" onClick={() => setShowUpload(true)}>Upload new version</Button>
            )}
            {deliverable?.status === 'in_review' && (
              <>
                <Button variant="outline" onClick={() => review('request_changes')}>Request changes</Button>
                <Button variant="primary" onClick={() => review('approve')}>Approve</Button>
              </>
            )}
          </div>
        </div>
      }
    >
      {loading ? <Spinner center /> : !deliverable ? (
        <p className="muted">Could not load this deliverable.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 'var(--s5)' }} className="proof-grid">
          {/* -------------------------------------------------------- ARTWORK */}
          <div>
            {deliverable.versions?.length > 1 && (
              <div className="row row-wrap" style={{ gap: 'var(--s2)', marginBottom: 'var(--s4)' }}>
                {deliverable.versions.map((v) => (
                  <button
                    key={v.id}
                    className={`btn btn-sm ${v.id === version?.id ? 'btn-dark' : 'btn-outline'}`}
                    onClick={() => setActiveVersion(v.id)}
                  >
                    v{v.version}
                    {v.status === 'approved' && ' ✓'}
                  </button>
                ))}
              </div>
            )}

            {version?.public_url ? (
              <div style={{ position: 'relative', background: 'var(--ink-100)', borderRadius: 'var(--radius)' }}>
                {version.mime_type?.startsWith('image/') ? (
                  <img
                    ref={imageRef}
                    src={version.public_url}
                    alt={deliverable.name}
                    onClick={placePin}
                    style={{ width: '100%', display: 'block', cursor: 'crosshair', borderRadius: 'var(--radius)' }}
                  />
                ) : version.mime_type?.startsWith('video/') ? (
                  <video src={version.public_url} controls style={{ width: '100%', borderRadius: 'var(--radius)' }} />
                ) : (
                  <div style={{ padding: 'var(--s12)', textAlign: 'center' }}>
                    <div style={{ fontSize: 40, opacity: 0.4 }}>◫</div>
                    <p className="small muted" style={{ marginTop: 'var(--s3)' }}>{version.original_name}</p>
                    <a href={version.public_url} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm"
                      style={{ marginTop: 'var(--s3)' }}>
                      Open file
                    </a>
                  </div>
                )}

                {/* existing pins */}
                {pins.map((pin, i) => (
                  <button
                    key={pin.id}
                    title={pin.body}
                    style={{
                      position: 'absolute',
                      left: `${pin.pos_x}%`,
                      top: `${pin.pos_y}%`,
                      transform: 'translate(-50%, -50%)',
                      width: 26, height: 26, borderRadius: '50%',
                      background: pin.is_resolved ? 'var(--success)' : 'var(--flame)',
                      color: 'white', border: '2px solid white',
                      boxShadow: 'var(--shadow-md)',
                      fontSize: 12, fontWeight: 700,
                      cursor: 'pointer', display: 'grid', placeItems: 'center',
                      opacity: pin.is_resolved ? 0.6 : 1,
                    }}
                    onClick={(e) => { e.stopPropagation(); resolveAnnotation(pin); }}
                  >
                    {i + 1}
                  </button>
                ))}

                {/* pin being placed */}
                {pendingPin && (
                  <div style={{
                    position: 'absolute',
                    left: `${pendingPin.x}%`,
                    top: `${pendingPin.y}%`,
                    transform: 'translate(-50%, -50%)',
                    width: 26, height: 26, borderRadius: '50%',
                    background: 'var(--ink)', border: '2px solid white',
                    boxShadow: 'var(--shadow-md)',
                  }} />
                )}
              </div>
            ) : (
              <div style={{ padding: 'var(--s16)', textAlign: 'center', background: 'var(--ink-100)', borderRadius: 'var(--radius)' }}>
                <p className="muted">No file uploaded for this deliverable yet.</p>
              </div>
            )}

            {version?.mime_type?.startsWith('image/') && (
              <p className="tiny muted" style={{ marginTop: 'var(--s3)' }}>
                Click anywhere on the image to leave a comment at that exact spot.
                Click a pin to mark it resolved.
              </p>
            )}

            {pendingPin && (
              <div className="card card-pad" style={{ marginTop: 'var(--s4)', borderColor: 'var(--flame)' }}>
                <Field label="What needs to change here?">
                  <Textarea
                    value={pinComment}
                    onChange={(e) => setPinComment(e.target.value)}
                    rows={2}
                    autoFocus
                  />
                </Field>
                <div className="row" style={{ gap: 'var(--s2)' }}>
                  <Button variant="primary" size="sm" onClick={savePin} disabled={!pinComment.trim()}>
                    Add comment
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setPendingPin(null)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>

          {/* ------------------------------------------------------ COMMENTS */}
          <aside>
            <div className="card">
              <div className="card-header">
                <h5 style={{ fontSize: 'var(--text-sm)' }}>Feedback</h5>
                <span className="tiny muted">{annotations.length}</span>
              </div>

              <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                {annotations.length === 0 ? (
                  <div style={{ padding: 'var(--s6)', textAlign: 'center' }}>
                    <p className="small muted">No comments yet.</p>
                  </div>
                ) : (
                  <>
                    {pins.map((pin, i) => (
                      <div key={pin.id} style={{
                        padding: 'var(--s3) var(--s4)',
                        borderBottom: '1px solid var(--border)',
                        opacity: pin.is_resolved ? 0.55 : 1,
                      }}>
                        <div className="row" style={{ gap: 'var(--s2)', alignItems: 'flex-start' }}>
                          <span style={{
                            width: 20, height: 20, borderRadius: '50%',
                            background: pin.is_resolved ? 'var(--success)' : 'var(--flame)',
                            color: 'white', fontSize: 11, fontWeight: 700,
                            display: 'grid', placeItems: 'center', flexShrink: 0,
                          }}>
                            {i + 1}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="small" style={{
                              textDecoration: pin.is_resolved ? 'line-through' : 'none',
                            }}>
                              {pin.body}
                            </div>
                            <div className="tiny muted" style={{ marginTop: 2 }}>
                              {pin.author_name} · {timeAgo(pin.created_at)}
                            </div>
                          </div>
                          <button
                            onClick={() => resolveAnnotation(pin)}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: 2, fontSize: 11 }}
                          >
                            {pin.is_resolved ? 'Reopen' : 'Resolve'}
                          </button>
                        </div>
                      </div>
                    ))}

                    {generalComments.map((comment) => (
                      <div key={comment.id} style={{ padding: 'var(--s3) var(--s4)', borderBottom: '1px solid var(--border)' }}>
                        <div className="small">{comment.body}</div>
                        <div className="tiny muted" style={{ marginTop: 2 }}>
                          {comment.author_name} · {timeAgo(comment.created_at)}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>

              <div className="card-footer" style={{ display: 'block' }}>
                <Textarea
                  value={generalComment}
                  onChange={(e) => setGeneralComment(e.target.value)}
                  placeholder="General comment…"
                  rows={2}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={saveGeneralComment}
                  disabled={!generalComment.trim()}
                  style={{ marginTop: 'var(--s2)' }}
                >
                  Add comment
                </Button>
              </div>
            </div>

            {version && (
              <div className="card card-pad" style={{ marginTop: 'var(--s3)' }}>
                <div className="tiny muted">Version {version.version}</div>
                <div className="small">Uploaded by {version.uploaded_by_name || '—'}</div>
                <div className="tiny muted">{date(version.created_at)}</div>
                {version.notes && <p className="tiny" style={{ marginTop: 'var(--s2)' }}>{version.notes}</p>}
              </div>
            )}
          </aside>
        </div>
      )}

      {showUpload && (
        <Modal
          open
          onClose={() => setShowUpload(false)}
          title="Upload a new version"
          footer={
            <>
              <Button variant="outline" onClick={() => setShowUpload(false)}>Cancel</Button>
              <Button variant="primary" onClick={uploadVersion} loading={uploading} disabled={!newVersionMedia}>
                Upload version {(deliverable?.current_version || 0) + 1}
              </Button>
            </>
          }
        >
          {deliverable?.revision_limit && deliverable.revision_count >= deliverable.revision_limit && (
            <div className="alert alert-warning" style={{ marginBottom: 'var(--s5)' }}>
              This deliverable has used its {deliverable.revision_limit} included revisions.
              Uploading another version is billable — make sure the client has agreed.
            </div>
          )}
          <Field label="File">
            <MediaPicker value={newVersionMedia} onChange={setNewVersionMedia} kind="all" />
          </Field>
        </Modal>
      )}

      <style>{`
        @media (max-width: 900px) {
          .proof-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </Modal>
  );
}
