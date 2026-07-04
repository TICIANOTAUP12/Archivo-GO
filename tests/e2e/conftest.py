import os
from pathlib import Path

import httpx
import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[2]
FIXTURE_DIR = PROJECT_ROOT / "tests" / "fixtures" / "e2e"
DEFAULT_INPUT_ROOT = PROJECT_ROOT / "data" / "source"

BASE_URL = os.getenv("E2E_BASE_URL", "http://localhost:8080")
INPUT_ROOT = Path(os.getenv("E2E_INPUT_ROOT", str(DEFAULT_INPUT_ROOT))).resolve()
FIXTURE_SOURCE = str(FIXTURE_DIR.resolve())


@pytest.fixture
def api_client() -> httpx.Client:
    return httpx.Client(base_url=BASE_URL, timeout=60.0)


@pytest.fixture
def fixture_source() -> str:
    if not FIXTURE_DIR.exists() or not any(FIXTURE_DIR.glob("*.pdf")):
        pytest.skip("E2E fixture PDF not found in tests/fixtures/e2e/")
    return FIXTURE_SOURCE
