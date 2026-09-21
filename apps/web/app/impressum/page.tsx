import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Impressum',
  description: 'Impressum und Anbieterkennzeichnung gemäß § 5 DDG.',
  robots: { index: false, follow: false },
};

export default function ImpressumPage() {
  return (
    <main id="main-content" lang="de" className="py-24 md:py-32 px-8 md:px-16 lg:px-20">
      <div className="max-w-[1920px] mx-auto">
        <div className="max-w-2xl">

          <Link
            href="/"
            className="font-mono text-sm text-muted hover:text-fg transition-colors duration-150 mb-12 inline-block focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 rounded-sm"
          >
            ← Zurück
          </Link>

          <p className="font-mono text-sm text-muted tracking-[0.18em] uppercase mb-4">
            Legal
          </p>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-fg tracking-tight leading-tight mb-16">
            Impressum
          </h1>

          {/* Angaben gemäß § 5 DDG (Digitale-Dienste-Gesetz — replaced the TMG's
              general provider-identification duties in 2024) */}
          <section className="mb-12">
            <h2 className="font-display text-xl font-650 text-fg mb-4">
              Angaben gemäß § 5 DDG
            </h2>
            <div className="space-y-1 text-base md:text-lg text-muted leading-[1.75]">
              <p>Dana Schmitt</p>
              <p>Herrleinstraße 17</p>
              <p>63739 Aschaffenburg</p>
              <p>Deutschland</p>
            </div>
          </section>

          <div className="h-px bg-border mb-12" />

          {/* Kontakt */}
          <section className="mb-12">
            <h2 className="font-display text-xl font-650 text-fg mb-4">
              Kontakt
            </h2>
            <p className="text-base md:text-lg text-muted leading-[1.75]">
              E-Mail: <a href="mailto:dana-schmitt@outlook.de" className="underline underline-offset-2 hover:text-fg transition-colors duration-150">dana-schmitt@outlook.de</a>
            </p>
          </section>

          <div className="h-px bg-border mb-12" />

          {/* Urheberrecht */}
          <section className="mb-12">
            <h2 className="font-display text-xl font-650 text-fg mb-4">
              Urheberrecht
            </h2>
            <p className="text-base md:text-lg text-muted leading-[1.75]">
              Die durch den Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten
              unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung,
              Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes
              bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
            </p>
          </section>

          <div className="h-px bg-border mb-12" />

          {/* Haftungsausschluss — still references TMG §7/§§8-10. The DDG that
              replaced the TMG's general provider-ID duties (§5, fixed above)
              doesn't map these liability paragraphs 1:1; left as-is pending
              a proper legal review rather than guessing new paragraph
              numbers. */}
          <section className="mb-12">
            <h2 className="font-display text-xl font-650 text-fg mb-4">
              Haftung für Inhalte
            </h2>
            <p className="text-base md:text-lg text-muted leading-[1.75]">
              Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen
              Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir
              als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde
              Informationen zu überwachen oder nach Umständen zu forschen, die auf eine
              rechtswidrige Tätigkeit hinweisen.
            </p>
          </section>

          <div className="h-px bg-border mb-12" />

          {/* Haftung für Links */}
          <section className="mb-12">
            <h2 className="font-display text-xl font-650 text-fg mb-4">
              Haftung für Links
            </h2>
            <p className="text-base md:text-lg text-muted leading-[1.75]">
              Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir
              keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine
              Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige
              Anbieter oder Betreiber der Seiten verantwortlich.
            </p>
          </section>

          <Link
            href="/"
            className="font-mono text-sm text-muted hover:text-fg transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 rounded-sm"
          >
            ← Zurück zur Startseite
          </Link>

        </div>
      </div>
    </main>
  );
}
