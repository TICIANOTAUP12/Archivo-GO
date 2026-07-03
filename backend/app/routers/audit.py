from fastapi import APIRouter, Depends

from app.core.database import Database, database
from app.models.schemas import AuditRequest, AuditResponse
from app.services.document_store import save_run
from app.services.inventory import audit_source

router = APIRouter(prefix="/audit", tags=["audit"])


def get_database() -> Database:
    return database


@router.post("", response_model=AuditResponse)
async def audit_documents(request: AuditRequest, db: Database = Depends(get_database)) -> AuditResponse:
    response = audit_source(request.source_path, request.sample_limit)
    async with db.acquire() as connection:
        await save_run(
            connection,
            response.run_id,
            response.source_path,
            "audited",
            response.total_files,
            response.total_pages,
            response.scanned_pages,
            response.estimate.total_high_usd,
        )
    return response
