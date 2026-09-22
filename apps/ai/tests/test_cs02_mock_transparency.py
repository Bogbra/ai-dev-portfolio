"""_build_mock_result (routes/cs02_post.py) makes no LLM or search call at
all — it must not claim things it never checked. Regression coverage for
two inaccuracies: groundednessResult reported "grounded" with no actual
groundedness check having run, and researchContext.skippedReason always
named a missing TAVILY_API_KEY specifically, which isn't the only reason
this mock path runs (no OPENAI_API_KEY, an exhausted MCP live quota, live
mode disabled administratively all reach it too).
"""

import routes.cs02_post as cs02_post


def test_mock_groundedness_does_not_claim_a_check_was_performed():
    result = cs02_post._build_mock_result("workflow automation", "ops managers")
    grounding = result["groundednessResult"]
    assert grounding["status"] != "grounded"
    assert grounding["status"] == "needs_caution"
    assert "demo mode" in grounding["cautionNotes"].lower()


def test_mock_groundedness_check_step_summary_does_not_claim_grounding():
    result = cs02_post._build_mock_result("workflow automation", "ops managers")
    groundedness_step = next(s for s in result["steps"] if s["name"] == "Groundedness Check")
    assert "all claims grounded" not in groundedness_step["summary"].lower()


def test_mock_skipped_reason_is_not_tavily_specific():
    # True regardless of *why* the mock path was taken (missing OpenAI key,
    # exhausted MCP quota, administratively disabled live mode, ...) — not
    # just "no Tavily key", which may not even be the actual reason.
    result = cs02_post._build_mock_result("workflow automation", "ops managers")
    reason = result["researchContext"]["skippedReason"]
    assert "tavily" not in reason.lower()
    assert "demo mode" in reason.lower()
