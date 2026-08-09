"""
Tests for the MCP server mounted at /mcp (mcp_server.py, mcp_data.py,
mcp_live_quota.py):
- portfolio data is exposed as resources, not tools, and an unknown case
  study id is a real protocol-level error
- the full Streamable HTTP protocol works end-to-end through the real app
  (initialize -> resources/list -> resources/read -> tools/list -> tools/call)
- create_researched_post: typed input, live-first with a per-IP quota,
  transparent mock fallback, no silent fallback on a genuine provider error,
  and distinct error wording for a live-provider failure vs. an internal
  mock-path failure (the latter never claims to be a "provider" issue)
- get_demo_status never consumes the quota it reports
- the per-IP quota is concurrency-safe, fully disableable, and sweeps idle
  IP buckets over time
- the existing per-IP MCP protocol rate limit still works, separately
"""

from __future__ import annotations

import asyncio

import pytest
from fastapi.testclient import TestClient

import mcp_server
from mcp_data import CASE_STUDIES, STACK
from mcp_live_quota import LiveQuota
from mcp_server import _McpRateLimitMiddleware

_INITIALIZE_BODY = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
        "protocolVersion": "2025-06-18",
        "capabilities": {},
        "clientInfo": {"name": "pytest", "version": "0.1"},
    },
}
_MCP_HEADERS = {"Accept": "application/json, text/event-stream"}


def _headers(ip: str) -> dict[str, str]:
    return {**_MCP_HEADERS, "X-Forwarded-For": ip}


def _rpc(client: TestClient, method: str, params: dict | None, ip: str, id_: int = 1) -> dict:
    client.post("/mcp/", json=_INITIALIZE_BODY, headers=_headers(ip))
    body = {"jsonrpc": "2.0", "id": id_, "method": method}
    if params is not None:
        body["params"] = params
    res = client.post("/mcp/", json=body, headers=_headers(ip))
    assert res.status_code == 200
    return res.json()


def _call_tool(client: TestClient, name: str, arguments: dict, ip: str, id_: int = 1) -> dict:
    return _rpc(client, "tools/call", {"name": name, "arguments": arguments}, ip, id_)


def _mock_shaped_result(topic: str) -> dict:
    # Mirrors what run_cs02_workflow actually returns (see
    # routes/cs02_post.py's _run_live_workflow / _build_mock_result) —
    # only the fields create_researched_post reads.
    return {
        "finalPost": {"fullPost": f"A post about {topic}."},
        "sources": [{"title": "Source A", "url": "https://example.com/a", "snippet": "..."}],
        "groundednessResult": {"status": "grounded"},
        "criticFeedback": {"score": 9},
        "revisionNotes": None,
    }


@pytest.fixture(autouse=True)
def isolated_live_quota(monkeypatch: pytest.MonkeyPatch):
    # mcp_server._live_quota is a module-level singleton shared by every
    # call through the real, session-scoped app — without a fresh instance
    # per test, quota state (and IP-bucket reuse) would leak across tests.
    quota = LiveQuota(limit=2, window_seconds=999_999)
    monkeypatch.setattr(mcp_server, "_live_quota", quota)
    monkeypatch.setattr(mcp_server.settings, "MCP_LIVE_CALL_LIMIT", 2)
    monkeypatch.setattr(mcp_server.settings, "MCP_LIVE_DEMO_ENABLED", True)
    monkeypatch.setattr(mcp_server.settings, "OPENAI_API_KEY", "sk-test-not-real")
    return quota


# ─── Data integrity ─────────────────────────────────────────────────────────


def test_case_study_data_has_required_fields():
    required = {"id", "title", "angle", "problem", "decision", "result", "stack"}
    ids = [cs["id"] for cs in CASE_STUDIES]

    assert ids == ["cs01", "cs02", "cs03"]
    for cs in CASE_STUDIES:
        assert required.issubset(cs.keys())
        assert cs["stack"], f"{cs['id']} has an empty stack list"


