package server_test

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"archivo-digital-inteligente/internal/localengine/db"
	"archivo-digital-inteligente/internal/localengine/ingest"
	"archivo-digital-inteligente/internal/localengine/repository"
	"archivo-digital-inteligente/internal/localengine/search"
	"archivo-digital-inteligente/internal/localengine/server"
	"archivo-digital-inteligente/internal/localengine/settings"
)

func TestHealthEndpoint(t *testing.T) {
	store, err := db.Open(filepath.Join(t.TempDir(), "archivo.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer store.Close()

	loadSettings := func() (settings.WorkspaceSettings, error) {
		return settings.WorkspaceSettings{MaxRunBudgetUSD: 300}, nil
	}
	repo := repository.New(store.DB())
	handler := server.NewHandler(repo, ingest.NewService(repo, loadSettings, t.TempDir()), search.NewService(repo, loadSettings))
	mux := http.NewServeMux()
	handler.Register(mux)

	request := httptest.NewRequest(http.MethodGet, "/health", nil)
	recorder := httptest.NewRecorder()
	mux.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
}
