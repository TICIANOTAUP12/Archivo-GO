package inventory

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"mime"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"

	"archivo-digital-inteligente/internal/localengine/models"
	"archivo-digital-inteligente/internal/localengine/pdf"
)

var supportedExtensions = map[string]struct{}{
	".pdf":  {},
	".png":  {},
	".jpg":  {},
	".jpeg": {},
	".tif":  {},
	".tiff": {},
	".webp": {},
}

func DiscoverSupportedFiles(sourcePath string, limit *int) ([]string, error) {
	root := filepath.Clean(sourcePath)
	info, err := os.Stat(root)
	if err != nil {
		return nil, fmt.Errorf("source path not found: %w", err)
	}
	var files []string
	if !info.IsDir() {
		if isSupported(root) {
			files = append(files, root)
		}
	} else {
		err = filepath.WalkDir(root, func(path string, entry os.DirEntry, walkErr error) error {
			if walkErr != nil {
				return walkErr
			}
			if entry.IsDir() {
				return nil
			}
			if isSupported(path) {
				files = append(files, path)
			}
			return nil
		})
		if err != nil {
			return nil, err
		}
	}
	if limit != nil && len(files) > *limit {
		files = files[:*limit]
	}
	return files, nil
}

func AuditSource(sourcePath string, sampleLimit int) (models.AuditResponse, error) {
	if sampleLimit < 1 {
		return models.AuditResponse{}, fmt.Errorf("sample_limit must be positive")
	}
	files, err := DiscoverSupportedFiles(sourcePath, nil)
	if err != nil {
		return models.AuditResponse{}, err
	}
	sampledCount := sampleLimit
	if len(files) < sampledCount {
		sampledCount = len(files)
	}
	sampled := make([]models.FileAudit, 0, sampledCount)
	for _, path := range files[:sampledCount] {
		audit, auditErr := auditFile(path)
		if auditErr != nil {
			continue
		}
		sampled = append(sampled, audit)
	}
	var totalBytes int64
	for _, path := range files {
		info, statErr := os.Stat(path)
		if statErr == nil {
			totalBytes += info.Size()
		}
	}
	totalPages := estimateTotalPages(len(files), sampled)
	scannedPages := estimateScannedPages(len(files), sampled, totalPages)
	return models.AuditResponse{
		RunID:           uuid.NewString(),
		SourcePath:      sourcePath,
		TotalFiles:      len(files),
		TotalBytes:      totalBytes,
		TotalPages:      totalPages,
		ScannedPages:    scannedPages,
		NativeTextPages: max(totalPages-scannedPages, 0),
		SampledFiles:    sampled,
		Estimate:        estimateProcessingCost(totalPages, scannedPages),
	}, nil
}

func auditFile(path string) (models.FileAudit, error) {
	info, err := os.Stat(path)
	if err != nil {
		return models.FileAudit{}, err
	}
	ext := strings.ToLower(filepath.Ext(path))
	mimeType := mime.TypeByExtension(ext)
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}
	pageCount := 1
	hasNativeText := false
	isProbablyScanned := true
	if ext == ".pdf" {
		var inspectErr error
		pageCount, hasNativeText, inspectErr = pdf.InspectPDF(path)
		if inspectErr != nil {
			pageCount = 1
			hasNativeText = false
			isProbablyScanned = true
		} else {
			isProbablyScanned = !hasNativeText
		}
	}
	hash, err := sha256File(path)
	if err != nil {
		return models.FileAudit{}, err
	}
	return models.FileAudit{
		Path:              path,
		Filename:          filepath.Base(path),
		Extension:         ext,
		MimeType:          mimeType,
		SizeBytes:         info.Size(),
		SHA256:            hash,
		PageCount:         pageCount,
		HasNativeText:     hasNativeText,
		IsProbablyScanned: isProbablyScanned,
	}, nil
}

func sha256File(path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()
	hasher := sha256.New()
	if _, err := io.Copy(hasher, file); err != nil {
		return "", err
	}
	return hex.EncodeToString(hasher.Sum(nil)), nil
}

func estimateTotalPages(totalFiles int, sampled []models.FileAudit) int {
	if totalFiles == len(sampled) {
		total := 0
		for _, audit := range sampled {
			total += audit.PageCount
		}
		return total
	}
	if len(sampled) == 0 {
		return 0
	}
	sum := 0
	for _, audit := range sampled {
		sum += audit.PageCount
	}
	average := float64(sum) / float64(len(sampled))
	return int(average*float64(totalFiles) + 0.5)
}

func estimateScannedPages(totalFiles int, sampled []models.FileAudit, totalPages int) int {
	if len(sampled) == 0 || totalPages == 0 {
		return 0
	}
	if totalFiles == len(sampled) {
		scanned := 0
		for _, audit := range sampled {
			if audit.IsProbablyScanned {
				scanned += audit.PageCount
			}
		}
		return scanned
	}
	sampledPages := 0
	scannedSample := 0
	for _, audit := range sampled {
		sampledPages += audit.PageCount
		if audit.IsProbablyScanned {
			scannedSample += audit.PageCount
		}
	}
	if sampledPages == 0 {
		return 0
	}
	ratio := float64(scannedSample) / float64(sampledPages)
	return int(ratio*float64(totalPages) + 0.5)
}

func estimateProcessingCost(totalPages int, scannedPages int) models.CostEstimate {
	geminiExtract := float64(totalPages) * 0.0008
	geminiEmbed := float64(totalPages) * 0.0002
	fallbackLow := float64(totalPages) * 0.001
	fallbackHigh := float64(totalPages) * 0.003
	totalLow := geminiExtract + geminiEmbed + fallbackLow
	totalHigh := geminiExtract + geminiEmbed + fallbackHigh
	return models.CostEstimate{
		Pages:                    totalPages,
		ScannedPages:             scannedPages,
		NativeTextPages:          max(totalPages-scannedPages, 0),
		GoogleOCRUSD:             0,
		GeminiExtractionUSD:      geminiExtract,
		GeminiEmbeddingUSD:       geminiEmbed,
		AnthropicFallbackLowUSD:  fallbackLow,
		AnthropicFallbackHighUSD: fallbackHigh,
		TotalLowUSD:              totalLow,
		TotalHighUSD:             totalHigh,
	}
}

func isSupported(path string) bool {
	_, ok := supportedExtensions[strings.ToLower(filepath.Ext(path))]
	return ok
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
