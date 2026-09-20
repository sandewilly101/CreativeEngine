import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { fileSize, date, timeAgo, number } from '../../utils/format';
import {
  Card, Button, Spinner, Empty, SearchInput, Modal, Field,
  Input, Textarea, Select, ConfirmDialog, StatTile, Pagination,
} from '../../components/UI';

export default function MediaLibrary() {
  const [items, setItems] = useState([]);
  const [folders, setFolders] = useState([]);
  const [stats, setStats] = useState(null);
  const [slots, setSlots] = useState([]);
  const [showSlots, setShowSlots] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('');
  const [folderId, setFolderId] = useState('');
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [newFolder, setNewFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [selected, setSelected] = useState([]);

  const inputRef = useRef(null);
  const { toast } = useApp();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [media, folderRes, statsRes, slotRes] = await Promise.all([
        api.get(`/media${api.qs({ page, limit: 48, search, kind, folder_id: folderId })}`),
        api.get('/media/folders').catch(() => ({ data: [] })),
        api.get('/media/stats').catch(() => null),
        api.get('/media/slots').catch(() => ({ data: [] })),
      ]);
      setItems(media.data || []);
      setPagination(media.pagination || { page: 1, pages: 1, total: 0 });
      setFolders(folderRes.data || []);
      setStats(statsRes?.data || null);
      setSlots(slotRes.data || []);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, kind, folderId, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, kind, folderId]);

  const upload = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const res = await api.upload([...files], { folder_id: folderId || undefined });
      toast(res.message, 'success');
      const duplicates = res.data.filter((d) => d.was_duplicate).length;
      if (duplicates > 0) {
        toast(`${duplicates} file(s) already existed and were reused`, 'default');
      }
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const saveMeta = async () => {
    try {
      await api.patch(`/media/${editing.id}`, {
        title: editing.title,
        alt_text: editing.alt_text,
        caption: editing.caption,
        credit: editing.credit,
        folder_id: editing.folder_id || null,
        is_public: editing.is_public ? 1 : 0,
      });
      toast('Saved', 'success');
      setEditing(null);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/media/${deleting.id}?permanent=true`);
      toast('File deleted', 'success');
      setDeleting(null);
      load();
    } catch (err) {
      // The API refuses if the asset is still in use, unless forced.
      if (err.status === 409) {
        if (window.confirm(`${err.message}\n\nDelete it anyway?`)) {
          await api.delete(`/media/${deleting.id}?permanent=true&force=true`);
          toast('File deleted', 'success');
          setDeleting(null);
          load();
          return;
        }
      } else {
        toast(err.message, 'error');
      }
      setDeleting(null);
    }
  };

  const createFolder = async () => {
    try {
      await api.post('/media/folders', { name: folderName });
      toast('Folder created', 'success');
      setNewFolder(false);
      setFolderName('');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const moveSelected = async (targetFolderId) => {
    try {
      await api.post('/media/bulk/move', { ids: selected, folder_id: targetFolderId || null });
      toast(`${selected.length} file(s) moved`, 'success');
      setSelected([]);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="stack-lg">
      <div className="row-between row-wrap">
        <div>
          <h2>Media library</h2>
          <p className="muted small">
            Every image, video and document used anywhere on the platform. Upload once, reuse everywhere.
          </p>
        </div>
        <div className="row" style={{ gap: 'var(--s2)' }}>
          <Button
            variant={showSlots ? 'dark' : 'outline'}
            onClick={() => setShowSlots((v) => !v)}
          >
            Image slots
          </Button>
          <Button variant="outline" onClick={() => setNewFolder(true)}>+ Folder</Button>
          <Button variant="primary" onClick={() => inputRef.current?.click()} loading={uploading}>
            Upload files
          </Button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => { upload(e.target.files); e.target.value = ''; }}
      />

      {showSlots && (
        <Card>
          <div className="card-header">
            <div>
              <h4>Image slots</h4>
              <span className="tiny muted">
                Upload a file with the exact name shown and that position on the site
                updates. Deleting it reverts to the supplied photograph.
              </span>
            </div>
            <span className="badge badge-neutral">
              {slots.filter((s) => s.custom).length} of {slots.length} customised
            </span>
          </div>
          <div className="card-body">
            <div className="slot-grid">
              {slots.map((s) => (
                <div key={s.key} className={`slot ${s.custom ? 'slot--on' : ''}`}>
                  <div className="slot__thumb">
                    {s.url ? <img src={s.url} alt="" loading="lazy" /> : <span>Empty</span>}
                  </div>
                  <div className="slot__body">
                    <div className="row-between" style={{ gap: 8 }}>
                      <strong className="small">{s.label}</strong>
                      {s.custom
                        ? <span className="badge badge-brand">Custom</span>
                        : <span className="badge badge-neutral">Supplied</span>}
                    </div>
                    <code className="slot__file">{s.filename}</code>
                    <div className="tiny muted">{s.where}</div>
                    <div className="tiny muted">{s.ratio}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {stats && (
        <div className="grid grid-4">
          <StatTile label="Total files" value={number(stats.total_files)} />
          <StatTile label="Storage used" value={fileSize(stats.total_bytes)} />
          <StatTile
            label="Images"
            value={number(stats.by_kind?.find((k) => k.kind === 'image')?.count || 0)}
          />
          <StatTile
            label="Documents"
            value={number(stats.by_kind?.find((k) => k.kind === 'document')?.count || 0)}
          />
        </div>
      )}

      <Card>
        <div className="card-header" style={{ flexWrap: 'wrap' }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name, title or alt text…" />
          <div className="row row-wrap" style={{ gap: 'var(--s2)' }}>
            <select className="select" value={kind} onChange={(e) => setKind(e.target.value)} style={{ width: 'auto' }}>
              <option value="">All types</option>
              <option value="image">Images</option>
              <option value="video">Video</option>
              <option value="document">Documents</option>
              <option value="audio">Audio</option>
            </select>
            <select className="select" value={folderId} onChange={(e) => setFolderId(e.target.value)} style={{ width: 'auto' }}>
              <option value="">All folders</option>
              {folders.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.file_count})</option>)}
            </select>
            {selected.length > 0 && (
              <>
                <select
                  className="select"
                  onChange={(e) => moveSelected(e.target.value)}
                  defaultValue=""
                  style={{ width: 'auto' }}
                >
                  <option value="" disabled>Move {selected.length} to…</option>
                  <option value="">Library root</option>
                  {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                <Button variant="ghost" size="sm" onClick={() => setSelected([])}>Clear</Button>
              </>
            )}
          </div>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); upload(e.dataTransfer.files); }}
          style={{
            padding: 'var(--s6)',
            background: dragOver ? 'var(--orange-100)' : 'transparent',
            border: dragOver ? '2px dashed var(--orange-500)' : '2px dashed transparent',
            minHeight: 400,
          }}
        >
          {loading ? <Spinner center /> : items.length === 0 ? (
            <Empty
              title="Nothing here yet"
              description="Drag files anywhere in this panel, or use the Upload button."
              action={<Button variant="primary" onClick={() => inputRef.current?.click()}>Upload files</Button>}
            />
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 'var(--s4)',
            }}>
              {items.map((item) => (
                <div
                  key={item.id}
                  className="card"
                  style={{
                    border: selected.includes(item.id) ? '2px solid var(--orange-500)' : '1px solid var(--border)',
                    position: 'relative',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(item.id)}
                    onChange={(e) => setSelected(
                      e.target.checked
                        ? [...selected, item.id]
                        : selected.filter((id) => id !== item.id)
                    )}
                    style={{ position: 'absolute', top: 8, left: 8, zIndex: 2, width: 16, height: 16 }}
                    aria-label={`Select ${item.original_name}`}
                  />

                  <button
                    onClick={() => setEditing(item)}
                    style={{
                      display: 'block', width: '100%', border: 'none',
                      padding: 0, cursor: 'pointer', background: 'none',
                    }}
                  >
                    <div style={{
                      aspectRatio: '1',
                      background: item.kind === 'image'
                        ? `url(${item.thumb_url || item.public_url}) center/cover`
                        : 'var(--ink-100)',
                      display: 'grid', placeItems: 'center',
                      fontSize: 30, color: 'var(--ink-400)',
                    }}>
                      {item.kind !== 'image' && (item.kind === 'video' ? '▶' : '◫')}
                    </div>
                  </button>

                  <div style={{ padding: 'var(--s3)' }}>
                    <div className="tiny bold truncate">{item.title || item.original_name}</div>
                    <div className="row-between" style={{ marginTop: 2 }}>
                      <span style={{ fontSize: 10 }} className="muted">{fileSize(item.size_bytes)}</span>
                      {item.width && (
                        <span style={{ fontSize: 10 }} className="muted">{item.width}×{item.height}</span>
                      )}
                    </div>
                    {!item.alt_text && item.kind === 'image' && (
                      <div style={{ fontSize: 10, color: 'var(--warning)', marginTop: 2 }}>
                        No alt text
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} onChange={setPage} />
      </Card>

      {/* --------------------------------------------------------- EDIT META */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="File details"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setDeleting(editing); setEditing(null); }} style={{ color: 'var(--danger)' }}>
              Delete
            </Button>
            <div className="spacer" />
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="primary" onClick={saveMeta}>Save</Button>
          </>
        }
      >
        {editing && (
          <div style={{ display: 'grid', gridTemplateColumns: '240px minmax(0,1fr)', gap: 'var(--s6)' }} className="media-edit">
            <div>
              {editing.kind === 'image' ? (
                <img
                  src={editing.public_url}
                  alt={editing.alt_text || ''}
                  style={{ width: '100%', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
                />
              ) : (
                <div style={{
                  aspectRatio: '1', background: 'var(--ink-100)',
                  display: 'grid', placeItems: 'center', fontSize: 40,
                  borderRadius: 'var(--radius)',
                }}>
                  {editing.kind === 'video' ? '▶' : '◫'}
                </div>
              )}

              <div className="stack tiny muted" style={{ gap: 4, marginTop: 'var(--s3)' }}>
                <div>{editing.original_name}</div>
                <div>{fileSize(editing.size_bytes)} · {editing.mime_type}</div>
                {editing.width && <div>{editing.width} × {editing.height} px</div>}
                <div>Uploaded {timeAgo(editing.created_at)}</div>
                {editing.uploader_first && <div>by {editing.uploader_first} {editing.uploader_last}</div>}
              </div>

              <a
                href={editing.public_url}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline btn-sm btn-block"
                style={{ marginTop: 'var(--s3)' }}
              >
                Open original ↗
              </a>
            </div>

            <div>
              <Field label="Title">
                <Input value={editing.title || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </Field>

              <Field
                label="Alt text"
                hint="Describe the image for screen readers and search engines. Worth doing on anything public."
              >
                <Input
                  value={editing.alt_text || ''}
                  onChange={(e) => setEditing({ ...editing, alt_text: e.target.value })}
                />
              </Field>

              <Field label="Caption">
                <Textarea
                  value={editing.caption || ''}
                  onChange={(e) => setEditing({ ...editing, caption: e.target.value })}
                  rows={2}
                />
              </Field>

              <Field label="Credit" hint="Photographer or source, where relevant">
                <Input value={editing.credit || ''} onChange={(e) => setEditing({ ...editing, credit: e.target.value })} />
              </Field>

              <Field label="Folder">
                <Select
                  value={editing.folder_id || ''}
                  onChange={(e) => setEditing({ ...editing, folder_id: e.target.value })}
                  placeholder="Library root"
                  options={folders.map((f) => ({ value: f.id, label: f.name }))}
                />
              </Field>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={!!editing.is_public}
                  onChange={(e) => setEditing({ ...editing, is_public: e.target.checked ? 1 : 0 })}
                />
                <span>
                  <span className="bold small">Public asset</span>
                  <div className="tiny muted">Untick for client-confidential files</div>
                </span>
              </label>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={newFolder}
        onClose={() => setNewFolder(false)}
        title="New folder"
        footer={
          <>
            <Button variant="outline" onClick={() => setNewFolder(false)}>Cancel</Button>
            <Button variant="primary" onClick={createFolder} disabled={!folderName.trim()}>Create</Button>
          </>
        }
      >
        <Field label="Folder name" required>
          <Input value={folderName} onChange={(e) => setFolderName(e.target.value)} autoFocus />
        </Field>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete this file permanently?"
        message="The file is removed from disk. Anything using it will show a broken image."
        confirmLabel="Delete permanently"
      />

      <style>{`
        .slot-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: var(--s4);
        }
        .slot {
          display: flex; gap: var(--s4);
          padding: var(--s3);
          border: 1px solid var(--stroke);
          border-radius: var(--r-md);
          background: var(--white);
        }
        .slot--on { border-color: var(--primary); box-shadow: 0 0 0 2px var(--primary-tint); }
        .slot__thumb {
          width: 84px; height: 62px; flex: none;
          border-radius: var(--r-sm); overflow: clip;
          background: var(--surface-2);
          display: grid; place-items: center;
          font-size: 11px; color: var(--ink-400);
        }
        .slot__thumb img { width: 100%; height: 100%; object-fit: cover; }
        .slot__body { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
        .slot__file {
          font-family: ui-monospace, Menlo, Consolas, monospace;
          font-size: 11.5px;
          background: var(--surface); color: var(--flame-deep);
          padding: 2px 6px; border-radius: 4px;
          align-self: flex-start;
          word-break: break-all;
        }

        @media (max-width: 768px) {
          .media-edit { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
