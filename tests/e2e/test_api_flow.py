import time
from uuid import UUID

import httpx
import pytest

INGEST_POLL_SECONDS = 120
INGEST_POLL_INTERVAL = 3


def test_health_ok(api_client: httpx.Client) -> None:
    response = api_client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["database"] == "ok"


def test_audit_fixture_folder(api_client: httpx.Client, fixture_source: str) -> None:
    response = api_client.post(
        "/audit",
        json={"source_path": fixture_source, "sample_limit": 5},
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["total_files"] >= 1
    assert payload["total_pages"] >= 1
    assert len(payload["sampled_files"]) >= 1
    UUID(payload["run_id"])


def test_ingest_dry_run(api_client: httpx.Client, fixture_source: str) -> None:
    response = api_client.post(
        "/documents/ingest",
        json={
            "source_path": fixture_source,
            "max_documents": 1,
            "dry_run": True,
        },
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["dry_run"] is True
    assert payload["queued_documents"] >= 1


def test_ingest_and_search_pilot(api_client: httpx.Client, fixture_source: str) -> None:
    ingest_response = api_client.post(
        "/documents/ingest",
        json={
            "source_path": fixture_source,
            "max_documents": 1,
            "dry_run": False,
        },
    )
    assert ingest_response.status_code == 200, ingest_response.text
    ingest_payload = ingest_response.json()
    assert ingest_payload["queued_documents"] >= 1
    run_id = ingest_payload["run_id"]

    indexed = _wait_for_indexed_document(api_client, run_id)
    assert indexed is not None, f"document for run {run_id} was not indexed in time"

    search_response = api_client.post(
        "/search",
        json={"query": indexed["filename"], "limit": 10},
    )
    assert search_response.status_code == 200, search_response.text
    results = search_response.json()
    assert isinstance(results, list)
    assert len(results) >= 1
    assert any(item["document_id"] == indexed["id"] for item in results)


def _wait_for_indexed_document(
    api_client: httpx.Client,
    run_id: str,
) -> dict[str, object] | None:
    deadline = time.time() + INGEST_POLL_SECONDS
    while time.time() < deadline:
        recent_response = api_client.get("/documents/recent")
        if recent_response.status_code == 200:
            for document in recent_response.json():
                if document.get("run_id") == run_id and document.get("status") == "indexed":
                    return document
                if document.get("status") == "failed":
                    pytest.fail(f"ingest failed for document: {document}")
        time.sleep(INGEST_POLL_INTERVAL)
    return None
