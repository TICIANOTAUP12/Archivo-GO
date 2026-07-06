from fastapi import APIRouter, Depends, Request
from slowapi import Limiter

from gateway.app.schemas import (
    EmbedRequest,
    EmbedResponse,
    ExtractRequest,
    ExtractResponse,
    ProcessPageRequest,
    ProcessPageResponse,
)
from gateway.app.security import verify_gateway_token
from shared.ai.providers import embed_text_with_request, extract_fields_with_request, process_page_with_request


def build_router(limiter: Limiter, rate_limit: str) -> APIRouter:
    router = APIRouter(prefix="/v1", dependencies=[Depends(verify_gateway_token)])

    @router.post("/extract", response_model=ExtractResponse)
    @limiter.limit(rate_limit)
    async def extract_fields_endpoint(request: Request, body: ExtractRequest) -> ExtractResponse:
        provider_request = body.to_provider_request()
        fields, provider, usage = await extract_fields_with_request(body.text, provider_request)
        return ExtractResponse(fields=fields, provider=provider, token_usage=usage, cost_usd=usage.cost_usd)

    @router.post("/embed", response_model=EmbedResponse)
    @limiter.limit(rate_limit)
    async def embed_text_endpoint(request: Request, body: EmbedRequest) -> EmbedResponse:
        provider_request = body.to_provider_request()
        embedding, usage = await embed_text_with_request(body.text, provider_request)
        return EmbedResponse(embedding=embedding, token_usage=usage, cost_usd=usage.cost_usd)

    @router.post("/process-page", response_model=ProcessPageResponse)
    @limiter.limit(rate_limit)
    async def process_page_endpoint(request: Request, body: ProcessPageRequest) -> ProcessPageResponse:
        provider_request = body.to_provider_request()
        fields, provider, usage, embedding = await process_page_with_request(body.text, provider_request)
        return ProcessPageResponse(
            fields=fields,
            provider=provider,
            embedding=embedding,
            token_usage=usage,
            cost_usd=usage.cost_usd,
        )

    return router
