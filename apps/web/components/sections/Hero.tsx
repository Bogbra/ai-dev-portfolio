'use client';

import { motion, useReducedMotion } from 'motion/react';
import { HeroArtifact } from '@/components/motion/HeroArtifact';
import { easings } from '@/components/motion/easings';
import { useLang } from '@/lib/i18n';

export function HeroSection() {
  const prefersReduced = useReducedMotion() ?? false;
  const dur = prefersReduced ? 0 : 0.7;
  const ease = easings.outExpo;
  const { t } = useLang();

  const ctaLinks = [
    { label: t.hero.cta.work,    href: '#work',    primary: true },
    { label: t.hero.cta.labs,    href: '#labs',    primary: false },
  ];

  return (
    <section
      className="relative min-h-screen pt-16 overflow-hidden px-8 md:px-16 lg:px-20"
      aria-labelledby="hero-headline"
    >
      <div className="max-w-[1920px] mx-auto min-h-[calc(100vh-4rem)] flex flex-col lg:grid lg:grid-cols-[55fr_45fr]">

      {/* Left: Content */}
      <div className="flex flex-col justify-center pt-6 pb-20 lg:py-36 order-2 lg:order-1">

        {/* Eyebrow with mauve indicator */}
        <motion.div
          className="flex items-center gap-3 mb-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: prefersReduced ? 0 : 0.4, delay: prefersReduced ? 0 : 0.1 }}
        >
          <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0" aria-hidden="true" />
          <span className="font-mono text-sm text-muted tracking-[0.18em] uppercase">
            {t.hero.eyebrow}
          </span>
        </motion.div>

        <motion.h1
          id="hero-headline"
          className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl 2xl:text-8xl font-extrabold text-fg leading-[1.02] tracking-tight mb-10 max-w-[14ch]"
          initial={{ opacity: 0, y: prefersReduced ? 0 : 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: dur, ease, delay: prefersReduced ? 0 : 0.2 }}
        >
          {t.hero.headline}
        </motion.h1>

        <motion.p
          className="text-base md:text-xl text-muted leading-relaxed max-w-[540px] mb-14"
          initial={{ opacity: 0, y: prefersReduced ? 0 : 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: dur, ease, delay: prefersReduced ? 0 : 0.35 }}
        >
          {t.hero.sub}
        </motion.p>

        <motion.div
          className="flex flex-wrap gap-3"
          initial={{ opacity: 0, y: prefersReduced ? 0 : 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: dur, ease, delay: prefersReduced ? 0 : 0.48 }}
        >
          {ctaLinks.map((cta) =>
            cta.primary ? (
              <a
                key={cta.label}
                href={cta.href}
                className="inline-flex items-center gap-2 font-mono text-sm px-7 py-3.5 rounded-md bg-accent text-bg font-medium hover:opacity-90 transition-opacity duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
              >
                {cta.label}
              </a>
            ) : (
              <a
                key={cta.label}
                href={cta.href}
                className="inline-flex items-center gap-2 font-mono text-sm px-7 py-3.5 rounded-md border border-border text-muted hover:border-accent/60 hover:text-fg transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
              >
                {cta.label}
              </a>
            ),
          )}
        </motion.div>
      </div>

      {/* Right: artifact — full-bleed on mobile, normal on desktop */}
      <div className="flex items-start justify-center pt-16 sm:pt-20 pb-4 lg:h-auto lg:pt-0 lg:items-center lg:py-36 order-1 lg:order-2">
        <motion.div
          className="w-full lg:origin-top"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: prefersReduced ? 0 : 1.2, delay: prefersReduced ? 0 : 0.5 }}
        >
          <HeroArtifact />
        </motion.div>
      </div>
      </div>

    </section>
  );
}
