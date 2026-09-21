"""_run_live must not call Tavily unless the caller opted in via
useWebContext — before this, the SEO lab sent the business description to
Tavily automatically whenever TAVILY_API_KEY was configured server-side,
with no UI opt-in (unlike CS01/CS02, which gate the same call on
useWebContext). These confirm the opt-out actually skips the network call,
not just discards its result.
"""

import asyncio

import routes.seo as seo


def _stub_step1(*args, **kwargs) -> dict:
    return {
        "summary": "A business summary.",
        "extracted_business_context": {},
        "keyword_candidates": [
            {"term": "workflow automation", "type": "seed", "intent": "informational"}
        ],
        "intent_clusters": [],
    }


def _stub_step2(*args, **kwargs) -> dict:
    return {
        "reranked_opportunities": [
            {
                "rank": 1,
                "term": "workflow automation",
                "opportunity_score": 80,
                "why_ranked_here": "Matches the target audience closely and shows strong service-intent signal for lead generation.",
            }
        ],
        "content_ideas": [],
        "lead_generation_angles": [],
        "roadmap": [],
    }


async def _async_result(value):
    return value


def _patch_common(monkeypatch):
    monkeypatch.setattr(
        seo, "_step1_extract_and_generate", lambda *a, **kw: _async_result(_stub_step1())
    )
    monkeypatch.setattr(
        seo, "_step2_rerank_and_plan", lambda *a, **kw: _async_result(_stub_step2())
    )
    monkeypatch.setattr("openai_client.make_openai_client", lambda *a, **kw: object())


def test_web_context_not_fetched_when_opted_out(monkeypatch):
    _patch_common(monkeypatch)

    def _fail_if_called(*args, **kwargs):
        raise AssertionError("_fetch_web_context must not be called when use_web_context=False")

    monkeypatch.setattr(seo, "_fetch_web_context", _fail_if_called)

    result = asyncio.run(seo._run_live("a topic", "", "us", "traffic", "", use_web_context=False))
    assert result["metadata"]["used_web_context"] is False


def test_web_context_fetched_when_opted_in(monkeypatch):
    _patch_common(monkeypatch)
    monkeypatch.setattr(seo, "_fetch_web_context", lambda *a, **kw: _async_result("some context"))

    result = asyncio.run(seo._run_live("a topic", "", "us", "traffic", "", use_web_context=True))
    assert result["metadata"]["used_web_context"] is True
