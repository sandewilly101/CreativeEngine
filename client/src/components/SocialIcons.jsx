/**
 * Social platform icons.
 *
 * Official marks, drawn as paths so they stay crisp at any size and need no
 * external requests. Each sits in its real brand colour at rest and cools to
 * a muted neutral on hover, so the row reads as a set of recognisable logos
 * rather than anonymous grey glyphs.
 *
 * Instagram's identity is a gradient rather than a flat colour, so it gets a
 * real gradient fill with a unique id per instance (two footers on one page
 * would otherwise collide in the SVG id namespace).
 */
import { useId } from 'react';

export const SOCIAL_BRANDS = {
  facebook: {
    label: 'Facebook',
    color: '#1877F2',
    path: 'M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z',
  },
  instagram: {
    label: 'Instagram',
    gradient: ['#FEDA75', '#FA7E1E', '#D62976', '#962FBF', '#4F5BD5'],
    color: '#D62976',
    path: 'M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41 1.27-.06 1.65-.07 4.85-.07M12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.3-1.46.72-2.13 1.38C1.35 2.68.93 3.35.63 4.14.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.3.79.72 1.46 1.38 2.13.67.67 1.34 1.08 2.13 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56.79-.3 1.46-.71 2.13-1.38.67-.67 1.08-1.34 1.38-2.13.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91-.3-.79-.71-1.46-1.38-2.13C21.32 1.35 20.65.93 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0Zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm7.85-10.4a1.44 1.44 0 1 1-2.88 0 1.44 1.44 0 0 1 2.88 0Z',
  },
  linkedin: {
    label: 'LinkedIn',
    color: '#0A66C2',
    path: 'M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13Zm1.78 13.02H3.55V9h3.57v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0Z',
  },
  twitter: {
    // The platform is X now, but the setting key stays "twitter" so existing
    // rows keep working. The mark is the current X logo.
    label: 'X',
    color: '#000000',
    darkColor: '#FFFFFF',
    path: 'M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.46l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93Zm-1.29 19.5h2.04L6.49 3.24H4.3l13.31 17.41Z',
  },
  youtube: {
    label: 'YouTube',
    color: '#FF0000',
    path: 'M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.08 0 12 0 12s0 3.92.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.92 24 12 24 12s0-3.92-.5-5.81ZM9.55 15.57V8.43L15.82 12l-6.27 3.57Z',
  },
  tiktok: {
    label: 'TikTok',
    color: '#FF0050',
    darkColor: '#FFFFFF',
    path: 'M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 3.79-4.25v-3.5a6.33 6.33 0 0 0-5.39 10.72 6.33 6.33 0 0 0 10.72-4.51V8.69a8.27 8.27 0 0 0 4.83 1.55V6.79a4.85 4.85 0 0 1-1.53-.1Z',
  },
  whatsapp: {
    label: 'WhatsApp',
    color: '#25D366',
    path: 'M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.23 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35M12.05 21.79h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.9-9.88a9.82 9.82 0 0 1 9.89 9.89c0 5.45-4.44 9.88-9.9 9.88M20.5 3.49A11.82 11.82 0 0 0 12.05 0C5.46 0 .1 5.36.1 11.95c0 2.1.55 4.16 1.6 5.98L0 24l6.22-1.63a11.93 11.93 0 0 0 5.82 1.48h.01c6.58 0 11.94-5.36 11.95-11.95a11.88 11.88 0 0 0-3.49-8.45',
  },
};

/**
 * One social icon.
 *
 * @param {string}  platform  key into SOCIAL_BRANDS
 * @param {string}  url
 * @param {boolean} onDark    swaps in the light variant for marks that are
 *                            black by default (X, TikTok), which would be
 *                            invisible against a dark footer
 */
export function SocialIcon({ platform, url, onDark = false, size = 18 }) {
  const gradientId = useId();
  const brand = SOCIAL_BRANDS[String(platform).toLowerCase()];
  if (!brand || !url) return null;

  const restColour = onDark && brand.darkColor ? brand.darkColor : brand.color;

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className="social"
      style={{ '--brand': restColour }}
      aria-label={brand.label}
      title={brand.label}
    >
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        {brand.gradient && (
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="100%" x2="100%" y2="0%">
              {brand.gradient.map((stop, i) => (
                <stop
                  key={stop}
                  offset={`${(i / (brand.gradient.length - 1)) * 100}%`}
                  stopColor={stop}
                />
              ))}
            </linearGradient>
          </defs>
        )}
        <path d={brand.path} fill="currentColor" className="social__path" />
        {brand.gradient && (
          <path d={brand.path} fill={`url(#${gradientId})`} className="social__grad" />
        )}
      </svg>
    </a>
  );
}

/** A row of icons built from the settings object. */
export function SocialRow({ links = {}, onDark = false, size = 18 }) {
  const entries = Object.entries(links).filter(
    ([name, url]) => url && SOCIAL_BRANDS[String(name).toLowerCase()]
  );
  if (entries.length === 0) return null;

  return (
    <div className="social-row">
      {entries.map(([name, url]) => (
        <SocialIcon
          key={name}
          platform={name}
          url={url}
          onDark={onDark}
          size={size}
        />
      ))}

      <style>{`
        .social-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }

        /* Brand colour at rest. */
        .social {
          width: 38px; height: 38px;
          display: grid; place-items: center;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, .14);
          color: var(--brand);
          transition: color var(--fast) var(--ease),
                      border-color var(--fast) var(--ease),
                      background var(--fast) var(--ease),
                      transform var(--fast) var(--ease);
        }
        /* Cools to neutral on hover, and lifts. */
        .social:hover {
          color: rgba(255, 255, 255, .62);
          border-color: rgba(255, 255, 255, .3);
          background: rgba(255, 255, 255, .06);
          transform: translateY(-2px);
        }

        /* Instagram's identity is a gradient, so a second copy of the path
           carries it. It fades out on hover in step with the flat colour. */
        .social__grad { opacity: 1; transition: opacity var(--fast) var(--ease); }
        .social:hover .social__grad { opacity: 0; }

        /* On a light ground the hover neutral has to be dark, not light. */
        .social-row--light .social { border-color: var(--stroke); }
        .social-row--light .social:hover {
          color: var(--muted);
          border-color: var(--border-strong);
          background: rgba(0, 0, 0, .04);
        }
      `}</style>
    </div>
  );
}

export default SocialRow;
