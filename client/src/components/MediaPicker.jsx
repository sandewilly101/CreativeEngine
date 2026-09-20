import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../utils/api';
import { useApp } from '../context/AppContext';
import { fileSize, date } from '../utils/format';
import { Modal, Button, Spinner, Empty, SearchInput } from './UI';

/**
 * Pick an asset from the media library, or upload one from the device.
 * Used by every form that references an image, video or document.
 */
export default function MediaPicker({ value, onChange, kind = 'image', multiple = false }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(null);

  // Resolve the currently selected id into a preview.
  useEffect(() => {
    if (!value) { setPreview(null); return; }
    let cancelled = false;
    api.get(`/media/${value}`)
      .then((res) => { if (!cancelled) setPreview(res.data); })
      .catch(() => { if (!cancelled) setPreview(null); });
    return () => { cancelled = true; };
  }, [value]);

  return (
    <>
      <div className="row" style={{ gap: 'var(--s3)' }}>
        {preview ? (
          <div className="row" style={{ gap: 'var(--s3)', flex: 1 }}>
            {preview.kind === 'image' ? (
              <img
                src={preview.thumb_url || preview.public_url}
                alt={preview.alt_text || preview.original_name}
                style={{
                  width: 64, height: 64, objectFit: 'cover',
                  borderRadius: 'var(--radius)', border: '1px solid var(--border)',
                }}
              />
            ) : (
              <div style={{
                width: 64, height: 64, borderRadius: 'var(--radius)',
                background: 'var(--ink-100)', display: 'grid', placeItems: 'center',
                fontSize: 22,
              }}>
                {preview.kind === 'video' ? '▶' : '◫'}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="small bold truncate">{preview.title || preview.original_name}</div>
              <div className="tiny muted">{fileSize(preview.size_bytes)}</div>
            </div>
          </div>
        ) : (
          <div style={{
            width: 64, height: 64, borderRadius: 'var(--radius)',
            background: 'var(--ink-100)', border: '1px dashed var(--border-strong)',
            display: 'grid', placeItems: 'center', color: 'var(--ink-400)',
          }}>
            +
          </div>
        )}

        <div className="row" style={{ gap: 'var(--s2)' }}>
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
            {value ? 'Change' : 'Choose'}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              Remove
            </Button>
          )}
        </div>
      </div>

      <MediaBrowser
        open={open}
        onClose={() => setOpen(false)}
        kind={kind}
        onSelect={(media) => {
          onChange(multiple ? [...(value || []), media.id] : media.id);
          setOpen(false);
        }}
      />
    </>
  );
}

/** The browsing modal, also reused by the full Media Library page. */
export function MediaBrowser({ open, onClose, onSelect, kind }) {
  const [items, setItems] = useState([]);
  const [folders, setFolders] = useState([]);
  const [folderId, setFolderId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const { toast } = useApp();

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const qs = api.qs({ kind: kind === 'all' ? '' : kind, search, folder_id: folderId, limit: 60 });
      const [media, folderRes] = await Promise.all([
        api.get(`/media${qs}`),
        api.get('/media/folders').catch(() => ({ data: [] })),
      ]);
      setItems(media.data || []);
      setFolders(folderRes.data || []);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [open, kind, search, folderId, toast]);

  useEffect(() => { load(); }, [load]);

  const upload = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const res = await api.upload([...files], { folder_id: folderId || undefined });
      toast(res.message, 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Media library" size="xl">
      <div className="row-between row-wrap" style={{ marginBottom: 'var(--s5)', gap: 'var(--s3)' }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search media…" />
        <div className="row" style={{ gap: 'var(--s2)' }}>
          <select
            className="select"
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="">All folders</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>{folder.name} ({folder.file_count})</option>
            ))}
          </select>
          <Button variant="primary" size="sm" onClick={() => inputRef.current?.click()} loading={uploading}>
            Upload
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

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          upload(e.dataTransfer.files);
        }}
        style={{
          border: dragOver ? '2px dashed var(--flame)' : '2px dashed transparent',
          borderRadius: 'var(--radius)',
          background: dragOver ? 'var(--orange-100)' : 'transparent',
          padding: dragOver ? 'var(--s4)' : 0,
          transition: 'all 140ms',
          minHeight: 300,
        }}
      >
        {loading ? <Spinner center /> : items.length === 0 ? (
          <Empty
            title="Nothing here yet"
            description="Drag files in, or use the Upload button."
            action={<Button variant="primary" onClick={() => inputRef.current?.click()}>Upload files</Button>}
          />
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 'var(--s3)',
          }}>
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect?.(item)}
                className="card card-hover"
                style={{ padding: 0, cursor: 'pointer', textAlign: 'left', border: '1px solid var(--border)' }}
              >
                <div style={{
                  aspectRatio: '1',
                  background: item.kind === 'image'
                    ? `url(${item.thumb_url || item.public_url}) center/cover`
                    : 'var(--ink-100)',
                  display: 'grid', placeItems: 'center',
                  fontSize: 28, color: 'var(--ink-400)',
                }}>
                  {item.kind !== 'image' && (item.kind === 'video' ? '▶' : '◫')}
                </div>
                <div style={{ padding: 'var(--s2) var(--s3)' }}>
                  <div className="tiny bold truncate">{item.title || item.original_name}</div>
                  <div style={{ fontSize: 10 }} className="muted">{fileSize(item.size_bytes)}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
