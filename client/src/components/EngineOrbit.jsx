import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';

/**
 * The hero engine.
 *
 * Lime pulses travel outward from a breathing core, with the five divisions
 * floating around it as nodes. Motion is what makes lime read on a light
 * ground: a moving edge is perceptually salient even where its luminance
 * contrast against white is low.
 *
 * Four pulses run on the same 5s loop, offset by 1.25s each, so there is
 * always a ring somewhere on its journey out.
 */

const NODES = [
  {
    slug: 'ai-business-systems',
    label: 'AI Systems',
    position: 'en-1',
    icon: (
      <>
        <rect x="4" y="7" width="16" height="12" rx="3" />
        <path d="M12 7V4M8 12h.01M16 12h.01M9.5 16h5M2 12h2M20 12h2" />
      </>
    ),
  },
  {
    slug: 'web-digital',
    label: 'Web & Digital',
    position: 'en-2',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18Z" />
      </>
    ),
  },
  {
    slug: 'events-experiences',
    label: 'Events & Experiences',
    position: 'en-3',
    icon: (
      <>
        <path d="M3 20V9l9-5 9 5v11" />
        <path d="M3 20h18M8 20v-6h8v6" />
      </>
    ),
  },
  {
    slug: 'print-production',
    label: 'Print & Equipment',
    position: 'en-4',
    icon: (
      <>
        <path d="M6 9V4h12v5" />
        <rect x="3" y="9" width="18" height="7" rx="2" />
        <path d="M7 16h10v4H7z" />
      </>
    ),
  },
  {
    slug: 'creative-marketing',
    label: 'Creative & Marketing',
    position: 'en-5',
    icon: (
      <>
        <path d="M12 3a9 9 0 1 0 0 18c.9 0 1.6-.7 1.6-1.6 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5c0-4.4-4-7.6-9-7.6Z" />
        <circle cx="7.5" cy="11.5" r="1.1" />
        <circle cx="11" cy="7.5" r="1.1" />
        <circle cx="15.5" cy="9.5" r="1.1" />
      </>
    ),
  },
];

/** Division slug -> icon slot suffix, matching `ce-slot-icon-*.png`. */
const ICON_BY_SLUG = {
  'creative-marketing': 'creative',
  'web-digital': 'digital',
  'ai-business-systems': 'ai',
  'events-experiences': 'events',
  'print-production': 'print',
};

