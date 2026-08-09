'use client';

import { useReducedMotion } from 'motion/react';

/**
 * Gibt zurück ob der User reduced motion bevorzugt, plus einen
 * `choose`-Helper um zwischen Full- und Reduced-Varianten zu wählen.
 *
 * Verwendung:
 *   const { choose } = useMotionSafe();
 *   <motion.div variants={choose(fadeUp.full, fadeUp.reduced)} />
 */
export function useMotionSafe() {
  const prefersReduced = useReducedMotion();

  return {
    isReduced: !!prefersReduced,
    choose<T>(full: T, reduced: T): T {
      return prefersReduced ? reduced : full;
    },
  };
}
