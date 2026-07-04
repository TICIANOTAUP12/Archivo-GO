import re
from dataclasses import dataclass

OLD_PLATE_PATTERN = re.compile(r"^[A-Z]{3}\d{3}$", re.IGNORECASE)
MERCOSUR_PLATE_PATTERN = re.compile(r"^[A-Z]{2}\d{3}[A-Z]{2}$", re.IGNORECASE)
TRAMITE_NUMERIC_PATTERN = re.compile(r"^\d{8,9}$")
EXPEDIENTE_PATTERN = re.compile(r"^EX-\d{4}-[\dA-Z#-]+$", re.IGNORECASE)
MATRICULA_PATTERN = re.compile(r"^\d{4,6}$")
PERSON_NAME_PATTERN = re.compile(
    r"^[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}(?:\s+[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}){1,4}$",
)
SINGLE_NAME_PATTERN = re.compile(r"^[A-Za-zÁÉÍÓÚÑáéíóúñ]{5,}$")


@dataclass(frozen=True)
class ParsedSearchQuery:
    query: str
    patente: str | None = None
    numero_caso: str | None = None
    matricula: str | None = None
    persona: str | None = None


def parse_search_query(raw_query: str) -> ParsedSearchQuery:
    query = raw_query.strip()
    if not query:
        return ParsedSearchQuery(query="")

    normalized = query.upper().replace(" ", "")

    if OLD_PLATE_PATTERN.match(normalized) or MERCOSUR_PLATE_PATTERN.match(normalized):
        return ParsedSearchQuery(query=query, patente=normalized)

    if TRAMITE_NUMERIC_PATTERN.match(query):
        return ParsedSearchQuery(query=query, numero_caso=query)

    if EXPEDIENTE_PATTERN.match(query):
        return ParsedSearchQuery(query=query, numero_caso=query.upper())

    if MATRICULA_PATTERN.match(query):
        return ParsedSearchQuery(query=query, matricula=query)

    if PERSON_NAME_PATTERN.match(query):
        return ParsedSearchQuery(query=query, persona=_normalize_person_name(query))

    if SINGLE_NAME_PATTERN.match(query):
        return ParsedSearchQuery(query=query, persona=query)

    return ParsedSearchQuery(query=query)


def _normalize_person_name(value: str) -> str:
    return " ".join(part for part in value.split() if part)
