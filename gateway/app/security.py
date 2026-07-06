from fastapi import Header, HTTPException, status

from gateway.app.config import get_settings


async def verify_gateway_token(x_gateway_token: str | None = Header(default=None)) -> None:
    settings = get_settings()
    if not settings.token_required:
        return
    if not x_gateway_token or x_gateway_token != settings.gateway_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid gateway token")
