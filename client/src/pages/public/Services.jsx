import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { money, truncate } from '../../utils/format';
import { Spinner, Empty } from '../../components/UI';
import { Reveal, Eyebrow, ArrowRight, ZoomIn } from '../../components/Motion';
import PageHero from '../../components/PageHero';

export default function Services() {
  const [divisions, setDivisions] = useState([]);
  const [services, setServices] = useState([]);
  const [active, setActive] = useState('');
  const [loading, setLoading] = useState(true);
  const { currency, slot} = useApp();

  useEffect(() => {
    Promise.all([
      api.get('/public/divisions').catch(() => ({ data: [] })),
      api.get('/public/services').catch(() => ({ data: [] })),
    ])
      .then(([d, s]) => { setDivisions(d.data || []); setServices(s.data || []); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = active ? services.filter((s) => s.division_slug === active) : services;
  const activeDivision = divisions.find((d) => d.slug === active);

  const priceLabel = (service) => {
    if (!Number(service.base_price_cents)) return null;
    const suffix = service.pricing_model === 'per_sqm' ? '/sqm'
      : service.pricing_model === 'daily' ? '/day'
      : service.pricing_model === 'per_unit' ? '/unit'
      : service.recurring_interval !== 'none' ? `/${service.recurring_interval.replace('ly', '')}`
      : '';
    return {
      prefix: service.pricing_model === 'from' ? 'From' : '',
      value: money(service.base_price_cents, currency),
      suffix,
    };
  };

  return (
    <>
      <PageHero
        eyebrow="What we do"
        title="Every capability,"
        highlight="one roof."
        lead="Five divisions, priced clearly, with the scope written down before work starts."
      />

      <section className="section">
        <div className="container">
          <Reveal className="filters" stagger={40}>
            <button
              className={`filter ${!active ? 'is-on' : ''}`}
              onClick={() => setActive('')}
            >
              All services <span>{services.length}</span>
            </button>
            {divisions.map((d) => {
              const count = services.filter((s) => s.division_slug === d.slug).length;
              return (
                <button
                  key={d.slug}
                  className={`filter ${active === d.slug ? 'is-on' : ''}`}
                  onClick={() => setActive(d.slug)}
                  style={{ '--accent': d.color_hex }}
                >
                  {d.name} <span>{count}</span>
                </button>
              );
            })}
          </Reveal>

          {activeDivision && (
            <Reveal className="div-intro" stagger={70}>
              <div>
                <h2 className="h2">{activeDivision.name}</h2>
                <p className="lead measure">{activeDivision.description}</p>
              </div>
              <Link to={`/services/${activeDivision.slug}`} className="btn btn-outline">
                <span>Division overview</span><ArrowRight />
              </Link>
            </Reveal>
          )}

          {loading ? <Spinner center /> : filtered.length === 0 ? (
            <Empty
              title="No services published yet"
              description="Services added in the admin appear here once published."
            />
          ) : (
            <Reveal className="svc-grid" stagger={70}>
              {filtered.map((service) => {
                const price = priceLabel(service);
                return (
                  <Link
                    key={service.slug}
                    to={`/service/${service.slug}`}
                    className="svc"
                    style={{ '--accent': service.division_color || 'var(--flame)' }}
                  >
                    <div className="svc__top">
                      <span className="svc__div">{service.division_name}</span>
                      {service.recurring_interval !== 'none' && (
                        <span className="svc__rec">Recurring</span>
                      )}
                    </div>

                    <h3 className="h3">{service.name}</h3>
                    <p className="svc__desc">{truncate(service.short_description, 108)}</p>

                    {service.deliverables?.length > 0 && (
                      <ul className="svc__list">
                        {service.deliverables.slice(0, 3).map((item, i) => (
                          <li key={i}><i />{item}</li>
                        ))}
                      </ul>
                    )}

                    <div className="svc__foot">
                      {price ? (
                        <span className="svc__price">
                          {price.prefix && <small>{price.prefix} </small>}
                          <strong>{price.value}</strong>
                          {price.suffix && <small>{price.suffix}</small>}
                        </span>
                      ) : (
                        <span className="svc__price"><small>On application</small></span>
                      )}
                      <ArrowRight />
                    </div>
                  </Link>
                );
              })}
            </Reveal>
          )}
        </div>
      </section>

      <section className="section section--surface">
        <div className="container">
          <Reveal className="help" stagger={80}>
            <div>
              <Eyebrow>Not sure where to start</Eyebrow>
              <h2 className="h2" style={{ marginTop: 16 }}>
                Tell us the problem,<br />not the service.
              </h2>
              <p className="lead measure-sm" style={{ marginTop: 16 }}>
                Describe what you are trying to achieve and we will tell you what it
                actually takes — including when the honest answer is less than you expected.
              </p>
              <Link to="/contact" className="btn btn-lg" style={{ marginTop: 26 }}>
                <span>Talk to us</span><ArrowRight />
              </Link>
            </div>
            <ZoomIn
              src={slot('services-help')}
              alt="Two colleagues reviewing brand materials together"
              ratio="4x3"
            />
          </Reveal>
        </div>
      </section>

      <style>{`
        .filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 44px; }
        .filter {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 10px 18px;
          border: 1px solid var(--stroke); background: var(--white);
          border-radius: var(--r-pill);
          font-family: var(--ui); font-size: 14.5px; font-weight: 500;
          color: var(--ink); cursor: pointer;
          transition: background var(--fast) var(--ease), color var(--fast) var(--ease),
                      border-color var(--fast) var(--ease);
        }
        .filter span {
          font-size: 11.5px; font-weight: 600; color: var(--muted);
          background: var(--surface-2); padding: 2px 7px; border-radius: var(--r-pill);
        }
        .filter:hover { border-color: var(--ink-300); }
        .filter.is-on { background: var(--ink); color: #fff; border-color: var(--ink); }
        .filter.is-on span { background: rgba(255,255,255,.16); color: #fff; }

        .div-intro {
          display: flex; align-items: flex-end; justify-content: space-between;
          gap: 32px; flex-wrap: wrap; margin-bottom: 40px;
          padding-bottom: 32px; border-bottom: 1px solid var(--line);
        }

        .svc-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 18px;
        }
        .svc {
          position: relative;
          display: flex; flex-direction: column; gap: 12px;
          padding: 26px 24px 22px;
          background: var(--white);
          border: 1px solid var(--stroke);
          border-radius: var(--r-md);
          overflow: clip;
          transition: transform var(--fast) var(--ease), box-shadow var(--fast) var(--ease);
        }
        .svc::before {
          content: ""; position: absolute; inset: 0 auto auto 0;
          height: 3px; width: 100%; background: var(--accent);
          transform: scaleX(0); transform-origin: left;
          transition: transform .5s var(--ease);
        }
        .svc:hover { transform: translateY(-4px); box-shadow: var(--shadow-md); }
        .svc:hover::before { transform: scaleX(1); }

        .svc__top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .svc__div {
          font-size: 11.5px; font-weight: 600; letter-spacing: .09em;
          text-transform: uppercase; color: var(--accent);
        }
        .svc__rec {
          font-size: 11px; font-weight: 600;
          background: var(--primary); color: var(--on-primary);
          padding: 3px 9px; border-radius: var(--r-pill);
        }
        .svc__desc { font-size: 15px; color: var(--body); line-height: 1.6; }
        .svc__list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 7px; flex: 1; }
        .svc__list li {
          display: flex; align-items: flex-start; gap: 9px;
          font-size: 13.5px; color: var(--muted); line-height: 1.5;
        }
        .svc__list i {
          width: 4px; height: 4px; border-radius: 50%; flex: none; margin-top: 8px;
          background: var(--accent);
        }
        .svc__foot {
          display: flex; align-items: center; justify-content: space-between;
          margin-top: 6px; padding-top: 16px; border-top: 1px solid var(--line);
          color: var(--ink);
        }
        .svc__price strong {
          font-family: var(--display); font-size: 19px; font-weight: 700;
          letter-spacing: -.03em; color: var(--ink);
        }
        .svc__price small { font-size: 13px; color: var(--muted); }
        .svc:hover .svc__foot svg { transform: translateX(4px); }
        .svc__foot svg { transition: transform var(--fast) var(--ease); }

        .help {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: clamp(32px, 5vw, 64px); align-items: center;
        }
        @media (max-width: 900px) { .help { grid-template-columns: 1fr; } }
      `}</style>
    </>
  );
}
