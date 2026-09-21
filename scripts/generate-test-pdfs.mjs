#!/usr/bin/env node
// Generates two sample PDFs for the RAG Research Assistant demo.
// Run: node scripts/generate-test-pdfs.mjs
// Output: apps/web/public/samples/

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../apps/web/public/samples');

mkdirSync(OUT_DIR, { recursive: true });

// ── Minimal PDF builder ─────────────────────────────────────────────────────

function buildPdf(pageLines) {
  const encoder = new TextEncoder();

  // Each page line: string (wraps at ~85 chars, ~36 lines per page)
  const LINES_PER_PAGE = 36;
  const pages = [];
  for (let i = 0; i < pageLines.length; i += LINES_PER_PAGE) {
    pages.push(pageLines.slice(i, i + LINES_PER_PAGE));
  }

  const parts = [];
  let offset = 0;
  const offsets = {};

  function push(str) {
    const buf = Buffer.from(str, 'latin1');
    parts.push(buf);
    offset += buf.length;
  }

  // Header
  push('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');

  let objIdx = 1;

  // Build page content streams first so we know lengths
  const contentObjIds = [];
  const pageObjIds = [];

  const contentStrings = pages.map((lines) => {
    const rows = lines.map((line, i) => {
      // Escape parentheses and backslash in PDF string syntax
      const safe = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
      const y = 760 - i * 18;
      return `BT /F1 10 Tf 50 ${y} Td (${safe}) Tj ET`;
    });
    return rows.join('\n') + '\n';
  });

  // Object 1: Catalog (placeholder — we'll know the pages obj id later)
  const catalogId = objIdx++;
  const pagesId = objIdx++;

  // Reserve page obj ids
  for (let p = 0; p < pages.length; p++) {
    pageObjIds.push(objIdx++);
  }

  // Reserve content stream obj ids
  for (let p = 0; p < pages.length; p++) {
    contentObjIds.push(objIdx++);
  }

  // Font obj
  const fontId = objIdx++;

  // Now emit all objects
  offsets[catalogId] = offset;
  push(`${catalogId} 0 obj\n<</Type /Catalog /Pages ${pagesId} 0 R>>\nendobj\n`);

  offsets[pagesId] = offset;
  const kids = pageObjIds.map((id) => `${id} 0 R`).join(' ');
  push(`${pagesId} 0 obj\n<</Type /Pages /Kids [${kids}] /Count ${pages.length}>>\nendobj\n`);

  for (let p = 0; p < pages.length; p++) {
    offsets[pageObjIds[p]] = offset;
    push(
      `${pageObjIds[p]} 0 obj\n` +
      `<</Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842]\n` +
      `/Resources <</Font <</F1 ${fontId} 0 R>>>>\n` +
      `/Contents ${contentObjIds[p]} 0 R>>\n` +
      `endobj\n`,
    );
  }

  for (let p = 0; p < pages.length; p++) {
    const stream = contentStrings[p];
    const streamLen = Buffer.byteLength(stream, 'latin1');
    offsets[contentObjIds[p]] = offset;
    push(
      `${contentObjIds[p]} 0 obj\n<</Length ${streamLen}>>\nstream\n${stream}endstream\nendobj\n`,
    );
  }

  offsets[fontId] = offset;
  push(`${fontId} 0 obj\n<</Type /Font /Subtype /Type1 /BaseFont /Courier>>\nendobj\n`);

  // xref
  const xrefOffset = offset;
  const totalObjs = objIdx; // 0..objIdx-1
  push(`xref\n0 ${totalObjs}\n`);
  push(`0000000000 65535 f \n`);
  for (let i = 1; i < totalObjs; i++) {
    const off = offsets[i] ?? 0;
    push(`${String(off).padStart(10, '0')} 00000 n \n`);
  }

  push(`trailer\n<</Size ${totalObjs} /Root ${catalogId} 0 R>>\n`);
  push(`startxref\n${xrefOffset}\n%%EOF\n`);

  return Buffer.concat(parts);
}

// ── Document 1: Design Systems ──────────────────────────────────────────────

