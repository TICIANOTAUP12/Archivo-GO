package localengine

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"archivo-digital-inteligente/internal/localengine/db"
	"archivo-digital-inteligente/internal/localengine/ingest"
	"archivo-digital-inteligente/internal/localengine/repository"
	"archivo-digital-inteligente/internal/localengine/search"
	"archivo-digital-inteligente/internal/localengine/server"
	"archivo-digital-inteligente/internal/localengine/settings"
)

type Config struct {
	DataDir        string
	AppRoot        string
	ListenAddress  string
	LoadSettings   func() (settings.WorkspaceSettings, error)
}

type Engine struct {
	store  *db.Store
	server *http.Server
}

var (
	runningEngine *Engine
	engineMutex   sync.Mutex
)

func Start(config Config) error {
	engineMutex.Lock()
	defer engineMutex.Unlock()
	if runningEngine != nil {
		return nil
	}
	if config.ListenAddress == "" {
		config.ListenAddress = "127.0.0.1:8090"
	}
	dbPath := strings.TrimRight(config.DataDir, `\./`) + "/archivo.db"
	store, err := db.Open(dbPath)
	if err != nil {
		return err
	}
	repo := repository.New(store.DB())
	ingestService := ingest.NewService(repo, config.LoadSettings, config.AppRoot)
	searchService := search.NewService(repo, config.LoadSettings)
	handler := server.NewHandler(repo, ingestService, searchService)
	mux := http.NewServeMux()
	handler.Register(mux)
	httpServer := &http.Server{
		Addr:              config.ListenAddress,
		Handler:           withCORS(mux),
		ReadHeaderTimeout: 10 * time.Second,
	}
	runningEngine = &Engine{store: store, server: httpServer}
	go func() {
		_ = httpServer.ListenAndServe()
	}()
	return waitForHealth(config.ListenAddress, 15*time.Second)
}

func Stop() error {
	engineMutex.Lock()
	defer engineMutex.Unlock()
	if runningEngine == nil {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	err := runningEngine.server.Shutdown(ctx)
	closeErr := runningEngine.store.Close()
	runningEngine = nil
	if err != nil {
		return err
	}
	return closeErr
}

func IsRunning() bool {
	engineMutex.Lock()
	defer engineMutex.Unlock()
	return runningEngine != nil
}

func waitForHealth(listenAddress string, timeout time.Duration) error {
	healthURL := "http://" + listenAddress + "/health"
	deadline := time.Now().Add(timeout)
	var lastErr error
	client := http.Client{Timeout: 2 * time.Second}
	for time.Now().Before(deadline) {
		response, err := client.Get(healthURL)
		if err == nil {
			_ = response.Body.Close()
			if response.StatusCode < 300 {
				return nil
			}
			lastErr = fmt.Errorf("health status %d", response.StatusCode)
		} else {
			lastErr = err
		}
		time.Sleep(300 * time.Millisecond)
	}
	if lastErr == nil {
		return fmt.Errorf("local engine health timeout")
	}
	return lastErr
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(responseWriter http.ResponseWriter, request *http.Request) {
		responseWriter.Header().Set("Access-Control-Allow-Origin", "*")
		responseWriter.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		responseWriter.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if request.Method == http.MethodOptions {
			responseWriter.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(responseWriter, request)
	})
}
