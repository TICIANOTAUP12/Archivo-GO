package ingest

import (
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"

	"archivo-digital-inteligente/internal/localengine/gateway"
	"archivo-digital-inteligente/internal/localengine/inventory"
	"archivo-digital-inteligente/internal/localengine/models"
	"archivo-digital-inteligente/internal/localengine/ocr"
	"archivo-digital-inteligente/internal/localengine/pdf"
	"archivo-digital-inteligente/internal/localengine/repository"
	"archivo-digital-inteligente/internal/localengine/settings"
)

type Service struct {
	repo      *repository.Repository
	loadSettings func() (settings.WorkspaceSettings, error)
	appRoot   string
	ocrEngine ocr.Engine
}

func NewService(repo *repository.Repository, loadSettings func() (settings.WorkspaceSettings, error), appRoot string) *Service {
	return &Service{
		repo:         repo,
		loadSettings: loadSettings,
		appRoot:      appRoot,
		ocrEngine:    ocr.NewEngine(appRoot),
	}
}

func (service *Service) IngestSource(ctx context.Context, request models.IngestRequest) (models.IngestResponse, error) {
	limit := request.MaxDocuments
	files, err := inventory.DiscoverSupportedFiles(request.SourcePath, limit)
	if err != nil {
		return models.IngestResponse{}, err
	}
	if len(files) == 0 {
		return models.IngestResponse{}, fmt.Errorf("no hay PDFs ni imágenes compatibles en la carpeta")
	}

	var (
		runID            string
		estimatedCostUSD float64
		totalFiles       int
		totalPages       int
		scannedPages     int
	)

	if request.RunID != nil && strings.TrimSpace(*request.RunID) != "" {
		runID = strings.TrimSpace(*request.RunID)
		totalFiles = len(files)
	} else {
		sampleLimit := 25
		if request.SampleLimit > 0 {
			sampleLimit = request.SampleLimit
		}
		audit, auditErr := inventory.AuditSource(request.SourcePath, sampleLimit)
		if auditErr != nil {
			return models.IngestResponse{}, auditErr
		}
		runID = audit.RunID
		totalFiles = audit.TotalFiles
		totalPages = audit.TotalPages
		scannedPages = audit.ScannedPages
		estimatedCostUSD = audit.Estimate.TotalHighUSD
	}

	if request.DryRun {
		return models.IngestResponse{
			RunID:            runID,
			QueuedDocuments:  len(files),
			DryRun:           true,
			EstimatedCostUSD: estimatedCostUSD,
		}, nil
	}

	workspaceSettings, err := service.loadSettings()
	if err != nil {
		return models.IngestResponse{}, err
	}
	if estimatedCostUSD > 0 && estimatedCostUSD > workspaceSettings.MaxRunBudgetUSD {
		return models.IngestResponse{}, fmt.Errorf("estimated cost USD %.2f exceeds budget USD %.2f", estimatedCostUSD, workspaceSettings.MaxRunBudgetUSD)
	}
	if err := service.repo.SaveRun(runID, request.SourcePath, "processing", totalFiles, totalPages, scannedPages, estimatedCostUSD); err != nil {
		return models.IngestResponse{}, err
	}
	go service.processFiles(context.Background(), files, runID)
	return models.IngestResponse{
		RunID:            runID,
		QueuedDocuments:  len(files),
		DryRun:           false,
		EstimatedCostUSD: estimatedCostUSD,
	}, nil
}

func (service *Service) processFiles(ctx context.Context, files []string, runID string) {
	defer func() {
		if recovered := recover(); recovered != nil {
			log.Printf("ingest panic run=%s: %v", runID, recovered)
			_ = service.repo.CompleteRun(runID, "failed")
			return
		}
		_ = service.repo.CompleteRun(runID, "completed")
	}()
	for _, filePath := range files {
		_ = service.processFile(ctx, filePath, runID)
	}
}

