export type SearchFilters = {
  query: string;
  patente?: string;
  numero_caso?: string;
  matricula?: string;
  persona?: string;
};

const OLD_PLATE_PATTERN = /^[A-Z]{3}\d{3}$/i;
const MERCOSUR_PLATE_PATTERN = /^[A-Z]{2}\d{3}[A-Z]{2}$/i;
const TRAMITE_NUMERIC_PATTERN = /^\d{8,9}$/;
const EXPEDIENTE_PATTERN = /^EX-\d{4}-[\dA-Z#-]+$/i;
const MATRICULA_PATTERN = /^\d{4,6}$/;
const PERSON_NAME_PATTERN = /^[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}(?:\s+[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}){1,4}$/;
const SINGLE_NAME_PATTERN = /^[A-Za-zÁÉÍÓÚÑáéíóúñ]{5,}$/;

export function parseSearchQuery(rawQuery: string): SearchFilters {
  const query = rawQuery.trim();
  if (!query) return { query: '' };

  const normalized = query.toUpperCase().replace(/\s/g, '');

  if (OLD_PLATE_PATTERN.test(normalized) || MERCOSUR_PLATE_PATTERN.test(normalized)) {
    return { query, patente: normalized };
  }

  if (TRAMITE_NUMERIC_PATTERN.test(query)) {
    return { query, numero_caso: query };
  }

  if (EXPEDIENTE_PATTERN.test(query)) {
    return { query, numero_caso: query.toUpperCase() };
  }

  if (MATRICULA_PATTERN.test(query)) {
    return { query, matricula: query };
  }

  if (PERSON_NAME_PATTERN.test(query)) {
    return { query, persona: normalizePersonName(query) };
  }

  if (SINGLE_NAME_PATTERN.test(query)) {
    return { query, persona: query };
  }

  return { query };
}

function normalizePersonName(value: string): string {
  return value.split(/\s+/).filter(Boolean).join(' ');
}

export function describeSearchIntent(filters: SearchFilters): string | null {
  if (filters.patente) return 'Patente';
  if (filters.numero_caso) return 'Trámite';
  if (filters.matricula) return 'Matrícula';
  if (filters.persona) return 'Persona / empresa';
  return null;
}
