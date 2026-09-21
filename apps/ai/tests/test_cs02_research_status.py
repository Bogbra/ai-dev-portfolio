"""Tests for _fetch_research_context's status field in routes/cs02_post.py —
distinguishing a genuine provider error from a successful call that found
nothing, so a Tavily outage and a genuinely empty result don't collapse
into the same indistinguishable "no context" state.
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from routes.cs02_post import _fetch_research_context


def _mock_response(status_code: int, json_data: dict) -> MagicMock:
    response = MagicMock()
    response.is_success = 200 <= status_code < 300
    response.json.return_value = json_data
    return response


def _patched_client(response: MagicMock):
    mock_client_cls = patch("httpx.AsyncClient")
    mock_client_cls_obj = mock_client_cls.start()
    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=response)
    mock_client_cls_obj.return_value.__aenter__.return_value = mock_client
    return mock_client_cls


def test_status_ok_when_results_found():
    patcher = _patched_client(
        _mock_response(200, {"answer": "A useful answer here.", "results": []})
    )
    try:
        result = asyncio.run(_fetch_research_context("fake-key", "a real topic"))
    finally:
        patcher.stop()
    assert result["status"] == "ok"
    assert result["contextPoints"]


def test_status_no_results_when_response_has_nothing_useful():
    patcher = _patched_client(_mock_response(200, {"answer": "", "results": []}))
    try:
        result = asyncio.run(_fetch_research_context("fake-key", "a real topic"))
    finally:
        patcher.stop()
    assert result["status"] == "no_results"
    assert result["contextPoints"] == []


def test_status_provider_error_on_non_success_response():
    patcher = _patched_client(_mock_response(500, {}))
    try:
        result = asyncio.run(_fetch_research_context("fake-key", "a real topic"))
    finally:
        patcher.stop()
    assert result["status"] == "provider_error"
    assert result["contextPoints"] == []


def test_status_provider_error_on_exception():
    with patch("httpx.AsyncClient") as mock_client_cls:
        mock_client_cls.return_value.__aenter__.side_effect = Exception("network down")
        result = asyncio.run(_fetch_research_context("fake-key", "a real topic"))
    assert result["status"] == "provider_error"


def test_status_no_results_when_topic_too_short_to_search():
    # Below the search threshold — a deliberate no-op, not a failure.
    result = asyncio.run(_fetch_research_context("fake-key", "ab"))
    assert result["status"] == "no_results"
    assert result["contextPoints"] == []
