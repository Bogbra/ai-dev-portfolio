"""
Wires evals/cs02_eval.py into the regular pytest suite (mock mode only —
no API key needed, no cost, deterministic). Also proves the rubric itself
actually rejects a bad result, not just that it accepts the happy path.
"""

from __future__ import annotations

import asyncio

from evals.cs02_eval import CASES, EvalResult, _score, run_eval


def test_all_cases_pass_in_mock_mode(monkeypatch):
    monkeypatch.setattr("routes.cs02_post.settings.OPENAI_API_KEY", None)
    monkeypatch.setattr("evals.cs02_eval.settings.OPENAI_API_KEY", None)

    results = asyncio.run(run_eval(CASES))

    assert len(results) == len(CASES)
    failed = [r for r in results if not r.passed]
    assert not failed, [(r.case["topic"], [c for c in r.checks if not c.passed]) for r in failed]


def test_score_rejects_missing_revision_notes_below_threshold():
    # score < 8 but the workflow never actually revised — the harness must
    # catch this, not just confirm the happy path where revision did run.
    case = {"topic": "test topic", "audience": "", "tone": "clear", "postGoal": "explain"}
    broken_result = {
        "criticFeedback": {"score": 4, "needsRevision": True},
        "revisionNotes": None,
        "groundednessResult": {"status": "grounded"},
        "finalPost": {
            "hook": "hook",
            "hashtags": ["a"],
            "fullPost": "post about the test topic",
        },
    }
    checks = _score(case, broken_result)
    contract_check = next(c for c in checks if c.name == "self_correction_contract_honored")
    assert contract_check.passed is False


def test_score_rejects_unnecessary_revision_above_threshold():
    case = {"topic": "test topic", "audience": "", "tone": "clear", "postGoal": "explain"}
    broken_result = {
        "criticFeedback": {"score": 9, "needsRevision": False},
        "revisionNotes": "revised anyway, contradicting its own score",
        "groundednessResult": {"status": "grounded"},
        "finalPost": {
            "hook": "hook",
            "hashtags": ["a"],
            "fullPost": "post about the test topic",
        },
    }
    checks = _score(case, broken_result)
    contract_check = next(c for c in checks if c.name == "self_correction_contract_honored")
    assert contract_check.passed is False


def test_score_rejects_unsupported_groundedness():
    case = {"topic": "test topic", "audience": "", "tone": "clear", "postGoal": "explain"}
    result = {
        "criticFeedback": {"score": 9, "needsRevision": False},
        "revisionNotes": None,
        "groundednessResult": {"status": "unsupported"},
        "finalPost": {
            "hook": "hook",
            "hashtags": ["a"],
            "fullPost": "post about the test topic",
        },
    }
    checks = _score(case, result)
    groundedness_check = next(c for c in checks if c.name == "groundedness_not_unsupported")
    assert groundedness_check.passed is False


def test_score_rejects_off_topic_post():
    case = {
        "topic": "quarterly revenue forecasting",
        "audience": "",
        "tone": "clear",
        "postGoal": "explain",
    }
    result = {
        "criticFeedback": {"score": 9, "needsRevision": False},
        "revisionNotes": None,
        "groundednessResult": {"status": "grounded"},
        "finalPost": {
            "hook": "hook",
            "hashtags": ["a"],
            "fullPost": "a completely unrelated post about lunch options nearby",
        },
    }
    checks = _score(case, result)
    topic_check = next(c for c in checks if c.name == "stays_on_topic")
    assert topic_check.passed is False


def test_eval_result_passed_is_false_on_error():
    result = EvalResult(case={"topic": "x"}, error="boom")
    assert result.passed is False
