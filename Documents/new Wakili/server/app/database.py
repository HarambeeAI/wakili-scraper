"""Async SQLAlchemy engine, session factory, and base model."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

# Convert postgres:// to postgresql+asyncpg://
_raw = settings.DATABASE_URL
if _raw.startswith("postgres://"):
    _raw = _raw.replace("postgres://", "postgresql+asyncpg://", 1)
elif _raw.startswith("postgresql://"):
    _raw = _raw.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(_raw, echo=False, pool_size=10, max_overflow=20)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:  # type: ignore[misc]
    """FastAPI dependency that yields an async DB session."""
    async with async_session() as session:
        yield session


async def init_db():
    """Create all tables (called on app startup)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
