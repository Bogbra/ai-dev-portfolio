'use client';

import { useLang } from '@/lib/i18n';
import { AiOpsWorkflow } from '@/components/work/ai-ops/AiOpsWorkflow';
import {
  SectionLabel, SectionHeading, Divider, PDRCard, ArchStep,
  FlowNode, FlowArrow, StateDoc, StateGroup, TechNote,
} from '@/components/work/CaseStudyPrimitives';
import { CaseStudyBackLink, CaseStudyEyebrow, CaseStudyFooterNav } from '@/components/work/CaseStudyChrome';

function FlowDiagram() {
  return (
    <div className="border border-border rounded-lg bg-bg p-8 font-mono">
      <div className="flex flex-col">
        <FlowNode label="START" accent />
        <FlowArrow />
        <FlowNode label="validate_upload" />
        <FlowArrow />
        <FlowNode label="parse_contacts" />
        <FlowArrow />
        <FlowNode label="extract_intent" />
        <FlowArrow />
        <FlowNode label="resolve_contact" />
        <div className="mt-3 ml-4 space-y-3 border-l border-border pl-4">
          {[
            { condition: 'exact_match', next: 'generate_draft' },
            { condition: 'ambiguous', next: 'require_confirmation' },
            { condition: 'not_found', next: 'safe_stop' },
          ].map(({ condition, next }) => (
            <div key={condition} className="flex flex-col gap-1">
              <span className="text-subtle text-sm">if {condition}:</span>
              <div className="border border-border rounded px-3 py-1 text-sm text-muted bg-surface self-start">
                {next}
              </div>
            </div>
          ))}
        </div>
        <FlowArrow />
        <FlowNode label="validate_draft" />
        <FlowArrow />
        <FlowNode label="human_review" />
        <FlowArrow />
        <FlowNode label="approved" />
        <FlowArrow />
        <FlowNode label="END" accent />
      </div>
    </div>
  );
}

