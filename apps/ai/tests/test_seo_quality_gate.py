"""Tests for _run_live's quality gate in routes/seo.py — the corrected
result was never re-validated, and a failed correction call silently
returned the original flawed result via `except Exception: pass` with
`warnings` always empty. These assert that whatever issues survive the one
correction attempt (or the original issues, if the correction call itself
fails) end up in the reported `warnings`, instead of being hidden.
"""

import asyncio

import routes.seo as seo


def _stub_step1(*args, **kwargs) -> dict:
    return {
        "summary": "A business summary.",
        "extracted_business_context": {},
        "keyword_candidates": [],
        "intent_clusters": [],
    }


def _stub_step2(*args, **kwargs) -> dict:
    return {
        "reranked_opportunities": [],
        "content_ideas": [],
        "lead_generation_angles": [],
        "roadmap": [],
    }


def _patch_common(monkeypatch):
    monkeypatch.setattr(seo, "_fetch_web_context", lambda *a, **kw: _async_result(""))
    monkeypatch.setattr(
        seo, "_step1_extract_and_generate", lambda *a, **kw: _async_result(_stub_step1())
    )
    monkeypatch.setattr(
        seo, "_step2_rerank_and_plan", lambda *a, **kw: _async_result(_stub_step2())
    )
    # _run_live does `from openai_client import make_openai_client` locally
    # inside the function body — patching the source module's attribute is
    # what a fresh local import will actually pick up.
    monkeypatch.setattr("openai_client.make_openai_client", lambda *a, **kw: object())


async def _async_result(value):
    return value


def test_warnings_empty_when_no_quality_issues_found(monkeypatch):
    _patch_common(monkeypatch)
    result = asyncio.run(seo._run_live("a topic", "", "us", "traffic", ""))
    assert result["warnings"] == []


def test_warnings_report_issues_remaining_after_correction(monkeypatch):
    _patch_common(monkeypatch)

    # step2 output mentions an outdated year — triggers outdated_year_terms.
    monkeypatch.setattr(
        seo,
        "_step2_rerank_and_plan",
        lambda *a, **kw: _async_result(
            {**_stub_step2(), "content_ideas": ["Best practices for 2024"]}
        ),
    )

    # The correction pass runs but doesn't actually fix the flagged issue —
    # a real possible outcome, not just a failure mode.
    async def fake_correction_pass(client, result, issues, market, goal):
        return {**result, "content_ideas": ["Best practices for 2024, still unfixed"]}

    monkeypatch.setattr(seo, "_correction_pass", fake_correction_pass)

    result = asyncio.run(seo._run_live("a topic", "", "us", "traffic", ""))

    assert "outdated_year_terms" in result["warnings"]


def test_warnings_empty_when_correction_fully_resolves_issues(monkeypatch):
    _patch_common(monkeypatch)

    monkeypatch.setattr(
        seo,
        "_step2_rerank_and_plan",
        lambda *a, **kw: _async_result(
            {**_stub_step2(), "content_ideas": ["Best practices for 2024"]}
        ),
    )

    async def fake_correction_pass(client, result, issues, market, goal):
        return {**result, "content_ideas": ["Evergreen best practices"]}

    monkeypatch.setattr(seo, "_correction_pass", fake_correction_pass)

    result = asyncio.run(seo._run_live("a topic", "", "us", "traffic", ""))

    assert result["warnings"] == []


def test_run_live_constructs_client_with_longer_timeout_and_zero_retries(monkeypatch):
    # step2 (max_tokens=3600) and the correction pass (max_tokens=4000)
    # measured at ~40-42s each against the real API — over the shared 30s
    # default, which was cutting off legitimately-completing calls, not
    # just genuinely stuck ones. This asserts the live client is actually
    # built with the longer timeout and retries disabled, not just
    # documented as such.
    _patch_common(monkeypatch)

    calls: list[dict] = []

    def spy_make_client(*args, **kwargs):
        calls.append(kwargs)
        return object()

    monkeypatch.setattr("openai_client.make_openai_client", spy_make_client)

    asyncio.run(seo._run_live("a topic", "", "us", "traffic", ""))

    assert calls, "make_openai_client was never called"
    assert calls[0].get("max_retries") == 0
    assert calls[0].get("timeout") == 75.0


def test_warnings_report_original_issues_when_correction_call_fails(monkeypatch):
    _patch_common(monkeypatch)

    monkeypatch.setattr(
        seo,
        "_step2_rerank_and_plan",
        lambda *a, **kw: _async_result(
            {**_stub_step2(), "content_ideas": ["Best practices for 2024"]}
        ),
    )

    async def failing_correction_pass(*a, **kw):
        raise RuntimeError("provider error")

    monkeypatch.setattr(seo, "_correction_pass", failing_correction_pass)

    result = asyncio.run(seo._run_live("a topic", "", "us", "traffic", ""))

    # The correction call itself failed — the original result (and its
    # unaddressed issue) is what's returned, and that must be visible in
    # warnings rather than silently swallowed.
    assert "outdated_year_terms" in result["warnings"]
    assert "2024" in str(result["content_ideas"])
