import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    # OpenRouter (LLM + Embeddings)
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    LLM_MODEL: str = os.getenv("LLM_MODEL", "openai/gpt-4.1")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "openai/text-embedding-3-small")

    # Qdrant
    QDRANT_URL: str = os.getenv("QDRANT_URL", "http://localhost:6333")
    QDRANT_COLLECTION: str = os.getenv("QDRANT_COLLECTION", "legal_corpus")

    # Neo4j
    NEO4J_URI: str = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    NEO4J_USER: str = os.getenv("NEO4J_USER", "neo4j")
    NEO4J_PASSWORD: str = os.getenv("NEO4J_PASSWORD", "")

    # Tavily (web search)
    TAVILY_API_KEY: str = os.getenv("TAVILY_API_KEY", "")

    # Database (PostgreSQL)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")

    # Auth (JWT)
    JWT_SECRET: str = os.getenv("JWT_SECRET", "change-me-in-production")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "10080"))  # 7 days

    # Email (for invites)
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM: str = os.getenv("SMTP_FROM", "noreply@lawlyfy.ai")

    # App
    APP_URL: str = os.getenv("APP_URL", "http://localhost:5173")

    # Server
    PORT: int = int(os.getenv("PORT", "8000"))
    CORS_ORIGINS: list[str] = os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
    ).split(",")


settings = Settings()
