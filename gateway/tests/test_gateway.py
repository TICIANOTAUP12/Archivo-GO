import pytest
from httpx import ASGITransport, AsyncClient

from gateway.app.main import app
from shared.ai.providers import _extract_locally


@pytest.mark.asyncio
async def test_health_ok():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_extract_local_provider():
    transport = ASGITransport(app=app)
    payload = {
        "text": "Patente XLF030 Nro de caso 73919692 Matricula 12345",
        "provider": "local",
    }
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/v1/extract", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "local"
    assert body["fields"]["patente"] == "XLF030"


@pytest.mark.asyncio
async def test_embed_local_provider():
    transport = ASGITransport(app=app)
    payload = {"text": "Texto de prueba para embedding local", "provider": "local"}
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/v1/embed", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert len(body["embedding"]) == 768


@pytest.mark.asyncio
async def test_process_page_local():
    transport = ASGITransport(app=app)
    payload = {
        "text": "Patente ABC123 Trámite 999",
        "provider": "local",
        "embedding_provider": "local",
    }
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/v1/process-page", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert len(body["embedding"]) == 768
    assert body["fields"]["patente"] == "ABC123"


def test_local_extraction_helper():
    fields = _extract_locally("Patente XLF030")
    assert fields.patente == "XLF030"