const doc1Lines = [
  'DESIGN SYSTEMS — AN OVERVIEW',
  '===========================',
  '',
  'What is a design system?',
  '------------------------',
  'A design system is a collection of reusable components, guided by clear',
  'standards, that can be assembled together to build any number of applications.',
  'It bridges the gap between design and engineering by providing a single source',
  'of truth for visual and interaction patterns.',
  '',
  'Core layers of a design system',
  '------------------------------',
  '1. Design tokens',
  '   The smallest units of the design language: color, spacing, typography,',
  '   motion duration, and radius values expressed as named variables.',
  '   Tokens make the system themeable and consistent across surfaces.',
  '',
  '2. Component library',
  '   Reusable UI elements built on top of tokens: buttons, inputs, cards,',
  '   modals, navigation. Each component ships with documented variants,',
  '   states (default, hover, focus, disabled, error), and accessibility',
  '   requirements.',
  '',
  '3. Pattern library',
  '   Combinations of components that solve common UX problems: form layouts,',
  '   data tables, onboarding flows, empty states, error pages.',
  '',
  '4. Documentation and guidelines',
  '   Usage rules, accessibility notes, copywriting guidelines, and',
  '   implementation examples that help teams use the system correctly.',
  '',
  'Benefits of a design system',
  '---------------------------',
  'Consistency: users experience a coherent visual and interaction language',
  'across all products.',
  '',
  'Speed: teams build new features faster by composing existing components',
  'rather than rebuilding patterns from scratch.',
  '',
  'Quality: shared components are tested, accessible, and reviewed once,',
  'then reused everywhere.',
  '',
  'Collaboration: designers and engineers share vocabulary, reducing',
  'miscommunication and back-and-forth.',
  '',
  'Scalability: a system grows with the product and the team without',
  'accumulating inconsistency debt.',
  '',
  'Design tokens in depth',
  '----------------------',
  'Tokens are typically organized in three tiers:',
  '',
  '  Global tokens: raw values. Example: --color-blue-500: #3B82F6',
  '  Semantic tokens: role-based aliases. Example: --color-action: var(--color-blue-500)',
  '  Component tokens: component-specific. Example: --button-bg: var(--color-action)',
  '',
  'This structure allows a complete theme change (e.g. dark mode, brand',
  'switch) by overriding only the semantic and global layers.',
  '',
  'Typography in a design system',
  '-----------------------------',
  'A typography scale defines:',
  '  - Font families (display, body, mono)',
  '  - Size scale (typically 8–10 steps, often based on a modular scale)',
  '  - Line height per size',
  '  - Letter spacing per size',
  '  - Font weight usage rules',
  '',
  'Good typography systems distinguish between editorial type (display, hero)',
  'and UI type (labels, captions, body).',
  '',
  'Motion in a design system',
  '-------------------------',
  'Motion guidelines specify:',
  '  - Easing curves per use case (enter, exit, in-place)',
  '  - Duration ranges (micro: 100ms, standard: 200ms, narrative: 400ms+)',
  '  - Which properties to animate (prefer transform and opacity)',
  '  - Reduced-motion fallback rules',
  '',
  'Accessibility requirements',
  '--------------------------',
  'Every component in a design system must document:',
  '  - Keyboard interaction pattern (Tab, Enter, Space, Escape, Arrow keys)',
  '  - Required ARIA roles and attributes',
  '  - Minimum contrast ratio (WCAG AA: 4.5:1 for normal text)',
  '  - Focus indicator style',
  '  - Screen reader announcement behavior',
  '',
  'Design system governance',
  '------------------------',
  'A successful system needs clear ownership:',
  '  - A core team (or designated maintainers) reviews contributions',
  '  - A versioning strategy (semantic versioning is common)',
  '  - A deprecation policy for removing old patterns',
  '  - A feedback channel for product teams using the system',
  '',
  'Common pitfalls',
  '---------------',
  '  - Too abstract: tokens so generic they require guesswork to use',
  '  - Too prescriptive: components so rigid they cannot cover real use cases',
  '  - Unmaintained docs: guidelines diverge from implementation over time',
  '  - No adoption strategy: teams build around the system instead of with it',
  '',
  'Summary',
  '-------',
  'A design system is not a project with a finish line — it is a product',
  'for product teams. The best systems are maintained, documented, and',
  'evolve together with the products they serve.',
];

// ── Document 2: AI Workflow Patterns ────────────────────────────────────────

