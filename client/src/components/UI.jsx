import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { statusTone, humanise, initials } from '../utils/format';
import { useApp } from '../context/AppContext';

/* ==========================================================================
   Shared UI primitives used across the public site, admin and client portal.
   ========================================================================== */

export function Button({ variant = 'primary', size, loading, icon, children, className = '', ...props }) {
  const classes = [
    'btn', `btn-${variant}`,
    size ? `btn-${size}` : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button className={classes} disabled={loading || props.disabled} {...props}>
      {loading ? <span className="spinner" /> : icon}
      <span>{children}</span>
    </button>
  );
}

export function Badge({ status, tone, children, dot }) {
  const resolved = tone || statusTone(status);
  return (
    <span className={`badge badge-${resolved}`}>
      {dot && <span className="dot" style={{ background: 'currentColor' }} />}
      {children || humanise(status)}
    </span>
  );
}

export function Card({ children, hover, pad, className = '', ...props }) {
  return (
    <div
      className={`card ${hover ? 'card-hover' : ''} ${pad ? 'card-pad' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function Field({ label, required, hint, error, children }) {
  return (
    <label className="field">
      {label && (
        <span className="field-label">
          {label}{required && <span className="req">*</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

export function Input({ error, ...props }) {
  return <input className={`input ${error ? 'input-error' : ''}`} {...props} />;
}

export function Textarea({ error, ...props }) {
  return <textarea className={`textarea ${error ? 'input-error' : ''}`} {...props} />;
}

export function Select({ options = [], placeholder, error, children, ...props }) {
  return (
    <select className={`select ${error ? 'input-error' : ''}`} {...props}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value ?? opt} value={opt.value ?? opt}>
          {opt.label ?? humanise(opt)}
        </option>
      ))}
      {children}
    </select>
  );
}

export function Avatar({ src, first, last, name, size = '' }) {
  const [failed, setFailed] = useState(false);
  const label = name
    ? name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : initials(first, last);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name || `${first || ''} ${last || ''}`.trim()}
        className={`avatar ${size ? `avatar-${size}` : ''}`}
        onError={() => setFailed(true)}
      />
    );
  }
  return <span className={`avatar ${size ? `avatar-${size}` : ''}`}>{label}</span>;
}

export function Progress({ value, tone }) {
  const pct = Math.min(100, Math.max(0, Number(value || 0)));
  const color = tone === 'danger' ? 'var(--danger)'
    : tone === 'warning' ? 'var(--warning)'
    : tone === 'success' ? 'var(--success)'
    : 'var(--flame)';
  return (
    <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress-bar" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function Spinner({ center }) {
  const spinner = <span className="spinner" style={{ color: 'var(--flame)' }} />;
  if (!center) return spinner;
  return <div style={{ display: 'grid', placeItems: 'center', padding: 'var(--s16)' }}>{spinner}</div>;
}

/**
 * Nothing-here state. Uses the empty-state illustration when one has been
 * uploaded, and falls back to the emoji any caller already passes.
 */
export function Empty({ icon, title, description, action }) {
  const { slot } = useApp();
  const art = slot('empty-state');
  return (
    <div className="empty-state">
      {art
        ? <img src={art} alt="" style={{ width: 'min(260px, 60%)', height: 'auto', marginBottom: 'var(--s4)', opacity: 0.9 }} />
        : icon && <div style={{ fontSize: '2.5rem', marginBottom: 'var(--s4)', opacity: 0.4 }}>{icon}</div>}
      <h4>{title}</h4>
      {description && <p className="small" style={{ maxWidth: 420, margin: '0 auto var(--s5)' }}>{description}</p>}
      {action}
    </div>
  );
}

export function Alert({ tone = 'info', title, children }) {
  return (
    <div className={`alert alert-${tone}`}>
      <div>
        {title && <strong style={{ display: 'block', marginBottom: 2 }}>{title}</strong>}
        {children}
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, size, children, footer }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className={`modal ${size ? `modal-${size}` : ''}`} ref={ref} role="dialog" aria-modal="true">
        <div className="modal-header">
          <h4>{title}</h4>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function ConfirmDialog({ open, onCancel, onConfirm, title, message, confirmLabel = 'Delete', tone = 'danger', loading }) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title || 'Are you sure?'}
      footer={
        <>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant={tone} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      }
    >
      <p>{message || 'This action cannot be undone.'}</p>
    </Modal>
  );
}

/**
 * Tabs.
 *
 * Above `wrapAfter` the row wraps onto multiple lines instead of scrolling
 * sideways — a horizontal scroll strip hides the tabs at the end, and people
 * do not find what they cannot see. On narrow screens any tab set collapses
 * to a select, which is both smaller and fully keyboard accessible.
 */
export function Tabs({ tabs, active, onChange, wrapAfter = 7 }) {
  const wrap = tabs.length > wrapAfter;
  const current = tabs.find((t) => t.key === active);

  return (
    <>
      <div className={`tabs ${wrap ? 'tabs--wrap' : ''}`} role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={active === tab.key}
            className={`tab ${active === tab.key ? 'tab-active' : ''}`}
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="tab__count">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Same control, collapsed for small screens */}
      <label className="tabs-select">
        <span className="field-label">Section</span>
        <select
          className="select"
          value={active}
          onChange={(e) => onChange(e.target.value)}
        >
          {tabs.map((tab) => (
            <option key={tab.key} value={tab.key}>
              {tab.label}{tab.count !== undefined ? ` (${tab.count})` : ''}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

export function Pagination({ page, pages, total, onChange }) {
  if (!pages || pages <= 1) return null;

  const window = [];
  const from = Math.max(1, page - 2);
  const to = Math.min(pages, page + 2);
  for (let i = from; i <= to; i += 1) window.push(i);

  return (
    <div className="row-between" style={{ padding: 'var(--s4) var(--s6)', borderTop: '1px solid var(--border)' }}>
      <span className="small muted">
        Page {page} of {pages}{total !== undefined && ` · ${total} record${total === 1 ? '' : 's'}`}
      </span>
      <div className="row" style={{ gap: 4 }}>
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</Button>
        {from > 1 && <span className="muted small">…</span>}
        {window.map((n) => (
          <Button
            key={n}
            size="sm"
            variant={n === page ? 'dark' : 'ghost'}
            onClick={() => onChange(n)}
          >
            {n}
          </Button>
        ))}
        {to < pages && <span className="muted small">…</span>}
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', delay = 300 }) {
  const [local, setLocal] = useState(value || '');
  const timer = useRef(null);

  useEffect(() => { setLocal(value || ''); }, [value]);

  const handle = (next) => {
    setLocal(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(next), delay);
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 380 }}>
      <input
        className="input"
        style={{ paddingLeft: '2.25rem' }}
        value={local}
        placeholder={placeholder}
        onChange={(e) => handle(e.target.value)}
      />
      <span style={{
        position: 'absolute', left: '0.8rem', top: '50%',
        transform: 'translateY(-50%)', color: 'var(--ink-400)', pointerEvents: 'none',
      }}>
        ⌕
      </span>
    </div>
  );
}

export function Toasts({ toasts, onDismiss }) {
  if (!toasts?.length) return null;
  return createPortal(
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone !== 'default' ? `toast-${t.tone}` : ''}`}>
          <span style={{ flex: 1 }}>{t.message}</span>
          <button
            onClick={() => onDismiss(t.id)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.7 }}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
}