const c = {
  en: {
    ariaIntro: 'Case study introduction',
    tagline: 'A fullstack LLM application for structured business workflows: upload CSV/XLSX contacts, resolve recipients, review context, and generate personalised email drafts — with a Python/FastAPI backend, structured outputs, human review, and clear security boundaries.',
    tags: ['LLM Workflow', 'Python/FastAPI', 'Structured Outputs', 'Human Review', 'Next.js'],
    ariaDetails: 'Project details',
    sectionDetails: 'Project details',
    metaItems: [
      { label: 'Status', value: 'Live deployment — Vercel + Railway' },
      { label: 'Type', value: 'Fullstack LLM application (self-initiated)' },
      { label: 'Role', value: 'Next.js frontend, Python/FastAPI backend, LLM workflow design, deployment' },
      { label: 'Focus', value: 'CSV/XLSX processing · Contact resolution · Structured outputs · Human review' },
      { label: 'Stack', value: 'Next.js · TypeScript · Python · FastAPI · OpenAI API · Zod · Docker · Railway · Vercel' },
      { label: 'Safety', value: 'Rate limits · Mock/live mode · No automatic email sending' },
    ],
    ariaLive: 'Live workflow application',
    sectionLive: 'Live Application',
    headingLive: 'Live workflow',
    liveIntroPart1: 'The LLM call is embedded in a controlled backend workflow: inputs are validated, contact data is securely delimited, and results are returned as structured outputs before being shown to the user for review. Optionally enable',
    liveIntroHighlight: 'web context enrichment',
    liveIntroPart2: 'to search the email topic online — contact records are not deliberately included in the search query, and email-like strings are removed from the extracted topic. Users should avoid personal data in the free-text request.',
    downloadLabel: 'Download sample CSV',
    exampleLabel: 'Example request:',
    exampleRequest: '”Write an email to John about the product launch”',
    modeActive: 'Mock mode active by default',
    modeSuffix: '— when no LLM API key is configured server-side, drafts are generated with deterministic fallback logic. No external API call is made. Set',
    modeEnvKey: 'OPENAI_API_KEY',
    modeApp: 'apps/ai',
    modeEnd: 'to enable live LLM mode.',
    safetyTitle: 'Public demo safety constraints',
    safetyItems: [
      'Upload limit: CSV or XLSX only, max 1 MB, max 100 contacts — processed in memory, never stored permanently',
      'Rate limits: 5 workflow runs per IP per hour, 20 uploads per IP per hour — enforced server-side in Python/FastAPI',
      'No emails are sent automatically — approved drafts can only be copied',
      'Unsafe requests (spam, impersonation, mass send) are blocked before any LLM call',
      'Optional web context sends only an extracted topic string to Tavily; email-like strings are removed and contact records are not deliberately included — users should avoid personal data in the free-text request',
      'All inputs validated with Zod (Node) and Pydantic (Python) on the backend — uploaded data is treated as untrusted',
    ],
    ariaPDR: 'Problem, decision, and result',
    sectionPDR: 'PDR',
    headingPDR: 'Problem → Decision → Result',
    pdrCards: [
      { label: 'Problem', text: 'Business teams work with unstructured CSV/XLSX data and vague requests. Simple automations fail when names are ambiguous or when generated output needs human review before any action is triggered.' },
      { label: 'Decision', text: 'Built a fullstack LLM application: Next.js frontend for upload and review, Python/FastAPI backend for validation and LLM calls, structured outputs via OpenAI tool-use, and an explicit human review step before any action — with rate limits and mock/live mode.' },
      { label: 'What it demonstrates', text: 'How a code-based LLM application turns unstructured requests into safe, reviewable actions — controlled, not automated. Every state is typed, every boundary is explicit, and the LLM never acts without user approval.' },
    ],
    ariaArch: 'Workflow architecture',
    sectionArch: 'Architecture',
    headingArch: 'Workflow architecture',
    controlFlow: 'Control flow',
    archSteps: [
      { num: '01', title: 'Upload & validate', description: 'Next.js sends the file as a base64 JSON payload to Python/FastAPI. The backend validates size, type, and MIME type, then parses CSV or XLSX. Required columns: name, email. Data is normalised and returned as a typed array — never written to disk.' },
      { num: '02', title: 'Parse request', description: 'The user request is sent to the backend alongside the contact list. Input length is capped at 500 characters and unsafe patterns are blocked with Pydantic before the LLM is called.' },
      { num: '03', title: 'Resolve contact (LLM)', description: 'Python/FastAPI calls OpenAI with tool-use, forcing a structured JSON response. Contact data is enclosed in XML delimiters to reduce prompt-injection risk. Returns: exact_match | ambiguous | not_found.' },
      { num: '04', title: 'Handle ambiguity', description: 'If multiple contacts match equally, all options are returned with a suggested match and reasoning. The user must confirm before draft generation continues — no automatic selection.' },
      { num: '05', title: 'Generate draft (LLM)', description: 'A second OpenAI tool-use call generates a structured email draft: subject, body, tone. Body is capped at 1,500 characters server-side. The result is a typed structured output, not free text.' },
      { num: '06', title: 'Human review', description: 'All draft fields are editable in the Next.js UI before approval. The user can regenerate, copy, or approve. Approval is required — the LLM cannot trigger any action on its own.' },
      { num: '07', title: 'Safe stop', description: 'The public demo does not send emails (ENABLE_EMAIL_SENDING=false). Approved drafts can only be copied. The repository documents how to connect the approved draft to Resend in a private deployment.' },
    ],
    ariaStates: 'Workflow states',
    sectionStates: 'Interface states',
    headingStates: 'Workflow states',
    stateGroups: [
      {
        label: 'Input',
        states: [
          { label: 'idle', description: 'Upload zone visible. No file loaded. All 12 states typed as a discriminated union — no undefined state possible.' },
          { label: 'uploading', description: 'File sent to Python/FastAPI backend. Skeleton shown in output panel. State transition only on successful parse response.' },
          { label: 'ready', description: 'Contacts loaded and validated. Count visible, list shown. Request input enabled.' },
        ],
      },
      {
        label: 'Agent',
        states: [
          { label: 'running', description: 'LLM workflow executing in Python/FastAPI backend. Request locked. Loading state shown — not a blackbox, each step has a defined typed result.' },
          { label: 'ambiguous', description: 'Multiple contacts match. All options shown with LLM-generated suggestion and reasoning. User confirms before draft generation.', example: '”John” matched: John Smith — R&D · John Doe — HR. Suggestion: John Smith (product update context).' },
          { label: 'no_contact_found', description: 'No match found. Workflow stops cleanly. User can adjust the request and retry.' },
          { label: 'draft_ready', description: 'Structured output received from LLM. All fields editable before approval. Confidence indicator visible.' },
        ],
      },
      {
        label: 'Review',
        states: [
          { label: 'approved', description: 'Draft approved by user. Summary shown. Copy action available. Sending disabled in public demo (ENABLE_EMAIL_SENDING=false).' },
        ],
      },
      {
        label: 'Safety',
        states: [
          { label: 'rate_limited', description: 'Rate limit reached (5 runs/IP/hour). Safe message shown, no internal details exposed. Reset available. Per IP by design — real per-user fairness would need login.' },
          { label: 'upload_error', description: 'File rejected by Python/FastAPI backend. Clear message: wrong type, too large, or no valid contacts found.' },
          { label: 'unsafe', description: 'Request blocked by Pydantic validation before any LLM call — matches spam, mass email, or impersonation pattern.' },
          { label: 'error', description: 'Network or backend error. Safe user-facing message. No stack traces or internal details exposed to the client.' },
        ],
      },
    ],
    ariaSafety: 'Guardrails and operational constraints',
    sectionSafety: 'Guardrails & limits',
    headingSafety: 'Public demo guardrails',
    safetyIntro: 'The public demo is intentionally constrained. The goal is to show a working LLM workflow that can be tested safely — without enabling spam, unlimited LLM usage, or unnecessary data exposure. Guardrails and rate limits are two different things here: guardrails constrain what the model is structurally able to do; rate limits constrain how often it can be called.',
    techSafety: [
      { title: 'Guardrails', items: ['Keyword pre-filter blocks obvious cases (spam, mass email, impersonation) before any LLM call — a cheap heuristic, not the actual security boundary', 'Contact data is explicitly delimited and treated as untrusted input to reduce prompt-injection risk', 'OpenAI tool-use enforces a typed structured output schema — the model cannot return free text', 'resolvedContact is validated against the uploaded list server-side — the model cannot invent a contact', 'Output tokens capped explicitly — email body limited to 1,500 characters', 'Timeout handling stops the workflow safely if the LLM call hangs'] },
      { title: 'File limits', items: ['Accepted: .csv and .xlsx only — type validated by extension and MIME type in Python/FastAPI', 'Maximum size: 1 MB per upload', 'Maximum rows: 100 contacts per workflow run', 'Required columns: name, email — invalid emails are rejected by Pydantic', 'Files are parsed in memory and never written to disk or stored permanently'] },
      { title: 'Rate limits', items: ['5 workflow runs per IP per hour — enforced by SlowAPI in Python/FastAPI', '20 uploads per IP per hour', 'Request text capped at 500 characters before any LLM call', 'Honeypot field silently discards bot submissions without revealing the check', 'Mock/live mode: no external LLM calls when OPENAI_API_KEY is absent'] },
      { title: 'Email safety', items: ['No emails sent automatically — ENABLE_EMAIL_SENDING=false on live deployment', 'Approved drafts can only be copied, never auto-sent to uploaded contacts', 'Repository documents how to connect Resend in a private/admin environment', 'Sending restricted to verified addresses in any controlled deployment', 'Contact records are not deliberately sent to any external search API — only an extracted topic string, with email-like strings removed'] },
    ],
    ariaImpl: 'Technical implementation',
    sectionImpl: 'Technical implementation',
    headingImpl: 'Implementation details',
    implIntro: 'The application separates concerns clearly: Next.js owns the interface and review flow, Python/FastAPI owns the LLM calls and validation, and the LLM is constrained to producing structured outputs only.',
    techImpl: [
      { title: 'Frontend (Next.js)', items: ['12 explicit workflow stages tracked as TypeScript discriminated union', 'No external state library — useState + discriminated union covers all states', 'All async actions are async/void — no unhandled promise rejections', 'Live ARIA region announces state transitions for screen readers', 'All interactive elements keyboard accessible with visible focus states'] },
      { title: 'AI backend (Python/FastAPI)', items: ['Two OpenAI tool-use calls: one for contact resolution, one for draft generation', 'Contact data enclosed in XML delimiters — reduces prompt-injection risk', 'Pydantic models validate all request bodies — unknown fields rejected', 'SlowAPI enforces per-route rate limits server-side', 'Mock mode returns deterministic output when OPENAI_API_KEY is absent'] },
      { title: 'LLM design', items: ['Structured outputs via OpenAI tool_use — JSON response schema enforced', 'Status field: exact_match | ambiguous | not_found (resolution call)', 'Structured fields: subject, body, tone (draft generation call)', 'resolvedContact validated against uploaded data — LLM cannot invent contacts', 'Body capped at 1,500 characters server-side to control output length'] },
      { title: 'Rate limiting', items: ['SlowAPI (Python/FastAPI) per route: 5 runs/hour, 20 uploads/hour', 'Global 100 req/min limit covers all other endpoints', 'Node/Fastify handles contact form rate limits separately', 'Rate limit responses expose safe messages without internal details', 'No shared state needed — per-IP limits enforced by SlowAPI middleware'] },
      { title: 'File ingestion', items: ['Client sends file as base64 JSON payload — avoids multipart complexity', 'Python/FastAPI decodes, validates size and MIME type, then parses with openpyxl/csv', 'normalise_contacts() sanitises all fields and validates email format with Pydantic', 'Contacts returned as a typed array to Next.js — never stored on disk', 'Both CSV and XLSX parsed through a unified normalisation pipeline'] },
      { title: 'Optional web context', items: ['Opt-in Tavily search enriches drafts with current topic context', 'extractSearchTopic() strips email addresses and never includes the uploaded contact list — but free-text names or details the user types are not detected or removed', 'A best-effort extracted topic is sent, not a data-loss guarantee — falls back to a truncated version of the request if no extraction pattern matches', 'German and English keyword patterns handled for topic extraction', 'Checkbox off by default — no external call unless explicitly enabled by the user'] },
    ],
    ariaRepo: 'Repository documentation',
    sectionRepo: 'Repository',
    headingRepo: 'Repository proof',
    repoPara1: 'The full implementation lives in the monorepo under apps/web (Next.js) and apps/ai (Python/FastAPI). Both apps are independently deployable and documented. The workflow contract is typed end-to-end: discriminated union result states in TypeScript, Pydantic response models in Python, and shared Zod schemas in packages/types.',
    repoPara2Before: 'This portfolio\'s own contact form shows the pattern —',
    repoPara2After: '— restricting delivery to verified addresses via Resend, disabled by default (ENABLE_EMAIL_SENDING=false). The same approach would apply if this workflow\'s drafts were ever wired to actually send.',
    repoPara3: 'The Tavily integration is documented with an explicit privacy contract: uploaded contact rows are not intentionally sent to Tavily — the backend sends an extracted topic string, not the contact list. Users should avoid including personal data in the free-text request, since topic extraction is a best-effort heuristic, not a data-loss guarantee. The feature is off by default; mock/live mode separation is documented for local development and production deployment.',
    repoEnvTitle: 'Key environment flags',
    repoEnvItems: [
      ['OPENAI_API_KEY', 'LLM provider key — Python/FastAPI backend only'],
      ['OPENAI_BASE_URL', 'Optional — defaults to api.openai.com/v1'],
      ['AI_MODEL', 'Model ID — defaults to gpt-4o-mini'],
      ['ENABLE_EMAIL_SENDING', 'false on live site — blocks auto-send via Resend'],
      ['TAVILY_API_KEY', 'Optional — enables web context enrichment'],
      ['MAX_UPLOAD_ROWS', '100 — row limit enforced in Python/FastAPI'],
      ['MAX_REQUEST_LENGTH', '500 — character cap on user input'],
    ],
    ariaNext: 'Next iteration',
    sectionNext: 'Next iteration',
    headingNext: 'What would come next',
    nextItems: [
      'Service layer extraction — tool definitions and workflow logic currently live in the route file for readability and self-contained deployability; the next step would be splitting into tools/ and services/ modules as the codebase grows or a second developer joins',
      'Workflow history and audit log — track all runs, inputs, and approved drafts per session',
      'Team review mode — share draft with a second reviewer before approval',
      'Prompt evaluation — A/B test draft prompts across model versions, measure output quality',
      'Expanded test coverage — Playwright for the upload and review flow, Vitest for all Pydantic models',
      'LLM provider switch — a second provider as an alternative to OpenAI, configurable per deployment',
      'Cost and latency monitoring — log tokens used and response time per workflow run',
      'CRM integration — pull contacts from HubSpot or Salesforce instead of CSV upload',
    ],
  },
  de: {
    ariaIntro: 'Einführung in die Fallstudie',
    tagline: 'Eine Fullstack-LLM-Anwendung für strukturierte Business-Workflows: CSV/XLSX-Daten hochladen, relevante Kontakte auflösen, Kontext prüfen und personalisierte E-Mail-Entwürfe generieren — mit Python/FastAPI-Backend, strukturierten Outputs, Human Review und klaren Sicherheitsgrenzen.',
    tags: ['LLM Workflow', 'Python/FastAPI', 'Structured Outputs', 'Human Review', 'Next.js'],
    ariaDetails: 'Projektdetails',
    sectionDetails: 'Projektdetails',
    metaItems: [
      { label: 'Status', value: 'Live Deployment — Vercel + Railway' },
      { label: 'Typ', value: 'Fullstack-LLM-Anwendung (selbstinitiiert)' },
      { label: 'Rolle', value: 'Next.js Frontend, Python/FastAPI Backend, LLM-Workflow-Design, Deployment' },
      { label: 'Schwerpunkt', value: 'CSV/XLSX-Verarbeitung · Kontaktauflösung · Structured Outputs · Human Review' },
      { label: 'Stack', value: 'Next.js · TypeScript · Python · FastAPI · OpenAI API · Zod · Docker · Railway · Vercel' },
      { label: 'Sicherheit', value: 'Rate Limits · Mock/Live Mode · Kein automatischer E-Mail-Versand' },
    ],
    ariaLive: 'Live-Workflow-Anwendung',
    sectionLive: 'Live-Anwendung',
    headingLive: 'Live-Workflow',
    liveIntroPart1: 'Der LLM-Aufruf ist in einen kontrollierten Backend-Workflow eingebettet: Eingaben werden validiert, Kontaktdaten sicher abgegrenzt und Ergebnisse als strukturierte Outputs zurückgegeben — bevor sie dem Nutzer zur Überprüfung angezeigt werden. Optional',
    liveIntroHighlight: 'Web-Kontext-Anreicherung',
    liveIntroPart2: 'aktivieren, um das E-Mail-Thema online zu suchen — Kontaktdatensätze werden nicht bewusst in die Suchanfrage übernommen, E-Mail-ähnliche Zeichenfolgen werden aus dem extrahierten Thema entfernt. Im Freitext sollten keine personenbezogenen Daten stehen.',
    downloadLabel: 'Beispiel-CSV herunterladen',
    exampleLabel: 'Beispielanfrage:',
    exampleRequest: '„Schreib eine E-Mail an John über den Produktlaunch”',
    modeActive: 'Mock-Modus standardmäßig aktiv',
    modeSuffix: '— wenn kein LLM-API-Schlüssel serverseitig konfiguriert ist, werden Entwürfe mit deterministischer Fallback-Logik generiert. Es wird kein externer API-Aufruf gemacht.',
    modeEnvKey: 'OPENAI_API_KEY',
    modeApp: 'apps/ai',
    modeEnd: 'setzen, um den Live-LLM-Modus zu aktivieren.',
    safetyTitle: 'Sicherheitsgrenzen der öffentlichen Demo',
    safetyItems: [
      'Upload-Limit: Nur CSV oder XLSX, max. 1 MB, max. 100 Kontakte — im Speicher verarbeitet, nie permanent gespeichert',
      'Rate Limits: 5 Workflow-Ausführungen pro IP pro Stunde, 20 Uploads pro IP pro Stunde — serverseitig in Python/FastAPI durchgesetzt',
      'Es werden keine E-Mails automatisch versendet — freigegebene Entwürfe können nur kopiert werden',
      'Unsichere Anfragen (Spam, Identitätsdiebstahl, Massenversand) werden vor dem LLM-Aufruf blockiert',
      'Der optionale Web-Kontext sendet nur einen extrahierten Themen-String an Tavily; E-Mail-ähnliche Zeichenfolgen werden entfernt und Kontaktdaten nicht bewusst einbezogen — im Freitext sollten keine personenbezogenen Daten stehen',
      'Alle Eingaben werden mit Zod (Node) und Pydantic (Python) im Backend validiert — hochgeladene Daten als nicht vertrauenswürdig behandelt',
    ],
    ariaPDR: 'Problem, Entscheidung und Ergebnis',
    sectionPDR: 'PDR',
    headingPDR: 'Problem → Entscheidung → Ergebnis',
    pdrCards: [
      { label: 'Problem', text: 'Business-Teams arbeiten mit unstrukturierten CSV/XLSX-Daten und vagen Anfragen. Einfache Automatisierungen scheitern bei mehrdeutigen Namen oder wenn generierter Output menschliche Überprüfung erfordert, bevor eine Aktion ausgelöst wird.' },
      { label: 'Entscheidung', text: 'Entwicklung einer Fullstack-LLM-Anwendung: Next.js Frontend für Upload und Review, Python/FastAPI Backend für Validierung und LLM-Aufrufe, strukturierte Outputs via OpenAI Tool-Use und ein expliziter Human-Review-Schritt vor jeder Aktion — mit Rate Limits und Mock/Live Mode.' },
      { label: 'Was es zeigt', text: 'Wie eine codebasierte LLM-Anwendung unstrukturierte Anfragen in sichere, überprüfbare Aktionen überführt — kontrolliert, nicht automatisiert. Jeder Zustand ist getypt, jede Grenze explizit, und das LLM handelt nie ohne Nutzerfreigabe.' },
    ],
    ariaArch: 'Workflow-Architektur',
    sectionArch: 'Architektur',
    headingArch: 'Workflow-Architektur',
    controlFlow: 'Ablaufsteuerung',
    archSteps: [
      { num: '01', title: 'Upload & Validierung', description: 'Next.js sendet die Datei als Base64-JSON-Payload an Python/FastAPI. Das Backend validiert Größe, Typ und MIME-Typ, parst CSV oder XLSX und normalisiert die Kontakte. Erforderliche Spalten: Name, E-Mail. Daten werden nie auf Datenträger gespeichert.' },
      { num: '02', title: 'Anfrage verarbeiten', description: 'Die Nutzeranfrage wird zusammen mit der validierten Kontaktliste an Python/FastAPI gesendet. Eingabelänge wird auf 500 Zeichen begrenzt und unsichere Muster per Pydantic blockiert — bevor das LLM aufgerufen wird.' },
      { num: '03', title: 'Kontaktauflösung (LLM)', description: 'Python/FastAPI ruft OpenAI mit Tool-Use auf und erzwingt eine strukturierte JSON-Antwort. Kontaktdaten sind in XML-Trennzeichen eingeschlossen, um das Risiko von Prompt-Injection zu verringern. Ergebnis: exact_match | ambiguous | not_found.' },
      { num: '04', title: 'Mehrdeutigkeit behandeln', description: 'Wenn mehrere Kontakte gleichermaßen passen, werden alle Optionen mit LLM-generiertem Vorschlag und Begründung zurückgegeben. Der Nutzer muss bestätigen — keine automatische Auswahl.' },
      { num: '05', title: 'Entwurf generieren (LLM)', description: 'Ein zweiter OpenAI-Tool-Use-Aufruf generiert einen strukturierten E-Mail-Entwurf: Betreff, Text, Ton. Der Text ist auf 1.500 Zeichen serverseitig begrenzt. Das Ergebnis ist ein typisierter Structured Output, kein freier Text.' },
      { num: '06', title: 'Human Review', description: 'Alle Entwurfsfelder sind im Next.js-UI vor der Freigabe bearbeitbar. Der Nutzer kann neu generieren, kopieren oder freigeben. Eine Freigabe ist erforderlich — das LLM kann keine Aktion selbst auslösen.' },
      { num: '07', title: 'Sicherer Stopp', description: 'Die öffentliche Demo versendet keine E-Mails (ENABLE_EMAIL_SENDING=false). Freigegebene Entwürfe können nur kopiert werden. Das Repository dokumentiert die Resend-Anbindung für eine kontrollierte private Umgebung.' },
    ],
    ariaStates: 'Workflow-Zustände',
    sectionStates: 'Interface-Zustände',
    headingStates: 'Workflow-Zustände',
    stateGroups: [
      {
        label: 'Eingabe',
        states: [
          { label: 'idle', description: 'Upload-Zone sichtbar. Keine Datei geladen. Alle 12 Zustände als TypeScript-Discriminated-Union getypt — kein undefinierter State möglich.' },
          { label: 'uploading', description: 'Datei wird an Python/FastAPI-Backend gesendet. Skeleton im Ausgabebereich angezeigt. Zustandswechsel nur bei erfolgreicher Parse-Antwort.' },
          { label: 'ready', description: 'Kontakte geladen und validiert. Anzahl sichtbar, Liste angezeigt. Anfrage-Eingabe aktiviert.' },
        ],
      },
      {
        label: 'Agent',
        states: [
          { label: 'running', description: 'LLM-Workflow läuft im Python/FastAPI-Backend. Anfrage gesperrt. Ladezustand angezeigt — keine Blackbox, jeder Schritt hat ein definiertes typisiertes Ergebnis.' },
          { label: 'ambiguous', description: 'Mehrere Kontakte passen. Alle Optionen mit LLM-generiertem Vorschlag und Begründung angezeigt. Nutzer bestätigt vor der Entwurfsgenerierung.', example: '„John” erkannt: John Smith — F&E · John Doe — HR. Vorschlag: John Smith (Produktupdate-Kontext).' },
          { label: 'no_contact_found', description: 'Keine Übereinstimmung gefunden. Workflow stoppt sauber. Nutzer kann Anfrage anpassen und erneut versuchen.' },
          { label: 'draft_ready', description: 'Structured Output vom LLM empfangen. Alle Felder vor der Freigabe bearbeitbar. Konfidenzindikator sichtbar.' },
        ],
      },
      {
        label: 'Überprüfung',
        states: [
          { label: 'approved', description: 'Entwurf vom Nutzer freigegeben. Zusammenfassung angezeigt. Kopieraktion verfügbar. Versenden in öffentlicher Demo deaktiviert (ENABLE_EMAIL_SENDING=false).' },
        ],
      },
      {
        label: 'Sicherheit',
        states: [
          { label: 'rate_limited', description: 'Rate Limit erreicht (5 Ausführungen/IP/Stunde). Sichere Fehlermeldung, keine internen Details. Reset verfügbar. Bewusst pro IP — echte Per-Nutzer-Fairness bräuchte Login.' },
          { label: 'upload_error', description: 'Datei vom Python/FastAPI-Backend abgelehnt. Klare Meldung: falscher Typ, zu groß oder keine gültigen Kontakte gefunden.' },
          { label: 'unsafe', description: 'Anfrage per Pydantic-Validierung vor dem LLM-Aufruf blockiert — entspricht Spam-, Massen-E-Mail- oder Identitätsdiebstahlmuster.' },
          { label: 'error', description: 'Netzwerk- oder Backend-Fehler. Sichere Nutzerfehlermeldung. Keine Stack-Traces oder internen Details an den Client übertragen.' },
        ],
      },
    ],
    ariaSafety: 'Guardrails und Betriebsgrenzen',
    sectionSafety: 'Guardrails & Grenzen',
    headingSafety: 'Guardrails der öffentlichen Demo',
    safetyIntro: 'Die öffentliche Demo ist bewusst eingeschränkt. Ziel ist ein funktionierender LLM-Workflow, der sicher testbar ist — ohne Spam, unbegrenzte LLM-Nutzung oder unnötige Datenoffenlegung zu ermöglichen. Guardrails und Rate Limits sind hier zwei verschiedene Dinge: Guardrails begrenzen, was das Modell strukturell überhaupt tun kann; Rate Limits begrenzen, wie oft es aufgerufen werden darf.',
    techSafety: [
      { title: 'Guardrails', items: ['Keyword-Vorfilter blockiert offensichtliche Fälle (Spam, Massen-E-Mail, Identitätsdiebstahl) vor jedem LLM-Aufruf — eine billige Heuristik, nicht die eigentliche Sicherheitsgrenze', 'Kontaktdaten sind explizit abgegrenzt und werden als nicht vertrauenswürdige Eingabe behandelt, um das Risiko von Prompt-Injection zu verringern', 'OpenAI Tool-Use erzwingt ein typisiertes Structured-Output-Schema — das Modell kann keinen Freitext zurückgeben', 'resolvedContact wird serverseitig gegen die hochgeladene Liste validiert — das Modell kann keinen Kontakt erfinden', 'Output-Tokens explizit begrenzt — E-Mail-Text auf 1.500 Zeichen', 'Timeout-Behandlung stoppt den Workflow sicher bei LLM-Hänger'] },
      { title: 'Dateilimits', items: ['Akzeptiert: Nur .csv und .xlsx — Typ per Erweiterung und MIME-Typ in Python/FastAPI validiert', 'Maximale Größe: 1 MB pro Upload', 'Maximale Zeilen: 100 Kontakte pro Workflow-Ausführung', 'Erforderliche Spalten: Name, E-Mail — ungültige E-Mails per Pydantic abgelehnt', 'Dateien werden im Arbeitsspeicher verarbeitet und nie permanent gespeichert'] },
      { title: 'Rate Limits', items: ['5 Workflow-Ausführungen pro IP pro Stunde — SlowAPI in Python/FastAPI', '20 Uploads pro IP pro Stunde', 'Anfragetext auf 500 Zeichen vor dem LLM-Aufruf begrenzt', 'Honeypot-Feld verwirft Bot-Einsendungen stillschweigend ohne die Prüfung zu verraten', 'Mock/Live Mode: kein externer LLM-Aufruf wenn OPENAI_API_KEY fehlt'] },
      { title: 'E-Mail-Sicherheit', items: ['Keine automatischen E-Mails — ENABLE_EMAIL_SENDING=false im Live-Deployment', 'Freigegebene Entwürfe können nur kopiert werden — nie automatisch an Kontakte gesendet', 'Repository dokumentiert Resend-Anbindung für private/Admin-Umgebung', 'Versand in jeder kontrollierten Umgebung auf verifizierte Adressen beschränkt', 'Kontaktdaten werden nicht bewusst an externe Such-APIs gesendet — nur ein extrahierter Themen-String, E-Mail-ähnliche Zeichenfolgen entfernt'] },
    ],
    ariaImpl: 'Technische Umsetzung',
    sectionImpl: 'Technische Umsetzung',
    headingImpl: 'Implementierungsdetails',
    implIntro: 'Die Anwendung trennt Verantwortlichkeiten klar: Next.js besitzt Interface und Review-Flow, Python/FastAPI besitzt LLM-Aufrufe und Validierung, und das LLM ist auf die Erzeugung strukturierter Outputs beschränkt.',
    techImpl: [
      { title: 'Frontend (Next.js)', items: ['12 explizite Workflow-Zustände als TypeScript Discriminated Union', 'Keine externe State-Bibliothek — useState + Discriminated Union', 'Alle async-Aktionen sind async/void — keine unbehandelten Promise-Ablehnungen', 'ARIA-Live-Region kündigt Zustandswechsel für Screenreader an', 'Alle interaktiven Elemente tastaturzugänglich mit sichtbaren Fokuszuständen'] },
      { title: 'AI-Backend (Python/FastAPI)', items: ['Zwei OpenAI-Tool-Use-Aufrufe: Kontaktauflösung und Entwurfsgenerierung', 'Kontaktdaten in XML-Trennzeichen — verringert das Risiko von Prompt-Injection', 'Pydantic-Modelle validieren alle Request-Bodies — unbekannte Felder abgelehnt', 'SlowAPI setzt Rate Limits pro Route serverseitig durch', 'Mock Mode liefert deterministischen Output wenn OPENAI_API_KEY fehlt'] },
      { title: 'LLM-Design', items: ['Structured Outputs via OpenAI tool_use — JSON-Antwortschema wird erzwungen', 'Status-Feld: exact_match | ambiguous | not_found (Auflösungs-Call)', 'Strukturierte Felder: Betreff, Text, Ton (Entwurfs-Call)', 'resolvedContact gegen hochgeladene Daten validiert — LLM kann keine Kontakte erfinden', 'Text serverseitig auf 1.500 Zeichen begrenzt für kontrollierte Output-Länge'] },
      { title: 'Rate Limiting', items: ['SlowAPI (Python/FastAPI) pro Route: 5 Ausführungen/Stunde, 20 Uploads/Stunde', 'Globales Limit von 100 Anfragen/Min für alle anderen Endpunkte', 'Node/Fastify handhabt Contact-Form-Rate-Limits separat', 'Rate-Limit-Antworten enthalten sichere Meldungen ohne interne Details', 'Kein geteilter State nötig — Per-IP-Limits per SlowAPI-Middleware'] },
      { title: 'Dateiverarbeitung', items: ['Client sendet Datei als Base64-JSON-Payload — vermeidet Multipart-Komplexität', 'Python/FastAPI dekodiert, validiert Größe und MIME-Typ, parst mit openpyxl/csv', 'normalise_contacts() bereinigt alle Felder und validiert E-Mail-Format per Pydantic', 'Kontakte als typisiertes Array an Next.js zurückgegeben — nie auf Datenträger', 'CSV und XLSX über dieselbe Normalisierungs-Pipeline verarbeitet'] },
      { title: 'Optionaler Web-Kontext', items: ['Opt-in Tavily-Suche reichert Entwürfe mit aktuellem Themenkontext an', 'extractSearchTopic() entfernt E-Mail-Adressen und nutzt nie die hochgeladene Kontaktliste — Namen oder Details im Freitext werden aber nicht erkannt oder entfernt', 'Ein heuristisch extrahiertes Thema wird gesendet, keine Garantie gegen Datenverlust — fällt auf eine gekürzte Version der Anfrage zurück, wenn kein Extraktionsmuster passt', 'Deutsche und englische Schlüsselwortmuster für Thema-Extraktion', 'Checkbox standardmäßig deaktiviert — kein externer Aufruf außer bei expliziter Aktivierung'] },
    ],
    ariaRepo: 'Repository-Dokumentation',
    sectionRepo: 'Repository',
    headingRepo: 'Repository-Nachweis',
    repoPara1: 'Die vollständige Implementierung liegt im Monorepo unter apps/web (Next.js) und apps/ai (Python/FastAPI). Beide Apps sind unabhängig deploybar und dokumentiert. Der Workflow-Vertrag ist durchgehend typisiert: Discriminated-Union-Zustände in TypeScript, Pydantic-Antwortmodelle in Python und gemeinsame Zod-Schemas in packages/types.',
    repoPara2Before: 'Das eigene Kontaktformular dieses Portfolios zeigt das Muster —',
    repoPara2After: '— Versand auf verifizierte Adressen beschränkt über Resend, standardmäßig deaktiviert (ENABLE_EMAIL_SENDING=false). Der gleiche Ansatz würde gelten, falls die Entwürfe dieses Workflows jemals tatsächlich verschickt werden sollten.',
    repoPara3: 'Die Tavily-Integration ist mit einem expliziten Datenschutzvertrag dokumentiert: Hochgeladene Kontaktzeilen werden nicht bewusst an Tavily gesendet — das Backend sendet einen extrahierten Themen-String, nicht die Kontaktliste. Nutzer:innen sollten im Freitext keine personenbezogenen Daten angeben, da die Themenextraktion eine heuristische Best-Effort-Methode ist, keine Garantie gegen Datenverlust. Die Funktion ist standardmäßig deaktiviert; die Mock/Live-Mode-Trennung ist für lokale Entwicklung und Production-Deployment dokumentiert.',
    repoEnvTitle: 'Wichtige Umgebungsvariablen',
    repoEnvItems: [
      ['OPENAI_API_KEY', 'LLM provider key — nur Python/FastAPI Backend'],
      ['OPENAI_BASE_URL', 'Optional — Standard: api.openai.com/v1'],
      ['AI_MODEL', 'Modell-ID — Standard: gpt-4o-mini'],
      ['ENABLE_EMAIL_SENDING', 'false im Live-Deployment — blockiert Auto-Versand via Resend'],
      ['TAVILY_API_KEY', 'Optional — aktiviert Web-Kontext-Anreicherung'],
      ['MAX_UPLOAD_ROWS', '100 — Zeilenlimit in Python/FastAPI durchgesetzt'],
      ['MAX_REQUEST_LENGTH', '500 — Zeichenlimit für Nutzereingaben'],
    ],
    ariaNext: 'Nächste Iteration',
    sectionNext: 'Nächste Iteration',
    headingNext: 'Was als Nächstes käme',
    nextItems: [
      'Service-Layer-Extraktion — Tool-Definitionen und Workflow-Logik liegen aktuell in der Route-Datei, da jedes Case Study in sich abgeschlossen ist und die Lesbarkeit so höher ist; der nächste Schritt wäre eine Aufteilung in tools/- und services/-Module, sobald die Codebasis wächst oder ein zweiter Entwickler einsteigt',
      'Workflow-Historie und Audit-Log — alle Ausführungen, Eingaben und freigegebene Entwürfe nachverfolgen',
      'Team-Review-Modus — Entwurf vor Freigabe mit zweiter Person teilen',
      'Prompt-Evaluierung — Draft-Prompts über Modellversionen A/B-testen, Output-Qualität messen',
      'Erweiterte Testabdeckung — Playwright für Upload- und Review-Flow, Vitest für alle Pydantic-Modelle',
      'LLM-Provider-Wechsel — ein zweiter Anbieter als Alternative zu OpenAI, per Deployment konfigurierbar',
      'Kosten- und Latenzmonitoring — Token-Verbrauch und Antwortzeit pro Workflow-Ausführung loggen',
      'CRM-Integration — Kontakte aus HubSpot oder Salesforce statt CSV-Upload abrufen',
    ],
  },
} as const;

