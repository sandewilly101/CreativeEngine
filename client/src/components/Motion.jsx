import { useEffect, useRef } from 'react';
import { useReveal, useOdometer, useScrollProgress, prefersReduced } from '../hooks/useMotion';
import { useApp } from '../context/AppContext';

/* ==========================================================================
   Motion components.

   These wrap the CSS primitives in global.css so a page can say what it
   wants ("reveal these, stagger them") without repeating observer plumbing.
   ========================================================================== */

/**
 * Reveals its children on scroll. `as` lets it be any element, so it does
 * not add a wrapper div where the layout does not want one.
 */
export function Reveal({
  children,
  as: Tag = 'div',
  stagger = 0,
  threshold = 0.12,
  once = true,
  className = '',
  ...props
}) {
  const [ref] = useReveal({ threshold, once, stagger });
  return (
    <Tag ref={ref} className={`reveal ${className}`} {...props}>
      {children}
    </Tag>
  );
}

/** A single element that fades and rises into place. */
export function Rise({ children, as: Tag = 'div', delay = 0, className = '', style, ...props }) {
  const [ref] = useReveal();
  return (
    <Tag
      ref={ref}
      className={`rise ${className}`}
      style={{ '--d': `${delay}ms`, ...style }}
      {...props}
    >
      {children}
    </Tag>
  );
}

/** Image that settles from a slight scale-up as it enters. */
export function ZoomIn({ src, alt = '', ratio = '4x3', className = '', delay = 0, ...props }) {
  const [ref] = useReveal();
  return (
    <div
      ref={ref}
      className={`media media--${ratio} zoom-in ${className}`}
      style={{ '--d': `${delay}ms` }}
      {...props}
    >
      {src && <img src={src} alt={alt} loading="lazy" />}
    </div>
  );
}

/**
 * Headline that reveals word by word. Splits on spaces and wraps each word,
 * so the animation never breaks a word across lines.
 */
export function Words({ text, as: Tag = 'span', className = '', ...props }) {
  const [ref] = useReveal({ threshold: 0.3 });
  const words = String(text || '').split(' ');

  return (
    <Tag ref={ref} className={`words ${className}`} {...props}>
      {words.map((word, i) => (
        <span key={i} style={{ '--i': i }}>
          {word}
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </Tag>
  );
}

/**
 * Auto-scrolling band. The track is duplicated so the loop is seamless at
 * any width, and pauses on hover so a reader can actually read it.
 */
export function Marquee({
  children,
  speed = 38,
  gap = 40,
  reverse = false,
  className = '',
  ...props
}) {
  // The duplicate track is rendered as JSX rather than cloned into the DOM.
  // Cloning fought with React over ownership of the node — under StrictMode
  // the effect ran twice and a stale clone survived, stacking the two tracks
  // on top of each other instead of running them end to end.
  return (
    <div
      className={`marquee ${className}`}
      style={{
        '--mq-gap': `${gap}px`,
        '--mq-dur': `${speed}s`,
        '--mq-dir': reverse ? 'reverse' : 'normal',
      }}
      {...props}
    >
      <div className="marquee__track">{children}</div>
      <div className="marquee__track" aria-hidden="true">{children}</div>
    </div>
  );
}

/** Rolling digit counter. Pass the final value as a string, e.g. "2,400". */
export function Odometer({ value, className = '', style, ...props }) {
  const ref = useOdometer(value);
  return <span ref={ref} className={`odo ${className}`} style={style} {...props} />;
}

/** The lime→flame bar that fills as you move down the page. */
export function ScrollProgress() {
  const progress = useScrollProgress();
  return (
    <div
      className="progress-scroll"
      style={{ clipPath: `inset(0 ${((1 - progress) * 100).toFixed(2)}% 0 0)` }}
      aria-hidden="true"
    />
  );
}

/**
 * Trailing ring cursor that swells over anything interactive.
 * Never rendered on touch devices or under reduced-motion.
 */
export function Cursor() {
  const dotRef = useRef(null);

  useEffect(() => {
    if (prefersReduced() || window.matchMedia('(hover: none)').matches) return undefined;

    const dot = document.createElement('div');
    dot.className = 'cursor';
    document.body.appendChild(dot);
    dotRef.current = dot;

    let x = 0; let y = 0; let cx = 0; let cy = 0;
    let frame;

    const onMove = (e) => {
      x = e.clientX; y = e.clientY;
      dot.classList.add('is-on');
    };
    const onLeave = () => dot.classList.remove('is-on');

    const hot = 'a, button, [role="button"], input, textarea, select, .card-hover, .ind-row, .tab';
    const onOver = (e) => { if (e.target.closest(hot)) dot.classList.add('is-hot'); };
    const onOut = (e) => { if (e.target.closest(hot)) dot.classList.remove('is-hot'); };

    const loop = () => {
      // Lerp toward the pointer so the ring trails rather than snaps.
      cx += (x - cx) * 0.18;
      cy += (y - cy) * 0.18;
      dot.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
      frame = requestAnimationFrame(loop);
    };
    loop();

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseleave', onLeave);
    document.addEventListener('mouseover', onOver);
    document.addEventListener('mouseout', onOut);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
      dot.remove();
    };
  }, []);

  return null;
}

/** Section eyebrow — the small dotted pill above a heading. */
export function Eyebrow({ children, className = '' }) {
  return <span className={`eyebrow ${className}`}>{children}</span>;
}

/**
 * The five-node orbit mark. The nodes are the five divisions circling a
 * lime core, and it idles with a slow rotation unless motion is reduced.
 */
/**
 * The brand mark.
 *
 * Renders the uploaded logo when one is in the `logo-mark` slot, and falls
 * back to the built-in orbit mark otherwise — so an install with no artwork
 * still has a mark, and uploading one replaces it everywhere at once.
 *
 * `onDark` picks the light variant where the surface is ink: the standard
 * mark is drawn in near-black and disappears against the footer.
 */
export function LogoMark({ size = 32, spin = false, onDark = false, className = '' }) {
  const { slot } = useApp();
  const src = (onDark && slot('logo-mark-light')) || slot('logo-mark');
  const classes = `logo-mark ${spin ? 'logo-mark--spin' : ''} ${className}`;

  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        aria-hidden="true"
        className={classes}
        style={{ width: size, height: size, objectFit: 'contain', flex: 'none' }}
      />
    );
  }

  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      className={classes}
    >
      <circle cx="16" cy="16" r="5.4" fill="var(--primary)" />
      <g fill="currentColor">
        <circle cx="16" cy="3.4" r="2.5" />
        <circle cx="27.9" cy="12.1" r="2.5" />
        <circle cx="23.4" cy="26.2" r="2.5" />
        <circle cx="8.6" cy="26.2" r="2.5" />
        <circle cx="4.1" cy="12.1" r="2.5" />
      </g>
    </svg>
  );
}

/** Arrow used inside buttons, nudges right on hover via the .btn rule. */
export function ArrowRight({ size = 11 }) {
  return (
    <svg width={size * 0.64} height={size} viewBox="0 0 7 11" fill="none" aria-hidden="true">
      <path
        d="M1 1l4.5 4.5L1 10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