const doc2Lines = [
  'AI WORKFLOW PATTERNS FOR PRODUCT TEAMS',
  '======================================',
  '',
  'Introduction',
  '------------',
  'Modern product teams are integrating large language models (LLMs) into',
  'workflows that were previously manual, expensive, or slow. This document',
  'outlines common patterns, their trade-offs, and implementation considerations.',
  '',
  'Pattern 1 — Single prompt (zero-shot)',
  '-------------------------------------',
  'The simplest pattern: one user input, one LLM call, one output.',
  '',
  'Use cases:',
  '  - Text summarisation',
  '  - Translation',
  '  - Classification',
  '  - Simple Q&A with known context',
  '',
  'Trade-offs:',
  '  Pro: low latency, simple to implement, easy to test.',
  '  Con: limited reasoning depth, brittle for complex or multi-step tasks.',
  '',
  'Pattern 2 — Chain-of-thought prompting',
  '---------------------------------------',
  'The model is instructed to reason step by step before producing its',
  'final answer. This improves accuracy on tasks requiring multi-step logic.',
  '',
  'Implementation note:',
  '  Add "Think step by step" or a structured reasoning prefix to the prompt.',
  '  For structured outputs, separate the reasoning trace from the final',
  '  answer using XML delimiters or JSON schema.',
  '',
  'Pattern 3 — Tool use / function calling',
  '----------------------------------------',
  'The model is given a set of available tools (functions with JSON schemas).',
  'It decides which tool to call, with which arguments, and the system',
  'executes the tool and returns the result for the model to continue.',
  '',
  'Use cases:',
  '  - Reading from external APIs',
  '  - Running calculations',
  '  - Writing to databases',
  '  - File operations',
  '',
  'Safety consideration: validate all model-generated tool arguments before',
  'execution. Never trust the model as the sole gatekeeper.',
  '',
  'Pattern 4 — Retrieval-Augmented Generation (RAG)',
  '-------------------------------------------------',
  'Instead of relying on the model\'s training data, RAG retrieves relevant',
  'passages from a document store and injects them into the prompt as context.',
  '',
  'Pipeline steps:',
  '  1. Document ingestion: chunk, embed, and store documents in a vector index.',
  '  2. Query: embed the user question, run similarity search.',
  '  3. Retrieval: fetch top-k passages by cosine similarity score.',
  '  4. Augmentation: inject passages into the prompt as grounding context.',
  '  5. Generation: model answers based on retrieved context.',
  '',
  'Key metrics:',
  '  - Retrieval recall: are the relevant passages being found?',
  '  - Answer groundedness: does the answer only use retrieved context?',
  '  - Latency: embedding + retrieval adds overhead before the LLM call.',
  '',
  'Pattern 5 — Multi-agent workflows',
  '----------------------------------',
  'Multiple specialised agents handle different parts of a task and pass',
  'results between each other. A supervisor or orchestrator coordinates flow.',
  '',
  'Example pipeline (content production):',
  '  Researcher -> Writer -> Critic -> Revision -> Groundedness check',
  '',
  'Frameworks:',
  '  LangGraph: graph-based stateful agent orchestration',
  '  CrewAI: role-based agent teams',
  '  Custom: task queue with function-calling LLMs at each node',
  '',
  'Trade-offs:',
  '  Pro: each agent can be specialised and independently tested.',
  '  Con: higher latency, harder to debug, failure modes compound.',
  '',
  'Pattern 6 — Human-in-the-loop',
  '------------------------------',
  'AI generates candidate outputs; a human reviews, edits, and approves',
  'before the output is used or sent downstream.',
  '',
  'This pattern is critical for:',
  '  - High-stakes decisions (legal, medical, financial)',
  '  - Brand-sensitive outputs (marketing, customer communication)',
  '  - Tasks where AI error rate is too high for full automation',
  '',
  'UX requirements:',
  '  - Make AI-generated content clearly distinguishable from human content',
  '  - Provide editable outputs, not read-only results',
  '  - Show confidence signals and source attribution where possible',
  '  - Enable fast rejection with one click',
  '',
  'Security and safety considerations',
  '-----------------------------------',
  'Prompt injection: user-controlled content may contain instructions that',
  'attempt to override the system prompt. Mitigate by:',
  '  - Separating trusted instructions from untrusted user content with',
  '    clear delimiters (XML tags, role-based messages)',
  '  - Validating model outputs before acting on them',
  '  - Never executing model-generated code without sandboxing',
  '',
  'Data privacy: never send PII to external APIs without consent and',
  'appropriate data processing agreements.',
  '',
  'Rate limiting: LLM APIs have token and request limits. Build retry logic,',
  'back-off strategies, and per-user quotas into your system.',
  '',
  'Evaluation',
  '----------',
  'AI workflows are hard to test with conventional unit tests. Evaluation',
  'approaches include:',
  '  - Golden set: curated input/output pairs reviewed by humans',
  '  - LLM-as-judge: a second model scores outputs against criteria',
  '  - User feedback: thumbs up/down, edit rate, task completion rate',
  '  - Regression suite: run on every model or prompt change',
  '',
  'Summary',
  '-------',
  'The right AI workflow pattern depends on task complexity, latency budget,',
  'accuracy requirements, and safety constraints. Start with the simplest',
  'pattern that works, measure its failure modes, and upgrade complexity',
  'only when the simpler approach is proven insufficient.',
];

writeFileSync(join(OUT_DIR, 'sample-design-system.pdf'), buildPdf(doc1Lines));
writeFileSync(join(OUT_DIR, 'sample-ai-workflow-patterns.pdf'), buildPdf(doc2Lines));

console.log('Generated:');
console.log('  apps/web/public/samples/sample-design-system.pdf');
console.log('  apps/web/public/samples/sample-ai-workflow-patterns.pdf');
