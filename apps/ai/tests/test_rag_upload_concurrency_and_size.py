"""Two independent hardenings against a memory-DoS surface in /rag/upload:
- _extract_pdf_pages caps total extracted characters per file — a
  compressed PDF can decompress into far more text than MAX_UPLOAD_MB
  (which only bounds the compressed bytes) suggests.
- main.RAG_UPLOAD_CONCURRENCY_SEMAPHORE caps how many /rag/upload requests
  are in flight at all — not just during PDF parsing/embedding, but from
  the moment the request body starts arriving. A semaphore acquired only
  around the parsing/embedding stage would still let N requests' full
  bodies (each up to MAX_TOTAL_UPLOAD_MB) buffer in memory simultaneously
  ahead of it; this is held by BodySizeLimitMiddleware for the whole
  request instead, buffering included.
"""

import asyncio
from unittest.mock import MagicMock

import pypdf

import main
import routes.cs03_rag as cs03_rag


class _FakePage:
    def __init__(self, text: str) -> None:
        self._text = text

    def extract_text(self) -> str:
        return self._text


def test_extract_pdf_pages_enforces_the_cap_as_a_hard_maximum(monkeypatch):
    # Regression: stopping the *loop* after total_chars crossed the cap
    # still let the page that crossed it through in full, so total
    # extracted characters could exceed the cap — this must never happen;
    # the excess is truncated instead, and total_chars never exceeds it.
    fake_reader = MagicMock()
    fake_reader.pages = [_FakePage("x" * 1_000_000) for _ in range(6)]
    monkeypatch.setattr(pypdf, "PdfReader", lambda _data: fake_reader)

    pages = cs03_rag._extract_pdf_pages(b"irrelevant")

    total_chars = sum(len(text) for _, text in pages)
    assert len(pages) < 6, "should have stopped before consuming every page"
    assert total_chars == cs03_rag._MAX_EXTRACTED_CHARS_PER_FILE
    assert total_chars <= cs03_rag._MAX_EXTRACTED_CHARS_PER_FILE


def test_extract_pdf_pages_truncates_the_page_that_crosses_the_cap(monkeypatch):
    fake_reader = MagicMock()
    # 2.9M then a 1M page — the cap falls mid-page, not on a page boundary.
    fake_reader.pages = [
        _FakePage("x" * 2_900_000),
        _FakePage("y" * 1_000_000),
        _FakePage("z" * 1_000_000),
    ]
    monkeypatch.setattr(pypdf, "PdfReader", lambda _data: fake_reader)

    pages = cs03_rag._extract_pdf_pages(b"irrelevant")

    assert len(pages) == 2
    assert pages[1][1] == "y" * 100_000  # truncated to exactly the remaining budget
    total_chars = sum(len(text) for _, text in pages)
    assert total_chars == cs03_rag._MAX_EXTRACTED_CHARS_PER_FILE


def test_extract_pdf_pages_keeps_all_pages_under_the_cap(monkeypatch):
    fake_reader = MagicMock()
    fake_reader.pages = [_FakePage("short text") for _ in range(5)]
    monkeypatch.setattr(pypdf, "PdfReader", lambda _data: fake_reader)

    pages = cs03_rag._extract_pdf_pages(b"irrelevant")

    assert len(pages) == 5


def test_upload_semaphore_caps_concurrent_holders_at_two():
    # A fresh semaphore of the same capacity, not the real module-level
    # singleton: asyncio.Semaphore binds to whichever event loop first uses
    # it, and the singleton is exercised end-to-end (across its own
    # asyncio.run()) by the middleware integration test below — reusing it
    # here too would bind it across two separate event loops and raise.
    assert main.RAG_UPLOAD_CONCURRENCY_SEMAPHORE._value == 2  # never held at import time
    semaphore = asyncio.Semaphore(2)

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


def test_semaphore_caps_bodies_buffering_in_memory_not_just_route_processing():
    # Regression: the semaphore used to be acquired only inside rag_upload
    # itself, *after* BodySizeLimitMiddleware had already fully buffered
    # the request body (up to 40 MB) into memory — so N concurrent uploads
    # could all be buffering huge bodies simultaneously, unlimited, before
    # any of them reached the semaphore at all. It's now held by the
    # middleware for the whole request, buffering included.
    max_concurrent_buffering = 0
    current_buffering = 0
    lock = asyncio.Lock()

    async def _downstream_app(_scope, _receive, send):
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b"ok"})

    middleware = main.BodySizeLimitMiddleware(_downstream_app)

    async def _slow_upload_request():
        scope = {"type": "http", "method": "POST", "path": "/rag/upload", "headers": []}
        chunks = iter([b"a" * 1000, b"b" * 1000])
        started = False

        async def receive():
            # receive() is only ever called from inside main.py's buffering
            # loop, which the semaphore wraps — the first call only happens
            # once the semaphore has actually been acquired, so counting
            # from here (not from before the middleware call) measures
            # concurrent *holders*, not concurrent waiters.
            nonlocal started, current_buffering, max_concurrent_buffering
            if not started:
                started = True
                async with lock:
                    current_buffering += 1
                    max_concurrent_buffering = max(max_concurrent_buffering, current_buffering)
            await asyncio.sleep(0.02)  # simulates a slow client still sending the body
            try:
                chunk = next(chunks)
                return {"type": "http.request", "body": chunk, "more_body": True}
            except StopIteration:
                async with lock:
                    current_buffering -= 1
                return {"type": "http.request", "body": b"", "more_body": False}

        async def send(_message):
            pass

        await middleware(scope, receive, send)

    async def _run():
        await asyncio.gather(*(_slow_upload_request() for _ in range(5)))

    asyncio.run(_run())
    assert max_concurrent_buffering <= 2
