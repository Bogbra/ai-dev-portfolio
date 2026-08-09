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
from routes.cs01_workflow import router as cs01_router
from routes.cs02_post import router as cs02_router
from routes.cs03_rag import cleanup_sessions
from routes.cs03_rag import router as cs03_router
from routes.health import router as health_router
from routes.seo import router as seo_router
from routes.voice import router as voice_router
from settings import settings

_MAX_REQUEST_BODY_BYTES = 40 * 1024 * 1024  # 40 MB — well above CS03's 25 MB total-upload limit


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
    def __init__(self, app: ASGIApp, max_bytes: int = _MAX_REQUEST_BODY_BYTES) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        chunks: list[bytes] = []
        total = 0
        while True:
            message = await receive()
            if message["type"] != "http.request":
                break
            body = message.get("body", b"")
            total += len(body)
            if total > self.max_bytes:
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


limiter = Limiter(key_func=get_client_ip, default_limits=["200/hour"])

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