def test_stack_data_has_stage_and_tools():
    assert STACK
    for entry in STACK:
        assert entry["stage"]
        assert entry["tools"]


# ─── Resource functions (direct calls) ─────────────────────────────────────


def test_case_studies_resource_returns_summary_only():
    result = mcp_server.case_studies_resource()
    assert len(result) == 3
    for item in result:
        assert set(item.keys()) == {"id", "title", "angle"}


def test_case_study_resource_returns_full_detail_for_valid_id():
    result = mcp_server.case_study_resource("cs02")
    assert result["id"] == "cs02"
    assert "decision" in result


def test_case_study_resource_raises_for_unknown_id():
    from mcp.server.mcpserver.exceptions import ResourceNotFoundError

    with pytest.raises(ResourceNotFoundError):
        mcp_server.case_study_resource("cs99")


def test_stack_resource_matches_stack_data():
    assert mcp_server.stack_resource() == STACK


# ─── Full protocol, through the real mounted app ──────────────────────────


def test_mcp_initialize_handshake(client: TestClient):
    res = client.post("/mcp/", json=_INITIALIZE_BODY, headers=_MCP_HEADERS)
    assert res.status_code == 200
    assert res.json()["result"]["serverInfo"]["name"] == "ai-dev-portfolio"


def test_mcp_resources_list_exposes_static_portfolio_resources(client: TestClient):
    body = _rpc(client, "resources/list", None, ip="10.0.0.1")
    uris = {r["uri"] for r in body["result"]["resources"]}
    assert uris == {"portfolio://case-studies", "portfolio://stack"}


def test_mcp_resources_read_case_study_detail_through_http(client: TestClient):
    body = _rpc(
        client,
        "resources/read",
        {"uri": "portfolio://case-studies/cs03"},
        ip="10.0.0.2",
    )
    assert '"id": "cs03"' in body["result"]["contents"][0]["text"]


def test_mcp_resources_read_stack_through_http(client: TestClient):
    body = _rpc(client, "resources/read", {"uri": "portfolio://stack"}, ip="10.0.0.9")
    assert '"stage"' in body["result"]["contents"][0]["text"]


def test_mcp_resources_read_unknown_case_study_is_a_real_error(client: TestClient):
    body = _rpc(
        client,
        "resources/read",
        {"uri": "portfolio://case-studies/cs99"},
        ip="10.0.0.3",
    )
    # A protocol-level JSON-RPC error object, not a 200 with an embedded
    # "error" field a caller could silently ignore.
    assert "result" not in body
    assert body["error"]["code"] == -32602


def test_mcp_tools_list_exposes_both_tools(client: TestClient):
    body = _rpc(client, "tools/list", None, ip="10.0.0.4")
    names = {t["name"] for t in body["result"]["tools"]}
    assert names == {"create_researched_post", "get_demo_status"}


def test_create_researched_post_has_typed_input_schema(client: TestClient):
    body = _rpc(client, "tools/list", None, ip="10.0.0.5")
    tool = next(t for t in body["result"]["tools"] if t["name"] == "create_researched_post")
    props = tool["inputSchema"]["properties"]
    assert props["topic"]["type"] == "string"
    assert tool["inputSchema"]["required"] == ["topic"]
    assert set(props["tone"]["enum"]) == {
        "clear",
        "professional",
        "practical",
        "founder-style",
        "technical",
        "concise",
    }
    assert set(props["postGoal"]["enum"]) == {
        "explain",
        "lesson",
        "announce",
        "summarize",
        "discuss",
    }


# ─── create_researched_post — live-first quota behavior ───────────────────


