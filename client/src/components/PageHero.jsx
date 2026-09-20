import { Link } from 'react-router-dom';
import { Reveal, Eyebrow, ArrowRight } from './Motion';

/**
 * The header block every inner page opens with.
 *
 * Dark by default so it reads as a deliberate lid on the page and gives the
 * fixed nav something solid to sit against. `accent` tints the eyebrow dot
 * and any highlighted word, which is how a division page picks up its colour.
 */
export default function PageHero({
  eyebrow,
  title,
  highlight,
  lead,
  accent,
  media,
  mediaAlt = '',
  actions,
  back,
  tone = 'dark',
  meta,
}) {
  const dark = tone === 'dark';

  return (
    <section
      className={`page-hero ${dark ? 'on-dark' : ''} ${media ? 'page-hero--media' : ''}`}
      data-nav-dark={dark ? '' : undefined}
    >
      {/* A soft wash of the accent behind the heading */}
      {dark && (
        <span
          className="page-hero__glow"
          style={{ background: `radial-gradient(circle, ${accent || 'var(--primary)'}22, transparent 68%)` }}
          aria-hidden="true"
        />
      )}

      <div className="container page-hero__inner">
        <Reveal className="page-hero__copy" stagger={80}>
          {back && (
            <Link to={back.to} className="page-hero__back">← {back.label}</Link>
          )}
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}

          <h1 className="display display--sm">
            {title}
            {highlight && (
              <>
                {' '}
                <span className="accent" style={accent ? { background: accent } : undefined}>
                  {highlight}
                </span>
              </>
            )}
          </h1>

          {lead && <p className="lead measure">{lead}</p>}

          {meta && <div className="page-hero__meta">{meta}</div>}

          {actions && <div className="page-hero__actions">{actions}</div>}
        </Reveal>

        {media && (
          <Reveal className="page-hero__media">
            <div className="media media--4x3">
              <img src={media} alt={mediaAlt} />
            </div>
          </Reveal>
        )}
      </div>

      <style>{`
        .page-hero {
          position: relative;
          background: var(--ink);
          color: #fff;
          padding-top: calc(var(--header-h) + clamp(48px, 6vw, 84px));
          padding-bottom: clamp(52px, 6vw, 90px);
          overflow: clip;
        }
        .page-hero__glow {
          position: absolute;
          top: -40%; right: -12%;
          width: 720px; height: 720px;
          border-radius: 50%;
          pointer-events: none;
        }
        .page-hero__inner { position: relative; }
        .page-hero--media .page-hero__inner {
          display: grid;
          grid-template-columns: 1.15fr .85fr;
          gap: clamp(36px, 5vw, 72px);
          align-items: center;
        }
        .page-hero__copy {
          display: flex; flex-direction: column;
          align-items: flex-start; gap: 20px;
        }
        .page-hero__back {
          font-size: 14px;
          color: rgba(255, 255, 255, .6);
          transition: color var(--fast) var(--ease);
        }
        .page-hero__back:hover { color: var(--primary); }
        .page-hero__actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 6px; }
        .page-hero__meta {
          display: flex; gap: 28px; flex-wrap: wrap;
          font-size: 14px; color: rgba(255, 255, 255, .6);
        }
        .page-hero__meta strong { color: #fff; font-weight: 500; }
        .page-hero__media .media { border-radius: var(--r-md); }

        @media (max-width: 900px) {
          .page-hero--media .page-hero__inner { grid-template-columns: 1fr; }
          .page-hero__media { display: none; }
        }
      `}</style>
    </section>
  );
}
