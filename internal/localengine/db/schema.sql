PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS processing_runs (
    id TEXT PRIMARY KEY,
    source_path TEXT NOT NULL,
    status TEXT NOT NULL,
    total_files INTEGER NOT NULL DEFAULT 0,
    total_pages INTEGER NOT NULL DEFAULT 0,
    scanned_pages INTEGER NOT NULL DEFAULT 0,
    estimated_cost_usd REAL NOT NULL DEFAULT 0,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    run_id TEXT REFERENCES processing_runs(id) ON DELETE SET NULL,
    source_path TEXT NOT NULL,
    storage_path TEXT,
    filename TEXT NOT NULL,
    file_hash TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    page_count INTEGER NOT NULL DEFAULT 0,
    has_native_text INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS document_pages (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    text_content TEXT NOT NULL DEFAULT '',
    is_scanned INTEGER NOT NULL DEFAULT 0,
    ocr_provider TEXT,
    extraction_provider TEXT,
    extraction_confidence REAL NOT NULL DEFAULT 0,
    extracted_fields TEXT NOT NULL DEFAULT '{}',
    evidence TEXT NOT NULL DEFAULT '[]',
    token_usage TEXT NOT NULL DEFAULT '{}',
    cost_usd REAL NOT NULL DEFAULT 0,
    embedding BLOB,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(document_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_documents_run_id ON documents(run_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_filename ON documents(filename);
CREATE INDEX IF NOT EXISTS idx_document_pages_document_id ON document_pages(document_id);

CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(
    document_id UNINDEXED,
    page_id UNINDEXED,
    filename UNINDEXED,
    text_content,
    extracted_fields,
    tokenize = 'unicode61'
);
