'use client';

import { useLang } from '@/lib/i18n';
import { RagWorkflow } from '@/components/work/rag/RagWorkflow';
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
        <FlowNode label="parse_pdfs" />
        <FlowArrow />
        <FlowNode label="chunk_text" />
        <FlowArrow />
        <FlowNode label="create_embeddings" />
        <FlowArrow />
        <FlowNode label="build_index" />
        <div className="mt-3 ml-4 space-y-1 border-l border-border pl-4">
          <span className="text-subtle text-base">user asks question:</span>
        </div>
        <FlowArrow />
        <FlowNode label="embed_question" />
        <FlowArrow />
        <FlowNode label="retrieve_chunks" />
        <FlowArrow />
        <FlowNode label="generate_answer" />
        <FlowArrow />
        <FlowNode label="END" accent />
      </div>
    </div>
  );
}

const c = {
  en: {
    ariaIntro: 'Case study introduction',
    tagline: 'A fullstack RAG application for PDF-based research: upload documents, process content with sentence-aware chunking, generate embeddings, retrieve relevant passages, and stream retrieval-constrained answers with visible sources via SSE — built with Next.js, Python/FastAPI, OpenAI Embeddings, and temporary in-memory sessions.',
    tags: ['RAG', 'PDF Processing', 'Embeddings', 'SSE Streaming', 'Source Grounding'],
    ariaDetails: 'Project details',
    sectionDetails: 'Project details',
    metaItems: [
      { label: 'Status', value: 'Live deployment — Vercel + Railway' },
      { label: 'Type', value: 'Fullstack RAG application (self-initiated)' },
      { label: 'Role', value: 'Next.js frontend, Python/FastAPI backend, RAG pipeline design, deployment' },
      { label: 'Focus', value: 'Retrieval-Augmented Generation · PDF processing · Embeddings · SSE streaming' },
      { label: 'Stack', value: 'Next.js · TypeScript · Python · FastAPI · OpenAI Embeddings · pypdf · Docker · Railway · Vercel' },
      { label: 'Safety', value: 'Upload limits · Temporary sessions · No permanent storage · Rate limits' },
    ],
    ariaLive: 'Live workflow application',
    sectionLive: 'Live Application',
    headingLive: 'Live workflow',
    liveIntro: 'The RAG pipeline runs as a fullstack application: PDF upload → text extraction → chunking → embeddings → sqlite-vec vector search → retrieval-constrained answer via SSE streaming. Sources appear immediately; the answer builds token by token. Upload a PDF or download one of the two sample documents below.',
    modeActive: 'Mock mode active by default',
    modeSuffix: '— when no API key is configured server-side, the workflow uses keyword-based retrieval and deterministic sample answers. No external API call is made. Set',
    modeEnvKey: 'OPENAI_API_KEY',
    modeApp: 'apps/ai',
    modeEnd: 'to enable live semantic embeddings and SSE-streamed LLM answers.',
    safetyTitle: 'Demo safety constraints',
    safetyItems: [
      'PDF-only uploads, max 10 MB per file, max 3 PDFs, max 25 MB total — processed in memory, never stored permanently.',
      'Sessions expire after 2 hours and are cleared entirely from server memory — no data persists between sessions.',
      'Rate-limited per IP via SlowAPI: 10 upload jobs, 20 questions per hour. Mock/live mode toggled by environment variable.',
      'In live mode, document text is sent to OpenAI to create embeddings, and retrieved passages are sent again for answer generation. This application does not permanently store uploaded files.',
    ],
    ariaPDR: 'Problem, decision, and result',
    sectionPDR: 'PDR',
    headingPDR: 'Problem → Decision → Result',
    pdrCards: [
      { label: 'Problem', text: 'LLM answers without retrieval context hallucinate — they produce plausible-sounding claims with no grounding in the actual document. With long PDFs this is hard to detect: there is no way to see which passage the answer came from.' },
      { label: 'Decision', text: 'Built a fullstack RAG application with Python/FastAPI: PDF upload, sentence-aware chunking, OpenAI Embeddings, sqlite-vec vector search, and retrieval-constrained answer generation via SSE streaming — with temporary in-memory sessions and visible source passages.' },
      { label: 'What it demonstrates', text: 'How Retrieval-Augmented Generation reduces hallucination by constraining answers to retrieved passages — with visible sources, an explicit retrieval score, and SSE streaming so the user sees sources before the answer builds.' },
    ],
    ariaArch: 'Workflow architecture',
    sectionArch: 'Architecture',
    headingArch: 'Workflow architecture',
    controlFlow: 'Control flow',
    archSteps: [
      { num: '01', title: 'Upload & validate', description: 'PDFs are validated by Python/FastAPI: type checked, size per file (10 MB), total size (25 MB), and count (max 3) enforced before any processing begins. Invalid files return a clear error — no partial processing.' },
      { num: '02', title: 'Text extraction (pypdf)', description: 'PDF text is extracted server-side with pypdf. Image-only PDFs are rejected — empty extracted text triggers a clear error. Page count is capped at 80 to prevent excessive processing.' },
      { num: '03', title: 'Sentence-aware chunking', description: 'Extracted text is split into overlapping segments (~400 chars, ~80-char overlap). Overlap preserves sentence context across chunk boundaries. Short chunks (< 20 chars) are filtered to reduce retrieval noise.' },
      { num: '04', title: 'Embedding generation', description: 'Each chunk is embedded with the configured OpenAI Embeddings model (text-embedding-3-small by default). In mock mode, keyword-based pseudo-embeddings are used — no external API call. All embedding calls are Python/FastAPI-only.' },
      { num: '05', title: 'Build the vector index', description: 'Embeddings are inserted into a session-scoped sqlite-vec vec0 virtual table (in-memory SQLite, cosine distance metric) — a real vector index with k-NN search, not a Python loop over cosine similarity. Sessions expire after 2 hours; no data is written to disk at any point in the pipeline.' },
      { num: '06', title: 'Retrieve relevant passages', description: 'The user question is embedded and queried against the vec0 index with a k-nearest-neighbor SQL query. Top 5 passages are returned with their similarity scores (1 − cosine distance). A minimum score threshold (0.1) filters unrelated chunks.' },
      { num: '07', title: 'SSE streaming answer', description: 'Python/FastAPI streams the answer via SSE (StreamingResponse, text/event-stream). Events: sources (immediate), token (per chunk), done / no_context / error. The Next.js frontend parses the SSE stream with a ReadableStream buffer — sources appear before the answer builds.' },
    ],
    ariaStates: 'Workflow states',
    sectionStates: 'Interface states',
    headingStates: 'Workflow states',
    stateGroups: [
      {
        label: 'Upload',
        states: [
          { label: 'idle', description: 'Upload zone visible. No documents loaded. All 11 states typed as a discriminated union — no undefined state possible.' },
          { label: 'files_selected', description: 'PDFs selected. Validation passed client-side. Ready to send to Python/FastAPI for indexing.' },
        ],
      },
      {
        label: 'Indexing',
        states: [
          { label: 'uploading', description: 'Full RAG pipeline running in Python/FastAPI: text extraction → chunking → embedding generation. Each step is sequential with typed results — not a blackbox.' },
          { label: 'ready', description: 'sqlite-vec vector index built. Session active. Question input enabled. Index stays in memory for 2 hours.' },
        ],
      },
      {
        label: 'Question',
        states: [
          { label: 'asking', description: 'Question embedded server-side. k-NN vector search running against the session sqlite-vec index.' },
          { label: 'streaming', description: 'SSE stream open. Sources appear immediately from the first event. Answer builds token by token. AbortController available to cancel mid-stream.' },
          { label: 'answer_ready', description: 'SSE stream complete. Full retrieval-constrained answer with cited passages and retrieval scores visible.' },
          { label: 'no_context', description: 'Retrieval returned no passages above the minimum score threshold. No LLM call made. Clear message shown.' },
        ],
      },
      {
        label: 'Safety',
        states: [
          { label: 'rate_limited', description: 'Rate limit reached (SlowAPI, per IP). Safe message shown, no internal details. Reset available.' },
          { label: 'upload_error', description: 'File rejected by Python/FastAPI: wrong type, too large, too many pages, or no extractable text.' },
          { label: 'ask_error', description: 'Network or Python/FastAPI backend error. Safe user-facing message. No stack traces or internal details exposed.' },
        ],
      },
    ],
    ariaSafety: 'Guardrails and operational constraints',
    sectionSafety: 'Guardrails & limits',
    headingSafety: 'Public demo guardrails',
    safetyIntro: 'The public demo enforces strict file, session, and rate limits so the RAG pipeline can be tested safely — without permanent storage, unbounded embedding calls, or privacy violations. Guardrails and rate limits are two different things here: guardrails constrain what the pipeline is structurally able to answer; rate limits constrain how often it can be called.',
    techSafety: [
      { title: 'Guardrails', items: ['Keyword pre-filter blocks obvious unsafe questions before any LLM call — a cheap heuristic, not the actual boundary', 'Answer generation receives only the retrieved passages as document context and is instructed to rely on them — a prompt-level grounding constraint, not a mechanically enforced guarantee against unsupported content', 'All embeddings generated server-side in Python/FastAPI — OpenAI key never reaches the browser', 'no_context state returned when retrieval score is below threshold — no hallucinated answer when nothing relevant was found', 'Minimum score threshold (0.1) prevents unrelated chunks from entering the answer context', 'Server-generated UUID4 session IDs make accidental cross-session access unlikely — this public demo has no per-user authentication, and the session ID functions as a bearer identifier'] },
      { title: 'File limits', items: ['PDF only — other file types rejected by Python/FastAPI before any processing', 'Max 10 MB per file — enforced before text extraction', 'Max 25 MB total per upload session', 'Max 3 PDFs per session — index size stays predictable', 'Max 80 pages per PDF — prevents excessive processing', 'Image-only PDFs rejected — empty extracted text triggers a clear error', 'Processed in Python/FastAPI memory only — no disk writes at any stage'] },
      { title: 'Rate limits', items: ['10 upload jobs per IP per hour — SlowAPI in Python/FastAPI', '20 questions per IP per hour', 'Rate limit responses return safe messages without internal details', 'Session data cleared server-side after 2 hours — not before'] },
      { title: 'Privacy', items: ['No permanent file storage — all session data lives only in Python/FastAPI memory', 'Each document collection is isolated in a session-scoped in-memory index — the session ID is reused across requests (upload, questions, streaming) and functions as a bearer identifier, with no per-user authentication in this demo', 'Document text is sent to OpenAI for embeddings, and retrieved passages are sent again for answer generation — not sent for embedding only', 'API keys are Python/FastAPI-only — never sent to the browser or logged', 'No document content in server logs', 'SSE stream cancelled cleanly via AbortController when user resets mid-stream'] },
    ],
    ariaImpl: 'Technical implementation',
    sectionImpl: 'Technical implementation',
    headingImpl: 'Implementation details',
    implIntro: 'The fullstack RAG application separates responsibilities clearly: Next.js owns the upload UI, SSE streaming display, and session state. Python/FastAPI runs the complete RAG pipeline — extraction, chunking, embeddings, retrieval, and SSE-streamed answer generation.',
    techImpl: [
      { title: 'Frontend (Next.js)', items: ['11 explicit workflow stages as TypeScript discriminated union', 'ReadableStream SSE parser: buffer split on \\n\\n, inner split on data: prefix', 'AbortController ref cancels in-flight streams on reset without side-effects', 'Sources rendered immediately from first SSE event — before answer starts building', 'ARIA live region announces state transitions for screen readers'] },
      { title: 'AI backend (Python/FastAPI)', items: ['pypdf extracts text server-side — no client-side PDF parsing', 'SlowAPI enforces per-route rate limits (10 uploads/hour, 20 questions/hour)', 'Each session gets its own in-memory SQLite database with the sqlite-vec extension loaded', 'StreamingResponse with media_type=text/event-stream for SSE answer delivery', 'Mock mode: keyword pseudo-embeddings + direct passage return when OPENAI_API_KEY absent'] },
      { title: 'RAG design', items: ['LLM system prompt explicitly constrains answer to retrieved passages only', 'Source citations required in the answer ([1], [2], etc.) — enforced by prompt', 'sqlite-vec vec0 virtual table, cosine distance metric: k-NN query for top 5 passages, minimum score 0.1', 'no_context path: if retrieval returns no passages above threshold, SSE emits no_context event — no LLM call made', 'Retrieval score surfaced in the UI so users can assess passage relevance'] },
      { title: 'Chunking', items: ['Sentence-aware splitting — ~400 chars per chunk, ~80-char overlap', 'Overlap preserves sentence context across chunk boundaries', 'Short chunks filtered (< 20 chars) to reduce retrieval noise', 'Chunk count capped per session to keep index size predictable'] },
      { title: 'Embeddings', items: ['text-embedding-3-small by default — configurable via EMBEDDING_MODEL env var', 'Mock mode: keyword pseudo-embeddings (64-dim, character statistics) — no API call', 'All embedding calls in Python/FastAPI only — OPENAI_API_KEY never reaches the browser', 'Embeddings inserted into the vec0 table by rowid; chunk text/filename kept in a parallel list, looked up by rowid on retrieval'] },
      { title: 'SSE streaming', items: ['Python/FastAPI StreamingResponse with media_type="text/event-stream"', 'Events: sources (immediate, with passages + confidence + reasoning), token (per LLM chunk), done, no_context, error', 'Next.js ReadableStream decoder: buffer remainder preserved between chunks', 'Streaming state: partial answer string updated with each token event', 'AbortController signal passed as signal ?? null (exactOptionalPropertyTypes safe)'] },
    ],
    ariaRepo: 'Repository documentation',
    sectionRepo: 'Repository',
    headingRepo: 'Repository proof',
    repoPara1: 'The full RAG implementation lives in the monorepo under apps/ai (Python/FastAPI). Upload endpoint, ask endpoint, and SSE streaming endpoint are implemented as separate FastAPI routes. The session store is a per-session in-memory SQLite database with the sqlite-vec extension for vector search, typed with Pydantic models at the API boundary. The Next.js frontend uses TypeScript discriminated unions for all 11 workflow stages.',
    repoPara2Before: 'Shared Zod schemas in',
    repoPara2After: 'define the upload and ask contracts on the TypeScript side — used for client-side validation and frontend type safety without duplicating Pydantic models.',
    repoPara3: 'The mock/live mode separation is documented for local development: keyword pseudo-embeddings replace OpenAI calls, passage text is returned directly instead of streamed, and the mock flag is surfaced in the UI response. The SSE streaming endpoint is documented separately with its event sequence and cancellation contract.',
    repoEnvTitle: 'Key environment flags',
    repoEnvItems: [
      ['OPENAI_API_KEY', 'Embeddings + SSE answer generation — Python/FastAPI only'],
      ['EMBEDDING_MODEL', 'Optional — defaults to text-embedding-3-small'],
      ['AI_MODEL', 'Answer generation model — defaults to gpt-4o-mini'],
      ['MAX_UPLOAD_MB', '10 — per-file size limit enforced by Python/FastAPI'],
      ['MAX_TOTAL_UPLOAD_MB', '25 — total session upload limit'],
      ['MAX_PDFS', '3 — max PDFs per session'],
    ],
    ariaNext: 'Next iteration',
    sectionNext: 'Next iteration',
    headingNext: 'What would come next',
    nextItems: [
      'Vector database (Chroma or pgvector) instead of in-memory — persistent document collections across sessions',
      'Hybrid search — combine embedding retrieval with BM25 keyword matching for better recall on exact terms',
      'Reranking — cross-encoder reranker after the first retrieval pass to improve passage relevance',
      'Evaluation set — question/answer pairs to measure retrieval and answer quality across chunking and embedding strategies',
      'Citation highlighting — mark source passages in a page-level PDF viewer',
      'Export — answer with source citations as Markdown or BibTeX',
      'DOCX and plain text upload support alongside PDF',
      'Pytest for all RAG pipeline steps, Playwright for the upload and streaming flow',
    ],
  },
  de: {
    ariaIntro: 'Einführung in die Fallstudie',
    tagline: 'Eine Fullstack-RAG-Anwendung für PDF-basierte Recherche: Dokumente hochladen, Inhalte chunking-basiert verarbeiten, Embeddings erzeugen, relevante Passagen abrufen und retrieval-beschränkte Antworten mit sichtbaren Quellen per SSE Streaming ausgeben — umgesetzt mit Next.js, Python/FastAPI, OpenAI Embeddings und temporären In-Memory-Sessions.',
    tags: ['RAG', 'PDF Processing', 'Embeddings', 'SSE Streaming', 'Source Grounding'],
    ariaDetails: 'Projektdetails',
    sectionDetails: 'Projektdetails',
    metaItems: [
      { label: 'Status', value: 'Live Deployment — Vercel + Railway' },
      { label: 'Typ', value: 'Fullstack-RAG-Anwendung (selbstinitiiert)' },
      { label: 'Rolle', value: 'Next.js Frontend, Python/FastAPI Backend, RAG Pipeline Design, Deployment' },
      { label: 'Schwerpunkt', value: 'Retrieval-Augmented Generation · PDF Processing · Embeddings · SSE Streaming' },
      { label: 'Stack', value: 'Next.js · TypeScript · Python · FastAPI · OpenAI Embeddings · pypdf · Docker · Railway · Vercel' },
      { label: 'Sicherheit', value: 'Upload Limits · Temporäre Sessions · Kein permanenter Speicher · Rate Limits' },
    ],
    ariaLive: 'Live-Workflow-Anwendung',
    sectionLive: 'Live-Anwendung',
    headingLive: 'Live-Workflow',
    liveIntro: 'Die RAG-Pipeline läuft als Fullstack-Anwendung: PDF-Upload → Text-Extraktion → Chunking → Embeddings → sqlite-vec-Vektorsuche → retrieval-beschränkte Antwort per SSE Streaming. Quellen erscheinen sofort aus dem ersten SSE-Event, die Antwort baut sich tokenweise auf. PDF hochladen oder eines der Beispieldokumente nutzen.',
    modeActive: 'Mock-Modus standardmäßig aktiv',
    modeSuffix: '— wenn kein API-Schlüssel serverseitig konfiguriert ist, verwendet der Workflow schlüsselwortbasiertes Retrieval und deterministische Beispielantworten. Es wird kein externer API-Aufruf gemacht.',
    modeEnvKey: 'OPENAI_API_KEY',
    modeApp: 'apps/ai',
    modeEnd: 'setzen, um semantische OpenAI-Embeddings und SSE-gestreamte LLM-Antworten zu aktivieren.',
    safetyTitle: 'Sicherheitsgrenzen der Demo',
    safetyItems: [
      'Nur PDF-Uploads, max. 10 MB pro Datei, max. 3 PDFs, max. 25 MB insgesamt — im Arbeitsspeicher verarbeitet, nie permanent gespeichert.',
      'Sessions laufen nach 2 Stunden ab und werden vollständig aus dem Python/FastAPI-Serverspeicher gelöscht — keine Daten bleiben zwischen Sessions erhalten.',
      'Ratenlimitiert pro IP per SlowAPI: 10 Upload-Jobs, 20 Fragen pro Stunde. Mock/Live Mode über Umgebungsvariable steuerbar.',
      'Im Live-Modus wird Dokumenttext zur Erstellung von Embeddings an OpenAI gesendet, abgerufene Passagen werden für die Antwortgenerierung erneut gesendet. Diese Anwendung speichert hochgeladene Dateien nicht dauerhaft.',
    ],
    ariaPDR: 'Problem, Entscheidung und Ergebnis',
    sectionPDR: 'PDR',
    headingPDR: 'Problem → Entscheidung → Ergebnis',
    pdrCards: [
      { label: 'Problem', text: 'LLM-Antworten ohne Retrieval-Kontext halluzinieren — sie erzeugen plausibel klingende Behauptungen ohne Verankerung im tatsächlichen Dokument. Bei langen PDFs ist das schwer zu erkennen: es gibt keine Möglichkeit zu sehen, aus welcher Passage die Antwort stammt.' },
      { label: 'Entscheidung', text: 'Entwicklung einer Fullstack-RAG-Anwendung mit Python/FastAPI: PDF-Upload, satzbasiertes Chunking, OpenAI Embeddings, sqlite-vec-Vektorsuche und retrieval-beschränkte Antwortgenerierung per SSE Streaming — mit temporären In-Memory-Sessions und sichtbaren Quellpassagen.' },
      { label: 'Was es zeigt', text: 'Wie Retrieval-Augmented Generation Halluzinationen reduziert, indem Antworten auf abgerufene Passagen beschränkt werden — mit sichtbaren Quellen, explizitem Retrieval-Score und SSE Streaming, damit der Nutzer die Quellen sieht bevor die Antwort aufgebaut wird.' },
    ],
    ariaArch: 'Workflow-Architektur',
    sectionArch: 'Architektur',
    headingArch: 'Workflow-Architektur',
    controlFlow: 'Ablaufsteuerung',
    archSteps: [
      { num: '01', title: 'Upload & Validierung', description: 'PDFs werden per Python/FastAPI validiert: Typ, Größe pro Datei (10 MB), Gesamtgröße (25 MB) und Anzahl (max. 3) werden vor jeder Verarbeitung durchgesetzt. Ungültige Dateien geben eine klare Fehlermeldung zurück — keine Teilverarbeitung.' },
      { num: '02', title: 'Text-Extraktion (pypdf)', description: 'PDF-Text wird serverseitig mit pypdf extrahiert. Nur-Bild-PDFs werden abgelehnt — leerer extrahierter Text löst einen klaren Fehler aus. Seitenanzahl auf 80 begrenzt, um übermäßige Verarbeitung zu verhindern.' },
      { num: '03', title: 'Satzbasiertes Chunking', description: 'Extrahierter Text wird in überlappende Segmente aufgeteilt (~400 Zeichen, ~80 Zeichen Überlappung). Überlappung bewahrt Satzkontext über Chunk-Grenzen. Kurze Chunks (< 20 Zeichen) werden gefiltert, um Rauschen beim Retrieval zu reduzieren.' },
      { num: '04', title: 'Embedding-Generierung', description: 'Jeder Chunk wird mit dem konfigurierten OpenAI-Embedding-Modell eingebettet (Standard: text-embedding-3-small). Im Mock-Modus werden schlüsselwortbasierte Pseudo-Embeddings verwendet — kein externer API-Aufruf. Alle Embedding-Aufrufe nur in Python/FastAPI.' },
      { num: '05', title: 'Vektorindex aufbauen', description: 'Embeddings werden in eine sitzungsbezogene sqlite-vec vec0-Virtual-Table eingefügt (In-Memory-SQLite, Cosine-Distanz-Metrik) — ein echter Vektorindex mit k-NN-Suche, keine Python-Schleife über Cosine-Similarity. Sessions laufen nach 2 Stunden ab, keine Daten werden an irgendeinem Punkt der Pipeline auf Datenträger geschrieben.' },
      { num: '06', title: 'Relevante Passagen abrufen', description: 'Die Nutzerfrage wird eingebettet und per k-Nearest-Neighbor-SQL-Query gegen den vec0-Index abgefragt. Top 5 Passagen werden mit ihren Ähnlichkeitsscores (1 − Cosine-Distanz) zurückgegeben. Ein Minimum-Score-Schwellenwert (0,1) filtert nicht relevante Chunks.' },
      { num: '07', title: 'SSE-Streaming-Antwort', description: 'Python/FastAPI streamt die Antwort per SSE (StreamingResponse, text/event-stream). Events: sources (sofort, mit Passagen + Konfidenz + Begründung), token (pro LLM-Chunk), done / no_context / error. Next.js parst den SSE-Stream per ReadableStream — Quellen erscheinen vor dem Antwortaufbau.' },
    ],
    ariaStates: 'Workflow-Zustände',
    sectionStates: 'Interface-Zustände',
    headingStates: 'Workflow-Zustände',
    stateGroups: [
      {
        label: 'Upload',
        states: [
          { label: 'idle', description: 'Upload-Zone sichtbar. Keine Dokumente geladen. Alle 11 Zustände als TypeScript Discriminated Union getypt — kein undefinierter State möglich.' },
          { label: 'files_selected', description: 'PDFs ausgewählt. Client-seitige Validierung bestanden. Bereit zur Übertragung an Python/FastAPI.' },
        ],
      },
      {
        label: 'Indizierung',
        states: [
          { label: 'uploading', description: 'Vollständige RAG-Pipeline läuft in Python/FastAPI: Text-Extraktion → Chunking → Embedding-Generierung. Jeder Schritt ist sequenziell mit typisierten Ergebnissen — keine Blackbox.' },
          { label: 'ready', description: 'sqlite-vec-Vektorindex aufgebaut. Session aktiv. Frage-Eingabe aktiviert. Index bleibt 2 Stunden im Speicher.' },
        ],
      },
      {
        label: 'Frage',
        states: [
          { label: 'asking', description: 'Frage wird serverseitig eingebettet. k-NN-Vektorsuche läuft gegen den sqlite-vec-Session-Index.' },
          { label: 'streaming', description: 'SSE-Stream geöffnet. Quellen erscheinen sofort aus dem ersten Event. Antwort baut sich tokenweise auf. AbortController verfügbar für Abbruch mid-stream.' },
          { label: 'answer_ready', description: 'SSE-Stream abgeschlossen. Vollständige retrieval-beschränkte Antwort mit zitierten Passagen und Retrieval-Scores sichtbar.' },
          { label: 'no_context', description: 'Retrieval hat keine Passagen über dem Minimum-Score-Schwellenwert gefunden. Kein LLM-Aufruf. Klare Meldung angezeigt.' },
        ],
      },
      {
        label: 'Sicherheit',
        states: [
          { label: 'rate_limited', description: 'Rate Limit erreicht (SlowAPI, pro IP). Sichere Meldung, keine internen Details. Reset verfügbar.' },
          { label: 'upload_error', description: 'Datei von Python/FastAPI abgelehnt: falscher Typ, zu groß, zu viele Seiten oder kein extrahierbarer Text.' },
          { label: 'ask_error', description: 'Netzwerk- oder Python/FastAPI-Backend-Fehler. Sichere Nutzerfehlermeldung. Keine Stack-Traces oder internen Details an den Client.' },
        ],
      },
    ],
    ariaSafety: 'Guardrails und Betriebsgrenzen',
    sectionSafety: 'Guardrails & Grenzen',
    headingSafety: 'Guardrails der öffentlichen Demo',
    safetyIntro: 'Die öffentliche Demo erzwingt strikte Datei-, Session- und Rate-Limits, damit die RAG-Pipeline sicher testbar ist — ohne permanente Speicherung, unbegrenzte Embedding-Aufrufe oder Datenschutzverstöße. Guardrails und Rate Limits sind hier zwei verschiedene Dinge: Guardrails begrenzen, was die Pipeline strukturell überhaupt beantworten kann; Rate Limits begrenzen, wie oft sie aufgerufen werden darf.',
    techSafety: [
      { title: 'Guardrails', items: ['Keyword-Vorfilter blockiert offensichtlich unsichere Fragen vor jedem LLM-Aufruf — eine billige Heuristik, nicht die eigentliche Grenze', 'Antwortgenerierung erhält nur die abgerufenen Passagen als Dokumentkontext und wird angewiesen, sich darauf zu stützen — eine Grenze auf Prompt-Ebene, keine technisch erzwungene Garantie gegen unbelegte Inhalte', 'Alle Embeddings serverseitig in Python/FastAPI — OpenAI-Key erreicht nie den Browser', 'no_context-Zustand wenn Retrieval keinen Chunk über Schwellenwert findet — keine halluzinierte Antwort', 'Minimum-Score-Schwellenwert (0,1) verhindert, dass nicht relevante Chunks in den Antwortkontext gelangen', 'Serverseitig generierte UUID4-Session-IDs machen zufälligen Zugriff auf fremde Sessions unwahrscheinlich — diese öffentliche Demo hat keine Nutzerauthentifizierung, die Session-ID fungiert als Bearer-Identifier'] },
      { title: 'Dateilimits', items: ['Nur PDF — andere Dateitypen von Python/FastAPI abgelehnt vor jeder Verarbeitung', 'Max. 10 MB pro Datei — vor der Text-Extraktion durchgesetzt', 'Max. 25 MB gesamt pro Upload-Session', 'Max. 3 PDFs pro Session — Indexgröße bleibt vorhersehbar', 'Max. 80 Seiten pro PDF — verhindert übermäßige Verarbeitung', 'Nur-Bild-PDFs abgelehnt — leerer extrahierter Text löst klaren Fehler aus', 'Nur im Python/FastAPI-Arbeitsspeicher verarbeitet — keine Festplattenschreibvorgänge'] },
      { title: 'Rate Limits & Sessions', items: ['10 Upload-Jobs pro IP pro Stunde — SlowAPI in Python/FastAPI', '20 Fragen pro IP pro Stunde', 'Rate-Limit-Antworten geben sichere Meldungen ohne interne Details', 'Session-Daten nach 2 Stunden vollständig aus dem Serverspeicher gelöscht'] },
      { title: 'Datenschutz', items: ['Keine permanente Dateispeicherung — alle Session-Daten nur im Python/FastAPI-Arbeitsspeicher', 'Jede Dokumentensammlung liegt in einem eigenen sessionbezogenen In-Memory-Index — die Session-ID wird über mehrere Requests hinweg (Upload, Fragen, Streaming) verwendet und fungiert als Bearer-Identifier; diese Demo besitzt keine Nutzerauthentifizierung', 'Dokumenttext wird für Embeddings an OpenAI gesendet, abgerufene Passagen werden für die Antwortgenerierung erneut gesendet — nicht nur für Embeddings', 'API-Keys nur in Python/FastAPI — nie an den Browser gesendet oder geloggt', 'Kein Dokumenteninhalt in Server-Logs', 'SSE-Stream per AbortController sauber abbrechbar wenn Nutzer mid-stream zurücksetzt'] },
    ],
    ariaImpl: 'Technische Umsetzung',
    sectionImpl: 'Technische Umsetzung',
    headingImpl: 'Implementierungsdetails',
    implIntro: 'Die Fullstack-RAG-Anwendung trennt Verantwortlichkeiten klar: Next.js steuert Upload-UI, SSE-Streaming-Darstellung und Session-State. Python/FastAPI führt die vollständige RAG-Pipeline aus — Text-Extraktion, Chunking, Embeddings, Retrieval und SSE-Streaming-Antwortgenerierung.',
    techImpl: [
      { title: 'Frontend (Next.js)', items: ['11 explizite Workflow-Zustände als TypeScript Discriminated Union', 'ReadableStream SSE-Parser: Buffer-Split auf \\n\\n, innerer Split auf data:-Präfix', 'AbortController-Ref bricht laufende Streams bei Reset ohne Nebeneffekte ab', 'Quellen werden sofort aus dem ersten SSE-Event gerendert — bevor Antwortaufbau beginnt', 'ARIA-Live-Region kündigt Zustandswechsel für Screenreader an'] },
      { title: 'AI-Backend (Python/FastAPI)', items: ['pypdf extrahiert Text serverseitig — keine client-seitige PDF-Verarbeitung', 'SlowAPI setzt Rate Limits pro Route durch (10 Uploads/Stunde, 20 Fragen/Stunde)', 'Jede Session bekommt eine eigene In-Memory-SQLite-Datenbank mit geladener sqlite-vec-Extension', 'StreamingResponse mit media_type=text/event-stream für SSE-Antwortlieferung', 'Mock-Modus: Keyword-Pseudo-Embeddings + direktes Passagen-Return wenn OPENAI_API_KEY fehlt'] },
      { title: 'RAG Design', items: ['LLM-System-Prompt beschränkt Antwort explizit auf abgerufene Passagen — Source Grounding by instruction', 'Quellenangaben in der Antwort erforderlich ([1], [2] etc.) — per Prompt durchgesetzt', 'sqlite-vec vec0-Virtual-Table, Cosine-Distanz-Metrik: k-NN-Query für Top 5 Passagen, Minimum-Score 0,1', 'no_context-Pfad: SSE sendet no_context-Event wenn kein Chunk über Schwellenwert — kein halluzinierter LLM-Aufruf', 'Retrieval-Score im UI angezeigt — Nutzer kann Passagen-Relevanz selbst einschätzen'] },
      { title: 'Chunking', items: ['Satzbasierte Aufteilung — ~400 Zeichen pro Chunk, ~80 Zeichen Überlappung', 'Überlappung bewahrt Satzkontext über Chunk-Grenzen', 'Kurze Chunks (< 20 Zeichen) gefiltert, um Retrieval-Rauschen zu reduzieren', 'Chunk-Anzahl pro Session begrenzt, um Indexgröße vorhersehbar zu halten'] },
      { title: 'Embeddings', items: ['text-embedding-3-small Standard — über EMBEDDING_MODEL konfigurierbar', 'Mock-Modus: Keyword-Pseudo-Embeddings (64-dim, Zeichenstatistiken) — kein API-Aufruf', 'Alle Embedding-Aufrufe nur in Python/FastAPI — OPENAI_API_KEY erreicht nie den Browser', 'Embeddings per rowid in die vec0-Table eingefügt; Chunk-Text/Dateiname in einer parallelen Liste, per rowid beim Retrieval nachgeschlagen'] },
      { title: 'SSE Streaming', items: ['Python/FastAPI StreamingResponse mit media_type="text/event-stream"', 'Events: sources (sofort, mit Passagen + Konfidenz + Begründung), token (pro LLM-Chunk), done, no_context, error', 'Next.js ReadableStream-Decoder: Buffer-Rest zwischen Chunks erhalten', 'Streaming-Zustand: partial-Antwort-String per token-Event schrittweise aufgebaut', 'AbortController-Signal als signal ?? null übergeben (exactOptionalPropertyTypes-kompatibel)'] },
    ],
    ariaRepo: 'Repository-Dokumentation',
    sectionRepo: 'Repository',
    headingRepo: 'Repository-Nachweis',
    repoPara1: 'Die vollständige RAG-Implementierung liegt im Monorepo unter apps/ai (Python/FastAPI). Upload-Endpoint, Ask-Endpoint und SSE-Streaming-Endpoint sind als separate FastAPI-Routes implementiert. Der Session-Store ist eine In-Memory-SQLite-Datenbank pro Session mit der sqlite-vec-Extension für Vektorsuche, an der API-Grenze mit Pydantic-Modellen typisiert. Die Next.js-Zustandsmaschine nutzt TypeScript Discriminated Unions für alle 11 Workflow-Zustände.',
    repoPara2Before: 'Geteilte Zod-Schemas in',
    repoPara2After: 'definieren Upload- und Ask-Verträge auf TypeScript-Seite — für client-seitige Validierung und Frontend-Typsicherheit ohne Duplikation der Pydantic-Modelle.',
    repoPara3: 'Die Mock/Live-Mode-Trennung ist für lokale Entwicklung dokumentiert: Keyword-Pseudo-Embeddings ersetzen OpenAI-Aufrufe, Passagentext wird direkt zurückgegeben statt gestreamt, und das Mock-Flag wird in der UI-Antwort angezeigt. Der SSE-Streaming-Endpoint ist separat mit seiner Event-Sequenz und dem Abbruch-Vertrag dokumentiert.',
    repoEnvTitle: 'Wichtige Umgebungsvariablen',
    repoEnvItems: [
      ['OPENAI_API_KEY', 'Embeddings + SSE-Antwortgenerierung — nur Python/FastAPI'],
      ['EMBEDDING_MODEL', 'Optional — Standard: text-embedding-3-small'],
      ['AI_MODEL', 'Antwortgenerierungsmodell — Standard: gpt-4o-mini'],
      ['MAX_UPLOAD_MB', '10 — Dateigrößenlimit per Python/FastAPI'],
      ['MAX_TOTAL_UPLOAD_MB', '25 — Gesamt-Session-Upload-Limit'],
      ['MAX_PDFS', '3 — max. PDFs pro Session'],
    ],
    ariaNext: 'Nächste Iteration',
    sectionNext: 'Nächste Iteration',
    headingNext: 'Was als Nächstes käme',
    nextItems: [
      'Vector Database (Chroma oder pgvector) statt In-Memory — persistente Dokumentensammlungen über Sessions hinweg',
      'Hybrid Search — Kombination aus Embedding-Retrieval und BM25-Keyword-Matching für besseren Recall bei exakten Begriffen',
      'Reranking — Cross-Encoder-Reranker nach erstem Retrieval-Pass für verbesserte Passagen-Relevanz',
      'Evaluationsset — Frage/Antwort-Paare zur Qualitätsmessung über Chunking- und Embedding-Strategien',
      'Citation Highlighting — Quellpassagen in einem seitenbezogenen PDF-Viewer markieren',
      'Export — Antwort mit Quellenangaben als Markdown oder BibTeX exportieren',
      'DOCX- und Plain-Text-Upload-Unterstützung neben PDF',
      'Pytest für alle RAG-Pipeline-Schritte, Playwright für Upload- und Streaming-Flow',
    ],
  },
} as const;

export function Cs03Content() {
  const { lang } = useLang();
  const d = c[lang];
  const accent = 'var(--color-fg)';

  return (
    <main className="pt-32 pb-28 md:pb-40 px-8 md:px-16 lg:px-20">
      <div className="max-w-[1920px] mx-auto">

        <CaseStudyBackLink />

        {/* 1. Hero */}
        <section aria-label={d.ariaIntro}>
          <CaseStudyEyebrow number="03" accent={accent} />
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-fg tracking-tight leading-[1.02] mb-6">
            Agentic RAG Research Assistant
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
            <RagWorkflow />
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
                  <StateDoc key={s.label} label={s.label} description={s.description} />
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
                  packages/types/src/rag.ts
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
          previous={{ href: '/work/research-to-post-multi-agent-workflow', number: '02' }}
        />

      </div>
    </main>
  );
}
