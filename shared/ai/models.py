from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field


class ProviderName(StrEnum):
    google = "google"
    anthropic = "anthropic"
    openai = "openai"
    local = "local"


ProviderLiteral = Literal["google", "anthropic", "openai", "local"]
EmbeddingProviderLiteral = Literal["google", "openai", "anthropic", "local"]


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


class ProviderRequest(BaseModel):
    provider: ProviderLiteral = "google"
    api_key: str | None = None
    model: str | None = None
    embedding_provider: EmbeddingProviderLiteral = "local"
    embedding_model: str | None = None
    google_api_key: str | None = None
    openai_api_key: str | None = None
    anthropic_api_key: str | None = None
    enable_anthropic_fallback: bool = False
    anthropic_model: str = "claude-haiku-4-5"
    min_extraction_confidence: float = 0.82

    @classmethod
    def from_backend_settings(cls, settings: object) -> "ProviderRequest":
        default_provider = getattr(settings, "default_provider", "google")
        embedding_provider = getattr(settings, "embedding_provider", "local")
        return cls(
            provider=default_provider,
            api_key=_resolve_api_key(settings, default_provider),
            model=_resolve_model(settings, default_provider),
            embedding_provider=embedding_provider,
            embedding_model=_resolve_embedding_model(settings, embedding_provider),
            google_api_key=getattr(settings, "google_api_key", None),
            openai_api_key=getattr(settings, "openai_api_key", None),
            anthropic_api_key=getattr(settings, "anthropic_api_key", None),
            enable_anthropic_fallback=getattr(settings, "enable_anthropic_fallback", False),
            anthropic_model=getattr(settings, "anthropic_model", "claude-haiku-4-5"),
            min_extraction_confidence=getattr(settings, "min_extraction_confidence", 0.82),
        )

    def resolve_extraction_key(self) -> str | None:
        if self.api_key and self.provider != "local":
            return self.api_key
        return _resolve_key_from_fields(self.provider, self.google_api_key, self.openai_api_key, self.anthropic_api_key)

    def resolve_embedding_key(self) -> str | None:
        if self.api_key and self.embedding_provider != "local":
            return self.api_key
        return _resolve_key_from_fields(
            self.embedding_provider, self.google_api_key, self.openai_api_key, self.anthropic_api_key
        )


def _resolve_api_key(settings: object, provider: str) -> str | None:
    if provider == "google":
        return getattr(settings, "google_api_key", None)
    if provider == "anthropic":
        return getattr(settings, "anthropic_api_key", None)
    if provider == "openai":
        return getattr(settings, "openai_api_key", None)
    return None


def _resolve_model(settings: object, provider: str) -> str | None:
    if provider == "google":
        return getattr(settings, "google_model", "gemini-2.5-flash")
    if provider == "anthropic":
        return getattr(settings, "anthropic_model", "claude-haiku-4-5")
    if provider == "openai":
        return getattr(settings, "openai_model", "gpt-4o-mini")
    return None


def _resolve_embedding_model(settings: object, provider: str) -> str | None:
    if provider == "google":
        return getattr(settings, "google_embedding_model", "gemini-embedding-001")
    if provider == "openai":
        return getattr(settings, "openai_embedding_model", "text-embedding-3-small")
    return None


def _resolve_key_from_fields(
    provider: str, google_key: str | None, openai_key: str | None, anthropic_key: str | None
) -> str | None:
    if provider == "google":
        return google_key
    if provider == "openai":
        return openai_key
    if provider == "anthropic":
        return anthropic_key
    return None
