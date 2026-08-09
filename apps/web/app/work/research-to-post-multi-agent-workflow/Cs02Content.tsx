'use client';

import { useLang } from '@/lib/i18n';
import { MultiAgentPostWorkflow } from '@/components/work/multi-agent-post/MultiAgentPostWorkflow';
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
        <FlowNode label="validate_input" />
        <FlowArrow />
        <FlowNode label="optional_research" />
        <FlowArrow />
        <FlowNode label="research_agent" />
        <FlowArrow />
        <FlowNode label="writer_agent" />
        <FlowArrow />
        <FlowNode label="critic_agent" />
        <div className="mt-3 ml-4 space-y-2 border-l border-border pl-4">
          <div className="flex items-center gap-3">
            <span className="text-subtle text-base">if needs_revision:</span>
            <div className="border border-border rounded px-3 py-1 text-base text-muted bg-surface">revision_agent</div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-subtle text-base">if score ≥ 8:</span>
            <div className="border border-border rounded px-3 py-1 text-base text-muted bg-surface">skip_revision</div>
          </div>
        </div>
        <FlowArrow />
        <FlowNode label="groundedness_check" />
        <FlowArrow />
        <FlowNode label="human_editor" />
        <FlowArrow />
        <FlowNode label="END" accent />
      </div>
    </div>
  );
}

