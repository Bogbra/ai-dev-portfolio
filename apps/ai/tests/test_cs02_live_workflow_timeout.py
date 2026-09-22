"""run_cs02_workflow's live path (researcher -> writer -> critic -> optional
reviser -> groundedness, up to 5 sequential calls) had a per-node timeout
but nothing bounding the sequence as a whole. It's now wrapped in
asyncio.timeout(_LIVE_WORKFLOW_TIMEOUT_SECONDS) — these confirm a stuck
live run actually times out instead of hanging indefinitely, and that a
normal run under the budget is unaffected.
"""

import asyncio

import pytest

import routes.cs02_post as cs02_post


def _patch_client(monkeypatch):
    monkeypatch.setattr("openai_client.make_openai_client", lambda *a, **kw: object())


def test_live_workflow_raises_timeout_error_when_it_exceeds_the_budget(monkeypatch):
    _patch_client(monkeypatch)
    monkeypatch.setattr(cs02_post, "_LIVE_WORKFLOW_TIMEOUT_SECONDS", 0.05)

    async def _stuck_workflow(*args, **kwargs):
        await asyncio.sleep(10)
        return {"status": "final_ready"}

    monkeypatch.setattr(cs02_post, "_run_live_workflow", _stuck_workflow)

    with pytest.raises(TimeoutError):
        asyncio.run(
            cs02_post.run_cs02_workflow("a topic", "an audience", "clear", "explain", live=True)
        )


def test_live_workflow_completes_normally_within_the_budget(monkeypatch):
    _patch_client(monkeypatch)
    monkeypatch.setattr(cs02_post, "_LIVE_WORKFLOW_TIMEOUT_SECONDS", 5)

    async def _fast_workflow(*args, **kwargs):
        return {"status": "final_ready", "finalPost": {"fullPost": "done"}}

    monkeypatch.setattr(cs02_post, "_run_live_workflow", _fast_workflow)

    result = asyncio.run(
        cs02_post.run_cs02_workflow("a topic", "an audience", "clear", "explain", live=True)
    )
    assert result["status"] == "final_ready"
