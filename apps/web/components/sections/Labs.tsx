'use client';

import { useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { easings } from '@/components/motion/easings';
import { useLang } from '@/lib/i18n';
import { VoiceAgentLab } from '@/components/labs/VoiceAgentLab';
import { SeoStrategyLab } from '@/components/labs/SeoStrategyLab';
import { McpLab } from '@/components/labs/McpLab';

export function LabsSection() {
  const { t } = useLang();
  const headingRef = useRef<HTMLDivElement>(null);
  const headingInView = useInView(headingRef, { once: true, margin: '-60px' });

  return (
    <section id="labs" className="py-24 md:py-32 px-8 md:px-16 lg:px-20 bg-bg">
      <div className="max-w-[1920px] mx-auto">
        <motion.div
          ref={headingRef}
          initial={{ opacity: 0, y: 16 }}
          animate={headingInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.6, ease: easings.outExpo }}
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
          initial={{ opacity: 0, y: 20 }}
          animate={headingInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, ease: easings.outExpo, delay: 0.15 }}
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
