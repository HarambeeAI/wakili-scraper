"""SQLAlchemy ORM models for users, organizations, threads, messages, citations."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc)


def _uuid():
    return uuid.uuid4()


# ---------- Organizations (team plan) ----------


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    max_seats: Mapped[int] = mapped_column(Integer, default=5)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    members: Mapped[list[User]] = relationship("User", back_populates="organization")
    invites: Mapped[list[Invite]] = relationship("Invite", back_populates="organization")


# ---------- Users ----------


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    plan: Mapped[str] = mapped_column(String(50), default="professional")  # professional | team
    org_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True
    )
    is_org_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    organization: Mapped[Organization | None] = relationship("Organization", back_populates="members")
    threads: Mapped[list[Thread]] = relationship("Thread", back_populates="user", cascade="all, delete-orphan")


# ---------- Invites ----------


class Invite(Base):
    __tablename__ = "invites"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    invited_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    accepted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    organization: Mapped[Organization] = relationship("Organization", back_populates="invites")

    __table_args__ = (
        UniqueConstraint("org_id", "email", name="uq_invite_org_email"),
    )


# ---------- Threads ----------


class Thread(Base):
    __tablename__ = "threads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), default="New Research")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    user: Mapped[User] = relationship("User", back_populates="threads")
    messages: Mapped[list[Message]] = relationship(
        "Message", back_populates="thread", cascade="all, delete-orphan", order_by="Message.created_at"
    )


# ---------- Messages ----------


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    thread_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("threads.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # user | assistant
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    thread: Mapped[Thread] = relationship("Thread", back_populates="messages")
    citations: Mapped[list[CitationRecord]] = relationship(
        "CitationRecord", back_populates="message", cascade="all, delete-orphan"
    )


# ---------- Citations ----------


class CitationRecord(Base):
    __tablename__ = "citations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    message_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False
    )
    citation_id: Mapped[str] = mapped_column(String(50), nullable=False)  # display ID (1, 2, 3...)
    data: Mapped[dict] = mapped_column(JSONB, nullable=False)

    message: Mapped[Message] = relationship("Message", back_populates="citations")
