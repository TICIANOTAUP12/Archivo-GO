from app.core.config import Settings
from app.core.database import Database
from app.models.schemas import SearchRequest, SearchResult
from app.services.ai_providers import embed_text


async def search_documents(request: SearchRequest, database: Database, settings: Settings) -> list[SearchResult]:
    query_embedding, _usage = await embed_text(request.query, settings)
    vector_literal = _vector_literal(query_embedding)

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
                p.extracted_fields->>'numero_caso' AS numero_caso,
                (
                    ts_rank_cd(to_tsvector('spanish', p.text_content), plainto_tsquery('spanish', $1)) * 0.55
                    + (1 - (p.embedding <=> $2::vector)) * 0.45
                ) AS score
            FROM document_pages p
            JOIN documents d ON d.id = p.document_id
            WHERE
                (
                    to_tsvector('spanish', p.text_content) @@ plainto_tsquery('spanish', $1)
                    OR p.embedding <=> $2::vector < 0.75
                )
                AND ($3::text IS NULL OR p.extracted_fields->>'matricula' = $3)
                AND ($4::text IS NULL OR p.extracted_fields->>'numero_caso' = $4)
            ORDER BY score DESC
            LIMIT $5
            """,
            request.query,
            vector_literal,
            request.matricula,
            request.numero_caso,
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
            numero_caso=row["numero_caso"],
            score=float(row["score"] or 0),
        )
        for row in rows
    ]


def _vector_literal(values: list[float]) -> str:
    safe_values = [str(round(value, 8)) for value in values[:768]]
    if len(safe_values) < 768:
        safe_values.extend(["0"] * (768 - len(safe_values)))
    return "[" + ",".join(safe_values) + "]"
