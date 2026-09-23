"""_run_live_workflow's per-node writer/critic/reviser fallbacks (see their
own comments in routes/cs02_post.py) never raised on their own — necessary
so one node's hiccup doesn't abort the whole graph, but nothing downstream
ever checked how many nodes actually had to use theirs before returning
"status": "final_ready" as if the run had genuinely succeeded. That
silently contradicted this project's own "no silent mock fallback on a
genuine provider error" principle, and specifically the MCP tool's promise
to surface real execution problems as a ToolError (mcp_server.py) rather
than a normal-looking result.

These run the real LangGraph end to end (not a single node in isolation)
to prove the failure actually propagates out of _run_live_workflow itself.
"""

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock

import pytest

from routes.cs02_post import _run_live_workflow


def _tool_call(name: str, arguments: dict) -> MagicMock:
    call = MagicMock()
    call.type = "function"
    call.function.name = name
    call.function.arguments = json.dumps(arguments)
    return call


_RESEARCH_ARGS = {"context_points": ["Point one.", "Point two."], "key_themes": ["theme"]}
_WRITER_ARGS = {
    "hook": "Hook.",
    "body": "Body.",
    "closing_line": "Closing.",
    "hashtags": ["AI"],
    "full_post": "Hook.\n\nBody.\n\nClosing.",
}
# score=9 skips the reviser node entirely, keeping the fixture below from
# needing a revise_post response too.
_CRITIC_ARGS = {
    "score": 9,
    "strengths": ["clear"],
    "issues": [],
    "revision_instructions": "",
    "needs_revision": False,
}
_GROUNDEDNESS_ARGS = {
    "status": "grounded",
    "supported_claims": ["Hook."],
    "unsupported_claims": [],
    "caution_notes": "",
}
# Only reached when critic's own contract fails (its fallback sets
# needsRevision=True, routing into the reviser node).
_REVISION_ARGS = {
    "hook": "Hook.",
    "body": "Body.",
    "closing_line": "Closing.",
    "hashtags": ["AI"],
    "revised_post": "Hook.\n\nBody.\n\nClosing.",
    "changes_made": "Tightened the closing.",
    "remaining_risks": "",
}

_CANNED_BY_TOOL = {
    "research_topic": _RESEARCH_ARGS,
    "write_linkedin_post": _WRITER_ARGS,
    "critique_post": _CRITIC_ARGS,
    "check_groundedness": _GROUNDEDNESS_ARGS,
    "revise_post": _REVISION_ARGS,
}


def _make_client(*, fail_tool: str | None) -> MagicMock:
    """A fake OpenAI client that answers whichever tool the node under the
    graph's current step asked for, based on the single tool in that
    call's `tools=[...]` — except `fail_tool`, which gets an empty
    tool_calls list (the "model didn't call the tool" contract failure).
    """

    async def create(**kwargs):
        tool_name = kwargs["tools"][0]["function"]["name"]
        completion = MagicMock()
        if tool_name == fail_tool:
            completion.choices = [MagicMock(message=MagicMock(tool_calls=[]))]
        else:
            args = _CANNED_BY_TOOL[tool_name]
            completion.choices = [
                MagicMock(message=MagicMock(tool_calls=[_tool_call(tool_name, args)]))
            ]
        return completion

    client = MagicMock()
    client.chat.completions.create = AsyncMock(side_effect=create)
    return client


def test_full_graph_succeeds_when_every_node_contract_holds():
    client = _make_client(fail_tool=None)
    result = asyncio.run(_run_live_workflow(client, "a topic", "an audience", "clear", "explain"))
    assert result["status"] == "final_ready"


@pytest.mark.parametrize("fail_tool", ["write_linkedin_post", "critique_post"])
def test_full_graph_raises_when_a_node_contract_fails(fail_tool):
    client = _make_client(fail_tool=fail_tool)
    with pytest.raises(RuntimeError):
        asyncio.run(_run_live_workflow(client, "a topic", "an audience", "clear", "explain"))
