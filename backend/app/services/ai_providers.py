import hashlib
import json
import re
from collections.abc import Sequence

from app.core.config import Settings
from app.models.schemas import ExtractedFields, ProviderName, TokenUsage

MATRICULA_PATTERN = re.compile(
    r"\b(?:matr[ií]cula|mat\.)\s*(?:[:#-]|n[°ºo.]*)\s*([A-Z0-9][A-Z0-9./-]{3,19})\b",
    re.IGNORECASE,
)
CASE_PATTERN = re.compile(
    r"\b(?:n(?:ro|[úu]mero)\.?\s*(?:de\s*)?caso|caso|expediente|denuncia|acta)"
    r"\s*(?:[:#-]|n[°ºo.]*)\s*([A-Z0-9][A-Z0-9./-]{3,30})\b",
    re.IGNORECASE,
)
DATE_PATTERN = re.compile(r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b")


async def extract_fields(text: str, settings: Settings) -> tuple[ExtractedFields, ProviderName, TokenUsage]:
    if not text.strip():
        return ExtractedFields(confidence=0), ProviderName.local, TokenUsage()

    primary_fields, primary_provider, primary_usage = await _extract_with_primary(text, settings)
    should_fallback = (
        settings.enable_anthropic_fallback
        and settings.anthropic_api_key
        and primary_fields.confidence < settings.min_extraction_confidence
    )
    if not should_fallback:
        return primary_fields, primary_provider, primary_usage

    fallback_fields, fallback_usage = await _extract_with_anthropic(text, settings)
    if fallback_fields.confidence <= primary_fields.confidence:
        return primary_fields, primary_provider, primary_usage
    merged_usage = TokenUsage(
        input_tokens=primary_usage.input_tokens + fallback_usage.input_tokens,
        output_tokens=primary_usage.output_tokens + fallback_usage.output_tokens,
        embedding_tokens=primary_usage.embedding_tokens + fallback_usage.embedding_tokens,
        cost_usd=primary_usage.cost_usd + fallback_usage.cost_usd,
    )
    return fallback_fields, ProviderName.anthropic, merged_usage


async def embed_text(text: str, settings: Settings) -> tuple[list[float], TokenUsage]:
    if not text.strip():
        return [0.0] * 768, TokenUsage()
    if settings.embedding_provider == "google" and settings.google_api_key:
        return await _embed_with_google(text, settings)
    return _embed_locally(text)


async def _extract_with_primary(text: str, settings: Settings) -> tuple[ExtractedFields, ProviderName, TokenUsage]:
    if settings.default_provider == "google" and settings.google_api_key:
        return await _extract_with_google(text, settings)
    if settings.default_provider == "anthropic" and settings.anthropic_api_key:
        fields, usage = await _extract_with_anthropic(text, settings)
        return fields, ProviderName.anthropic, usage
    return _extract_locally(text), ProviderName.local, _usage_for_text(text, 0.0002)


async def _extract_with_google(text: str, settings: Settings) -> tuple[ExtractedFields, ProviderName, TokenUsage]:
    try:
        from google import genai
    except ImportError:
        return _extract_locally(text), ProviderName.local, _usage_for_text(text, 0.0002)

    client = genai.Client(api_key=settings.google_api_key)
    prompt = _build_extraction_prompt(text)
    response = await client.aio.models.generate_content(model=settings.google_model, contents=prompt)
    fields = _parse_fields(response.text or "")
    usage = _usage_for_text(prompt, 0.0007, output_text=response.text or "")
    return fields, ProviderName.google, usage


async def _extract_with_anthropic(text: str, settings: Settings) -> tuple[ExtractedFields, TokenUsage]:
    try:
        import anthropic
    except ImportError:
        return _extract_locally(text), _usage_for_text(text, 0.001)

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    prompt = _build_extraction_prompt(text)
    response = await client.messages.create(
        model=settings.anthropic_model,
        max_tokens=600,
        messages=[{"role": "user", "content": prompt}],
    )
    response_text = "".join(block.text for block in response.content if block.type == "text")
    fields = _parse_fields(response_text)
    usage = TokenUsage(
        input_tokens=response.usage.input_tokens,
        output_tokens=response.usage.output_tokens,
        cost_usd=_estimate_anthropic_usage_cost(response.usage.input_tokens, response.usage.output_tokens),
    )
    return fields, usage


async def _embed_with_google(text: str, settings: Settings) -> tuple[list[float], TokenUsage]:
    try:
        from google import genai
    except ImportError:
        return _embed_locally(text)

    client = genai.Client(api_key=settings.google_api_key)
    response = await client.aio.models.embed_content(model=settings.google_embedding_model, contents=text[:12_000])
    embedding_values = response.embeddings[0].values[:768]
    vector = _normalize_vector([float(value) for value in embedding_values], 768)
    token_usage = TokenUsage(embedding_tokens=_estimate_tokens(text), cost_usd=(_estimate_tokens(text) / 1_000_000) * 0.20)
    return vector, token_usage


def _extract_locally(text: str) -> ExtractedFields:
    matricula = _first_match(MATRICULA_PATTERN, text)
    numero_caso = _first_match(CASE_PATTERN, text)
    fecha = _first_match(DATE_PATTERN, text)
    evidence = _collect_evidence(text, [matricula, numero_caso, fecha])
    matched_fields = len([value for value in [matricula, numero_caso, fecha] if value])
    confidence = min(0.35 + (matched_fields * 0.2), 0.78)

    return ExtractedFields(
        matricula=matricula,
        numero_caso=numero_caso,
        tipo_documento=_infer_document_type(text),
        fecha_documento=fecha,
        resumen=_summarize(text),
        confidence=confidence,
        evidence=evidence,
    )


def _build_extraction_prompt(text: str) -> str:
    return (
        "Extrae datos de un documento de inspecciones o denuncias de gas. "
        "Devuelve solo JSON con las claves matricula, numero_caso, tipo_documento, "
        "fecha_documento, resumen, confidence y evidence. Usa null si falta un campo. "
        f"Documento:\n{text[:16_000]}"
    )


def _parse_fields(response_text: str) -> ExtractedFields:
    try:
        payload = json.loads(_extract_json_object(response_text))
        return ExtractedFields.model_validate(payload)
    except (json.JSONDecodeError, ValueError):
        return _extract_locally(response_text)


def _extract_json_object(text: str) -> str:
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("JSON object not found")
    return text[start : end + 1]


def _embed_locally(text: str) -> tuple[list[float], TokenUsage]:
    buckets = [0.0] * 768
    for token in _tokenize(text):
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        index = int.from_bytes(digest[:2], "big") % len(buckets)
        sign = 1.0 if digest[2] % 2 == 0 else -1.0
        buckets[index] += sign
    return _normalize_vector(buckets, 768), TokenUsage(embedding_tokens=_estimate_tokens(text), cost_usd=0)


def _normalize_vector(values: Sequence[float], size: int) -> list[float]:
    vector = list(values[:size])
    if len(vector) < size:
        vector.extend([0.0] * (size - len(vector)))
    magnitude = sum(value * value for value in vector) ** 0.5
    if magnitude == 0:
        return vector
    return [round(value / magnitude, 8) for value in vector]


def _tokenize(text: str) -> list[str]:
    return re.findall(r"[\wáéíóúñÁÉÍÓÚÑ]+", text.lower())


def _first_match(pattern: re.Pattern[str], text: str) -> str | None:
    match = pattern.search(text)
    return match.group(1).strip() if match else None


def _collect_evidence(text: str, values: list[str | None]) -> list[str]:
    evidence: list[str] = []
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for value in values:
        if not value:
            continue
        matching_line = next((line for line in lines if value in line), None)
        if matching_line:
            evidence.append(matching_line[:240])
    return evidence[:5]


def _infer_document_type(text: str) -> str | None:
    lowered = text.lower()
    if "denuncia" in lowered:
        return "denuncia"
    if "inspeccion" in lowered or "inspección" in lowered:
        return "inspeccion"
    if "acta" in lowered:
        return "acta"
    return None


def _summarize(text: str) -> str:
    compact = " ".join(text.split())
    return compact[:300]


def _estimate_tokens(text: str) -> int:
    return max(1, round(len(text) / 4))


def _usage_for_text(input_text: str, price_multiplier: float, output_text: str = "") -> TokenUsage:
    input_tokens = _estimate_tokens(input_text)
    output_tokens = _estimate_tokens(output_text) if output_text else 180
    return TokenUsage(
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_usd=((input_tokens + output_tokens) / 1_000_000) * price_multiplier,
    )


def _estimate_anthropic_usage_cost(input_tokens: int, output_tokens: int) -> float:
    return (input_tokens / 1_000_000) * 1.00 + (output_tokens / 1_000_000) * 5.00