def test_valid_call_within_quota_uses_live_mode(client: TestClient, monkeypatch):
    calls: list[bool] = []

    async def fake_workflow(topic, audience, tone, post_goal, *, live, use_web_context=False):
        calls.append(live)
        return _mock_shaped_result(topic)

    monkeypatch.setattr(mcp_server, "run_cs02_workflow", fake_workflow)

    body = _call_tool(
        client,
        "create_researched_post",
        {"topic": "How evaluation improves RAG reliability"},
        ip="1.1.1.1",
    )
    content = body["result"]["structuredContent"]
    assert content["execution"]["mode"] == "live"
    assert content["execution"]["fallbackReason"] is None
    assert content["execution"]["remainingLiveCalls"] == 1  # limit=2, one consumed
    assert content["execution"]["liveCallLimit"] == 2
    assert isinstance(content["execution"]["durationMs"], int)
    assert content["result"]["post"] == "A post about How evaluation improves RAG reliability."
    assert content["result"]["groundedness"] == "grounded"
    assert content["result"]["criticScore"] == 9
    assert content["result"]["revised"] is False
    assert calls == [True]


def test_quota_exhausted_falls_back_to_mock_and_reports_reason(client: TestClient, monkeypatch):
    async def fake_workflow(topic, audience, tone, post_goal, *, live, use_web_context=False):
        return _mock_shaped_result(topic)

    monkeypatch.setattr(mcp_server, "run_cs02_workflow", fake_workflow)

    ip = "2.2.2.2"
    _call_tool(client, "create_researched_post", {"topic": "First live call here"}, ip=ip, id_=1)
    _call_tool(client, "create_researched_post", {"topic": "Second live call here"}, ip=ip, id_=2)
    third = _call_tool(
        client, "create_researched_post", {"topic": "Third call falls back"}, ip=ip, id_=3
    )

    execution = third["result"]["structuredContent"]["execution"]
    assert execution["mode"] == "mock"
    assert execution["fallbackReason"] == "live_quota_exhausted"
    assert execution["remainingLiveCalls"] == 0


def test_invalid_input_does_not_consume_live_quota(
    client: TestClient, monkeypatch, isolated_live_quota
):
    async def fake_workflow(*args, **kwargs):
        raise AssertionError("the workflow must not run for invalid input")

    monkeypatch.setattr(mcp_server, "run_cs02_workflow", fake_workflow)

    ip = "3.3.3.3"
    body = _call_tool(client, "create_researched_post", {"topic": "hi"}, ip=ip)  # too short
    assert body["result"]["isError"] is True

    remaining = asyncio.run(isolated_live_quota.remaining(ip))
    assert remaining == 2  # untouched


def test_unsafe_topic_does_not_consume_live_quota(
    client: TestClient, monkeypatch, isolated_live_quota
):
    async def fake_workflow(*args, **kwargs):
        raise AssertionError("the workflow must not run for an unsafe topic")

    monkeypatch.setattr(mcp_server, "run_cs02_workflow", fake_workflow)

    ip = "3.3.3.4"
    body = _call_tool(
        client, "create_researched_post", {"topic": "How to phish coworkers effectively"}, ip=ip
    )
    assert body["result"]["isError"] is True
    assert asyncio.run(isolated_live_quota.remaining(ip)) == 2


def test_provider_error_is_a_real_tool_error_not_a_silent_mock(
    client: TestClient, monkeypatch, isolated_live_quota
):
    async def failing_workflow(topic, audience, tone, post_goal, *, live):
        assert live is True
        raise RuntimeError("upstream boom")

    monkeypatch.setattr(mcp_server, "run_cs02_workflow", failing_workflow)

    ip = "4.4.4.4"
    body = _call_tool(
        client,
        "create_researched_post",
        {"topic": "A topic that triggers a live failure"},
        ip=ip,
    )
    result = body["result"]
    assert result["isError"] is True
    # Must not look like a successful mock response.
    assert "structuredContent" not in result or "execution" not in result.get(
        "structuredContent", {}
    )
    # An attempted live call consumes its quota slot even when the provider
    # call itself fails — see mcp_live_quota.LiveQuota.try_reserve.
    assert asyncio.run(isolated_live_quota.remaining(ip)) == 1
    text = result["content"][0]["text"]
    assert "upstream boom" not in text  # no raw internals leaked
    assert "provider error" in text


