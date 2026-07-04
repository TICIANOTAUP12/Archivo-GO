export type SearchFilters = {
  query: string;
  patente?: string;
  numero_caso?: string;
  matricula?: string;
};

const OLD_PLATE_PATTERN = /^[A-Z]{3}\d{3}$/i;
const MERCOSUR_PLATE_PATTERN = /^[A-Z]{2}\d{3}[A-Z]{2}$/i;
const TRAMITE_ONLY_PATTERN = /^\d{8,9}$/;

export function parseSearchQuery(rawQuery: string): SearchFilters {
  const query = rawQuery.trim();
  const normalized = query.toUpperCase();

  if (OLD_PLATE_PATTERN.test(normalized) || MERCOSUR_PLATE_PATTERN.test(normalized)) {
    return {
      query,
      patente: normalized.replace(/[^A-Z0-9]/g, ''),
    };
  }

  if (TRAMITE_ONLY_PATTERN.test(query)) {
    return {
      query,
      numero_caso: query,
    };
  }

  return { query };
}