const c = {
  en: {
    ariaIntro: 'Case study introduction',
    tagline: 'A multi-step LLM workflow built with LangGraph: input a topic, structure research context, generate a draft, apply critique, run revision, and verify the result with a groundedness check — implemented as a fullstack AI application with a Next.js frontend and Python/FastAPI backend.',
    tags: ['LangGraph', 'Multi-Agent', 'LLM Orchestration', 'Structured Outputs', 'Groundedness Check'],
    ariaDetails: 'Project details',
    sectionDetails: 'Project details',
    metaItems: [
      { label: 'Status', value: 'Live deployment — Vercel + Railway' },
      { label: 'Type', value: 'Fullstack AI application (self-initiated)' },
      { label: 'Role', value: 'Next.js frontend, Python/FastAPI backend, LangGraph workflow design, deployment' },
      { label: 'Focus', value: 'LLM orchestration · Multi-agent · Structured outputs · Groundedness check' },
      { label: 'Stack', value: 'Next.js · TypeScript · Python · FastAPI · LangGraph · OpenAI API · Tavily (opt.) · Docker · Railway · Vercel' },
      { label: 'Safety', value: 'Rate limits · Mock/live mode · No auto-publishing · Visible intermediate steps' },
    ],
    ariaLive: 'Live workflow application',
    sectionLive: 'Live Application',
    headingLive: 'Live workflow',
    liveIntro: 'Each step of the LangGraph workflow is visible: Researcher, Writer, Critic, Revision, and Groundedness Check appear as separate result blocks — not a blackbox prompt, but observable LLM orchestration with typed outputs at every stage.',
    modeActive: 'Mock mode active by default',
    modeSuffix: '— when no LLM API key is configured server-side, all five agent steps run with deterministic fallback logic. No external API call is made. Set',
    modeEnvKey: 'OPENAI_API_KEY',
    modeApp: 'apps/ai',
    modeEnd: 'to enable live LLM mode.',
    safetyTitle: 'Demo safety constraints',
    safetyItems: [
      'This public demo generates editable text drafts only. There is no social media login and no automatic publishing of any kind.',
      'Requests are structurally validated with Pydantic; a separate server-side keyword pre-filter blocks obvious unsafe topics before the workflow starts. Blocked requests receive a clear message with no internal details.',
      'Workflow runs are rate-limited per IP by SlowAPI. Mock/live mode is controlled by an environment variable — no external LLM call without a configured key.',
    ],
    ariaPDR: 'Problem, decision, and result',
    sectionPDR: 'PDR',
    headingPDR: 'Problem → Decision → Result',
    pdrCards: [
      { label: 'Problem', text: 'A single LLM prompt gives no visibility into how an output was built — whether research happened, whether critique was applied, or whether claims are supported. That makes the result hard to review, trust, or improve.' },
      { label: 'Decision', text: 'Built a multi-step LLM workflow with LangGraph and Python/FastAPI: Researcher, Writer, Critic, Revision, and Groundedness Check as separate LangGraph nodes — each with a typed structured output, each result visible in the UI.' },
      { label: 'What it demonstrates', text: 'How LLM orchestration with LangGraph builds an observable multi-agent pipeline — inspectable, testable, and improvable step by step — instead of a blackbox with a single prompt.' },
    ],
    ariaArch: 'Workflow architecture',
    sectionArch: 'Architecture',
    headingArch: 'Workflow architecture',
    controlFlow: 'Control flow',
    archSteps: [
      { num: '01', title: 'Input & validation', description: 'Topic is validated by Pydantic: length capped, honeypot checked, unsafe patterns blocked. No LangGraph node starts without a valid input. Validation failures return a safe message — no internal details exposed.' },
      { num: '02', title: 'Optional web research', description: 'If enabled, only an extracted topic string is sent to Tavily; email-like strings are removed and the search is not deliberately built from names or profile data. Users should avoid personal data in the topic field. Returns up to three context points and source citations. Falls back gracefully if unavailable. Result is passed as structured input to the Researcher node.' },
      { num: '03', title: 'Researcher (LangGraph node)', description: 'LLM structures concise context points and key thematic angles as a typed structured output. Web context (if fetched) is synthesised — not forwarded raw to the next node. Result is an explicit typed object passed to the Writer.' },
      { num: '04', title: 'Writer (LangGraph node)', description: 'Drafts hook, body, closing line, and hashtags with the chosen tone and goal, using the Researcher output. OpenAI tool-use enforces a typed JSON schema — no freeform generation flows to the next node.' },
      { num: '05', title: 'Critic (LangGraph node)', description: 'Scores the draft against a 6-point rubric: clarity, specificity, relevance, factual caution, tone fit, and structure. Returns score (1–10) and actionable revision_instructions as a structured output. Score ≥ 8 routes to Groundedness, skipping Revision.' },
      { num: '06', title: 'Revision (conditional LangGraph node)', description: 'Runs only when Critic score is below 8. Addresses the specific revision_instructions — not a wholesale rewrite. If score is ≥ 8, this node is skipped; the reason is documented in the result and surfaced to the user.' },
      { num: '07', title: 'Groundedness check (LangGraph node)', description: 'Assesses whether claims in the final draft are well-supported, speculative, or unsupported. Returns a status badge (grounded / needs_caution / unsupported) and caution notes. Result is visible in the UI before the user copies anything.' },
      { num: '08', title: 'Human review', description: 'All five agent results are displayed as separate blocks. The final draft is editable before copying. No automatic publishing — the user reviews every agent output and decides what to use.' },
    ],
    ariaStates: 'Workflow states',
    sectionStates: 'Interface states',
    headingStates: 'Workflow states',
    stateGroups: [
      {
        label: 'Input',
        states: [
          { label: 'idle', description: 'Inputs ready. No LangGraph workflow has run yet. All 7 states typed as a discriminated union — no undefined state possible.' },
          { label: 'running', description: 'LangGraph workflow executing in Python/FastAPI backend. Inputs locked. Each node produces a typed result — no unobserved intermediate state.' },
        ],
      },
      {
        label: 'Agent',
        states: [
          { label: 'researching', description: 'Researcher node structuring context points and thematic angles as a typed structured output.' },
          { label: 'drafting', description: 'Writer node generating a structured draft: hook, body, closing, hashtags.' },
          { label: 'critiquing', description: 'Critic node scoring the draft against the 6-point rubric and producing revision_instructions.', example: 'Score 7/10. Two areas: softer opening, more specific closing question.' },
          { label: 'revising', description: 'Revision node improving the draft based on specific critic instructions — runs only when score < 8. Skipped and documented otherwise.' },
        ],
      },
      {
        label: 'Review',
        states: [
          { label: 'final_ready', description: 'Groundedness check complete. All node results visible as separate blocks. Final draft in an editable field, ready to copy.' },
        ],
      },
      {
        label: 'Safety',
        states: [
          { label: 'unsafe_topic', description: 'Topic blocked by a server-side keyword pre-filter (a separate check from Pydantic\'s structural validation) before any LangGraph node runs. Safe stop with a clear message — no LLM called, no internal details exposed.' },
          { label: 'rate_limited', description: 'Rate limit reached (5 runs/IP/hour via SlowAPI). Safe message shown, no internal details. Reset available. Per IP by design — real per-user fairness would need login.' },
          { label: 'error', description: 'Network or Python/FastAPI backend error. Safe user-facing message. No stack traces or internal details exposed to the client.' },
        ],
      },
    ],
    ariaSafety: 'Guardrails and operational constraints',
    sectionSafety: 'Guardrails & limits',
    headingSafety: 'Public demo guardrails',
    safetyIntro: 'The public demo is rate-limited and input-validated so the LangGraph workflow can be tested safely — without auto-publishing, unbounded LLM usage, or privacy-invasive queries. Guardrails and rate limits are two different things here: guardrails constrain what the workflow is structurally able to produce; rate limits constrain how often it runs.',
    techSafety: [
      { title: 'Guardrails', items: ['Keyword pre-filter blocks obvious cases (spam, impersonation, harassment, disinformation) before any LangGraph node starts — a cheap heuristic, not the actual quality/safety boundary', 'Critic node scores the draft — below 8 triggers one conditional revision pass, so the workflow addresses issues rather than shipping a low-confidence draft as-is', 'Groundedness Check runs last, after any revision — checks the draft against retrieved source material when available, otherwise against the workflow\'s own research context, and clearly labels plausibility-only checks', 'Typed structured outputs flow between LangGraph nodes — no freeform text silently passed between Researcher, Writer, and Critic', 'All request bodies validated by Pydantic — unknown fields rejected'] },
      { title: 'Rate & input limits', items: ['5 workflow runs per IP per hour — SlowAPI in Python/FastAPI', 'Topic capped at 300 characters — validated by Pydantic in Python/FastAPI', 'Honeypot field silently discards bot submissions without revealing the check', 'Rate limit responses return safe messages without internal details', 'A central provider timeout on every OpenAI call — the workflow fails safely instead of hanging indefinitely if a call stalls'] },
      { title: 'Web context limits', items: ['Only an extracted topic string is sent to Tavily; the search is not deliberately built from names or profile data — users should avoid personal data in the topic field', 'Email-like strings stripped from the topic before any Tavily request', 'Topic capped at 200 characters for the search query', 'httpx.AsyncClient(timeout=8.0) caps the Tavily request duration', 'Opt-in only — default is off. No external call unless checkbox is enabled'] },
      { title: 'Output limits', items: ['No social media login, no auto-publishing of any kind', 'All agent results are editable before copying — human controls the final output', 'No content stored server-side between workflow runs', 'Intermediate step results (Researcher, Critic, Groundedness) are surfaced in the UI — no hidden chain-of-thought'] },
    ],
    ariaImpl: 'Technical implementation',
    sectionImpl: 'Technical implementation',
    headingImpl: 'Implementation details',
    implIntro: 'The application separates concerns clearly: Next.js renders the workflow steps and review interface, Python/FastAPI orchestrates the LangGraph nodes, and the LLM produces only typed structured outputs — no freeform text flows between nodes.',
    techImpl: [
      { title: 'Frontend (Next.js)', items: ['7 explicit workflow stages tracked as TypeScript discriminated union', 'No external state library — useState + discriminated union covers all states', 'Reveal stage incrementally shows node result blocks every 600ms', 'ARIA live region announces state transitions for screen readers', 'All interactive elements keyboard accessible with visible focus states'] },
      { title: 'AI backend (Python/FastAPI)', items: ['LangGraph graph with 6 named nodes: Researcher, Writer, Critic, Reviser, Skip Revision, Groundedness', 'Conditional edge after Critic: score < 8 → Revision node, score ≥ 8 → Groundedness node', 'Pydantic models validate all request bodies — unknown fields rejected', 'SlowAPI enforces per-route rate limits server-side', 'Mock mode returns deterministic structured outputs when OPENAI_API_KEY is absent'] },
      { title: 'LLM design (structured outputs)', items: ['OpenAI tool-use enforces a typed JSON schema at every LangGraph node', 'Each node result is a distinct Pydantic model — no shared untyped output', 'Researcher → typed context points; Writer → typed draft fields; Critic → score + instructions', 'Conditional routing based on Critic score is a LangGraph conditional edge — not prompt logic', 'parseToolArgs<T>() on the frontend safely parses each node result — null on failure'] },
      { title: 'Conditional revision', items: ['Critic scores draft 1–10 against rubric: clarity, specificity, relevance, factual caution, tone, structure', 'Revision runs only when score < 8 — conditional LangGraph node, not always executed', 'Revision receives both the draft and specific revision_instructions from the Critic', 'Skipped revision is documented in the result with the Critic score and reason', 'Score and issues surfaced to the user — not hidden in chain-of-thought', 'evals/cs02_eval.py runs a fixed 6-topic set and asserts the conditional-revision contract (score < 8 must produce revision notes, ≥ 8 must skip it) rather than judging subjective quality — runs deterministically in mock mode in CI on every push, and can also be run manually against the live model'] },
      { title: 'Groundedness check', items: ['Final LangGraph node checks whether draft claims are supported, speculative, or unsupported', 'Returns status badge: grounded / needs_caution / unsupported', 'Caution notes surfaced in the UI — user sees them before copying', 'Runs after Revision (or after Writer if Revision skipped) — always the last LLM call', 'Encourages human review of AI-generated claims before any use'] },
      { title: 'Optional web context', items: ['Opt-in Tavily search enriches the Researcher node with current topic context', 'Email addresses stripped from topic before any Tavily call', 'Tavily result passed as typed context input — Researcher synthesises, not transcribes', 'Returns context points and source citations visible in the UI', 'Checkbox off by default — no external call unless explicitly enabled'] },
    ],
    ariaRepo: 'Repository documentation',
    sectionRepo: 'Repository',
    headingRepo: 'Repository proof',
    repoPara1: 'The full LangGraph implementation lives in the monorepo under apps/ai. All six nodes (including the Skip Revision no-op branch) are implemented as separate Python functions with Pydantic response models and a conditional Revision edge. The state machine in the Next.js frontend uses TypeScript discriminated unions for all 7 workflow stages — typed end-to-end from Pydantic model to React component.',
    repoPara2Before: 'Shared Zod schemas in',
    repoPara2After: 'define the request and result contracts — used for validation on the TypeScript side and for type safety in the frontend without duplication.',
    repoPara3: 'The Tavily integration is documented with an explicit privacy contract: only the post topic is sent to the search API, email addresses are stripped before any query, and the feature stays off by default. The mock/live mode separation is documented for local development and production deployment.',
    repoEnvTitle: 'Key environment flags',
    repoEnvItems: [
      ['OPENAI_API_KEY', 'LLM provider key — Python/FastAPI backend only'],
      ['OPENAI_BASE_URL', 'Optional — defaults to api.openai.com/v1'],
      ['AI_MODEL', 'Model ID — defaults to gpt-4o-mini'],
      ['TAVILY_API_KEY', 'Optional — enables web context enrichment'],
      ['MAX_TOPIC_LENGTH', '300 — topic character cap enforced by Pydantic'],
    ],
    ariaNext: 'Next iteration',
    sectionNext: 'Next iteration',
    headingNext: 'What would come next',
    nextItems: [
      'Module separation — agent node logic and prompt definitions currently live in the route file for self-contained readability; the next step would be extracting nodes into an agents/ layer and prompts into a prompts/ module as the workflow grows',
      'Larger evaluation set (30-50 labeled cases, up from the current 6) — varied topic classes, deliberately unsupported claims, conflicting sources, prompt-injection content in search results, expected groundingBasis, expected supported/unsupported claims, and tracked across model and prompt versions',
      'Quality metrics in the UI — Critic score history, Groundedness distribution, revision rate over time',
      'Source display — show Tavily citations inline in the Researcher result block',
      'Draft export — copy as Markdown or structured JSON for use in other tools',
      'Prompt versioning — A/B test Critic and Writer system prompts, measure output quality difference',
      'Expanded test coverage — Pytest for all LangGraph nodes, Playwright for the workflow UI',
      'Parallel node execution where steps are independent — reduce total workflow latency',
    ],
  },
  de: {
    ariaIntro: 'Einführung in die Fallstudie',
    tagline: 'Ein mehrstufiger LLM-Workflow mit LangGraph: Thema eingeben, Recherchekontext strukturieren, Entwurf erzeugen, Kritik anwenden, Revision durchführen und das Ergebnis mit einem Groundedness Check prüfen — umgesetzt als Fullstack-AI-Anwendung mit Next.js-Frontend und Python/FastAPI-Backend.',
    tags: ['LangGraph', 'Multi-Agent', 'LLM Orchestration', 'Structured Outputs', 'Groundedness Check'],
    ariaDetails: 'Projektdetails',
    sectionDetails: 'Projektdetails',
    metaItems: [
      { label: 'Status', value: 'Live Deployment — Vercel + Railway' },
      { label: 'Typ', value: 'Fullstack-AI-Anwendung (selbstinitiiert)' },
      { label: 'Rolle', value: 'Next.js Frontend, Python/FastAPI Backend, LangGraph Workflow Design, Deployment' },
      { label: 'Schwerpunkt', value: 'LLM Orchestration · Multi-Agent · Structured Outputs · Groundedness Check' },
      { label: 'Stack', value: 'Next.js · TypeScript · Python · FastAPI · LangGraph · OpenAI API · Tavily (opt.) · Docker · Railway · Vercel' },
      { label: 'Sicherheit', value: 'Rate Limits · Mock/Live Mode · Kein Auto-Publishing · Sichtbare Zwischenschritte' },
    ],
    ariaLive: 'Live-Workflow-Anwendung',
    sectionLive: 'Live-Anwendung',
    headingLive: 'Live-Workflow',
    liveIntro: 'Jeder Schritt des LangGraph-Workflows ist sichtbar: Researcher, Writer, Critic, Revision und Groundedness Check erscheinen als separate Ergebnisblöcke — kein Blackbox-Prompt, sondern nachvollziehbare LLM Orchestration mit typisierten Outputs an jeder Stufe.',
    modeActive: 'Mock-Modus standardmäßig aktiv',
    modeSuffix: '— wenn kein LLM-API-Schlüssel serverseitig konfiguriert ist, laufen alle fünf LangGraph-Knoten mit deterministischer Fallback-Logik. Es wird kein externer API-Aufruf gemacht.',
    modeEnvKey: 'OPENAI_API_KEY',
    modeApp: 'apps/ai',
    modeEnd: 'setzen, um den Live-LLM-Modus zu aktivieren.',
    safetyTitle: 'Sicherheitsgrenzen der Demo',
    safetyItems: [
      'Diese öffentliche Demo generiert ausschließlich bearbeitbare Textentwürfe. Kein Social-Media-Login, keine automatische Veröffentlichung jeglicher Art.',
      'Anfragen werden strukturell per Pydantic validiert; ein separater serverseitiger Keyword-Vorfilter blockiert offensichtlich unsichere Themen, bevor der Workflow startet. Blockierte Anfragen erhalten eine klare Meldung ohne interne Details.',
      'Workflow-Ausführungen sind per SlowAPI pro IP ratenlimitiert. Mock/Live Mode ist über eine Umgebungsvariable steuerbar — kein externer LLM-Aufruf ohne konfigurierten Key.',
    ],
    ariaPDR: 'Problem, Entscheidung und Ergebnis',
    sectionPDR: 'PDR',
    headingPDR: 'Problem → Entscheidung → Ergebnis',
    pdrCards: [
      { label: 'Problem', text: 'Ein einzelner LLM-Prompt gibt keinen Einblick, wie ein Ergebnis entstanden ist — ob Recherche stattfand, ob Kritik angewandt wurde oder ob Behauptungen belegt sind. Das macht die Ausgabe schwer zu überprüfen, zu vertrauen und zu verbessern.' },
      { label: 'Entscheidung', text: 'Entwicklung eines mehrstufigen LLM-Workflows mit LangGraph und Python/FastAPI: Researcher, Writer, Critic, Revision und Groundedness Check als eigenständige LangGraph-Knoten — jeder mit einem typisierten Structured Output, jedes Ergebnis im UI sichtbar.' },
      { label: 'Was es zeigt', text: 'Wie LLM Orchestration mit LangGraph eine beobachtbare Multi-Agent-Pipeline aufbaut — inspizierbar, testbar und schrittweise verbesserbar — statt einer Blackbox mit einem einzigen Prompt.' },
    ],
    ariaArch: 'Workflow-Architektur',
    sectionArch: 'Architektur',
    headingArch: 'Workflow-Architektur',
    controlFlow: 'Ablaufsteuerung',
    archSteps: [
      { num: '01', title: 'Input & Validierung', description: 'Thema wird per Pydantic validiert: Länge geprüft, Honeypot ausgewertet, unsichere Muster blockiert. Kein LangGraph-Knoten startet ohne validen Input. Validierungsfehler geben eine sichere Meldung zurück — keine internen Details.' },
      { num: '02', title: 'Optionale Web-Recherche', description: 'Wenn aktiviert, wird nur ein extrahierter Themen-String an Tavily gesendet; E-Mail-ähnliche Zeichenfolgen werden entfernt, die Suche wird nicht bewusst aus Namen oder Profildaten aufgebaut. Im Themenfeld sollten keine personenbezogenen Daten stehen. Gibt bis zu drei Kontextpunkte und Quellenangaben zurück. Fällt bei Nichtverfügbarkeit sauber zurück. Ergebnis wird als strukturierter Input an den Researcher-Knoten übergeben.' },
      { num: '03', title: 'Researcher (LangGraph-Knoten)', description: 'LLM strukturiert prägnante Kontextpunkte und thematische Winkel als typisierten Structured Output. Web-Kontext (falls vorhanden) wird synthetisiert — nicht roh an den nächsten Knoten weitergegeben. Ergebnis ist ein explizites typisiertes Objekt.' },
      { num: '04', title: 'Writer (LangGraph-Knoten)', description: 'Entwirft Hook, Text, Abschlusssatz und Hashtags mit dem gewählten Ton auf Basis des Researcher-Outputs. OpenAI Tool-Use erzwingt ein typisiertes JSON-Schema — kein freier Text fließt in den nächsten Knoten.' },
      { num: '05', title: 'Critic (LangGraph-Knoten)', description: 'Bewertet den Entwurf anhand eines 6-Punkte-Rasters: Klarheit, Spezifität, Relevanz, faktische Vorsicht, Tonanpassung, Struktur. Gibt Score (1–10) und actionable revision_instructions als Structured Output zurück. Score ≥ 8 routet direkt zum Groundedness Check.' },
      { num: '06', title: 'Revision (bedingter LangGraph-Knoten)', description: 'Läuft nur wenn Critic-Score unter 8. Überarbeitet den Entwurf gezielt anhand der revision_instructions — kein vollständiges Neuschreiben. Bei Score ≥ 8 wird dieser Knoten übersprungen; der Grund wird im Ergebnis dokumentiert und im UI angezeigt.' },
      { num: '07', title: 'Groundedness Check (LangGraph-Knoten)', description: 'Prüft, ob Behauptungen im finalen Entwurf gut belegt, spekulativ oder unbegründet sind. Gibt ein Status-Badge (grounded / needs_caution / unsupported) und Warnhinweise zurück. Ergebnis ist im UI sichtbar, bevor der Nutzer etwas kopiert.' },
      { num: '08', title: 'Human Review', description: 'Alle fünf Agenten-Ergebnisse werden als separate Blöcke angezeigt. Der finale Entwurf ist bearbeitbar. Kein Auto-Publishing — der Nutzer überprüft jedes Knoten-Ergebnis und entscheidet, was er verwendet.' },
    ],
    ariaStates: 'Workflow-Zustände',
    sectionStates: 'Interface-Zustände',
    headingStates: 'Workflow-Zustände',
    stateGroups: [
      {
        label: 'Eingabe',
        states: [
          { label: 'idle', description: 'Eingaben bereit. Noch kein LangGraph-Workflow gestartet. Alle 7 Zustände als TypeScript Discriminated Union getypt — kein undefinierter State möglich.' },
          { label: 'running', description: 'LangGraph-Workflow läuft im Python/FastAPI-Backend. Eingaben gesperrt. Jeder Knoten erzeugt ein typisiertes Ergebnis — kein unbeobachteter Zwischenzustand.' },
        ],
      },
      {
        label: 'Agent',
        states: [
          { label: 'researching', description: 'Researcher-Knoten strukturiert Kontextpunkte und thematische Winkel als typisierten Structured Output.' },
          { label: 'drafting', description: 'Writer-Knoten generiert einen strukturierten Entwurf: Hook, Text, Abschluss, Hashtags.' },
          { label: 'critiquing', description: 'Critic-Knoten bewertet den Entwurf anhand des 6-Punkte-Rasters und gibt Score und revision_instructions zurück.', example: 'Score 7/10. Zwei Bereiche: weicherer Einstieg, spezifischere Abschlussfrage.' },
          { label: 'revising', description: 'Revision-Knoten überarbeitet gezielt anhand der revision_instructions — läuft nur bei Score < 8. Übersprungen und dokumentiert bei Score ≥ 8.' },
        ],
      },
      {
        label: 'Überprüfung',
        states: [
          { label: 'final_ready', description: 'Groundedness Check abgeschlossen. Alle Knoten-Ergebnisse als separate Blöcke sichtbar. Finaler Entwurf im bearbeitbaren Textfeld, zum Kopieren bereit.' },
        ],
      },
      {
        label: 'Sicherheit',
        states: [
          { label: 'unsafe_topic', description: 'Thema durch einen serverseitigen Keyword-Vorfilter blockiert (separat von Pydantics struktureller Validierung), bevor ein LangGraph-Knoten startet. Sicherer Stopp mit klarer Meldung — kein LLM aufgerufen, keine internen Details.' },
          { label: 'rate_limited', description: 'Rate Limit erreicht (5 Ausführungen/IP/Stunde via SlowAPI). Sichere Meldung, keine internen Details. Reset verfügbar. Bewusst pro IP — echte Per-Nutzer-Fairness bräuchte Login.' },
          { label: 'error', description: 'Netzwerk- oder Python/FastAPI-Backend-Fehler. Sichere Nutzerfehlermeldung. Keine Stack-Traces oder internen Details an den Client.' },
        ],
      },
    ],
    ariaSafety: 'Guardrails und Betriebsgrenzen',
    sectionSafety: 'Guardrails & Grenzen',
    headingSafety: 'Guardrails der öffentlichen Demo',
    safetyIntro: 'Die öffentliche Demo ist ratenlimitiert und per Pydantic-Validierung abgesichert. Ziel: den LangGraph-Workflow testbar machen — ohne Auto-Publishing, unbegrenzte LLM-Ausgaben oder datenschutzrelevante Suchen. Guardrails und Rate Limits sind hier zwei verschiedene Dinge: Guardrails begrenzen, was der Workflow strukturell überhaupt produzieren kann; Rate Limits begrenzen, wie oft er läuft.',
    techSafety: [
      { title: 'Guardrails', items: ['Keyword-Vorfilter blockiert offensichtliche Fälle (Spam, Identitätsdiebstahl, Belästigung, Desinformation) bevor ein LangGraph-Knoten startet — eine billige Heuristik, nicht die eigentliche Qualitäts-/Sicherheitsgrenze', 'Critic-Knoten bewertet den Entwurf — unter 8 Punkten löst genau einen bedingten Revisionsdurchlauf aus, der Workflow adressiert Probleme statt einen schwachen Entwurf unverändert auszuliefern', 'Groundedness Check läuft zuletzt, nach jeder Revision — prüft den Entwurf gegen recherchierte Quellen, wenn verfügbar, sonst gegen den eigenen Recherchekontext des Workflows, und kennzeichnet reine Plausibilitätsprüfungen klar', 'Typisierte Structured Outputs zwischen LangGraph-Knoten — kein Freitext wird still zwischen Researcher, Writer und Critic weitergereicht', 'Alle Request-Bodies per Pydantic validiert — unbekannte Felder abgelehnt'] },
      { title: 'Rate- & Eingabelimits', items: ['5 Workflow-Ausführungen pro IP pro Stunde — SlowAPI in Python/FastAPI', 'Thema auf 300 Zeichen begrenzt — per Pydantic in Python/FastAPI validiert', 'Honeypot-Feld verwirft Bot-Einsendungen stillschweigend ohne die Prüfung zu verraten', 'Rate-Limit-Antworten geben sichere Meldungen ohne interne Details', 'Zentraler Provider-Timeout für jeden OpenAI-Aufruf — der Workflow schlägt sicher fehl, statt bei einem hängenden Aufruf unbegrenzt zu warten'] },
      { title: 'Web-Kontext-Limits', items: ['Nur ein extrahierter Themen-String wird an Tavily gesendet; die Suche wird nicht bewusst aus Namen oder Profildaten aufgebaut — im Themenfeld sollten keine personenbezogenen Daten stehen', 'E-Mail-ähnliche Zeichenfolgen werden vor dem Tavily-Aufruf aus dem Thema entfernt', 'Thema auf 200 Zeichen für die Suchanfrage begrenzt', 'httpx.AsyncClient(timeout=8.0) begrenzt die Tavily-Request-Dauer', 'Opt-in — Standard ist deaktiviert. Kein Aufruf ohne explizite Aktivierung'] },
      { title: 'Output-Grenzen', items: ['Kein Social-Media-Login, kein Auto-Publishing jeglicher Art', 'Alle Agenten-Ergebnisse sind vor dem Kopieren bearbeitbar — Mensch kontrolliert finale Ausgabe', 'Keine Inhalte serverseitig zwischen Workflow-Ausführungen gespeichert', 'Zwischenschritte (Researcher, Critic, Groundedness) im UI sichtbar — kein versteckter Chain-of-Thought'] },
    ],
    ariaImpl: 'Technische Umsetzung',
    sectionImpl: 'Technische Umsetzung',
    headingImpl: 'Implementierungsdetails',
    implIntro: 'Die Anwendung trennt Verantwortlichkeiten klar: Next.js rendert Workflow-Schritte und Review-Interface, Python/FastAPI orchestriert die LangGraph-Knoten, und das LLM erzeugt ausschließlich typisierte Structured Outputs — kein freier Text fließt zwischen den Knoten.',
    techImpl: [
      { title: 'Frontend (Next.js)', items: ['7 explizite Workflow-Zustände als TypeScript Discriminated Union', 'Keine externe State-Bibliothek — useState + Discriminated Union', 'Reveal-Stufe zeigt Knoten-Ergebnisblöcke alle 600ms schrittweise', 'ARIA-Live-Region kündigt Zustandswechsel für Screenreader an', 'Alle interaktiven Elemente tastaturzugänglich mit sichtbaren Fokuszuständen'] },
      { title: 'AI-Backend (Python/FastAPI)', items: ['LangGraph-Graph mit 6 benannten Knoten: Researcher, Writer, Critic, Reviser, Skip Revision, Groundedness', 'Bedingter Edge nach Critic: Score < 8 → Revision-Knoten, Score ≥ 8 → Groundedness-Knoten', 'Pydantic-Modelle validieren alle Request-Bodies — unbekannte Felder abgelehnt', 'SlowAPI setzt Rate Limits pro Route serverseitig durch', 'Mock Mode liefert deterministische Structured Outputs wenn OPENAI_API_KEY fehlt'] },
      { title: 'LLM Design (Structured Outputs)', items: ['OpenAI Tool-Use erzwingt typisiertes JSON-Schema an jedem LangGraph-Knoten', 'Jedes Knoten-Ergebnis ist ein eigenes Pydantic-Modell — kein gemeinsamer untypisierter Output', 'Researcher → typisierte Kontextpunkte; Writer → typisierte Entwurfsfelder; Critic → Score + Instructions', 'Bedingtes Routing nach Critic-Score ist ein LangGraph Conditional Edge — keine Prompt-Logik', 'parseToolArgs<T>() im Frontend parst jedes Knoten-Ergebnis sicher — null bei Fehlschlag'] },
      { title: 'Bedingte Revision', items: ['Critic bewertet Entwurf 1–10 anhand 6 Kriterien: Klarheit, Spezifität, Relevanz, faktische Vorsicht, Ton, Struktur', 'Revision läuft nur bei Score < 8 — bedingter LangGraph-Knoten, nicht immer ausgeführt', 'Revision erhält Entwurf und spezifische revision_instructions vom Critic-Knoten', 'Übersprungene Revision wird mit Critic-Score und Grund im Ergebnis dokumentiert', 'Score und Verbesserungsbereiche im UI sichtbar — kein versteckter Chain-of-Thought', 'evals/cs02_eval.py prüft 6 feste Themen und testet den Vertrag für die bedingte Revision (Score < 8 muss Revision-Notizen erzeugen, ≥ 8 muss sie überspringen) statt subjektiv "gute Qualität" zu beurteilen — läuft deterministisch im Mock-Modus in CI bei jedem Push und kann zusätzlich manuell gegen das echte Modell ausgeführt werden'] },
      { title: 'Groundedness Check', items: ['Letzter LangGraph-Knoten prüft ob Behauptungen belegt, spekulativ oder unbegründet sind', 'Gibt Status-Badge zurück: grounded / needs_caution / unsupported', 'Warnhinweise im UI sichtbar — Nutzer sieht sie vor dem Kopieren', 'Läuft nach Revision (oder nach Writer wenn Revision übersprungen) — immer letzter LLM-Aufruf', 'Fördert menschliche Überprüfung KI-generierter Behauptungen vor jeder Verwendung'] },
      { title: 'Optionaler Web-Kontext', items: ['Opt-in Tavily-Suche reichert den Researcher-Knoten mit aktuellem Themenkontext an', 'E-Mail-Adressen werden vor dem Tavily-Aufruf aus dem Thema entfernt', 'Tavily-Ergebnis als typisierter Kontext-Input übergeben — Researcher synthetisiert, transkribiert nicht', 'Kontextpunkte und Quellenangaben im UI sichtbar', 'Checkbox standardmäßig deaktiviert — kein externer Aufruf ohne explizite Aktivierung'] },
    ],
    ariaRepo: 'Repository-Dokumentation',
    sectionRepo: 'Repository',
    headingRepo: 'Repository-Nachweis',
    repoPara1: 'Die vollständige LangGraph-Implementierung liegt im Monorepo unter apps/ai. Alle sechs Knoten (einschließlich des Skip-Revision-Leerknotens) sind als separate Python-Funktionen mit Pydantic-Antwortmodellen implementiert, mit einem bedingten Revision-Edge nach dem Critic-Knoten. Die Zustandsmaschine im Next.js-Frontend nutzt TypeScript Discriminated Unions für alle 7 Workflow-Zustände — typisiert von Pydantic-Modell bis React-Komponente.',
    repoPara2Before: 'Geteilte Zod-Schemas in',
    repoPara2After: 'definieren den Anfrage- und Ergebnisvertrag auf TypeScript-Seite — für Validierung und Typsicherheit im Frontend ohne Duplikation.',
    repoPara3: 'Die Tavily-Integration ist mit einem expliziten Datenschutzvertrag dokumentiert: Nur das Post-Thema wird an die Such-API gesendet, E-Mail-Adressen werden vor jeder Anfrage entfernt, und die Funktion bleibt standardmäßig deaktiviert. Die Mock/Live-Mode-Trennung ist für lokale Entwicklung und Production-Deployment dokumentiert.',
    repoEnvTitle: 'Wichtige Umgebungsvariablen',
    repoEnvItems: [
      ['OPENAI_API_KEY', 'LLM provider key — nur Python/FastAPI Backend'],
      ['OPENAI_BASE_URL', 'Optional — Standard: api.openai.com/v1'],
      ['AI_MODEL', 'Modell-ID — Standard: gpt-4o-mini'],
      ['TAVILY_API_KEY', 'Optional — aktiviert Web-Kontext-Anreicherung'],
      ['MAX_TOPIC_LENGTH', '300 — Themen-Zeichenlimit per Pydantic'],
    ],
    ariaNext: 'Nächste Iteration',
    sectionNext: 'Nächste Iteration',
    headingNext: 'Was als Nächstes käme',
    nextItems: [
      'Modulare Trennung — Agent-Node-Logik und Prompt-Definitionen liegen aktuell in der Route-Datei für übersichtliche Eigenständigkeit; der nächste Schritt wäre die Extraktion in ein agents/-Layer und ein prompts/-Modul, sobald der Workflow wächst',
      'Größeres Evaluationsset (30-50 gelabelte Fälle, aktuell 6) — unterschiedliche Themenklassen, absichtlich unbelegte Aussagen, widersprüchliche Quellen, Prompt-Injection-Inhalte in Suchergebnissen, erwarteter groundingBasis, erwartete unterstützte/nicht unterstützte Claims, verfolgt über Modell- und Prompt-Versionen',
      'Qualitätsmetriken im UI — Critic-Score-Verlauf, Groundedness-Verteilung, Revisionsrate über Zeit',
      'Quellendarstellung — Tavily-Quellenangaben direkt im Researcher-Ergebnisblock anzeigen',
      'Entwurfs-Export — als Markdown oder strukturiertes JSON kopieren für Weiterverarbeitung',
      'Prompt-Versionierung — Critic- und Writer-System-Prompts A/B-testen, Qualitätsunterschied messen',
      'Erweiterte Testabdeckung — Pytest für alle LangGraph-Knoten, Playwright für den Workflow-UI-Flow',
      'Parallele Knotenausführung bei unabhängigen Schritten — Gesamtlatenz reduzieren',
    ],
  },
} as const;

