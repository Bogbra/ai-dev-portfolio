'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ThemeToggle } from './ThemeToggle';
import { useLang } from '@/lib/i18n';
import type { Lang } from '@/lib/translations';

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { lang, setLang, t } = useLang();
  const prefersReduced = useReducedMotion() ?? false;
  const pathname = usePathname();
  const isHome = pathname === '/';

  function sectionHref(hash: string) {
    return isHome ? hash : `/${hash}`;
  }

  const links = [
    { label: t.nav.work,    href: sectionHref('#work') },
    { label: t.nav.labs,    href: sectionHref('#labs') },
    { label: t.nav.about,   href: sectionHref('#about') },
    { label: t.nav.contact, href: sectionHref('#contact') },
  ];

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 24); }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  // Close when viewport reaches desktop breakpoint
  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 768) setMenuOpen(false);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-accent focus:text-bg focus:px-4 focus:py-2 focus:rounded-md focus:font-mono focus:text-sm"
      >
        {t.nav.skip}
      </a>

      <header
        className={[
          'fixed top-0 left-0 right-0 z-50 h-16',
          'bg-bg/85 backdrop-blur-md',
          'px-8 md:px-16 lg:px-20',
          'transition-[border-color] duration-300',
          scrolled || menuOpen ? 'border-b border-border' : 'border-b border-transparent',
        ].join(' ')}
      >
        <nav
          className="h-full flex items-center justify-between max-w-[1920px] mx-auto"
          aria-label="Main navigation"
        >
          <a
            href={isHome ? '#main-content' : '/'}
            className="font-mono text-sm text-fg hover:text-accent transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent rounded-sm"
            aria-label={t.nav.home}
          >
            DS
          </a>

          <div className="flex items-center gap-3 md:gap-6 lg:gap-8">
            {/* Desktop links — hidden on mobile */}
            <ul className="hidden md:flex items-center gap-6" role="list">
              {links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="font-mono text-sm text-muted hover:text-fg transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent rounded-sm tracking-wide"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>

            {/* Language switcher — always visible */}
            <div
              role="group"
              aria-label={t.nav.lang}
              className="flex items-center border border-border rounded-md overflow-hidden"
            >
              {(['en', 'de'] as Lang[]).map((l, i) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  aria-pressed={lang === l}
                  className={[
                    'font-mono text-sm px-3 py-1.5 transition-colors duration-150',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-[-2px]',
                    i === 0 ? 'border-r border-border' : '',
                    lang === l
                      ? 'text-fg bg-surface'
                      : 'text-muted hover:text-fg hover:bg-surface/50',
                  ].join(' ')}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>

            {/* GitHub link — desktop only */}
            <a
              href="https://github.com/Bogbra/ai-dev-portfolio"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View source on GitHub"
              className="hidden md:flex items-center justify-center w-8 h-8 text-muted hover:text-fg transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent rounded-sm"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2C6.477 2 2 6.484 2 12.021c0 4.428 2.865 8.185 6.839 9.504.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844a9.59 9.59 0 012.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482C19.138 20.203 22 16.447 22 12.021 22 6.484 17.523 2 12 2z" />
              </svg>
            </a>

            <ThemeToggle />

            {/* Hamburger — mobile only */}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? t.nav.closeMenu : t.nav.openMenu}
              className="md:hidden w-8 h-8 flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent rounded-sm"
            >
              {/* Inner div fixes the geometry: h-[13px] = 3×1px lines + 2×5px gaps.
                  Center at 6.5px from top → both lines translate exactly 6px. */}
              <div
                aria-hidden="true"
                className="w-5 h-[13px] flex flex-col justify-between"
              >
                <span
                  className={[
                    'block h-px w-full bg-fg origin-center',
                    'motion-safe:transition-transform motion-safe:duration-200',
                    menuOpen ? 'translate-y-[6px] rotate-45' : '',
                  ].join(' ')}
                />
                <span
                  className={[
                    'block h-px w-full bg-fg',
                    'motion-safe:transition-opacity motion-safe:duration-200',
                    menuOpen ? 'opacity-0' : '',
                  ].join(' ')}
                />
                <span
                  className={[
                    'block h-px w-full bg-fg origin-center',
                    'motion-safe:transition-transform motion-safe:duration-200',
                    menuOpen ? '-translate-y-[6px] -rotate-45' : '',
                  ].join(' ')}
                />
              </div>
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile menu panel */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            id="mobile-menu"
            role="dialog"
            aria-modal="false"
            aria-label="Mobile navigation"
            className="md:hidden fixed top-16 left-0 right-0 z-40 bg-bg border-b border-border"
            initial={{ opacity: 0, y: prefersReduced ? 0 : -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: prefersReduced ? 0 : -6 }}
            transition={{ duration: prefersReduced ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <nav
              aria-label={t.nav.openMenu}
              className="px-8 py-2 max-w-[1920px] mx-auto"
            >
              <ul role="list" className="divide-y divide-border">
                {links.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center font-mono text-base text-muted hover:text-fg py-4 transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 rounded-sm"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
                <li>
                  <a
                    href="https://github.com/Bogbra/ai-dev-portfolio"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 font-mono text-base text-muted hover:text-fg py-4 transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 rounded-sm"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M12 2C6.477 2 2 6.484 2 12.021c0 4.428 2.865 8.185 6.839 9.504.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844a9.59 9.59 0 012.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482C19.138 20.203 22 16.447 22 12.021 22 6.484 17.523 2 12 2z" />
                    </svg>
                    GitHub
                  </a>
                </li>
              </ul>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
