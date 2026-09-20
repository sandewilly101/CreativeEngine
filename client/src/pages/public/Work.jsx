import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../utils/api';
import { truncate, date } from '../../utils/format';
import { Spinner, Empty } from '../../components/UI';
import { Reveal, ZoomIn, ArrowRight } from '../../components/Motion';
import PageHero from '../../components/PageHero';

export default function Work() {
  const [items, setItems] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/public/work${filter ? `?division=${filter}` : ''}`).catch(() => ({ data: [] })),
      api.get('/public/divisions').catch(() => ({ data: [] })),
    ])
      .then(([work, divs]) => {
        setItems(work.data || []);
        setDivisions(divs.data || []);
      })
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <>
      <PageHero
        eyebrow="Our work"
        title="The proof is in what"
        highlight="we build."
        lead="Case studies across creative, digital, AI, events and production."
      />

      <section className="section">
        <div className="container">
          <Reveal className="filters" stagger={40}>
            <button className={`filter ${!filter ? 'is-on' : ''}`} onClick={() => setFilter('')}>
              Everything
            </button>
            {divisions.map((d) => (
              <button
                key={d.slug}
                className={`filter ${filter === d.slug ? 'is-on' : ''}`}
                onClick={() => setFilter(d.slug)}
              >
                {d.name}
              </button>
            ))}
          </Reveal>

          {loading ? <Spinner center /> : items.length === 0 ? (
            <Empty
              title="No case studies published yet"
              description="Work added in the admin appears here once published."
            />
          ) : (
            <Reveal className="work-grid" stagger={90}>
              {items.map((item, i) => (
                <Link
                  key={item.slug}
                  to={`/work/${item.slug}`}
                  className="wk"
                  style={{ '--accent': item.division_color || 'var(--flame)' }}
                >
                  <ZoomIn
                    src={item.cover_url || item.cover_thumb}
                    alt={item.title}
                    ratio="4x3"
                    className="wk__media"
                  />
                  <div className="wk__body">
                    {item.division_name && <span className="wk__div">{item.division_name}</span>}
                    <h3 className="h3">{item.title}</h3>
                    {item.client_name && <div className="wk__client">{item.client_name}</div>}
                    {item.summary && <p className="wk__sum">{truncate(item.summary, 118)}</p>}

                    <div className="wk__foot">
                      {item.project_date && <span>{date(item.project_date)}</span>}
                      <span className="wk__read">Read the story <ArrowRight /></span>
                    </div>
                  </div>
                </Link>
              ))}
            </Reveal>
          )}
        </div>
      </section>

      <style>{`
        .filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 44px; }
        .filter {
          padding: 10px 18px;
          border: 1px solid var(--stroke); background: var(--white);
          border-radius: var(--r-pill);
          font-family: var(--ui); font-size: 14.5px; font-weight: 500;
          color: var(--ink); cursor: pointer;
          transition: background var(--fast) var(--ease), color var(--fast) var(--ease),
                      border-color var(--fast) var(--ease);
        }
        .filter:hover { border-color: var(--ink-300); }
        .filter.is-on { background: var(--ink); color: #fff; border-color: var(--ink); }

        .work-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
          gap: 22px;
          align-items: stretch;
        }
        /* Every card is the same shape. The grid stretches rows, and the
           summary flexes, so bodies of different lengths still end on a
           shared baseline instead of leaving one card short. */
        .wk {
          display: flex; flex-direction: column; height: 100%;
          background: var(--white);
          border: 1px solid var(--stroke);
          border-radius: var(--r-md);
          overflow: clip;
          transition: transform var(--fast) var(--ease), box-shadow var(--fast) var(--ease);
        }
        .wk:hover { transform: translateY(-5px); box-shadow: var(--shadow-md); }
        .wk__body { padding: 24px 24px 22px; display: flex; flex-direction: column; gap: 9px; flex: 1; }
        .wk__div {
          font-size: 11.5px; font-weight: 600; letter-spacing: .09em;
          text-transform: uppercase; color: var(--accent);
        }
        .wk__client { font-size: 14px; color: var(--muted); }
        .wk__sum { font-size: 15px; color: var(--body); line-height: 1.6; flex: 1; }
        .wk__foot {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; margin-top: 8px; padding-top: 15px;
          border-top: 1px solid var(--line);
          font-size: 13px; color: var(--muted);
        }
        .wk__read {
          display: inline-flex; align-items: center; gap: 7px;
          font-weight: 500; color: var(--ink);
        }
        .wk:hover .wk__read svg { transform: translateX(4px); }
        .wk__read svg { transition: transform var(--fast) var(--ease); }

      `}</style>
    </>
  );
}
