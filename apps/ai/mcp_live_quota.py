"""
Per-IP live-call quota for the create_researched_post MCP tool.

Deliberately separate from _McpRateLimitMiddleware in mcp_server.py, which
rate-limits the whole /mcp protocol surface (cheap resource reads included).
This tracks only real, provider-billed workflow executions, on a much
tighter budget.

In-memory only, same as _McpRateLimitMiddleware's own bucket dict: state
resets on process restart and is not shared across replicas. Acceptable for
a single-instance portfolio demo — a real multi-instance deployment would
need a shared store (e.g. Redis) instead.
"""

from __future__ import annotations

import asyncio
import random
import time
from collections import defaultdict, deque


class LiveQuota:
    def __init__(self, limit: int, window_seconds: float, sweep_probability: float = 0.01) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self.sweep_probability = sweep_probability
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        # A single global lock (not per-IP) is enough at this traffic scale
        # and, unlike per-IP locks, makes the idle-bucket sweep trivially
        # safe to run under the same lock as a reservation.
        self._lock = asyncio.Lock()

    def _prune(self, ip: str, now: float) -> int:
        # .get(), not [] — a read-only status check (remaining()) for an IP
        # with no history must not auto-vivify an empty deque via
        # defaultdict, or every get_demo_status call from a fresh IP would
        # leave a permanent empty entry behind, defeating the point of
        # deleting expired/empty buckets below.
        hits = self._hits.get(ip)
        if not hits:
            return 0
        while hits and now - hits[0] > self.window_seconds:
            hits.popleft()
        if not hits:
            del self._hits[ip]
            return 0
        return len(hits)

    def _sweep_idle_ips(self, now: float) -> None:
        # _prune only ever touches the IP being looked up right now, so an
        # IP that reserves once and never calls try_reserve()/remaining()
        # again would otherwise sit in _hits forever, even after its window
        # has long expired. Mirrors _McpRateLimitMiddleware's own sweep —
        # runs on a small random fraction of writes rather than every one.
        idle_ips = [
            ip
            for ip, hits in self._hits.items()
            if not hits or now - hits[-1] > self.window_seconds
        ]
        for ip in idle_ips:
            del self._hits[ip]

    async def try_reserve(self, ip: str) -> bool:
        """Attempt to consume one live-call slot for `ip`.

        Reserves atomically under the lock — check-then-append happens as
        one step, so two concurrent requests from the same IP can't both
        observe "one slot left" and both proceed live. The slot is consumed
        here, before the workflow actually runs: an attempted call counts
        against the quota even if the provider call itself then fails,
        which keeps this reservation (and the concurrency guarantee it
        gives) simple and matches how real provider quotas behave.
        """
        now = time.monotonic()
        async with self._lock:
            if self._prune(ip, now) >= self.limit:
                return False
            self._hits[ip].append(now)
            if random.random() < self.sweep_probability:
                self._sweep_idle_ips(now)
            return True

    async def remaining(self, ip: str) -> int:
        """Read-only — does not consume a slot."""
        now = time.monotonic()
        async with self._lock:
            return max(0, self.limit - self._prune(ip, now))
