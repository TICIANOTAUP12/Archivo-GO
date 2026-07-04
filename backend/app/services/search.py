from app.core.config import Settings
from app.core.database import Database
from app.models.schemas import SearchRequest, SearchResult
from app.services.ai_providers import embed_text
from app.services.path_metadata import normalize_patente
from app.services.query_parser import ParsedSearchQuery, parse_search_query


async def search_documents(request: SearchRequest, database: Database, settings: Settings) -> list[SearchResult]:
    parsed = _merge_request_filters(request)
    query_embedding, _usage = await embed_text(parsed.query, settings)
    vector_literal = _vector_literal(query_embedding)
    patente = normalize_patente(parsed.patente)

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
                CASE
                    WHEN $5::text IS NOT NULL AND (
                        upper(coalesce(p.extracted_fields->>'patente', '')) = $5
                        OR d.filename ILIKE '%' || $5 || '%'
                        OR coalesce(p.text_content, '') ILIKE '%' || $5 || '%'
                    ) THEN 'patente'
                    WHEN $4::text IS NOT NULL AND (
                        p.extracted_fields->>'numero_caso' = $4
                        OR p.extracted_fields->>'numero_caso' ILIKE $4 || '%'
                        OR coalesce(p.text_content, '') ILIKE '%' || $4 || '%'
                        OR d.filename ILIKE '%' || $4 || '%'
                    ) THEN 'tramite'
                    WHEN $6::text IS NOT NULL AND (
                        coalesce(p.text_content, '') ILIKE '%' || $6 || '%'
                        OR coalesce(p.extracted_fields->>'resumen', '') ILIKE '%' || $6 || '%'
                    ) THEN 'persona'
                    WHEN $3::text IS NOT NULL AND (
                        p.extracted_fields->>'matricula' = $3
                        OR coalesce(p.extracted_fields->>'matricula', '') ILIKE '%' || $3 || '%'
                        OR coalesce(p.text_content, '') ILIKE '%' || $3 || '%'
                    ) THEN 'matricula'
                    ELSE 'texto'
                END AS match_kind,
                (
                    ts_rank_cd(
                        to_tsvector(
                            'spanish',
                            coalesce(p.text_content, '') || ' ' ||
                            coalesce(p.extracted_fields->>'resumen', '') || ' ' ||
                            coalesce(d.filename, '') || ' ' ||
                            coalesce(d.source_path, '')
                        ),
                        plainto_tsquery('spanish', $1)
                    ) * 0.45
                    + (1 - (p.embedding <=> $2::vector)) * 0.35
                    + CASE
                        WHEN $5::text IS NOT NULL AND (
                            upper(coalesce(p.extracted_fields->>'patente', '')) = $5
                            OR d.filename ILIKE '%' || $5 || '%'
                            OR coalesce(p.text_content, '') ILIKE '%' || $5 || '%'
                        ) THEN 0.20
                        WHEN $4::text IS NOT NULL AND (
                            p.extracted_fields->>'numero_caso' = $4
                            OR p.extracted_fields->>'numero_caso' ILIKE $4 || '%'
                            OR coalesce(p.text_content, '') ILIKE '%' || $4 || '%'
                            OR d.filename ILIKE '%' || $4 || '%'
                        ) THEN 0.20
                        WHEN $6::text IS NOT NULL AND (
                            coalesce(p.text_content, '') ILIKE '%' || $6 || '%'
                            OR coalesce(p.extracted_fields->>'resumen', '') ILIKE '%' || $6 || '%'
                        ) THEN 0.18
                        WHEN $3::text IS NOT NULL AND (
                            p.extracted_fields->>'matricula' = $3
                            OR coalesce(p.extracted_fields->>'matricula', '') ILIKE '%' || $3 || '%'
                            OR coalesce(p.text_content, '') ILIKE '%' || $3 || '%'
                        ) THEN 0.16
                        ELSE 0
                    END
                ) AS score
            FROM document_pages p
            JOIN documents d ON d.id = p.document_id
            WHERE
                (
                    to_tsvector(
                        'spanish',
                        coalesce(p.text_content, '') || ' ' ||
                        coalesce(p.extracted_fields->>'resumen', '') || ' ' ||
                        coalesce(d.filename, '') || ' ' ||
                        coalesce(d.source_path, '')
                    ) @@ plainto_tsquery('spanish', $1)
                    OR p.embedding <=> $2::vector < 0.75
                    OR ($5::text IS NOT NULL AND (
                        upper(coalesce(p.extracted_fields->>'patente', '')) = $5
                        OR d.filename ILIKE '%' || $5 || '%'
                        OR d.source_path ILIKE '%' || $5 || '%'
                        OR coalesce(p.text_content, '') ILIKE '%' || $5 || '%'
                    ))
                    OR ($4::text IS NOT NULL AND (
                        p.extracted_fields->>'numero_caso' = $4
                        OR p.extracted_fields->>'numero_caso' ILIKE $4 || '%'
                        OR coalesce(p.text_content, '') ILIKE '%' || $4 || '%'
                        OR d.filename ILIKE '%' || $4 || '%'
                    ))
                    OR ($6::text IS NOT NULL AND (
                        coalesce(p.text_content, '') ILIKE '%' || $6 || '%'
                        OR coalesce(p.extracted_fields->>'resumen', '') ILIKE '%' || $6 || '%'
                    ))
                    OR ($3::text IS NOT NULL AND (
                        p.extracted_fields->>'matricula' = $3
                        OR coalesce(p.extracted_fields->>'matricula', '') ILIKE '%' || $3 || '%'
                        OR coalesce(p.text_content, '') ILIKE '%' || $3 || '%'
                    ))
                )
            ORDER BY score DESC
            LIMIT $7
            """,
            parsed.query,
            vector_literal,
            parsed.matricula,
            parsed.numero_caso,
            patente,
            parsed.persona,
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
            match_kind=row["match_kind"],
            score=float(row["score"] or 0),
        )
        for row in rows
    ]


def _merge_request_filters(request: SearchRequest) -> ParsedSearchQuery:
    parsed = parse_search_query(request.query)
    return ParsedSearchQuery(
        query=parsed.query,
        patente=request.patente or parsed.patente,
        numero_caso=request.numero_caso or parsed.numero_caso,
        matricula=request.matricula or parsed.matricula,
        persona=request.persona or parsed.persona,
    )


def _vector_literal(values: list[float]) -> str:
    safe_values = [str(round(value, 8)) for value in values[:768]]
    if len(safe_values) < 768:
        safe_values.extend(["0"] * (768 - len(safe_values)))
    return "[" + ",".join(safe_values) + "]"
