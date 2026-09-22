"""Two independent hardenings against a memory-DoS surface in /rag/upload:
- _extract_pdf_pages caps total extracted characters per file — a
  compressed PDF can decompress into far more text than MAX_UPLOAD_MB
  (which only bounds the compressed bytes) suggests.
- _RAG_UPLOAD_SEMAPHORE caps how many uploads are parsed/embedded at once —
  each held request can carry up to MAX_TOTAL_UPLOAD_MB of decoded PDF
  bytes plus extracted text/chunks/embeddings in memory simultaneously.
"""

import asyncio
from unittest.mock import MagicMock

import pypdf

import routes.cs03_rag as cs03_rag


class _FakePage:
    def __init__(self, text: str) -> None:
        self._text = text

    def extract_text(self) -> str:
        return self._text


def test_extract_pdf_pages_stops_once_character_cap_exceeded(monkeypatch):
    fake_reader = MagicMock()
    fake_reader.pages = [_FakePage("x" * 1_000_000) for _ in range(6)]
    monkeypatch.setattr(pypdf, "PdfReader", lambda _data: fake_reader)

    pages = cs03_rag._extract_pdf_pages(b"irrelevant")

    total_chars = sum(len(text) for _, text in pages)
    assert len(pages) < 6, "should have stopped before consuming every page"
    assert total_chars > cs03_rag._MAX_EXTRACTED_CHARS_PER_FILE


def test_extract_pdf_pages_keeps_all_pages_under_the_cap(monkeypatch):
    fake_reader = MagicMock()
    fake_reader.pages = [_FakePage("short text") for _ in range(5)]
    monkeypatch.setattr(pypdf, "PdfReader", lambda _data: fake_reader)

    pages = cs03_rag._extract_pdf_pages(b"irrelevant")

    assert len(pages) == 5


def test_upload_semaphore_caps_concurrent_holders_at_two():
    semaphore = cs03_rag._RAG_UPLOAD_SEMAPHORE
    assert semaphore._value == 2  # initial capacity, nothing held yet

    max_concurrent = 0
    current = 0
    lock = asyncio.Lock()

    async def _simulated_upload():
        nonlocal max_concurrent, current
        async with semaphore:
            async with lock:
                current += 1
                max_concurrent = max(max_concurrent, current)
            await asyncio.sleep(0.02)
            async with lock:
                current -= 1

    async def _run():
        await asyncio.gather(*(_simulated_upload() for _ in range(5)))

    asyncio.run(_run())
    assert max_concurrent == 2
