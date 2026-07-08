import type { AuditResponse, DocumentStatus, HealthResponse, IngestResponse, RecentDocument, SearchResult } from '../types';
import { parseSearchQuery } from '../utils/searchQuery';
import { request } from './httpClient';

export function auditSource(sourcePath: string, sampleLimit: number): Promise<AuditResponse> {
  return request<AuditResponse>('/audit', {
    method: 'POST',
    body: JSON.stringify({ source_path: sourcePath, sample_limit: sampleLimit }),
    timeoutMs: 120_000,
    timeoutMessage: 'El análisis de la carpeta tardó demasiado. Probá con menos archivos en la muestra.',
  });
}

export function ingestSource(
  sourcePath: string,
  runId: string | null,
  maxDocuments: number | null,
): Promise<IngestResponse> {
  return request<IngestResponse>('/documents/ingest', {
    method: 'POST',
    body: JSON.stringify({
      source_path: sourcePath,
      run_id: runId,
      max_documents: maxDocuments,
      dry_run: false,
    }),
    timeoutMs: 180_000,
    timeoutMessage: 'La carpeta es muy grande o Win7 tardó demasiado. Probá con máximo 5–10 archivos por corrida.',
  });
}

export function listRecentDocuments(): Promise<RecentDocument[]> {
  return request<RecentDocument[]>('/documents/recent', {
    timeoutMs: 120_000,
    timeoutMessage: 'Cargar documentos recientes tardó demasiado. El motor puede estar ocupado procesando.',
  });
}

export function listDocuments(status: DocumentStatus | 'all' = 'all'): Promise<RecentDocument[]> {
  const params = new URLSearchParams({ limit: '200' });
  if (status !== 'all') params.set('status', status);
  return request<RecentDocument[]>(`/documents?${params.toString()}`, {
    timeoutMs: 120_000,
    timeoutMessage: 'Cargar la biblioteca tardó demasiado. El motor puede estar ocupado procesando.',
  });
}

export function searchDocuments(query: string): Promise<SearchResult[]> {
  const filters = parseSearchQuery(query);
  return request<SearchResult[]>('/search', {
    method: 'POST',
    body: JSON.stringify({
      query: filters.query,
      patente: filters.patente ?? null,
      numero_caso: filters.numero_caso ?? null,
      matricula: filters.matricula ?? null,
      persona: filters.persona ?? null,
      limit: 20,
    }),
    timeoutMs: 120_000,
    timeoutMessage: 'La búsqueda tardó demasiado. Intentá de nuevo con un término más corto.',
  });
}

export function checkBackendHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health', {
    timeoutMs: 60_000,
    timeoutMessage: 'El motor local no respondió a tiempo. Reintentá conexión en IA.',
  });
}