export default function EngineOrbit() {
  const { slot } = useApp();
  return (
    <div className="engine" aria-hidden="false">
      {/* Static orbit guides */}
      <span className="engine__guide engine__guide--a" aria-hidden="true" />
      <span className="engine__guide engine__guide--b" aria-hidden="true" />

      {/* Four pulses on one loop, offset so a ring is always travelling */}
      {[0, 1.25, 2.5, 3.75].map((delay) => (
        <span
          key={delay}
          className="engine__pulse"
          style={{ '--pd': `${delay}s` }}
          aria-hidden="true"
        />
      ))}

      <span className="engine__glow" aria-hidden="true" />

      <div className="engine__core" aria-hidden="true">
        {/* The white variant: the core is a saturated lime disc, where the
            ink mark's blades sit too close in tone to read. */}
        {(slot('logo-mark-light') || slot('logo-mark')) ? (
          <img
            className="engine__core-mark"
            src={slot('logo-mark-light') || slot('logo-mark')}
            alt=""
          />
        ) : (
          <svg viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="5" fill="currentColor" />
            <g fill="currentColor" opacity=".55">
              <circle cx="16" cy="3.4" r="2.2" />
              <circle cx="27.9" cy="12.1" r="2.2" />
              <circle cx="23.4" cy="26.2" r="2.2" />
              <circle cx="8.6" cy="26.2" r="2.2" />
              <circle cx="4.1" cy="12.1" r="2.2" />
            </g>
          </svg>
        )}
      </div>

      {NODES.map((node) => (
        <Link
          key={node.slug}
          to={`/services/${node.slug}`}
          className={`engine__node ${node.position}`}
        >
          <i>
            {slot(`icon-${ICON_BY_SLUG[node.slug]}`) ? (
              <img src={slot(`icon-${ICON_BY_SLUG[node.slug]}`)} alt="" />
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {node.icon}
              </svg>
            )}
          </i>
          <span>{node.label}</span>
        </Link>
      ))}

      <style>{`
        .engine {
          position: relative;
          width: 100%;
          max-width: 580px;
          margin-inline: auto;
          aspect-ratio: 1 / .88;
          z-index: 2;
        }

        /* Orbit guides — faint, static reference circles */
        .engine__guide {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          aspect-ratio: 1; border-radius: 50%;
          border: 1px solid rgba(25, 25, 25, .07);
        }
        .engine__guide--a { width: 59%; }
        .engine__guide--b { width: 95%; }

        /* The travelling pulse */
        .engine__pulse {
          position: absolute; top: 50%; left: 50%;
          width: 95%; aspect-ratio: 1;
          border-radius: 50%;
          border: 2.5px solid var(--primary);
          filter: drop-shadow(0 0 7px rgba(180, 227, 0, .75));
          transform: translate(-50%, -50%) scale(.26);
          opacity: 0;
          pointer-events: none;
          animation: pulse-out 5s cubic-bezier(.22, .61, .36, 1) infinite;
          animation-delay: var(--pd, 0s);
        }
        @keyframes pulse-out {
          0%   { transform: translate(-50%, -50%) scale(.26); opacity: 0; }
          7%   { opacity: 1; }
          72%  { opacity: .9; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
        }

        /* The core breathes in time with the pulses */
        .engine__glow {
          position: absolute; top: 50%; left: 50%;
          width: 48%; aspect-ratio: 1; border-radius: 50%;
          background: radial-gradient(circle, rgba(204, 255, 1, .8), rgba(204, 255, 1, 0) 68%);
          pointer-events: none;
          animation: core-glow 5s ease-in-out infinite;
        }
        @keyframes core-glow {
          0%, 100% { transform: translate(-50%, -50%) scale(.85); opacity: .5; }
          50%      { transform: translate(-50%, -50%) scale(1.2); opacity: .95; }
        }

        /* Ink disc, white mark. The mark on lime washed out — its blades and
           the lime sit too close in tone — so the core carries the contrast
           and the lime stays in the glow and pulses around it. */
        .engine__core {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 20%; aspect-ratio: 1;
          border-radius: 50%;
          background: var(--ink);
          display: grid; place-items: center;
          box-shadow:
            0 0 0 6px rgba(204, 255, 1, .22),
            0 18px 40px -16px rgba(25, 25, 25, .55);
        }
        .engine__core svg { width: 74%; height: auto; color: var(--on-primary); }

        /* Division nodes, gently floating */
        .engine__node {
          position: absolute;
          display: flex; align-items: center; gap: 10px;
          padding: 10px 14px;
          background: #fff;
          border: 1px solid var(--stroke);
          border-radius: 14px;
          box-shadow: 0 18px 40px -26px rgba(0, 0, 0, .55);
          animation: engine-float 8s ease-in-out infinite;
          animation-delay: var(--fd, 0s);
          transition: box-shadow .4s var(--ease), border-color .4s var(--ease),
                      transform .4s var(--ease);
          z-index: 3;
        }
        .engine__node:hover {
          box-shadow: 0 24px 52px -22px rgba(0, 0, 0, .55);
          border-color: transparent;
        }
        /* The division icons carry their own pale tint plate, so the node
           chip drops its background to avoid a tint on a tint. */
        .engine__node i:has(img) { background: none; }
        .engine__node i img { width: 100%; height: 100%; object-fit: contain; }
        /* The mark is already ink-on-transparent and reads cleanly on the
           lime core, so it is placed as-is rather than recoloured. */
        .engine__core-mark { width: 66%; height: 66%; object-fit: contain; }
        .engine__node i {
          width: 34px; height: 34px; flex: none;
          border-radius: 10px;
          background: var(--primary-tint);
          color: var(--flame-deep);
          display: grid; place-items: center;
          transition: background .4s var(--ease), color .4s var(--ease);
        }
        .engine__node:hover i { background: var(--primary); color: var(--on-primary); }
        .engine__node i svg { width: 18px; height: 18px; }
        .engine__node span {
          font-family: var(--display);
          font-weight: 700;
          text-transform: uppercase;
          font-size: 11.5px;
          line-height: 1.22;
          letter-spacing: -.01em;
          color: var(--ink);
          max-width: 11ch;
        }
        @keyframes engine-float {
          0%, 100% { translate: 0 0; }
          50%      { translate: 0 -13px; }
        }

        .en-1 { top: 11%;    left: 3%;    --fd: .2s; }
        .en-2 { top: 2%;     right: 5%;   --fd: 1.2s; }
        .en-3 { top: 44%;    right: -3%;  --fd: .6s; }
        .en-4 { bottom: 13%; right: 7%;   --fd: 1.7s; }
        .en-5 { bottom: 23%; left: -1%;   --fd: .9s; }

        @media (max-width: 1100px) {
          .engine { max-width: 460px; }
        }
        @media (max-width: 520px) {
          .engine__node { padding: 7px 10px; gap: 7px; border-radius: 11px; }
          .engine__node i { width: 27px; height: 27px; border-radius: 8px; }
          .engine__node i svg { width: 15px; height: 15px; }
          .engine__node span { font-size: 10px; max-width: 9ch; }
        }

        /* Hold the composition, drop the movement. */
        @media (prefers-reduced-motion: reduce) {
          .engine__pulse {
            animation: none;
            opacity: .5;
            transform: translate(-50%, -50%) scale(1);
          }
          .engine__pulse:nth-of-type(3) { transform: translate(-50%, -50%) scale(.62); }
          .engine__pulse:nth-of-type(4) { transform: translate(-50%, -50%) scale(.36); }
          .engine__pulse:nth-of-type(5) { display: none; }
          .engine__glow {
            animation: none;
            transform: translate(-50%, -50%) scale(1);
            opacity: .7;
          }
          .engine__node { animation: none; }
        }
      `}</style>
    </div>
  );
}
