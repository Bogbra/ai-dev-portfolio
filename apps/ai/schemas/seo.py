from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SeoStrategyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    topic: str
    audience: str = ""
    market: str = "English"
    goal: Literal["traffic", "leads", "content", "visibility"] = "leads"
    url: str = ""

    @field_validator("topic")
    @classmethod
    def validate_topic(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 5:
            raise ValueError("Topic must be at least 5 characters")
        if len(v) > 400:
            raise ValueError("Topic must be 400 characters or fewer")
        return v

    @field_validator("audience")
    @classmethod
    def validate_audience(cls, v: str) -> str:
        return v.strip()[:200]

    @field_validator("market")
    @classmethod
    def validate_market(cls, v: str) -> str:
        return v.strip()[:80]

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        v = v.strip()
        if not v:
            return v
        if len(v) > 200:
            raise ValueError("URL must be 200 characters or fewer")
        return v


# ─── LLM output models (Step 1 / Step 2) ───────────────────────────────────
# These calls use response_format={"type": "json_object"} (valid-JSON-syntax
# guarantee only — no schema enforcement, unlike CS01/CS02's strict:true
# tool-calling), so unlike those, Pydantic here is the *only* structural
# check, not a second one on top of an API-level guarantee. Deliberately
# lenient — extra="allow", every field optional with a safe default, plain
# str/int instead of Literal enums — so a live response that's close to but
# not byte-for-byte the documented shape (_STEP1_SCHEMA / _STEP2_SCHEMA in
# routes/seo.py) still validates. The goal is catching genuinely malformed
# output (wrong top-level shape, wrong types) without becoming a new source
# of live failures over a model phrasing an enum-ish field slightly
# differently than the prompt's prose description asked for.


class _LenientModel(BaseModel):
    model_config = ConfigDict(extra="allow")


class ExtractedBusinessContext(_LenientModel):
    business_type: str = ""
    core_service: str = ""
    target_audience: str = ""
    value_proposition: str = ""
    pain_points: list[str] = Field(default_factory=list)
    competitive_differentiators: list[str] = Field(default_factory=list)


class KeywordCandidate(_LenientModel):
    term: str = ""
    type: str = ""
    intent: str = ""


class IntentCluster(_LenientModel):
    intent: str = ""
    description: str = ""
    terms: list[str] = Field(default_factory=list)
    business_relevance: str = ""


class Step1Output(_LenientModel):
    extracted_business_context: ExtractedBusinessContext = Field(
        default_factory=ExtractedBusinessContext
    )
    keyword_candidates: list[KeywordCandidate] = Field(default_factory=list)
    intent_clusters: list[IntentCluster] = Field(default_factory=list)
    summary: str = ""


class RerankedOpportunity(_LenientModel):
    rank: int = 0
    term: str = ""
    intent: str = ""
    opportunity_score: int = 0
    lead_relevance: str = ""
    business_relevance: str = ""
    intent_fit: str = ""
    content_gap_potential: str = ""
    conversion_closeness: str = ""
    suggested_content_format: str = ""
    cta_angle: str = ""
    why_ranked_here: str = ""


class ContentIdea(_LenientModel):
    title: str = ""
    format: str = ""
    target_terms: list[str] = Field(default_factory=list)
    rationale: str = ""


class LeadGenerationAngle(_LenientModel):
    angle: str = ""
    cta: str = ""
    target_terms: list[str] = Field(default_factory=list)
    rationale: str = ""


class RoadmapPhase(_LenientModel):
    phase: str = ""
    focus: str = ""
    items: list[str] = Field(default_factory=list)
    rationale: str = ""


class Step2Output(_LenientModel):
    reranked_opportunities: list[RerankedOpportunity] = Field(default_factory=list)
    content_ideas: list[ContentIdea] = Field(default_factory=list)
    lead_generation_angles: list[LeadGenerationAngle] = Field(default_factory=list)
    roadmap: list[RoadmapPhase] = Field(default_factory=list)


class CorrectedSeoOutput(Step1Output, Step2Output):
    """_correction_pass is asked to return the complete result — every
    Step1Output and Step2Output field together — with issues fixed in
    place, not just one step's slice of it. Previously that response was
    only checked with a bare `corrected.get("reranked_opportunities")`
    truthiness test, unlike the original step1/step2 calls this class
    otherwise mirrors. extra="allow" (inherited) preserves mode/warnings/
    metadata, which the correction prompt also echoes back but which
    aren't part of either step's own output shape.
    """
