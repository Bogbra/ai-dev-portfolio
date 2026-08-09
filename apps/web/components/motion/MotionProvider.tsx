'use client';

import { MotionConfig } from 'motion/react';
import { easings } from './easings';

interface Props {
  children: React.ReactNode;
}

/**
 * Setzt workspace-weite Motion-Defaults für alle motion.*-Elemente.
 * Komponenten können per Variant oder inline transition überschreiben.
 *
 * Wir setzen reducedMotion NICHT auf "user", weil wir explizite
 * reduced-Varianten bauen — das gibt uns eine sinnvolle, nicht leere
 * Reduced-Experience.
 */
export function MotionProvider({ children }: Props) {
  return (
    <MotionConfig
      transition={{ duration: 0.25, ease: easings.outExpo }}
    >
      {children}
    </MotionConfig>
  );
}
