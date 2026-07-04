export type CostEstimate = {
  pages: number;
  scanned_pages: number;
  native_text_pages: number;
  google_ocr_usd: number;
  gemini_extraction_usd: number;
  gemini_embedding_usd: number;
  anthropic_fallback_low_usd: number;
  anthropic_fallback_high_usd: number;
  total_low_usd: number;
  total_high_usd: number;
};

export type FileAudit = {
  path: string;
  filename: string;
  extension: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  page_count: number;
  has_native_text: boolean;
  is_probably_scanned: boolean;
};

export type AuditResponse = {
  run_id: string;
  source_path: string;
  total_files: number;
  total_bytes: number;
  total_pages: number;
  scanned_pages: number;
  native_text_pages: number;
  sampled_files: FileAudit[];
  estimate: CostEstimate;
};

export type IngestResponse = {
  run_id: string;
  queued_documents: number;
  dry_run: boolean;
  estimated_cost_usd: number;
};

export type DocumentStatus = 'pending' | 'processing' | 'indexed' | 'needs_review' | 'failed';

export type RecentDocument = {
  id: string;
  source_path: string;
  storage_path: string | null;
  filename: string;
  status: DocumentStatus;
  page_count: number;
  has_native_text: boolean;
  updated_at: string;
};

export type SearchResult = {
  document_id: string;
  page_id: string;
  filename: string;
  source_path: string;
  storage_path: string | null;
  page_number: number;
  snippet: string;
  matricula: string | null;
  patente: string | null;
  numero_caso: string | null;
  score: number;
};

export type HealthResponse = {
  status: string;
  database: string;
};
