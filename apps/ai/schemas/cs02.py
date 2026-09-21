import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from settings import settings

# Named here (not inlined twice) so MultiAgentPostRequest (HTTP route) and
# CreatePostToolInput (MCP tool) can't silently drift apart on which values
# are actually valid.
PostTone = Literal["clear", "professional", "practical", "founder-style", "technical", "concise"]
PostGoal = Literal["explain", "lesson", "announce", "summarize", "discuss"]


class MultiAgentPostRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    topic: str
    audience: str = Field(default="", max_length=160)
    tone: PostTone
    postGoal: PostGoal
    useWebContext: bool = False

    @field_validator("topic")
    @classmethod
    def validate_topic(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 5:
            raise ValueError("Topic must be at least 5 characters")
        if len(v) > settings.MAX_TOPIC_LENGTH:
            raise ValueError(f"Topic must be {settings.MAX_TOPIC_LENGTH} characters or fewer")
        return v


class CreatePostToolInput(BaseModel):
    """Input for the create_researched_post MCP tool.

    A separate model from MultiAgentPostRequest (not a reuse of it as-is):
    MCP callers reasonably omit tone/postGoal, so both get lab-appropriate
    defaults here, and topic whitespace is fully normalised (not just
    stripped) since free-text tool arguments are more likely to contain
    stray internal whitespace than a UI-driven form submission.
    """

    model_config = ConfigDict(extra="forbid")

    topic: str
    audience: str = Field(default="", max_length=160)
    tone: PostTone = "professional"
    postGoal: PostGoal = "explain"
    useWebContext: bool = False

    @field_validator("topic")
    @classmethod
    def validate_topic(cls, v: str) -> str:
        v = re.sub(r"\s+", " ", v).strip()
        if len(v) < 5:
            raise ValueError("Topic must be at least 5 characters")
        if len(v) > settings.MAX_TOPIC_LENGTH:
            raise ValueError(f"Topic must be {settings.MAX_TOPIC_LENGTH} characters or fewer")
        return v


# ─── LangGraph node output models ──────────────────────────────────────────
# One model per tool call in routes/cs02_post.py. strict:true on each tool
# schema already guarantees the API response matches this shape (required
# fields present, correct types, valid enums, no extra fields); validating
# through these models on top of that is a second, independent check —
# catching it if that guarantee is ever violated (a provider bug, a model
# swapped in that doesn't support strict mode, ...) instead of trusting an
# unvalidated dict for the rest of the workflow.


class ResearchOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    context_points: list[str] = Field(default_factory=list)
    key_themes: list[str] = Field(default_factory=list)


class WriterOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    hook: str
    body: str
    closing_line: str
    hashtags: list[str] = Field(default_factory=list)
    full_post: str


class CriticOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    score: float
    strengths: list[str] = Field(default_factory=list)
    issues: list[str] = Field(default_factory=list)
    revision_instructions: str
    needs_revision: bool


class RevisionOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    hook: str
    body: str
    closing_line: str
    hashtags: list[str] = Field(default_factory=list)
    revised_post: str
    changes_made: str
    remaining_risks: str


class GroundednessOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["grounded", "needs_caution", "unsupported"]
    supported_claims: list[str] = Field(default_factory=list)
    unsupported_claims: list[str] = Field(default_factory=list)
    caution_notes: str = ""
