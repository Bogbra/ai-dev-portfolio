"""Pydantic models for MCP tool responses (mcp_server.py)."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel


class ExecutionInfo(BaseModel):
    mode: Literal["live", "mock"]
    remainingLiveCalls: int
    liveCallLimit: int
    fallbackReason: Optional[Literal["live_quota_exhausted", "live_mode_disabled"]] = None
    durationMs: int


class PostSource(BaseModel):
    title: str = ""
    url: Optional[str] = None
    snippet: str = ""


class ResearchedPostResult(BaseModel):
    post: str
    sources: list[PostSource]
    groundedness: str
    groundingBasis: Literal["sources", "context", "none"]
    criticScore: int
    revised: bool


class CreateResearchedPostResponse(BaseModel):
    execution: ExecutionInfo
    result: ResearchedPostResult


class DemoStatusResponse(BaseModel):
    liveEnabled: bool
    liveCallLimit: int
    remainingLiveCalls: int
    fallbackMode: Literal["mock"]
