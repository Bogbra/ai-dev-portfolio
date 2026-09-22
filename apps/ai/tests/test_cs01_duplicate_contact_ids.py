"""/ai-workflow/parse always assigns sequential, unique contact ids, but the
API schema itself didn't enforce that — a request built directly against
/ai-workflow/run (bypassing the upload flow) could send duplicate ids,
making later `c.id == ...` contact resolution ambiguous. WorkflowRunRequest
now rejects duplicate ids explicitly.
"""

import pytest
from pydantic import ValidationError

from schemas.cs01 import WorkflowRunRequest


def _contact(id_: str, name: str = "Alice") -> dict:
    return {"id": id_, "name": name, "email": "alice@example.com"}


def test_rejects_duplicate_contact_ids():
    with pytest.raises(ValidationError):
        WorkflowRunRequest.model_validate(
            {
                "contacts": [_contact("1", "Alice"), _contact("1", "Bob")],
                "request": "Follow up about the budget review",
            }
        )


def test_accepts_unique_contact_ids():
    req = WorkflowRunRequest.model_validate(
        {
            "contacts": [_contact("1", "Alice"), _contact("2", "Bob")],
            "request": "Follow up about the budget review",
        }
    )
    assert [c.id for c in req.contacts] == ["1", "2"]
