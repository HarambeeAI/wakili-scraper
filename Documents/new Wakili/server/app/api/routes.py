"""FastAPI routes for chat, export, citations, and document retrieval."""

from __future__ import annotations

import io
import json
import logging
import os
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.config import settings
from app.auth import get_current_user
from app.database import get_db
from app.models import CitationRecord, Message, Thread, User
from app.agent.state import ChatRequest, ExportRequest, ExportResponse
from app.agent.legal_agent import invoke_agent, stream_agent, get_agent
from app.agent.deep_agent import stream_deep_agent
from app.agent.tools.documents import (
    _generate_pdf,
    _generate_docx,
    _build_legal_html,
    EXPORT_DIR,
)

log = logging.getLogger(__name__)

router = APIRouter()

# Scraper file server URL (same as used by the indexer)
SCRAPER_BASE_URL = os.getenv(
    "SCRAPER_BASE_URL",
    "http://wakili-scraper.railway.internal:8080",
)


def _auto_title(message: str) -> str:
    """Generate a short title from the first user message."""
    cleaned = message.strip().replace("\n", " ")
    if len(cleaned) > 80:
        return cleaned[:77] + "..."
    return cleaned


# ---------- Chat (SSE Streaming) ----------


@router.post("/chat")
async def chat(
    request: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream a chat response with citations via SSE."""

    thread_id = request.thread_id or uuid.uuid4().hex
    is_new_thread = not request.thread_id

    # Persist the user message
    try:
        tid = uuid.UUID(thread_id)
    except ValueError:
        tid = uuid.uuid4()
        thread_id = tid.hex

    if is_new_thread:
        thread = Thread(id=tid, user_id=user.id, title=_auto_title(request.message))
        db.add(thread)
        await db.flush()
    else:
        result = await db.execute(select(Thread).where(Thread.id == tid, Thread.user_id == user.id))
        thread = result.scalar_one_or_none()
        if not thread:
            raise HTTPException(status_code=404, detail="Thread not found")

    # Save user message
    user_msg = Message(thread_id=tid, role="user", content=request.message)
    db.add(user_msg)
    await db.commit()

    async def event_generator():
        full_content = ""
        all_citations = []

        # Choose agent based on deep_research flag
        if request.deep_research:
            agent_stream = stream_deep_agent(
                message=request.message,
                thread_id=thread_id,
                web_enabled=request.web_enabled,
            )
        else:
            agent_stream = stream_agent(
                message=request.message,
                thread_id=thread_id,
                web_enabled=request.web_enabled,
            )

        async for event in agent_stream:
            if event["type"] == "token":
                full_content += event.get("content", "")
            elif event["type"] == "citations":
                all_citations.extend(event.get("citations", []))

            yield {"event": event["type"], "data": json.dumps(event)}

        # Persist assistant message + citations after streaming completes
        try:
            async with db.begin():
                assistant_msg = Message(thread_id=tid, role="assistant", content=full_content)
                db.add(assistant_msg)
                await db.flush()

                for cite in all_citations:
                    db.add(CitationRecord(
                        message_id=assistant_msg.id,
                        citation_id=str(cite.get("id", "")),
                        data=cite,
                    ))
        except Exception as e:
            log.error(f"Failed to persist assistant message: {e}")

    return EventSourceResponse(event_generator())


@router.post("/chat/sync")
async def chat_sync(
    request: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Non-streaming chat endpoint for simpler clients."""

    thread_id = request.thread_id or uuid.uuid4().hex
    is_new_thread = not request.thread_id

    try:
        tid = uuid.UUID(thread_id)
    except ValueError:
        tid = uuid.uuid4()
        thread_id = tid.hex

    if is_new_thread:
        thread = Thread(id=tid, user_id=user.id, title=_auto_title(request.message))
        db.add(thread)
        await db.flush()

    user_msg = Message(thread_id=tid, role="user", content=request.message)
    db.add(user_msg)

    result = invoke_agent(
        message=request.message,
        thread_id=thread_id,
        web_enabled=request.web_enabled,
    )

    # Persist assistant response
    assistant_msg = Message(thread_id=tid, role="assistant", content=result["content"])
    db.add(assistant_msg)
    await db.flush()

    for cite in result.get("citations", []):
        db.add(CitationRecord(
            message_id=assistant_msg.id,
            citation_id=str(cite.get("id", "")),
            data=cite,
        ))

    await db.commit()

    return {
        "content": result["content"],
        "citations": result["citations"],
        "thread_id": thread_id,
    }


# ---------- Export ----------


@router.post("/export")
async def export_conversation(
    request: ExportRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export a conversation thread as PDF or DOCX."""

    # Load from database
    try:
        tid = uuid.UUID(request.thread_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid thread ID")

    result = await db.execute(select(Thread).where(Thread.id == tid, Thread.user_id == user.id))
    thread = result.scalar_one_or_none()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    msg_result = await db.execute(
        select(Message).where(Message.thread_id == tid).order_by(Message.created_at)
    )
    messages = msg_result.scalars().all()

    if not messages:
        raise HTTPException(status_code=404, detail="No messages in thread")

    # Collect citations from all assistant messages
    all_citations = []
    for msg in messages:
        if msg.role == "assistant":
            cite_result = await db.execute(
                select(CitationRecord).where(CitationRecord.message_id == msg.id)
            )
            for cr in cite_result.scalars().all():
                all_citations.append(cr.data)

    sections = []
    for msg in messages:
        if msg.role == "user":
            sections.append({"heading": "Query", "level": 3, "content": msg.content})
        elif msg.role == "assistant" and msg.content:
            sections.append({"heading": "Analysis", "level": 3, "content": msg.content})

    file_id = uuid.uuid4().hex[:8]
    title = "Legal Research Export"

    if request.format == "pdf":
        filename = f"lawlyfy_export_{file_id}.pdf"
        html = _build_legal_html(title, sections, all_citations)
        _generate_pdf(html, filename)
    elif request.format == "docx":
        filename = f"lawlyfy_export_{file_id}.docx"
        _generate_docx(title, sections, all_citations, filename)
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {request.format}")

    return ExportResponse(
        download_url=f"/exports/{filename}",
        format=request.format,
        filename=filename,
    )


# ---------- Document Download ----------


@router.get("/exports/{filename}")
async def download_export(filename: str):
    """Download an exported document."""
    filepath = os.path.join(EXPORT_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")

    media_types = {
        ".pdf": "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    }
    ext = os.path.splitext(filename)[1]
    media_type = media_types.get(ext, "application/octet-stream")

    return FileResponse(filepath, media_type=media_type, filename=filename)


# ---------- Document Retrieval (PDF proxy from scraper) ----------


@router.get("/documents/pdf")
async def get_document_pdf(local_path: str = Query(..., description="PDF path on scraper volume")):
    """Proxy a PDF from the scraper's file server for in-browser viewing."""
    if not local_path or ".." in local_path:
        raise HTTPException(status_code=400, detail="Invalid document path")

    url = f"{SCRAPER_BASE_URL}/{local_path}"
    log.info(f"Proxying PDF from {url}")

    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        try:
            resp = await client.get(url)
            resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"PDF not found on scraper: {local_path}",
            )
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Cannot reach scraper: {e}")

    filename = local_path.split("/")[-1] if "/" in local_path else local_path

    return StreamingResponse(
        io.BytesIO(resp.content),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "Content-Length": str(len(resp.content)),
            "Cache-Control": "public, max-age=86400",
        },
    )


@router.get("/documents/pages")
async def get_document_pages(
    local_path: str = Query(..., description="PDF path on scraper volume"),
):
    """Extract per-page text from a PDF for the document viewer."""
    if not local_path or ".." in local_path:
        raise HTTPException(status_code=400, detail="Invalid document path")

    url = f"{SCRAPER_BASE_URL}/{local_path}"

    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        try:
            resp = await client.get(url)
            resp.raise_for_status()
        except httpx.HTTPStatusError:
            raise HTTPException(status_code=404, detail="PDF not found")
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Cannot reach scraper: {e}")

    try:
        import pdfplumber

        pages_data = []
        with pdfplumber.open(io.BytesIO(resp.content)) as pdf:
            for i, page in enumerate(pdf.pages):
                text = page.extract_text() or ""
                pages_data.append({
                    "page_number": i + 1,
                    "text": text,
                })

        return {
            "total_pages": len(pages_data),
            "pages": pages_data,
            "local_path": local_path,
        }
    except Exception as e:
        log.error(f"PDF page extraction failed for {local_path}: {e}")
        raise HTTPException(status_code=500, detail="Failed to extract PDF pages")
