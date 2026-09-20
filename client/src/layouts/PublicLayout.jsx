import { useState, useEffect } from 'react';
import { Outlet, Link, NavLink, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useScrolled, useOverDark } from '../hooks/useMotion';
import { Marquee, ScrollProgress, Cursor, LogoMark, ArrowRight } from '../components/Motion';
import { SocialRow } from '../components/SocialIcons';
import ChatWidget from '../components/ChatWidget';

const NAV = [
  { to: '/services', label: 'Divisions' },
  { to: '/work', label: 'Work' },
  { to: '/packages', label: 'Packages' },
  { to: '/equipment', label: 'Equipment' },
  { to: '/print', label: 'Print' },
  { to: '/insights', label: 'Insights' },
  { to: '/about', label: 'Approach' },
];

/** The capability band that runs along the bottom of the footer. */
const CAPABILITIES = [
  'Brand identity', 'Campaigns', 'Social content', 'Photography & video',
  'Websites & hosting', 'SEO & analytics', 'E-commerce',
  'AI assistants', 'Lead capture', 'Workflow automation',
  'Conferences & launches', 'Activations', 'Exhibition stands',
  'Large format print', 'Signage', 'Merchandise', 'Vehicle branding',
  'LED & AV hire', 'Staging & structures',
];

export default function PublicLayout() {
  const { user, currency, setCurrency, siteSettings } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const scrolled = useScrolled(24);
  const overDark = useOverDark();
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Lock the page behind the full-screen mobile menu.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const brand = siteSettings.brand || {};
  const contact = siteSettings.contact || {};
  const social = siteSettings.social || {};
  const year = new Date().getFullYear();

  return (
    <>
      <ScrollProgress />
      <Cursor />

      {/* ------------------------------------------------------------ NAV */}
      <header
        className={`nav ${scrolled ? 'is-stuck' : ''} ${overDark ? 'is-dark' : ''} ${menuOpen ? 'is-open' : ''}`}
      >
        <div className="container nav__inner">
          <Link to="/" className="logo" aria-label="Creative Engine home">
            {/* The nav already flips its text to white over dark sections;
                the mark has to follow or it disappears into the ink. */}
            <LogoMark size={30} spin onDark={overDark} />
            <span className="logo__text">
              {brand.company_name || 'Creative Engine'}
              <small>Idea to Impact</small>
            </span>
          </Link>

          <nav className="nav__links" aria-label="Primary">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => (isActive ? 'is-active' : '')}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="nav__actions">
            <div className="cur-toggle" role="group" aria-label="Display currency">
              {['TZS', 'USD'].map((code) => (
                <button
                  key={code}
                  className={currency === code ? 'is-on' : ''}
                  onClick={() => setCurrency(code)}
                >
                  {code}
                </button>
              ))}
            </div>

            {user ? (
              <Link
                to={user.role_slug === 'client' ? '/portal' : '/admin'}
                className="btn btn--ink btn-sm hide-sm"
              >
                <span>{user.role_slug === 'client' ? 'My portal' : 'Dashboard'}</span>
              </Link>
            ) : (
              <Link to="/login" className="nav__signin hide-sm">Sign in</Link>
            )}

            <Link to="/contact" className="btn btn-sm nav__cta">
              <span>Start a project</span>
              <ArrowRight />
            </Link>

            <button
              className="nav__toggle"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
            >
              <span /><span /><span />
            </button>
          </div>
        </div>

        {/* Full-screen mobile menu */}
        <div className="nav__menu">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'is-active' : '')}
            >
              {item.label}
            </NavLink>
          ))}
          <Link to="/contact" className="btn"><span>Start a project</span><ArrowRight /></Link>
          {!user && <Link to="/login" className="nav__menu-sign">Sign in</Link>}
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      {/* --------------------------------------------------------- FOOTER */}
      <footer className="footer on-dark">
        <div className="container">
          <div className="footer__top">
            <div className="footer__brand">
              <Link to="/" className="logo" style={{ color: '#fff' }}>
                {/* onDark: the footer sits on ink, where the standard mark
                    would disappear. */}
                <LogoMark size={32} onDark />
                <span className="logo__text">
                  {brand.company_name || 'Creative Engine'}
                  <small>Idea to Impact</small>
                </span>
              </Link>
              <p className="footer__promise">
                {brand.promise || 'One partner. One engine. Everything from idea to execution.'}
              </p>
              <div className="footer__social">
                <SocialRow links={social} onDark />
              </div>
            </div>

            <div className="footer__col">
              <h5>Divisions</h5>
              {[
                ['/services/creative-marketing', 'Creative & Marketing'],
                ['/services/web-digital', 'Web & Digital'],
                ['/services/ai-business-systems', 'AI Business Systems'],
                ['/services/events-experiences', 'Events & Experiences'],
                ['/services/print-production', 'Print & Equipment'],
              ].map(([to, label]) => (
                <Link key={to} to={to}>{label}</Link>
              ))}
            </div>

            <div className="footer__col">
              <h5>Company</h5>
              {[
                ['/about', 'Approach'],
                ['/work', 'Our work'],
                ['/packages', 'Packages'],
                ['/insights', 'Insights'],
                ['/contact', 'Contact'],
              ].map(([to, label]) => (
                <Link key={to} to={to}>{label}</Link>
              ))}
            </div>

            <div className="footer__col">
              <h5>Get in touch</h5>
              {contact.phone && <a href={`tel:${contact.phone}`}>{contact.phone}</a>}
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="footer__email">{contact.email}</a>
              )}
              <span className="footer__addr">
                {contact.address_line1 && <>{contact.address_line1}<br /></>}
                {contact.city || 'Dar es Salaam'}, {contact.country || 'Tanzania'}
              </span>
              {contact.working_hours && (
                <span className="footer__hours">{contact.working_hours}</span>
              )}
            </div>
          </div>

          {/* Capability band — slow, quiet, full width */}
          <div className="footer__band">
            <Marquee speed={62} gap={12}>
              {CAPABILITIES.map((label) => (
                <span key={label} className="mq-pill"><i />{label}</span>
              ))}
            </Marquee>
          </div>

          <div className="footer__bottom">
            <span>© {year} {brand.company_name || 'Creative Engine'}. All rights reserved.</span>
            <span className="footer__tag">{brand.tagline || 'From Ideas to Impact.'}</span>
          </div>
        </div>
      </footer>

      <ChatWidget />

      <style>{`
        /* -------------------------------------------------------- NAV */
        .nav {
          position: fixed;
          inset: 0 0 auto 0;
          z-index: 100;
          padding: 18px 0;
          transition: padding var(--fast) var(--ease), background var(--fast) var(--ease),
                      box-shadow var(--fast) var(--ease);
        }
        .nav.is-stuck {
          padding: 10px 0;
          background: rgba(255, 255, 255, .78);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          border-bottom: 1px solid var(--stroke);
        }

        /* Over a dark hero the whole bar inverts — otherwise it is near-black
           text on a near-black ground, which is what made the links vanish. */
        .nav.is-dark .logo,
        .nav.is-dark .nav__links a,
        .nav.is-dark .nav__signin { color: #fff; }
        .nav.is-dark .logo__text small { color: var(--primary); }
        .nav.is-dark .nav__links a:hover { background: rgba(255, 255, 255, .1); }
        .nav.is-dark .nav__links a.is-active { background: var(--primary); color: var(--on-primary); }
        .nav.is-dark .cur-toggle { background: rgba(255, 255, 255, .1); }
        .nav.is-dark .cur-toggle button { color: rgba(255, 255, 255, .55); }
        .nav.is-dark .cur-toggle button.is-on { background: var(--primary); color: var(--on-primary); }
        .nav.is-dark .nav__toggle { border-color: rgba(255, 255, 255, .22); }
        .nav.is-dark .nav__toggle span { background: #fff; }
        .nav.is-dark .btn--ink {
          --btn-bg: rgba(255, 255, 255, .12);
          --btn-fg: #fff;
          --btn-fill: #fff;
        }
        .nav.is-dark .btn--ink:hover { color: var(--ink); }

        .nav.is-dark.is-stuck {
          background: rgba(20, 20, 20, .74);
          border-bottom-color: rgba(255, 255, 255, .12);
        }
        .nav__inner { display: flex; align-items: center; justify-content: space-between; gap: 24px; }

        .logo { display: inline-flex; align-items: center; gap: 10px; color: var(--ink); }
        .logo-mark { flex: none; }
        .logo-mark--spin { animation: orbit 24s linear infinite; transform-origin: 50% 50%; }
        @keyframes orbit { to { transform: rotate(360deg); } }
        .logo:hover .logo-mark--spin { animation-duration: 6s; }

        .logo__text {
          font-family: var(--display);
          font-weight: 700;
          font-size: 17px;
          letter-spacing: -.045em;
          text-transform: uppercase;
          line-height: 1;
          color: inherit;
        }
        .logo__text small {
          display: block;
          font-size: 8.5px;
          letter-spacing: .22em;
          font-weight: 600;
          color: var(--flame);
          margin-top: 3px;
        }
        .on-dark .logo__text small, .footer .logo__text small { color: var(--primary); }

        .nav__links { display: flex; align-items: center; gap: 2px; }
        .nav__links a {
          font-size: 15px; font-weight: 500; color: var(--ink);
          padding: 9px 15px; border-radius: var(--r-pill);
          transition: background var(--fast) var(--ease), color var(--fast) var(--ease);
        }
        .nav__links a:hover { background: rgba(0, 0, 0, .05); }
        .nav__links a.is-active { background: var(--ink); color: #fff; }

        .nav__actions { display: flex; align-items: center; gap: 10px; }
        .nav__signin { font-size: 15px; font-weight: 500; color: var(--ink); padding: 9px 4px; }
        .nav__signin:hover { color: var(--flame); }

        .cur-toggle {
          display: inline-flex; padding: 3px;
          background: rgba(0, 0, 0, .05);
          border-radius: var(--r-pill);
        }
        .cur-toggle button {
          border: 0; background: none; cursor: pointer;
          font-size: 12px; font-weight: 600; letter-spacing: .02em;
          padding: 5px 11px; border-radius: var(--r-pill);
          color: var(--muted);
          transition: background var(--fast) var(--ease), color var(--fast) var(--ease);
        }
        .cur-toggle button.is-on { background: var(--ink); color: #fff; }

        .nav__toggle {
          display: none;
          width: 44px; height: 44px; border-radius: 50%;
          border: 1px solid var(--stroke); background: none;
          place-items: center; cursor: pointer;
        }
        .nav__toggle span {
          display: block; width: 17px; height: 1.5px; background: var(--ink);
          transition: transform .4s var(--ease), opacity .3s;
        }
        .nav__toggle span + span { margin-top: 4.5px; }
        .nav.is-open .nav__toggle span:nth-child(1) { transform: translateY(6px) rotate(45deg); }
        .nav.is-open .nav__toggle span:nth-child(2) { opacity: 0; }
        .nav.is-open .nav__toggle span:nth-child(3) { transform: translateY(-6px) rotate(-45deg); }

        .nav__menu { display: none; }

        /* ----------------------------------------------------- FOOTER */
        .footer {
          background: var(--ink);
          color: #fff;
          padding-top: clamp(60px, 7vw, 100px);
          margin-top: var(--sec-y);
        }
        .footer__top {
          display: grid;
          grid-template-columns: 1.6fr 1fr 1fr 1.2fr;
          gap: 48px;
          padding-bottom: 56px;
        }
        .footer__promise {
          margin-top: 20px; max-width: 30ch;
          color: rgba(255, 255, 255, .62); font-size: 15px; line-height: 1.6;
        }
        .footer__social { margin-top: 26px; }

        .footer__col { display: flex; flex-direction: column; gap: 11px; }
        .footer__col h5 {
          font-family: var(--ui); font-size: 12px; font-weight: 600;
          letter-spacing: .14em; text-transform: uppercase;
          color: rgba(255, 255, 255, .42); margin-bottom: 7px;
        }
        .footer__col a, .footer__addr, .footer__hours {
          font-size: 15px; color: rgba(255, 255, 255, .72); line-height: 1.5;
          transition: color var(--fast) var(--ease);
        }
        .footer__col a:hover { color: var(--primary); }
        .footer__email { color: var(--primary) !important; }
        .footer__hours { font-size: 13px; color: rgba(255, 255, 255, .42) !important; }

        .footer__band {
          padding: 26px 0;
          border-top: 1px solid rgba(255, 255, 255, .1);
          border-bottom: 1px solid rgba(255, 255, 255, .1);
        }
        .footer__band .mq-pill {
          background: rgba(255, 255, 255, .06);
          border-color: rgba(255, 255, 255, .14);
          color: rgba(255, 255, 255, .8);
        }

        .footer__bottom {
          display: flex; align-items: center; justify-content: space-between;
          gap: 20px; flex-wrap: wrap;
          padding: 26px 0 30px;
          font-size: 13px; color: rgba(255, 255, 255, .42);
        }
        .footer__tag { color: var(--primary); font-weight: 500; }

        /* ------------------------------------------------- RESPONSIVE */
        @media (max-width: 1100px) {
          .nav__links { display: none; }
          .nav__toggle { display: grid; }
          .footer__top { grid-template-columns: 1fr 1fr; gap: 40px; }
        }
        @media (max-width: 900px) {
          .nav__cta { display: none; }
          .nav__menu {
            position: fixed; inset: 0; z-index: 99;
            background: rgba(255, 255, 255, .97);
            backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
            display: flex; flex-direction: column; justify-content: center; gap: 2px;
            padding: 90px 28px 40px;
            transform: translateY(-101%);
            transition: transform .6s var(--ease);
          }
          .nav.is-open .nav__menu { transform: translateY(0); }
          .nav__menu a {
            font-family: var(--display);
            font-size: clamp(28px, 8vw, 46px);
            font-weight: 600; text-transform: uppercase;
            letter-spacing: -.05em; color: var(--ink);
            padding: 7px 0;
          }
          .nav__menu a.is-active { color: var(--flame); }
          .nav__menu .btn {
            margin-top: 26px; align-self: flex-start;
            font-family: var(--ui); font-size: 16px;
            text-transform: none; letter-spacing: -.01em;
          }
          .nav__menu-sign {
            font-family: var(--ui) !important;
            font-size: 15px !important;
            text-transform: none !important;
            color: var(--muted) !important;
            margin-top: 18px;
          }
        }
        @media (max-width: 680px) {
          .footer__top { grid-template-columns: 1fr; gap: 34px; }
          .cur-toggle { display: none; }
        }
      `}</style>
    </>
  );
}