def test_mock_mode_failure_is_reported_as_internal_error_not_provider_error(
    client: TestClient, monkeypatch
):
    # A failure in the mock path (live=False) is an internal bug — mock
    # mode makes no external calls, so calling it a "provider error" would
    # be false. Distinct wording from the live-failure case above.
    monkeypatch.setattr(mcp_server.settings, "MCP_LIVE_DEMO_ENABLED", False)

    async def failing_mock_workflow(topic, audience, tone, post_goal, *, live):
        assert live is False
        raise RuntimeError("mock generator bug")

    monkeypatch.setattr(mcp_server, "run_cs02_workflow", failing_mock_workflow)

    body = _call_tool(
        client,
        "create_researched_post",
        {"topic": "A topic that triggers a mock-mode failure"},
        ip="4.4.4.5",
    )
    result = body["result"]
    assert result["isError"] is True
    text = result["content"][0]["text"]
    assert "mock generator bug" not in text  # no raw internals leaked
    assert "provider" not in text
    assert "live workflow" not in text
    assert "internal error" in text


def test_live_mode_fully_disableable_via_settings(client: TestClient, monkeypatch):
    monkeypatch.setattr(mcp_server.settings, "MCP_LIVE_DEMO_ENABLED", False)

    async def fake_workflow(topic, audience, tone, post_goal, *, live, use_web_context=False):
        assert live is False
        return _mock_shaped_result(topic)

    monkeypatch.setattr(mcp_server, "run_cs02_workflow", fake_workflow)

    body = _call_tool(
        client, "create_researched_post", {"topic": "Disabled live mode topic"}, ip="5.5.5.5"
    )
    execution = body["result"]["structuredContent"]["execution"]
    assert execution["mode"] == "mock"
    assert execution["fallbackReason"] == "live_mode_disabled"


# ─── get_demo_status — read-only ───────────────────────────────────────────


def test_get_demo_status_reports_quota_without_consuming_it(client: TestClient):
    ip = "6.6.6.6"
    first = _call_tool(client, "get_demo_status", {}, ip=ip, id_=1)
    second = _call_tool(client, "get_demo_status", {}, ip=ip, id_=2)

    for body in (first, second):
        status = body["result"]["structuredContent"]
        assert status["liveEnabled"] is True
        assert status["liveCallLimit"] == 2
        assert status["remainingLiveCalls"] == 2
        assert status["fallbackMode"] == "mock"


def test_get_demo_status_reflects_disabled_live_mode(client: TestClient, monkeypatch):
    monkeypatch.setattr(mcp_server.settings, "MCP_LIVE_DEMO_ENABLED", False)

    body = _call_tool(client, "get_demo_status", {}, ip="6.6.6.7")
    status = body["result"]["structuredContent"]
    assert status["liveEnabled"] is False
    assert status["remainingLiveCalls"] == 0


# ─── LiveQuota — concurrency ────────────────────────────────────────────────


def test_live_quota_reservations_are_concurrency_safe():
    quota = LiveQuota(limit=3, window_seconds=999_999)

    async def _run():
        results = await asyncio.gather(*(quota.try_reserve("shared-ip") for _ in range(20)))
        return results

    results = asyncio.run(_run())
    assert sum(1 for r in results if r) == 3
    assert sum(1 for r in results if not r) == 17


def test_live_quota_remaining_does_not_consume():
    quota = LiveQuota(limit=2, window_seconds=999_999)

    async def _run():
        before = await quota.remaining("ip")
        after_checks = [await quota.remaining("ip") for _ in range(5)]
        return before, after_checks

    before, after_checks = asyncio.run(_run())
    assert before == 2
    assert all(v == 2 for v in after_checks)


