'use client';

import Link from 'next/link';
import { useLang } from '@/lib/i18n';

export function Footer() {
  const { t } = useLang();

  return (
    <footer className="px-8 md:px-16 lg:px-20 py-8 border-t border-border">
      <div className="max-w-[1920px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="font-mono text-sm text-subtle">{t.footer.copyright}</span>

        <nav aria-label="Legal" className="flex items-center gap-5">
          <Link
            href="/impressum"
            className="font-mono text-sm text-subtle hover:text-muted transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 rounded-sm"
          >
            {t.footer.impressum}
          </Link>
          <Link
            href="/datenschutz"
            className="font-mono text-sm text-subtle hover:text-muted transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 rounded-sm"
          >
            {t.footer.privacy}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
