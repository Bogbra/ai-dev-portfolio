"""Tests for the sqlite-vec-backed retrieval in routes/cs03_rag.py."""

import pytest

from routes.cs03_rag import _build_vector_index, _ChunkRecord, _retrieve, _Session


def _chunk(text: str) -> _ChunkRecord:
    return _ChunkRecord(text=text, filename="doc.pdf", page_number=None)


def test_build_vector_index_returns_none_for_empty_embeddings():
    assert _build_vector_index([]) is None


def test_identical_vectors_score_near_one():
    v = [1.0, 0.0, 0.0]
    conn = _build_vector_index([v])
    session = _Session([_chunk("a")], conn)
    results = _retrieve(session, v, top_k=1)
    assert len(results) == 1
    assert results[0][1] == pytest.approx(1.0, abs=1e-5)


def test_orthogonal_vectors_are_filtered_by_threshold():
    # Orthogonal vectors have cosine similarity 0, below the 0.1 threshold —
    # _retrieve must drop them rather than return a near-zero-relevance match.
    a = [1.0, 0.0, 0.0]
    b = [0.0, 1.0, 0.0]
    conn = _build_vector_index([b])
    session = _Session([_chunk("b")], conn)
    results = _retrieve(session, a, top_k=1)
    assert results == []


def test_scaled_vectors_give_same_similarity_as_unscaled():
    # Cosine similarity is magnitude-invariant.
    a = [2.0, 0.0]
    b = [5.0, 0.0]
    conn = _build_vector_index([b])
    session = _Session([_chunk("b")], conn)
    results = _retrieve(session, a, top_k=1)
    assert results[0][1] == pytest.approx(1.0, abs=1e-5)


def test_retrieve_orders_results_by_similarity_descending():
    query = [1.0, 0.0, 0.0]
    close = [0.9, 0.1, 0.0]
    far = [0.5, 0.5, 0.5]
    conn = _build_vector_index([far, close])  # deliberately out of order
    session = _Session([_chunk("far"), _chunk("close")], conn)
    results = _retrieve(session, query, top_k=2)
    assert [c.text for c, _ in results] == ["close", "far"]
    assert results[0][1] > results[1][1]


def test_retrieve_respects_top_k():
    query = [1.0, 0.0]
    vectors = [[1.0, 0.0], [0.99, 0.01], [0.98, 0.02], [0.97, 0.03]]
    conn = _build_vector_index(vectors)
    session = _Session([_chunk(str(i)) for i in range(len(vectors))], conn)
    results = _retrieve(session, query, top_k=2)
    assert len(results) == 2


def test_retrieve_returns_empty_for_session_with_no_chunks():
    # conn is None here — _retrieve must short-circuit on the empty chunk
    # list without ever touching session.conn.
    session = _Session([], None)
    assert _retrieve(session, [1.0, 0.0], top_k=5) == []
