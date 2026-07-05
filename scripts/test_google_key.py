"""Prueba rápida de la key de Google configurada en el backend."""
from __future__ import annotations

import asyncio
import sys

from app.core.config import get_settings
from app.services.ai_providers import _extract_with_google, embed_text, extract_fields


async def main() -> int:
    settings = get_settings()
    print(f"default_provider={settings.default_provider}")
    print(f"embedding_provider={settings.embedding_provider}")
    print(f"google_key_present={bool(settings.google_api_key)}")
    if settings.google_api_key:
        print(f"google_key_prefix={settings.google_api_key[:8]}...")

    sample = "Patente XLF030. Matricula 18032. Tramite 73919692."
    try:
        fields, provider, _usage = await _extract_with_google(sample, settings)
        print(f"google_direct_provider={provider}")
        print(f"google_direct_patente={fields.patente}")
        print(f"google_direct_confidence={fields.confidence}")
    except Exception as error:  # noqa: BLE001
        print(f"google_direct_error={type(error).__name__}: {error}")
        return 1

    try:
        vector, usage = await embed_text("Patente XLF030 SCIVOLI ENARGAS", settings)
        print(f"embed_len={len(vector)} embed_tokens={usage.embedding_tokens}")
    except Exception as error:  # noqa: BLE001
        print(f"embed_error={type(error).__name__}: {error}")
        return 1

    if settings.enable_anthropic_fallback and settings.anthropic_api_key:
        print("anthropic_fallback_configured=yes")
    else:
        print("anthropic_fallback_configured=no")

    try:
        fields, provider, _usage = await extract_fields(sample, settings)
        print(f"pipeline_provider={provider}")
        print(f"pipeline_patente={fields.patente}")
        print(f"pipeline_confidence={fields.confidence}")
    except Exception as error:  # noqa: BLE001
        print(f"pipeline_error={type(error).__name__}: {error}")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
