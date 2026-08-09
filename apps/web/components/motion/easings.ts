// Cubic-Bezier-Arrays für motion/react.
// Gespiegelt als CSS-Variablen in globals.css (--ease-*) —
// beide Repräsentationen nutzen dieselben Werte.

export const easings = {
  // Dramatische Entschleunigung — Hero-Momente, große Reveals
  outExpo: [0.16, 1, 0.3, 1],
  // Sanfte Entschleunigung — Standard-Einblendungen, Karten
  outQuart: [0.25, 1, 0.5, 1],
  // Beschleunigung raus — Exit-Transitions
  inExpo: [0.7, 0, 0.84, 0],
  // Symmetrisch — subtiles UI-Feedback, Hover
  inOut: [0.45, 0, 0.55, 1],
  // Federnder Überschwinger — Playground-Momente, Spring-Interaktionen
  spring: [0.34, 1.56, 0.64, 1],
} as const satisfies Record<string, [number, number, number, number]>;

export type EasingName = keyof typeof easings;
