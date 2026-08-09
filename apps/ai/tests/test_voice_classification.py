"""
Tests for _classify_intent's enum validation and the /voice/agent route's
fail-closed handling when classification itself fails.
"""

from __future__ import annotations

import base64
import json
from unittest.mock import AsyncMock, MagicMock

from fastapi.testclient import TestClient

import routes.voice as voice
from routes.voice import _classify_intent

# ─── _classify_intent enum validation ──────────────────────────────────────


def _fake_classification_client(raw_json: dict | str) -> MagicMock:
    client = MagicMock()
    content = raw_json if isinstance(raw_json, str) else json.dumps(raw_json)
    completion = MagicMock()
    completion.choices = [MagicMock(message=MagicMock(content=content))]
    client.chat.completions.create = AsyncMock(return_value=completion)
    return client


def _run_classify(raw_json: dict | str):
    import asyncio

    client = _fake_classification_client(raw_json)
    return asyncio.run(_classify_intent(client, "some transcript"))


def test_classify_intent_accepts_valid_values():
    intent, safety_state, confidence, tool, handoff, _lang = _run_classify(
        {
            "intent": "contact_request",
            "safety_state": "safe",
            "confidence": 0.8,
            "tool": "get_contact_options",
            "handoff_required": False,
            "language": "en",
        }
    )
    assert intent == "contact_request"
    assert safety_state == "safe"
    assert tool == "get_contact_options"
    assert confidence == 0.8


def test_classify_intent_falls_back_on_invalid_intent():
    intent, *_ = _run_classify({"intent": "delete_all_data", "safety_state": "safe"})
    assert intent == "unclear_request"


def test_classify_intent_falls_back_on_invalid_safety_state():
    _intent, safety_state, *_ = _run_classify(
        {"intent": "general_question", "safety_state": "totally_fine_trust_me"}
    )
    assert safety_state == "unclear"


def test_classify_intent_falls_back_on_invalid_tool():
    *_, tool, _handoff, _lang = _run_classify(
        {"intent": "tool_request", "safety_state": "safe", "tool": "delete_database"}
    )
    assert tool == "no_action"


def test_classify_intent_clamps_confidence_above_one():
    _intent, _safety, confidence, *_ = _run_classify(
        {"intent": "general_question", "safety_state": "safe", "confidence": 5.0}
    )
    assert confidence == 1.0


def test_classify_intent_clamps_confidence_below_zero():
    _intent, _safety, confidence, *_ = _run_classify(
        {"intent": "general_question", "safety_state": "safe", "confidence": -3.0}
    )
    assert confidence == 0.0


def test_classify_intent_handles_non_numeric_confidence():
    _intent, _safety, confidence, *_ = _run_classify(
        {"intent": "general_question", "safety_state": "safe", "confidence": "very high"}
    )
    assert confidence == 0.5


def test_classify_intent_handles_malformed_json():
    intent, safety_state, confidence, tool, *_ = _run_classify("not valid json at all")
    assert intent == "unclear_request"
    assert safety_state == "unclear"
    assert tool == "no_action"
    assert confidence == 0.5


# ─── Route: fail-closed when classification raises ─────────────────────────


class _FakeTranscription:
    text = "What projects have you built?"
    language = "english"


class _FakeSpeechResponse:
    content = b"fake-tts-audio-bytes"


class _FakeAudio:
    def __init__(self) -> None:
        self.transcriptions = MagicMock()
        self.transcriptions.create = AsyncMock(return_value=_FakeTranscription())
        self.speech = MagicMock()
        self.speech.create = AsyncMock(return_value=_FakeSpeechResponse())


class _FakeClient:
    def __init__(self) -> None:
        self.audio = _FakeAudio()


def _voice_payload() -> dict:
    return {
        "audio_b64": base64.b64encode(b"fake audio bytes").decode(),
        "filename": "recording.webm",
        "duration_seconds": 3.0,
    }


def test_voice_agent_fails_closed_when_classification_raises(client: TestClient, monkeypatch):
    monkeypatch.setattr(voice.settings, "VOICE_OPENAI_API_KEY", "sk-test")
    monkeypatch.setattr(voice, "make_openai_client", lambda *a, **k: _FakeClient())

    async def _broken_classify(_client, _transcript):
        raise RuntimeError("classifier upstream error")

    generate_response_called = False

    async def _spy_generate_response(_client, _transcript, _tool_context, _language):
        nonlocal generate_response_called
        generate_response_called = True
        return "should never be reached"

    monkeypatch.setattr(voice, "_classify_intent", _broken_classify)
    monkeypatch.setattr(voice, "_generate_response", _spy_generate_response)

    res = client.post("/voice/agent", json=_voice_payload())

    assert res.status_code == 200
    body = res.json()
    # Fails closed: refusal text, not a normal LLM response, and the LLM
    # response path is never even reached.
    assert generate_response_called is False
    assert body["response_text"] in (voice._REFUSAL_EN, voice._REFUSAL_DE)
    assert body["latency_breakdown"]["llm_ms"] == 0
