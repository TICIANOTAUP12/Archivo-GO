import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from gateway.app.config import get_settings
from gateway.app.routers import compute
from gateway.app.schemas import HealthResponse

logger = logging.getLogger("archivo.gateway")
limiter = Limiter(key_func=get_remote_address)


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Archivo SCIVOLI Gateway", version="0.2.0")
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    if settings.resolved_cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.resolved_cors_origins,
            allow_credentials=False,
            allow_methods=["GET", "POST"],
            allow_headers=["*"],
        )

    @app.middleware("http")
    async def sanitize_logs(request: Request, call_next):
        if request.url.path.startswith("/v1/"):
            logger.info("gateway_request path=%s method=%s", request.url.path, request.method)
        return await call_next(request)

    @app.get("/health", response_model=HealthResponse)
    @limiter.limit(settings.rate_limit)
    async def health(request: Request) -> HealthResponse:
        return HealthResponse()

    compute_router = compute.build_router(limiter, settings.rate_limit)
    app.include_router(compute_router)
    return app


app = create_app()
