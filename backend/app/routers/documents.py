from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.config import Settings, get_settings
from app.core.database import Database, database
from app.models.schemas import DocumentStatus, IngestRequest, IngestResponse
from app.services.document_store import list_documents, list_recent_documents
from app.services.ingestion import ingest_source

router = APIRouter(prefix="/documents", tags=["documents"])


def get_database() -> Database:
    return database


def get_app_settings() -> Settings:
    return get_settings()


@router.post("/ingest", response_model=IngestResponse)
async def ingest_documents(
    request: IngestRequest,
    db: Database = Depends(get_database),
    settings: Settings = Depends(get_app_settings),
) -> IngestResponse:
    try:
        return await ingest_source(
            request.source_path,
            request.run_id,
            request.max_documents,
            request.dry_run,
            db,
            settings,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("/recent")
async def recent_documents(db: Database = Depends(get_database)) -> list[dict[str, object]]:
    async with db.acquire() as connection:
        return await list_recent_documents(connection)


@router.get("")
async def documents(
    status: DocumentStatus | None = None,
    limit: int = Query(default=200, ge=1, le=500),
    db: Database = Depends(get_database),
) -> list[dict[str, object]]:
    async with db.acquire() as connection:
        return await list_documents(connection, status, limit)
