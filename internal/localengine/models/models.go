package models

type CostEstimate struct {
	Pages                   int     `json:"pages"`
	ScannedPages            int     `json:"scanned_pages"`
	NativeTextPages         int     `json:"native_text_pages"`
	GoogleOCRUSD            float64 `json:"google_ocr_usd"`
	GeminiExtractionUSD     float64 `json:"gemini_extraction_usd"`
	GeminiEmbeddingUSD      float64 `json:"gemini_embedding_usd"`
	AnthropicFallbackLowUSD float64 `json:"anthropic_fallback_low_usd"`
	AnthropicFallbackHighUSD float64 `json:"anthropic_fallback_high_usd"`
	TotalLowUSD             float64 `json:"total_low_usd"`
	TotalHighUSD            float64 `json:"total_high_usd"`
}

type FileAudit struct {
	Path              string `json:"path"`
	Filename          string `json:"filename"`
	Extension         string `json:"extension"`
	MimeType          string `json:"mime_type"`
	SizeBytes         int64  `json:"size_bytes"`
	SHA256            string `json:"sha256"`
	PageCount         int    `json:"page_count"`
	HasNativeText     bool   `json:"has_native_text"`
	IsProbablyScanned bool   `json:"is_probably_scanned"`
}

type AuditResponse struct {
	RunID           string      `json:"run_id"`
	SourcePath      string      `json:"source_path"`
	TotalFiles      int         `json:"total_files"`
	TotalBytes      int64       `json:"total_bytes"`
	TotalPages      int         `json:"total_pages"`
	ScannedPages    int         `json:"scanned_pages"`
	NativeTextPages int         `json:"native_text_pages"`
	SampledFiles    []FileAudit `json:"sampled_files"`
	Estimate        CostEstimate `json:"estimate"`
}

type AuditRequest struct {
	SourcePath  string `json:"source_path"`
	SampleLimit int    `json:"sample_limit"`
}

type IngestRequest struct {
	SourcePath   string  `json:"source_path"`
	RunID        *string `json:"run_id"`
	MaxDocuments *int    `json:"max_documents"`
	SampleLimit  int     `json:"sample_limit"`
	DryRun       bool    `json:"dry_run"`
}

type IngestResponse struct {
	RunID             string  `json:"run_id"`
	QueuedDocuments   int     `json:"queued_documents"`
	DryRun            bool    `json:"dry_run"`
	EstimatedCostUSD  float64 `json:"estimated_cost_usd"`
}

type SearchRequest struct {
	Query      string  `json:"query"`
	Matricula  *string `json:"matricula"`
	Patente    *string `json:"patente"`
	NumeroCaso *string `json:"numero_caso"`
	Persona    *string `json:"persona"`
	Limit      int     `json:"limit"`
}

type SearchResult struct {
	DocumentID string  `json:"document_id"`
	PageID     string  `json:"page_id"`
	Filename   string  `json:"filename"`
	SourcePath string  `json:"source_path"`
	StoragePath *string `json:"storage_path"`
	PageNumber int     `json:"page_number"`
	Snippet    string  `json:"snippet"`
	Matricula  *string `json:"matricula"`
	Patente    *string `json:"patente"`
	NumeroCaso *string `json:"numero_caso"`
	MatchKind  *string `json:"match_kind"`
	Score      float64 `json:"score"`
}

type DocumentSummary struct {
	ID            string  `json:"id"`
	SourcePath    string  `json:"source_path"`
	StoragePath   *string `json:"storage_path"`
	Filename      string  `json:"filename"`
	Status        string  `json:"status"`
	PageCount     int     `json:"page_count"`
	HasNativeText bool    `json:"has_native_text"`
	UpdatedAt     string  `json:"updated_at"`
}

type HealthResponse struct {
	Status   string `json:"status"`
	Database string `json:"database"`
}

type ExtractedFields struct {
	Matricula      *string  `json:"matricula"`
	Patente        *string  `json:"patente"`
	NumeroCaso     *string  `json:"numero_caso"`
	TipoDocumento  *string  `json:"tipo_documento"`
	FechaDocumento *string  `json:"fecha_documento"`
	Resumen        *string  `json:"resumen"`
	Confidence     float64  `json:"confidence"`
	Evidence       []string `json:"evidence"`
}

type TokenUsage struct {
	InputTokens     int     `json:"input_tokens"`
	OutputTokens    int     `json:"output_tokens"`
	EmbeddingTokens int     `json:"embedding_tokens"`
	CostUSD         float64 `json:"cost_usd"`
}

type ProcessPageResponse struct {
	Fields     ExtractedFields `json:"fields"`
	Provider   string          `json:"provider"`
	Embedding  []float64       `json:"embedding"`
	TokenUsage TokenUsage      `json:"token_usage"`
	CostUSD    float64         `json:"cost_usd"`
}
