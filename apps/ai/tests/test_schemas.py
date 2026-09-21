"""Tests for Pydantic schemas in schemas/cs01.py and schemas/cs03.py."""

import uuid

import pytest
from pydantic import ValidationError

from schemas.cs01 import DraftOutput, ParsedContact, ResolutionOutput, WorkflowRunRequest
from schemas.cs02 import CreatePostToolInput, MultiAgentPostRequest
from schemas.cs03 import RagAskRequest, RagUploadFile, RagUploadRequest
from schemas.seo import SeoStrategyRequest, Step1Output, Step2Output
from schemas.voice import VoiceAgentRequest

_VALID_SESSION_ID = str(uuid.uuid4())

# ─── WorkflowRunRequest ───────────────────────────────────────────────────────


def _contact(**kwargs) -> ParsedContact:
    defaults = {"id": "1", "name": "Test User", "email": "test@example.com"}
    return ParsedContact(**{**defaults, **kwargs})


def test_workflow_run_request_valid():
    req = WorkflowRunRequest(
        contacts=[_contact()],
        request="Write a follow-up email about the project status.",
    )
    assert req.request.startswith("Write")


def test_workflow_run_request_too_short():
    with pytest.raises(ValidationError):
        WorkflowRunRequest(contacts=[_contact()], request="Hi")


def test_workflow_run_request_too_long():
    with pytest.raises(ValidationError):
        WorkflowRunRequest(contacts=[_contact()], request="x" * 501)


def test_workflow_run_request_exactly_500_chars():
    req = WorkflowRunRequest(contacts=[_contact()], request="a" * 500)
    assert len(req.request) == 500


def test_workflow_run_request_strips_whitespace():
    req = WorkflowRunRequest(contacts=[_contact()], request="  Hello world  ")
    assert req.request == "Hello world"


def test_workflow_run_request_rejects_empty_contacts():
    with pytest.raises(ValidationError):
        WorkflowRunRequest(contacts=[], request="A request long enough to pass validation")


def test_workflow_run_request_rejects_over_100_contacts():
    contacts = [_contact(id=str(i)) for i in range(101)]
    with pytest.raises(ValidationError):
        WorkflowRunRequest(contacts=contacts, request="A request long enough to pass validation")


def test_workflow_run_request_accepts_exactly_100_contacts():
    contacts = [_contact(id=str(i)) for i in range(100)]
    req = WorkflowRunRequest(contacts=contacts, request="A request long enough to pass validation")
    assert len(req.contacts) == 100


def test_parsed_contact_rejects_name_over_200_chars():
    with pytest.raises(ValidationError):
        _contact(name="A" * 201)


def test_parsed_contact_rejects_notes_over_1000_chars():
    with pytest.raises(ValidationError):
        _contact(notes="A" * 1001)


def test_parsed_contact_rejects_invalid_email():
    with pytest.raises(ValidationError):
        _contact(email="not-an-email")


def test_workflow_run_request_rejects_confirmed_contact_id_over_50_chars():
    # A real contact ID from an uploaded list can never exceed
    # ParsedContact.id's own 50-char cap — anything longer is already
    # invalid regardless of whether it matches an uploaded contact.
    with pytest.raises(ValidationError):
        WorkflowRunRequest(
            contacts=[_contact()],
            request="A request long enough to pass validation",
            confirmedContactId="x" * 51,
        )


# ─── ResolutionOutput / DraftOutput ────────────────────────────────────────
# ResolutionOutput's confidence range is documented only as prose
# ("Confidence 0.0-1.0") — strict:true enforces required fields/types/enums,
# not numeric ranges, so it's checked here instead. DraftOutput's
# subject/body length and tone enum are now genuinely enforced at the API
# level too (a real JSON schema "enum" on _DRAFT_TOOL's tone property,
# matching the tool description's documented char limits) — these tests
# confirm the Pydantic side agrees with that same contract.


def test_resolution_output_rejects_confidence_above_one():
    with pytest.raises(ValidationError):
        ResolutionOutput(status="not_found", reasoning="x", confidence=1.5)


def test_resolution_output_rejects_negative_confidence():
    with pytest.raises(ValidationError):
        ResolutionOutput(status="not_found", reasoning="x", confidence=-0.1)


def test_resolution_output_accepts_confidence_at_bounds():
    low = ResolutionOutput(status="not_found", reasoning="x", confidence=0.0)
    high = ResolutionOutput(status="not_found", reasoning="x", confidence=1.0)
    assert low.confidence == 0.0
    assert high.confidence == 1.0


