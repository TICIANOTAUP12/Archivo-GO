export type SearchFilters = {
  query: string;
  patente?: string;
  numero_caso?: string;
  matricula?: string;
};

const OLD_PLATE_PATTERN = /\b([A-Z]{3}\d{3})\b/i;
const MERCOSUR_PLATE_PATTERN = /\b([A-Z]{2}\d{3}[A-Z]{2})\b/i;
const TRAMITE_PATTERN = /\b(\d{8,9})\b/;

export function parseSearchQuery(rawQuery: string): SearchFilters {
  const query = rawQuery.trim();
  const normalized = query.toUpperCase();

  const patenteMatch = normalized.match(OLD_PLATE_PATTERN) ?? normalized.match(MERCOSUR_PLATE_PATTERN);
  const tramiteMatch = normalized.match(TRAMITE_PATTERN);

  return {
    query,
    patente: patenteMatch?.[1]?.replace(/[^A-Z0-9]/g, ''),
    numero_caso: tramiteMatch?.[1],
  };
}
