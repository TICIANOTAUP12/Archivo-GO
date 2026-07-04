import csv
import hashlib
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "data" / "source" / "01_ENARGAS_RMH"
SUPPORTED = {".pdf", ".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp"}
OFFICE = {".docx", ".doc", ".xlsx", ".xls", ".ppt", ".pptx"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    rows: list[dict[str, str | int]] = []
    name_counts: Counter[str] = Counter()
    hash_counts: Counter[str] = Counter()

    files = sorted(path for path in ROOT.rglob("*") if path.is_file())
    for path in files:
        name_counts[path.name.lower()] += 1

    for path in files:
        digest = sha256(path)
        hash_counts[digest] += 1
        extension = path.suffix.lower()
        if extension in SUPPORTED:
            supported = "si"
        elif extension in OFFICE:
            supported = "office"
        else:
            supported = "no"

        rows.append(
            {
                "ruta_relativa": path.relative_to(ROOT).as_posix(),
                "nombre": path.name,
                "extension": extension,
                "tamano_bytes": path.stat().st_size,
                "sha256": digest,
                "soportado_app": supported,
                "duplicado_por_nombre": "pendiente",
                "duplicado_por_contenido": "pendiente",
            }
        )

    for row in rows:
        row["duplicado_por_nombre"] = "si" if name_counts[str(row["nombre"]).lower()] > 1 else "no"
        row["duplicado_por_contenido"] = "si" if hash_counts[str(row["sha256"])] > 1 else "no"

    csv_path = ROOT.parent / "inventario_enargas_rmh.csv"
    with csv_path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    supported_count = sum(1 for row in rows if row["soportado_app"] == "si")
    office_count = sum(1 for row in rows if row["soportado_app"] == "office")
    dup_name = sum(1 for row in rows if row["duplicado_por_nombre"] == "si")
    dup_hash = sum(1 for row in rows if row["duplicado_por_contenido"] == "si")

    keywords = (
        "balance",
        "713",
        "899",
        "522",
        "oblea",
        "poliza",
        "auditor",
        "asamblea",
        "gerencia",
        "enargas",
        "if-",
        "pv-",
        "no-",
        "resol",
        "afip",
        "scivoli",
    )
    key_files = [row for row in rows if any(keyword in str(row["nombre"]).lower() for keyword in keywords)]

    summary_lines = [
        "# ENARGAS RMH - carpeta extraida",
        "",
        "Origen: PARA PRESENTAR CARPETA EN ENARGAS 202420252026",
        f"Ubicacion: `{ROOT}`",
        "",
        "## Conteo",
        f"- Archivos totales: {len(rows)}",
        f"- Soportados por app (PDF/imagen): {supported_count}",
        f"- Office (doc/xls/ppt): {office_count}",
        f"- No soportados: {len(rows) - supported_count - office_count}",
        f"- Duplicados por nombre: {dup_name}",
        f"- Duplicados por contenido (hash): {dup_hash}",
        "",
        "## Inventario",
        f"- CSV: `{csv_path}`",
        "",
        "## Archivos clave detectados",
    ]
    for row in key_files[:40]:
        summary_lines.append(f"- `{row['ruta_relativa']}` ({row['tamano_bytes']} bytes)")
    if len(key_files) > 40:
        summary_lines.append(f"- ... y {len(key_files) - 40} mas")

    summary_path = ROOT / "RESUMEN.md"
    summary_path.write_text("\n".join(summary_lines) + "\n", encoding="utf-8")

    print(f"FILES={len(rows)}")
    print(f"SUPPORTED={supported_count}")
    print(f"OFFICE={office_count}")
    print(f"DUP_NAME={dup_name}")
    print(f"DUP_HASH={dup_hash}")
    print(f"CSV={csv_path}")
    print(f"SUMMARY={summary_path}")


if __name__ == "__main__":
    main()
