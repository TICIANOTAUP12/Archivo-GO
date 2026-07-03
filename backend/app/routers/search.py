from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings
from app.core.database import Database, database
from app.models.schemas import SearchRequest, SearchResult
from app.services.search import search_documents

router = APIRouter(prefix="/search", tags=["search"])


def get_database() -> Database:
    return database


def get_app_settings() -> Settings:
    return get_settings()


@router.post("", response_model=list[SearchResult])
async def search(
    request: SearchRequest,
    db: Database = Depends(get_database),
    settings: Settings = Depends(get_app_settings),
) -> list[SearchResult]:
    return await search_documents(request, db, settings)
