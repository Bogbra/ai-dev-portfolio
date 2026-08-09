"""
Tests for RAG session storage in routes/cs03_rag.py:
- the session store evicts the oldest session once _MAX_SESSIONS is reached
- eviction closes the evicted session's sqlite-vec connection (no leaks)
- eviction (capacity or the background cleanup sweep) cannot close a
  session's connection while a request is actively retrieving from it,
  and a request that loses that race gets a clean "session gone" result
  instead of a closed-connection crash
"""

from __future__ import annotations

import asyncio
import sqlite3

import pytest

from routes import cs03_rag
from routes.cs03_rag import _build_vector_index, _ChunkRecord, _retrieve_locked, _Session


def _make_session(chunk_count: int = 1) -> _Session:
    chunks = [
        _ChunkRecord(text="hello world", filename="doc.pdf", page_number=None)
        for _ in range(chunk_count)
    ]
    conn = _build_vector_index([[0.1, 0.2, 0.3] for _ in range(chunk_count)])
    return _Session(chunks, conn)


def test_store_session_evicts_oldest_once_max_reached(monkeypatch):
    monkeypatch.setattr(cs03_rag, "_sessions", {})
    monkeypatch.setattr(cs03_rag, "_MAX_SESSIONS", 2)

    asyncio.run(cs03_rag._store_session("a", _make_session()))
    asyncio.run(cs03_rag._store_session("a", _make_session()))  # re-store same id: no growth
    assert list(cs03_rag._sessions) == ["a"]

    asyncio.run(cs03_rag._store_session("b", _make_session()))
    assert set(cs03_rag._sessions) == {"a", "b"}

    # Third distinct session exceeds the cap of 2 — the oldest (created_at
    # order) must be evicted, not just the least-recently-stored one.
    cs03_rag._sessions["a"].created_at = 1.0
    cs03_rag._sessions["b"].created_at = 2.0
    asyncio.run(cs03_rag._store_session("c", _make_session()))

    assert set(cs03_rag._sessions) == {"b", "c"}


def test_store_session_closes_the_evicted_connection(monkeypatch):
    monkeypatch.setattr(cs03_rag, "_sessions", {})
    monkeypatch.setattr(cs03_rag, "_MAX_SESSIONS", 1)

    asyncio.run(cs03_rag._store_session("a", _make_session()))
    evicted_conn = cs03_rag._sessions["a"].conn
    asyncio.run(cs03_rag._store_session("b", _make_session()))

    assert list(cs03_rag._sessions) == ["b"]
    with pytest.raises(sqlite3.ProgrammingError):
        evicted_conn.execute("SELECT 1")


def test_evict_session_waits_for_in_flight_retrieve_before_closing(monkeypatch):
    # Simulates the real race: a /rag/ask request already holds the
    # session's lock (mid-retrieval, e.g. right after its embedding await
    # returned) at the exact moment the background cleanup sweep (or a
    # concurrent upload's capacity eviction) decides to evict this session.
    monkeypatch.setattr(cs03_rag, "_sessions", {})
    session = _make_session()
    cs03_rag._sessions["a"] = session

    order: list[str] = []

    async def in_flight_ask():
        async with session.lock:
            order.append("ask-acquired")
            await asyncio.sleep(0.05)
            # The connection must still be open and usable here — eviction
            # must not have run its close while this lock is held.
            assert session.closed is False
            session.conn.execute("SELECT 1")
            order.append("ask-released")

    async def run():
        await asyncio.gather(in_flight_ask(), cs03_rag._evict_session("a"))

    asyncio.run(run())

    assert order == ["ask-acquired", "ask-released"]
    assert session.closed is True
    assert "a" not in cs03_rag._sessions
    with pytest.raises(sqlite3.ProgrammingError):
        session.conn.execute("SELECT 1")


