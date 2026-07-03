import hashlib
import mimetypes
from pathlib import Path
from uuid import uuid4

from PIL import Image
from pypdf import PdfReader

from app.models.schemas import AuditResponse, FileAudit
from app.services.costs import estimate_processing_cost
from app.services.paths import resolve_source_path

SUPPORTED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".tif", ".tiff", ".webp"}


def discover_supported_files(source_path: str, limit: int | None = None) -> list[Path]:
    root = resolve_source_path(source_path)
    if not root.exists():
        raise FileNotFoundError(source_path)

    files = [root] if root.is_file() else [path for path in root.rglob("*") if path.is_file()]
    supported_files = [path for path in files if path.suffix.lower() in SUPPORTED_EXTENSIONS]
    supported_files.sort(key=lambda path: str(path).lower())
    return supported_files[:limit] if limit else supported_files


def audit_source(source_path: str, sample_limit: int) -> AuditResponse:
    if sample_limit < 1:
        raise ValueError("sample_limit must be positive")

    files = discover_supported_files(source_path)
    sampled = files[:sample_limit]
    audits = [_audit_file(path) for path in sampled]
    total_bytes = sum(path.stat().st_size for path in files)
    total_pages = _estimate_total_pages(files, audits)
    scanned_pages = _estimate_scanned_pages(files, audits, total_pages)
    native_text_pages = max(total_pages - scanned_pages, 0)

    return AuditResponse(
        run_id=uuid4(),
        source_path=source_path,
        total_files=len(files),
        total_bytes=total_bytes,
        total_pages=total_pages,
        scanned_pages=scanned_pages,
        native_text_pages=native_text_pages,
        sampled_files=audits,
        estimate=estimate_processing_cost(total_pages, scanned_pages),
    )


def extract_text_by_page(file_path: Path) -> list[str]:
    if file_path.suffix.lower() != ".pdf":
        return [""]

    reader = PdfReader(str(file_path))
    return [(page.extract_text() or "").strip() for page in reader.pages]


def _audit_file(path: Path) -> FileAudit:
    mime_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    page_count, has_native_text = _inspect_document(path)
    is_probably_scanned = not has_native_text

    return FileAudit(
        path=str(path),
        filename=path.name,
        extension=path.suffix.lower(),
        mime_type=mime_type,
        size_bytes=path.stat().st_size,
        sha256=_sha256(path),
        page_count=page_count,
        has_native_text=has_native_text,
        is_probably_scanned=is_probably_scanned,
    )


def _inspect_document(path: Path) -> tuple[int, bool]:
    if path.suffix.lower() == ".pdf":
        return _inspect_pdf(path)
    return _inspect_image(path)


def _inspect_pdf(path: Path) -> tuple[int, bool]:
    reader = PdfReader(str(path))
    page_count = len(reader.pages)
    text_pages = 0
    for page in reader.pages[:5]:
        text = (page.extract_text() or "").strip()
        if len(text) >= 40:
            text_pages += 1
    return page_count, text_pages > 0


def _inspect_image(path: Path) -> tuple[int, bool]:
    with Image.open(path) as image:
        image.verify()
    return 1, False


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _estimate_total_pages(files: list[Path], audits: list[FileAudit]) -> int:
    if len(files) == len(audits):
        return sum(audit.page_count for audit in audits)
    if not audits:
        return 0
    average_pages = sum(audit.page_count for audit in audits) / len(audits)
    return round(average_pages * len(files))


def _estimate_scanned_pages(files: list[Path], audits: list[FileAudit], total_pages: int) -> int:
    if not audits or total_pages == 0:
        return 0
    sampled_pages = sum(audit.page_count for audit in audits)
    scanned_sample_pages = sum(audit.page_count for audit in audits if audit.is_probably_scanned)
    if len(files) == len(audits):
        return scanned_sample_pages
    scanned_ratio = scanned_sample_pages / sampled_pages if sampled_pages else 0
    return round(total_pages * scanned_ratio)
