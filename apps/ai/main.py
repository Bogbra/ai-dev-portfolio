"""
AI Portfolio Service — FastAPI application entry point.

Handles all AI workflow endpoints. Contact form stays in the Fastify API service.
"""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from client_ip import get_client_ip
from mcp_server import mcp_app, mcp_server
from routes import voice as voice_module
from routes.cs01_workflow import router as cs01_router
from routes.cs02_post import router as cs02_router
from routes.cs03_rag import cleanup_sessions
from routes.cs03_rag import router as cs03_router
from routes.health import router as health_router
from routes.seo import router as seo_router
from routes.voice import router as voice_router
from settings import settings


# Per-path caps instead of one global ceiling: the body is fully buffered
# (see below) before any route handler — let alone its slowapi rate limit —
# ever sees the request, so a single generous limit shared by every route
# lets an attacker send many large-but-under-the-cap bodies at cheap routes
# that never legitimately need more than a few KB.
#
# Derived from the same settings each route's own upload-size validation
# already uses, rather than separately hand-picked byte counts — those two
# would otherwise be able to silently drift apart (e.g. MAX_TOTAL_UPLOAD_MB
# raised later without this middleware's cap following), rejecting a
# request the route's own logic would have accepted, or the reverse.
def _upload_body_cap(binary_bytes: int, *, file_count: int = 1) -> int:
    """Base64 inflates payload size by 4/3; JSON structure (filename/mimeType
    keys, quoting, one entry per file) adds a smaller amount on top — 10%
    of the binary size per file, floored at 8 KB, is comfortably more than
    that actually costs."""
    base64_bytes = -(-binary_bytes * 4 // 3)  # ceil(binary_bytes * 4 / 3)
    json_headroom = max(binary_bytes // 10, 8 * 1024) * file_count
    return base64_bytes + json_headroom


_RAG_UPLOAD_MAX_BYTES = _upload_body_cap(
    settings.MAX_TOTAL_UPLOAD_MB * 1024 * 1024, file_count=settings.MAX_PDFS
)
_VOICE_MAX_BYTES = _upload_body_cap(voice_module.MAX_AUDIO_BYTES)
_CS01_UPLOAD_MAX_BYTES = _upload_body_cap(settings.MAX_UPLOAD_SIZE_BYTES)
# Every other route: JSON-only, no file/audio payload. CS01's /run is the
# largest of these — up to 100 contacts x ~2 KB of string fields each
# (schemas/cs01.py's per-field caps) is ~220 KB; this covers that with
# roughly 2x headroom. SEO/CS02/RAG-ask/MCP bodies are all far smaller.
_DEFAULT_MAX_BYTES = 512 * 1024

_MAX_REQUEST_BODY_BYTES_BY_PATH: dict[str, int] = {
    "/rag/upload": _RAG_UPLOAD_MAX_BYTES,
    "/voice/agent": _VOICE_MAX_BYTES,
    "/ai-workflow/parse": _CS01_UPLOAD_MAX_BYTES,
}


def _max_body_bytes_for_path(path: str) -> int:
    return _MAX_REQUEST_BODY_BYTES_BY_PATH.get(path, _DEFAULT_MAX_BYTES)


# /rag/upload is the one route whose body can legitimately reach
# _RAG_UPLOAD_MAX_BYTES (40 MB) — every concurrent request buffering that
# much (see BodySizeLimitMiddleware below) before it ever reaches
# routes/cs03_rag.py's own PDF-parsing/embedding stage multiplies that
# against the container's fixed memory limit. Held for the *entire* request
# (buffering through the route handler returning), not just the buffering
# step alone — a semaphore acquired only around buffering would still let N
# requests' full bodies sit in memory at once while N *different* requests
# are in the parsing/embedding stage.
RAG_UPLOAD_CONCURRENCY_SEMAPHORE = asyncio.Semaphore(2)
_RAG_UPLOAD_PATH = "/rag/upload"


class BodySizeLimitMiddleware:
    # A raw ASGI middleware, not a BaseHTTPMiddleware subclass: the old
    # version only checked the Content-Length header, which a chunked
    # request (or one that simply omits/lies about the header) bypasses
    # entirely — await request.json() downstream would still buffer the
    # whole body regardless of what the header claimed. This counts actual
    # bytes as they arrive on the receive channel and aborts with 413 the
    # moment the running total crosses the limit, before the buffered body
    # is handed to a route handler. BaseHTTPMiddleware can't do this cheaply
    # — it fully buffers the body itself before dispatch() ever sees it.
    #
    # max_bytes fixes the cap for every request when given (tests use this
    # to avoid allocating tens of MB); left as None, each request looks up
    # its own cap by path via _max_body_bytes_for_path.
    def __init__(self, app: ASGIApp, max_bytes: int | None = None) -> None:
        self.app = app
        self._fixed_max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        if scope.get("path") == _RAG_UPLOAD_PATH:
            async with RAG_UPLOAD_CONCURRENCY_SEMAPHORE:
                await self._buffer_and_forward(scope, receive, send)
            return

        await self._buffer_and_forward(scope, receive, send)

    async def _buffer_and_forward(self, scope: Scope, receive: Receive, send: Send) -> None:
        max_bytes = (
            self._fixed_max_bytes
            if self._fixed_max_bytes is not None
            else _max_body_bytes_for_path(scope.get("path", ""))
        )

        chunks: list[bytes] = []
        total = 0
        while True:
            message = await receive()
            if message["type"] != "http.request":
                break
            body = message.get("body", b"")
            total += len(body)
            if total > max_bytes:
                response = JSONResponse(
                    {"status": "error", "message": "Request body too large."},
                    status_code=413,
                )
                await response(scope, receive, send)
                return
            chunks.append(body)
            if not message.get("more_body", False):
                break

        full_body = b"".join(chunks)
        delivered = False

        async def replay_receive() -> dict:
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": full_body, "more_body": False}
            # After the buffered body has been delivered once, later calls
            # must reflect the real connection state — not synthesize an
            # immediate disconnect. StreamingResponse polls receive() again
            # in a background task specifically to detect a real client
            # disconnect mid-stream; returning a fake "http.disconnect" here
            # made it think the client had already gone away right after
            # the first chunk, killing every SSE route after one event.
            # Delegating to the original receive() blocks correctly until
            # the connection actually closes.
            return await receive()

        await self.app(scope, replay_receive, send)


class NoCacheMiddleware:
    # A raw ASGI middleware, not a BaseHTTPMiddleware subclass — the latter's
    # call_next() runs the wrapped app via an internal anyio-bridged
    # background task that does not tolerate a StreamingResponse route
    # underneath it (SSE routes 500'd with "No response returned."; see
    # BodySizeLimitMiddleware's history below for the investigation). This
    # wraps send() directly to inject the header into http.response.start,
    # which is transparent to streaming — every later body chunk just
    # passes through untouched.
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.append((b"cache-control", b"no-store, max-age=0"))
                message = {**message, "headers": headers}
            await send(message)

        await self.app(scope, receive, send_wrapper)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(cleanup_sessions())
    # The MCP session manager owns its own task group for the /mcp mount;
    # it must be entered here so the sub-app's Streamable HTTP transport
    # actually starts (a Mount does not automatically run a sub-app's own
    # lifespan the way an included FastAPI router does).
    async with mcp_server.session_manager.run():
        yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


# app.state.limiter and the exception handler below are what slowapi's
# @limiter.limit(...) decorators actually need at the app level — each
# route module builds its own Limiter(key_func=get_client_ip) instance and
# decorates its own routes with real, active per-route limits. A
# default_limits= here would look like a shared 200/hour ceiling across
# every AI endpoint, but slowapi only auto-applies a Limiter's
# default_limits through SlowAPIMiddleware, which isn't registered — so it
# was never actually enforced. Deliberately left unset rather than kept as
# unwired configuration; see README's "Per-route IP-based limits" wording.
limiter = Limiter(key_func=get_client_ip)

app = FastAPI(title="AI Portfolio Service", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# All three are raw ASGI middleware (none subclass BaseHTTPMiddleware) —
# BaseHTTPMiddleware's call_next() runs the wrapped app via an internal
# anyio-bridged background task that does not tolerate a StreamingResponse
# route underneath it (SSE routes 500'd with "No response returned." when
# NoCacheMiddleware was BaseHTTPMiddleware-based). Order among raw ASGI
# middleware doesn't have that failure mode, so this is just the
# conventional CORS-outermost layout.
app.add_middleware(BodySizeLimitMiddleware)
app.add_middleware(NoCacheMiddleware)
# allow_headers explicitly lists what every route actually sends. Accept
# and Content-Type are CORS-safelisted (Starlette's CORSMiddleware always
# allows them regardless of this list); Mcp-Protocol-Version, Mcp-Method,
# and Mcp-Name are not — the MCP Lab's browser fetch() calls to /mcp/ send
# them per the modern per-request envelope (see lib/api.ts's callMcpTool),
# and without an explicit allowance here the preflight is rejected with
# "Disallowed CORS headers" before the real request is ever sent
# (verified: a preflight for these three 400s without this line).
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_allowed_origins(),
    allow_credentials=False,
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type", "Accept", "Mcp-Protocol-Version", "Mcp-Method", "Mcp-Name"],
)

app.include_router(health_router)
app.include_router(cs01_router)
app.include_router(cs02_router)
app.include_router(cs03_router)
app.include_router(voice_router)
app.include_router(seo_router)

# Portfolio resources + the CS02 agent workflow as an MCP tool — see
# mcp_server.py. Reachable at <NEXT_PUBLIC_AI_URL>/mcp/ from any Streamable
# HTTP MCP client.
app.mount("/mcp", mcp_app)
