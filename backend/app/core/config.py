from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    log_level: str = "INFO"
    database_url: str = "postgresql://archivo:archivo_dev_password@localhost:5432/archivo_digital"
    backend_host: str = "0.0.0.0"
    backend_port: int = 8080
    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "https://wails.localhost",
            "http://wails.localhost",
        ]
    )

    default_provider: Literal["google", "anthropic", "local"] = "google"
    ocr_provider: Literal["google", "local"] = "local"
    embedding_provider: Literal["google", "local"] = "local"
    enable_anthropic_fallback: bool = True
    min_extraction_confidence: float = 0.82
    max_run_budget_usd: float = 300.0

    google_api_key: str | None = None
    google_model: str = "gemini-2.5-flash"
    google_embedding_model: str = "gemini-embedding-001"
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-haiku-4-5"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, list):
            return value
        return [origin.strip() for origin in value.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
