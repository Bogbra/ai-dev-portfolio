"""
MCP (Model Context Protocol) server mounted at /mcp on the main FastAPI app
via Streamable HTTP transport (the current spec-recommended remote
transport), stateless and JSON-response (no per-connection session state,
and a plain JSON response is far easier to inspect with a simple HTTP
client than an SSE event stream). Point any MCP client (Claude Desktop,
Claude Code, ...) at <NEXT_PUBLIC_AI_URL>/mcp/ to use it.

Two kinds of capability are exposed, deliberately as different MCP
primitives:

- Static portfolio data (case studies, tech stack) is read-only and has no
  side effects or cost — modelled as MCP **resources**
  (portfolio://case-studies, portfolio://case-studies/{id},
  portfolio://stack), not tools. Resources are the primitive meant for
  "data a client can read"; tools are for "an action a client invokes".
- The CS02 research-to-post agent workflow is a real, provider-billed,
  multi-step action — modelled as an MCP **tool**
  (create_researched_post), reusing routes/cs02_post.py's
  run_cs02_workflow(...) directly rather than reimplementing it.

The first few create_researched_post calls per client IP run the real
LangGraph workflow against a live provider; once that small public-demo
quota (mcp_live_quota.py) is exhausted, later calls transparently fall
through to the same deterministic mock the HTTP route itself uses in mock
mode. Every response reports its actual mode, remaining quota, and (when
applicable) why it fell back — never silently. A genuine live-provider
failure is surfaced as a real MCP tool error, not quietly replaced by a
mock result reported as success.
"""

from __future__ import annotations

import logging
import random
import time
from collections import defaultdict, deque

from mcp.server.mcpserver import Context, MCPServer
from mcp.server.mcpserver.exceptions import ResourceNotFoundError, ToolError
from mcp.server.transport_security import TransportSecuritySettings
from pydantic import ValidationError
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from client_ip import get_client_ip
from mcp_data import CASE_STUDIES, STACK
from mcp_live_quota import LiveQuota
from routes.cs02_post import _is_unsafe_topic, run_cs02_workflow
from schemas.cs02 import CreatePostToolInput, PostGoal, PostTone
from schemas.mcp import (
    CreateResearchedPostResponse,
    DemoStatusResponse,
    ExecutionInfo,
    PostSource,
    ResearchedPostResult,
)
from settings import settings

logger = logging.getLogger(__name__)

mcp_server = MCPServer(
    name="ai-dev-portfolio",
    title="AI Engineering Portfolio",
    version="1.1.0",
    instructions=(
        "Explore portfolio architecture through read-only resources "
        "and execute a rate-limited version of the CS02 agent workflow. "
        "Live provider execution is available within a small public-demo "
        "quota; later calls use clearly labelled deterministic mocks."
    ),
)

_live_quota = LiveQuota(
    limit=settings.MCP_LIVE_CALL_LIMIT, window_seconds=settings.MCP_LIVE_QUOTA_WINDOW_SECONDS
)


# ─── Resources — static portfolio data ─────────────────────────────────────


@mcp_server.resource("portfolio://case-studies")
def case_studies_resource() -> list[dict[str, object]]:
    """Compact list of all case studies: id, title, one-line angle."""
    return [{"id": cs["id"], "title": cs["title"], "angle": cs["angle"]} for cs in CASE_STUDIES]


@mcp_server.resource("portfolio://case-studies/{case_id}")
def case_study_resource(case_id: str) -> dict[str, object]:
    """Full detail (problem, decision, result, stack) for one case study."""
    for cs in CASE_STUDIES:
        if cs["id"] == case_id:
            return cs
    # A real MCP-protocol error (maps to INVALID_PARAMS — see
    # ResourceNotFoundError's docstring), not a 200 with an embedded
    # "error" field a caller could silently ignore.
    raise ResourceNotFoundError(f"No case study with id '{case_id}'. Valid ids: cs01, cs02, cs03.")