/** Table with sensible loading and empty states. */
export function DataTable({ columns, rows, loading, onRowClick, empty, selectable, selected = [], onSelect }) {
  if (loading) {
    return (
      <div style={{ padding: 'var(--s6)' }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 44, marginBottom: 8 }} />
        ))}
      </div>
    );
  }

  if (!rows?.length) {
    return empty || <Empty title="Nothing here yet" description="Records will appear once they are created." />;
  }

  const allSelected = selectable && rows.length > 0 && selected.length === rows.length;

  return (
    <div className="table-wrap">
      <table className={`table ${onRowClick ? 'table-clickable' : ''}`}>
        <thead>
          <tr>
            {selectable && (
              <th style={{ width: 40 }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => onSelect(e.target.checked ? rows.map((r) => r.id) : [])}
                  aria-label="Select all"
                />
              </th>
            )}
            {columns.map((col) => (
              <th key={col.key} className={col.align === 'right' ? 'num' : ''} style={col.width ? { width: col.width } : undefined}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} onClick={onRowClick ? () => onRowClick(row) : undefined}>
              {selectable && (
                <td onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.includes(row.id)}
                    onChange={(e) => onSelect(
                      e.target.checked
                        ? [...selected, row.id]
                        : selected.filter((id) => id !== row.id)
                    )}
                    aria-label={`Select row ${row.id}`}
                  />
                </td>
              )}
              {columns.map((col) => (
                <td key={col.key} className={col.align === 'right' ? 'num' : ''}>
                  {col.render ? col.render(row) : row[col.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Small stat tile for dashboards. */
export function StatTile({ label, value, sub, tone, icon, onClick }) {
  return (
    <Card pad hover={!!onClick} onClick={onClick} className={onClick ? 'card-hover' : ''}
      style={onClick ? { cursor: 'pointer' } : undefined}>
      <div className="row-between" style={{ marginBottom: 'var(--s2)' }}>
        <span className="small muted">{label}</span>
        {icon && <span style={{ opacity: 0.5 }}>{icon}</span>}
      </div>
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)',
        fontWeight: 700, lineHeight: 1.2,
        color: tone === 'danger' ? 'var(--danger)'
          : tone === 'success' ? 'var(--success)'
          : 'var(--ink-900)',
      }}>
        {value}
      </div>
      {sub && <div className="tiny muted" style={{ marginTop: 4 }}>{sub}</div>}
    </Card>
  );
}

/** Debounced value hook used by search inputs and filters. */
export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Fetch helper with loading/error state and a manual refetch. */
export function useFetch(path, deps = [], options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { api } = options;

  const load = useCallback(async () => {
    if (!path) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const mod = api || (await import('../utils/api')).api;
      const res = await mod.get(path);
      setData(res);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error, refetch: load, setData };
}
