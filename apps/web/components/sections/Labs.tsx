'use client';

import { useRef } from 'react';
import dynamic from 'next/dynamic';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { easings } from '@/components/motion/easings';
import { useLang } from '@/lib/i18n';

// Dynamically imported, not statically: all three are substantial client
// components (form state, Zod validation; Voice additionally pulls in
// MediaRecorder handling) sitting below the fold — a visitor who never
// scrolls to Labs shouldn't pay for their JS in the initial bundle.
// ssr: false is safe here since none of the three render content a
// crawler needs (the section heading/description above them is already
// server-rendered static text).
const labLoadingFallback = (
  <div className="h-40 rounded-md border border-border/50 bg-surface animate-pulse" aria-hidden="true" />
);

const VoiceAgentLab = dynamic(
  () => import('@/components/labs/VoiceAgentLab').then((m) => m.VoiceAgentLab),
  { loading: () => labLoadingFallback, ssr: false },
);
const SeoStrategyLab = dynamic(
  () => import('@/components/labs/SeoStrategyLab').then((m) => m.SeoStrategyLab),
  { loading: () => labLoadingFallback, ssr: false },
);
const McpLab = dynamic(
  () => import('@/components/labs/McpLab').then((m) => m.McpLab),
  { loading: () => labLoadingFallback, ssr: false },
);

export function LabsSection() {
  const { t } = useLang();
  const prefersReduced = useReducedMotion() ?? false;
  const headingRef = useRef<HTMLDivElement>(null);
  const headingInView = useInView(headingRef, { once: true, margin: '-60px' });

  return (
    <section id="labs" className="py-24 md:py-32 px-8 md:px-16 lg:px-20 bg-bg">
      <div className="max-w-[1920px] mx-auto">
        <motion.div
          ref={headingRef}
          initial={{ opacity: 0, y: prefersReduced ? 0 : 16 }}
          animate={headingInView ? { opacity: 1, y: 0 } : { opacity: 0, y: prefersReduced ? 0 : 16 }}
          transition={{ duration: prefersReduced ? 0 : 0.6, ease: easings.outExpo }}
          className="mb-16 md:max-w-2xl"
        >
          <p className="font-mono text-sm text-muted tracking-[0.18em] uppercase mb-4">
            {t.labs.label}
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-fg tracking-tight leading-tight">
            {t.labs.headline}
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: prefersReduced ? 0 : 20 }}
          animate={headingInView ? { opacity: 1, y: 0 } : { opacity: 0, y: prefersReduced ? 0 : 20 }}
          transition={{ duration: prefersReduced ? 0 : 0.6, ease: easings.outExpo, delay: prefersReduced ? 0 : 0.15 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <span className="font-mono text-sm text-muted tracking-widest uppercase">
              {t.labs.featuredLabel}
            </span>
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
            <span className="font-mono text-sm text-accent tracking-widest uppercase">
              {t.labs.live}
            </span>
          </div>

          <div className="border border-border rounded-lg p-6 bg-surface">
            <div className="mb-6">
              <h3 className="font-display text-xl font-650 text-fg mb-3">
                {t.labs.voiceAgent.title}
              </h3>
              <p className="font-mono text-base md:text-lg text-muted leading-relaxed md:max-w-[50%]">{t.labs.voiceAgent.description}</p>
            </div>
            <VoiceAgentLab />
          </div>

          {/* SEO Strategy Lab */}
          <div className="border border-border rounded-lg p-6 bg-surface mt-4">
            <div className="mb-6">
              <h3 className="font-display text-xl font-650 text-fg mb-3">
                {t.labs.seoStrategy.title}
              </h3>
              <p className="font-mono text-base md:text-lg text-muted leading-relaxed md:max-w-[50%]">{t.labs.seoStrategy.description}</p>
            </div>
            <SeoStrategyLab />
          </div>

          {/* MCP Server Lab */}
          <div className="border border-border rounded-lg p-6 bg-surface mt-4">
            <div className="mb-6">
              <h3 className="font-display text-xl font-650 text-fg mb-3">
                {t.labs.mcpServer.title}
              </h3>
              <p className="font-mono text-base md:text-lg text-muted leading-relaxed md:max-w-[50%]">{t.labs.mcpServer.description}</p>
            </div>
            <McpLab />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
