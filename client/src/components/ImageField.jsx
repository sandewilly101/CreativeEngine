import { useRef, useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';
import { useApp } from '../context/AppContext';
import { fileSize } from '../utils/format';
import Icon from './Icons';
import { MediaBrowser } from './MediaPicker';

/**
 * Image field with drag-and-drop.
 *
 * Replaces the old "Choose → modal → browse the whole library" flow. Drop a
 * file onto the field, or click to pick one from the device, and it uploads
 * immediately — a half-finished form never loses an upload that way, and the
 * file is in the library for reuse straight away.
 *
 * Picking from the existing library is still there, one click away, for the
 * common case of reusing a photograph that is already uploaded.
 */
const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/gif,image/svg+xml';
const MAX_MB = 50;

export default function ImageField({
  value,
  onChange,
  label,
  hint = 'Drop an image here, or click to choose one from your device.',
  ratio,
}) {
  const [preview, setPreview] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const inputRef = useRef(null);
  const { toast } = useApp();

  // Resolve the stored id into something to look at.
  useEffect(() => {
    if (!value) { setPreview(null); return undefined; }
    let cancelled = false;
    api.get(`/media/${value}`)
      .then((res) => { if (!cancelled) setPreview(res.data); })
      .catch(() => { if (!cancelled) setPreview(null); });
    return () => { cancelled = true; };
  }, [value]);

  const upload = useCallback(async (files) => {
    const file = files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast('That is not an image file', 'error');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast(`That image is ${fileSize(file.size)} — the limit is ${MAX_MB} MB`, 'error');
      return;
    }

    setBusy(true);
    try {
      const res = await api.upload([file]);
      const media = res.data?.[0];
      if (media) {
        onChange(media.id);
        toast(media.was_duplicate ? 'That image was already in the library' : 'Image uploaded', 'success');
      }
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }, [onChange, toast]);

  return (
    <div className="imgfield">
      {label && <span className="field-label">{label}</span>}

      <div
        className={`imgfield__drop ${dragging ? 'is-drag' : ''} ${preview ? 'has-image' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          upload(e.dataTransfer.files);
        }}
        onClick={() => !busy && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); }
        }}
      >
        {busy ? (
          <div className="imgfield__state">
            <span className="spinner" />
            <span>Uploading…</span>
          </div>
        ) : preview ? (
          <>
            <img src={preview.thumb_url || preview.public_url} alt="" />
            <div className="imgfield__over">
              <Icon name="media" size={18} />
              <span>Drop a new image, or click to replace</span>
            </div>
          </>
        ) : (
          <div className="imgfield__state">
            <Icon name="media" size={26} />
            <span className="imgfield__hint">{hint}</span>
            {ratio && <span className="imgfield__ratio">{ratio}</span>}
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => { upload(e.target.files); e.target.value = ''; }}
      />

      <div className="imgfield__actions">
        <button type="button" className="imgfield__link" onClick={() => setBrowsing(true)}>
          Choose from library
        </button>
        {value && (
          <button
            type="button"
            className="imgfield__link imgfield__link--danger"
            onClick={() => onChange(null)}
          >
            Remove
          </button>
        )}
        {preview && (
          <span className="imgfield__meta">
            {preview.width}×{preview.height} · {fileSize(preview.size_bytes)}
          </span>
        )}
      </div>

      <MediaBrowser
        open={browsing}
        onClose={() => setBrowsing(false)}
        kind="image"
        onSelect={(media) => { onChange(media.id); setBrowsing(false); }}
      />

      <style>{`
        .imgfield { margin-bottom: var(--s5); }

        .imgfield__drop {
          position: relative;
          display: grid; place-items: center;
          min-height: 150px;
          padding: var(--s4);
          border: 2px dashed var(--border-strong);
          border-radius: var(--r-md);
          background: var(--surface);
          cursor: pointer;
          overflow: clip;
          transition: border-color var(--fast) var(--ease),
                      background var(--fast) var(--ease);
        }
        .imgfield__drop:hover { border-color: var(--ink-400); }
        .imgfield__drop.is-drag {
          border-color: var(--primary-deep);
          background: var(--primary-tint);
        }
        .imgfield__drop.has-image { padding: 0; border-style: solid; min-height: 0; }
        .imgfield__drop.has-image img {
          width: 100%; max-height: 220px; object-fit: cover; display: block;
        }

        .imgfield__state {
          display: flex; flex-direction: column; align-items: center;
          gap: var(--s2); text-align: center; color: var(--muted);
        }
        .imgfield__hint { font-size: 13.5px; max-width: 30ch; line-height: 1.5; }
        .imgfield__ratio {
          font-size: 11.5px; font-weight: 600;
          background: var(--surface-2); color: var(--ink-2);
          padding: 3px 9px; border-radius: var(--r-pill);
        }

        /* Hover hint sits over the current image rather than replacing it. */
        .imgfield__over {
          position: absolute; inset: 0;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 6px;
          background: rgba(25, 25, 25, .72);
          color: #fff; font-size: 13px;
          opacity: 0;
          transition: opacity var(--fast) var(--ease);
        }
        .imgfield__drop.has-image:hover .imgfield__over,
        .imgfield__drop.is-drag .imgfield__over { opacity: 1; }

        .imgfield__actions {
          display: flex; align-items: center; gap: var(--s4);
          margin-top: var(--s2); flex-wrap: wrap;
        }
        .imgfield__link {
          background: none; border: 0; padding: 0; cursor: pointer;
          font-family: var(--ui); font-size: 13px; font-weight: 500;
          color: var(--ink-2); text-decoration: underline;
          text-underline-offset: 3px;
        }
        .imgfield__link:hover { color: var(--flame); }
        .imgfield__link--danger:hover { color: var(--danger); }
        .imgfield__meta { font-size: 12px; color: var(--muted); margin-left: auto; }
      `}</style>
    </div>
  );
}
