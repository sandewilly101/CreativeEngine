import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { money } from '../../utils/format';
import { Spinner, Empty } from '../../components/UI';
import { Reveal, Eyebrow, ArrowRight } from '../../components/Motion';
import PageHero from '../../components/PageHero';

const PRINCIPLES = [
  {
    title: 'All prices exclude VAT',
    body: 'VAT is added at the standard Tanzanian rate of 18% on your invoice, with our TIN and VRN on it.',
  },
  {
    title: 'Revisions are stated, not implied',
    body: 'Every quote says how many rounds are included. Extra rounds are quoted, not absorbed silently.',
  },
];

export default function Packages() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const { currency, slot } = useApp();

  useEffect(() => {
    api.get('/public/packages')
      .then((res) => setPackages(res.data || []))
      .catch(() => setPackages([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHero
        eyebrow="Packages"
        title="Scope you can read,"
        highlight="priced up front."
        lead="Our retainers are priced on capacity — a set number of deliverables each month. We do not sell 'unlimited', because unlimited scope is how quality quietly disappears."
      />

      <section className="section">
        <div className="container">
          {loading ? <Spinner center /> : packages.length === 0 ? (
            <Empty title="No packages published yet" />
          ) : (
            <Reveal className="pkg-grid" stagger={90}>
              {packages.map((pkg) => (
                <div key={pkg.slug} className={`pk ${pkg.is_featured ? 'pk--hot' : ''}`}>
                  {pkg.is_featured && <span className="pk__flag">Most popular</span>}

                  {slot(`tier-${pkg.slug}`) && (
                    <img
                      className="pk__art"
                      src={slot(`tier-${pkg.slug}`)}
                      alt=""
                      loading="lazy"
                    />
                  )}
                  <span className="pk__tier">{pkg.tier}</span>
                  <h2 className="h3">{pkg.name}</h2>
                  <p className="pk__tag">{pkg.tagline}</p>

                  <div className="pk__price">
                    {Number(pkg.price_cents) > 0 ? (
                      <>
                        <strong>{money(pkg.price_cents, currency)}</strong>
                        <span>
                          {pkg.billing_interval === 'once'
                            ? ' one-off'
                            : ` / ${pkg.billing_interval.replace('ly', '')}`}
                        </span>
                      </>
                    ) : (
                      <strong>On application</strong>
                    )}
                    {Number(pkg.setup_fee_cents) > 0 && (
                      <div className="pk__setup">
                        Plus {money(pkg.setup_fee_cents, currency)} setup
                      </div>
                    )}
                  </div>

                  {pkg.capacity_note && <div className="pk__cap">{pkg.capacity_note}</div>}

                  <ul className="pk__feats">
                    {(pkg.features || []).map((feature, i) => (
                      <li key={i} className={feature.included ? '' : 'is-out'}>
                        <i />{feature.label}
                      </li>
                    ))}
                  </ul>

                  <Link
                    to="/contact"
                    className={`btn ${pkg.is_featured ? '' : 'btn-outline'} btn-block`}
                  >
                    <span>Enquire about this</span>
                  </Link>
                </div>
              ))}
            </Reveal>
          )}

          <Reveal className="prin" stagger={80}>
            <div className="prin__head">
              <Eyebrow>How we price</Eyebrow>
              <h2 className="h2" style={{ marginTop: 14 }}>No surprises on the invoice</h2>
            </div>
            <div className="prin__grid">
              {PRINCIPLES.map((p) => (
                <div key={p.title} className="prin__item">
                  <h3 className="h4">{p.title}</h3>
                  <p>{p.body}</p>
                </div>
              ))}

              {/* The artwork carries its own heading and the retainer line, so
                  this card is the image rather than image-plus-repeated-copy. */}
              <div className="prin__item prin__item--pay">
                <img
                  src={slot('payment-methods')}
                  alt="You can pay by mobile money: M-Pesa, Mixx by Yas, Airtel Money, bank transfer or cash. Retainers are invoiced before each cycle."
                  loading="lazy"
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <style>{`
        .pkg-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(270px, 1fr));
          gap: 20px; align-items: start;
        }
        .pk {
          position: relative;
          display: flex; flex-direction: column; gap: 9px;
          padding: 32px 26px 26px;
          background: var(--white);
          border: 1px solid var(--stroke);
          border-radius: var(--r-md);
          transition: transform var(--fast) var(--ease), box-shadow var(--fast) var(--ease);
        }
        .pk:hover { transform: translateY(-5px); box-shadow: var(--shadow-md); }
        .pk--hot { border: 2px solid var(--ink); }
        .pk__flag {
          position: absolute; top: -11px; left: 24px;
          background: var(--primary); color: var(--on-primary);
          font-size: 11px; font-weight: 700; letter-spacing: .06em;
          text-transform: uppercase; padding: 5px 12px; border-radius: var(--r-pill);
        }
        /* Sized by height, not width: the slices are square, so a width cap
           let them run ~190px tall and dominate the card. The illustration
           supports the tier, it is not the offer. */
        .pk__art {
          display: block; height: 72px; width: auto; max-width: 100%;
          margin: 0 0 var(--s3); object-fit: contain; object-position: left center;
        }
        .pk__tier {
          font-size: 11px; font-weight: 600; letter-spacing: .14em;
          text-transform: uppercase; color: var(--muted);
        }
        .pk__tag { font-size: 14.5px; color: var(--body); min-height: 42px; line-height: 1.5; }
        .pk__price { margin: 16px 0 6px; }
        .pk__price strong {
          font-family: var(--display); font-size: 29px; font-weight: 700;
          letter-spacing: -.035em; color: var(--ink);
        }
        .pk__price span { font-size: 14px; color: var(--muted); }
        .pk__setup { font-size: 13px; color: var(--muted); margin-top: 5px; }
        .pk__cap {
          font-size: 12.5px; color: var(--ink-2);
          background: var(--primary-tint);
          padding: 8px 12px; border-radius: var(--r-sm);
          margin-bottom: 8px; line-height: 1.5;
        }
        .pk__feats { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 10px; flex: 1; }
        .pk__feats li {
          display: flex; align-items: flex-start; gap: 10px;
          font-size: 14.5px; color: var(--ink-2); line-height: 1.5;
        }
        .pk__feats i {
          width: 17px; height: 17px; border-radius: 50%; flex: none; margin-top: 2px;
          background: var(--primary); position: relative;
        }
        .pk__feats i::after {
          content: ""; position: absolute; inset: 0; background: var(--on-primary);
          clip-path: polygon(20% 52%, 42% 72%, 80% 30%, 88% 38%, 42% 86%, 12% 58%);
        }
        .pk__feats li.is-out { color: var(--ink-400); }
        .pk__feats li.is-out i { background: var(--line); }
        .pk__feats li.is-out i::after {
          background: var(--ink-400);
          clip-path: polygon(22% 45%, 78% 45%, 78% 55%, 22% 55%);
        }
        .pk .btn { margin-top: 20px; }

        .prin { margin-top: clamp(56px, 7vw, 96px); }
        .prin__head { margin-bottom: 36px; }
        .prin__grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 28px;
          padding: 34px 32px;
          background: var(--surface-2);
          border-radius: var(--r-lg);
        }
        .prin__item h3 { margin-bottom: 8px; }
        .prin__item p { font-size: 14.5px; color: var(--body); line-height: 1.65; }

        /* The payment artwork already contains its own wordmark, so it is
           centred against the two text columns rather than topped by a heading. */
        .prin__item--pay { display: flex; align-items: center; justify-content: center; }
        .prin__item--pay img {
          width: 100%;
          max-width: 460px;
          height: auto;
          /* The PNG carries a lot of transparent padding; this trims the
             optical gap so it aligns with the text beside it. */
          margin-block: -18px;
        }
        @media (max-width: 860px) {
          .prin__item--pay img { max-width: 380px; margin-inline: auto; }
        }
      `}</style>
    </>
  );
}
