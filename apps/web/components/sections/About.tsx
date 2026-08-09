'use client';

import { useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { easings } from '@/components/motion/easings';
import { useLang } from '@/lib/i18n';

export function AboutSection() {
  const { t } = useLang();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const prefersReduced = useReducedMotion() ?? false;

  return (
    <section id="about" className="py-24 md:py-32 px-8 md:px-16 lg:px-20 bg-bg">
      <div className="max-w-[1920px] mx-auto">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.6, ease: easings.outExpo }}
          className="mb-12"
        >
          <p className="font-mono text-sm text-muted tracking-[0.18em] uppercase mb-4">
            {t.about.label}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_600px] gap-10 xl:gap-14 xl:items-center">
          {/* Text */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.7, ease: easings.outExpo, delay: 0.1 }}
            className="md:max-w-2xl"
          >
            <h2 className="font-display text-4xl md:text-5xl font-bold text-fg tracking-tight leading-tight mb-10">
              {t.about.headline}
            </h2>

            <div className="space-y-5 text-base md:text-lg text-muted leading-[1.75]">
              <p>{t.about.p1}</p>
              <p>{t.about.p2}</p>
              <p>{t.about.p3}</p>
            </div>

            <div className="flex flex-wrap gap-4 mt-10">
              <a
                href="#work"
                className="inline-flex items-center gap-2 font-mono text-sm px-5 py-2.5 rounded-md bg-accent text-bg font-medium hover:opacity-90 transition-opacity duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
              >
                {t.about.ctaWork}
              </a>
              <a
                href="#contact"
                className="inline-flex items-center gap-2 font-mono text-sm px-5 py-2.5 rounded-md border border-border text-muted hover:border-accent hover:text-fg transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
              >
                {t.about.ctaContact}
              </a>
            </div>
          </motion.div>

          {/* Stats panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.7, ease: easings.outExpo, delay: 0.25 }}
          >
            <motion.div
              whileHover={prefersReduced ? {} : { scale: 1.015 }}
              transition={{ scale: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } }}
              className="group relative border border-border rounded-lg bg-surface p-10 font-mono text-sm transition-colors duration-300 hover:border-border-strong"
            >
              <div aria-hidden="true" className="absolute inset-0 bg-fg/[0.035] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-lg" />
              <p className="text-muted text-sm mb-8 tracking-widest uppercase">
                {t.about.profileComment}
              </p>
              <div className="space-y-6">
                {t.about.stats.map((stat) => (
                  <div key={stat.label} className="grid grid-cols-[110px_1fr] gap-4">
                    <span className="text-muted text-base">{stat.label}</span>
                    <span className="text-fg text-base">{stat.value}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
