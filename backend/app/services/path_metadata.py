import re
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.schemas import ExtractedFields

OLD_PLATE_PATTERN = re.compile(r"\b([A-Z]{3}\d{3})\b", re.IGNORECASE)
MERCOSUR_PLATE_PATTERN = re.compile(r"\b([A-Z]{2}\d{3}[A-Z]{2})\b", re.IGNORECASE)
TRAMITE_PATTERN = re.compile(r"\b(\d{8,9})\b")
DOMINIO_PATTERN = re.compile(
    r"\b(?:patente|dominio)\s*(?:[:#-]|n[°ºo.]*)\s*([A-Z0-9][A-Z0-9./-]{4,10})\b",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class PathMetadata:
    patente: str | None = None
    numero_caso: str | None = None


def extract_path_metadata(source_path: str | Path) -> PathMetadata:
    path = Path(str(source_path))
    haystack = " ".join(part for part in [path.name, *path.parts] if part)

    patente = _extract_patente(haystack)
    numero_caso = _extract_numero_caso(haystack)

    return PathMetadata(patente=patente, numero_caso=numero_caso)


def merge_path_metadata(fields: "ExtractedFields", metadata: PathMetadata) -> "ExtractedFields":
    if metadata.patente and not fields.patente:
        fields.patente = metadata.patente
    if metadata.numero_caso and not fields.numero_caso:
        fields.numero_caso = metadata.numero_caso
    if metadata.patente or metadata.numero_caso:
        fields.confidence = min(max(fields.confidence, 0.55), 1.0)
    return fields


def build_search_context(source_path: str | Path) -> str:
    metadata = extract_path_metadata(source_path)
    parts: list[str] = []
    if metadata.patente:
        parts.append(f"Patente {metadata.patente}")
    if metadata.numero_caso:
        parts.append(f"Tramite {metadata.numero_caso}")
    parts.append(Path(str(source_path)).name)
    return " ".join(parts)


def normalize_patente(value: str | None) -> str | None:
    if not value:
        return None
    normalized = re.sub(r"[^A-Z0-9]", "", value.upper())
    if len(normalized) < 5:
        return None
    return normalized


def _extract_patente(haystack: str) -> str | None:
    dominio_match = DOMINIO_PATTERN.search(haystack)
    if dominio_match:
        return normalize_patente(dominio_match.group(1))

    for pattern in (OLD_PLATE_PATTERN, MERCOSUR_PLATE_PATTERN):
        match = pattern.search(haystack.upper())
        if match:
            return normalize_patente(match.group(1))
    return None


def _extract_numero_caso(haystack: str) -> str | None:
    match = TRAMITE_PATTERN.search(haystack)
    return match.group(1) if match else None
