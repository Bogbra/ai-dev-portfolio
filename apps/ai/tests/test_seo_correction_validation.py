"""Tests for _correction_pass's output validation in routes/seo.py — the
corrected response was previously only checked for reranked_opportunities
truthiness, never validated against a Pydantic model the way the original
step1/step2 calls now are. These confirm a genuinely malformed correction
(one that still passes the old truthiness check) falls back to the
pre-correction result instead of being accepted uninspected.
"""

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock

from routes.seo import _correction_pass

_ORIGINAL_RESULT = {
    "summary": "Original business summary.",
    # Every field present (not just a subset) so downstream equality checks
    # aren't confused by Pydantic filling in defaults for keys this fixture
    # never populated in the first place — that's normal validation
    # behavior, not the data loss these tests are meant to catch.
    "extracted_business_context": {
        "business_type": "SaaS",
        "core_service": "AI support",
        "target_audience": "small teams",
        "value_proposition": "Simple and fast",
        "pain_points": ["too complex tools"],
        "competitive_differentiators": ["ease of use"],
    },
    "keyword_candidates": [
        {"term": "ai support tool", "type": "seed", "intent": "commercial_investigation"}
    ],
    "intent_clusters": [
        {
            "intent": "commercial_investigation",
            "description": "d",
            "terms": ["t"],
            "business_relevance": "high",
        }
    ],
    "reranked_opportunities": [{"rank": 1, "term": "old term"}],
    "content_ideas": [],
    "lead_generation_angles": [],
    "roadmap": [],
    "warnings": [],
    "metadata": {},
}


def _client_returning(content: str) -> MagicMock:
    client = MagicMock()
    response = MagicMock()
    response.choices = [MagicMock(message=MagicMock(content=content))]
    client.chat.completions.create = AsyncMock(return_value=response)
    return client


def test_correction_pass_accepts_well_formed_correction():
    corrected_json = json.dumps(
        {
            "reranked_opportunities": [
                {"rank": 1, "term": "corrected term", "opportunity_score": 90}
            ],
            "content_ideas": [],
            "lead_generation_angles": [],
            "roadmap": [],
        }
    )
    client = _client_returning(corrected_json)
    result = asyncio.run(
        _correction_pass(client, _ORIGINAL_RESULT, ["outdated_year_terms"], "us", "leads")
    )
    assert result["reranked_opportunities"][0]["term"] == "corrected term"


def test_correction_pass_falls_back_to_original_on_malformed_shape():
    # reranked_opportunities is a truthy (non-empty) string, not a list of
    # objects — this passes the old bare truthiness check, so it must be
    # the new Pydantic validation catching it and falling back to the
    # pre-correction result, not the pre-existing "empty" guard.
    corrected_json = json.dumps(
        {
            "reranked_opportunities": "not a list of objects",
            "content_ideas": [],
            "lead_generation_angles": [],
            "roadmap": [],
        }
    )
    client = _client_returning(corrected_json)
    result = asyncio.run(
        _correction_pass(client, _ORIGINAL_RESULT, ["outdated_year_terms"], "us", "leads")
    )
    assert result == _ORIGINAL_RESULT


def test_correction_pass_falls_back_to_original_when_reranked_opportunities_missing():
    corrected_json = json.dumps({"content_ideas": [], "lead_generation_angles": [], "roadmap": []})
    client = _client_returning(corrected_json)
    result = asyncio.run(
        _correction_pass(client, _ORIGINAL_RESULT, ["outdated_year_terms"], "us", "leads")
    )
    assert result == _ORIGINAL_RESULT


def test_partial_correction_preserves_original_step1_fields():
    # The correction prompt asks the model to echo back every top-level
    # key, but that's not enforced (response_format=json_object gives no
    # schema guarantee) — a correction that only touches step2 fields is a
    # real possible response, not just a malformed one. Every
    # Step1Output/Step2Output field defaults to empty, so validating this
    # dict directly (instead of merging onto the original first) would
    # silently wipe summary/keyword_candidates/intent_clusters/
    # extracted_business_context with their defaults.
    #
    # reranked_opportunities must be non-empty here: an empty list is
    # falsy, so it would otherwise be caught by the pre-existing "did the
    # correction produce anything at all" guard before ever reaching the
    # validation this test is actually meant to exercise — the first
    # version of this test made exactly that mistake and passed even
    # against the unmerged, data-losing code.
    corrected_json = json.dumps(
        {
            "reranked_opportunities": [{"rank": 1, "term": "corrected term"}],
            "content_ideas": [],
            "lead_generation_angles": [],
            "roadmap": [],
        }
    )
    client = _client_returning(corrected_json)
    result = asyncio.run(
        _correction_pass(client, _ORIGINAL_RESULT, ["outdated_year_terms"], "us", "leads")
    )

    assert result["reranked_opportunities"][0]["term"] == "corrected term"
    assert result["summary"] == _ORIGINAL_RESULT["summary"]
    assert result["keyword_candidates"] == _ORIGINAL_RESULT["keyword_candidates"]
    assert result["intent_clusters"] == _ORIGINAL_RESULT["intent_clusters"]
    assert result["extracted_business_context"] == _ORIGINAL_RESULT["extracted_business_context"]
