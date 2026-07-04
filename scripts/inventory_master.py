"""Inventario maestro de todos los bloques extraidos de PEC SAS."""

from __future__ import annotations

import csv
import hashlib
from collections import Counter
from pathlib import Path

SOURCE_ROOT = Path(__file__).resolve().parents[1] / "data" / "source"
BLOCKS = ["01_ENARGAS_RMH", "02_CONTABLE_AFIP", "03_OPERATIVO_GNV", "04_VARIOS", "pec-sas-muestra"]
SUPPORTED = {".pdf", ".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp"}
OFFICE = {".docx", ".doc", ".xlsx", ".xls", ".ppt", ".pptx"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    rows: list[dict[str, str | int]] = []
    hash_counts: Counter[str] = Counter()
    name_counts: Counter[str] = Counter()

    all_files: list[tuple[str, Path]] = []
    for block in BLOCKS:
        block_path = SOURCE_ROOT / block
        if not block_path.exists():
            continue
        for path in sorted(block_path.rglob("*")):
            if path.is_file():
                all_files.append((block, path))
                name_counts[path.name.lower()] += 1

    file_hashes: dict[Path, str] = {}
    skipped: list[tuple[str, str]] = []
    for block, path in all_files:
        try:
            digest = sha256(path)
        except OSError as error:
            skipped.append((f"{block}/{path.name}", str(error)))
            continue
        file_hashes[path] = digest
        hash_counts[digest] += 1

    for block, path in all_files:
        if path not in file_hashes:
            continue
        extension = path.suffix.lower()
        if extension in SUPPORTED:
            supported = "si"
        elif extension in OFFICE:
            supported = "office"
        else:
            supported = "no"

        digest = file_hashes[path]
        rows.append(
            {
                "bloque": block,
                "ruta_relativa": path.relative_to(SOURCE_ROOT / block).as_posix(),
                "nombre": path.name,
                "extension": extension,
                "tamano_bytes": path.stat().st_size,
                "sha256": digest,
                "soportado_app": supported,
                "duplicado_por_nombre": "si" if name_counts[path.name.lower()] > 1 else "no",
                "duplicado_por_contenido": "si" if hash_counts[digest] > 1 else "no",
            }
        )

    csv_path = SOURCE_ROOT / "inventario_maestro_pec_sas.csv"
    with csv_path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    summary_path = SOURCE_ROOT / "RESUMEN_EXTRACCION.md"
    by_block: Counter[str] = Counter(row["bloque"] for row in rows)
    by_ext: Counter[str] = Counter(str(row["extension"]) for row in rows)
    supported_count = sum(1 for row in rows if row["soportado_app"] == "si")
    office_count = sum(1 for row in rows if row["soportado_app"] == "office")
    dup_hash = sum(1 for row in rows if row["duplicado_por_contenido"] == "si")

    lines = [
        "# PEC SAS - extraccion completa",
        "",
        f"Origen: `C:\\Users\\ticia\\Downloads\\pec sas.rar`",
        f"Destino: `{SOURCE_ROOT}`",
        "",
        "## Bloques extraidos",
    ]
    for block in BLOCKS:
        if by_block[block]:
            lines.append(f"- `{block}`: {by_block[block]} archivos")

    lines.extend(
        [
            "",
            f"**Total archivos:** {len(rows)}",
            f"**Soportados app (PDF/imagen):** {supported_count}",
            f"**Office (doc/xls/ppt):** {office_count}",
            f"**Duplicados por contenido:** {dup_hash}",
            "",
            "## Top extensiones",
        ]
    )
    for ext, count in by_ext.most_common(15):
        lines.append(f"- `{ext or '<sin_ext>'}`: {count}")

    lines.extend(
        [
            "",
            "## Excluido del RAR",
            "- PECGestor (software/logs/backups)",
            "- PACK SOFTWARE GNC",
            "- PROGRAMAS VARIOS",
            "- Sistema",
            "- qualicontrol",
            "",
            "## Inventarios",
            f"- Maestro: `{csv_path}`",
            f"- ENARGAS RMH: `{SOURCE_ROOT / 'inventario_enargas_rmh.csv'}`",
            "",
            "## Proximo paso sugerido",
            "- Deduplicar por hash antes de ingesta masiva",
            "- Convertir Office a PDF o indexar aparte",
        ]
    )
    if skipped:
        lines.extend(["", f"## Archivos omitidos en hash ({len(skipped)})"])
        for name, reason in skipped[:20]:
            lines.append(f"- `{name}`: {reason}")
        if len(skipped) > 20:
            lines.append(f"- ... y {len(skipped) - 20} mas")
    summary_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(f"TOTAL={len(rows)}")
    print(f"SUPPORTED={supported_count}")
    print(f"OFFICE={office_count}")
    print(f"DUP_HASH={dup_hash}")
    print(f"CSV={csv_path}")
    print(f"SUMMARY={summary_path}")


if __name__ == "__main__":
    main()
