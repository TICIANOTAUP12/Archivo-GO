from app.core.config import Settings
from app.core.database import Database
from app.models.schemas import SearchRequest, SearchResult
from app.services.ai_providers import embed_text
from app.services.path_metadata import normalize_patente


async def search_documents(request: SearchRequest, database: Database, settings: Settings) -> list[SearchResult]:
    query_embedding, _usage = await embed_text(request.query, settings)
    vector_literal = _vector_literal(query_embedding)
    patente = normalize_patente(request.patente or _patente_from_query(request.query))

    async with database.acquire() as connection:
        rows = await connection.fetch(
            """
            SELECT
                d.id AS document_id,
                p.id AS page_id,
                d.filename,
                d.source_path,
                d.storage_path,
                p.page_number,
                left(regexp_replace(p.text_content, '\\s+', ' ', 'g'), 420) AS snippet,
                p.extracted_fields->>'matricula' AS matricula,
                p.extracted_fields->>'patente' AS patente,
                p.extracted_fields->>'numero_caso' AS numero_caso,
                (
                    ts_rank_cd(
                        to_tsvector('spanish', coalesce(p.text_content, '') || ' ' || coalesce(d.filename, '') || ' ' || coalesce(d.source_path, '')),
                        plainto_tsquery('spanish', $1)
                    ) * 0.55
                    + (1 - (p.embedding <=> $2::vector)) * 0.45
                ) AS score
            FROM document_pages p
            JOIN documents d ON d.id = p.document_id
            WHERE
                (
                    to_tsvector('spanish', coalesce(p.text_content, '') || ' ' || coalesce(d.filename, '') || ' ' || coalesce(d.source_path, ''))
                        @@ plainto_tsquery('spanish', $1)
                    OR p.embedding <=> $2::vector < 0.75
                    OR ($5::text IS NOT NULL AND (
                        upper(coalesce(p.extracted_fields->>'patente', '')) = $5
                        OR d.filename ILIKE '%' || $5 || '%'
                        OR d.source_path ILIKE '%' || $5 || '%'
                        OR coalesce(p.text_content, '') ILIKE '%' || $5 || '%'
                    ))
                )
                AND ($3::text IS NULL OR p.extracted_fields->>'matricula' = $3)
                AND ($4::text IS NULL OR (
                    p.extracted_fields->>'numero_caso' = $4
                    OR p.extracted_fields->>'numero_caso' ILIKE $4 || '%'
                    OR coalesce(p.text_content, '') ILIKE '%' || $4 || '%'
                    OR d.filename ILIKE '%' || $4 || '%'
                ))
            ORDER BY score DESC
            LIMIT $6
            """,
            request.query,
            vector_literal,
            request.matricula,
            request.numero_caso,
            patente,
            request.limit,
        )
    return [
        SearchResult(
            document_id=row["document_id"],
            page_id=row["page_id"],
            filename=row["filename"],
            source_path=row["source_path"],
            storage_path=row["storage_path"],
            page_number=row["page_number"],
            snippet=row["snippet"] or "",
            matricula=row["matricula"],
            patente=row["patente"],
            numero_caso=row["numero_caso"],
            score=float(row["score"] or 0),
        )
        for row in rows
    ]


def _patente_from_query(query: str) -> str | None:
    import re

    normalized = query.strip().upper()
    old_plate = re.search(r"\b([A-Z]{3}\d{3})\b", normalized)
    if old_plate:
        return normalize_patente(old_plate.group(1))
    mercosur = re.search(r"\b([A-Z]{2}\d{3}[A-Z]{2})\b", normalized)
    if mercosur:
        return normalize_patente(mercosur.group(1))
    return None


def _vector_literal(values: list[float]) -> str:
    safe_values = [str(round(value, 8)) for value in values[:768]]
    if len(safe_values) < 768:
        safe_values.extend(["0"] * (768 - len(safe_values)))
    return "[" + ",".join(safe_values) + "]"