@mcp_server.resource("portfolio://stack")
def stack_resource() -> list[dict[str, object]]:
    """Tools and technologies used across this portfolio, grouped by stage."""
    return STACK


# ─── Tool — CS02 agent workflow, live-first with a per-IP demo quota ───────


def _client_ip_from_context(ctx: Context) -> str:
    # ctx.request_context.request is the real Starlette Request for this
    # call — the streamable-http transport threads it through as
    # ServerMessageMetadata(request_context=request) all the way to
    # ServerRequestContext.request (see mcp.server._streamable_http_modern
    # and mcp.server.context). Preferred over a hand-rolled ContextVar:
    # it's the SDK's own request-scoped plumbing (no manual set/reset
    # lifecycle to get right), and it's what get_client_ip already expects
    # (a Starlette Request), so per-IP quota keys the same spoof-resistant
    # way as every slowapi-based rate limit elsewhere in this service.
    request = ctx.request_context.request
    if request is None:
        return "unknown"
    return get_client_ip(request)


def _first_error_message(exc: ValidationError) -> str:
    errors = exc.errors()
    if not errors:
        return "Invalid input."
    return str(errors[0].get("ctx", {}).get("error") or errors[0].get("msg") or "Invalid input.")


@mcp_server.tool()
async def create_researched_post(
    ctx: Context,
    topic: str,
    audience: str = "",
    tone: PostTone = "professional",
    postGoal: PostGoal = "explain",
    useWebContext: bool = False,
) -> CreateResearchedPostResponse:
    """Run the CS02 research-to-post agent workflow (Research -> Write ->
    Critique -> optional Revision -> Groundedness Check) and return a
    structured post. The Groundedness Check verifies claims against
    retrieved source material when available, falling back to a
    self-consistency check against the workflow's own research context
    otherwise — `result.groundedness` reports the outcome, and the full
    response reports which basis was actually used. Set `useWebContext` to
    enrich research with a live Tavily search of the topic (never sent
    without this flag, and only if the server has a Tavily key configured).
    A small number of calls per client run the real workflow against a live
    provider; once that quota is used, later calls transparently use a
    deterministic mock — always reported in `execution.mode`."""
    start = time.monotonic()

    # Validate + normalise before touching the quota — invalid input must
    # never consume a live slot.
    try:
        parsed = CreatePostToolInput(
            topic=topic,
            audience=audience,
            tone=tone,
            postGoal=postGoal,
            useWebContext=useWebContext,
        )
    except ValidationError as exc:
        raise ToolError(_first_error_message(exc)) from exc

    if _is_unsafe_topic(parsed.topic):
        raise ToolError(
            "This request cannot be processed in the public demo because it "
            "may create misleading, abusive, or unsafe content."
        )

    ip = _client_ip_from_context(ctx)
    fallback_reason: str | None = None
    live = False

    if not settings.MCP_LIVE_DEMO_ENABLED:
        fallback_reason = "live_mode_disabled"
    elif not settings.OPENAI_API_KEY:
        fallback_reason = "live_mode_disabled"
    elif await _live_quota.try_reserve(ip):
        live = True
    else:
        fallback_reason = "live_quota_exhausted"

    try:
        result = await run_cs02_workflow(
            parsed.topic,
            parsed.audience,
            parsed.tone,
            parsed.postGoal,
            live=live,
            use_web_context=parsed.useWebContext,
        )
    except Exception as exc:
        # A genuine live-provider failure (timeout, malformed response,
        # OpenAI/Tavily outage, ...) must never be silently swapped for a
        # mock result reported as a success — that would hide a real outage
        # behind an apparently-working demo. Surfaced as a real tool error
        # instead; the quota slot above stays consumed regardless (an
        # attempted live call, not a successful one, is what's rationed).
        #
        # The message names "the live workflow"/"a provider" only when this
        # actually was a live call — _build_mock_result makes no external
        # calls, so a failure there is an internal bug, not a provider
        # outage, and telling the caller "provider error" would be false.
        logger.exception("create_researched_post workflow failed (live=%s)", live)
        if live:
            raise ToolError(
                "The live workflow encountered a provider error. Please try again."
            ) from exc
        raise ToolError("The workflow encountered an internal error. Please try again.") from exc

    remaining = await _live_quota.remaining(ip)
    duration_ms = round((time.monotonic() - start) * 1000)

    return CreateResearchedPostResponse(
        execution=ExecutionInfo(
            mode="live" if live else "mock",
            remainingLiveCalls=remaining,
            liveCallLimit=settings.MCP_LIVE_CALL_LIMIT,
            fallbackReason=fallback_reason,
            durationMs=duration_ms,
        ),
        result=ResearchedPostResult(
            post=result["finalPost"]["fullPost"],
            sources=[PostSource(**s) for s in result.get("sources", [])],
            groundedness=result["groundednessResult"]["status"],
            groundingBasis=result["groundednessResult"].get("groundingBasis", "none"),
            criticScore=result["criticFeedback"]["score"],
            revised=bool(result.get("revisionNotes")),
        ),
    )


