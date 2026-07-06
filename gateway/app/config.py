from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class GatewaySettings(BaseSettings):
    app_env: str = "production"
    gateway_host: str = "0.0.0.0"
    gateway_port: int = 8091
    gateway_token: str | None = None
    rate_limit: str = "60/minute"
    cors_origins: list[str] = Field(default_factory=list)

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def token_required(self) -> bool:
        return bool(self.gateway_token)


@lru_cache
def get_settings() -> GatewaySettings:
    return GatewaySettings()
