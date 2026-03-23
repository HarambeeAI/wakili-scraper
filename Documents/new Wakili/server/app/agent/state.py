"""Shared schemas for citations, messages, and agent state."""

from __future__ import annotations

from enum import Enum
from typing import Any
from pydantic import BaseModel, Field


class CitationType(str, Enum):
    CASE = "case"
    STATUTE = "statute"
    REGULATION = "regulation"
    SECONDARY = "secondary"
    WEB = "web"


class Citation(BaseModel):
    """A legal citation returned by RAG tools."""

    id: str
    title: str
    court: str = ""
    year: str = ""
    type: CitationType = CitationType.CASE
    relevance: float = 0.0
    snippet: str = ""
    pages: str = ""
    source_doc_id: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)


class MessagePayload(BaseModel):
    """A single chat message with optional citations."""

    id: str = ""
    role: str  # "user" | "assistant"
    content: str
    citations: list[Citation] = Field(default_factory=list)


class ChatRequest(BaseModel):
    """Incoming chat request from the frontend."""

    message: str
    thread_id: str = ""
    web_enabled: bool = False
    deep_research: bool = False
    jurisdiction_filter: list[str] = Field(default_factory=list)


class ExportRequest(BaseModel):
    """Request to export a conversation."""

    thread_id: str
    format: str = "pdf"  # "pdf" | "docx" | "pptx"


class ExportResponse(BaseModel):
    """Response with download URL for exported document."""

    download_url: str
    format: str
    filename: str