@mcp_server.tool()
async def get_demo_status(ctx: Context) -> DemoStatusResponse:
    """Check the current create_researched_post live-demo quota for your
    client without consuming it."""
    ip = _client_ip_from_context(ctx)
    remaining = (
        await _live_quota.remaining(ip)
        if settings.MCP_LIVE_DEMO_ENABLED and settings.OPENAI_API_KEY
        else 0
    )
    return DemoStatusResponse(
        liveEnabled=settings.MCP_LIVE_DEMO_ENABLED and bool(settings.OPENAI_API_KEY),
        liveCallLimit=settings.MCP_LIVE_CALL_LIMIT,
        remainingLiveCalls=remaining,
        fallbackMode="mock",
    )


# ─── Rate limiting ─────────────────────────────────────────────────────────
# The MCP Streamable HTTP sub-app below is a raw ASGI app (via Mount), not
# FastAPI route functions, so it can't use the @limiter.limit(...) decorator
# SlowAPI provides everywhere else in this service. This is a small,
# dependency-free sliding-window equivalent scoped to this one mount. It
# covers the whole /mcp protocol surface (resource reads included) and is
# intentionally much more permissive than the live-call quota above, which
# guards only the one provider-billed tool.


class _McpRateLimitMiddleware:
    def __init__(
        self,
        app: ASGIApp,
        max_requests: int = 30,
        window_seconds: float = 60.0,
        sweep_probability: float = 0.01,
    ) -> None:
        self.app = app
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.sweep_probability = sweep_probability
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def _sweep_idle_ips(self, now: float) -> None:
        # Pruning inside __call__ only ever touches the current requester's
        # own entry — which is about to get a fresh hit appended anyway, so
        # it can never actually leave the dict empty. The only way to bound
        # growth from IPs that hit the limiter once and never return is an
        # occasional full sweep, so this runs on a small, random fraction of
        # requests rather than every one.
        idle_ips = [
            ip
            for ip, hits in self._hits.items()
            if not hits or now - hits[-1] > self.window_seconds
        ]
        for ip in idle_ips:
            del self._hits[ip]

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        ip = get_client_ip(Request(scope))
        now = time.monotonic()
        hits = self._hits[ip]
        while hits and now - hits[0] > self.window_seconds:
            hits.popleft()

        if len(hits) >= self.max_requests:
            response = JSONResponse(
                {"error": "Rate limit exceeded. Please wait a minute and try again."},
                status_code=429,
            )
            await response(scope, receive, send)
            return

        hits.append(now)

        if random.random() < self.sweep_probability:
            self._sweep_idle_ips(now)

        await self.app(scope, receive, send)


mcp_app = mcp_server.streamable_http_app(
    streamable_http_path="/",
    stateless_http=True,
    json_response=True,
    transport_security=TransportSecuritySettings(
        allowed_hosts=settings.get_mcp_allowed_hosts(),
        allowed_origins=settings.get_allowed_origins(),
    ),
)
mcp_app.add_middleware(_McpRateLimitMiddleware)
