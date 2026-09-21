from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class VoiceAgentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    audio_b64: str = Field(..., description="Base64-encoded audio file")
    filename: str = Field(..., description="Filename with extension, e.g. recording.webm")
    duration_seconds: float = Field(..., ge=0, le=20)


class LatencyBreakdown(BaseModel):
    stt_ms: int
    intent_ms: int
    tool_ms: int
    llm_ms: int
    tts_ms: int
    total_ms: int


class VoiceAgentResponse(BaseModel):
    transcript: str
    intent: str
    safety_state: str
    tool_used: str
    response_text: str
    confidence: float
    handoff_required: bool
    latency_breakdown: LatencyBreakdown
    audio_b64: str


class VoiceStatusResponse(BaseModel):
    available: bool
    reason: Optional[str] = None
