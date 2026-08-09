"""
Tests for strict live-embedding validation in routes/cs03_rag.py:
- _embed_openai rejects a provider response with the wrong item count or
  inconsistent dimensions across the batch, instead of returning it as-is
- /rag/upload and /rag/ask in live mode fail with a controlled 500 on a
  malformed provider response — never silently substituting mock
  embeddings, which would otherwise mix real and mock vectors of different
  dimensions in (or against) the same sqlite-vec index
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

import routes.cs03_rag as cs03_rag
from routes.cs03_rag import EmbeddingValidationError, _embed_openai

# ─── _embed_openai — unit tests ────────────────────────────────────────────


def _fake_embedding_client(vectors: list[list[float]]) -> MagicMock:
    client = MagicMock()
    response = MagicMock()
    response.data = [MagicMock(embedding=v) for v in vectors]
    client.embeddings.create = AsyncMock(return_value=response)
    return client


def test_embed_openai_rejects_short_response(monkeypatch):
    # Asked for 3 embeddings, provider returned 2.
    fake_client = _fake_embedding_client([[0.1, 0.2], [0.3, 0.4]])
    monkeypatch.setattr("openai_client.make_openai_client", lambda *a, **kw: fake_client)

    with pytest.raises(EmbeddingValidationError):
        asyncio.run(_embed_openai("sk-test", None, "text-embedding-3-small", ["a", "b", "c"]))


def test_embed_openai_rejects_inconsistent_dimensions(monkeypatch):
    fake_client = _fake_embedding_client([[0.1, 0.2, 0.3], [0.1, 0.2]])
    monkeypatch.setattr("openai_client.make_openai_client", lambda *a, **kw: fake_client)

    with pytest.raises(EmbeddingValidationError):
        asyncio.run(_embed_openai("sk-test", None, "text-embedding-3-small", ["a", "b"]))


def test_embed_openai_rejects_all_zero_dimension_embeddings(monkeypatch):
    # A consistent dimension of 0 ({0}, one distinct length) would slip past
    # the count/consistency checks above — sqlite-vec's vec0(embedding
    # float[0]) is nonsensical, so this must be its own explicit rejection.
    fake_client = _fake_embedding_client([[], []])
    monkeypatch.setattr("openai_client.make_openai_client", lambda *a, **kw: fake_client)

    with pytest.raises(EmbeddingValidationError):
        asyncio.run(_embed_openai("sk-test", None, "text-embedding-3-small", ["a", "b"]))


def test_embed_openai_accepts_a_well_formed_response(monkeypatch):
    fake_client = _fake_embedding_client([[0.1, 0.2], [0.3, 0.4]])
    monkeypatch.setattr("openai_client.make_openai_client", lambda *a, **kw: fake_client)

    result = asyncio.run(_embed_openai("sk-test", None, "text-embedding-3-small", ["a", "b"]))
    assert result == [[0.1, 0.2], [0.3, 0.4]]


# ─── /rag/upload — live mode never falls back to mock on a bad batch ──────


def test_rag_upload_live_mode_rejects_malformed_embedding_batch(client: TestClient, monkeypatch):
    monkeypatch.setattr(cs03_rag.settings, "OPENAI_API_KEY", "sk-test")
    monkeypatch.setattr(
        cs03_rag, "_extract_pdf_text", lambda _content: "irrelevant — chunked below"
    )
    monkeypatch.setattr(cs03_rag, "_chunk_text", lambda _text: ["first chunk", "second chunk"])

    # Provider returns only one embedding for two chunks.
    fake_client = _fake_embedding_client([[0.1, 0.2]])
    monkeypatch.setattr("openai_client.make_openai_client", lambda *a, **kw: fake_client)

    r = client.post(
        "/rag/upload",
        json={
            "files": [
                {
                    "filename": "report.pdf",
                    "content": "JVBERi1mYWtl",  # arbitrary base64; parsing is monkeypatched away
                    "mimeType": "application/pdf",
                }
            ]
        },
    )
    assert r.status_code == 500
    assert "sessionId" not in r.json()


# ─── /rag/ask — live mode never falls back to mock on a bad query embed ──


def test_rag_ask_live_mode_rejects_malformed_query_embedding(client: TestClient, monkeypatch):
    from routes.cs03_rag import _build_vector_index, _ChunkRecord, _Session

    session_id = "33333333-3333-4333-8333-333333333333"
    chunks = [_ChunkRecord(text="content", filename="doc.pdf", page_number=None)]
    conn = _build_vector_index([[1.0, 0.0, 0.0]])
    monkeypatch.setitem(cs03_rag._sessions, session_id, _Session(chunks, conn))
    monkeypatch.setattr(cs03_rag.settings, "OPENAI_API_KEY", "sk-test")

    # Provider returns zero embeddings for one question.
    fake_client = _fake_embedding_client([])
    monkeypatch.setattr("openai_client.make_openai_client", lambda *a, **kw: fake_client)

    r = client.post(
        "/rag/ask", json={"question": "What does the document say?", "sessionId": session_id}
    )
    assert r.status_code == 500
    assert r.json()["status"] == "error"