def test_draft_output_accepts_subject_and_body_at_max_length():
    draft = DraftOutput(subject="s" * 80, body="b" * 1500, tone="professional")
    assert len(draft.subject) == 80
    assert len(draft.body) == 1500


def test_draft_output_rejects_subject_over_80_chars():
    with pytest.raises(ValidationError):
        DraftOutput(subject="s" * 81, body="body", tone="professional")


def test_draft_output_rejects_body_over_1500_chars():
    with pytest.raises(ValidationError):
        DraftOutput(subject="subject", body="b" * 1501, tone="professional")


def test_draft_output_rejects_empty_subject():
    with pytest.raises(ValidationError):
        DraftOutput(subject="", body="body", tone="professional")


def test_draft_output_rejects_empty_body():
    with pytest.raises(ValidationError):
        DraftOutput(subject="subject", body="", tone="professional")


def test_draft_output_rejects_tone_outside_enum():
    with pytest.raises(ValidationError):
        DraftOutput(subject="subject", body="body", tone="excited")


# ─── RagAskRequest ───────────────────────────────────────────────────────────
# sessionId must be a server-generated uuid4 (see rag_upload in
# routes/cs03_rag.py) — a client can no longer choose or guess an arbitrary
# ID format that happens to fit within length bounds.


def test_rag_ask_request_valid():
    req = RagAskRequest(question="What is the main finding?", sessionId=_VALID_SESSION_ID)
    assert req.question == "What is the main finding?"


def test_rag_ask_request_too_short():
    with pytest.raises(ValidationError):
        RagAskRequest(question="Hi", sessionId=_VALID_SESSION_ID)


def test_rag_ask_request_too_long():
    with pytest.raises(ValidationError):
        RagAskRequest(question="q" * 501, sessionId=_VALID_SESSION_ID)


def test_rag_ask_request_rejects_non_uuid_session_id():
    with pytest.raises(ValidationError):
        RagAskRequest(question="What is the main finding?", sessionId="not-a-uuid")


def test_rag_ask_request_rejects_client_chosen_readable_session_id():
    # This exact string used to be accepted (any 8-64 char id) — the whole
    # point of this change is that a client can no longer pick its own ID.
    with pytest.raises(ValidationError):
        RagAskRequest(question="What is the main finding?", sessionId="session-abc123")


# ─── RagUploadRequest ─────────────────────────────────────────────────────────
# No sessionId field: the server generates one in rag_upload and returns it —
# the client has no say in what ID its documents are indexed under.


def _rag_file(filename: str = "doc.pdf") -> RagUploadFile:
    return RagUploadFile(filename=filename, content="dGVzdA==", mimeType="application/pdf")


def test_rag_upload_request_valid():
    req = RagUploadRequest(files=[_rag_file()])
    assert len(req.files) == 1


def test_rag_upload_request_empty_files():
    with pytest.raises(ValidationError):
        RagUploadRequest(files=[])


def test_rag_upload_request_too_many_files():
    with pytest.raises(ValidationError):
        RagUploadRequest(files=[_rag_file(f"doc{i}.pdf") for i in range(4)])


# ─── Unknown fields ───────────────────────────────────────────────────────────
# extra="forbid" on every request model — a client can no longer smuggle
# undeclared fields through validation.


def test_workflow_run_request_rejects_unknown_field():
    with pytest.raises(ValidationError):
        WorkflowRunRequest(
            contacts=[_contact()],
            request="Write a follow-up email about the project status.",
            extra_field="not allowed",
        )


def test_parsed_contact_rejects_unknown_field():
    with pytest.raises(ValidationError):
        _contact(extra_field="not allowed")


def test_rag_ask_request_rejects_unknown_field():
    with pytest.raises(ValidationError):
        RagAskRequest(
            question="What is the main finding?",
            sessionId=_VALID_SESSION_ID,
            extra_field="not allowed",
        )


def test_rag_upload_request_rejects_unknown_field():
    with pytest.raises(ValidationError):
        RagUploadRequest(files=[_rag_file()], extra_field="not allowed")


def test_rag_upload_file_rejects_unknown_field():
    with pytest.raises(ValidationError):
        RagUploadFile(
            filename="doc.pdf", content="dGVzdA==", mimeType="application/pdf", extra_field="x"
        )


