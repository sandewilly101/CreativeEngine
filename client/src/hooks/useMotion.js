import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Motion hooks.
 *
 * Every one of these checks prefers-reduced-motion and degrades to the
 * finished state rather than the starting state — someone who has asked
 * their system for less movement still sees all the content, immediately.
 */

export const prefersReduced = () =>
  typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Adds `is-in` to the element once it scrolls into view, which the CSS
 * motion primitives (.rise, .reveal, .zoom-in, .words) hang off.
 *
 * @param {object}  options
 * @param {number}  options.threshold  how much must be visible, 0–1
 * @param {boolean} options.once       stop observing after the first reveal
 * @param {number}  options.stagger    ms between children, sets --d on each
 */
export function useReveal({ threshold = 0.12, once = true, stagger = 0 } = {}) {
  const ref = useRef(null);
  const [isIn, setIsIn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    // Stagger children by writing a custom property they animate against.
    if (stagger > 0) {
      Array.from(el.children).forEach((child, i) => {
        child.style.setProperty('--d', `${i * stagger}ms`);
      });
    }

    if (prefersReduced() || !('IntersectionObserver' in window)) {
      el.classList.add('is-in');
      setIsIn(true);
      return undefined;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            setIsIn(true);
            if (once) io.unobserve(entry.target);
          } else if (!once) {
            entry.target.classList.remove('is-in');
            setIsIn(false);
          }
        });
      },
      { threshold, rootMargin: '0px 0px -8% 0px' }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [threshold, once, stagger]);

  return [ref, isIn];
}

/**
 * Rolling digit counter. Builds a 0–9 strip per digit and slides each one to
 * its target, offset per column so the number resolves left to right.
 */
export function useOdometer(value, { duration = 1600, digitStagger = 90 } = {}) {
  const ref = useRef(null);
  const rolled = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const text = String(value ?? '');
    el.innerHTML = '';

    // Build the strips
    text.split('').forEach((ch) => {
      if (/\d/.test(ch)) {
        const col = document.createElement('span');
        col.className = 'odo__col';
        const strip = document.createElement('span');
        strip.className = 'odo__strip';
        strip.style.transitionDuration = `${duration}ms`;
        for (let n = 0; n <= 9; n += 1) {
          const digit = document.createElement('span');
          digit.textContent = String(n);
          strip.appendChild(digit);
        }
        col.appendChild(strip);
        el.appendChild(col);
      } else {
        const fixed = document.createElement('span');
        fixed.className = 'odo__fixed';
        fixed.textContent = ch;
        el.appendChild(fixed);
      }
    });

    const roll = () => {
      if (rolled.current) return;
      rolled.current = true;
      const digits = text.replace(/\D/g, '').split('');
      el.querySelectorAll('.odo__strip').forEach((strip, i) => {
        const target = parseInt(digits[i], 10) || 0;
        strip.style.setProperty('--d', `${i * digitStagger}ms`);
        // Each digit is exactly 10% of the strip, so this stays correct at
        // any font size or breakpoint.
        strip.style.transform = `translateY(${-target * 10}%)`;
      });
    };

    if (prefersReduced() || !('IntersectionObserver' in window)) {
      roll();
      return undefined;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            roll();
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value, duration, digitStagger]);

  // Re-roll when the value itself changes
  useEffect(() => { rolled.current = false; }, [value]);

  return ref;
}

/** True once the page has scrolled past `offset` — drives the sticky header. */
export function useScrolled(offset = 24) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > offset);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [offset]);

  return scrolled;
}

/** Scroll position through the document, 0–1. */
export function useScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return progress;
}

/**
 * Gentle parallax. Translates the element against scroll, clamped to the
 * viewport so off-screen elements cost nothing.
 */
export function useParallax(speed = 0.12) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReduced()) return undefined;

    let ticking = false;
    const update = () => {
      ticking = false;
      const vh = window.innerHeight;
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      const offset = (r.top + r.height / 2 - vh / 2) * -speed;
      el.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`;
    };
    const onScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [speed]);

  return ref;
}

/**
 * Highlights whichever item in a list sits nearest the middle of the
 * viewport — used by the journey timeline.
 */
export function useNearestToCentre(count, { anchor = 0.45 } = {}) {
  const [active, setActive] = useState(0);
  const refs = useRef([]);

  const register = useCallback((i) => (el) => { refs.current[i] = el; }, []);

  useEffect(() => {
    if (!count) return undefined;
    let ticking = false;

    const update = () => {
      ticking = false;
      const mid = window.innerHeight * anchor;
      let best = 0;
      let bestDist = Infinity;
      refs.current.forEach((el, i) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - mid);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      setActive(best);
    };
    const onScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [count, anchor]);

  return [active, register];
}

/** Counts a number up when it scrolls into view. For non-digit stats. */
export function useCountUp(target, { duration = 1400 } = {}) {
  const ref = useRef(null);
  const [value, setValue] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const run = () => {
      if (done.current) return;
      done.current = true;
      if (prefersReduced()) { setValue(target); return; }

      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration);
        // easeOutExpo — fast then settling, matching the CSS easing
        const eased = t === 1 ? 1 : 1 - 2 ** (-10 * t);
        setValue(Math.round(target * eased));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    if (!('IntersectionObserver' in window)) { run(); return undefined; }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { run(); io.unobserve(e.target); } }),
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [target, duration]);

  return [ref, value];
}

/** Tracks whether the viewport is below a breakpoint. */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    mq.addEventListener('change', onChange);
    setMatches(mq.matches);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/**
 * True while a dark section sits under the header.
 *
 * The nav is fixed and transparent until it sticks, so on pages that open with
 * a dark hero it would otherwise render near-black text on a near-black
 * background. Rather than each page declaring its own tone, the nav measures
 * what is actually behind it: any element tagged `data-nav-dark` (the page
 * heroes and dark sections) that still overlaps the header band.
 */
export function useOverDark(headerHeight = 76) {
  const [overDark, setOverDark] = useState(false);

  useEffect(() => {
    let ticking = false;

    const update = () => {
      ticking = false;
      const probe = headerHeight * 0.55; // measure mid-header, not its edge
      const zones = document.querySelectorAll('[data-nav-dark]');
      let dark = false;
      zones.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top <= probe && r.bottom >= probe) dark = true;
      });
      setOverDark(dark);
    };

    const onScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    };

    // Re-measure after route changes swap the page content in.
    const observer = new MutationObserver(onScroll);
    observer.observe(document.body, { childList: true, subtree: true });

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [headerHeight]);

  return overDark;
}
