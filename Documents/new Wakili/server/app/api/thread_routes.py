"""Thread management: list, search, get history, delete."""

from __future__ import annotations

import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import get_current_user
from app.database import get_db
from app.models import CitationRecord, Message, Thread, User

log = logging.getLogger(__name__)
router = APIRouter(prefix="/threads", tags=["threads"])


# ---------- List threads ----------


@router.get("")
async def list_threads(
    q: str = Query("", description="Search query"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List threads for the current user, optionally filtered by search query."""
    stmt = select(Thread).where(Thread.user_id == user.id)

    if q.strip():
        # Search by thread title OR by message content
        search = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Thread.title.ilike(search),
                Thread.id.in_(
                    select(Message.thread_id)
                    .where(Message.content.ilike(search))
                    .distinct()
                ),
            )
        )

    stmt = stmt.order_by(desc(Thread.updated_at)).offset(offset).limit(limit)
    result = await db.execute(stmt)
    threads = result.scalars().all()

    return {
        "threads": [
            {
                "id": str(t.id),
                "title": t.title,
                "created_at": t.created_at.isoformat(),
                "updated_at": t.updated_at.isoformat(),
            }
            for t in threads
        ]
    }


# ---------- Get thread history ----------


@router.get("/{thread_id}")
async def get_thread(
    thread_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get full thread with messages and citations."""
    try:
        tid = uuid.UUID(thread_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid thread ID")

    result = await db.execute(
        select(Thread)
        .where(Thread.id == tid, Thread.user_id == user.id)
        .options(
            selectinload(Thread.messages).selectinload(Message.citations)
        )
    )
    thread = result.scalar_one_or_none()

    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    messages = []
    all_citations = []
    for msg in thread.messages:
        msg_citations = [c.data for c in msg.citations]
        messages.append({
            "id": str(msg.id),
            "role": msg.role,
            "content": msg.content,
            "citations": msg_citations,
            "created_at": msg.created_at.isoformat(),
        })
        all_citations.extend(msg_citations)

    return {
        "thread_id": str(thread.id),
        "title": thread.title,
        "messages": messages,
        "citations": all_citations,
    }


# ---------- Delete thread ----------


@router.delete("/{thread_id}")
async def delete_thread(
    thread_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a thread and all its messages."""
    try:
        tid = uuid.UUID(thread_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid thread ID")

    result = await db.execute(select(Thread).where(Thread.id == tid, Thread.user_id == user.id))
    thread = result.scalar_one_or_none()

    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    await db.delete(thread)
    await db.commit()
    return {"message": "Thread deleted"}


# ---------- Rename thread ----------


@router.patch("/{thread_id}")
async def rename_thread(
    thread_id: str,
    title: str = Query(..., min_length=1, max_length=500),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Rename a thread."""
    try:
        tid = uuid.UUID(thread_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid thread ID")

    result = await db.execute(select(Thread).where(Thread.id == tid, Thread.user_id == user.id))
    thread = result.scalar_one_or_none()

    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    thread.title = title
    await db.commit()
    return {"message": "Thread renamed", "title": title}
