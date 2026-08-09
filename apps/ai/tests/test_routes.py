"""
Integration tests for FastAPI route handlers using TestClient.

All tests run in mock mode (no API keys required). They cover:
- Health endpoint
- CSV parse endpoint (happy path, oversized file, too many rows, wrong type)
- Multi-agent post honeypot silent-accept
- RAG ask with an unknown (but well-formed) or malformed session ID
- RAG upload with non-PDF file
- RAG upload generates a session ID usable by /rag/ask
- Body size limit middleware (413 on Content-Length > 40 MB)
"""

from __future__ import annotations

import asyncio
import base64
import uuid

from fastapi.testclient import TestClient

import routes.cs03_rag as cs03_rag

# `client` fixture is session-scoped in conftest.py, shared across every
# test file — see the comment there for why.

# ─── Helpers ──────────────────────────────────────────────────────────────────


def _b64(content: bytes | str) -> str:
    if isinstance(content, str):
        content = content.encode()
    return base64.b64encode(content).decode()


_CSV_3_ROWS = "name,email\nAlice,alice@example.com\nBob,bob@example.com\nCarol,carol@example.com\n"


# ─── Health ───────────────────────────────────────────────────────────────────


def test_health_ok(client: TestClient):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ─── CS01 — ai-workflow/parse ─────────────────────────────────────────────────


