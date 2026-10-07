import { animate, motion, useInView, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';

export const EASE = [0.32, 0.72, 0, 1] as const;

/** Fade/slide/blur in when scrolled into view. */
export function Reveal({ children, delay = 0, y = 24, className, style }: { children: ReactNode; delay?: number; y?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y, filter: 'blur(10px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.8, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Headline whose words rise in one after another. */
export function WordsReveal({ text, delay = 0, className, stagger = 0.08 }: { text: string; delay?: number; className?: string; stagger?: number }) {
  return (
    <span aria-label={text}>
      {text.split(' ').map((w, i) => (
        <span key={i} style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom', paddingBottom: '0.08em' }} aria-hidden>
          <motion.span
            className={className}
            style={{ display: 'inline-block' }}
            initial={{ y: '110%', opacity: 0, filter: 'blur(8px)' }}
            animate={{ y: '0%', opacity: 1, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
            transition={{ duration: 0.9, delay: delay + i * stagger, ease: EASE }}
          >
            {w}
            {' '}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

/** Number that counts up when it enters the viewport. */
export function CountUp({ value, duration = 1.2, decimals = 0, className }: { value: number; duration?: number; decimals?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const ctl = animate(0, value, { duration, ease: EASE, onUpdate: setV });
    return () => ctl.stop();
  }, [inView, value, duration]);
  return (
    <span ref={ref} className={className}>
      {v.toFixed(decimals)}
    </span>
  );
}

/** 3D tilt that follows the pointer, with a moving sheen. Spread the returned props on the element. */
export function useTilt(max = 8) {
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 260, damping: 22 });
  const sry = useSpring(ry, { stiffness: 260, damping: 22 });
  const gx = useMotionValue(50);
  const gy = useMotionValue(50);
  const sheen = useTransform([gx, gy], ([x, y]) => `radial-gradient(60% 60% at ${x}% ${y}%, rgba(255,255,255,0.16), transparent 60%)`);
  return {
    style: { rotateX: srx, rotateY: sry, transformPerspective: 900 },
    sheen,
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      ry.set((px - 0.5) * 2 * max);
      rx.set(-(py - 0.5) * 2 * max);
      gx.set(px * 100);
      gy.set(py * 100);
    },
    onPointerLeave: () => {
      rx.set(0);
      ry.set(0);
    },
  };
}

/** Wraps a page with a soft fade/blur/scale transition. */
export function Page({ children, plain }: { children: ReactNode; plain?: boolean }) {
  // Filters/transforms would turn this wrapper into the containing block of
  // `position: fixed` descendants, so they are cleared once the animation ends.
  if (plain)
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
        {children}
      </motion.div>
    );
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transitionEnd: { filter: 'none', transform: 'none' } }}
      exit={{ opacity: 0, y: -10, filter: 'blur(8px)' }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Liquid-glass "illumination": every `.glass` surface gets a soft light that
 * follows the pointer, like Apple's interactive glass.
 */
export function installGlassLight() {
  let last: HTMLElement | null = null;
  const onMove = (e: PointerEvent) => {
    const el = (e.target as Element | null)?.closest?.('.glass') as HTMLElement | null;
    if (last && last !== el) last.style.removeProperty('--lit');
    if (!el) {
      last = null;
      return;
    }
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
    el.style.setProperty('--lit', '1');
    last = el;
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerleave', () => last?.style.removeProperty('--lit'));
}
