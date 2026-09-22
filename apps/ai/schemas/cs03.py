import uuid

from pydantic import BaseModel, ConfigDict, Field, field_validator


class RagUploadFile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    filename: str = Field(min_length=1, max_length=255)
    content: str  # base64
    mimeType: str = Field(min_length=1, max_length=100)


class RagUploadRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    files: list[RagUploadFile]

    @field_validator("files")
    @classmethod
    def validate_files(cls, v: list) -> list:
        if not v:
            raise ValueError("At least one file required")
        # The upper bound is intentionally NOT enforced here as a hardcoded
        # number — rag_upload (routes/cs03_rag.py) already checks
        # len(req.files) > settings.MAX_PDFS. A second, hardcoded cap here
        # would silently win over that check regardless of what MAX_PDFS is
        # actually configured to (validation runs before the route body),
        # making the setting look configurable while not actually being so.
        return v


class RagAskRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: str
    sessionId: str

    @field_validator("question")
    @classmethod
    def validate_question(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Question too short")
        if len(v) > 500:
            raise ValueError("Question too long")
        return v

    @field_validator("sessionId")
    @classmethod
    def validate_session_id(cls, v: str) -> str:
        # Session IDs are always server-generated uuid4 strings (see
        # rag_upload in routes/cs03_rag.py) — reject anything else up front
        # instead of relying solely on a dict-miss to catch malformed input.
        #
        # uuid.UUID(v, version=N) does NOT validate that v is version N — it
        # parses v as any UUID and then force-sets the version bits on the
        # returned object to N, regardless of what version v actually was.
        # A valid uuid1 string passes this uncaught. Parsing without a
        # forced version and checking .version explicitly is the only way
        # to actually reject a non-v4 UUID.
        try:
            parsed = uuid.UUID(v)
        except ValueError as exc:
            raise ValueError("Invalid session ID") from exc
        if parsed.version != 4:
            raise ValueError("Invalid session ID")
        return v