def test_parse_valid_csv(client: TestClient):
    r = client.post(
        "/ai-workflow/parse",
        json={"filename": "contacts.csv", "content": _b64(_CSV_3_ROWS), "mimeType": "text/csv"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["count"] == 3
    emails = [c["email"] for c in data["contacts"]]
    assert "alice@example.com" in emails


def test_parse_file_too_large(client: TestClient):
    # settings.MAX_UPLOAD_SIZE_BYTES = 1 MB; send 1 MB + 1 byte raw data
    from settings import settings

    large_raw = b"x" * (settings.MAX_UPLOAD_SIZE_BYTES + 1)
    r = client.post(
        "/ai-workflow/parse",
        json={"filename": "big.csv", "content": _b64(large_raw), "mimeType": "text/csv"},
    )
    assert r.status_code == 400
    assert any(w in r.json()["message"].lower() for w in ("exceeds", "too large", "maximum"))


def test_parse_too_many_rows(client: TestClient):
    from settings import settings

    rows = ["name,email"] + [f"User{i},u{i}@x.com" for i in range(settings.MAX_UPLOAD_ROWS + 1)]
    csv_content = "\n".join(rows)
    r = client.post(
        "/ai-workflow/parse",
        json={"filename": "many.csv", "content": _b64(csv_content), "mimeType": "text/csv"},
    )
    assert r.status_code == 400
    assert "row" in r.json()["message"].lower()


def test_parse_non_csv_extension(client: TestClient):
    r = client.post(
        "/ai-workflow/parse",
        json={"filename": "data.txt", "content": _b64("hello"), "mimeType": "text/plain"},
    )
    assert r.status_code == 400


# ─── CS02 — multi-agent-post honeypot ────────────────────────────────────────


def test_multi_agent_post_honeypot_silent(client: TestClient):
    # A filled _honey field must return a silent mock 200, not reveal the protection.
    r = client.post(
        "/multi-agent-post/run",
        json={
            "topic": "AI workflow automation",
            "audience": "engineers",
            "tone": "professional",
            "postGoal": "explain",
            "_honey": "I am a bot",
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") == "final_ready"
    assert data.get("mockMode") is True


def test_multi_agent_post_short_topic_rejected(client: TestClient):
    r = client.post(
        "/multi-agent-post/run",
        json={"topic": "AI", "tone": "professional", "postGoal": "explain"},
    )
    assert r.status_code == 400


def test_multi_agent_post_internal_error_returns_500_without_leaking_details(
    client: TestClient, monkeypatch
):
    # A genuine workflow failure must be a server error a caller can detect
    # via HTTP status alone (not just by parsing the body) — and the raw
    # exception text must never reach the response.
    import routes.cs02_post as cs02_post

    secret_detail = "upstream said: api_key=sk-should-never-leak-456 rejected"

    async def _boom(*_args, **_kwargs):
        raise RuntimeError(secret_detail)

    monkeypatch.setattr(cs02_post, "run_cs02_workflow", _boom)

    r = client.post(
        "/multi-agent-post/run",
        json={
            "topic": "A topic long enough to pass validation",
            "tone": "professional",
            "postGoal": "explain",
        },
    )
    assert r.status_code == 500
    assert secret_detail not in r.text


# ─── CS03 — RAG ask with unknown/invalid session ──────────────────────────────


def test_rag_ask_unknown_session(client: TestClient):
    # Well-formed uuid4 (passes schema validation) but never issued by
    # /rag/upload — must fail at the session lookup, not the schema.
    r = client.post(
        "/rag/ask",
        json={
            "question": "What is the main finding?",
            "sessionId": "00000000-0000-4000-8000-000000000000",
        },
    )
    assert r.status_code == 400
    assert r.json()["status"] == "error"


def test_rag_ask_rejects_non_uuid_session_id(client: TestClient):
    # A client-chosen, human-readable ID — accepted before this session ID
    # became server-generated — must now fail schema validation.
    r = client.post(
        "/rag/ask",
        json={"question": "What is the main finding?", "sessionId": "unknown-session-xyz"},
    )
    assert r.status_code == 400
    assert r.json()["status"] == "error"


def test_rag_upload_non_pdf_rejected(client: TestClient):
    r = client.post(
        "/rag/upload",
        json={
            "files": [{"filename": "notes.txt", "content": _b64("hello"), "mimeType": "text/plain"}]
        },
    )
    assert r.status_code == 400
    assert "pdf" in r.json()["message"].lower()


def test_rag_upload_generates_session_id_usable_by_rag_ask(client: TestClient, monkeypatch):
    # A client can no longer choose the session ID it uploads under — the
    # server generates one and hands it back; only that ID works for /rag/ask.
    # Force mock mode regardless of a locally configured OPENAI_API_KEY (this
    # test must not depend on, or make, a real OpenAI call).
    monkeypatch.setattr(cs03_rag.settings, "OPENAI_API_KEY", None)
    monkeypatch.setattr(cs03_rag, "_extract_pdf_text", lambda _content: "quarterly revenue grew.")

    upload = client.post(
        "/rag/upload",
        json={
            "files": [
                {
                    "filename": "report.pdf",
                    "content": _b64("%PDF-1.4 fake pdf bytes"),
                    "mimeType": "application/pdf",
                }
            ]
        },
    )
    assert upload.status_code == 200
    body = upload.json()
    assert body["status"] == "indexed"

    session_id = body["sessionId"]
    assert uuid.UUID(session_id).version == 4

    ask = client.post(
        "/rag/ask",
        json={"question": "What happened to revenue?", "sessionId": session_id},
    )
    assert ask.status_code == 200
    assert ask.json()["status"] == "answer_ready"


def test_rag_upload_rejects_non_pdf_magic_bytes(client: TestClient):
    # Extension check alone isn't enough — content must actually be a PDF.
    r = client.post(
        "/rag/upload",
        json={
            "files": [
                {
                    "filename": "report.pdf",
                    "content": _b64("not actually a pdf"),
                    "mimeType": "application/pdf",
                }
            ]
        },
    )
    assert r.status_code == 400
    assert "pdf" in r.json()["message"].lower()


def test_rag_upload_rejects_invalid_base64(client: TestClient):
    r = client.post(
        "/rag/upload",
        json={
            "files": [
                {
                    "filename": "report.pdf",
                    "content": "not valid base64!!! ***",
                    "mimeType": "application/pdf",
                }
            ]
        },
    )
    assert r.status_code == 400


def test_rag_upload_rejects_pdf_with_no_extractable_text(client: TestClient, monkeypatch):
    monkeypatch.setattr(cs03_rag.settings, "OPENAI_API_KEY", None)
    monkeypatch.setattr(cs03_rag, "_extract_pdf_text", lambda _data: "   ")

    r = client.post(
        "/rag/upload",
        json={
            "files": [
                {
                    "filename": "empty.pdf",
                    "content": _b64("%PDF-1.4 fake pdf bytes"),
                    "mimeType": "application/pdf",
                }
            ]
        },
    )
    assert r.status_code == 400


def test_rag_upload_rejects_when_no_usable_chunks_survive(client: TestClient, monkeypatch):
    # Text extracts, but every "chunk" is too short to survive _chunk_text's
    # 20-character filter — the session must not be stored as if it were usable.
    monkeypatch.setattr(cs03_rag.settings, "OPENAI_API_KEY", None)
    monkeypatch.setattr(cs03_rag, "_extract_pdf_text", lambda _data: "hi. ok. no.")

    r = client.post(
        "/rag/upload",
        json={
            "files": [
                {
                    "filename": "tooshort.pdf",
                    "content": _b64("%PDF-1.4 fake pdf bytes"),
                    "mimeType": "application/pdf",
                }
            ]
        },
    )
    assert r.status_code == 400
    assert "no usable text" in r.json()["message"].lower()


# ─── Body size limit middleware ───────────────────────────────────────────────


def test_body_size_limit_rejects_a_genuinely_large_body():
    # A real oversized body — not just a claimed Content-Length — must be
    # rejected. Uses a small max_bytes on a standalone app rather than
    # allocating tens of MB in the test suite.
    from starlette.applications import Starlette
    from starlette.requests import Request
    from starlette.responses import JSONResponse
    from starlette.routing import Route
    from starlette.testclient import TestClient as StarletteTestClient

    from main import BodySizeLimitMiddleware

    async def echo(request: Request):
        await request.body()
        return JSONResponse({"ok": True})

    inner = Starlette(routes=[Route("/", echo, methods=["POST"])])
    inner.add_middleware(BodySizeLimitMiddleware, max_bytes=10)
    tc = StarletteTestClient(inner)

    r = tc.post("/", content=b"x" * 11)
    assert r.status_code == 413

    ok = tc.post("/", content=b"x" * 10)
    assert ok.status_code == 200


def test_body_size_limit_enforced_without_content_length_header():
    # The gap the old Content-Length-only check had: a body delivered in
    # streamed chunks with no reliable Content-Length must still be capped —
    # driven directly at the ASGI level since HTTP client libraries compute
    # Content-Length automatically and won't let a test omit it.
    from main import BodySizeLimitMiddleware

    async def dummy_app(scope, receive, send):
        while True:
            message = await receive()
            if message["type"] == "http.disconnect" or not message.get("more_body", False):
                break
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b"ok"})

    middleware = BodySizeLimitMiddleware(dummy_app, max_bytes=10)
    scope = {"type": "http", "method": "POST", "headers": []}  # no content-length at all
    chunks = iter([b"12345", b"67890", b"EXTRA"])  # 15 bytes total, streamed in pieces

    async def receive():
        try:
            return {"type": "http.request", "body": next(chunks), "more_body": True}
        except StopIteration:
            return {"type": "http.disconnect"}

    sent: list[dict] = []

    async def send(message):
        sent.append(message)

    asyncio.run(middleware(scope, receive, send))

    start = next(m for m in sent if m["type"] == "http.response.start")
    assert start["status"] == 413


def test_body_size_limit_does_not_fake_disconnect_after_body_delivered():
    # Regression: StreamingResponse (used by /rag/ask/stream) polls receive()
    # again *after* the request body has been fully read, specifically to
    # detect a real client disconnect mid-stream. The middleware's replay
    # receive() used to answer every call after the first with a synthetic
    # http.disconnect — which made every SSE route think the client had
    # already gone away right after the first chunk, killing the stream.
    from main import BodySizeLimitMiddleware

    receive_calls = 0

    async def app_polls_receive_twice(_scope, receive, send):
        # First call: consumes the replayed body (as request.json() would).
        await receive()
        # Second call: what StreamingResponse's disconnect-listener does —
        # must reflect the real connection state, not an instant disconnect.
        second = await receive()
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": str(second).encode()})

    middleware = BodySizeLimitMiddleware(app_polls_receive_twice, max_bytes=1000)
    scope = {"type": "http", "method": "POST", "headers": []}

    async def receive():
        nonlocal receive_calls
        receive_calls += 1
        if receive_calls == 1:
            return {"type": "http.request", "body": b"{}", "more_body": False}
        # The real connection is still open — a well-behaved receive() call
        # here would block until the client actually disconnects. A test
        # double can't block forever, so it returns a distinguishable
        # sentinel instead of "http.disconnect" to prove the middleware
        # actually delegated to it rather than fabricating a disconnect.
        return {"type": "http.request", "body": b"", "more_body": False}

    sent: list[dict] = []

    async def send(message):
        sent.append(message)

    asyncio.run(middleware(scope, receive, send))

    body = next(m for m in sent if m["type"] == "http.response.body")
    assert b"http.disconnect" not in body["body"]
    # The second real receive() call was reached at all (not short-circuited).
    assert receive_calls >= 2
