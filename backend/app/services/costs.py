from app.models.schemas import CostEstimate


GOOGLE_DOCUMENT_AI_OCR_PER_1K_PAGES_USD = 1.50
GEMINI_FLASH_INPUT_PER_1M_TOKENS_USD = 0.30
GEMINI_FLASH_OUTPUT_PER_1M_TOKENS_USD = 2.50
GEMINI_EMBEDDING_PER_1M_TOKENS_USD = 0.20
ANTHROPIC_HAIKU_INPUT_PER_1M_TOKENS_USD = 1.00
ANTHROPIC_HAIKU_OUTPUT_PER_1M_TOKENS_USD = 5.00


def estimate_processing_cost(total_pages: int, scanned_pages: int) -> CostEstimate:
    if total_pages < 0 or scanned_pages < 0:
        raise ValueError("page counts must be non-negative")
    native_text_pages = max(total_pages - scanned_pages, 0)

    extraction_input_tokens = total_pages * 900
    extraction_output_tokens = total_pages * 180
    embedding_tokens = total_pages * 900
    fallback_low_pages = round(total_pages * 0.05)
    fallback_high_pages = round(total_pages * 0.15)

    google_ocr_usd = (scanned_pages / 1_000) * GOOGLE_DOCUMENT_AI_OCR_PER_1K_PAGES_USD
    gemini_extraction_usd = (
        (extraction_input_tokens / 1_000_000) * GEMINI_FLASH_INPUT_PER_1M_TOKENS_USD
        + (extraction_output_tokens / 1_000_000) * GEMINI_FLASH_OUTPUT_PER_1M_TOKENS_USD
    ) * 0.5
    gemini_embedding_usd = ((embedding_tokens / 1_000_000) * GEMINI_EMBEDDING_PER_1M_TOKENS_USD) * 0.5
    anthropic_fallback_low_usd = _estimate_anthropic_fallback(fallback_low_pages)
    anthropic_fallback_high_usd = _estimate_anthropic_fallback(fallback_high_pages)

    total_low_usd = google_ocr_usd + gemini_extraction_usd + gemini_embedding_usd + anthropic_fallback_low_usd
    total_high_usd = google_ocr_usd + gemini_extraction_usd + gemini_embedding_usd + anthropic_fallback_high_usd

    return CostEstimate(
        pages=total_pages,
        scanned_pages=scanned_pages,
        native_text_pages=native_text_pages,
        google_ocr_usd=round(google_ocr_usd, 4),
        gemini_extraction_usd=round(gemini_extraction_usd, 4),
        gemini_embedding_usd=round(gemini_embedding_usd, 4),
        anthropic_fallback_low_usd=round(anthropic_fallback_low_usd, 4),
        anthropic_fallback_high_usd=round(anthropic_fallback_high_usd, 4),
        total_low_usd=round(total_low_usd, 4),
        total_high_usd=round(total_high_usd, 4),
    )


def _estimate_anthropic_fallback(page_count: int) -> float:
    input_tokens = page_count * 1_200
    output_tokens = page_count * 220
    return (
        (input_tokens / 1_000_000) * ANTHROPIC_HAIKU_INPUT_PER_1M_TOKENS_USD
        + (output_tokens / 1_000_000) * ANTHROPIC_HAIKU_OUTPUT_PER_1M_TOKENS_USD
    ) * 0.5
