"""
Unit tests for client_ip.get_client_ip — the shared slowapi key_func.

Covers spoofed multi-entry X-Forwarded-For chains to prove the resolver
takes the rightmost (proxy-appended) entry rather than the leftmost
(client-controlled) one that --forwarded-allow-ips=* used to trust.
"""

from __future__ import annotations

from starlette.requests import Request

from client_ip import get_client_ip


def _make_request(
    headers: dict[str, str], client: tuple[str, int] | None = ("10.0.0.5", 12345)
) -> Request:
    scope = {
        "type": "http",
        "headers": [(key.lower().encode(), value.encode()) for key, value in headers.items()],
        "client": client,
    }
    return Request(scope)


def test_uses_rightmost_xff_entry_ignoring_spoofed_leftmost():
    request = _make_request({"x-forwarded-for": "1.2.3.4, 9.9.9.9"})
    assert get_client_ip(request) == "9.9.9.9"


def test_different_spoofed_leftmost_entries_resolve_to_same_real_peer():
    real_peer = "9.9.9.9"
    a = _make_request({"x-forwarded-for": f"1.2.3.4, {real_peer}"})
    b = _make_request({"x-forwarded-for": f"5.6.7.8, {real_peer}"})
    assert get_client_ip(a) == get_client_ip(b) == real_peer


def test_single_xff_entry_is_used_directly():
    request = _make_request({"x-forwarded-for": "203.0.113.9"})
    assert get_client_ip(request) == "203.0.113.9"


def test_trims_whitespace_around_xff_entries():
    request = _make_request({"x-forwarded-for": " 1.2.3.4 ,  9.9.9.9  "})
    assert get_client_ip(request) == "9.9.9.9"


def test_x_real_ip_takes_priority_over_x_forwarded_for():
    request = _make_request({"x-real-ip": "7.7.7.7", "x-forwarded-for": "1.2.3.4, 9.9.9.9"})
    assert get_client_ip(request) == "7.7.7.7"


def test_falls_back_to_socket_peer_when_no_proxy_headers_present():
    request = _make_request({}, client=("192.168.1.50", 5000))
    assert get_client_ip(request) == "192.168.1.50"


def test_falls_back_to_localhost_when_nothing_is_available():
    request = _make_request({}, client=None)
    assert get_client_ip(request) == "127.0.0.1"


def test_empty_x_real_ip_header_falls_through_to_xff():
    request = _make_request({"x-real-ip": "", "x-forwarded-for": "1.2.3.4, 9.9.9.9"})
    assert get_client_ip(request) == "9.9.9.9"
