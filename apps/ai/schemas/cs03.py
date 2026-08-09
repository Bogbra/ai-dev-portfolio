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
        if len(v) > 3:
            raise ValueError("Maximum 3 PDFs allowed")
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
        try:
            uuid.UUID(v, version=4)
        except ValueError as exc:
            raise ValueError("Invalid session ID") from exc
        return v
