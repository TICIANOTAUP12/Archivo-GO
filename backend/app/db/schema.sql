CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS processing_runs (
    id UUID PRIMARY KEY,
    source_path TEXT NOT NULL,
    status TEXT NOT NULL,
    total_files INTEGER NOT NULL DEFAULT 0,
    total_pages INTEGER NOT NULL DEFAULT 0,
    scanned_pages INTEGER NOT NULL DEFAULT 0,
    estimated_cost_usd NUMERIC(12, 4) NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY,
    run_id UUID REFERENCES processing_runs(id) ON DELETE SET NULL,
    source_path TEXT NOT NULL,
    storage_path TEXT,
    filename TEXT NOT NULL,
    file_hash TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    page_count INTEGER NOT NULL DEFAULT 0,
    has_native_text BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_pages (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    text_content TEXT NOT NULL DEFAULT '',
    is_scanned BOOLEAN NOT NULL DEFAULT false,
    ocr_provider TEXT,
    extraction_provider TEXT,
    extraction_confidence NUMERIC(5, 4) NOT NULL DEFAULT 0,
    extracted_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    token_usage JSONB NOT NULL DEFAULT '{}'::jsonb,
    cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
    embedding VECTOR(768),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(document_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_documents_run_id ON documents(run_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_filename ON documents(filename);
CREATE INDEX IF NOT EXISTS idx_documents_storage_path ON documents(storage_path);
CREATE INDEX IF NOT EXISTS idx_document_pages_document_id ON document_pages(document_id);
CREATE INDEX IF NOT EXISTS idx_document_pages_fields ON document_pages USING gin(extracted_fields);
CREATE INDEX IF NOT EXISTS idx_document_pages_text ON document_pages USING gin(to_tsvector('spanish', text_content));
CREATE INDEX IF NOT EXISTS idx_document_pages_embedding ON document_pages USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