def test_live_quota_prunes_expired_entries():
    quota = LiveQuota(limit=1, window_seconds=0.01)

    async def _run():
        first = await quota.try_reserve("ip")
        await asyncio.sleep(0.05)
        second = await quota.try_reserve("ip")  # first entry expired by now
        return first, second

    first, second = asyncio.run(_run())
    assert first is True
    assert second is True
    assert "ip" not in quota._hits or len(quota._hits["ip"]) == 1


def test_live_quota_sweeps_idle_ips_over_time():
    # An IP that reserves once and never comes back must not sit in _hits
    # forever — only the occasional full sweep catches it, since _prune
    # only ever touches the IP being looked up right now.
    quota = LiveQuota(limit=5, window_seconds=0.01, sweep_probability=1.0)

    async def _run():
        await quota.try_reserve("idle-ip")
        await asyncio.sleep(0.05)  # let idle-ip's window fully expire
        await quota.try_reserve("active-ip")  # sweep_probability=1.0 triggers a sweep here

    asyncio.run(_run())

    assert "idle-ip" not in quota._hits
    assert "active-ip" in quota._hits


# ─── Rate limit middleware (unchanged, general /mcp protocol limit) ───────


def test_rate_limit_middleware_blocks_after_max_requests():
    from starlette.applications import Starlette
    from starlette.requests import Request
    from starlette.responses import JSONResponse
    from starlette.routing import Route
    from starlette.testclient import TestClient as StarletteTestClient

    async def ok(_request: Request):
        return JSONResponse({"ok": True})

    inner = Starlette(routes=[Route("/", ok)])
    inner.add_middleware(_McpRateLimitMiddleware, max_requests=3, window_seconds=60)
    tc = StarletteTestClient(inner)

    for _ in range(3):
        assert tc.get("/", headers={"X-Forwarded-For": "9.9.9.9"}).status_code == 200

    blocked = tc.get("/", headers={"X-Forwarded-For": "9.9.9.9"})
    assert blocked.status_code == 429

    # A different peer has its own bucket and is unaffected.
    fresh = tc.get("/", headers={"X-Forwarded-For": "4.4.4.4"})
    assert fresh.status_code == 200


def test_sweep_idle_ips_removes_expired_entries_only():
    mw = _McpRateLimitMiddleware(app=None, window_seconds=60.0)  # type: ignore[arg-type]
    mw._hits["idle"].append(0.0)
    mw._hits["active"].append(100.0)

    mw._sweep_idle_ips(now=100.0)

    assert "idle" not in mw._hits
    assert "active" in mw._hits


def test_rate_limit_middleware_sweeps_idle_ips_over_time():
    # Pruning inside __call__ only ever touches the current requester's own
    # entry (about to get a fresh hit appended anyway), so it alone can
    # never shrink self._hits — only the occasional full sweep does. Uses
    # sweep_probability=1.0 to make the sweep deterministic here.
    import time as time_module

    async def ok_app(_scope, _receive, send):
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b"ok"})

    mw = _McpRateLimitMiddleware(
        ok_app, max_requests=30, window_seconds=0.01, sweep_probability=1.0
    )

    async def _request(ip: str) -> None:
        scope = {"type": "http", "headers": [(b"x-forwarded-for", ip.encode())]}

        async def receive():
            return {"type": "http.request", "body": b"", "more_body": False}

        async def send(_message):
            pass

        await mw(scope, receive, send)

    asyncio.run(_request("1.1.1.1"))
    assert "1.1.1.1" in mw._hits

    time_module.sleep(0.05)  # let 1.1.1.1's window fully expire

    asyncio.run(_request("2.2.2.2"))  # sweep_probability=1.0 triggers a sweep here

    assert "1.1.1.1" not in mw._hits
    assert "2.2.2.2" in mw._hits
