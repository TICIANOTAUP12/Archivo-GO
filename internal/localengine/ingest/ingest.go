package ingest

import (
	"context"
	"fmt"
	"io"
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
	audit, err := inventory.AuditSource(request.SourcePath, 500)
	if err != nil {
		return models.IngestResponse{}, err
	}
	runID := audit.RunID
	if request.RunID != nil && *request.RunID != "" {
		runID = *request.RunID
	}
	limit := request.MaxDocuments
	files, err := inventory.DiscoverSupportedFiles(request.SourcePath, limit)
	if err != nil {
		return models.IngestResponse{}, err
	}
	if request.DryRun {
		return models.IngestResponse{
			RunID:            runID,
			QueuedDocuments:  len(files),
			DryRun:           true,
			EstimatedCostUSD: audit.Estimate.TotalHighUSD,
		}, nil
	}
	workspaceSettings, err := service.loadSettings()
	if err != nil {
		return models.IngestResponse{}, err
	}
	if audit.Estimate.TotalHighUSD > workspaceSettings.MaxRunBudgetUSD {
		return models.IngestResponse{}, fmt.Errorf("estimated cost USD %.2f exceeds budget USD %.2f", audit.Estimate.TotalHighUSD, workspaceSettings.MaxRunBudgetUSD)
	}
	if err := service.repo.SaveRun(runID, request.SourcePath, "processing", audit.TotalFiles, audit.TotalPages, audit.ScannedPages, audit.Estimate.TotalHighUSD); err != nil {
		return models.IngestResponse{}, err
	}
	go service.processFiles(context.Background(), files, runID)
	return models.IngestResponse{
		RunID:            runID,
		QueuedDocuments:  len(files),
		DryRun:           false,
		EstimatedCostUSD: audit.Estimate.TotalHighUSD,
	}, nil
}

func (service *Service) processFiles(ctx context.Context, files []string, runID string) {
	defer func() {
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
		hasEnoughText := false
		for _, text := range nativeTexts {
			if len(strings.TrimSpace(text)) >= 40 {
				hasEnoughText = true
				break
			}
		}
		if hasEnoughText && !audit.IsProbablyScanned {
			return nativeTexts, nil
		}
		return nativeTexts, nil
	}
	if service.ocrEngine.Available() {
		text, err := service.ocrEngine.OCRImage(filePath)
		if err != nil {
			return []string{""}, nil
		}
		return []string{text}, nil
	}
	return []string{""}, nil
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
