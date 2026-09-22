"""/ai-workflow/run used to fetch Tavily web context whenever useWebContext
and TAVILY_API_KEY were set, checked independently of OPENAI_API_KEY — a
deployment with a Tavily key but no OpenAI key still made a real, billable
third-party call whose result then went straight into _mock_workflow, which
never reads it at all. That also contradicted both this route's mock-mode
contract and the privacy policy's "fully local, no third-party
transmission" claim for when no OpenAI key is configured. Regression
coverage for the fix: Tavily is now only ever called on the live path.
"""

import routes.cs01_workflow as cs01_workflow


def _payload(**overrides):
    payload = {
        "contacts": [{"id": "1", "name": "Alice Example", "email": "alice@example.com"}],
        "request": "Follow up about the quarterly budget review",
        "confirmedContactId": "1",
        "useWebContext": True,
    }
    payload.update(overrides)
    return payload


def test_tavily_is_not_called_when_openai_key_is_unset_even_with_web_context_requested(
    client, monkeypatch
):
    monkeypatch.setattr(cs01_workflow.settings, "OPENAI_API_KEY", None)
    monkeypatch.setattr(cs01_workflow.settings, "TAVILY_API_KEY", "tvly-test")

    def _fail_if_called(*args, **kwargs):
        raise AssertionError("_fetch_web_context must not be called when OPENAI_API_KEY is unset")

    monkeypatch.setattr(cs01_workflow, "_fetch_web_context", _fail_if_called)

    res = client.post("/ai-workflow/run", json=_payload())

    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "draft_ready"
    # _mock_workflow's confirmed-contact path — the only way to get this
    # exact reasoning string is via the mock path, not a live OpenAI call.
    assert "demo mode" in body["reasoning"].lower()


def test_tavily_is_called_when_both_openai_and_tavily_keys_are_set(client, monkeypatch):
    monkeypatch.setattr(cs01_workflow.settings, "OPENAI_API_KEY", "sk-test")
    monkeypatch.setattr(cs01_workflow.settings, "TAVILY_API_KEY", "tvly-test")

    calls: list[str] = []

    async def _fake_fetch(_api_key: str, request_text: str):
        calls.append(request_text)
        return None

    monkeypatch.setattr(cs01_workflow, "_fetch_web_context", _fake_fetch)
    monkeypatch.setattr(cs01_workflow, "make_openai_client", lambda *a, **kw: object())

    async def _fake_run_workflow(*args, **kwargs):
        return {"status": "not_found", "reason": "stubbed"}

    monkeypatch.setattr(cs01_workflow, "_run_workflow", _fake_run_workflow)

    res = client.post("/ai-workflow/run", json=_payload())

    assert res.status_code == 200
    assert calls, "_fetch_web_context should have been called on the live path"
