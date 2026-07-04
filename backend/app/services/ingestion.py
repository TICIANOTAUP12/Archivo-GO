import asyncio
from pathlib import Path
from uuid import UUID

from app.core.config import Settings
from app.core.database import Database
from app.models.schemas import DocumentStatus, FileAudit, IngestResponse
from app.services.ai_providers import embed_text, extract_fields
from app.services.document_store import (
    complete_run,
    save_page_result,
    save_run,
    update_document_status,
    upsert_document,
)
from app.services.inventory import audit_source, discover_supported_files, extract_text_by_page
from app.services.ocr import ocr_file_by_page
from app.services.path_metadata import build_search_context, extract_path_metadata, merge_path_metadata
from app.services.paths import to_host_input_path
from app.services.storage import archive_original_file


async def ingest_source(
    source_path: str,
    run_id: UUID | None,
    max_documents: int | None,
    dry_run: bool,
    database: Database,
    settings: Settings,
) -> IngestResponse:
    audit = audit_source(source_path, sample_limit=max_documents or 500)
    selected_run_id = run_id or audit.run_id
    files = discover_supported_files(source_path, max_documents)

    if dry_run:
        return IngestResponse(
            run_id=selected_run_id,
            queued_documents=len(files),
            dry_run=True,
            estimated_cost_usd=audit.estimate.total_high_usd,
        )
    if audit.estimate.total_high_usd > settings.max_run_budget_usd:
        raise ValueError(
            "estimated audit cost "
            f"USD {audit.estimate.total_high_usd:.2f} exceeds configured budget "
            f"USD {settings.max_run_budget_usd:.2f}"
        )

    async with database.acquire() as connection:
        await save_run(
            connection,
            selected_run_id,
            source_path,
            "processing",
            audit.total_files,
            audit.total_pages,
            audit.scanned_pages,
            audit.estimate.total_high_usd,
        )

    asyncio.create_task(_process_files(files, selected_run_id, database, settings))
    return IngestResponse(
        run_id=selected_run_id,
        queued_documents=len(files),
        dry_run=False,
        estimated_cost_usd=audit.estimate.total_high_usd,
    )


async def _process_files(files: list[Path], run_id: UUID, database: Database, settings: Settings) -> None:
    try:
        for file_path in files:
            await _process_file(file_path, run_id, database, settings)
    finally:
        async with database.acquire() as connection:
            await complete_run(connection, run_id, "completed")


async def _process_file(file_path: Path, run_id: UUID, database: Database, settings: Settings) -> None:
    audit = audit_source(str(file_path), sample_limit=1).sampled_files[0]
    audit.path = to_host_input_path(file_path)
    storage_path = archive_original_file(file_path, audit)
    async with database.acquire() as connection:
        document_id = await upsert_document(connection, run_id, audit, storage_path)
        await update_document_status(connection, document_id, DocumentStatus.processing)

    try:
        page_texts = _load_page_texts(file_path, audit)
        path_metadata = extract_path_metadata(file_path)
        search_context = build_search_context(file_path)
        for page_number, text_content in enumerate(page_texts, start=1):
            enriched_text = f"{search_context}\n{text_content}".strip()
            fields, provider, usage = await extract_fields(enriched_text, settings)
            fields = merge_path_metadata(fields, path_metadata)
            embedding, embedding_usage = await embed_text(enriched_text, settings)
            usage.embedding_tokens += embedding_usage.embedding_tokens
            usage.cost_usd += embedding_usage.cost_usd
            async with database.acquire() as connection:
                await save_page_result(
                    connection,
                    document_id,
                    page_number,
                    enriched_text,
                    audit.is_probably_scanned,
                    provider.value,
                    fields,
                    usage,
                    embedding,
                )
        final_status = DocumentStatus.needs_review if _needs_review(page_texts) else DocumentStatus.indexed
        async with database.acquire() as connection:
            await update_document_status(connection, document_id, final_status)
    except Exception:
        async with database.acquire() as connection:
            await update_document_status(connection, document_id, DocumentStatus.failed)
        raise


def _load_page_texts(file_path: Path, audit: FileAudit) -> list[str]:
    native_texts = extract_text_by_page(file_path)
    has_enough_text = any(len(text) >= 40 for text in native_texts)
    if has_enough_text and not audit.is_probably_scanned:
        return native_texts
    ocr_texts = ocr_file_by_page(file_path)
    return [text if text.strip() else native_texts[index] if index < len(native_texts) else "" for index, text in enumerate(ocr_texts)]


def _needs_review(page_texts: list[str]) -> bool:
    return not any(len(text.strip()) >= 40 for text in page_texts)
