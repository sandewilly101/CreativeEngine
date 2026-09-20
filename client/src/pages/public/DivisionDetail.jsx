import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { money, truncate } from '../../utils/format';
import { Spinner, Empty } from '../../components/UI';
import { Reveal, ZoomIn, Eyebrow, ArrowRight, Marquee } from '../../components/Motion';
import PageHero from '../../components/PageHero';

/** Division slug -> slot suffix, so `ce-slot-division-creative.png` maps here. */
const SLOT_BY_SLUG = {
  'creative-marketing': 'creative',
  'web-digital': 'digital',
  'ai-business-systems': 'ai',
  'events-experiences': 'events',
  'print-production': 'print',
};

export default function DivisionDetail() {
  const { slug } = useParams();
  const [division, setDivision] = useState(null);
  const [loading, setLoading] = useState(true);
  const { currency, slot } = useApp();

  useEffect(() => {
    setLoading(true);
    api.get(`/public/divisions/${slug}`)
      .then((res) => setDivision(res.data))
      .catch(() => setDivision(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <Spinner center />;
  if (!division) {
    return (
      <div className="container section" style={{ paddingTop: 'calc(var(--header-h) + 80px)' }}>
        <Empty
          title="Division not found"
          action={<Link to="/services" className="btn"><span>All divisions</span></Link>}
        />
      </div>
    );
  }

  const accent = division.color_hex || 'var(--flame)';
  const services = division.services || [];

  return (
    <>
      <PageHero
        back={{ to: '/services', label: 'All divisions' }}
        eyebrow={`Division ${division.code}`}
        title={division.name}
        lead={division.description}
        accent={accent}
        media={slot(`division-${SLOT_BY_SLUG[slug] || ''}`) || division.hero_url}
        mediaAlt={division.name}
        meta={
          division.revenue_model && (
            <span>How it is priced: <strong>{division.revenue_model}</strong></span>
          )
        }
        actions={
          <Link to="/contact" className="btn"><span>Request a quote</span><ArrowRight /></Link>
        }
      />

      {/* Capability band in the division's own colour */}
      {services.length > 3 && (
        <div className="div-band" style={{ '--accent': accent }}>
          <Marquee speed={46} gap={14}>
            {services.map((s) => (
              <span key={s.slug} className="mq-pill"><i />{s.name}</span>
            ))}
          </Marquee>
        </div>
      )}

      <section className="section">
        <div className="container">
          <Reveal className="sec-head sec-head--split" stagger={70}>
            <div className="sec-head__copy">
              <Eyebrow>Services</Eyebrow>
              <h2 className="h2">What this division does</h2>
            </div>
          </Reveal>

          <Reveal className="dsvc-grid" stagger={80}>
            {services.map((service) => (
              <Link
                key={service.slug}
                to={`/service/${service.slug}`}
                className="dsvc"
                style={{ '--accent': accent }}
              >
                <div className="dsvc__head">
                  <h3 className="h3">{service.name}</h3>
                  {service.recurring_interval !== 'none' && (
                    <span className="dsvc__rec">Monthly</span>
                  )}
                </div>
                <p className="dsvc__desc">{truncate(service.short_description, 116)}</p>

                {service.deliverables?.length > 0 && (
                  <ul className="dsvc__list">
                    {service.deliverables.slice(0, 4).map((item, i) => (
                      <li key={i}><i />{item}</li>
                    ))}
                  </ul>
                )}

                <div className="dsvc__foot">
                  {Number(service.base_price_cents) > 0 ? (
                    <span>
                      {service.pricing_model === 'from' && <small>From </small>}
                      <strong>{money(service.base_price_cents, currency)}</strong>
                      {service.pricing_model === 'per_sqm' && <small>/sqm</small>}
                      {service.pricing_model === 'daily' && <small>/day</small>}
                      {service.recurring_interval !== 'none' && (
                        <small>/{service.recurring_interval.replace('ly', '')}</small>
                      )}
                    </span>
                  ) : (
                    <span><small>On application</small></span>
                  )}
                  <ArrowRight />
                </div>
              </Link>
            ))}
          </Reveal>
        </div>
      </section>

      {division.work?.length > 0 && (
        <section className="section section--surface">
          <div className="container">
            <Reveal className="sec-head sec-head--split" stagger={70}>
              <div className="sec-head__copy">
                <Eyebrow>Work</Eyebrow>
                <h2 className="h2">From this division</h2>
              </div>
              <Link to="/work" className="btn btn-outline"><span>All work</span><ArrowRight /></Link>
            </Reveal>

            <Reveal className="grid grid-3" stagger={90}>
              {division.work.map((item) => (
                <Link key={item.slug} to={`/work/${item.slug}`} className="card card-hover">
                  <ZoomIn src={item.cover_url} alt={item.title} ratio="4x3" />
                  <div className="card-pad">
                    <h3 className="h4">{item.title}</h3>
                    <div className="small muted">{item.client_name}</div>
                  </div>
                </Link>
              ))}
            </Reveal>
          </div>
        </section>
      )}

      <section className="section">
        <div className="container">
          <Reveal className="dcta" stagger={80} style={{ '--accent': accent }}>
            <h2 className="display display--sm">Let us scope it properly.</h2>
            <p className="lead">
              Every quote states the scope, the number of revisions and what is not
              included — before anyone starts work.
            </p>
            <Link to="/contact" className="btn btn--ink btn-lg">
              <span>Request a quote</span><ArrowRight />
            </Link>
          </Reveal>
        </div>
      </section>

      <style>{`
        .div-band {
          padding: 22px 0;
          border-bottom: 1px solid var(--line);
          overflow: clip;
        }
        .div-band .mq-pill i { background: var(--accent); }

        .dsvc-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 18px;
        }
        .dsvc {
          position: relative;
          display: flex; flex-direction: column; gap: 13px;
          padding: 28px 26px 24px;
          background: var(--white);
          border: 1px solid var(--stroke);
          border-radius: var(--r-md);
          overflow: clip;
          transition: transform var(--fast) var(--ease), box-shadow var(--fast) var(--ease);
        }
        .dsvc::before {
          content: ""; position: absolute; inset: 0 auto auto 0;
          height: 3px; width: 100%; background: var(--accent);
          transform: scaleX(0); transform-origin: left;
          transition: transform .5s var(--ease);
        }
        .dsvc:hover { transform: translateY(-4px); box-shadow: var(--shadow-md); }
        .dsvc:hover::before { transform: scaleX(1); }
        .dsvc__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
        .dsvc__rec {
          flex: none;
          font-size: 11px; font-weight: 600;
          background: var(--primary); color: var(--on-primary);
          padding: 3px 9px; border-radius: var(--r-pill);
        }
        .dsvc__desc { font-size: 15px; color: var(--body); line-height: 1.6; }
        .dsvc__list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 7px; flex: 1; }
        .dsvc__list li {
          display: flex; align-items: flex-start; gap: 9px;
          font-size: 13.5px; color: var(--muted); line-height: 1.5;
        }
        .dsvc__list i {
          width: 4px; height: 4px; border-radius: 50%; flex: none; margin-top: 8px;
          background: var(--accent);
        }
        .dsvc__foot {
          display: flex; align-items: center; justify-content: space-between;
          margin-top: 4px; padding-top: 15px; border-top: 1px solid var(--line);
        }
        .dsvc__foot strong {
          font-family: var(--display); font-size: 19px; font-weight: 700;
          letter-spacing: -.03em; color: var(--ink);
        }
        .dsvc__foot small { font-size: 13px; color: var(--muted); }
        .dsvc:hover .dsvc__foot svg { transform: translateX(4px); }
        .dsvc__foot svg { transition: transform var(--fast) var(--ease); }

        .dcta {
          display: flex; flex-direction: column; align-items: center;
          text-align: center; gap: 22px;
          padding: clamp(52px, 7vw, 92px) clamp(24px, 5vw, 56px);
          border-radius: var(--r-lg);
          background:
            linear-gradient(180deg, color-mix(in srgb, var(--accent) 9%, transparent), transparent),
            var(--surface-2);
        }
        .dcta .lead { max-width: 48ch; }
      `}</style>
    </>
  );
}
