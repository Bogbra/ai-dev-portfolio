"""
Regression tests proving upstream OpenAI error text never reaches the
client from /voice/agent — only a generic message does, with the real
detail going to the server-side logger instead.
"""

from __future__ import annotations

import base64

from fastapi.testclient import TestClient

import routes.voice as voice

_SECRET_DETAIL = "upstream said: api_key=sk-should-never-leak-123 rejected"


class _FakeTranscriptions:
    def __init__(self, *, fail: bool):
        self._fail = fail

    async def create(self, **_kwargs):
        if self._fail:
            raise RuntimeError(_SECRET_DETAIL)

        class _Transcription:
            text = "hello there"
            language = "english"

        return _Transcription()


class _FakeAudio:
    def __init__(self, *, fail_transcription: bool):
        self.transcriptions = _FakeTranscriptions(fail=fail_transcription)


class _FakeClient:
    def __init__(self, *, fail_transcription: bool = False):
        self.audio = _FakeAudio(fail_transcription=fail_transcription)


def _voice_payload() -> dict:
    return {
        "audio_b64": base64.b64encode(b"fake audio bytes").decode(),
        "filename": "recording.webm",
        "duration_seconds": 3.0,
    }


def test_transcription_failure_does_not_leak_upstream_error_text(client: TestClient, monkeypatch):
    monkeypatch.setattr(voice.settings, "VOICE_OPENAI_API_KEY", "sk-test")
    monkeypatch.setattr(
        voice, "make_openai_client", lambda *a, **k: _FakeClient(fail_transcription=True)
    )

    res = client.post("/voice/agent", json=_voice_payload())

    assert res.status_code == 502
    body = res.json()
    assert body["message"] == "Transcription failed. Please try again."
    assert _SECRET_DETAIL not in res.text


def test_response_generation_failure_does_not_leak_upstream_error_text(
    client: TestClient, monkeypatch
):
    monkeypatch.setattr(voice.settings, "VOICE_OPENAI_API_KEY", "sk-test")
    monkeypatch.setattr(voice, "make_openai_client", lambda *a, **k: _FakeClient())

    async def _fake_classify_intent(_client, _transcript):
        return ("general_question", "safe", 0.9, "no_action", False, None)

    async def _fake_generate_response(_client, _transcript, _tool_context, _language):
        raise RuntimeError(_SECRET_DETAIL)

    monkeypatch.setattr(voice, "_classify_intent", _fake_classify_intent)
    monkeypatch.setattr(voice, "_generate_response", _fake_generate_response)

    res = client.post("/voice/agent", json=_voice_payload())

    assert res.status_code == 502
    body = res.json()
    assert body["message"] == "Response generation failed. Please try again."
    assert _SECRET_DETAIL not in res.text
