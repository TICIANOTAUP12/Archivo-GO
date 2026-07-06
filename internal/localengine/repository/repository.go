package repository

import (
	"database/sql"
	"encoding/binary"
	"encoding/json"
	"math"
	"strings"
	"time"

	"github.com/google/uuid"

	"archivo-digital-inteligente/internal/localengine/models"
)

type Repository struct {
	db *sql.DB
}

func New(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (repo *Repository) SaveRun(runID, sourcePath, status string, totalFiles, totalPages, scannedPages int, estimatedCost float64) error {
	_, err := repo.db.Exec(`
		INSERT INTO processing_runs (id, source_path, status, total_files, total_pages, scanned_pages, estimated_cost_usd)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			status = excluded.status,
			total_files = excluded.total_files,
			total_pages = excluded.total_pages,
			scanned_pages = excluded.scanned_pages,
			estimated_cost_usd = excluded.estimated_cost_usd
	`, runID, sourcePath, status, totalFiles, totalPages, scannedPages, estimatedCost)
	return err
}

func (repo *Repository) CompleteRun(runID, status string) error {
	_, err := repo.db.Exec(`UPDATE processing_runs SET status = ?, completed_at = ? WHERE id = ?`, status, time.Now().UTC().Format(time.RFC3339), runID)
	return err
}

func (repo *Repository) UpsertDocument(runID string, audit models.FileAudit, storagePath string) (string, error) {
	documentID := uuid.NewString()
	hasNative := 0
	if audit.HasNativeText {
		hasNative = 1
	}
	_, err := repo.db.Exec(`
		INSERT INTO documents (id, run_id, source_path, storage_path, filename, file_hash, mime_type, size_bytes, page_count, has_native_text, status)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
		ON CONFLICT(file_hash) DO UPDATE SET
			run_id = excluded.run_id,
			source_path = excluded.source_path,
			storage_path = excluded.storage_path,
			filename = excluded.filename,
			mime_type = excluded.mime_type,
			size_bytes = excluded.size_bytes,
			page_count = excluded.page_count,
			has_native_text = excluded.has_native_text,
			updated_at = datetime('now')
	`, documentID, runID, audit.Path, storagePath, audit.Filename, audit.SHA256, audit.MimeType, audit.SizeBytes, audit.PageCount, hasNative)
	if err != nil {
		return "", err
	}
	var existingID string
	err = repo.db.QueryRow(`SELECT id FROM documents WHERE file_hash = ?`, audit.SHA256).Scan(&existingID)
	return existingID, err
}

func (repo *Repository) UpdateDocumentStatus(documentID, status string) error {
	_, err := repo.db.Exec(`UPDATE documents SET status = ?, updated_at = datetime('now') WHERE id = ?`, status, documentID)
	return err
}

func (repo *Repository) SavePageResult(documentID string, pageNumber int, textContent string, isScanned bool, provider string, fields models.ExtractedFields, usage models.TokenUsage, embedding []float64) error {
	pageID := uuid.NewString()
	var existingID string
	if err := repo.db.QueryRow(`SELECT id FROM document_pages WHERE document_id = ? AND page_number = ?`, documentID, pageNumber).Scan(&existingID); err == nil {
		pageID = existingID
	}
	fieldsJSON, err := json.Marshal(fields)
	if err != nil {
		return err
	}
	evidenceJSON, err := json.Marshal(fields.Evidence)
	if err != nil {
		return err
	}
	usageJSON, err := json.Marshal(usage)
	if err != nil {
		return err
	}
	scanned := 0
	if isScanned {
		scanned = 1
	}
	embeddingBlob := encodeEmbedding(embedding)
	_, err = repo.db.Exec(`
		INSERT INTO document_pages (
			id, document_id, page_number, text_content, is_scanned, ocr_provider,
			extraction_provider, extraction_confidence, extracted_fields, evidence,
			token_usage, cost_usd, embedding
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(document_id, page_number) DO UPDATE SET
			text_content = excluded.text_content,
			is_scanned = excluded.is_scanned,
			ocr_provider = excluded.ocr_provider,
			extraction_provider = excluded.extraction_provider,
			extraction_confidence = excluded.extraction_confidence,
			extracted_fields = excluded.extracted_fields,
			evidence = excluded.evidence,
			token_usage = excluded.token_usage,
			cost_usd = excluded.cost_usd,
			embedding = excluded.embedding
	`, pageID, documentID, pageNumber, textContent, scanned, "local", provider, fields.Confidence, string(fieldsJSON), string(evidenceJSON), string(usageJSON), usage.CostUSD, embeddingBlob)
	if err != nil {
		return err
	}
	var filename string
	_ = repo.db.QueryRow(`SELECT filename FROM documents WHERE id = ?`, documentID).Scan(&filename)
	_, _ = repo.db.Exec(`DELETE FROM pages_fts WHERE page_id = ?`, pageID)
	_, err = repo.db.Exec(`INSERT INTO pages_fts(document_id, page_id, filename, text_content, extracted_fields) VALUES (?, ?, ?, ?, ?)`,
		documentID, pageID, filename, textContent, string(fieldsJSON))
	return err
}

func (repo *Repository) ListRecentDocuments(limit int) ([]models.DocumentSummary, error) {
	rows, err := repo.db.Query(`
		SELECT id, source_path, storage_path, filename, status, page_count, has_native_text, updated_at
		FROM documents ORDER BY updated_at DESC LIMIT ?
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanDocuments(rows)
}

func (repo *Repository) ListDocuments(status *string, limit int) ([]models.DocumentSummary, error) {
	var rows *sql.Rows
	var err error
	if status == nil {
		rows, err = repo.db.Query(`
			SELECT id, source_path, storage_path, filename, status, page_count, has_native_text, updated_at
			FROM documents ORDER BY updated_at DESC LIMIT ?
		`, limit)
	} else {
		rows, err = repo.db.Query(`
			SELECT id, source_path, storage_path, filename, status, page_count, has_native_text, updated_at
			FROM documents WHERE status = ? ORDER BY updated_at DESC LIMIT ?
		`, *status, limit)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanDocuments(rows)
}

func scanDocuments(rows *sql.Rows) ([]models.DocumentSummary, error) {
	results := make([]models.DocumentSummary, 0)
	for rows.Next() {
		var item models.DocumentSummary
		var storagePath sql.NullString
		var hasNative int
		if err := rows.Scan(&item.ID, &item.SourcePath, &storagePath, &item.Filename, &item.Status, &item.PageCount, &hasNative, &item.UpdatedAt); err != nil {
			return nil, err
		}
		item.HasNativeText = hasNative == 1
		if storagePath.Valid {
			value := storagePath.String
			item.StoragePath = &value
		}
		results = append(results, item)
	}
	return results, rows.Err()
}

type PageCandidate struct {
	DocumentID  string
	PageID      string
	Filename    string
	SourcePath  string
	StoragePath sql.NullString
	PageNumber  int
	TextContent string
	FieldsJSON  string
	Embedding   []float64
}

func (repo *Repository) SearchCandidates(query string, limit int) ([]PageCandidate, error) {
	rows, err := repo.db.Query(`
		SELECT d.id, p.id, d.filename, d.source_path, d.storage_path, p.page_number, p.text_content, p.extracted_fields, p.embedding
		FROM pages_fts f
		JOIN document_pages p ON p.id = f.page_id
		JOIN documents d ON d.id = p.document_id
		WHERE f MATCH ?
		ORDER BY rank
		LIMIT ?
	`, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanCandidates(rows)
}

func (repo *Repository) ListAllPages(limit int) ([]PageCandidate, error) {
	rows, err := repo.db.Query(`
		SELECT d.id, p.id, d.filename, d.source_path, d.storage_path, p.page_number, p.text_content, p.extracted_fields, p.embedding
		FROM document_pages p
		JOIN documents d ON d.id = p.document_id
		LIMIT ?
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanCandidates(rows)
}

func scanCandidates(rows *sql.Rows) ([]PageCandidate, error) {
	results := make([]PageCandidate, 0)
	for rows.Next() {
		var item PageCandidate
		var embeddingBlob []byte
		if err := rows.Scan(&item.DocumentID, &item.PageID, &item.Filename, &item.SourcePath, &item.StoragePath, &item.PageNumber, &item.TextContent, &item.FieldsJSON, &embeddingBlob); err != nil {
			return nil, err
		}
		item.Embedding = decodeEmbedding(embeddingBlob)
		results = append(results, item)
	}
	return results, rows.Err()
}

func encodeEmbedding(values []float64) []byte {
	if len(values) == 0 {
		return nil
	}
	buffer := make([]byte, len(values)*4)
	for index, value := range values {
		binary.LittleEndian.PutUint32(buffer[index*4:], math.Float32bits(float32(value)))
	}
	return buffer
}

func decodeEmbedding(blob []byte) []float64 {
	if len(blob) == 0 {
		return nil
	}
	count := len(blob) / 4
	values := make([]float64, 0, count)
	for index := 0; index+4 <= len(blob); index += 4 {
		bits := binary.LittleEndian.Uint32(blob[index : index+4])
		values = append(values, float64(math.Float32frombits(bits)))
	}
	return values
}

func ParseFieldsJSON(raw string) models.ExtractedFields {
	var fields models.ExtractedFields
	if err := json.Unmarshal([]byte(raw), &fields); err != nil {
		return models.ExtractedFields{}
	}
	return fields
}

func CosineSimilarity(a, b []float64) float64 {
	if len(a) == 0 || len(b) == 0 {
		return 0
	}
	size := len(a)
	if len(b) < size {
		size = len(b)
	}
	var dot, magA, magB float64
	for index := 0; index < size; index++ {
		dot += a[index] * b[index]
		magA += a[index] * a[index]
		magB += b[index] * b[index]
	}
	if magA == 0 || magB == 0 {
		return 0
	}
	return dot / (math.Sqrt(magA) * math.Sqrt(magB))
}

func (repo *Repository) Ping() error {
	return repo.db.Ping()
}

func Snippet(text string, maxLen int) string {
	compact := strings.Join(strings.Fields(strings.ReplaceAll(text, "\n", " ")), " ")
	if len(compact) <= maxLen {
		return compact
	}
	return compact[:maxLen]
}
