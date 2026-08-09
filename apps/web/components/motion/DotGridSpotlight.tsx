'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';

/**
 * Fixed full-viewport overlay: a second dot layer (2px, border-strong)
 * revealed only near the cursor via CSS mask-image.
 * Direct DOM updates — no React re-renders on mousemove.
 */
export function DotGridSpotlight() {
  const prefersReduced = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReduced) return;
    const el = ref.current;
    if (!el) return;

    function onMove(e: MouseEvent) {
      if (!el) return;
      const mask = `radial-gradient(circle 100px at ${e.clientX}px ${e.clientY}px, black 0%, transparent 100%)`;
      el.style.setProperty('mask-image', mask);
      el.style.setProperty('-webkit-mask-image', mask);
      el.style.opacity = '1';
    }

    function onLeave() {
      if (!el) return;
      el.style.opacity = '0';
    }

    window.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, [prefersReduced]);

  if (prefersReduced) return null;

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0"
      style={{
        zIndex: 1,
        opacity: 0,
        transition: 'opacity 400ms ease',
        backgroundImage:
          'radial-gradient(circle, var(--color-border-strong) 2px, transparent 2px)',
        backgroundSize: '40px 40px',
      }}
    />
  );
}
