from pathlib import Path

from pdf2image import convert_from_path
from PIL import Image
import pytesseract


def ocr_file_by_page(file_path: Path) -> list[str]:
    if not file_path.exists():
        raise FileNotFoundError(str(file_path))
    if file_path.suffix.lower() == ".pdf":
        return _ocr_pdf(file_path)
    return [_ocr_image(file_path)]


def _ocr_pdf(file_path: Path) -> list[str]:
    images = convert_from_path(str(file_path), dpi=220)
    return [pytesseract.image_to_string(image, lang="spa+eng").strip() for image in images]


def _ocr_image(file_path: Path) -> str:
    with Image.open(file_path) as image:
        return pytesseract.image_to_string(image, lang="spa+eng").strip()
