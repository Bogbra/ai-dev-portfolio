"""
Unit tests for client_ip.get_client_ip — the shared slowapi key_func.

Earlier versions trusted X-Real-IP / X-Forwarded-For purely on presence,
with no check on who actually sent them — a client with direct network
access to this service could set either header itself and have it
accepted outright. These now cover the trust boundary added to close that:
proxy headers are honored only when the immediate TCP peer (not
attacker-settable) falls inside Railway's known edge range (100.0.0.0/8,
mirroring apps/api's Fastify trustProxy config) — an untrusted peer's
headers are ignored entirely, socket peer used instead.
"""

from __future__ import annotations

from starlette.requests import Request

from client_ip import get_client_ip
from settings import settings

_TRUSTED_PEER = "100.64.0.1"  # inside 100.0.0.0/8 — stand-in for Railway's edge
_UNTRUSTED_PEER = "10.0.0.5"  # outside the trusted range — a direct connection


def _make_request(
    headers: dict[str, str], client: tuple[str, int] | None = (_TRUSTED_PEER, 12345)
) -> Request:
    scope = {
        "type": "http",
        "headers": [(key.lower().encode(), value.encode()) for key, value in headers.items()],
        "client": client,
    }
    return Request(scope)


# ─── Trusted peer (Railway's edge) — headers are honored ──────────────────────


def test_trusted_peer_uses_rightmost_xff_entry_ignoring_spoofed_leftmost():
    request = _make_request({"x-forwarded-for": "1.2.3.4, 9.9.9.9"})
    assert get_client_ip(request) == "9.9.9.9"


def test_trusted_peer_different_spoofed_leftmost_entries_resolve_to_same_real_client():
    real_client = "9.9.9.9"
    a = _make_request({"x-forwarded-for": f"1.2.3.4, {real_client}"})
    b = _make_request({"x-forwarded-for": f"5.6.7.8, {real_client}"})
    assert get_client_ip(a) == get_client_ip(b) == real_client


def test_trusted_peer_single_xff_entry_is_used_directly():
    request = _make_request({"x-forwarded-for": "203.0.113.9"})
    assert get_client_ip(request) == "203.0.113.9"


def test_trusted_peer_trims_whitespace_around_xff_entries():
    request = _make_request({"x-forwarded-for": " 1.2.3.4 ,  9.9.9.9  "})
    assert get_client_ip(request) == "9.9.9.9"


def test_trusted_peer_x_real_ip_takes_priority_over_x_forwarded_for():
    request = _make_request({"x-real-ip": "7.7.7.7", "x-forwarded-for": "1.2.3.4, 9.9.9.9"})
    assert get_client_ip(request) == "7.7.7.7"


def test_trusted_peer_empty_x_real_ip_header_falls_through_to_xff():
    request = _make_request({"x-real-ip": "", "x-forwarded-for": "1.2.3.4, 9.9.9.9"})
    assert get_client_ip(request) == "9.9.9.9"


def test_trusted_peer_with_no_headers_falls_back_to_its_own_address():
    request = _make_request({})
    assert get_client_ip(request) == _TRUSTED_PEER


# ─── Untrusted peer (direct connection) — headers are ignored ─────────────────


def test_untrusted_peer_forged_x_real_ip_is_ignored():
    request = _make_request({"x-real-ip": "7.7.7.7"}, client=(_UNTRUSTED_PEER, 5000))
    assert get_client_ip(request) == _UNTRUSTED_PEER


def test_untrusted_peer_forged_x_forwarded_for_is_ignored():
    request = _make_request({"x-forwarded-for": "1.2.3.4, 9.9.9.9"}, client=(_UNTRUSTED_PEER, 5000))
    assert get_client_ip(request) == _UNTRUSTED_PEER


def test_untrusted_peer_cannot_collapse_into_another_visitors_bucket_by_spoofing_headers():
    # Without the trust check, two different real visitors sending the same
    # forged X-Forwarded-For would share a rate-limit bucket. With it, each
    # resolves to its own untrusted socket peer instead.
    a = _make_request({"x-forwarded-for": "9.9.9.9"}, client=("10.0.0.5", 1))
    b = _make_request({"x-forwarded-for": "9.9.9.9"}, client=("10.0.0.6", 1))
    assert get_client_ip(a) != get_client_ip(b)
    assert get_client_ip(a) == "10.0.0.5"
    assert get_client_ip(b) == "10.0.0.6"


def test_falls_back_to_socket_peer_when_no_proxy_headers_present():
    request = _make_request({}, client=("192.168.1.50", 5000))
    assert get_client_ip(request) == "192.168.1.50"


def test_falls_back_to_localhost_when_nothing_is_available():
    request = _make_request({}, client=None)
    assert get_client_ip(request) == "127.0.0.1"


# ─── TRUSTED_PROXY_CIDRS is configurable, not hardcoded ────────────────────────


def test_trusted_range_is_read_from_settings_not_hardcoded(monkeypatch):
    monkeypatch.setattr(settings, "TRUSTED_PROXY_CIDRS", "203.0.113.0/24")

    # The usual "trusted" peer no longer qualifies under the new config.
    request = _make_request({"x-forwarded-for": "9.9.9.9"}, client=(_TRUSTED_PEER, 1))
    assert get_client_ip(request) == _TRUSTED_PEER

    # A peer inside the newly configured range is trusted instead.
    request = _make_request({"x-forwarded-for": "9.9.9.9"}, client=("203.0.113.50", 1))
    assert get_client_ip(request) == "9.9.9.9"


def test_trusted_range_supports_multiple_comma_separated_cidrs(monkeypatch):
    monkeypatch.setattr(settings, "TRUSTED_PROXY_CIDRS", "100.0.0.0/8,203.0.113.0/24")

    a = _make_request({"x-forwarded-for": "1.1.1.1"}, client=(_TRUSTED_PEER, 1))
    b = _make_request({"x-forwarded-for": "2.2.2.2"}, client=("203.0.113.50", 1))
    assert get_client_ip(a) == "1.1.1.1"
    assert get_client_ip(b) == "2.2.2.2"
