import pytest

from gateway.app.config import get_settings


@pytest.fixture(autouse=True)
def gateway_without_token(monkeypatch: pytest.MonkeyPatch) -> None:
    """Tests must not depend on a developer's local .env GATEWAY_TOKEN."""
    monkeypatch.setenv("GATEWAY_TOKEN", "")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
