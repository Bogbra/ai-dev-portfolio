# Agentic AI Engineering Portfolio

This is not a static portfolio. It is a deployed fullstack agentic AI application — three multi-step AI workflows and three interactive labs (voice, SEO strategy, and a real MCP protocol demo), backed by real APIs and running on Vercel and Railway.

The codebase itself is the work sample: a role-specialized LangGraph workflow with a conditional Critic-to-Revision pass, a RAG pipeline with SSE-streamed, retrieval-constrained answers with visible sources, a deterministic contract-and-structure evaluation harness (not a subjective "looks good" judgment), an MCP server exposing both read-only resources and a rate-limited live tool, guardrails (unsafe-input filtering, fail-closed validation, honeypot, no silent mock fallback), separated frontend/backend architecture, and Vitest, pytest, and Playwright/axe test suites in CI.

**[→ dana-schmitt.vercel.app](https://dana-schmitt.vercel.app)**

---

## What it demonstrates

| | |
|---|---|
| **Agentic workflows** | Role-specialized LangGraph workflow with a conditional Critic-to-Revision pass (Critic scores a draft, a score below 8 routes to Revision once — not a loop back through Critic), tool-use-based contact resolution (CS01), and retrieval-grounded generation (CS03 RAG) |
| **Evaluation** | A mechanical rubric (`apps/ai/evals/cs02_eval.py`), not subjective judgment — asserts the conditional-revision contract, groundedness status, and structural output checks against 6 fixed cases; wired into pytest/CI in mock mode |
| **MCP server** | A real [Model Context Protocol](https://modelcontextprotocol.io) server (`/mcp`) — portfolio data as read-only resources, the CS02 workflow as a rate-limited live tool, callable from any MCP client or directly from the browser (see the MCP Lab) |
| **Guardrails** | Unsafe-input filtering before any LLM call, fail-closed validation (a broken check blocks, not allows), honeypot + rate limits, and no silent fallback to mock output on a genuine provider error |
| **Production-minded frontend** | Next.js 15 App Router, React Server Components, TypeScript strict mode, Tailwind CSS v4, Motion animations, dark/light mode, WCAG AA accessibility |
| **Separated architecture** | Three independently deployable apps in one pnpm monorepo — Next.js (Vercel), Fastify API (Railway), FastAPI AI backend (Railway Docker) |
| **Security** | CSP with per-request nonce, Helmet, CORS, rate limiting, Zod/Pydantic validation on all inputs, no secrets in frontend code |
| **Tested** | Vitest (TypeScript schemas and Fastify routes) + pytest (Python AI backend, unit and integration) + Playwright/axe-core (e2e and WCAG AA checks, including a real browser round trip against the running MCP endpoint) — all wired into GitHub Actions CI; see CI for current pass/fail status |

---

## Stack

**Frontend**
- Next.js 15 App Router · React 19 · TypeScript strict mode
- Tailwind CSS v4 (CSS-first, design tokens via `@theme`)
- Motion (`motion/react`) · `next/font` (self-hosted Geist, Inter, IBM Plex Mono)

**Contact backend**
- Fastify · Zod · `@fastify/helmet` · `@fastify/cors` · `@fastify/rate-limit` · Resend

**AI backend**
- FastAPI · Python 3.12 · Pydantic v2 · SlowAPI
- LangGraph · OpenAI Python client · pypdf · Tavily · sqlite-vec

**Tooling**
- pnpm workspaces · Turborepo · GitHub Actions CI · Docker Compose

---

## AI Workflows

**CS01 — AI Operations Workflow Agent** (`/work/ai-operations-workflow-agent`)
Upload a CSV or XLSX contact list, describe what you need. The agent resolves the right contact using OpenAI tool-use and drafts a personalised email. XML-delimited context reduces prompt-injection risk.

**CS02 — Research-to-Post Multi-Agent Workflow** (`/work/research-to-post-multi-agent-workflow`)
Five-stage LangGraph workflow: Researcher → Writer → Critic → Revision → Groundedness Check. Optional Tavily web search for live context. Produces an editable LinkedIn post with full agent step transparency.

**CS03 — Agentic RAG Research Assistant** (`/work/research-rag-assistant`)
Drag-and-drop PDF upload → sentence-aware chunking → OpenAI embeddings → sqlite-vec vector search (k-NN, cosine distance) → **streaming SSE answer** with sources shown immediately. Sessions scoped in memory, expire after 2 hours.

**Voice Agent Lab**
Full voice pipeline in one request: microphone → Whisper STT → GPT intent classification → tool lookup → GPT response → TTS-1 audio. Shows transcript, intent, safety state, tool decision, and per-stage latency breakdown. English and German.

**AI SEO Strategy Lab**
Generates keyword clusters, search intent analysis, content ideas, and a 3-phase lead-gen roadmap from a business description. Optional live web context via Tavily. Scores are AI-assisted prioritization signals, not live search-volume or keyword-difficulty metrics.

**MCP Server & Protocol Lab** (`/mcp`, Labs section)
A real MCP server — portfolio case studies and stack exposed as read-only resources, `create_researched_post` exposed as a tool that runs the same CS02 workflow. The Lab sends real `tools/call` JSON-RPC requests directly from the browser and shows the raw request/response — see [Demo limits](#demo-limits--cost-stewardship) below for how live execution is bounded.

---

## Demo limits & cost stewardship

Every provider-billed workflow in this portfolio is deliberately bounded — public traffic must never turn into an open-ended cost or abuse surface:

- **Mock mode by default.** Every workflow (CS01–CS03, SEO Lab, MCP's `create_researched_post`) runs on deterministic, no-cost mock output unless a real provider key is configured. The Voice Agent Lab is the one exception — it has no mock mode and shows a clear disabled state instead.
- **Per-route rate limits** on every AI endpoint (see `apps/ai/README.md`'s Rate limits table) — 5–20 requests/hour/IP depending on the route's cost.
- **A separate, tighter live-call quota for the MCP tool** (`MCP_LIVE_CALL_LIMIT`, default 3 per IP within a rolling `MCP_LIVE_QUOTA_WINDOW_SECONDS` window, default 24h — not a calendar-day reset) — deliberately independent from the general MCP protocol rate limit, so cheap resource reads aren't bounded by the same budget as a real multi-step LLM workflow. Once exhausted, `create_researched_post` transparently falls through to the mock provider and reports that in its response — never silently.
- **No invented metrics.** SEO Lab scores are labelled as AI-assisted prioritization signals, not live search-volume/CPC data. Evaluation results are only claimed for what's actually reproduced in CI (mock mode) — see `apps/ai/README.md`'s Evaluation section.
- **Bounded agent steps.** CS02's Critic → Revision edge is a single conditional pass, not a retry loop — a low score produces one revision and moves on to Groundedness Check, it never routes back to Critic. No workflow in this portfolio has an open-ended or model-controlled iteration count.
- **Bounded uploads.** CS03 RAG accepts up to 3 PDFs per session, 10 MB each (`MAX_PDFS`, `MAX_UPLOAD_MB`); CS01's contact-list upload is capped at 100 rows.
- **In-memory only, nothing persisted.** RAG sessions (chunks + sqlite-vec index) live in process memory, capped at 40 concurrent sessions, and expire after 2 hours or on capacity eviction (oldest first) — no uploaded document, chunk, or embedding is ever written to disk or an external store.
- **Transparent mock mode.** Every response reports which mode actually produced it (`mockMode` / `execution.mode`) — a demo visitor or MCP client can always tell live output from mock output; nothing is presented as more "real" than it is.

These are demo-scale constraints, not architectural limits. A commercial deployment serving real traffic would add: shared session/rate-limit storage (Redis) so state survives restarts and works across multiple instances, a persistent vector store instead of in-memory sqlite-vec, object storage for uploads if persistence were required, and per-tenant quotas instead of per-IP ones.

---

## Production safeguards

- **CSP** — per-request nonce via Next.js Middleware (`script-src 'nonce-...' 'strict-dynamic'`)
- **Helmet** on Fastify; security headers on FastAPI
- **CORS** locked to explicit `ALLOWED_ORIGINS` on both backends — no wildcard in production
- **Rate limiting** — global + per-route limits on all AI endpoints
- **Spam protection** — server-side honeypot + rate limit on contact form; unsafe request blocking before any LLM call
- **Input validation** — Zod (Node) / Pydantic (Python) on every request body, unknown fields rejected
- **No secrets in frontend** — only `NEXT_PUBLIC_*` vars in browser code; all AI API calls go through the backend
- **No file storage** — uploaded PDFs processed in memory only, never written to disk

---

## Local setup

**Prerequisites:** Node ≥ 22, pnpm ≥ 9, Python 3.12, [uv](https://docs.astral.sh/uv/)

```bash
pnpm install

cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env
cp apps/ai/.env.example apps/ai/.env

pnpm dev
```

Each app only reads its own env file for this workspace setup — Turborepo
has no root-level `dotEnv` config, so `pnpm dev` never reads a root `.env`.
The root `.env.example` still serves two purposes: it documents every
variable across all three apps in one place, and (unlike here) it *is* what
Docker Compose reads — see [Docker](#docker) below.

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Contact API | http://localhost:3001 |
| AI backend | http://localhost:4000 |

All AI case studies and labs support mock/demo behavior when provider keys are not configured — no API key required to explore the UI.

---

## Docker

Run the full stack locally without installing Node, Python, or pnpm:

```bash
# Mock mode — no API keys required
docker compose up --build

# Live mode — add real keys
cp .env.example .env
# edit .env: add OPENAI_API_KEY and optionally TAVILY_API_KEY, RESEND_API_KEY
docker compose up --build
```

---

## Environment variables

Each app has a `.env.example`. The root `.env.example` documents everything in one place.

**`apps/web`**

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Contact backend URL |
| `NEXT_PUBLIC_AI_URL` | AI workflow backend URL |
| `NEXT_PUBLIC_SITE_URL` | Public site URL (used for OG metadata) |

**`apps/api`**

| Variable | Description |
|---|---|
| `ALLOWED_ORIGINS` | Comma-separated CORS origins |
| `RESEND_API_KEY` | Resend API key (optional — logs to console if absent) |
| `MAIL_FROM` | Sender email address |
| `MAIL_TO` | Recipient email address |
| `ENABLE_EMAIL_SENDING` | `true` to send real emails |

**`apps/ai`**

| Variable | Description |
|---|---|
| `ALLOWED_ORIGINS` | Comma-separated CORS origins |
| `OPENAI_API_KEY` | Enables live AI mode for all workflows (optional) |
| `OPENAI_BASE_URL` | OpenAI-compatible base URL (optional) |
| `AI_MODEL` | Chat model (default: `gpt-4o-mini`) |
| `EMBEDDING_MODEL` | Embedding model for CS03 (default: `text-embedding-3-small`) |
| `TAVILY_API_KEY` | Live web search context in CS01, CS02, SEO Lab (optional) |
| `VOICE_OPENAI_API_KEY` | Optional override key for Voice Lab. Falls back to `OPENAI_API_KEY` if absent. Required only when `OPENAI_API_KEY` points to a proxy without Whisper/TTS access. |

Real `.env*` files are gitignored. Only `.env.example` files are committed.

---

## Deployment

**Frontend — Vercel**

Connect the repository. Vercel reads `vercel.json` automatically.

Required environment variables: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_AI_URL`, `NEXT_PUBLIC_SITE_URL`

> The project's Vercel dashboard **Root Directory** is set to `apps/web`
> (confirmed by a live deploy failure when `outputDirectory` was briefly
> changed to `apps/web/.next` — Vercel resolved it relative to Root
> Directory and looked for `apps/web/apps/web/.next`, which obviously
> doesn't exist). With Root Directory set this way, `buildCommand` runs
> with `apps/web` as the working directory and `outputDirectory` resolves
> relative to that same folder — so `outputDirectory: ".next"` is correct
> as committed. If Root Directory were ever changed to the repo root
> instead, this file's `outputDirectory` would need to become
> `apps/web/.next` to match — don't change one without the other.

**Contact backend (`apps/api`) — Railway**

| Setting | Value |
|---|---|
| Builder | Railpack (auto-detected Node) |
| Build command | `turbo run build --filter=@ai/api` |
| Start command | `pnpm --filter @ai/api start` |

> Use `turbo run build` — not `pnpm --filter @ai/api build`. Turbo builds `packages/types` first; without it the server crashes with `ERR_MODULE_NOT_FOUND`.

**AI backend (`apps/ai`) — Railway**

| Setting | Value |
|---|---|
| Builder | **Dockerfile** |
| Dockerfile path | `apps/ai/Dockerfile` |

> Set builder to **Dockerfile**, not Railpack. Railway auto-detects Node from the monorepo root otherwise.

After deploying both backends, copy their public domains into Vercel's environment variables and redeploy.

---

## Architecture

```
.
├── apps/
│   ├── web/       Next.js 15 App Router — frontend (Vercel)
│   ├── api/       Fastify — contact form backend (Railway, Node)
│   └── ai/        FastAPI — all AI workflows and labs (Railway, Docker/Python)
├── packages/
│   ├── types/     Shared Zod schemas and TypeScript types
│   └── config/    Shared ESLint, Prettier, TypeScript configs
├── docker-compose.yml
├── turbo.json
└── pnpm-workspace.yaml
```

**Boundary rules:**
- Frontend calls `apps/api` for the contact form only
- Frontend calls `apps/ai` for all AI case study workflows
- No secrets in frontend code or `NEXT_PUBLIC_*` environment variables
- All AI API calls go through `apps/ai`
- Shared TypeScript contracts live in `packages/types`

---

## Scripts

```bash
pnpm dev        # Start all apps in watch mode
pnpm build      # Production build for all apps
pnpm lint       # ESLint + TypeScript check (web, api)
pnpm test       # Vitest — TypeScript schemas and Fastify routes
                # Python: cd apps/ai && uv run pytest
pnpm test:e2e   # Playwright + axe-core — smoke, WCAG AA checks, and a real
                # MCP Lab browser round trip. apps/web builds + serves itself;
                # apps/ai must already be running separately (e.g. `pnpm
                # --filter @ai/python-ai dev`) or the MCP Lab test fails —
                # CI starts it automatically, see .github/workflows/ci.yml
pnpm format     # Prettier across all files
```
