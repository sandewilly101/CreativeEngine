import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { money } from '../../utils/format';
import { Spinner, Empty } from '../../components/UI';
import { Reveal, Eyebrow, ArrowRight } from '../../components/Motion';
import PageHero from '../../components/PageHero';

export default function ServiceDetail() {
  const { slug } = useParams();
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState(null);
  const { currency } = useApp();

  useEffect(() => {
    setLoading(true);
    api.get(`/public/services/${slug}`)
      .then((res) => setService(res.data))
      .catch(() => setService(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <Spinner center />;
  if (!service) {
    return (
      <div className="container section" style={{ paddingTop: 'calc(var(--header-h) + 80px)' }}>
        <Empty
          title="Service not found"
          description="This service may have been renamed or withdrawn."
          action={<Link to="/services" className="btn"><span>All services</span></Link>}
        />
      </div>
    );
  }

  const accent = service.division_color || 'var(--flame)';

  const priceLabel = () => {
    if (!Number(service.base_price_cents)) return 'On application';
    const prefix = service.pricing_model === 'from' ? 'From ' : '';
    const suffix = service.pricing_model === 'per_sqm' ? ' per sqm'
      : service.pricing_model === 'daily' ? ' per day'
      : service.pricing_model === 'per_unit' ? ' per unit'
      : service.recurring_interval !== 'none'
        ? ` per ${service.recurring_interval.replace('ly', '')}`
        : '';
    return `${prefix}${money(service.base_price_cents, currency)}${suffix}`;
  };

  return (
    <>
      <PageHero
        back={{ to: `/services/${service.division_slug}`, label: service.division_name }}
        eyebrow={service.division_name}
        title={service.name}
        lead={service.short_description}
        accent={accent}
      />

      <section className="section">
        <div className="container">
          <div className="svc-layout">
            <div>
              {service.description && (
                <Reveal className="svc-body" stagger={60}>
                  <p>{service.description}</p>
                </Reveal>
              )}

              {service.deliverables?.length > 0 && (
                <Reveal className="svc-block" stagger={60}>
                  <Eyebrow>What you receive</Eyebrow>
                  <h2 className="h2" style={{ marginTop: 14 }}>Included in the price</h2>
                  <ul className="deliverables" style={{ '--accent': accent }}>
                    {service.deliverables.map((item, i) => (
                      <li key={i}><i />{item}</li>
                    ))}
                  </ul>
                </Reveal>
              )}

              {service.exclusions?.length > 0 && (
                <Reveal className="svc-block" stagger={60}>
                  <h3 className="h3">Not included</h3>
                  <ul className="exclusions">
                    {service.exclusions.map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                  <p className="tiny muted" style={{ marginTop: 12 }}>
                    Stated plainly so nothing is a surprise halfway through.
                  </p>
                </Reveal>
              )}

              {service.faqs?.length > 0 && (
                <Reveal className="svc-block" stagger={50}>
                  <Eyebrow>Common questions</Eyebrow>
                  <div className="faqs" style={{ marginTop: 20 }}>
                    {service.faqs.map((faq, i) => (
                      <div key={i} className={`faq ${openFaq === i ? 'is-open' : ''}`}>
                        <button onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                          <span>{faq.question}</span>
                          <i />
                        </button>
                        <div className="faq__body"><p>{faq.answer}</p></div>
                      </div>
                    ))}
                  </div>
                </Reveal>
              )}
            </div>

            <aside className="svc-aside">
              <div className="quote-card" style={{ '--accent': accent }}>
                <span className="quote-card__label">Investment</span>
                <div className="quote-card__price">{priceLabel()}</div>

                {Number(service.setup_fee_cents) > 0 && (
                  <div className="quote-card__setup">
                    Plus {money(service.setup_fee_cents, currency)} one-off setup
                  </div>
                )}

                <dl className="quote-card__specs">
                  {service.turnaround_days && (
                    <><dt>Turnaround</dt><dd>{service.turnaround_days} days</dd></>
                  )}
                  {service.revision_limit && (
                    <><dt>Revisions</dt><dd>{service.revision_limit} rounds</dd></>
                  )}
                  {service.min_term_months > 0 && (
                    <><dt>Minimum term</dt><dd>{service.min_term_months} months</dd></>
                  )}
                  <><dt>VAT</dt><dd>18% added</dd></>
                </dl>

                <Link to="/contact" className="btn btn-block">
                  <span>Request a quote</span><ArrowRight />
                </Link>
                <p className="quote-card__note">
                  No obligation. We will tell you if it is not the right fit.
                </p>
              </div>

              {service.related?.length > 0 && (
                <div className="related">
                  <h4 className="h4">Often paired with</h4>
                  {service.related.map((r) => (
                    <Link key={r.slug} to={`/service/${r.slug}`}>
                      <span>{r.name}</span><ArrowRight />
                    </Link>
                  ))}
                </div>
              )}
            </aside>
          </div>
        </div>
      </section>

      <style>{`
        .svc-layout {
          display: grid; grid-template-columns: minmax(0, 1fr) 360px;
          gap: clamp(36px, 5vw, 72px); align-items: start;
        }
        .svc-body p {
          font-size: clamp(17px, 1.5vw, 19px); line-height: 1.75;
          color: var(--ink-2); white-space: pre-wrap;
        }
        .svc-block { margin-top: clamp(44px, 5vw, 68px); }

        .deliverables {
          list-style: none; padding: 0; margin-top: 24px;
          display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px;
        }
        .deliverables li {
          display: flex; align-items: flex-start; gap: 12px;
          font-size: 16px; color: var(--ink-2); line-height: 1.55;
        }
        .deliverables i {
          width: 20px; height: 20px; border-radius: 50%; flex: none; margin-top: 1px;
          background: var(--primary); position: relative;
        }
        .deliverables i::after {
          content: ""; position: absolute; inset: 0; background: var(--on-primary);
          clip-path: polygon(20% 52%, 42% 72%, 80% 30%, 88% 38%, 42% 86%, 12% 58%);
        }

        .exclusions { padding-left: 20px; margin-top: 14px; color: var(--muted); }
        .exclusions li { font-size: 15px; line-height: 1.7; }

        .faqs { display: flex; flex-direction: column; }
        .faq { border-bottom: 1px solid var(--line); }
        .faq button {
          width: 100%; display: flex; align-items: center; justify-content: space-between;
          gap: 20px; padding: 20px 0; background: none; border: 0; cursor: pointer;
          font-family: var(--head); font-size: 17px; font-weight: 500;
          color: var(--ink); text-align: left;
        }
        .faq button i {
          width: 22px; height: 22px; flex: none; position: relative;
          border-radius: 50%; background: var(--surface-2);
          transition: background var(--fast) var(--ease), transform var(--fast) var(--ease);
        }
        .faq button i::before, .faq button i::after {
          content: ""; position: absolute; inset: 50% 6px auto 6px;
          height: 1.5px; background: var(--ink); transform: translateY(-50%);
          transition: opacity var(--fast) var(--ease);
        }
        .faq button i::after { transform: translateY(-50%) rotate(90deg); }
        .faq.is-open button i { background: var(--primary); transform: rotate(180deg); }
        .faq.is-open button i::after { opacity: 0; }
        .faq__body {
          display: grid; grid-template-rows: 0fr;
          transition: grid-template-rows .45s var(--ease);
        }
        .faq.is-open .faq__body { grid-template-rows: 1fr; }
        .faq__body p {
          overflow: hidden; font-size: 15.5px; line-height: 1.7; color: var(--body);
        }
        .faq.is-open .faq__body p { padding-bottom: 20px; }

        .svc-aside { position: sticky; top: calc(var(--header-h) + 20px); display: flex; flex-direction: column; gap: 16px; }
        .quote-card {
          padding: 28px 26px 24px;
          border: 1px solid var(--stroke); border-radius: var(--r-md);
          background: var(--white);
          border-top: 3px solid var(--accent);
        }
        .quote-card__label {
          font-size: 11.5px; font-weight: 600; letter-spacing: .12em;
          text-transform: uppercase; color: var(--muted);
        }
        .quote-card__price {
          font-family: var(--display); font-size: 27px; font-weight: 700;
          letter-spacing: -.035em; color: var(--ink); margin-top: 6px; line-height: 1.15;
        }
        .quote-card__setup { font-size: 13.5px; color: var(--muted); margin-top: 6px; }
        .quote-card__specs {
          display: grid; grid-template-columns: 1fr auto; gap: 11px 16px;
          margin: 22px 0; padding-top: 20px; border-top: 1px solid var(--line);
          font-size: 14.5px;
        }
        .quote-card__specs dt { color: var(--muted); }
        .quote-card__specs dd { margin: 0; font-weight: 600; color: var(--ink); text-align: right; }
        .quote-card__note { font-size: 12.5px; color: var(--muted); text-align: center; margin-top: 12px; }

        .related {
          padding: 24px 26px;
          border: 1px solid var(--stroke); border-radius: var(--r-md);
          background: var(--surface);
        }
        .related h4 { margin-bottom: 14px; }
        .related a {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 11px 0; border-top: 1px solid var(--line);
          font-size: 14.5px; color: var(--ink);
          transition: color var(--fast) var(--ease);
        }
        .related a:hover { color: var(--flame); }
        .related a:hover svg { transform: translateX(4px); }
        .related a svg { transition: transform var(--fast) var(--ease); flex: none; }

        @media (max-width: 960px) {
          .svc-layout { grid-template-columns: 1fr; }
          .svc-aside { position: static; }
        }
      `}</style>
    </>
  );
}
