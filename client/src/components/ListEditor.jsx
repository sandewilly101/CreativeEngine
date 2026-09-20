import { Button } from './UI';
import Icon from './Icons';

/**
 * Add/remove line editor, replacing raw JSON textareas.
 *
 * Asking an agency owner to hand-write `[{"label":"Brand identity",
 * "included":true}]` is asking them to debug a syntax error at 11pm. The
 * shape is known from the schema, so the form can present it as rows of
 * ordinary inputs and assemble the JSON itself.
 *
 * Two shapes are handled:
 *   - `itemFields` omitted: a plain array of strings (deliverables, exclusions)
 *   - `itemFields` given:   an array of objects, one input per named part
 */
export default function ListEditor({ value, onChange, itemFields, addLabel = 'Add item', placeholder }) {
  // The stored value may still arrive as a JSON string from an older record.
  const rows = normalise(value);

  const blank = () => {
    if (!itemFields) return '';
    const row = {};
    for (const field of itemFields) row[field.name] = field.default ?? '';
    return row;
  };

  const update = (next) => onChange(next);
  const setRow = (index, row) => update(rows.map((r, i) => (i === index ? row : r)));
  const removeRow = (index) => update(rows.filter((_, i) => i !== index));

  const move = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    update(next);
  };

  return (
    <div className="lister">
      {rows.length === 0 && (
        <p className="lister__empty">Nothing added yet.</p>
      )}

      {rows.map((row, index) => (
        <div key={index} className="lister__row">
          <div className="lister__order">
            <button
              type="button"
              className="lister__nudge"
              onClick={() => move(index, -1)}
              disabled={index === 0}
              aria-label="Move up"
            >
              <Icon name="chevronUp" size={13} />
            </button>
            <button
              type="button"
              className="lister__nudge"
              onClick={() => move(index, 1)}
              disabled={index === rows.length - 1}
              aria-label="Move down"
            >
              <Icon name="chevronDown" size={13} />
            </button>
          </div>

          <div className="lister__inputs">
            {itemFields ? itemFields.map((field) => (
              field.type === 'checkbox' ? (
                <label key={field.name} className="lister__check">
                  <input
                    type="checkbox"
                    checked={!!row?.[field.name]}
                    onChange={(e) => setRow(index, { ...row, [field.name]: e.target.checked })}
                  />
                  <span>{field.label}</span>
                </label>
              ) : field.type === 'select' ? (
                <select
                  key={field.name}
                  className="select lister__input"
                  value={row?.[field.name] ?? ''}
                  onChange={(e) => setRow(index, { ...row, [field.name]: e.target.value })}
                  style={{ flex: field.flex ?? 1 }}
                >
                  {(field.options || []).map((opt) => (
                    <option key={opt.value ?? opt} value={opt.value ?? opt}>{opt.label ?? opt}</option>
                  ))}
                </select>
              ) : (
                <input
                  key={field.name}
                  className="input lister__input"
                  type={field.type === 'number' ? 'number' : 'text'}
                  value={row?.[field.name] ?? ''}
                  placeholder={field.label}
                  onChange={(e) => setRow(index, {
                    ...row,
                    [field.name]: field.type === 'number'
                      ? (e.target.value === '' ? '' : Number(e.target.value))
                      : e.target.value,
                  })}
                  style={{ flex: field.flex ?? 1 }}
                />
              )
            )) : (
              <input
                className="input lister__input"
                value={typeof row === 'string' ? row : ''}
                placeholder={placeholder || 'Type a line…'}
                onChange={(e) => setRow(index, e.target.value)}
                style={{ flex: 1 }}
              />
            )}
          </div>

          <button
            type="button"
            className="lister__remove"
            onClick={() => removeRow(index)}
            aria-label="Remove"
          >
            <Icon name="trash" size={14} />
          </button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => update([...rows, blank()])}
      >
        + {addLabel}
      </Button>

      <style>{`
        .lister { display: flex; flex-direction: column; gap: var(--s2); align-items: flex-start; }
        .lister__empty { font-size: 13px; color: var(--muted); margin: 0 0 var(--s1); }

        .lister__row {
          display: flex; align-items: center; gap: var(--s2);
          width: 100%;
        }
        .lister__order { display: flex; flex-direction: column; gap: 2px; flex: none; }
        .lister__nudge {
          width: 22px; height: 15px;
          display: grid; place-items: center;
          border: 1px solid var(--border); border-radius: 3px;
          background: var(--surface); color: var(--ink-2);
          cursor: pointer; padding: 0;
        }
        .lister__nudge:hover:not(:disabled) { background: var(--primary); color: var(--on-primary); }
        .lister__nudge:disabled { opacity: .3; cursor: default; }

        .lister__inputs { display: flex; gap: var(--s2); flex: 1; min-width: 0; align-items: center; }
        .lister__input { min-width: 0; }

        .lister__check {
          display: flex; align-items: center; gap: 6px;
          font-size: 12.5px; color: var(--ink-2); white-space: nowrap; flex: none;
        }

        .lister__remove {
          flex: none;
          width: 30px; height: 30px;
          display: grid; place-items: center;
          border: 1px solid var(--border); border-radius: var(--radius-sm);
          background: var(--surface); color: var(--muted);
          cursor: pointer;
        }
        .lister__remove:hover { border-color: var(--danger); color: var(--danger); }

        @media (max-width: 640px) {
          .lister__inputs { flex-wrap: wrap; }
          .lister__input { flex: 1 1 100% !important; }
        }
      `}</style>
    </div>
  );
}

/** Accept an array, a JSON string, or nothing at all. */
function normalise(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}
