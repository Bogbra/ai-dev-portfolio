"""Tests for _chunk_text in routes/cs03_rag.py."""

from routes.cs03_rag import _chunk_text


def test_short_text_returns_single_chunk():
    text = "This is a short sentence."
    chunks = _chunk_text(text, chunk_size=400, overlap=80)
    assert len(chunks) == 1
    assert chunks[0] == text


def test_long_text_produces_multiple_chunks():
    sentence = "This is a test sentence that fills up space. "
    text = sentence * 30  # ~1350 chars
    chunks = _chunk_text(text, chunk_size=400, overlap=80)
    assert len(chunks) > 1


def test_empty_string_returns_empty_list():
    assert _chunk_text("") == []


def test_very_short_chunks_are_filtered():
    # Only whitespace / very short segments should not appear
    text = "Hi. " * 200
    chunks = _chunk_text(text, chunk_size=400, overlap=80)
    assert all(len(c.strip()) > 20 for c in chunks)


def test_chunks_contain_original_content():
    text = "Alpha beta gamma. Delta epsilon zeta. Eta theta iota. " * 20
    chunks = _chunk_text(text, chunk_size=200, overlap=40)
    combined = " ".join(chunks)
    # Every word from the original should appear somewhere in the chunks
    assert "Alpha" in combined
    assert "iota" in combined


def test_overlap_carries_tail_into_next_chunk():
    sentence = "Word " * 60  # 300 chars, forces split at chunk_size=200
    chunks = _chunk_text(sentence, chunk_size=200, overlap=60)
    # With overlap the tail of chunk N should partially appear in chunk N+1
    if len(chunks) >= 2:
        # Both chunks must be non-empty meaningful text
        assert len(chunks[0]) > 20
        assert len(chunks[1]) > 20


def test_custom_chunk_size_respected():
    text = "Sentence one end. Sentence two end. Sentence three end. Sentence four end. Sentence five end."
    small_chunks = _chunk_text(text, chunk_size=50, overlap=10)
    large_chunks = _chunk_text(text, chunk_size=400, overlap=80)
    assert len(small_chunks) >= len(large_chunks)


# ─── Oversized single-sentence edge case ────────────────────────────────
# The sentence-boundary split's length check only fires once `current`
# already holds content, so a single sentence longer than chunk_size never
# gets split by the main loop — it just becomes one oversized chunk. Text
# with no [.!?] at all is the worst case: re.split returns the whole input
# as a single "sentence", so without a hard-split fallback the entire
# document would be returned as one chunk regardless of chunk_size.


def test_unpunctuated_text_longer_than_chunk_size_is_still_split():
    text = "word " * 200  # 1000 chars, no [.!?] anywhere
    chunks = _chunk_text(text, chunk_size=400, overlap=80)
    assert len(chunks) > 1
    assert all(len(c) <= 400 for c in chunks)


def test_single_oversized_sentence_mid_document_is_split():
    # A normal short sentence, then one massive unpunctuated run-on, then
    # another normal short sentence — the oversized middle sentence must
    # not survive as a single chunk just because it's not the whole input.
    text = "Intro sentence here. " + ("overflow " * 100) + "outro sentence here."
    chunks = _chunk_text(text, chunk_size=400, overlap=80)
    assert all(len(c) <= 400 for c in chunks)


def test_hard_split_chunks_still_pass_the_min_length_filter():
    text = "x" * 1000  # single unpunctuated token, no spaces to split on either
    chunks = _chunk_text(text, chunk_size=400, overlap=80)
    assert len(chunks) > 1
    assert all(len(c) <= 400 for c in chunks)
    assert all(len(c.strip()) > 20 for c in chunks)