export function Cs01Content() {
  const { lang } = useLang();
  const d = c[lang];
  const accent = 'var(--color-fg)';

  return (
    <main className="pt-32 pb-28 md:pb-40 px-8 md:px-16 lg:px-20">
      <div className="max-w-[1920px] mx-auto">

        <CaseStudyBackLink />

        {/* 1. Hero */}
        <section aria-label={d.ariaIntro}>
          <CaseStudyEyebrow number="01" accent={accent} />
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-fg tracking-tight leading-[1.02] mb-6">
            AI Operations Workflow Agent
          </h1>
          <p className="text-base md:text-xl text-muted leading-[1.75] mb-8 max-w-[52ch]">
            {d.tagline}
          </p>
          <div className="flex flex-wrap gap-2 mb-8">
            {d.tags.map((tag) => (
              <span key={tag} className="font-mono text-sm text-muted border border-border rounded-sm px-3 py-1.5">
                {tag}
              </span>
            ))}
          </div>
        </section>

        <Divider />

        {/* 2. Meta strip */}
        <section aria-label={d.ariaDetails}>
          <SectionLabel>{d.sectionDetails}</SectionLabel>
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-x-12 gap-y-6">
            {d.metaItems.map(({ label, value }) => (
              <div key={label}>
                <dt className="font-mono text-sm text-subtle uppercase tracking-widest mb-1">{label}</dt>
                <dd className="text-base lg:text-lg text-fg leading-relaxed">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <Divider />

        {/* 3. Live workflow */}
        <section aria-label={d.ariaLive}>
          <SectionLabel>{d.sectionLive}</SectionLabel>
          <SectionHeading>{d.headingLive}</SectionHeading>

          <p className="text-base lg:text-lg text-muted leading-[1.75] mb-6 max-w-3xl">
            {d.liveIntroPart1}{' '}
            <span className="text-fg font-medium">{d.liveIntroHighlight}</span>{' '}
            {d.liveIntroPart2}
          </p>

          <div className="flex flex-wrap items-center gap-4 mb-8">
            <a
              href="/samples/sample-contacts.csv"
              download="sample-contacts.csv"
              className="inline-flex items-center gap-2 font-mono text-sm text-muted border border-border rounded px-3 py-2 hover:text-fg hover:border-border-strong transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
            >
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M8 2v9M4 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 13h12" strokeLinecap="round" />
              </svg>
              {d.downloadLabel}
            </a>
            <span className="font-mono text-sm text-subtle">
              {d.exampleLabel}{' '}
              <span className="text-muted">{d.exampleRequest}</span>
            </span>
          </div>

          {/* ModeNote */}
          <div className="w-full lg:w-1/2 border border-border rounded-lg bg-surface px-5 py-4 flex items-start gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-fg opacity-30 mt-2.5 flex-shrink-0" aria-hidden="true" />
            <p className="font-mono text-base text-muted leading-relaxed">
              <span className="text-fg">{d.modeActive}</span>{' '}
              {d.modeSuffix}{' '}
              <code className="text-fg">{d.modeEnvKey}</code>{' '}
              {lang === 'de' ? 'in ' : 'in '}
              <code className="text-fg">{d.modeApp}</code>{' '}
              {d.modeEnd}
            </p>
          </div>

          <div className="mt-8">
            <AiOpsWorkflow />
          </div>

          <div className="mt-8 border border-border rounded-lg bg-surface p-6 max-w-3xl">
            <p className="font-mono text-xs text-fg uppercase tracking-widest mb-3">{d.safetyTitle}</p>
            <ul className="space-y-2">
              {d.safetyItems.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-[0.7em] w-1 h-1 rounded-full bg-fg opacity-40 flex-shrink-0" aria-hidden="true" />
                  <span className="text-base lg:text-lg text-muted leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <Divider />

        {/* 4. PDR */}
        <section aria-label={d.ariaPDR}>
          <SectionLabel>{d.sectionPDR}</SectionLabel>
          <SectionHeading>{d.headingPDR}</SectionHeading>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {d.pdrCards.map(({ label, text }) => (
              <PDRCard key={label} label={label} text={text} accent={accent} />
            ))}
          </dl>
        </section>

        <Divider />

        {/* 5. Architecture */}
        <section aria-label={d.ariaArch}>
          <SectionLabel>{d.sectionArch}</SectionLabel>
          <SectionHeading>{d.headingArch}</SectionHeading>
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_600px] gap-16">
            <div className="max-w-2xl">
              <div style={{ borderTop: '1px solid var(--color-border)' }}>
                {d.archSteps.map((step) => (
                  <ArchStep key={step.num} {...step} />
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <p className="font-mono text-xs text-muted uppercase tracking-widest mb-2">{d.controlFlow}</p>
              <FlowDiagram />
            </div>
          </div>
        </section>

        <Divider />

        {/* 6. Workflow states */}
        <section aria-label={d.ariaStates}>
          <SectionLabel>{d.sectionStates}</SectionLabel>
          <SectionHeading>{d.headingStates}</SectionHeading>
          <div className="space-y-10">
            {d.stateGroups.map((group) => (
              <StateGroup key={group.label} label={group.label}>
                {group.states.map((s) => (
                  <StateDoc key={s.label} label={s.label} description={s.description} {...('example' in s ? { example: s.example } : {})} />
                ))}
              </StateGroup>
            ))}
          </div>
        </section>

        <Divider />

        {/* 7. Safety */}
        <section aria-label={d.ariaSafety}>
          <SectionLabel>{d.sectionSafety}</SectionLabel>
          <SectionHeading>{d.headingSafety}</SectionHeading>
          <p className="text-base lg:text-lg text-muted leading-[1.85] max-w-3xl mb-10">{d.safetyIntro}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {d.techSafety.map(({ title, items }) => (
              <TechNote key={title} title={title} items={items} />
            ))}
          </div>
        </section>

        <Divider />

        {/* 8. Implementation */}
        <section aria-label={d.ariaImpl}>
          <SectionLabel>{d.sectionImpl}</SectionLabel>
          <SectionHeading>{d.headingImpl}</SectionHeading>
          <p className="text-base lg:text-lg text-muted leading-[1.85] max-w-3xl mb-10">{d.implIntro}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {d.techImpl.map(({ title, items }) => (
              <TechNote key={title} title={title} items={items} />
            ))}
          </div>
        </section>

        <Divider />

        {/* 9. Repository */}
        <section aria-label={d.ariaRepo}>
          <SectionLabel>{d.sectionRepo}</SectionLabel>
          <SectionHeading>{d.headingRepo}</SectionHeading>
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_520px] gap-12 xl:gap-16 items-start">
            <div className="space-y-6 max-w-2xl">
              <p className="text-base lg:text-lg text-muted leading-[1.85]">{d.repoPara1}</p>
              <p className="text-base lg:text-lg text-muted leading-[1.85]">
                {d.repoPara2Before}{' '}
                <code className="font-mono text-base text-fg bg-surface border border-border rounded px-1.5 py-0.5">
                  apps/api/src/routes/contact.ts
                </code>{' '}
                {d.repoPara2After}
              </p>
              <p className="text-base lg:text-lg text-muted leading-[1.85]">{d.repoPara3}</p>
            </div>
            <div className="p-5 border border-border rounded-lg bg-surface">
              <p className="font-mono text-sm text-muted uppercase tracking-widest mb-4">{d.repoEnvTitle}</p>
              <div className="space-y-3">
                {d.repoEnvItems.map(([key, desc]) => (
                  <div key={key} className="font-mono text-sm">
                    <span className="text-fg block">{key}</span>
                    <span className="text-subtle mt-0.5 block">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <Divider />

        {/* 10. Next iteration */}
        <section aria-label={d.ariaNext}>
          <SectionLabel>{d.sectionNext}</SectionLabel>
          <SectionHeading>{d.headingNext}</SectionHeading>
          <ul className="space-y-4 max-w-3xl">
            {d.nextItems.map((item, i) => (
              <li key={item} className="flex items-start gap-4 py-4 border-b border-border last:border-0">
                <span className="font-mono text-sm mt-0.5 flex-shrink-0" style={{ color: accent }} aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-base lg:text-lg text-muted leading-[1.75]">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <Divider />

        <CaseStudyFooterNav next={{ href: '/work/research-to-post-multi-agent-workflow', number: '02' }} />

      </div>
    </main>
  );
}
