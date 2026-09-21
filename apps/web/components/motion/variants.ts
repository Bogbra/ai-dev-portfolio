import type { Variants } from 'motion/react';
import { easings } from './easings';

// Jedes Variant-Objekt hat 'full' (mit transform + opacity) und
// 'reduced' (nur opacity — sinnvoll, nicht leer).
// Komponenten wählen via useMotionSafe().choose(v.full, v.reduced).

export const fadeUp = {
  full: {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: easings.outExpo },
    },
    exit: {
      opacity: 0,
      y: 12,
      transition: { duration: 0.2, ease: easings.inExpo },
    },
  } satisfies Variants,
  // Reduced: Bewegung entfällt, sanftes Einblenden bleibt
  reduced: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.35, ease: easings.outQuart } },
    exit: { opacity: 0, transition: { duration: 0.15 } },
  } satisfies Variants,
};

export const fadeIn = {
  full: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.4, ease: easings.outQuart } },
    exit: { opacity: 0, transition: { duration: 0.2 } },
  } satisfies Variants,
  reduced: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.25 } },
    exit: { opacity: 0, transition: { duration: 0.1 } },
  } satisfies Variants,
};

export const slideIn = {
  full: {
    hidden: { opacity: 0, x: -16 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.5, ease: easings.outExpo },
    },
    exit: {
      opacity: 0,
      x: 16,
      transition: { duration: 0.2, ease: easings.inExpo },
    },
  } satisfies Variants,
  reduced: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } },
    exit: { opacity: 0, transition: { duration: 0.15 } },
  } satisfies Variants,
};

// Stagger-Container: Kindelemente erscheinen nacheinander.
// staggerChildren: Verzögerung zwischen Geschwistern (s)
// delayChildren: Gesamtverzögerung vor dem ersten Element (s)
export function staggerContainer(
  staggerChildren = 0.07,
  delayChildren = 0,
): Variants {
  return {
    hidden: {},
    visible: { transition: { staggerChildren, delayChildren } },
  };
}

// Reduced: kein Stagger, alle Elemente erscheinen gleichzeitig
export function staggerContainerReduced(): Variants {
  return { hidden: {}, visible: {} };
}
