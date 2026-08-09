import re
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from settings import settings

# Same shape as the EMAIL_RE used in routes/cs01_workflow.py's _normalise_contacts —
# a plain regex check, consistent with the rest of this codebase, rather than
# pulling in EmailStr/email-validator as a new dependency.
_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

# ─── Upload request ───────────────────────────────────────────────────────────


class UploadRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    filename: str
    content: str  # base64
    mimeType: str


# ─── Parsed contact ───────────────────────────────────────────────────────────
# Field caps mirror packages/types' parsedContactSchema — this endpoint is
# reachable directly (a client can call /ai-workflow/run without ever calling
# /ai-workflow/parse first), so the frontend's Zod limits alone don't bound
# what the server actually accepts.


class ParsedContact(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=200)
    email: str = Field(max_length=254)
    department: Optional[str] = Field(default=None, max_length=200)
    role: Optional[str] = Field(default=None, max_length=200)
    company: Optional[str] = Field(default=None, max_length=200)
    notes: Optional[str] = Field(default=None, max_length=1000)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if not _EMAIL_RE.match(v):
            raise ValueError("Invalid email address")
        return v


class UploadResponse(BaseModel):
    contacts: list[ParsedContact]
    count: int


# ─── Workflow run request ─────────────────────────────────────────────────────


class WorkflowRunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    contacts: list[ParsedContact] = Field(min_length=1, max_length=100)
    request: str
    # Matches ParsedContact.id's own max_length above — a real contact ID
    # from an uploaded list can never exceed that; anything longer is
    # already invalid before the against-uploaded-contacts check below runs.
    confirmedContactId: Optional[str] = Field(default=None, max_length=50)
    useWebContext: bool = False

    @field_validator("request")
    @classmethod
    def validate_request(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 5:
            raise ValueError("Request must be at least 5 characters")
        if len(v) > settings.MAX_REQUEST_LENGTH:
            raise ValueError(f"Request must be {settings.MAX_REQUEST_LENGTH} characters or fewer")
        return v


# ─── Email draft ──────────────────────────────────────────────────────────────


class EmailDraft(BaseModel):
    to: str
    toEmail: str
    subject: str
    body: str
    tone: str


class WorkflowOption(BaseModel):
    contact: ParsedContact
    score: float
    reasoning: str


# ─── LLM tool output models ────────────────────────────────────────────────
# One model per tool call in routes/cs01_workflow.py. strict:true on each
# tool schema already guarantees the API response matches this shape;
# validating through these models on top of that is a second, independent
# check — mirrors the same pattern used for CS02's node outputs
# (schemas/cs02.py).


class ResolutionOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["exact_match", "ambiguous", "not_found"]
    selected_contact_id: Optional[str] = None
    matched_contact_ids: Optional[list[str]] = None
    suggested_contact_id: Optional[str] = None
    reasoning: str
    # Tool schema documents "Confidence 0.0-1.0" as prose only — nothing
    # enforced that range at the API level (unlike strict:true's effect on
    # required fields/types), so an out-of-range value would otherwise pass
    # straight through to the response unchecked.
    confidence: float = Field(ge=0, le=1)


class DraftOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Single contract shared with _DRAFT_TOOL's tool schema in
    # routes/cs01_workflow.py: subject max 80 chars, body max 1500 chars.
    # tone is a real Literal because _DRAFT_TOOL's tone property now
    # declares a matching JSON schema "enum" (mirrors GroundednessOutput's
    # status field in schemas/cs02.py) — strict:true genuinely enforces
    # that at the API level, so this isn't rejecting live variance the API
    # never promised to prevent.
    subject: str = Field(min_length=1, max_length=80)
    body: str = Field(min_length=1, max_length=1500)
    tone: Literal["professional", "friendly", "formal", "concise"]
