import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Datenschutz',
  description: 'Datenschutzerklärung gemäß DSGVO.',
  robots: { index: false, follow: false },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="font-display text-xl font-650 text-fg mb-4">{title}</h2>
      <div className="space-y-4 text-base md:text-lg text-muted leading-[1.75]">{children}</div>
    </section>
  );
}

function Divider() {
  return <div className="h-px bg-border mb-12" />;
}

export default function DatenschutzPage() {
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
          <h1 className="font-display text-4xl md:text-5xl font-bold text-fg tracking-tight leading-tight mb-4">
            Datenschutz&shy;erklärung
          </h1>
          <p className="text-base md:text-lg text-muted leading-[1.75] mb-16">
            Informationen zum Umgang mit personenbezogenen Daten gemäß
            Art. 13 DSGVO.
          </p>

          {/* 1. Verantwortlicher */}
          <Section title="1. Verantwortlicher">
            <p>
              Verantwortlich für die Datenverarbeitung auf dieser Website ist:
            </p>
            <p className="font-mono text-base text-muted border border-border rounded-md px-4 py-3">
              Dana Schmitt<br />
              Herrleinstraße 17, 63739 Aschaffenburg, Deutschland<br />
              dana-schmitt@outlook.de
            </p>
          </Section>

          <Divider />

          {/* 2. Hosting */}
          <Section title="2. Hosting">
            <p>
              Diese Website wird bei <strong className="text-fg font-medium">Vercel Inc.</strong>,
              440 N Barranca Ave #4133, Covina, CA 91723, USA, gehostet.
              Beim Abruf von Seiten werden durch den Hosting-Anbieter automatisch
              Server-Protokolldaten erfasst, darunter IP-Adresse, aufgerufene URL,
              Zeitpunkt des Zugriffs und übertragene Datenmenge.
            </p>
            <p>
              Diese Daten werden ausschließlich zur Sicherstellung des Betriebs und der
              Sicherheit des Dienstes verarbeitet. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f
              DSGVO (berechtigtes Interesse). Weitere Informationen finden sich in der
              Datenschutzerklärung von Vercel:{' '}
              <span className="font-mono text-base">vercel.com/legal/privacy-policy</span>
            </p>
          </Section>

          <Divider />

          {/* 3. Kontaktformular */}
          <Section title="3. Kontaktformular">
            <p>
              Bei Nutzung des Kontaktformulars werden folgende personenbezogene Daten
              erhoben und verarbeitet:
            </p>
            <ul className="list-none space-y-1 pl-4 border-l border-border">
              <li>Name</li>
              <li>E-Mail-Adresse</li>
              <li>Nachrichtentext</li>
            </ul>
            <p>
              <strong className="text-fg font-medium">Zweck:</strong> Die Daten werden
              ausschließlich zur Bearbeitung und Beantwortung der Anfrage verwendet.
            </p>
            <p>
              <strong className="text-fg font-medium">Rechtsgrundlage:</strong> Art. 6
              Abs. 1 lit. a DSGVO — die Verarbeitung erfolgt auf Basis Ihrer ausdrücklichen
              Einwilligung, die vor dem Absenden des Formulars erteilt wird. Die Einwilligung
              kann jederzeit widerrufen werden.
            </p>
            <p>
              <strong className="text-fg font-medium">E-Mail-Versand:</strong> Formulareingaben
              werden über den Dienst <strong className="text-fg font-medium">Resend</strong>
              {' '}(Resend Inc., USA) als E-Mail übermittelt. Sofern ein
              Auftragsverarbeitungsvertrag (AVV/DPA) geschlossen wurde, erfolgt die
              Verarbeitung im Rahmen einer Auftragsverarbeitung. Weitere Informationen:{' '}
              <span className="font-mono text-base">resend.com/legal/privacy-policy</span>
            </p>
            <p>
              <strong className="text-fg font-medium">Speicherdauer:</strong> Die übermittelten
              Daten werden nicht mehr als erforderlich auf Servern dieser Website gespeichert. Die E-Mail
              wird entsprechend den üblichen E-Mail-Aufbewahrungsfristen behandelt und nach
              Abschluss der Korrespondenz gelöscht, sofern keine gesetzliche
              Aufbewahrungspflicht besteht.
            </p>
          </Section>

          <Divider />

          {/* 4. KI-Workflow-Demo */}
          <Section title="4. KI-Workflow-Demo (AI Operations Workflow Agent)">
            <p>
              Diese Website enthält eine interaktive Demo eines KI-basierten E-Mail-Workflow-Agenten.
              Bei Nutzung dieser Demo können folgende Daten verarbeitet werden:
            </p>
            <ul className="list-none space-y-1 pl-4 border-l border-border">
              <li>Hochgeladene CSV- oder XLSX-Dateien mit Kontaktdaten (Name, E-Mail, optional: Abteilung, Rolle, Unternehmen, Notizen)</li>
              <li>Die eingegebene natürlichsprachige Anfrage</li>
              <li>Der generierte E-Mail-Entwurf</li>
            </ul>
            <p>
              <strong className="text-fg font-medium">Verarbeitung:</strong> Die hochgeladenen Kontaktdaten
              werden ausschließlich für den jeweiligen Workflow-Durchlauf verwendet und
              <strong className="text-fg font-medium"> nicht dauerhaft gespeichert</strong>.
              Die Verarbeitung erfolgt im Arbeitsspeicher des Servers und die Daten werden nach
              Abschluss des Requests verworfen.
            </p>
            <p>
              <strong className="text-fg font-medium">KI-Dienstleister:</strong> Sofern KI-gestützte
              Textgenerierung aktiv ist, werden Anfrage und Kontaktdaten (ohne dauerhaften Speicher)
              an die API von <strong className="text-fg font-medium">OpenAI, Inc.</strong> (USA) übermittelt.
              Ist kein API-Schlüssel konfiguriert, erfolgt die Verarbeitung vollständig lokal auf dem
              Server ohne Drittanbieter-Übermittlung.
              Weitere Informationen zu OpenAI:{' '}
              <span className="font-mono text-base">openai.com/policies/privacy-policy</span>
            </p>
            <p>
              <strong className="text-fg font-medium">Web-Kontextsuche (optional):</strong> Nutzerinnen
              und Nutzer können optional die Funktion &bdquo;Enrich draft with web context&ldquo; aktivieren.
              In diesem Fall wird ein aus der Anfrage extrahiertes <em>Thema</em> (z.&nbsp;B. &bdquo;Q3-Budget-Review&ldquo;)
              an die API von <strong className="text-fg font-medium">Tavily Inc.</strong> (USA) übermittelt,
              um aktuellen Hintergrundkontext für den Entwurf zu recherchieren.
              Die hochgeladene Kontaktliste wird dabei nicht bewusst einbezogen, E-Mail-ähnliche
              Zeichenfolgen werden aus dem extrahierten Thema entfernt. Der Freitext der Anfrage
              kann technisch bedingt dennoch personenbezogene Angaben enthalten, falls Nutzerinnen
              und Nutzer solche im freien Anfragetext angeben; hiervon wird abgeraten.
              Die Funktion ist standardmäßig deaktiviert und wird nur auf ausdrücklichen Wunsch ausgeführt.
              Ist kein Tavily-API-Schlüssel konfiguriert, bleibt die Funktion ohne Wirkung.
              Weitere Informationen:{' '}
              <span className="font-mono text-base">tavily.com/privacy</span>
            </p>
            <p>
              <strong className="text-fg font-medium">E-Mail-Versand:</strong> Der automatische
              E-Mail-Versand ist in der öffentlichen Demo deaktiviert. Genehmigte Entwürfe
              können ausschließlich in die Zwischenablage kopiert werden.
            </p>
            <p>
              <strong className="text-fg font-medium">Logs:</strong> Es werden ausschließlich
              anonymisierte Statusereignisse protokolliert (z. B. workflow_started, draft_generated).
              Personenbezogene Daten (Kontaktinformationen, Anfragetexte, Entwurfsinhalte)
              erscheinen nicht in Logs.
            </p>
            <p>
              <strong className="text-fg font-medium">Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. a
              DSGVO — die Verarbeitung erfolgt auf Basis freiwilliger Nutzung der Demo-Funktion.
            </p>
            <p>
              Für den Multi-Agenten-Workflow (Case Study 02) gilt dasselbe Prinzip: Wenn serverseitig
              ein Web-Suchschlüssel konfiguriert ist, wird ausschließlich das eingegebene Thema
              recherchiert — keine Personen, Profile oder privaten Daten. Generierte LinkedIn-Entwürfe
              werden nicht gespeichert und nicht automatisch veröffentlicht. Es besteht keine Verbindung
              zu LinkedIn-Konten.
            </p>
            <p>
              Für den RAG-Forschungsassistenten (Case Study 03) gilt: Hochgeladene PDFs werden
              ausschließlich zur Beantwortung der eingegebenen Frage verarbeitet. Sie werden nicht
              dauerhaft gespeichert und nicht an andere Nutzer weitergegeben. Wenn der Live-Modus
              aktiv ist, werden extrahierte Textabschnitte zur Erstellung von Embeddings an den
              konfigurierten KI-Anbieter gesendet. Vertrauliche Dokumente sollten nicht in der
              öffentlichen Demo hochgeladen werden.
            </p>
          </Section>

          <Divider />

          {/* 5. Voice Agent Lab */}
          <Section title="5. Voice Agent Lab">
            <p>
              Diese Website enthält ein interaktives Voice-Agent-Lab. Bei Nutzung dieser Funktion
              werden folgende Daten verarbeitet:
            </p>
            <ul className="list-none space-y-1 pl-4 border-l border-border">
              <li>Aufgezeichnete Audiodaten (Mikrofoneingabe, max. 20 Sekunden)</li>
              <li>Das erzeugte Transkript der Spracheingabe</li>
              <li>Der klassifizierte Intent und Sicherheitsstatus</li>
              <li>Die generierte Textantwort und synthetisierte Sprachausgabe</li>
            </ul>
            <p>
              <strong className="text-fg font-medium">Aufnahme:</strong> Die Mikrofoneingabe erfolgt
              ausschließlich auf ausdrückliche Nutzerinteraktion (Klick auf &bdquo;Start recording&ldquo;).
              Es findet keine automatische oder Hintergrundaufnahme statt. Die Audiodaten werden
              im Browser als Base64 kodiert und direkt an den Backend-Dienst übermittelt.
            </p>
            <p>
              <strong className="text-fg font-medium">Kein dauerhafter Speicher:</strong> Audiodaten
              werden{' '}<strong className="text-fg font-medium">nicht dauerhaft gespeichert</strong>.
              Die Verarbeitung erfolgt vollständig im Arbeitsspeicher des Servers. Nach Abschluss
              des Requests werden alle Audiodaten verworfen.
            </p>
            <p>
              <strong className="text-fg font-medium">KI-Dienstleister (OpenAI):</strong> Sofern ein
              API-Schlüssel konfiguriert ist, werden folgende Daten an{' '}
              <strong className="text-fg font-medium">OpenAI, Inc.</strong> (USA) übermittelt:
            </p>
            <ul className="list-none space-y-1 pl-4 border-l border-border">
              <li>Audiodaten → Whisper-API (Spracherkennung / STT)</li>
              <li>Transkripttext → Chat-API (Intent-Klassifizierung und Antwortgenerierung)</li>
              <li>Antworttext → TTS-API (Sprachsynthese)</li>
            </ul>
            <p>
              Alle drei Dienste werden über einen serverseitig konfigurierten OpenAI-API-Schlüssel
              abgerufen (<span className="font-mono text-base">OPENAI_API_KEY</span> oder ein
              separater{' '}<span className="font-mono text-base">VOICE_OPENAI_API_KEY</span>{' '}
              für Whisper/TTS). Keine der verarbeiteten Daten wird durch OpenAI dauerhaft gespeichert, soweit
              die Data-Retention-Richtlinie von OpenAI keine Ausnahmen vorsieht.
              Weitere Informationen:{' '}
              <span className="font-mono text-base">openai.com/policies/privacy-policy</span>
            </p>
            <p>
              <strong className="text-fg font-medium">Hinweis:</strong> In der öffentlichen Demo
              sollten keine vertraulichen, personenbezogenen oder sensiblen Informationen
              gesprochen werden. Das Demo ist für technische Demonstrationszwecke vorgesehen.
            </p>
            <p>
              Ist kein API-Schlüssel konfiguriert, steht das Voice-Agent-Lab nicht zur Verfügung
              und es werden keinerlei Audiodaten verarbeitet.
            </p>
            <p>
              <strong className="text-fg font-medium">Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. a
              DSGVO — die Verarbeitung erfolgt auf Basis freiwilliger Nutzung der Demo-Funktion
              durch aktive Interaktion mit der Aufnahme-Schaltfläche.
            </p>
          </Section>

          <Divider />

          {/* 6. SEO Strategy Lab */}
          <Section title="6. AI SEO Strategy Lab">
            <p>
              Diese Website enthält ein interaktives SEO-Strategy-Lab. Bei Nutzung dieser Funktion
              können folgende Daten verarbeitet werden:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Eingegebene Geschäftsbeschreibung und Zielgruppenbeschreibung</li>
              <li>Ausgewähltes Markt/Sprache-Feld und SEO-Ziel</li>
              <li>Optionale Website-URL (wird nicht gecrawlt oder gespeichert)</li>
            </ul>
            <p>
              Die eingegebenen Daten werden ausschließlich für den jeweiligen Analyse-Durchlauf
              verwendet und <strong className="text-fg font-medium">nicht dauerhaft gespeichert</strong>.
              Es erfolgt keine Speicherung in localStorage, sessionStorage oder einer Datenbank.
            </p>
            <p>
              Wenn serverseitig ein OpenAI-API-Schlüssel konfiguriert ist, werden die eingegebenen
              Texte zur Verarbeitung an die API von{' '}
              <strong className="text-fg font-medium">OpenAI, Inc.</strong> (USA) übermittelt, um
              Keyword-Analyse, Intent-Clustering und Prioritätsempfehlungen zu generieren. Ohne
              API-Schlüssel wird ausschließlich ein vorberechnetes Musterresultat zurückgegeben.
            </p>
            <p>
              Die angezeigten Opportunity-Scores sind{' '}
              <strong className="text-fg font-medium">KI-gestützte Priorisierungssignale</strong>,
              keine echten Suchanfragenvolumen- oder Schwierigkeitswerte. Es werden keine Daten
              von externen SEO-Datenprovidern (Semrush, Ahrefs, Google Ads etc.) abgerufen.
            </p>
            <p>
              <strong className="text-fg font-medium">Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. a
              DSGVO — die Verarbeitung erfolgt auf Basis freiwilliger Nutzung der Demo-Funktion
              durch aktive Formulareingabe.
            </p>
          </Section>

          <Divider />

          {/* 7. Schriftarten */}
          <Section title="7. Schriftarten">
            <p>
              Diese Website verwendet Web-Schriftarten (Google Fonts: Geist, Inter, IBM Plex Mono).
              Die Schriftdateien werden beim Build der Website heruntergeladen und
              <strong className="text-fg font-medium"> selbst gehostet</strong> —
              beim Aufruf der Website werden keine Anfragen an Google-Server gesendet.
              Es findet keine Übermittlung personenbezogener Daten an Dritte statt.
            </p>
          </Section>

          <Divider />

          {/* 6. Cookies und Tracking */}
          <Section title="8. Cookies, Tracking und Analyse">
            <p>
              Diese Website setzt <strong className="text-fg font-medium">keine Tracking-Cookies</strong>.
              Es gibt kein Google Analytics, keine Werbe-Pixel und keine Cross-Site-Tracking-Dienste.
            </p>
            <p>
              <strong className="text-fg font-medium">Vercel Analytics:</strong> Diese Website nutzt
              Vercel Web Analytics, einen datenschutzfreundlichen Analysedienst von{' '}
              <strong className="text-fg font-medium">Vercel Inc.</strong>, 440 N Barranca Ave #4133,
              Covina, CA 91723, USA. Vercel Analytics erfasst aggregierte Seitenaufrufzahlen,
              Besucherzahlen, Herkunftsland und verwendetes Gerät — ohne Cookies, ohne
              Nutzer-IDs und ohne geräteübergreifendes Tracking. Es werden keine personenbezogenen
              Daten dauerhaft gespeichert. Die Messung erfolgt auf Basis anonymisierter technischer
              Daten. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der
              anonymen Nutzungsanalyse zur Verbesserung des Angebots). Weitere Informationen:{' '}
              <span className="font-mono text-base">vercel.com/legal/privacy-policy</span>
            </p>
            <p>
              Im Browserspeicher (<span className="font-mono text-base">localStorage</span>) werden
              ausschließlich die Themenauswahl (hell/dunkel) und die Sprachauswahl (DE/EN) gespeichert.
              Diese Daten verlassen nie den Browser und werden nicht übermittelt.
            </p>
          </Section>

          <Divider />

          {/* 7. Rechte */}
          <Section title="9. Ihre Rechte">
            <p>
              Sie haben gegenüber dem Verantwortlichen folgende Rechte hinsichtlich
              der Sie betreffenden personenbezogenen Daten:
            </p>
            <ul className="list-none space-y-2 pl-4 border-l border-border">
              <li>
                <strong className="text-fg font-medium">Auskunft</strong> — Art. 15 DSGVO:
                Sie können Auskunft über die verarbeiteten Daten verlangen.
              </li>
              <li>
                <strong className="text-fg font-medium">Berichtigung</strong> — Art. 16 DSGVO:
                Sie können die Berichtigung unrichtiger Daten verlangen.
              </li>
              <li>
                <strong className="text-fg font-medium">Löschung</strong> — Art. 17 DSGVO:
                Sie können die Löschung Ihrer Daten verlangen.
              </li>
              <li>
                <strong className="text-fg font-medium">Einschränkung</strong> — Art. 18 DSGVO:
                Sie können die Einschränkung der Verarbeitung verlangen.
              </li>
              <li>
                <strong className="text-fg font-medium">Widerspruch</strong> — Art. 21 DSGVO:
                Sie können der Verarbeitung widersprechen.
              </li>
              <li>
                <strong className="text-fg font-medium">Widerruf</strong> — Art. 7 Abs. 3 DSGVO:
                Eine erteilte Einwilligung kann jederzeit mit Wirkung für die Zukunft widerrufen
                werden.
              </li>
              <li>
                <strong className="text-fg font-medium">Beschwerde</strong> — Art. 77 DSGVO:
                Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren.
              </li>
            </ul>
            <p>
              Zur Ausübung Ihrer Rechte wenden Sie sich bitte an die oben genannte
              Kontaktadresse.
            </p>
          </Section>

          <Divider />

          {/* 7. Aktualität */}
          <Section title="10. Aktualität dieser Erklärung">
            <p>
              Diese Datenschutzerklärung ist aktuell gültig. Bei Änderungen der Website oder
              relevanter rechtlicher Anforderungen wird diese Erklärung aktualisiert.
            </p>
          </Section>

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
