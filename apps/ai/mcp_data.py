"""
Read-only data backing the MCP tools in mcp_server.py.

Kept as a small Python-native source of truth here rather than importing
the frontend's TypeScript case-study copy (apps/web/app/work/*/Cs0*Content.tsx)
— the two are meant to describe the same three case studies, but an MCP
tool result and long-form marketing copy have different audiences and
don't need to be byte-identical.
"""

from __future__ import annotations

CASE_STUDIES: list[dict[str, object]] = [
    {
        "id": "cs01",
        "title": "AI Operations Workflow Agent",
        "angle": "Upload a contact list, describe what you need, and the agent resolves the right contact and drafts a personalised email.",
        "problem": "Manually matching a request to the right contact and writing a personalised email from a CSV/XLSX list is repetitive and error-prone at any real volume.",
        "decision": "OpenAI tool-use resolves the contact against the uploaded list (never inventing one) and drafts a typed, structured email. Contact data is explicitly delimited and treated as untrusted input to reduce prompt-injection risk.",
        "result": "A working agent with mock/live mode, server-side rate limiting, and no automatic sending — approved drafts can only be copied, never auto-sent, in the public demo.",
        "stack": ["Next.js", "TypeScript", "Python", "FastAPI", "OpenAI tool-use", "Pydantic"],
    },
    {
        "id": "cs02",
        "title": "Research-to-Post Multi-Agent Workflow",
        "angle": "A five-stage LangGraph workflow — Researcher, Writer, Critic, Revision, Groundedness Check — turns a topic into a LinkedIn post with a transparent groundedness report, not a guaranteed-grounded one.",
        "problem": "A single LLM call asked to research, write, and fact-check a post in one shot tends to blend those steps together, making the result hard to inspect or trust.",
        "decision": "Each responsibility is a separate LangGraph node with a typed output. The Critic scores the draft 1-10 against a rubric; a score below 8 routes to a Revision node automatically. Groundedness Check runs last and flags claims as grounded, needing caution, or unsupported.",
        "result": "An evaluation harness (evals/cs02_eval.py) asserts the conditional-revision contract mechanically — score below 8 must produce revision notes, 8+ must skip revision — rather than judging output quality subjectively. Runs deterministically in mock mode in CI on every push, and can also be run manually against the live model.",
        "stack": ["Next.js", "TypeScript", "Python", "FastAPI", "LangGraph", "OpenAI", "Tavily"],
    },
    {
        "id": "cs03",
        "title": "RAG Research Assistant",
        "angle": "Drag-and-drop PDF upload, sentence-aware chunking, OpenAI embeddings, and sqlite-vec vector search, with a streaming SSE answer and sources shown immediately.",
        "problem": "LLM answers without retrieval context hallucinate confidently, and with long PDFs there is no way to see which passage an answer actually came from.",
        "decision": "Each session gets its own in-memory SQLite database with the sqlite-vec extension loaded, using a vec0 virtual table (cosine distance) for k-NN search — the same query shape a Postgres/pgvector or Chroma-backed pipeline would use, without an external service. The system prompt constrains answers to retrieved passages only.",
        "result": "A no_context state is returned (no LLM call made) when nothing relevant is found above the similarity threshold, so the assistant states uncertainty instead of inventing an answer. Sessions are in-memory only and expire after two hours.",
        "stack": [
            "Next.js",
            "TypeScript",
            "Python",
            "FastAPI",
            "sqlite-vec",
            "OpenAI Embeddings",
            "SSE",
        ],
    },
]

STACK: list[dict[str, object]] = [
    {"stage": "Frontend", "tools": ["Next.js", "React", "TypeScript", "Tailwind CSS", "Motion"]},
    {
        "stage": "AI Backend",
        "tools": ["Python", "FastAPI", "OpenAI API", "Pydantic", "LangGraph", "sqlite-vec"],
    },
    {"stage": "API", "tools": ["Fastify", "Zod", "Rate Limits", "CORS", "Security Headers"]},
    {
        "stage": "Deploy",
        "tools": ["Docker", "Railway", "Vercel", "GitHub Actions", "Mock/Live Mode"],
    },
    {
        "stage": "AI Workflows",
        "tools": ["RAG", "Embeddings", "Retrieval", "Structured Outputs", "SSE Streaming", "MCP"],
    },
]