func (service *Service) processFile(ctx context.Context, filePath, runID string) error {
	audit, err := inventory.AuditSource(filePath, 1)
	if err != nil || len(audit.SampledFiles) == 0 {
		return err
	}
	fileAudit := audit.SampledFiles[0]
	fileAudit.Path = filePath
	storagePath, err := archiveOriginalFile(filePath, service.loadSettings)
	if err != nil {
		return err
	}
	documentID, err := service.repo.UpsertDocument(runID, fileAudit, storagePath)
	if err != nil {
		return err
	}
	if err := service.repo.UpdateDocumentStatus(documentID, "processing"); err != nil {
		return err
	}
	workspaceSettings, err := service.loadSettings()
	if err != nil {
		return err
	}
	pageTexts, err := service.loadPageTexts(filePath, fileAudit)
	if err != nil {
		_ = service.repo.UpdateDocumentStatus(documentID, "failed")
		return err
	}
	gatewayClient := gateway.NewClient(workspaceSettings)
	searchContext := buildSearchContext(filePath)
	for pageNumber, pageText := range pageTexts {
		enrichedText := strings.TrimSpace(searchContext + "\n" + pageText)
		result, processErr := gatewayClient.ProcessPage(ctx, enrichedText, workspaceSettings)
		if processErr != nil {
			_ = service.repo.UpdateDocumentStatus(documentID, "failed")
			return processErr
		}
		if err := service.repo.SavePageResult(documentID, pageNumber+1, enrichedText, fileAudit.IsProbablyScanned, result.Provider, result.Fields, result.TokenUsage, result.Embedding); err != nil {
			_ = service.repo.UpdateDocumentStatus(documentID, "failed")
			return err
		}
	}
	finalStatus := "indexed"
	if needsReview(pageTexts) {
		finalStatus = "needs_review"
	}
	return service.repo.UpdateDocumentStatus(documentID, finalStatus)
}

func (service *Service) loadPageTexts(filePath string, audit models.FileAudit) ([]string, error) {
	ext := strings.ToLower(filepath.Ext(filePath))
	if ext == ".pdf" {
		nativeTexts, err := pdf.ExtractTextByPage(filePath)
		if err != nil {
			return nil, err
		}
		if !ocr.ShouldOCRPDF(nativeTexts, audit.IsProbablyScanned) {
			return nativeTexts, nil
		}
		if !service.ocrEngine.PopplerAvailable() || !service.ocrEngine.TesseractAvailable() {
			return nativeTexts, nil
		}
		ocrTexts, err := service.ocrEngine.OCRPDFPages(filePath, len(nativeTexts))
		if err != nil {
			return nativeTexts, nil
		}
		return ocr.MergePageTexts(nativeTexts, ocrTexts), nil
	}
	if service.ocrEngine.Available() {
		text, err := service.ocrEngine.OCRImage(filePath)
		if err != nil {
			return nil, fmt.Errorf("OCR de imagen falló (%s): %w", filepath.Base(filePath), err)
		}
		return []string{text}, nil
	}
	return nil, fmt.Errorf(
		"OCR no disponible: colocá tesseract/tesseract.exe y tessdata/spa.traineddata junto al .exe (ver LEEME-OCR.txt)",
	)
}

func archiveOriginalFile(sourceFile string, loadSettings func() (settings.WorkspaceSettings, error)) (string, error) {
	settings, err := loadSettings()
	if err != nil {
		return "", err
	}
	relativePath, err := filepath.Rel(settings.InputPath, sourceFile)
	if err != nil {
		relativePath = filepath.Base(sourceFile)
	}
	targetPath := filepath.Join(settings.StoragePath, "casos", relativePath)
	if err := os.MkdirAll(filepath.Dir(targetPath), 0o755); err != nil {
		return "", err
	}
	if err := copyFile(sourceFile, targetPath); err != nil {
		return "", err
	}
	return targetPath, nil
}

func copyFile(sourcePath, targetPath string) error {
	sourceInfo, err := os.Stat(sourcePath)
	if err != nil {
		return err
	}
	if targetInfo, statErr := os.Stat(targetPath); statErr == nil && targetInfo.Size() == sourceInfo.Size() {
		return nil
	}
	source, err := os.Open(sourcePath)
	if err != nil {
		return err
	}
	defer source.Close()
	target, err := os.Create(targetPath)
	if err != nil {
		return err
	}
	defer target.Close()
	if _, err := io.Copy(target, source); err != nil {
		return err
	}
	return target.Close()
}

func buildSearchContext(filePath string) string {
	parts := strings.FieldsFunc(filePath, func(r rune) bool {
		return r == '\\' || r == '/'
	})
	return strings.Join(parts, " ")
}

func needsReview(pageTexts []string) bool {
	for _, text := range pageTexts {
		if len(strings.TrimSpace(text)) >= 40 {
			return false
		}
	}
	return true
}
