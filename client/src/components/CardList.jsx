import { Spinner } from './UI';
import Icon from './Icons';

/**
 * Card grid for visual content — services, portfolio, team, packages,
 * testimonials, print products.
 *
 * A data table is the right shape for a ledger of invoices, where the
 * columns are what you compare. It is the wrong shape for a case study,
 * where the photograph *is* the record: you recognise the job by its cover
 * long before you read its title. So these get thumbnails, and the actions
 * that matter — reorder, edit, delete, view on the live site — sit on the
 * card itself rather than behind a horizontal scroll.
 */
export default function CardList({
  rows,
  loading,
  card,
  onEdit,
  onDelete,
  onRestore,
  onMove,
  viewUrl,
  showTrash = false,
  canEdit = true,
  canDelete = true,
  reorderable = false,
  empty,
}) {
  if (loading) return <Spinner center />;
  if (!rows.length) return empty ?? null;

  return (
    <div className="cardlist">
      {rows.map((row, index) => {
        const item = card(row);
        const url = !showTrash && viewUrl ? viewUrl(row) : null;

        return (
          <article key={row.id} className={`ccard ${item.dimmed ? 'is-dim' : ''}`}>
            <div className="ccard__media">
              {item.image ? (
                <img src={item.image} alt="" loading="lazy" />
              ) : (
                <span className="ccard__initial">
                  {item.initial ?? (item.title || '?').charAt(0).toUpperCase()}
                </span>
              )}
              {item.badge && <span className="ccard__badge">{item.badge}</span>}
            </div>

            <div className="ccard__body">
              <h3 className="ccard__title">{item.title}</h3>
              {item.subtitle && <p className="ccard__sub">{item.subtitle}</p>}

              {item.meta?.length > 0 && (
                <div className="ccard__meta">
                  {item.meta.filter(Boolean).map((bit, i) => (
                    <span key={i}>{bit}</span>
                  ))}
                </div>
              )}

              <div className="ccard__actions">
                {showTrash ? (
                  <button type="button" className="ccard__btn ccard__btn--wide" onClick={() => onRestore(row)}>
                    <Icon name="restore" size={14} /> Restore
                  </button>
                ) : (
                  <>
                    {reorderable && (
                      <>
                        <button
                          type="button"
                          className="ccard__btn"
                          onClick={() => onMove(index, -1)}
                          disabled={index === 0}
                          title="Move up"
                          aria-label="Move up"
                        >
                          <Icon name="arrowUp" size={14} />
                        </button>
                        <button
                          type="button"
                          className="ccard__btn"
                          onClick={() => onMove(index, 1)}
                          disabled={index === rows.length - 1}
                          title="Move down"
                          aria-label="Move down"
                        >
                          <Icon name="arrowDown" size={14} />
                        </button>
                      </>
                    )}

                    {canEdit && (
                      <button type="button" className="ccard__btn" onClick={() => onEdit(row)} title="Edit" aria-label="Edit">
                        <Icon name="edit" size={14} />
                      </button>
                    )}

                    {url && (
                      <a
                        className="ccard__btn"
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        title="View on the site"
                        aria-label="View on the site"
                      >
                        <Icon name="external" size={14} />
                      </a>
                    )}

                    {canDelete && (
                      <button
                        type="button"
                        className="ccard__btn ccard__btn--danger"
                        onClick={() => onDelete(row)}
                        title="Delete"
                        aria-label="Delete"
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </article>
        );
      })}

      <style>{`
        .cardlist {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
          gap: var(--s4);
          padding: var(--s4);
        }

        .ccard {
          display: flex; gap: var(--s3);
          padding: var(--s3);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface);
          transition: border-color 140ms var(--ease), box-shadow 140ms var(--ease);
        }
        .ccard:hover { border-color: var(--border-strong); box-shadow: var(--shadow-sm); }
        /* Unpublished records stay visible but read as switched off. */
        .ccard.is-dim { opacity: .55; }

        .ccard__media {
          position: relative; flex: none;
          width: 64px; height: 64px;
          border-radius: var(--radius-sm);
          overflow: hidden;
          background: var(--ink-100);
          display: grid; place-items: center;
        }
        .ccard__media img { width: 100%; height: 100%; object-fit: cover; }
        .ccard__initial {
          font-family: var(--display); font-size: 24px; font-weight: 700;
          color: var(--ink-400);
        }
        .ccard__badge {
          position: absolute; inset: auto 0 0 0;
          background: var(--primary); color: var(--on-primary);
          font-size: 9.5px; font-weight: 700; letter-spacing: .04em;
          text-transform: uppercase; text-align: center;
          padding: 2px 0;
        }

        .ccard__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
        .ccard__title {
          font-size: 14.5px; font-weight: 600; line-height: 1.35;
          margin: 0;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .ccard__sub {
          font-size: 12.5px; color: var(--muted); line-height: 1.45; margin: 0;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .ccard__meta {
          display: flex; flex-wrap: wrap; gap: 5px;
          margin-top: 3px;
        }
        .ccard__meta > span {
          font-size: 11px; font-weight: 500;
          background: var(--ink-100); color: var(--ink-2);
          padding: 2px 7px; border-radius: var(--radius-full);
          white-space: nowrap;
        }

        .ccard__actions { display: flex; gap: 4px; margin-top: auto; padding-top: var(--s2); }
        .ccard__btn {
          width: 28px; height: 28px; flex: none;
          display: grid; place-items: center;
          border: 1px solid var(--border); border-radius: var(--radius-sm);
          background: var(--white); color: var(--ink-2);
          cursor: pointer; padding: 0;
          text-decoration: none;
          transition: background 120ms var(--ease), color 120ms var(--ease),
                      border-color 120ms var(--ease);
        }
        .ccard__btn:hover:not(:disabled) {
          background: var(--primary); color: var(--on-primary);
          border-color: var(--primary);
        }
        .ccard__btn:disabled { opacity: .35; cursor: default; }
        .ccard__btn--danger:hover { background: var(--danger); color: #fff; border-color: var(--danger); }
        .ccard__btn--wide {
          width: auto; gap: 6px; padding: 0 12px;
          font-family: var(--ui); font-size: 12.5px; font-weight: 500;
        }
      `}</style>
    </div>
  );
}
