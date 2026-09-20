import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { money, truncate, date } from '../../utils/format';
import { Spinner } from '../../components/UI';
import {
  Reveal, Rise, ZoomIn, Words, Marquee, Odometer, Eyebrow, ArrowRight,
} from '../../components/Motion';
import { useNearestToCentre, useParallax } from '../../hooks/useMotion';
import EngineOrbit from '../../components/EngineOrbit';

const JOURNEY = [
  { code: 'D', label: 'Discover', text: 'We learn the business before we design anything.' },
  { code: 'S', label: 'Strategy', text: 'Positioning, audience, and the plan to reach them.' },
  { code: 'C', label: 'Create', text: 'Identity, campaign, content — the creative work itself.' },
  { code: 'B', label: 'Build', text: 'Websites, systems, stands, print and production.' },
  { code: 'A', label: 'Activate', text: 'Launch, event, campaign. The moment it goes live.' },
  { code: 'M', label: 'Measure', text: 'What actually happened, in numbers you can read.' },
  { code: 'O', label: 'Optimize', text: 'Improve it, then run it again better.' },
];

const CAPABILITIES = [
  'Brand identity', 'Campaigns', 'Social content', 'Photography & video',
  'Websites & hosting', 'SEO & analytics', 'E-commerce', 'AI assistants',
  'Lead capture', 'Workflow automation', 'Conferences & launches',
  'Activations', 'Exhibition stands', 'Large format print', 'Signage',
  'Merchandise', 'Vehicle branding', 'LED & AV hire', 'Staging',
];

/**
 * A client's mark, linked to their site when one is on record.
 *
 * The API already returns `website_url`; it was simply never used, so the
 * logos rendered as dead images. Opens in a new tab with `rel="noopener"` —
 * these are outbound links to third parties.
 */
function ClientMark({ client }) {
  const inner = client.logo_url
    ? <img src={client.logo_url} alt={client.name} className="client-logo" />
    : <span className="client-word">{client.name}</span>;

  if (!client.website_url) return inner;

  return (
    <a
      href={client.website_url}
      target="_blank"
      rel="noopener noreferrer"
      className="client-link"
      aria-label={`${client.name} — opens in a new tab`}
    >
      {inner}
    </a>
  );
}

/** Division slug -> icon slot suffix, so `ce-slot-icon-creative.png` maps here. */
const ICON_BY_SLUG = {
  'creative-marketing': 'creative',
  'web-digital': 'digital',
  'ai-business-systems': 'ai',
  'events-experiences': 'events',
  'print-production': 'print',
};