def test_store_session_never_exceeds_max_under_concurrent_load(monkeypatch):
    """Verifies _store_session's capacity invariant holds under concurrent
    calls, tracking the session count at every dict mutation (not just the
    post-gather end state) so a regression that transiently exceeds the cap
    and later self-corrects would still be caught.

    Note on scope: under today's asyncio scheduling, plain concurrent calls
    never actually interleave mid-_store_session — neither this fixed
    version nor the pre-_sessions_lock version contains a genuine
    suspension point in the uncontended check-evict-insert path, so this
    test cannot (and does not attempt to) reproduce a historical failure by
    running it against the old code; a direct empirical check confirmed
    that. It exists to make the atomicity invariant an explicit, permanent
    regression test rather than an implicit property of the current
    implementation — see the comment above _sessions_lock in cs03_rag.py
    for why the lock is still worth keeping.
    """
    observed_lengths: list[int] = []

    class _TrackingSessions(dict):
        def __setitem__(self, key, value):
            super().__setitem__(key, value)
            observed_lengths.append(len(self))

        def pop(self, key, default=None):
            result = super().pop(key, default)
            observed_lengths.append(len(self))
            return result

    monkeypatch.setattr(cs03_rag, "_sessions", _TrackingSessions())
    monkeypatch.setattr(cs03_rag, "_sessions_lock", asyncio.Lock())
    monkeypatch.setattr(cs03_rag, "_MAX_SESSIONS", 5)

    session_count = 30
    sessions: dict[str, _Session] = {}
    for i in range(session_count):
        s = _make_session()
        s.created_at = float(i)
        sessions[f"s{i}"] = s

    async def run():
        await asyncio.gather(*(cs03_rag._store_session(sid, s) for sid, s in sessions.items()))

    asyncio.run(run())

    assert observed_lengths, "no mutation was observed — test setup is broken"
    assert max(observed_lengths) <= 5
    assert len(cs03_rag._sessions) == 5

    # The 5 most-recently-created sessions must be the survivors — eviction
    # must consistently pick the actual oldest, not just whichever session
    # a given call happened to see first.
    expected_survivors = {f"s{i}" for i in range(session_count - 5, session_count)}
    assert set(cs03_rag._sessions) == expected_survivors

    # Every evicted session's connection must be closed exactly once,
    # and no surviving session may have been closed by mistake.
    for sid, session in sessions.items():
        if sid in expected_survivors:
            assert session.closed is False
            session.conn.execute("SELECT 1")
        else:
            assert session.closed is True
            with pytest.raises(sqlite3.ProgrammingError):
                session.conn.execute("SELECT 1")


def test_store_session_eviction_waits_for_in_flight_retrieve(monkeypatch):
    """_store_session's capacity eviction closes the evicted session via
    _close_session, after releasing _sessions_lock (see the comment above
    _sessions_lock) — not via the same code path as a direct
    _evict_session() call, which the earlier in-flight-retrieve test above
    already covers. This exercises that the same "never close a session
    while a request is actively retrieving from it" guarantee still holds
    when the eviction is triggered by _store_session specifically.
    """
    monkeypatch.setattr(cs03_rag, "_sessions", {})
    monkeypatch.setattr(cs03_rag, "_sessions_lock", asyncio.Lock())
    monkeypatch.setattr(cs03_rag, "_MAX_SESSIONS", 1)

    oldest = _make_session()
    oldest.created_at = 1.0
    cs03_rag._sessions["old"] = oldest

    order: list[str] = []

    async def in_flight_ask():
        async with oldest.lock:
            order.append("ask-acquired")
            await asyncio.sleep(0.05)
            assert oldest.closed is False
            oldest.conn.execute("SELECT 1")
            order.append("ask-released")

    async def run():
        await asyncio.gather(in_flight_ask(), cs03_rag._store_session("new", _make_session()))

    asyncio.run(run())

    assert order == ["ask-acquired", "ask-released"]
    assert oldest.closed is True
    assert set(cs03_rag._sessions) == {"new"}


def test_retrieve_locked_returns_none_after_session_evicted(monkeypatch):
    # Simulates the opposite ordering: cleanup evicts the session during a
    # request's embedding await, between that request's initial
    # _sessions.get() (which already returned this session object) and its
    # later _retrieve_locked call. Must not raise on the closed connection.
    monkeypatch.setattr(cs03_rag, "_sessions", {})
    session = _make_session()
    cs03_rag._sessions["a"] = session

    async def run():
        await cs03_rag._evict_session("a")
        return await _retrieve_locked(session, [0.1, 0.2, 0.3], top_k=1)

    result = asyncio.run(run())
    assert result is None
