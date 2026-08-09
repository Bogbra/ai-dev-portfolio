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

from starlette.requests import Request


def get_client_ip(request: Request) -> str:
    real_ip = request.headers.get("x-real-ip")
    if real_ip and real_ip.strip():
        return real_ip.strip()

    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        entries = [entry.strip() for entry in forwarded.split(",") if entry.strip()]
        if entries:
            return entries[-1]

    if request.client and request.client.host:
        return request.client.host

    return "127.0.0.1"
