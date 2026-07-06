from app.core.config import Settings
from app.models.schemas import ExtractedFields, ProviderName, TokenUsage
from shared.ai.models import ProviderRequest
from shared.ai.providers import embed_text_with_request, extract_fields_with_request


async def extract_fields(text: str, settings: Settings) -> tuple[ExtractedFields, ProviderName, TokenUsage]:
    request = ProviderRequest.from_backend_settings(settings)
    fields, provider, usage = await extract_fields_with_request(text, request)
    return fields, ProviderName(provider.value), usage


async def embed_text(text: str, settings: Settings) -> tuple[list[float], TokenUsage]:
    request = ProviderRequest.from_backend_settings(settings)
    return await embed_text_with_request(text, request)
