'use client';

import { useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { easings } from '@/components/motion/easings';
import { useLang } from '@/lib/i18n';

type StackStage = {
  stage: string;
  label: string;
  tools: string[];
};

function StageCard({
  stage,
  index,
  isVisible,
}: {
  stage: StackStage;
  index: number;
  isVisible: boolean;
}) {
  const prefersReduced = useReducedMotion() ?? false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      whileHover={prefersReduced ? {} : { scale: 1.015 }}
      transition={{
        duration: 0.5,
        ease: easings.outExpo,
        delay: 0.1 + index * 0.07,
        scale: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94], delay: 0 },
      }}
      className="group relative border border-border rounded-lg bg-bg p-5 flex flex-col gap-4 transition-colors duration-300 hover:border-border-strong"
    >
      <div aria-hidden="true" className="absolute inset-0 bg-fg/[0.035] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-lg" />
      <div>
        <span className="font-mono text-sm text-muted tracking-widest block mb-1">
          {stage.stage}
        </span>
        <h3 className="font-display text-base font-650 text-fg">{stage.label}</h3>
      </div>

      <ul className="space-y-2" role="list">
        {stage.tools.map((tool) => (
          <li key={tool} className="font-mono text-base text-muted flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-border flex-shrink-0" aria-hidden="true" />
            {tool}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

export function StackSection() {
  const { t } = useLang();
  const headingRef = useRef<HTMLDivElement>(null);
  const headingInView = useInView(headingRef, { once: true, margin: '-60px' });

  return (
    <section id="stack" className="py-24 md:py-32 px-8 md:px-16 lg:px-20 bg-surface">
      <div className="max-w-[1920px] mx-auto">
        <motion.div
          ref={headingRef}
          initial={{ opacity: 0, y: 16 }}
          animate={headingInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.6, ease: easings.outExpo }}
          className="mb-16 max-w-2xl"
        >
          <p className="font-mono text-sm text-muted tracking-[0.18em] uppercase mb-4">
            {t.stack.label}
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-fg tracking-tight leading-tight">
            {t.stack.headline}
          </h2>
        </motion.div>

        {/* Workflow stages */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {t.stack.stages.map((stage, i) => (
            <StageCard key={stage.stage} stage={stage} index={i} isVisible={headingInView} />
          ))}
        </div>

        {/* Flow indicator (desktop only) */}
        <motion.p
          className="hidden lg:block font-mono text-sm text-muted mt-6 text-center tracking-widest"
          initial={{ opacity: 0 }}
          animate={headingInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.4, delay: 0.8 }}
          aria-hidden="true"
        >
          {t.stack.flow}
        </motion.p>
      </div>
    </section>
  );
}
