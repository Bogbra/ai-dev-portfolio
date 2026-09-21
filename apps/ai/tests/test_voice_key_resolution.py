"""_resolve_voice_api_key must never fall back to a proxy-scoped
OPENAI_API_KEY when OPENAI_BASE_URL points somewhere other than the real
OpenAI API — Whisper/TTS calls are hardcoded to api.openai.com, so a key
issued only for a third-party proxy would otherwise be sent to a host it
was never meant for. Regression coverage for a prior substring check
("api.openai.com" in base_url) that a hostname like
api.openai.com.evil.example would have satisfied.
"""

import routes.voice as voice


def _reset(monkeypatch, *, voice_key=None, openai_key=None, base_url=None):
    monkeypatch.setattr(voice.settings, "VOICE_OPENAI_API_KEY", voice_key)
    monkeypatch.setattr(voice.settings, "OPENAI_API_KEY", openai_key)
    monkeypatch.setattr(voice.settings, "OPENAI_BASE_URL", base_url)


def test_uses_voice_key_when_set(monkeypatch):
    _reset(
        monkeypatch,
        voice_key="sk-voice",
        openai_key="sk-proxy",
        base_url="https://proxy.example/v1",
    )
    assert voice._resolve_voice_api_key() == "sk-voice"


def test_falls_back_to_openai_key_when_base_url_unset(monkeypatch):
    _reset(monkeypatch, openai_key="sk-real", base_url=None)
    assert voice._resolve_voice_api_key() == "sk-real"


def test_falls_back_to_openai_key_when_base_url_is_real_openai(monkeypatch):
    _reset(monkeypatch, openai_key="sk-real", base_url="https://api.openai.com/v1")
    assert voice._resolve_voice_api_key() == "sk-real"


def test_refuses_proxy_scoped_key_for_third_party_base_url(monkeypatch):
    _reset(monkeypatch, openai_key="sk-proxy", base_url="https://proxy.example/v1")
    assert voice._resolve_voice_api_key() is None


def test_refuses_lookalike_hostname_that_merely_contains_the_real_one(monkeypatch):
    # A prior substring check ("api.openai.com" in base_url) would have
    # accepted this — the real fix is an exact hostname comparison.
    _reset(monkeypatch, openai_key="sk-proxy", base_url="https://api.openai.com.evil.example/v1")
    assert voice._resolve_voice_api_key() is None


def test_no_key_at_all_returns_none(monkeypatch):
    _reset(monkeypatch)
    assert voice._resolve_voice_api_key() is None