export function Cs02Content() {
  const { lang } = useLang();
  const d = c[lang];
  const accent = 'var(--color-fg)';

  return (
    <main className="pt-32 pb-28 md:pb-40 px-8 md:px-16 lg:px-20">
      <div className="max-w-[1920px] mx-auto">

        <CaseStudyBackLink />

        {/* 1. Hero */}
        <section aria-label={d.ariaIntro}>
          <CaseStudyEyebrow number="02" accent={accent} />
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-fg tracking-tight leading-[1.02] mb-6">
            Research-to-Post Multi-Agent Workflow
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

          <p className="text-base lg:text-lg text-muted leading-[1.75] mb-6 max-w-3xl">{d.liveIntro}</p>

          {/* ModeNote */}
          <div className="border border-border rounded-lg bg-surface px-5 py-4 flex items-start gap-3 max-w-3xl">
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

          {/* Safety note */}
          <div className="mt-6 mb-8 border border-border rounded-lg bg-surface p-6 max-w-3xl">
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

          <div className="mt-8">
            <MultiAgentPostWorkflow />
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
                  packages/types/src/multi-agent-post.ts
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

        <CaseStudyFooterNav
          previous={{ href: '/work/ai-operations-workflow-agent', number: '01' }}
          next={{ href: '/work/research-rag-assistant', number: '03' }}
        />

      </div>
    </main>
  );
}
