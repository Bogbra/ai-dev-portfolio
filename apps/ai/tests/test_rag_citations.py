"""
Tests for citation-based usedInAnswer marking in routes/cs03_rag.py:
- _cited_indices, the pure [n]-marker parser
- /rag/ask marks only the sources the model actually cited, not just the
  top 3 retrieved passages
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

from fastapi.testclient import TestClient

import routes.cs03_rag as cs03_rag
from routes.cs03_rag import _build_vector_index, _ChunkRecord, _cited_indices, _Session

# ─── _cited_indices ─────────────────────────────────────────────────────────


def test_cited_indices_parses_single_marker():
    assert _cited_indices("The revenue grew significantly [1].", count=3) == {0}


def test_cited_indices_parses_multiple_markers():
    assert _cited_indices("See [1] and [3] for details.", count=3) == {0, 2}


def test_cited_indices_ignores_out_of_range_markers():
    # A hallucinated or malformed [n] outside the actual source count.
    assert _cited_indices("See [1] and [9].", count=3) == {0}


def test_cited_indices_empty_when_no_markers_present():
    assert _cited_indices("No citations here at all.", count=3) == set()


def test_cited_indices_duplicate_marker_counted_once():
    assert _cited_indices("As shown in [2], and again in [2].", count=3) == {1}


# ─── /rag/ask — live mode uses real citations, not top-3 ──────────────────


def _make_session_with_ordered_chunks() -> _Session:
    # Cosine similarity to query [1, 0, 0] decreases A > B > C, all above
    # _retrieve's 0.1 filter, so retrieval order is deterministic: A -> [1],
    # B -> [2], C -> [3].
    chunks = [
        _ChunkRecord(text="Chunk A content", filename="doc.pdf", page_number=None),
        _ChunkRecord(text="Chunk B content", filename="doc.pdf", page_number=None),
        _ChunkRecord(text="Chunk C content", filename="doc.pdf", page_number=None),
    ]
    embeddings = [[1.0, 0.0, 0.0], [0.7, 0.7, 0.0], [0.3, 0.9, 0.0]]
    conn = _build_vector_index(embeddings)
    return _Session(chunks, conn)


def _fake_rag_client(answer_text: str) -> MagicMock:
    client = MagicMock()

    fake_embedding_response = MagicMock()
    fake_embedding_response.data = [MagicMock(embedding=[1.0, 0.0, 0.0])]
    client.embeddings.create = AsyncMock(return_value=fake_embedding_response)

    fake_completion = MagicMock()
    fake_completion.choices = [MagicMock(message=MagicMock(content=answer_text))]
    client.chat.completions.create = AsyncMock(return_value=fake_completion)

    return client


def test_rag_ask_marks_only_actually_cited_sources(client: TestClient, monkeypatch):
    session_id = "11111111-1111-4111-8111-111111111111"
    monkeypatch.setitem(cs03_rag._sessions, session_id, _make_session_with_ordered_chunks())
    monkeypatch.setattr(cs03_rag.settings, "OPENAI_API_KEY", "sk-test")

    fake_client = _fake_rag_client("Chunk A supports this [1]. Chunk C confirms it [3].")
    monkeypatch.setattr("openai_client.make_openai_client", lambda *a, **kw: fake_client)

    r = client.post(
        "/rag/ask", json={"question": "What do the documents say?", "sessionId": session_id}
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "answer_ready"

    used = [s["usedInAnswer"] for s in body["sources"]]
    # Cited: source 0 ("[1]") and source 2 ("[3]") — not source 1, even
    # though it was the second-highest-scored retrieved passage.
    assert used == [True, False, True]


def test_rag_ask_marks_no_sources_when_model_cites_nothing(client: TestClient, monkeypatch):
    session_id = "22222222-2222-4222-8222-222222222222"
    monkeypatch.setitem(cs03_rag._sessions, session_id, _make_session_with_ordered_chunks())
    monkeypatch.setattr(cs03_rag.settings, "OPENAI_API_KEY", "sk-test")

    fake_client = _fake_rag_client("The documents do not contain enough information.")
    monkeypatch.setattr("openai_client.make_openai_client", lambda *a, **kw: fake_client)

    r = client.post(
        "/rag/ask", json={"question": "What do the documents say?", "sessionId": session_id}
    )
    assert r.status_code == 200
    body = r.json()

    assert all(s["usedInAnswer"] is False for s in body["sources"])
