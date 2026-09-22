"""BodySizeLimitMiddleware used to share one 40 MB cap across every route —
the body is fully buffered before any route handler (let alone its slowapi
rate limit) ever sees it, so that let an attacker send many large-but-
under-40MB bodies at routes that never legitimately need more than a few
KB (SEO, CS02, RAG ask, MCP). Caps are now per-path (main.py's
_max_body_bytes_for_path). These confirm the lookup table itself and that
it's actually wired into the real app.
"""

from __future__ import annotations

from main import (
    _CS01_UPLOAD_MAX_BYTES,
    _DEFAULT_MAX_BYTES,
    _RAG_UPLOAD_MAX_BYTES,
    _VOICE_MAX_BYTES,
    _max_body_bytes_for_path,
)

# `client` fixture is session-scoped in conftest.py, shared across every
# test file — see the comment there for why.


def test_lookup_table_matches_each_configured_path():
    assert _max_body_bytes_for_path("/rag/upload") == _RAG_UPLOAD_MAX_BYTES
    assert _max_body_bytes_for_path("/voice/agent") == _VOICE_MAX_BYTES
    assert _max_body_bytes_for_path("/ai-workflow/parse") == _CS01_UPLOAD_MAX_BYTES


def test_lookup_table_falls_back_to_default_for_everything_else():
    for path in [
        "/seo-strategy/run",
        "/ai-workflow/run",
        "/multi-agent-post/run",
        "/rag/ask",
        "/mcp/",
        "/health",
        "/unknown",
    ]:
        assert _max_body_bytes_for_path(path) == _DEFAULT_MAX_BYTES


def test_small_cap_route_rejects_a_body_the_old_global_40mb_cap_would_have_allowed(client):
    oversized = b"x" * (_DEFAULT_MAX_BYTES + 1)
    r = client.post(
        "/seo-strategy/run",
        content=oversized,
        headers={"Content-Type": "application/json"},
    )
    assert r.status_code == 413


def test_rag_upload_keeps_its_higher_cap_for_the_same_body_size(client):
    # Same body size that 413'd on the small-cap route above must not be
    # rejected by the size middleware on /rag/upload — it may still fail
    # downstream (invalid JSON/PDF), just not with 413.
    oversized = b"x" * (_DEFAULT_MAX_BYTES + 1)
    r = client.post(
        "/rag/upload",
        content=oversized,
        headers={"Content-Type": "application/json"},
    )
    assert r.status_code != 413
