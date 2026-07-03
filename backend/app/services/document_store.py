import json
from pathlib import Path
from uuid import UUID, uuid4

import asyncpg

from app.models.schemas import DocumentStatus, ExtractedFields, FileAudit, TokenUsage
from app.services.paths import resolve_source_path


async def save_run(
    connection: asyncpg.Connection,
    run_id: UUID,
    source_path: str,
    status: str,
    total_files: int,
    total_pages: int,
    scanned_pages: int,
    estimated_cost_usd: float,
) -> None:
    await connection.execute(
        """
        INSERT INTO processing_runs (id, source_path, status, total_files, total_pages, scanned_pages, estimated_cost_usd)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            total_files = EXCLUDED.total_files,
            total_pages = EXCLUDED.total_pages,
            scanned_pages = EXCLUDED.scanned_pages,
            estimated_cost_usd = EXCLUDED.estimated_cost_usd
        """,
        run_id,
        source_path,
        status,
        total_files,
        total_pages,
        scanned_pages,
        estimated_cost_usd,
    )


async def complete_run(connection: asyncpg.Connection, run_id: UUID, status: str) -> None:
    await connection.execute(
        "UPDATE processing_runs SET status = $2, completed_at = now() WHERE id = $1",
        run_id,
        status,
    )


async def upsert_document(connection: asyncpg.Connection, run_id: UUID, audit: FileAudit, storage_path: str) -> UUID:
    document_id = uuid4()
    row = await connection.fetchrow(
        """
        INSERT INTO documents (id, run_id, source_path, storage_path, filename, file_hash, mime_type, size_bytes, page_count, has_native_text)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (file_hash) DO UPDATE SET
            run_id = EXCLUDED.run_id,
            source_path = EXCLUDED.source_path,
            storage_path = EXCLUDED.storage_path,
            filename = EXCLUDED.filename,
            mime_type = EXCLUDED.mime_type,
            size_bytes = EXCLUDED.size_bytes,
            page_count = EXCLUDED.page_count,
            has_native_text = EXCLUDED.has_native_text,
            updated_at = now()
        RETURNING id
        """,
        document_id,
        run_id,
        audit.path,
        storage_path,
        audit.filename,
        audit.sha256,
        audit.mime_type,
        audit.size_bytes,
        audit.page_count,
        audit.has_native_text,
    )
    return row["id"]


async def update_document_status(connection: asyncpg.Connection, document_id: UUID, status: DocumentStatus) -> None:
    await connection.execute(
        "UPDATE documents SET status = $2, updated_at = now() WHERE id = $1",
        document_id,
        status.value,
    )


async def save_page_result(
    connection: asyncpg.Connection,
    document_id: UUID,
    page_number: int,
    text_content: str,
    is_scanned: bool,
    provider: str,
    fields: ExtractedFields,
    usage: TokenUsage,
    embedding: list[float],
) -> None:
    await connection.execute(
        """
        INSERT INTO document_pages (
            id, document_id, page_number, text_content, is_scanned, ocr_provider,
            extraction_provider, extraction_confidence, extracted_fields, evidence,
            token_usage, cost_usd, embedding
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12, $13::vector)
        ON CONFLICT (document_id, page_number) DO UPDATE SET
            text_content = EXCLUDED.text_content,
            is_scanned = EXCLUDED.is_scanned,
            ocr_provider = EXCLUDED.ocr_provider,
            extraction_provider = EXCLUDED.extraction_provider,
            extraction_confidence = EXCLUDED.extraction_confidence,
            extracted_fields = EXCLUDED.extracted_fields,
            evidence = EXCLUDED.evidence,
            token_usage = EXCLUDED.token_usage,
            cost_usd = EXCLUDED.cost_usd,
            embedding = EXCLUDED.embedding
        """,
        uuid4(),
        document_id,
        page_number,
        text_content,
        is_scanned,
        "local" if not is_scanned else "google",
        provider,
        fields.confidence,
        fields.model_dump_json(),
        json.dumps(fields.evidence),
        usage.model_dump_json(),
        usage.cost_usd,
        _vector_literal(embedding),
    )


async def list_recent_documents(connection: asyncpg.Connection, limit: int = 25) -> list[dict[str, object]]:
    rows = await connection.fetch(
        """
        SELECT id, source_path, storage_path, filename, status, page_count, has_native_text, updated_at
        FROM documents
        ORDER BY updated_at DESC
        LIMIT $1
        """,
        limit,
    )
    return [dict(row) for row in rows]


async def list_documents(
    connection: asyncpg.Connection,
    status: DocumentStatus | None = None,
    limit: int = 200,
) -> list[dict[str, object]]:
    if status is None:
        rows = await connection.fetch(
            """
            SELECT id, source_path, storage_path, filename, status, page_count, has_native_text, updated_at
            FROM documents
            ORDER BY updated_at DESC
            LIMIT $1
            """,
            limit,
        )
        return [dict(row) for row in rows]

    rows = await connection.fetch(
        """
        SELECT id, source_path, storage_path, filename, status, page_count, has_native_text, updated_at
        FROM documents
        WHERE status = $1
        ORDER BY updated_at DESC
        LIMIT $2
        """,
        status.value,
        limit,
    )
    return [dict(row) for row in rows]


def source_to_path(source_path: str) -> Path:
    path = resolve_source_path(source_path)
    if not path.exists():
        raise FileNotFoundError(source_path)
    return path


def _vector_literal(values: list[float]) -> str:
    safe_values = [str(round(value, 8)) for value in values[:768]]
    if len(safe_values) < 768:
        safe_values.extend(["0"] * (768 - len(safe_values)))
    return "[" + ",".join(safe_values) + "]"
