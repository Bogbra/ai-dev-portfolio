'use client';

import Link from 'next/link';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { useRef } from 'react';
import { easings } from '@/components/motion/easings';
import { useLang } from '@/lib/i18n';

const ACCENTS = [
  'var(--color-fg)',
  'var(--color-muted)',
  'var(--color-subtle)',
];

const SLUGS: Record<string, string> = {
  'llm-interface': 'ai-operations-workflow-agent',
  'ai-tooling':    'research-to-post-multi-agent-workflow',
  'ai-system':     'research-rag-assistant',
};

type CaseStudy = {
  id: string;
  label: string;
  title: string;
  angle: string;
  problem: string;
  decision: string;
  result: string;
  tags: string[];
  accent: string;
  href: string;
};

function CaseStudyCard({ study, index, viewCase }: { study: CaseStudy; index: number; viewCase: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const prefersReduced = useReducedMotion() ?? false;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
      whileHover={prefersReduced ? {} : { scale: 1.018 }}
      transition={{
        duration: 0.7,
        ease: easings.outExpo,
        delay: index * 0.12,
        scale: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94], delay: 0 },
      }}
      className="group relative bg-surface border border-border rounded-lg overflow-hidden transition-colors duration-300 hover:border-border-strong focus-within:border-border-strong flex flex-col"
    >
      {/* Hover glow overlay */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-fg/[0.035] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10 rounded-lg"
      />
      {/* Image area */}
      <div
        className="h-56 md:h-80 w-full relative overflow-hidden flex-shrink-0"
        style={{
          background:
            'linear-gradient(145deg, var(--color-surface-elevated) 0%, var(--color-surface) 55%, var(--color-bg) 100%)',
        }}
        aria-hidden="true"
      >
        {/* Dot grid texture */}
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              'radial-gradient(circle, var(--color-border-strong) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Large decorative number */}
        <div
          className="absolute -bottom-4 right-6 font-display font-extrabold leading-none select-none pointer-events-none tabular-nums text-[12rem] 2xl:text-[15rem]"
          style={{
            color: study.accent,
            opacity: 0.08,
          }}
          aria-hidden="true"
        >
          {study.label}
        </div>
      </div>

      {/* Content */}
      <div className="p-8 md:p-10 flex flex-col flex-1">
        {/* Label with accent dot */}
        <div className="lg:max-w-[65%] 2xl:max-w-none">
          <div className="flex items-center gap-2.5 mb-5">
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: study.accent }}
              aria-hidden="true"
            />
            <p className="font-mono text-sm text-muted tracking-widest uppercase">
              {study.label} — Case Study
            </p>
          </div>

          <h3 className="font-display text-2xl md:text-3xl font-650 text-fg mb-2 leading-tight">
            {study.title}
          </h3>

          <p
            className="text-base lg:text-lg font-medium mb-6 leading-[1.75]"
            style={{ color: study.accent }}
          >
            {study.angle}
          </p>

          <dl className="space-y-3 mb-8">
            {([
              { key: 'Problem',              text: study.problem  },
              { key: 'Decision',             text: study.decision },
              { key: 'What it demonstrates', text: study.result   },
            ] as const).map(({ key, text }) => (
              <div key={key}>
                <dt className="font-mono text-sm text-subtle uppercase tracking-widest mb-0.5">{key}</dt>
                <dd className="text-base lg:text-lg text-muted leading-relaxed">{text}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Tags + CTA */}
        <div className="flex flex-col gap-4 mt-auto md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {study.tags.map((tag) => (
              <span
                key={tag}
                className="font-mono text-sm text-muted rounded-sm px-3 py-1.5 border"
                style={{
                  borderColor: `color-mix(in srgb, ${study.accent} 28%, transparent)`,
                }}
              >
                {tag}
              </span>
            ))}
          </div>

          <Link
            href={study.href}
            className="font-mono text-sm flex-shrink-0 self-end md:self-auto transition-opacity duration-150 hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 rounded-sm whitespace-nowrap"
            style={{ color: study.accent }}
            aria-label={`${viewCase}: ${study.title}`}
          >
            {viewCase}
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

export function SelectedWorkSection() {
  const { t } = useLang();
  const headingRef = useRef<HTMLDivElement>(null);
  const headingInView = useInView(headingRef, { once: true, margin: '-60px' });

  const studies: CaseStudy[] = t.work.studies.map((s, i) => ({
    ...s,
    accent: ACCENTS[i] ?? 'var(--color-fg)',
    href: `/work/${SLUGS[s.id] ?? '#'}`,
  }));

  return (
    <section id="work" className="py-28 md:py-40 px-8 md:px-16 lg:px-20 bg-bg">
      <div className="max-w-[1920px] mx-auto">
        <motion.div
          ref={headingRef}
          initial={{ opacity: 0, y: 16 }}
          animate={headingInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.6, ease: easings.outExpo }}
          className="mb-20"
        >
          <p className="font-mono text-sm text-muted tracking-[0.18em] uppercase mb-4">
            {t.work.label}
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-fg tracking-tight leading-tight md:max-w-[16ch]">
            {t.work.headline}
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 2xl:grid-cols-3 gap-8">
          {studies.map((study, i) => (
            <CaseStudyCard key={study.id} study={study} index={i} viewCase={t.work.viewCase} />
          ))}
        </div>
      </div>
    </section>
  );
}
