from typing import Literal

from pydantic import BaseModel, Field

from shared.ai.models import ExtractedFields, ProviderName, ProviderRequest, TokenUsage


class ExtractRequest(BaseModel):
    text: str = Field(min_length=1, max_length=32_000)
    provider: Literal["google", "anthropic", "openai", "local"] = "google"
    api_key: str | None = None
    model: str | None = None
    enable_anthropic_fallback: bool = False
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-haiku-4-5"
    min_extraction_confidence: float = Field(default=0.82, ge=0, le=1)

    def to_provider_request(self) -> ProviderRequest:
        return ProviderRequest(
            provider=self.provider,
            api_key=self.api_key,
            model=self.model,
            enable_anthropic_fallback=self.enable_anthropic_fallback,
            anthropic_api_key=self.anthropic_api_key,
            anthropic_model=self.anthropic_model,
            min_extraction_confidence=self.min_extraction_confidence,
        )


class EmbedRequest(BaseModel):
    text: str = Field(min_length=1, max_length=32_000)
    provider: Literal["google", "openai", "local"] = "google"
    api_key: str | None = None
    model: str | None = None

    def to_provider_request(self) -> ProviderRequest:
        return ProviderRequest(
            provider=self.provider,
            api_key=self.api_key,
            embedding_provider=self.provider,
            embedding_model=self.model,
        )


class ProcessPageRequest(BaseModel):
    text: str = Field(min_length=1, max_length=32_000)
    provider: Literal["google", "anthropic", "openai", "local"] = "google"
    api_key: str | None = None
    model: str | None = None
    embedding_provider: Literal["google", "openai", "local"] = "google"
    embedding_model: str | None = None
    enable_anthropic_fallback: bool = False
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-haiku-4-5"
    min_extraction_confidence: float = Field(default=0.82, ge=0, le=1)

    def to_provider_request(self) -> ProviderRequest:
        return ProviderRequest(
            provider=self.provider,
            api_key=self.api_key,
            model=self.model,
            embedding_provider=self.embedding_provider,
            embedding_model=self.embedding_model,
            enable_anthropic_fallback=self.enable_anthropic_fallback,
            anthropic_api_key=self.anthropic_api_key,
            anthropic_model=self.anthropic_model,
            min_extraction_confidence=self.min_extraction_confidence,
        )


class ExtractResponse(BaseModel):
    fields: ExtractedFields
    provider: ProviderName
    token_usage: TokenUsage
    cost_usd: float


class EmbedResponse(BaseModel):
    embedding: list[float]
    token_usage: TokenUsage
    cost_usd: float


class ProcessPageResponse(BaseModel):
    fields: ExtractedFields
    provider: ProviderName
    embedding: list[float]
    token_usage: TokenUsage
    cost_usd: float


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "archivo-gateway"
