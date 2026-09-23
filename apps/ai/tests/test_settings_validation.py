"""settings.py used to leave every numeric limit/timeout/quota field
unconstrained (any int/float accepted, including 0 or negative), and only
parsed TRUSTED_PROXY_CIDRS lazily on the first request that needed a
client-IP trust decision — so a bad deployment value surfaced as a runtime
exception mid-request rather than a clean startup failure. These prove the
now-added bounds and eager CIDR validation actually fail construction.
"""

import pytest
from pydantic import ValidationError

from settings import Settings


def test_settings_construct_with_defaults():
    s = Settings()
    assert s.PORT == 4000
    assert s.MAX_UPLOAD_SIZE_BYTES > 0


@pytest.mark.parametrize(
    "field, value",
    [
        ("PORT", 0),
        ("PORT", 70000),
        ("OPENAI_TIMEOUT_SECONDS", 0),
        ("OPENAI_TIMEOUT_SECONDS", -1.0),
        ("OPENAI_MAX_RETRIES", -1),
        ("MAX_UPLOAD_SIZE_BYTES", 0),
        ("MAX_UPLOAD_ROWS", -5),
        ("MAX_REQUEST_LENGTH", 0),
        ("MAX_TOPIC_LENGTH", 0),
        ("MAX_UPLOAD_MB", 0),
        ("MAX_TOTAL_UPLOAD_MB", 0),
        ("MAX_PDFS", 0),
        ("MAX_CHUNKS", 0),
        ("MAX_QUESTIONS_PER_HOUR", 0),
        ("VOICE_MAX_REQUESTS_PER_HOUR", 0),
        ("VOICE_MAX_REQUESTS_PER_DAY", 0),
        ("SEO_MAX_REQUESTS_PER_HOUR", 0),
        ("SEO_MAX_REQUESTS_PER_DAY", 0),
        ("MCP_LIVE_CALL_LIMIT", -1),
        ("MCP_LIVE_QUOTA_WINDOW_SECONDS", 0),
    ],
)
def test_settings_rejects_out_of_range_values(field, value):
    with pytest.raises(ValidationError):
        Settings(**{field: value})


def test_settings_accepts_zero_live_call_limit():
    # 0 is meaningful: live calls always fall back to mock.
    s = Settings(MCP_LIVE_CALL_LIMIT=0)
    assert s.MCP_LIVE_CALL_LIMIT == 0


def test_settings_accepts_zero_retries():
    s = Settings(OPENAI_MAX_RETRIES=0)
    assert s.OPENAI_MAX_RETRIES == 0


def test_settings_rejects_malformed_trusted_proxy_cidr_at_construction():
    with pytest.raises(ValidationError):
        Settings(TRUSTED_PROXY_CIDRS="not-a-cidr")


def test_settings_rejects_one_malformed_entry_among_valid_ones():
    with pytest.raises(ValidationError):
        Settings(TRUSTED_PROXY_CIDRS="100.0.0.0/8,also-not-a-cidr")


def test_settings_accepts_valid_multi_entry_trusted_proxy_cidrs():
    s = Settings(TRUSTED_PROXY_CIDRS="100.0.0.0/8, 10.0.0.0/8")
    networks = s.get_trusted_proxy_networks()
    assert len(networks) == 2
