from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.services.paths import resolve_source_path


class DocumentStatus(StrEnum):
    pending = "pending"
    processing = "processing"
    indexed = "indexed"
    needs_review = "needs_review"
    failed = "failed"


class ProviderName(StrEnum):
    google = "google"
    anthropic = "anthropic"
    openai = "openai"
    local = "local"


class AuditRequest(BaseModel):
    source_path: str = Field(min_length=1)
    sample_limit: int = Field(default=500, ge=1, le=10_000)

    @field_validator("source_path")
    @classmethod
    def validate_source_path(cls, value: str) -> str:
        try:
            resolve_source_path(value)
        except FileNotFoundError as error:
            raise ValueError("source_path does not exist") from error
        return value


class FileAudit(BaseModel):
    path: str
    filename: str
    extension: str
    mime_type: str
    size_bytes: int
    sha256: str
    page_count: int
    has_native_text: bool
    is_probably_scanned: bool


class CostEstimate(BaseModel):
    pages: int
    scanned_pages: int
    native_text_pages: int
    google_ocr_usd: float
    gemini_extraction_usd: float
    gemini_embedding_usd: float
    anthropic_fallback_low_usd: float
    anthropic_fallback_high_usd: float
    total_low_usd: float
    total_high_usd: float


class AuditResponse(BaseModel):
    run_id: UUID
    source_path: str
    total_files: int
    total_bytes: int
    total_pages: int
    scanned_pages: int
    native_text_pages: int
    sampled_files: list[FileAudit]
    estimate: CostEstimate


class ExtractedFields(BaseModel):
    matricula: str | None = None
    patente: str | None = None
    numero_caso: str | None = None
    tipo_documento: str | None = None
    fecha_documento: str | None = None
    resumen: str | None = None
    confidence: float = Field(default=0, ge=0, le=1)
    evidence: list[str] = Field(default_factory=list)


class TokenUsage(BaseModel):
    input_tokens: int = 0
    output_tokens: int = 0
    embedding_tokens: int = 0
    cost_usd: float = 0


class IngestRequest(BaseModel):
    source_path: str = Field(min_length=1)
    run_id: UUID | None = None
    max_documents: int | None = Field(default=None, ge=1)
    dry_run: bool = False

    @field_validator("source_path")
    @classmethod
    def validate_ingest_path(cls, value: str) -> str:
        try:
            resolve_source_path(value)
        except FileNotFoundError as error:
            raise ValueError("source_path does not exist") from error
        return value


class IngestResponse(BaseModel):
    run_id: UUID
    queued_documents: int
    dry_run: bool
    estimated_cost_usd: float


class DocumentPageResult(BaseModel):
    page_number: int
    text_content: str
    is_scanned: bool
    fields: ExtractedFields
    provider: ProviderName
    token_usage: TokenUsage


class DocumentResult(BaseModel):
    id: UUID
    source_path: str
    storage_path: str | None = None
    filename: str
    status: DocumentStatus
    page_count: int
    has_native_text: bool
    pages: list[DocumentPageResult] = Field(default_factory=list)
    updated_at: datetime | None = None


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    matricula: str | None = None
    patente: str | None = None
    numero_caso: str | None = None
    persona: str | None = None
    limit: int = Field(default=20, ge=1, le=100)


class SearchResult(BaseModel):
    document_id: UUID
    page_id: UUID
    filename: str
    source_path: str
    storage_path: str | None = None
    page_number: int
    snippet: str
    matricula: str | None = None
    patente: str | None = None
    numero_caso: str | None = None
    match_kind: str | None = None
    score: float


class HealthResponse(BaseModel):
    status: str
    database: str
