"""Extrae carpetas documentales del RAR PEC SAS en bloques organizados."""

from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path

ARCHIVE = Path(r"C:\Users\ticia\Downloads\pec sas.rar")
SOURCE_ROOT = Path(__file__).resolve().parents[1] / "data" / "source"

BLOCKS: dict[str, list[str]] = {
    "01_ENARGAS_RMH": [
        "consulta documentacion presentacion rmh 2025",
        "TRAMITES HASTA 2026",
        "SUSPENCION ENARGAS",
        "NORMATIVAS",
        "cambios normativa 2025",
        "prsentacion rmh 2026",
        "RMH",
        "levantamiento suspencion fotos nota 10 de septiembre 2025",
        "NOTA A INTERVENTOR",
        "notas modelo presentacion",
    ],
    "02_CONTABLE_AFIP": [
        "contador pec",
        "DECLARACION JURADA DE INTERESES",
        "DECLARACIONES JURADAS VARIAS",
        "PAPELES SCIVOLI SAS",
    ],
    "03_OPERATIVO_GNV": [
        "TALLERES",
        "DESMONTAJES Y CONVERSIONES",
        "CERTIFICADO CAPACITACION",
        "CURSOS GNC",
        "seguros 20262027",
        "obleas",
        "FOTOS PEC",
        "RENSIN 2024",
    ],
    "04_VARIOS": [
        "CARTA USUARIO A ENTE",
        "NOTAS USUARIOS",
        "MANUALES",
        "mensajes whats ap a revisar",
        "publicidad pec",
    ],
}

EXCLUDED = {
    "PECGestor",
    "PACK SOFTWARE GNC",
    "PROGRAMAS VARIOS",
    "Sistema",
    "qualicontrol",
}


def extract_folder(block: str, folder: str) -> tuple[bool, str]:
    target = SOURCE_ROOT / block
    target.mkdir(parents=True, exist_ok=True)
    member = f"pec sas/{folder}"
    command = [
        "tar",
        "-xf",
        str(ARCHIVE),
        "-C",
        str(target),
        "--strip-components=1",
        member,
    ]
    started = time.time()
    result = subprocess.run(command, capture_output=True, text=True)
    elapsed = time.time() - started
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "unknown error").strip()
        return False, f"FAIL {block}/{folder} ({elapsed:.1f}s): {detail}"
    return True, f"OK   {block}/{folder} ({elapsed:.1f}s)"


def count_files(root: Path) -> int:
    if not root.exists():
        return 0
    return sum(1 for path in root.rglob("*") if path.is_file())


def main() -> int:
    if not ARCHIVE.exists():
        print(f"Archivo no encontrado: {ARCHIVE}", file=sys.stderr)
        return 1

    print(f"Archivo: {ARCHIVE}")
    print(f"Destino: {SOURCE_ROOT}")
    print(f"Excluido: {', '.join(sorted(EXCLUDED))}")
    print()

    results: list[tuple[bool, str]] = []
    for block, folders in BLOCKS.items():
        print(f"=== {block} ===")
        for folder in folders:
            ok, message = extract_folder(block, folder)
            results.append((ok, message))
            print(message)
        print()

    ok_count = sum(1 for ok, _ in results if ok)
    fail_count = len(results) - ok_count

    print("=== RESUMEN EXTRACCION ===")
    print(f"Carpetas procesadas: {len(results)}")
    print(f"Exitosas: {ok_count}")
    print(f"Fallidas: {fail_count}")

    print("\n=== CONTEO POR BLOQUE ===")
    total_files = 0
    for block in BLOCKS:
        block_path = SOURCE_ROOT / block
        files = count_files(block_path)
        total_files += files
        print(f"{block}: {files} archivos")

    print(f"TOTAL: {total_files} archivos")
    return 0 if fail_count == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