def test_rag_upload_file_rejects_filename_over_255_chars():
    with pytest.raises(ValidationError):
        RagUploadFile(filename="a" * 256 + ".pdf", content="dGVzdA==", mimeType="application/pdf")


def test_rag_upload_file_rejects_mime_type_over_100_chars():
    with pytest.raises(ValidationError):
        RagUploadFile(filename="doc.pdf", content="dGVzdA==", mimeType="a" * 101)


def test_multi_agent_post_request_rejects_unknown_field():
    with pytest.raises(ValidationError):
        MultiAgentPostRequest(
            topic="A topic long enough to pass validation",
            tone="clear",
            postGoal="explain",
            extra_field="not allowed",
        )


def test_multi_agent_post_request_rejects_audience_over_160_chars():
    with pytest.raises(ValidationError):
        MultiAgentPostRequest(
            topic="A topic long enough to pass validation",
            tone="clear",
            postGoal="explain",
            audience="a" * 161,
        )


def test_create_post_tool_input_rejects_audience_over_160_chars():
    with pytest.raises(ValidationError):
        CreatePostToolInput(
            topic="A topic long enough to pass validation",
            audience="a" * 161,
        )


def test_seo_strategy_request_rejects_unknown_field():
    with pytest.raises(ValidationError):
        SeoStrategyRequest(topic="A topic long enough to pass validation", extra_field="x")


def test_voice_agent_request_rejects_unknown_field():
    with pytest.raises(ValidationError):
        VoiceAgentRequest(
            audio_b64="dGVzdA==",
            filename="recording.webm",
            duration_seconds=5.0,
            extra_field="not allowed",
        )


# ─── SEO Step1Output / Step2Output ─────────────────────────────────────────
# response_format={"type": "json_object"} guarantees valid JSON syntax only,
# not any particular shape, so these models are the only structural check on
# that response — deliberately lenient (extra="allow", every field optional)
# so they reject genuinely malformed output without rejecting a live
# response that's merely a little looser than the documented shape.


def test_step1_output_accepts_well_formed_data():
    result = Step1Output.model_validate(
        {
            "extracted_business_context": {
                "business_type": "SaaS",
                "core_service": "Project management software",
                "target_audience": "small teams",
                "value_proposition": "Simple and fast",
                "pain_points": ["too complex tools", "slow onboarding"],
                "competitive_differentiators": ["ease of use"],
            },
            "keyword_candidates": [
                {
                    "term": "project management tool",
                    "type": "seed",
                    "intent": "commercial_investigation",
                }
            ],
            "intent_clusters": [
                {
                    "intent": "commercial_investigation",
                    "description": "comparing tools",
                    "terms": ["best project management tool"],
                    "business_relevance": "high",
                }
            ],
            "summary": "Strong opportunity in the SMB segment.",
        }
    )
    assert result.summary == "Strong opportunity in the SMB segment."
    assert len(result.keyword_candidates) == 1


def test_step1_output_lenient_about_missing_and_extra_fields():
    # Missing summary, extra unexpected top-level field — must not raise.
    result = Step1Output.model_validate(
        {
            "extracted_business_context": {},
            "keyword_candidates": [],
            "intent_clusters": [],
            "unexpected_field": "the model added this",
        }
    )
    assert result.summary == ""


def test_step1_output_rejects_genuinely_malformed_shape():
    # keyword_candidates as a plain string instead of a list of objects —
    # not coercible, must raise rather than silently accepting garbage.
    with pytest.raises(ValidationError):
        Step1Output.model_validate({"keyword_candidates": "not a list"})


def test_step2_output_accepts_well_formed_data():
    result = Step2Output.model_validate(
        {
            "reranked_opportunities": [
                {
                    "rank": 1,
                    "term": "project management tool",
                    "intent": "commercial_investigation",
                    "opportunity_score": 85,
                    "lead_relevance": "high",
                    "business_relevance": "high",
                    "intent_fit": "strong",
                    "content_gap_potential": "medium",
                    "conversion_closeness": "high",
                    "suggested_content_format": "Landing Page",
                    "cta_angle": "Book a free demo",
                    "why_ranked_here": "Strong commercial intent.",
                }
            ],
            "content_ideas": [],
            "lead_generation_angles": [],
            "roadmap": [],
        }
    )
    assert result.reranked_opportunities[0].opportunity_score == 85


def test_step2_output_rejects_genuinely_malformed_shape():
    with pytest.raises(ValidationError):
        Step2Output.model_validate({"reranked_opportunities": "not a list"})
