"""Ingesta masiva deduplicada hacia el backend via stream tar + API."""

from __future__ import annotations

import csv
import json
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

SOURCE_ROOT = Path(__file__).resolve().parents[1] / "data" / "source"
CSV_PATH = SOURCE_ROOT / "inventario_maestro_pec_sas.csv"
API_BASE = "http://localhost:8080"
CONTAINER = "archivo_backend"
BATCH_SIZE = 75
SUPPORTED = {".pdf", ".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp"}


def log(message: str) -> None:
    print(message, flush=True)


def load_unique_supported() -> list[dict[str, str]]:
    if not CSV_PATH.exists():
        raise FileNotFoundError(f"No existe inventario: {CSV_PATH}")

    seen_hashes: set[str] = set()
    selected: list[dict[str, str]] = []
    with CSV_PATH.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            if row.get("soportado_app") != "si":
                continue
            digest = row["sha256"]
            if digest in seen_hashes:
                continue
            seen_hashes.add(digest)
            block = row["bloque"]
            rel = row["ruta_relativa"]
            host_path = SOURCE_ROOT / block / rel
            if not host_path.is_file():
                continue
            selected.append(
                {
                    "block": block,
                    "relative": rel.replace("\\", "/"),
                    "host_path": str(host_path),
                    "sha256": digest,
                }
            )
    return selected


def stream_batch(batch_index: int, files: list[dict[str, str]]) -> str:
    container_dir = f"/tmp/pec-mass/batch-{batch_index:04d}"
    staging = SOURCE_ROOT / "_ingest_staging" / f"batch-{batch_index:04d}"
    if staging.exists():
        shutil.rmtree(staging)
    staging.mkdir(parents=True, exist_ok=True)

    for item in files:
        source = Path(item["host_path"])
        target = staging / source.name
        if target.exists():
            stem = source.stem
            suffix = source.suffix
            counter = 2
            while target.exists():
                target = staging / f"{stem}__{counter}{suffix}"
                counter += 1
        target.write_bytes(source.read_bytes())

    subprocess.run(
        ["docker", "exec", CONTAINER, "rm", "-rf", container_dir],
        check=False,
        capture_output=True,
    )
    subprocess.run(
        ["docker", "exec", CONTAINER, "mkdir", "-p", container_dir],
        check=True,
        capture_output=True,
    )
    tar_cmd = f'tar -cf - -C "{staging}" . | docker exec -i {CONTAINER} tar -xf - -C {container_dir}'
    result = subprocess.run(tar_cmd, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr or result.stdout or "tar stream failed")
    return container_dir


def post_ingest(source_path: str) -> dict[str, object]:
    payload = json.dumps({"source_path": source_path, "dry_run": False}).encode("utf-8")
    request = urllib.request.Request(
        f"{API_BASE}/documents/ingest",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        return json.loads(response.read().decode("utf-8"))


def count_documents() -> tuple[int, int]:
    result = subprocess.run(
        [
            "docker",
            "exec",
            "archivo_postgres",
            "psql",
            "-U",
            "archivo",
            "-d",
            "archivo_digital",
            "-t",
            "-A",
            "-c",
            "SELECT COUNT(*) FILTER (WHERE status IN ('indexed','needs_review','failed')), "
            "COUNT(*) FILTER (WHERE status='processing') FROM documents;",
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    parts = result.stdout.strip().split("|")
    return int(parts[0] or "0"), int(parts[1] or "0")


def wait_for_batch(before_total: int, expected_added: int, timeout_seconds: int = 7200) -> None:
    deadline = time.time() + timeout_seconds
    target = before_total + expected_added
    while time.time() < deadline:
        total, processing = count_documents()
        print(f"  progreso docs={total}/{target} processing={processing}", flush=True)
        if total >= target and processing == 0:
            return
        time.sleep(25)
    log("  aviso: timeout esperando lote, continuo con el siguiente")


def main() -> int:
    files = load_unique_supported()
    log(f"Archivos unicos soportados: {len(files)}")
    if not files:
        log("No hay archivos para ingestar.")
        return 1

    batches: list[list[dict[str, str]]] = []
    for index in range(0, len(files), BATCH_SIZE):
        batches.append(files[index : index + BATCH_SIZE])

    log(f"Lotes: {len(batches)} x ~{BATCH_SIZE}")

    ingested_runs: list[dict[str, object]] = []
    for batch_index, batch in enumerate(batches, start=1):
        log(f"\n=== Lote {batch_index}/{len(batches)} ({len(batch)} archivos) ===")
        before_total, _ = count_documents()
        try:
            container_dir = stream_batch(batch_index, batch)
            response = post_ingest(container_dir)
            log(f"  ingest_ok run_id={response.get('run_id')} queued={response.get('queued_documents')}")
            ingested_runs.append(response)
            wait_for_batch(before_total, len(batch))
        except (urllib.error.URLError, RuntimeError, subprocess.CalledProcessError) as error:
            log(f"  ERROR lote {batch_index}: {error}")
            continue

    final_total, processing = count_documents()
    log("\n=== INGESTA FINALIZADA ===")
    log(f"Lotes enviados: {len(ingested_runs)}")
    log(f"Documentos indexados: {final_total}")
    log(f"En procesamiento: {processing}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