export default function Home() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { currency, siteSettings, slot} = useApp();
  const [activeStep, registerStep] = useNearestToCentre(JOURNEY.length);
  const heroImgRef = useParallax(0.06);

  useEffect(() => {
    api.get('/public/homepage')
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner center />;

  const brand = siteSettings.brand || {};
  const divisions = data?.divisions || [];
  const work = data?.featured_work || [];
  const packages = data?.packages || [];
  const testimonials = data?.testimonials || [];
  const clients = data?.clients || [];
  const posts = data?.posts || [];

  return (
    <>
      {/* ============================================================ HERO */}
      <section className="hero">
        {/* Ambient glows behind the composition */}
        <span className="hero__glow hero__glow--a" aria-hidden="true" />
        <span className="hero__glow hero__glow--b" aria-hidden="true" />

        <div className="container">
          <div className="hero__grid">
          <Reveal className="hero__head" stagger={90}>
            <Eyebrow>Creative · Digital · AI · Events · Production</Eyebrow>
            <h1 className="display display--xl">
              From ideas<br />to <span className="accent">impact.</span>
            </h1>
            <p className="lead measure">
              Most businesses coordinate a designer, a developer, a printer, an events
              supplier and a technology vendor separately — and lose the project in the
              gaps between them. We are the one partner who handles all of it.
            </p>
            <div className="hero__cta">
              <Link to="/contact" className="btn btn-lg">
                <span>Start a project</span><ArrowRight />
              </Link>
              <Link to="/work" className="btn btn-outline btn-lg"><span>See the work</span></Link>
            </div>
          </Reveal>

            <div className="hero__engine">
              <EngineOrbit />
            </div>
          </div>

          <div className="hero__media" ref={heroImgRef}>
            <ZoomIn
              src={slot('home-hero')}
              alt="A creative team reviewing printed work pinned to a studio wall"
              ratio="21x9"
            />
          </div>

          <Reveal className="hero__stats" stagger={110}>
            {[
              ['5', 'divisions, one team'],
              ['1', 'brief, not five suppliers'],
              ['18', '% VAT handled properly'],
              ['24', 'hour reply, working days'],
            ].map(([value, label]) => (
              <div key={label} className="stat">
                <Odometer value={value} />
                <span className="stat__label">{label}</span>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ======================================================== MARQUEES */}
      <section className="band">
        <Marquee speed={34} gap={44}>
          <span className="mq-word">Creative <i /></span>
          <span className="mq-word is-out">Digital <i /></span>
          <span className="mq-word is-hot">AI Systems <i /></span>
          <span className="mq-word is-out">Events <i /></span>
          <span className="mq-word">Print <i /></span>
          <span className="mq-word is-out">Production <i /></span>
        </Marquee>

        <Marquee speed={44} gap={14} reverse className="band__pills">
          {CAPABILITIES.map((label) => (
            <span key={label} className="mq-pill"><i />{label}</span>
          ))}
        </Marquee>
      </section>

      {/* ======================================================= DIVISIONS */}
      <section className="section">
        <div className="container">
          <Reveal className="sec-head sec-head--split" stagger={70}>
            <div className="sec-head__copy">
              <Eyebrow>What we do</Eyebrow>
              <h2 className="h2">Five divisions that feed each other</h2>
              <p className="lead measure-sm">
                A single project can generate creative work, digital assets, automation,
                event production and print — without you managing a single handover.
              </p>
            </div>
            <Link to="/services" className="btn btn-outline"><span>All divisions</span><ArrowRight /></Link>
          </Reveal>

          <Reveal className="div-grid" stagger={90}>
            {divisions.map((division) => (
              <Link
                key={division.id}
                to={`/services/${division.slug}`}
                className="div-card"
                style={{ '--accent': division.color_hex || 'var(--flame)' }}
              >
                <span className="div-card__head">
                  <span className="div-card__code">{division.code}</span>
                  {slot(`icon-${ICON_BY_SLUG[division.slug] || ''}`) && (
                    <img
                      className="div-card__icon"
                      src={slot(`icon-${ICON_BY_SLUG[division.slug]}`)}
                      alt=""
                      loading="lazy"
                    />
                  )}
                </span>
                <h3 className="h3">{division.name}</h3>
                <p className="div-card__tag">{division.tagline}</p>
                <p className="div-card__desc">{truncate(division.description, 128)}</p>
                <span className="div-card__more">Explore <ArrowRight /></span>
              </Link>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ==================================================== ONE PARTNER */}
      <section className="section section--surface">
        <div className="container">
          <div className="feature">
            <ZoomIn
              src={slot('home-partner')}
              alt="Two colleagues reviewing brand materials together"
              ratio="4x3"
              className="feature__media"
            />
            <Reveal className="feature__copy" stagger={80}>
              <Eyebrow>The difference</Eyebrow>
              <h2 className="h2">
                The waste is not the work.<br />
                It is the <span className="accent--plain">handovers.</span>
              </h2>
              <p className="lead">
                Six suppliers means six relationships, six invoices, six sets of deadlines —
                and when something slips, each one points at another.
              </p>
              <ul className="ticks">
                {[
                  'One brief, one accountable team',
                  'Scope and revisions written down before work starts',
                  'Creative feeds the website, the website feeds the assistant',
                  'The event generates the print order and the content',
                ].map((line) => (
                  <li key={line}><i />{line}</li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ========================================================= JOURNEY */}
      <section className="section">
        <div className="container">
          <Reveal className="sec-head" stagger={70}>
            <Eyebrow>How we work</Eyebrow>
            <h2 className="h2">One journey, start to finish</h2>
          </Reveal>

          <div className="journey">
            <div className="journey__sticky">
              <ZoomIn
                src={slot('home-journey')}
                alt="A creative direction session working through a campaign concept"
                ratio="4x3"
              />
            </div>

            <div className="journey__steps">
              {JOURNEY.map((step, i) => (
                <div
                  key={step.code}
                  ref={registerStep(i)}
                  className={`jr ${activeStep === i ? 'is-active' : ''}`}
                >
                  <span className="jr__code">{step.code}</span>
                  <div>
                    <h4 className="h4">{step.label}</h4>
                    <p>{step.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ WORK */}
      {work.length > 0 && (
        <section className="section section--surface">
          <div className="container">
            <Reveal className="sec-head sec-head--split" stagger={70}>
              <div className="sec-head__copy">
                <Eyebrow>Selected work</Eyebrow>
                <h2 className="h2">Projects we are proud of</h2>
              </div>
              <Link to="/work" className="btn btn-outline"><span>View all</span><ArrowRight /></Link>
            </Reveal>

            <Reveal className="grid grid-3" stagger={90}>
              {work.map((item) => (
                <Link key={item.slug} to={`/work/${item.slug}`} className="card card-hover work-card">
                  <ZoomIn
                    src={item.cover_url || item.cover_thumb}
                    alt={item.title}
                    ratio="4x3"
                  />
                  <div className="card-pad">
                    {item.division_name && (
                      <span className="work-card__div" style={{ color: item.division_color }}>
                        {item.division_name}
                      </span>
                    )}
                    <h3 className="h4">{item.title}</h3>
                    {item.client_name && <div className="small muted">{item.client_name}</div>}
                    {item.summary && (
                      <p className="small muted" style={{ marginTop: 'var(--s3)' }}>
                        {truncate(item.summary, 96)}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </Reveal>
          </div>
        </section>
      )}

      {/* ================================================= AI PULL-QUOTE */}
      <section className="section section--dark ai-band">
        <div className="container">
          <div className="feature feature--flip">
            <Reveal className="feature__copy" stagger={80}>
              <Eyebrow>AI business systems</Eyebrow>
              <h2 className="h2">
                An assistant that says <span className="accent--plain">"I don't know"</span>
              </h2>
              <p className="lead">
                Ours answers only from information you have approved. When it cannot ground
                an answer it says so and offers a person — rather than inventing a price in
                front of your client.
              </p>
              <ul className="ticks ticks--dark">
                {[
                  'Answers on your website, WhatsApp and event kiosks',
                  'Captures the lead and routes it to the right person',
                  'Every conversation logged and readable',
                  'Tells you what it could not answer, so you can fix it',
                ].map((line) => (
                  <li key={line}><i />{line}</li>
                ))}
              </ul>
              <Link to="/services/ai-business-systems" className="btn">
                <span>How it works</span><ArrowRight />
              </Link>
            </Reveal>

            <ZoomIn
              src={slot('home-ai')}
              alt="The same AI assistant answering on a laptop, a kiosk and a phone"
              ratio="3x4"
              className="feature__media"
            />
          </div>
        </div>
      </section>

      {/* ======================================================== PACKAGES */}
      {packages.length > 0 && (
        <section className="section">
          <div className="container">
            <Reveal className="sec-head" stagger={70}>
              <Eyebrow>Packages</Eyebrow>
              <h2 className="h2">Clear scope, clear price</h2>
              <p className="lead measure">
                Our retainers are priced on capacity — a set number of deliverables each
                month. We do not sell "unlimited", because unlimited scope is how quality
                quietly disappears.
              </p>
            </Reveal>

            <Reveal className="grid grid-4" stagger={90}>
              {packages.map((pkg) => (
                <div key={pkg.slug} className={`pkg ${pkg.is_featured ? 'pkg--hot' : ''}`}>
                  {pkg.is_featured && <span className="pkg__flag">Most popular</span>}
                  <span className="pkg__tier">{pkg.tier}</span>
                  <h3 className="h3">{pkg.name}</h3>
                  <p className="pkg__tag">{pkg.tagline}</p>

                  <div className="pkg__price">
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
                  </div>

                  {pkg.capacity_note && <div className="pkg__cap">{pkg.capacity_note}</div>}

                  <ul className="pkg__feats">
                    {(pkg.features || []).filter((f) => f.included).slice(0, 5).map((f, i) => (
                      <li key={i}><i />{f.label}</li>
                    ))}
                  </ul>

                  <Link
                    to="/contact"
                    className={`btn ${pkg.is_featured ? '' : 'btn-outline'} btn-block`}
                  >
                    <span>Enquire</span>
                  </Link>
                </div>
              ))}
            </Reveal>

            <div className="text-center" style={{ marginTop: 'var(--s10)' }}>
              <Link to="/packages" className="btn btn-ghost"><span>Compare all packages</span><ArrowRight /></Link>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================= CLIENTS */}
      {clients.length > 0 && (
        <section className="section-sm">
          <div className="container">
            <p className="text-center small muted" style={{ marginBottom: 'var(--s8)' }}>
              Trusted by organisations across Tanzania
            </p>
            {/* A marquee needs enough logos to fill the track; with only a
                couple it just scrolls the same mark past twice. Lay them out
                centred until there are enough to be worth moving. */}
            {clients.length >= 5 ? (
              <Marquee speed={40} gap={56}>
                {clients.map((client) => <ClientMark key={client.name} client={client} />)}
              </Marquee>
            ) : (
              <div className="client-row">
                {clients.map((client) => <ClientMark key={client.name} client={client} />)}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ==================================================== TESTIMONIALS */}
      {testimonials.length > 0 && (
        <section className="section section--surface">
          <div className="container">
            <Reveal className="sec-head sec-head--split" stagger={70}>
              <div className="sec-head__copy">
                <Eyebrow>Clients</Eyebrow>
                <h2 className="h2">What working with us is like</h2>
              </div>
            </Reveal>

            <Reveal className="grid grid-3" stagger={90}>
              {testimonials.slice(0, 3).map((t, i) => (
                <figure key={i} className="quote">
                  <blockquote>"{t.quote}"</blockquote>
                  <figcaption>
                    {t.photo_url && <img src={t.photo_url} alt="" className="avatar" />}
                    <span>
                      <strong>{t.author_name}</strong>
                      <small>{[t.author_title, t.company].filter(Boolean).join(', ')}</small>
                    </span>
                  </figcaption>
                </figure>
              ))}
            </Reveal>
          </div>
        </section>
      )}

      {/* ========================================================= INSIGHTS */}
      {posts.length > 0 && (
        <section className="section">
          <div className="container">
            <Reveal className="sec-head sec-head--split" stagger={70}>
              <div className="sec-head__copy">
                <Eyebrow>Insights</Eyebrow>
                <h2 className="h2">Thinking out loud</h2>
              </div>
              <Link to="/insights" className="btn btn-outline"><span>All articles</span><ArrowRight /></Link>
            </Reveal>

            <Reveal className="grid grid-3" stagger={90}>
              {posts.map((post) => (
                <Link key={post.slug} to={`/insights/${post.slug}`} className="card card-hover">
                  {(post.cover_url || post.cover_thumb) && (
                    <ZoomIn src={post.cover_url || post.cover_thumb} alt={post.title} ratio="16x9" />
                  )}
                  <div className="card-pad">
                    {post.category_name && (
                      <span className="work-card__div" style={{ color: 'var(--flame)' }}>
                        {post.category_name}
                      </span>
                    )}
                    <h3 className="h4">{post.title}</h3>
                    <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
                      {truncate(post.excerpt, 96)}
                    </p>
                    <div className="tiny muted" style={{ marginTop: 'var(--s4)' }}>
                      {date(post.published_at)}
                    </div>
                  </div>
                </Link>
              ))}
            </Reveal>
          </div>
        </section>
      )}

      {/* ============================================================= CTA */}
      <section className="section">
        <div className="container">
          <Reveal
            className={`cta ${slot('social-post-template') ? 'cta--art' : ''}`}
            stagger={90}
            style={slot('social-post-template')
              ? { backgroundImage: `url(${slot('social-post-template')})` }
              : undefined}
          >
            <h2 className="display">
              One partner.<br />One <span className="accent">engine.</span>
            </h2>
            <p className="lead">
              Tell us what you are working on. We will tell you honestly whether we are
              the right people for it.
            </p>
            <Link to="/contact" className="btn btn-lg">
              <span>Start a conversation</span><ArrowRight />
            </Link>
          </Reveal>
        </div>
      </section>

      <style>{`
        /* ------------------------------------------------------- HERO */
        /* The nav is fixed, so it is out of flow: the hero has to clear it
           itself or the eyebrow slides under the logo and links. */
        .hero {
          position: relative;
          padding-top: calc(var(--header-h) + clamp(20px, 3.5vh, 44px));
          padding-bottom: clamp(24px, 4vh, 48px);
          overflow: clip;
        }
        /* Soft colour behind the composition. Blurred heavily so it reads as
           light in the room rather than a shape on the page. */
        .hero__glow {
          position: absolute; border-radius: 50%;
          filter: blur(90px); opacity: .5;
          pointer-events: none; z-index: 0;
        }
        .hero__glow--a {
          width: 520px; height: 520px;
          background: rgba(204, 255, 1, .42);
          top: -140px; left: -100px;
        }
        .hero__glow--b {
          width: 460px; height: 460px;
          background: rgba(247, 73, 50, .30);
          bottom: -180px; right: -80px;
        }

        /* Only the copy and the engine occupy the first screen. The wide
           image and the stats sit below it deliberately, as the reward for
           scrolling. svh so mobile browser chrome cannot push the buttons
           under the fold. */
        .hero__grid {
          position: relative; z-index: 1;
          display: grid;
          grid-template-columns: 1.05fr .95fr;
          gap: clamp(32px, 4vw, 64px);
          align-items: center;
          min-height: calc(100svh - var(--header-h) - clamp(64px, 11vh, 124px));
        }
        /* min() against vh keeps the headline from eating the screen on short
           or laptop-height windows, where 11vw alone would overflow. */
        .hero .display--xl { font-size: min(clamp(52px, 11vw, 140px), 15.5vh); }
        .hero__head .lead { margin-top: clamp(14px, 2vh, 22px); }
        .hero__cta { margin-top: clamp(18px, 2.6vh, 30px); }
        .hero__head { display: flex; flex-direction: column; align-items: flex-start; gap: 24px; }
        .hero__head .lead { max-width: 52ch; }
        .hero__cta { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 6px; }
        .hero__engine { position: relative; }
        .hero__media { position: relative; z-index: 1; margin-top: clamp(28px, 4vh, 56px); }

        .hero__stats {
          position: relative; z-index: 1;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 32px;
          margin-top: clamp(40px, 5vw, 64px);
          padding-top: 38px;
          border-top: 1px solid var(--stroke);
        }
        .stat { display: flex; flex-direction: column; gap: 6px; }
        .stat .odo { font-size: clamp(38px, 4.4vw, 52px); }
        .stat__label { font-size: 14px; color: var(--muted); line-height: 1.4; max-width: 18ch; }

        /* --------------------------------------------------- MARQUEES */
        .band { padding-block: clamp(44px, 5vw, 76px); overflow: clip; }
        .band__pills { margin-top: 24px; }

        /* -------------------------------------------------- DIVISIONS */
        .div-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 18px;
        }
        .div-card {
          position: relative;
          display: flex; flex-direction: column; gap: 10px;
          padding: 28px 26px 26px;
          border: 1px solid var(--stroke);
          border-radius: var(--r-md);
          background: var(--white);
          overflow: clip;
          transition: transform var(--fast) var(--ease), box-shadow var(--fast) var(--ease);
        }
        /* The accent bar wipes across the top on hover */
        .div-card::before {
          content: ""; position: absolute; inset: 0 auto auto 0;
          height: 3px; width: 100%;
          background: var(--accent);
          transform: scaleX(0); transform-origin: left;
          transition: transform .5s var(--ease);
        }
        .div-card:hover { transform: translateY(-5px); box-shadow: var(--shadow-md); }
        .div-card:hover::before { transform: scaleX(1); }
        .div-card__head {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px;
        }
        .div-card__icon {
          width: 40px; height: 40px; object-fit: contain; flex: none;
          opacity: .9;
          transition: transform var(--fast) var(--ease);
        }
        .div-card:hover .div-card__icon { transform: scale(1.08); }
        .div-card__code {
          font-family: var(--display); font-weight: 700; font-size: 13px;
          letter-spacing: .1em; color: var(--accent);
        }
        .div-card__tag { font-size: 14px; font-weight: 500; color: var(--accent); }
        .div-card__desc { font-size: 15px; color: var(--body); line-height: 1.6; flex: 1; }
        .div-card__more {
          display: inline-flex; align-items: center; gap: 7px;
          font-size: 14px; font-weight: 500; color: var(--ink); margin-top: 8px;
        }
        .div-card:hover .div-card__more svg { transform: translateX(4px); }
        .div-card__more svg { transition: transform var(--fast) var(--ease); }

        /* ---------------------------------------------------- FEATURE */
        .feature {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: clamp(36px, 5vw, 72px); align-items: center;
        }
        .feature__copy { display: flex; flex-direction: column; align-items: flex-start; gap: 20px; }
        .feature--flip .feature__media { order: 1; }

        .ticks { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 13px; }
        .ticks li {
          display: flex; align-items: flex-start; gap: 12px;
          font-size: 16px; color: var(--ink-2); line-height: 1.55;
        }
        .ticks i {
          width: 20px; height: 20px; border-radius: 50%; flex: none; margin-top: 1px;
          background: var(--primary);
          position: relative;
        }
        .ticks i::after {
          content: ""; position: absolute; inset: 0;
          background: var(--on-primary);
          clip-path: polygon(20% 52%, 42% 72%, 80% 30%, 88% 38%, 42% 86%, 12% 58%);
        }
        .ticks--dark li { color: rgba(255, 255, 255, .78); }

        /* ---------------------------------------------------- JOURNEY */
        .journey {
          display: grid; grid-template-columns: .9fr 1.1fr;
          gap: clamp(36px, 5vw, 72px); align-items: start;
        }
        .journey__sticky { position: sticky; top: 110px; }
        .journey__steps { display: flex; flex-direction: column; }
        .jr {
          display: flex; gap: 20px; align-items: flex-start;
          padding: 22px 0;
          border-bottom: 1px solid var(--line);
          opacity: .38;
          transition: opacity .5s var(--ease);
        }
        .jr:last-child { border-bottom: 0; }
        .jr.is-active { opacity: 1; }
        .jr__code {
          width: 40px; height: 40px; flex: none;
          display: grid; place-items: center;
          border-radius: 50%;
          background: var(--surface-2); color: var(--ink);
          font-family: var(--display); font-weight: 700; font-size: 15px;
          transition: background .5s var(--ease), color .5s var(--ease), transform .5s var(--ease);
        }
        .jr.is-active .jr__code {
          background: var(--primary); color: var(--on-primary);
          transform: scale(1.1);
        }
        .jr p { font-size: 15px; color: var(--body); margin-top: 3px; }

        /* ------------------------------------------------------- WORK */
        .work-card__div {
          font-size: 12px; font-weight: 600;
          text-transform: uppercase; letter-spacing: .08em;
          display: block; margin-bottom: 6px;
        }

        /* --------------------------------------------------- AI BAND */
        .ai-band { border-radius: 0; }

        /* --------------------------------------------------- PACKAGES */
        .pkg {
          position: relative;
          display: flex; flex-direction: column; gap: 9px;
          padding: 30px 26px 26px;
          border: 1px solid var(--stroke);
          border-radius: var(--r-md);
          background: var(--white);
          transition: transform var(--fast) var(--ease), box-shadow var(--fast) var(--ease);
        }
        .pkg:hover { transform: translateY(-5px); box-shadow: var(--shadow-md); }
        .pkg--hot { border-color: var(--ink); border-width: 2px; }
        .pkg__flag {
          position: absolute; top: -11px; left: 24px;
          background: var(--primary); color: var(--on-primary);
          font-size: 11px; font-weight: 700; letter-spacing: .06em;
          text-transform: uppercase;
          padding: 5px 12px; border-radius: var(--r-pill);
        }
        .pkg__tier {
          font-size: 11px; font-weight: 600; letter-spacing: .14em;
          text-transform: uppercase; color: var(--muted);
        }
        .pkg__tag { font-size: 14px; color: var(--body); min-height: 40px; }
        .pkg__price { margin: 14px 0 4px; }
        .pkg__price strong {
          font-family: var(--display); font-size: 27px; font-weight: 700;
          letter-spacing: -.03em; color: var(--ink);
        }
        .pkg__price span { font-size: 14px; color: var(--muted); }
        .pkg__cap {
          font-size: 12.5px; color: var(--ink-2);
          background: var(--primary-tint);
          padding: 7px 11px; border-radius: var(--r-sm);
          margin-bottom: 6px;
        }
        .pkg__feats { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 9px; flex: 1; }
        .pkg__feats li {
          display: flex; align-items: flex-start; gap: 9px;
          font-size: 14px; color: var(--ink-2); line-height: 1.5;
        }
        .pkg__feats i {
          width: 5px; height: 5px; border-radius: 50%; flex: none; margin-top: 8px;
          background: var(--flame);
        }
        .pkg .btn { margin-top: 18px; }

        /* ----------------------------------------------------- CLIENTS */
        /* Client logos run at full colour: these are real marks with their
           own equity, and a client checking the site should see their brand
           properly, not a washed-out grey ghost. */
        .client-logo {
          height: clamp(48px, 5vw, 64px);
          width: auto; object-fit: contain;
          flex: none;
        }
        .client-link {
          display: inline-flex; align-items: center;
          transition: opacity var(--fast) var(--ease), transform var(--fast) var(--ease);
        }
        .client-link:hover { opacity: .75; transform: translateY(-2px); }
        .client-link:focus-visible {
          outline: 2px solid var(--flame); outline-offset: 6px; border-radius: 4px;
        }
        .client-row {
          display: flex; flex-wrap: wrap;
          align-items: center; justify-content: center;
          gap: clamp(32px, 5vw, 64px);
        }
        .client-word {
          font-family: var(--display); font-weight: 600; font-size: 21px;
          letter-spacing: -.03em; color: var(--ink-300); white-space: nowrap;
        }

        /* ------------------------------------------------ TESTIMONIALS */
        .quote {
          display: flex; flex-direction: column; gap: 22px;
          padding: 30px 28px;
          background: var(--white);
          border: 1px solid var(--stroke);
          border-radius: var(--r-md);
          margin: 0;
        }
        .quote blockquote {
          margin: 0; font-size: 17px; line-height: 1.65; color: var(--ink-2);
        }
        .quote figcaption { display: flex; align-items: center; gap: 12px; margin-top: auto; }
        .quote figcaption strong { display: block; font-size: 15px; color: var(--ink); }
        .quote figcaption small { font-size: 13px; color: var(--muted); }

        /* --------------------------------------------------------- CTA */
        .cta {
          display: flex; flex-direction: column; align-items: center;
          text-align: center; gap: 24px;
          padding: clamp(56px, 8vw, 104px) clamp(24px, 5vw, 64px);
          background: var(--surface-2);
          border-radius: var(--r-lg);
        }
        .cta .lead { max-width: 46ch; }
        /* The §7.3 post template is a backdrop built to be typed on: ink
           ground, lime wedge low-right, the upper-left left clear. Used as a
           background here rather than shown in a frame, which is what it is
           for. Text shifts to the light side of the palette to suit it. */
        .cta--art {
          background-size: cover;
          background-position: center;
          color: #fff;
          align-items: flex-start;
          text-align: left;
          min-height: clamp(360px, 42vw, 520px);
          justify-content: center;
        }
        .cta--art .display { color: #fff; }
        .cta--art .lead { color: rgba(255, 255, 255, .74); }
        @media (max-width: 700px) {
          .cta--art { align-items: center; text-align: center; }
        }

        /* -------------------------------------------------- RESPONSIVE */
        @media (max-width: 980px) {
          .feature, .journey { grid-template-columns: 1fr; }
          .feature--flip .feature__media { order: 0; }
          .journey__sticky { position: static; }
        }
        @media (max-width: 1000px) {
          /* Stacked, the engine sits above the copy, so holding both to one
             screen would squeeze the text. Let the hero run its natural
             height and keep the orbit small enough that the buttons still
             land in the first screen. */
          .hero__grid { grid-template-columns: 1fr; min-height: 0; }
          .hero__engine { order: -1; margin-bottom: 8px; }
        }
        @media (max-width: 700px) {
          .hero__stats { grid-template-columns: repeat(2, 1fr); gap: 24px; }
          .hero__glow--a { width: 340px; height: 340px; }
          .hero__glow--b { display: none; }
        }
      `}</style>
    </>
  );
}
