import type { AuditResponse, DocumentStatus, HealthResponse, IngestResponse, RecentDocument, SearchResult } from '../types';
import { parseSearchQuery } from '../utils/searchQuery';
import { request } from './httpClient';

export function auditSource(sourcePath: string, sampleLimit: number): Promise<AuditResponse> {
  return request<AuditResponse>('/audit', {
    method: 'POST',
    body: JSON.stringify({ source_path: sourcePath, sample_limit: sampleLimit }),
    timeoutMs: 120_000,
  });
}

export function ingestSource(sourcePath: string, maxDocuments: number | null): Promise<IngestResponse> {
  return request<IngestResponse>('/documents/ingest', {
    method: 'POST',
    body: JSON.stringify({ source_path: sourcePath, max_documents: maxDocuments, dry_run: false }),
  });
}

export function listRecentDocuments(): Promise<RecentDocument[]> {
  return request<RecentDocument[]>('/documents/recent');
}

export function listDocuments(status: DocumentStatus | 'all' = 'all'): Promise<RecentDocument[]> {
  const params = new URLSearchParams({ limit: '200' });
  if (status !== 'all') params.set('status', status);
  return request<RecentDocument[]>(`/documents?${params.toString()}`);
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
  });
}

export function checkBackendHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health');
}
