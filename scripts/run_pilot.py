import argparse
import json
from typing import Any
from urllib import request


def main() -> None:
    parser = argparse.ArgumentParser(description="Ejecuta auditoria e ingesta piloto sobre una muestra.")
    parser.add_argument("source_path", help="Carpeta o archivo a auditar")
    parser.add_argument("--api", default="http://localhost:8080", help="URL base del backend")
    parser.add_argument("--sample-limit", type=int, default=250, help="Cantidad maxima de archivos para auditar")
    parser.add_argument("--max-documents", type=int, default=25, help="Cantidad maxima de documentos para ingestar")
    args = parser.parse_args()

    audit = post_json(
        f"{args.api}/audit",
        {"source_path": args.source_path, "sample_limit": args.sample_limit},
    )
    print(json.dumps({"audit": audit}, indent=2, ensure_ascii=False))

    ingest = post_json(
        f"{args.api}/documents/ingest",
        {"source_path": args.source_path, "max_documents": args.max_documents, "dry_run": False},
    )
    print(json.dumps({"ingest": ingest}, indent=2, ensure_ascii=False))


def post_json(url: str, payload: dict[str, Any]) -> dict[str, Any]:
    body = json.dumps(payload).encode("utf-8")
    http_request = request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with request.urlopen(http_request, timeout=60) as response:
        response_body = response.read().decode("utf-8")
    decoded = json.loads(response_body)
    if not isinstance(decoded, dict):
        raise ValueError("API response must be a JSON object")
    return decoded


if __name__ == "__main__":
    main()
