"""_run_workflow used to report a missing/unparseable tool call, or a
resolved contact ID absent from the uploaded list, as `status: "not_found"`
— indistinguishable from the model genuinely finding no matching contact.
Worse, a broken generate_draft call (after a contact WAS resolved) was
reported the same way, actively implying no contact exists when one does.

These run the real _run_workflow end to end (not a single branch in
isolation) with a per-tool-name-aware fake OpenAI client, proving contract
failures now raise instead of masquerading as a legitimate domain result.
Mirrors test_cs02_workflow_contract_failure.py's approach for the sibling bug.
"""

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock

import pytest

from routes.cs01_workflow import _run_workflow
from schemas.cs01 import ParsedContact

_CONTACTS = [
    ParsedContact(id="c1", name="Ada Lovelace", email="ada@example.com", department="Engineering"),
    ParsedContact(
        id="c2", name="Grace Hopper", email="grace@example.com", department="Engineering"
    ),
]

_RESOLUTION_EXACT = {
    "status": "exact_match",
    "selected_contact_id": "c1",
    "matched_contact_ids": None,
    "suggested_contact_id": None,
    "reasoning": "Only Ada matches.",
    "confidence": 0.95,
}
_RESOLUTION_AMBIGUOUS_UNRESOLVABLE = {
    "status": "ambiguous",
    "selected_contact_id": None,
    "matched_contact_ids": ["does-not-exist"],
    "suggested_contact_id": "also-does-not-exist",
    "reasoning": "Hallucinated ids.",
    "confidence": 0.5,
}
_DRAFT_ARGS = {
    "subject": "Hello Ada",
    "body": "Hi Ada,\n\nReaching out.\n\nBest.",
    "tone": "professional",
}


def _tool_call(name: str, arguments: dict) -> MagicMock:
    call = MagicMock()
    call.type = "function"
    call.function.name = name
    call.function.arguments = json.dumps(arguments)
    call.id = "call_1"
    call.model_dump = lambda: {
        "id": call.id,
        "type": "function",
        "function": {"name": name, "arguments": call.function.arguments},
    }
    return call


def _make_client(
    *,
    resolution_args: dict | None,
    empty_resolution_call: bool,
    draft_args: dict | None,
    empty_draft_call: bool,
) -> MagicMock:
    async def create(**kwargs):
        tool_name = kwargs["tools"][0]["function"]["name"]
        completion = MagicMock()
        if tool_name == "resolve_contact":
            if empty_resolution_call:
                completion.choices = [MagicMock(message=MagicMock(tool_calls=[]))]
            else:
                completion.choices = [
                    MagicMock(
                        message=MagicMock(tool_calls=[_tool_call(tool_name, resolution_args)])
                    )
                ]
        else:
            if empty_draft_call:
                completion.choices = [MagicMock(message=MagicMock(tool_calls=[]))]
            else:
                completion.choices = [
                    MagicMock(message=MagicMock(tool_calls=[_tool_call(tool_name, draft_args)]))
                ]
        return completion

    client = MagicMock()
    client.chat.completions.create = AsyncMock(side_effect=create)
    return client


def test_full_workflow_succeeds_when_every_tool_call_holds():
    client = _make_client(
        resolution_args=_RESOLUTION_EXACT,
        empty_resolution_call=False,
        draft_args=_DRAFT_ARGS,
        empty_draft_call=False,
    )
    result = asyncio.run(_run_workflow(client, "model", _CONTACTS, "email ada", None, None))
    assert result["status"] == "draft_ready"


def test_raises_when_model_never_calls_resolve_contact():
    client = _make_client(
        resolution_args=None,
        empty_resolution_call=True,
        draft_args=_DRAFT_ARGS,
        empty_draft_call=False,
    )
    with pytest.raises(RuntimeError):
        asyncio.run(_run_workflow(client, "model", _CONTACTS, "email ada", None, None))


def test_raises_when_ambiguous_ids_do_not_match_any_uploaded_contact():
    client = _make_client(
        resolution_args=_RESOLUTION_AMBIGUOUS_UNRESOLVABLE,
        empty_resolution_call=False,
        draft_args=_DRAFT_ARGS,
        empty_draft_call=False,
    )
    with pytest.raises(RuntimeError):
        asyncio.run(_run_workflow(client, "model", _CONTACTS, "email someone", None, None))


def test_raises_when_exact_match_selects_a_nonexistent_contact_id():
    bad_resolution = {**_RESOLUTION_EXACT, "selected_contact_id": "does-not-exist"}
    client = _make_client(
        resolution_args=bad_resolution,
        empty_resolution_call=False,
        draft_args=_DRAFT_ARGS,
        empty_draft_call=False,
    )
    with pytest.raises(RuntimeError):
        asyncio.run(_run_workflow(client, "model", _CONTACTS, "email ada", None, None))


def test_raises_when_contact_resolved_but_generate_draft_is_never_called():
    client = _make_client(
        resolution_args=_RESOLUTION_EXACT,
        empty_resolution_call=False,
        draft_args=None,
        empty_draft_call=True,
    )
    with pytest.raises(RuntimeError):
        asyncio.run(_run_workflow(client, "model", _CONTACTS, "email ada", None, None))


def test_legitimate_not_found_result_still_returns_normally_without_raising():
    resolution_not_found = {
        "status": "not_found",
        "selected_contact_id": None,
        "matched_contact_ids": None,
        "suggested_contact_id": None,
        "reasoning": "No contact matches this request.",
        "confidence": 0.1,
    }
    client = _make_client(
        resolution_args=resolution_not_found,
        empty_resolution_call=False,
        draft_args=_DRAFT_ARGS,
        empty_draft_call=False,
    )
    result = asyncio.run(_run_workflow(client, "model", _CONTACTS, "email nobody", None, None))
    assert result["status"] == "not_found"
