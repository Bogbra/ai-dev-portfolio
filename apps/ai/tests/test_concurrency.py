"""
Regression tests proving synchronous CPU-bound parsing (pypdf, openpyxl/csv)
runs off the event loop via asyncio.to_thread, so one slow/adversarial
upload can't stall every other concurrent request on this single-process
uvicorn service.
"""

from __future__ import annotations

import asyncio
import base64
import time

import httpx

import routes.cs01_workflow as cs01_workflow
import routes.cs03_rag as cs03_rag
from main import app

# Generous relative to the artificial 0.3s parse delay below — if parsing
# blocked the loop, /health would be stuck behind it for close to that long.
_HEALTH_DEADLINE_SECONDS = 0.2
_ARTIFICIAL_PARSE_DELAY_SECONDS = 0.3


async def _concurrent_health_elapsed(slow_call) -> float:
    """Runs `slow_call()` concurrently with a delayed GET /health and
    returns the total wall time from before either coroutine starts until
    /health completes.

    The clock must start before the delay, not after it — if the event loop
    is blocked by synchronous parsing, asyncio.sleep(0.05)'s callback simply
    fires late (a blocked loop can't service its own timers), so a clock
    started only after that await resumes would silently measure just the
    fast tail end and never see the stall.
    """
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        start = time.monotonic()

        async def health_after_delay() -> float:
            # Give the slow request a head start so it's mid-parse.
            await asyncio.sleep(0.05)
            res = await client.get("/health")
            assert res.status_code == 200
            return time.monotonic() - start

        _, health_elapsed = await asyncio.gather(slow_call(client), health_after_delay())
        return health_elapsed


def test_rag_upload_pdf_parsing_does_not_block_concurrent_health_request(monkeypatch):
    def _slow_extract(_b64_content: str) -> str:
        time.sleep(_ARTIFICIAL_PARSE_DELAY_SECONDS)
        return "slow pdf text " * 20

    monkeypatch.setattr(cs03_rag, "_extract_pdf_text", _slow_extract)

    async def upload(client: httpx.AsyncClient) -> httpx.Response:
        payload = {
            "sessionId": "concurrency-test",
            "files": [
                {
                    "filename": "slow.pdf",
                    "content": base64.b64encode(b"%PDF-1.4 fake").decode(),
                    "mimeType": "application/pdf",
                }
            ],
        }
        return await client.post("/rag/upload", json=payload)

    health_elapsed = asyncio.run(_concurrent_health_elapsed(upload))
    assert health_elapsed < _HEALTH_DEADLINE_SECONDS


def test_ai_workflow_parse_csv_does_not_block_concurrent_health_request(monkeypatch):
    def _slow_parse_file(_buffer: bytes, _filename: str) -> list[dict[str, str]]:
        time.sleep(_ARTIFICIAL_PARSE_DELAY_SECONDS)
        return [{"name": "Alice", "email": "alice@example.com"}]

    monkeypatch.setattr(cs01_workflow, "_parse_file", _slow_parse_file)

    async def upload(client: httpx.AsyncClient) -> httpx.Response:
        payload = {
            "filename": "contacts.csv",
            "content": base64.b64encode(b"name,email\nAlice,alice@example.com\n").decode(),
            "mimeType": "text/csv",
        }
        return await client.post("/ai-workflow/parse", json=payload)

    health_elapsed = asyncio.run(_concurrent_health_elapsed(upload))
    assert health_elapsed < _HEALTH_DEADLINE_SECONDS
