"""
Unit tests for openai_client.make_openai_client — the shared factory that
puts a bounded timeout and retry count on every AsyncOpenAI client in this
service (SDK defaults are unbounded timeout, 2 retries).
"""

from __future__ import annotations

from openai_client import make_openai_client
from settings import settings


def test_default_client_uses_configured_timeout_and_retries():
    client = make_openai_client("sk-test", None)
    assert client.timeout == settings.OPENAI_TIMEOUT_SECONDS
    assert client.max_retries == settings.OPENAI_MAX_RETRIES


def test_voice_client_uses_longer_timeout():
    client = make_openai_client("sk-test", "https://api.openai.com/v1", voice=True)
    assert client.timeout == settings.OPENAI_VOICE_TIMEOUT_SECONDS
    assert client.timeout > settings.OPENAI_TIMEOUT_SECONDS


def test_base_url_is_passed_through():
    client = make_openai_client("sk-test", "https://proxy.example.com/v1")
    assert str(client.base_url) == "https://proxy.example.com/v1/"


def test_max_retries_override_takes_precedence_over_configured_default():
    client = make_openai_client("sk-test", None, max_retries=0)
    assert client.max_retries == 0
    # The override is per-call, not global — the shared default must be
    # unaffected by a caller that opts out of retries for its own client.
    assert settings.OPENAI_MAX_RETRIES != 0


def test_max_retries_none_falls_back_to_configured_default():
    client = make_openai_client("sk-test", None, max_retries=None)
    assert client.max_retries == settings.OPENAI_MAX_RETRIES


def test_timeout_override_takes_precedence_over_configured_default():
    client = make_openai_client("sk-test", None, timeout=75.0)
    assert client.timeout == 75.0
    assert settings.OPENAI_TIMEOUT_SECONDS != 75.0


def test_timeout_none_falls_back_to_configured_default():
    client = make_openai_client("sk-test", None, timeout=None)
    assert client.timeout == settings.OPENAI_TIMEOUT_SECONDS


def test_timeout_override_takes_precedence_over_voice_default():
    # An explicit timeout is a stronger signal than voice=True's own
    # longer-default behavior — a caller passing both should get exactly
    # what it asked for, not the voice fallback.
    client = make_openai_client("sk-test", None, voice=True, timeout=75.0)
    assert client.timeout == 75.0


def test_empty_string_base_url_falls_back_to_openai_default():
    # .env.example documents leaving OPENAI_BASE_URL blank to mean "use the
    # default", but pydantic-settings parses a blank line as "" rather than
    # None — AsyncOpenAI(base_url="") does NOT fall back to api.openai.com,
    # it sets base_url to the literal empty string and every request then
    # fails with "Request URL is missing an 'http://' or 'https://'
    # protocol." (confirmed against a real OpenAI call before this was
    # fixed). "" must resolve exactly like None does.
    client = make_openai_client("sk-test", "")
    assert str(client.base_url) == "https://api.openai.com/v1/"
