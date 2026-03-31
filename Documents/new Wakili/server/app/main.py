from contextlib import asynccontextmanager
import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

from app.config import settings
from app.api.routes import router
from app.api.auth_routes import router as auth_router
from app.api.thread_routes import router as thread_router
from app.api.canvas_routes import router as canvas_router
from app.api.payment_routes import router as payment_router
from app.api.admin_routes import router as admin_router
from app.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables
    if settings.DATABASE_URL:
        await init_db()
    yield


app = FastAPI(title="Lawlyfy API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(payment_router, prefix="/api")
app.include_router(thread_router, prefix="/api")
app.include_router(canvas_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "lawlyfy-api"}


# Export directory — files served via authenticated /api/exports/{filename} route
EXPORT_DIR = "/tmp/lawlyfy-exports"
os.makedirs(EXPORT_DIR, exist_ok=True)
