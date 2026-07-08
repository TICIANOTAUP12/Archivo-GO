package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"archivo-digital-inteligente/internal/localengine/ingest"
	"archivo-digital-inteligente/internal/localengine/inventory"
	"archivo-digital-inteligente/internal/localengine/models"
	"archivo-digital-inteligente/internal/localengine/repository"
	"archivo-digital-inteligente/internal/localengine/search"
)

type Handler struct {
	repo   *repository.Repository
	ingest *ingest.Service
	search *search.Service
}

func NewHandler(repo *repository.Repository, ingestService *ingest.Service, searchService *search.Service) *Handler {
	return &Handler{repo: repo, ingest: ingestService, search: searchService}
}

func (handler *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("/health", withPanicRecovery(handler.handleHealth))
	mux.HandleFunc("/audit", withPanicRecovery(handler.handleAudit))
	mux.HandleFunc("/documents/ingest", withPanicRecovery(handler.handleIngest))
	mux.HandleFunc("/documents/recent", withPanicRecovery(handler.handleRecentDocuments))
	mux.HandleFunc("/documents", withPanicRecovery(handler.handleDocuments))
	mux.HandleFunc("/search", withPanicRecovery(handler.handleSearch))
}

func (handler *Handler) handleHealth(responseWriter http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeError(responseWriter, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	status := models.HealthResponse{Status: "ok", Database: "ok"}
	if err := handler.repo.Ping(); err != nil {
		status.Status = "degraded"
		status.Database = "error"
	}
	writeJSON(responseWriter, http.StatusOK, status)
}

func (handler *Handler) handleAudit(responseWriter http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeError(responseWriter, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var body models.AuditRequest
	if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
		writeError(responseWriter, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.SampleLimit == 0 {
		body.SampleLimit = 25
	}
	audit, err := inventory.AuditSource(body.SourcePath, body.SampleLimit)
	if err != nil {
		writeError(responseWriter, http.StatusBadRequest, err.Error())
		return
	}
	_ = handler.repo.SaveRun(audit.RunID, audit.SourcePath, "audited", audit.TotalFiles, audit.TotalPages, audit.ScannedPages, audit.Estimate.TotalHighUSD)
	writeJSON(responseWriter, http.StatusOK, audit)
}

func (handler *Handler) handleIngest(responseWriter http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeError(responseWriter, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var body models.IngestRequest
	if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
		writeError(responseWriter, http.StatusBadRequest, "invalid request body")
		return
	}
	result, err := handler.ingest.IngestSource(request.Context(), body)
	if err != nil {
		writeError(responseWriter, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(responseWriter, http.StatusOK, result)
}

func (handler *Handler) handleRecentDocuments(responseWriter http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeError(responseWriter, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	documents, err := handler.repo.ListRecentDocuments(25)
	if err != nil {
		writeError(responseWriter, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(responseWriter, http.StatusOK, documents)
}

func (handler *Handler) handleDocuments(responseWriter http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeError(responseWriter, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	limit := 200
	if rawLimit := request.URL.Query().Get("limit"); rawLimit != "" {
		if parsed, err := strconv.Atoi(rawLimit); err == nil {
			limit = parsed
		}
	}
	var statusFilter *string
	if rawStatus := request.URL.Query().Get("status"); rawStatus != "" {
		statusFilter = &rawStatus
	}
	documents, err := handler.repo.ListDocuments(statusFilter, limit)
	if err != nil {
		writeError(responseWriter, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(responseWriter, http.StatusOK, documents)
}

func (handler *Handler) handleSearch(responseWriter http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeError(responseWriter, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var body models.SearchRequest
	if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
		writeError(responseWriter, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.Limit == 0 {
		body.Limit = 20
	}
	ctx, cancel := context.WithTimeout(request.Context(), 120*time.Second)
	defer cancel()
	results, err := handler.search.SearchDocuments(ctx, body)
	if err != nil {
		writeError(responseWriter, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(responseWriter, http.StatusOK, results)
}

func writeJSON(responseWriter http.ResponseWriter, statusCode int, payload any) {
	responseWriter.Header().Set("Content-Type", "application/json")
	responseWriter.WriteHeader(statusCode)
	_ = json.NewEncoder(responseWriter).Encode(payload)
}

func writeError(responseWriter http.ResponseWriter, statusCode int, message string) {
	writeJSON(responseWriter, statusCode, map[string]string{"detail": message})
}

func withPanicRecovery(next http.HandlerFunc) http.HandlerFunc {
	return func(responseWriter http.ResponseWriter, request *http.Request) {
		defer func() {
			if recovered := recover(); recovered != nil {
				writeError(responseWriter, http.StatusInternalServerError, fmt.Sprintf("motor local: %v", recovered))
			}
		}()
		next(responseWriter, request)
	}
}
