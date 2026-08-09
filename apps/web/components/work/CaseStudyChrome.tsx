'use client';

import Link from 'next/link';
import { useLang } from '@/lib/i18n';

export function CaseStudyBackLink() {
  const { t } = useLang();
  return (
    <div className="mb-16">
      <Link
        href="/#work"
        className="inline-flex items-center gap-2 font-mono text-sm text-muted hover:text-fg transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 rounded-sm"
      >
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M10 12L6 8l4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {t.work.label}
      </Link>
    </div>
  );
}

export function CaseStudyEyebrow({ number, accent }: { number: string; accent: string }) {
  const { t } = useLang();
  return (
    <p className="font-mono text-sm tracking-[0.18em] uppercase mb-4" style={{ color: accent }}>
      {t.work.caseLabel} {number}
    </p>
  );
}

interface NavItem {
  href: string;
  number: string;
}

interface CaseStudyFooterNavProps {
  previous?: NavItem;
  next?: NavItem;
}

export function CaseStudyFooterNav({ previous, next }: CaseStudyFooterNavProps) {
  const { t } = useLang();
  return (
    <nav aria-label="Case study navigation" className="flex flex-col sm:flex-row gap-4 justify-between">
      {previous ? (
        <div className="w-full sm:max-w-xs">
          <Link
            href={previous.href}
            className="group flex flex-col gap-1 p-6 border border-border rounded-lg bg-surface hover:border-border-strong transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
          >
            <span className="font-mono text-sm text-muted uppercase tracking-widest group-hover:text-fg transition-colors duration-150">
              ← {t.work.caseStudyPrev}
            </span>
            <span className="font-display text-lg font-650 text-fg">
              {t.work.caseLabel} {previous.number}
            </span>
          </Link>
        </div>
      ) : (
        <div className="hidden sm:block sm:flex-1" />
      )}
      {next ? (
        <div className="w-full sm:max-w-xs">
          <Link
            href={next.href}
            className="group flex flex-col gap-1 p-6 border border-border rounded-lg bg-surface hover:border-border-strong transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 text-right sm:items-end"
          >
            <span className="font-mono text-sm text-muted uppercase tracking-widest group-hover:text-fg transition-colors duration-150">
              {t.work.caseStudyNext} →
            </span>
            <span className="font-display text-lg font-650 text-fg">
              {t.work.caseLabel} {next.number}
            </span>
          </Link>
        </div>
      ) : null}
    </nav>
  );
}
