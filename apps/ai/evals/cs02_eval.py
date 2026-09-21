"""
CS02 evaluation harness — Research-to-Post Multi-Agent Workflow.

Runs a fixed set of test topics through the actual workflow function
(_run_live_workflow if OPENAI_API_KEY is configured, _build_mock_result
otherwise — the same branch /multi-agent-post/run itself uses) and scores
each result against a rubric: the Critic node's own score, the Groundedness
Check's status, and a handful of structural checks on the generated post.
This is deliberately not a fuzzy "does it look okay" judgment — every check
is a concrete assertion against the actual response shape the frontend
consumes.

Run directly for a human-readable report:

    uv run python -m evals.cs02_eval

Mock mode needs no API key and costs nothing; live mode requires
OPENAI_API_KEY (and, for the optional web-context step, TAVILY_API_KEY)
configured in the environment.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any, Optional

from routes.cs02_post import _build_mock_result, _run_live_workflow
from settings import settings

# ─── Test set ──────────────────────────────────────────────────────────────
# Deliberately varied: different tones, goals, and audiences, including one
# topic with no audience specified (audience is optional in the schema).

CASES: list[dict[str, str]] = [
    {
        "topic": "Why most RAG pipelines fail without a groundedness check",
        "audience": "engineering leaders",
        "tone": "technical",
        "postGoal": "explain",
    },
    {
        "topic": "What I learned shipping a multi-agent workflow to production",
        "audience": "",
        "tone": "founder-style",
        "postGoal": "lesson",
    },
    {
        "topic": "Announcing our new AI-assisted onboarding flow",
        "audience": "prospective customers",
        "tone": "professional",
        "postGoal": "announce",
    },
    {
        "topic": "Rate limiting public LLM demos without breaking the UX",
        "audience": "developers",
        "tone": "practical",
        "postGoal": "discuss",
    },
    {
        "topic": "A quick summary of what evaluation harnesses actually check",
        "audience": "product managers",
        "tone": "concise",
        "postGoal": "summarize",
    },
    {
        "topic": "Design engineering is not just pretty frontend code",
        "audience": "designers and engineers",
        "tone": "clear",
        "postGoal": "explain",
    },
]


# ─── Rubric ────────────────────────────────────────────────────────────────


@dataclass
class Check:
    name: str
    passed: bool
    detail: str


@dataclass
class EvalResult:
    case: dict[str, str]
    checks: list[Check] = field(default_factory=list)
    error: Optional[str] = None

    @property
    def passed(self) -> bool:
        return self.error is None and all(c.passed for c in self.checks)


def _score(case: dict[str, str], result: dict[str, Any]) -> list[Check]:
    critic = result.get("criticFeedback") or {}
    groundedness = result.get("groundednessResult") or {}
    final_post = result.get("finalPost") or {}
    full_post = final_post.get("fullPost") or ""

    critic_score = critic.get("score", 0)
    needs_revision = critic.get("needsRevision", False)
    revision_notes = result.get("revisionNotes")
    groundedness_status = groundedness.get("status", "unsupported")

    # A cheap on-topic check: at least one significant word (>4 chars, to
    # skip filler like "with"/"most") from the topic shows up in the post.
    # Catches the failure mode where the model drifts to a generic post
    # unrelated to what was actually asked for.
    topic_words = [w.lower() for w in case["topic"].split() if len(w) > 4]
    on_topic = any(w in full_post.lower() for w in topic_words) if topic_words else True

    # NOT "is the critic score high" — that's the score of the *first*
    # draft, before the workflow's own revision loop runs, so a low first
    # score is expected behavior, not a failure (a first live run of this
    # harness scored 4-5/10 on several cases and initially looked broken
    # until checking revisionNotes showed the self-correction had, in
    # fact, already happened). What's actually verifiable is the
    # architectural contract in _should_revise/_skip_revision_node: below
    # 8 must produce revision notes, 8+ must skip revision entirely.
    if critic_score < 8:
        self_correction_ok = needs_revision is True and bool(revision_notes)
        self_correction_detail = (
            f"score {critic_score}/10 (pre-revision) -> needsRevision={needs_revision}, "
            f"revisionNotes {'present' if revision_notes else 'MISSING'}"
        )
    else:
        self_correction_ok = not revision_notes
        self_correction_detail = (
            f"score {critic_score}/10 -> revision correctly skipped"
            if self_correction_ok
            else f"score {critic_score}/10 but revisionNotes present — should have been skipped"
        )

    return [
        Check("self_correction_contract_honored", self_correction_ok, self_correction_detail),
        Check(
            "groundedness_not_unsupported",
            groundedness_status != "unsupported",
            f"Groundedness status: {groundedness_status}",
        ),
        Check("has_hook", bool(final_post.get("hook")), "finalPost.hook is non-empty"),
        Check(
            "has_hashtags_within_limit",
            1 <= len(final_post.get("hashtags") or []) <= 4,
            f"{len(final_post.get('hashtags') or [])} hashtags (contract: 1-4)",
        ),
        Check(
            "full_post_within_length",
            0 < len(full_post) <= 3000,
            f"fullPost is {len(full_post)} chars (contract: 1-3000)",
        ),
        Check("stays_on_topic", on_topic, f"topic word found in fullPost: {on_topic}"),
    ]


# ─── Runner ────────────────────────────────────────────────────────────────


async def run_case(client: Any, case: dict[str, str]) -> EvalResult:
    try:
        if client is not None:
            result = await _run_live_workflow(
                client, case["topic"], case["audience"], case["tone"], case["postGoal"]
            )
        else:
            result = _build_mock_result(case["topic"], case["audience"])
    except Exception as exc:  # noqa: BLE001 - eval harness surfaces any failure as a scored case
        return EvalResult(case=case, error=str(exc))

    return EvalResult(case=case, checks=_score(case, result))


async def run_eval(cases: list[dict[str, str]] | None = None) -> list[EvalResult]:
    cases = cases if cases is not None else CASES
    client = None
    if settings.OPENAI_API_KEY:
        from openai_client import make_openai_client

        client = make_openai_client(settings.OPENAI_API_KEY, settings.OPENAI_BASE_URL)

    return [await run_case(client, case) for case in cases]


def print_report(results: list[EvalResult]) -> None:
    passed = sum(1 for r in results if r.passed)
    mode = "LIVE" if settings.OPENAI_API_KEY else "MOCK"
    print(f"\nCS02 eval — {mode} mode — {passed}/{len(results)} cases passed\n")

    for r in results:
        status = "PASS" if r.passed else "FAIL"
        print(f"[{status}] {r.case['topic'][:60]}")
        if r.error:
            print(f"        ERROR: {r.error}")
            continue
        for c in r.checks:
            mark = "✓" if c.passed else "✗"
            print(f"        {mark} {c.name}: {c.detail}")
    print()


if __name__ == "__main__":
    results = asyncio.run(run_eval())
    print_report(results)
