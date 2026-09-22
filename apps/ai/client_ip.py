"""
Client IP resolution behind Railway's edge proxy.

Used as the slowapi key_func for every rate limiter in this service, so all
per-IP limits (including the hourly/daily caps on cost-bearing OpenAI-backed
endpoints) key on the same, spoof-resistant value.

Why not uvicorn's --proxy-headers --forwarded-allow-ips=*:
uvicorn's ProxyHeadersMiddleware, when told to trust "*", walks to the FIRST
(leftmost) entry of X-Forwarded-For unconditionally (see
_TrustedHosts.get_trusted_client_address in uvicorn/middleware/proxy_headers.py)
and writes it into request.client.host. The leftmost entry is exactly the one
a client can set by sending its own X-Forwarded-For header — "*" does not
distinguish it from anything Railway itself appended. That makes the
per-route slowapi limits on /voice, /seo-strategy, and /rag/* — all of which
call the real OpenAI API — bypassable by rotating a fake header value.

Trust boundary — mirrors apps/api's Fastify trustProxy config:
A proxy header is only ever attacker-forgeable data unless something first
establishes that the party who set it is actually the proxy, not a client
connecting directly. Earlier versions of this function trusted X-Real-IP /
X-Forwarded-For purely on presence, with no check on who sent them — a
client with direct network access to this service could set either header
itself and have it accepted outright. Railway's edge always connects from
100.0.0.0/8 (see apps/api/src/server.ts's trustProxy comment for the same
reasoning on the Fastify side), so headers are honored only when the
immediate TCP peer (request.client.host — not attacker-settable) falls in
that range; otherwise the socket peer itself is returned, ignoring whatever
the headers claim.

What we know about Railway's actual behavior: it's contradictory and not
formally documented. Railway support threads describe two different models:
  - station.railway.com/questions/edge-proxy-x-forwarded-for-and-x-real-ip-c5a50049
    — Railway appends the real client IP as the LAST X-Forwarded-For entry
    after whatever the client sent (a Railway employee gives a concrete
    example: client sends "8.8.8.8", header arrives as
    "8.8.8.8, 37.166.86.65", and states the rightmost value is trustworthy).
  - station.railway.com/questions/security-critical-questions-on-edge-prox-8fddd775
    — a different Railway employee reply says the edge strips any
    client-supplied X-Forwarded-For and places the real IP FIRST instead,
    with X-Real-IP as the single source of truth end-to-end.
Both threads agree X-Real-IP is meant to be fully proxy-controlled and not
client-settable. This has not been re-verified against the live deployment
(no test endpoint or Railway credentials available while writing this) — if
that's ever needed, temporarily log request.headers for a request sent with
a spoofed X-Forwarded-For and compare against the models above.

Because the two documented models disagree on X-Forwarded-For's trustworthy
position, resolution here prefers X-Real-IP (trustworthy under both models)
and falls back to the rightmost X-Forwarded-For entry, which is correct
under the "append" model and also correct under "strip and replace" (there's
only one entry either way, so leftmost == rightmost). It is wrong only if
Railway's internal network appends its own additional hop(s) after the real
IP without also setting X-Real-IP — worth confirming empirically if traffic
volume ever makes that discrepancy worth chasing down.
"""

from __future__ import annotations

from ipaddress import ip_address, ip_network

from starlette.requests import Request

# Railway's edge proxy always connects from this range — see the module
# docstring's "Trust boundary" section and apps/api/src/server.ts's
# trustProxy comment for the matching Fastify-side reasoning.
_TRUSTED_PROXY_NETWORK = ip_network("100.0.0.0/8")


def _is_trusted_proxy_peer(peer_host: str) -> bool:
    try:
        return ip_address(peer_host) in _TRUSTED_PROXY_NETWORK
    except ValueError:
        # Not a parseable IP (e.g. a unix socket path in some ASGI test
        # setups) — never a legitimate Railway peer, so never trusted.
        return False


def get_client_ip(request: Request) -> str:
    peer_host = request.client.host if request.client else None

    if peer_host and _is_trusted_proxy_peer(peer_host):
        real_ip = request.headers.get("x-real-ip")
        if real_ip and real_ip.strip():
            return real_ip.strip()

        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            entries = [entry.strip() for entry in forwarded.split(",") if entry.strip()]
            if entries:
                return entries[-1]

    if peer_host:
        return peer_host

    return "127.0.0.1"
