from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.database import database
from app.models.schemas import HealthResponse
from app.routers import audit, documents, search


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    await database.connect()
    try:
        yield
    finally:
        await database.close()


settings = get_settings()
app = FastAPI(title="Archivo de SCIVOLI GNC", version="0.1.0", lifespan=lifespan)

cors_origins = ["*"] if settings.app_env != "production" else settings.cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(audit.router)
app.include_router(documents.router)
app.include_router(search.router)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    try:
        async with database.acquire() as connection:
            await connection.execute("SELECT 1")
        return HealthResponse(status="ok", database="ok")
    except Exception:
        return HealthResponse(status="degraded", database="unavailable")
