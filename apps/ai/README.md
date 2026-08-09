# AI Backend

Python 3.12 FastAPI service that powers all AI case study workflows and live AI labs in the portfolio. Runs independently on port 4000.

---

## Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/ai-workflow/parse` | CS01 — parse CSV/XLSX contact file |
| `POST` | `/ai-workflow/run` | CS01 — resolve contact + generate email draft |
| `POST` | `/multi-agent-post/run` | CS02 — run LangGraph multi-agent post workflow |
| `POST` | `/rag/upload` | CS03 — parse PDFs, chunk, embed, build session index |
| `POST` | `/rag/ask` | CS03 — retrieve passages + generate a retrieval-constrained answer with visible sources (non-streaming) |
| `POST` | `/rag/ask/stream` | CS03 — retrieve passages + stream answer via SSE (sources → tokens → done) |
| `GET` | `/voice/status` | Voice Lab — returns `{"available": true}` when a usable key is configured |
| `POST` | `/voice/agent` | Voice Lab — full voice pipeline (STT → intent → tool → LLM → TTS) |
| `POST` | `/seo-strategy/run` | SEO Lab — generate keyword clusters, content ideas, and lead-gen roadmap |
| `*` | `/mcp/` | MCP server — portfolio resources + the CS02 workflow as a tool (see [Live-first MCP Lab](#live-first-mcp-lab)) |

---

## Setup

**Prerequisites:** Python 3.12, [uv](https://docs.astral.sh/uv/)

```bash
# From the monorepo root
pnpm --filter @ai/python-ai dev

# Or directly
cd apps/ai
uv run uvicorn main:app --reload --port 4000
```

Copy `.env.example` to `.env` and fill in values before starting.

---

## Docker

The AI service is built as part of the full-stack Docker Compose setup at the monorepo root.
The build context is the repo root (required because the Dockerfile copies from `apps/ai/`).

```bash
# From the monorepo root
docker compose up --build ai
```

To run in isolation (build context must be the repo root):

```bash
# From the monorepo root
docker build -f apps/ai/Dockerfile -t ai-portfolio-ai .
docker run -p 4000:4000 \
  -e OPENAI_API_KEY=sk-... \
  -e VOICE_OPENAI_API_KEY=sk-... \
  ai-portfolio-ai
```

All AI workflows fall back to mock mode when `OPENAI_API_KEY` is not set.
The Voice Agent Lab shows a disabled state when no usable key is present.
The container does not write user data to disk — no volumes are required.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | Server port |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated CORS origins |
| `OPENAI_API_KEY` | — | Enables live AI mode for CS01, CS02, CS03, SEO Lab (optional — mock mode if absent) |
| `OPENAI_BASE_URL` | — | OpenAI-compatible base URL (optional) |
| `AI_MODEL` | `gpt-4o-mini` | Chat model |
| `EMBEDDING_MODEL` | `text-embedding-3-small` | Embedding model for CS03 |
| `TAVILY_API_KEY` | — | Enables live web search context in CS01, CS02, SEO Lab (optional) |
| `OPENAI_TIMEOUT_SECONDS` | `30` | Timeout for chat/embedding OpenAI calls |
| `OPENAI_VOICE_TIMEOUT_SECONDS` | `45` | Timeout for Voice Lab's Whisper/TTS calls (longer than a chat completion) |
| `OPENAI_MAX_RETRIES` | `1` | Max SDK-level retries on any OpenAI call |
| `VOICE_OPENAI_API_KEY` | — | Real OpenAI key for Voice Lab (Whisper + TTS) — required if `OPENAI_BASE_URL` points to a proxy |
| `VOICE_TTS_VOICE` | `alloy` | TTS voice — alloy, echo, fable, onyx, nova, shimmer |
| `VOICE_MAX_REQUESTS_PER_HOUR` | `20` | Per-IP hourly rate limit for `/voice/agent` |
| `VOICE_MAX_REQUESTS_PER_DAY` | `50` | Per-IP daily rate limit for `/voice/agent` |
| `MAX_UPLOAD_SIZE_BYTES` | `1048576` | CS01 max CSV/XLSX upload size (bytes) |
| `MAX_UPLOAD_ROWS` | `100` | CS01 max contact rows per upload |
| `MAX_REQUEST_LENGTH` | `500` | CS01 max characters in the free-text request |
| `MAX_TOPIC_LENGTH` | `300` | CS02 max characters in the topic input |
| `MAX_UPLOAD_MB` | `10` | CS03 max PDF size per file |
| `MAX_TOTAL_UPLOAD_MB` | `25` | CS03 max total upload size per session |
| `MAX_PDFS` | `3` | CS03 max PDFs per session |
| `MAX_CHUNKS` | `500` | CS03 max text chunks indexed per session |
| `MAX_QUESTIONS_PER_HOUR` | `20` | Per-IP hourly rate limit for `/rag/ask` |
| `SEO_MAX_REQUESTS_PER_HOUR` | `10` | Per-IP hourly rate limit for `/seo-strategy/run` |
| `SEO_MAX_REQUESTS_PER_DAY` | `30` | Per-IP daily rate limit for `/seo-strategy/run` |
| `MCP_ALLOWED_HOSTS` | `localhost:4000,127.0.0.1:4000` | Hostnames the MCP transport's DNS-rebinding protection accepts — add the deployed hostname in production |
| `MCP_LIVE_DEMO_ENABLED` | `true` | Master switch for live provider calls from `create_researched_post` — `false` forces mock mode always |
| `MCP_LIVE_CALL_LIMIT` | `3` | Live `create_researched_post` executions allowed per client IP per window |
| `MCP_LIVE_QUOTA_WINDOW_SECONDS` | `86400` | Live-quota rolling window, in seconds (default: 24h) |

---

## Structure

```
apps/ai/
├── main.py                      FastAPI app, CORS, body-size limit, rate limiting, session cleanup lifespan
├── settings.py                  Pydantic BaseSettings — reads all env vars
├── client_ip.py                 Shared slowapi key_func — resolves the real peer behind Railway's proxy
├── openai_client.py             Shared AsyncOpenAI factory — timeout/retry policy in one place
├── mcp_server.py                MCP server (resources + create_researched_post/get_demo_status tools), mounted at /mcp
├── mcp_data.py                  Read-only case-study/stack data backing the MCP resources
├── mcp_live_quota.py            Per-IP live-call quota for create_researched_post (see "Live-first MCP Lab" below)
├── conftest.py                  pytest root — makes apps/ai importable during test runs
├── routes/
│   ├── health.py                GET /health
│   ├── cs01_workflow.py         CS01 — AI Operations Workflow Agent
│   ├── cs02_post.py             CS02 — Multi-Agent LinkedIn Post (LangGraph) — also exports run_cs02_workflow, shared with the MCP tool
│   ├── cs03_rag.py              CS03 — RAG Research Assistant
│   ├── voice.py                 Voice Agent Lab (Whisper STT → GPT → TTS)
│   └── seo.py                   AI SEO Strategy Lab
├── schemas/
│   ├── cs01.py                  Pydantic models for CS01
│   ├── cs02.py                  Pydantic models for CS02 (also shared PostTone/PostGoal + CreatePostToolInput for the MCP tool)
│   ├── cs03.py                  Pydantic models for CS03
│   ├── voice.py                 Pydantic models for Voice Lab
│   ├── seo.py                   Pydantic models for SEO Lab
│   └── mcp.py                   Pydantic models for MCP tool responses (ExecutionInfo, CreateResearchedPostResponse, ...)
├── evals/
│   └── cs02_eval.py             CS02 evaluation harness — see "Evaluation" below
└── tests/
    ├── test_chunking.py             Unit tests — _chunk_text
    ├── test_similarity.py           Unit tests — sqlite-vec retrieval (_build_vector_index, _retrieve)
    ├── test_contacts.py             Unit tests — _normalise_contacts
    ├── test_schemas.py              Unit tests — Pydantic schema validation
    ├── test_client_ip.py            Unit tests — client_ip.get_client_ip spoofed-XFF resolution
    ├── test_openai_client.py        Unit tests — openai_client.make_openai_client timeout/retry config
    ├── test_rag_sessions.py         Unit tests — RAG session storage (sqlite-vec index, session eviction)
    ├── test_concurrency.py          Regression tests — parsing runs off the event loop (asyncio.to_thread)
    ├── test_voice_error_handling.py Regression tests — upstream error text never reaches the client
    ├── test_cs02_eval.py            Wires evals/cs02_eval.py into pytest (mock mode) + rubric regression tests
    ├── test_mcp_server.py           Integration tests — MCP resources, create_researched_post quota/fallback/error behavior, rate limit
    └── test_routes.py               Integration tests — FastAPI TestClient (health, parse, honeypot, RAG, body limit)
```

---

## Evaluation

`evals/cs02_eval.py` is a small evaluation harness for CS02 (Research-to-Post
Multi-Agent Workflow). It runs a fixed set of 6 topics through the actual
workflow function — live if `OPENAI_API_KEY` is configured, mock otherwise,
the same branch `/multi-agent-post/run` itself uses — and scores each result
against concrete checks, not a subjective "does this look good" judgment:

- **Conditional-revision contract**: the Critic node's score determines whether
  the Reviser node should have run. A score below 8 must produce
  `revisionNotes`; a score of 8+ must skip revision entirely. This is the
  property actually guaranteed by the LangGraph conditional edge — the
  Critic's raw score itself is the *pre-revision* draft's score, so
  asserting "score ≥ 7" directly would fail on drafts the workflow already
  fixed.
- Groundedness status is not `unsupported`.
- Structural checks on the generated post: non-empty hook, 1-4 hashtags,
  length within the 3000-char contract, and at least one topic keyword
  present (catches generic, off-topic drafts).

Run directly for a human-readable report:

```bash
uv run python -m evals.cs02_eval
```

`tests/test_cs02_eval.py` runs the same harness in mock mode as part of the
regular suite (deterministic, no API cost) and separately unit-tests the
rubric itself against deliberately broken results, proving it actually
rejects failures rather than only confirming the happy path.

This fixed 6-case suite runs deterministically in mock mode in CI on every
push (`tests/test_cs02_eval.py`, part of the standard `uv run pytest` run)
and can also be run manually against the live model
(`uv run python -m evals.cs02_eval` with `OPENAI_API_KEY` set) — that path
isn't part of CI, since a real model call on every push would be a
recurring, non-deterministic cost for no signal beyond what the mock-mode
contract tests already check mechanically.

---

## Mock vs. live mode

When `OPENAI_API_KEY` is not set, every workflow falls back to mock mode automatically:

- **CS01** — keyword-based contact matching, prefixed demo draft
- **CS02** — deterministic LangGraph-shaped mock output with realistic agent step data
- **CS03** — 64-dim keyword pseudo-embeddings, passage-direct mock answers
- **SEO Lab** — static mock keyword clusters and roadmap

The Voice Agent Lab has no mock mode. It requires a real OpenAI key with Whisper and TTS access. When no usable key is present, the lab shows a clear disabled state.

No external API calls are made in mock mode. The mode is labelled in all API responses (`mockMode: true`).

---

## Live-first MCP Lab

The portfolio exposes its architecture as a real [MCP](https://modelcontextprotocol.io) server, mounted at `/mcp` via Streamable HTTP (stateless, JSON responses). Point any MCP client — Claude Desktop, Claude Code, or the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) (`npx @modelcontextprotocol/inspector`) — at `<NEXT_PUBLIC_AI_URL>/mcp/` to use it.

Two different MCP primitives are used deliberately, not tools for everything:

- **Static portfolio data is exposed as resources**, not tools — `portfolio://case-studies`, `portfolio://case-studies/{id}`, `portfolio://stack`. Resources are the right primitive for "data a client reads"; a tool implies an action or a side effect, which a case-study lookup has neither of. An unknown `{id}` returns a real MCP protocol error, not a 200 response with an embedded `"error"` field.
- **The CS02 research-to-post workflow is a tool**, `create_researched_post` — it's a genuine multi-step action with real (provider-billed) side effects. It reuses the exact same `run_cs02_workflow(...)` function `/multi-agent-post/run` calls; the MCP layer doesn't reimplement the LangGraph workflow.

Public callers get a small number of real, provider-backed executions per client IP (`MCP_LIVE_CALL_LIMIT`, default 3) within a rolling `MCP_LIVE_QUOTA_WINDOW_SECONDS` window (default 86400s / 24h — the window slides from each call, it does not reset at a fixed calendar-day boundary). After that live quota is exhausted, the same tool continues through the deterministic mock provider — the same one `/multi-agent-post/run` falls back to when no `OPENAI_API_KEY` is configured. Every response explicitly reports its mode, remaining quota, and fallback reason under `execution`:

```json
{
  "execution": {
    "mode": "live",
    "remainingLiveCalls": 2,
    "liveCallLimit": 3,
    "fallbackReason": null,
    "durationMs": 842
  },
  "result": { "post": "...", "sources": [], "groundedness": "grounded", "criticScore": 9, "revised": false }
}
```

`fallbackReason` is `"live_quota_exhausted"` or `"live_mode_disabled"` when `mode` is `"mock"` for either of those reasons — never silently. Invalid input and requests blocked by the same unsafe-topic filter the HTTP route uses never consume a live slot. A genuine live-provider failure (timeout, malformed response, an OpenAI/Tavily outage) is returned as a real MCP tool error — it is never silently replaced by a mock result reported as a success, which would hide a real outage behind an apparently-working demo.

`get_demo_status` reports the current quota for the calling IP without consuming it, so a client can check before deciding whether to call `create_researched_post`.

The quota is in-memory per process: it resets on restart and is not shared across replicas or with the general `/mcp` protocol rate limit (30 requests/min/IP, covers all traffic including cheap resource reads — see `_McpRateLimitMiddleware` in `mcp_server.py`). That's a deliberate, documented trade-off for a single-instance portfolio demo, not an oversight — a real multi-instance deployment would back the quota with a shared store instead.

---

## Rate limits

| Endpoint | Limit |
|---|---|
| `/ai-workflow/run` | 5 / IP / hour |
| `/multi-agent-post/run` | 5 / IP / hour |
| `/rag/upload` | 10 / IP / hour |
| `/rag/ask` | 20 / IP / hour |
| `/rag/ask/stream` | 20 / IP / hour |
| `/voice/agent` | 20 / IP / hour, 50 / IP / day |
| `/seo-strategy/run` | 10 / IP / hour, 30 / IP / day |

---

## Dependencies

Managed with [uv](https://docs.astral.sh/uv/). Key packages:

- `fastapi`, `uvicorn` — web framework and ASGI server
- `pydantic`, `pydantic-settings` — validation and settings
- `slowapi` — rate limiting
- `openai` — OpenAI API client (all workflows and labs)
- `langgraph` — multi-agent workflow graph (CS02)
- `pypdf` — PDF text extraction (CS03)
- `sqlite-vec` — in-memory vector index (vec0, k-NN, cosine distance) for CS03 retrieval
- `httpx` — Tavily REST API calls (CS01, CS02, SEO Lab)
- `openpyxl` — XLSX parsing (CS01)
