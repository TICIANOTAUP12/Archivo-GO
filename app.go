package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx context.Context
}

type ServiceStatus struct {
	BackendReady bool   `json:"backendReady"`
	Message      string `json:"message"`
}

type WorkspaceSettings struct {
	InputPath               string  `json:"inputPath"`
	StoragePath             string  `json:"storagePath"`
	DefaultProvider         string  `json:"defaultProvider"`
	GoogleAPIKey            string  `json:"googleApiKey"`
	GoogleModel             string  `json:"googleModel"`
	GoogleEmbeddingModel    string  `json:"googleEmbeddingModel"`
	AnthropicAPIKey         string  `json:"anthropicApiKey"`
	AnthropicModel          string  `json:"anthropicModel"`
	EmbeddingProvider       string  `json:"embeddingProvider"`
	EnableAnthropicFallback bool    `json:"enableAnthropicFallback"`
	MinExtractionConfidence float64 `json:"minExtractionConfidence"`
	MaxRunBudgetUSD         float64 `json:"maxRunBudgetUsd"`
}

func NewApp() *App {
	return &App{}
}

func (app *App) Startup(ctx context.Context) {
	app.ctx = ctx
	_ = ensureDefaultWorkspaceSettings()
	_ = app.StartServices()
}

func (app *App) Shutdown(ctx context.Context) {
	// El backend Docker queda corriendo de forma independiente al cerrar la app.
}

func (app *App) StartServices() error {
	settings, err := loadWorkspaceSettings()
	if err != nil {
		return err
	}
	if err := ensureWorkspaceDirectories(settings); err != nil {
		return err
	}
	if err := runCommandWithSettings(settings, "docker", "compose", "up", "-d"); err != nil {
		return err
	}
	return waitForBackend("http://localhost:8080/health", 90*time.Second)
}

func (app *App) StopServices() error {
	return runCommand("docker", "compose", "down")
}

func (app *App) GetWorkspaceSettings() (WorkspaceSettings, error) {
	return loadWorkspaceSettings()
}

func (app *App) SaveWorkspaceSettings(settings WorkspaceSettings) error {
	settings = normalizeWorkspaceSettings(settings)
	if err := validateWorkspaceSettings(settings); err != nil {
		return err
	}
	if err := saveWorkspaceSettings(settings); err != nil {
		return err
	}
	if err := app.StopServices(); err != nil {
		return err
	}
	return app.StartServices()
}

func (app *App) SelectDirectory(title string) (string, error) {
	if app.ctx == nil {
		return "", errors.New("desktop context is not ready")
	}
	return wailsruntime.OpenDirectoryDialog(app.ctx, wailsruntime.OpenDialogOptions{Title: title})
}

func (app *App) ServiceStatus() ServiceStatus {
	if err := pingBackend("http://localhost:8080/health"); err != nil {
		return ServiceStatus{BackendReady: false, Message: err.Error()}
	}
	return ServiceStatus{BackendReady: true, Message: "Backend disponible"}
}

func (app *App) OpenFile(path string) error {
	if path == "" {
		return errors.New("file path is required")
	}
	cleanPath := filepath.Clean(path)
	if _, err := os.Stat(cleanPath); err != nil {
		return fmt.Errorf("file is not available: %w", err)
	}
	return openFile(cleanPath)
}

func runCommand(name string, args ...string) error {
	command := exec.Command(name, args...)
	var stderr bytes.Buffer
	command.Stderr = &stderr
	if err := command.Run(); err != nil {
		return fmt.Errorf("%s %v failed: %w: %s", name, args, err, stderr.String())
	}
	return nil
}

func runCommandWithSettings(settings WorkspaceSettings, name string, args ...string) error {
	command := exec.Command(name, args...)
	command.Env = append(os.Environ(), workspaceSettingsEnv(settings)...)
	var stderr bytes.Buffer
	command.Stderr = &stderr
	if err := command.Run(); err != nil {
		return fmt.Errorf("%s %v failed: %w: %s", name, args, err, stderr.String())
	}
	return nil
}

func ensureDefaultWorkspaceSettings() error {
	settings, err := loadWorkspaceSettings()
	if err == nil && settings.InputPath != "" && settings.StoragePath != "" {
		return nil
	}

	projectRoot, err := os.Getwd()
	if err != nil {
		return err
	}
	defaultSettings := WorkspaceSettings{
		InputPath:   filepath.Join(projectRoot, "data", "source"),
		StoragePath: filepath.Join(projectRoot, "data", "storage"),
	}
	defaultSettings = normalizeWorkspaceSettings(defaultSettings)
	if err := ensureWorkspaceDirectories(defaultSettings); err != nil {
		return err
	}
	return saveWorkspaceSettings(defaultSettings)
}

func loadWorkspaceSettings() (WorkspaceSettings, error) {
	path, err := workspaceSettingsPath()
	if err != nil {
		return WorkspaceSettings{}, err
	}
	content, err := os.ReadFile(path)
	if err != nil {
		return WorkspaceSettings{}, err
	}
	var settings WorkspaceSettings
	if err := json.Unmarshal(content, &settings); err != nil {
		return WorkspaceSettings{}, err
	}
	settings = normalizeWorkspaceSettings(settings)
	return settings, validateWorkspaceSettings(settings)
}

func saveWorkspaceSettings(settings WorkspaceSettings) error {
	settings = normalizeWorkspaceSettings(settings)
	if err := validateWorkspaceSettings(settings); err != nil {
		return err
	}
	path, err := workspaceSettingsPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	content, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, content, 0o600)
}

func normalizeWorkspaceSettings(settings WorkspaceSettings) WorkspaceSettings {
	isLegacySettings := settings.DefaultProvider == "" &&
		settings.GoogleModel == "" &&
		settings.GoogleEmbeddingModel == "" &&
		settings.AnthropicModel == "" &&
		settings.EmbeddingProvider == "" &&
		settings.MinExtractionConfidence == 0 &&
		settings.MaxRunBudgetUSD == 0

	if settings.DefaultProvider == "" {
		settings.DefaultProvider = "google"
	}
	if settings.GoogleModel == "" {
		settings.GoogleModel = "gemini-2.5-flash"
	}
	if settings.GoogleEmbeddingModel == "" {
		settings.GoogleEmbeddingModel = "gemini-embedding-001"
	}
	if settings.AnthropicModel == "" {
		settings.AnthropicModel = "claude-haiku-4-5"
	}
	if settings.EmbeddingProvider == "" {
		settings.EmbeddingProvider = "local"
	}
	if settings.MinExtractionConfidence == 0 {
		settings.MinExtractionConfidence = 0.82
	}
	if settings.MaxRunBudgetUSD == 0 {
		settings.MaxRunBudgetUSD = 300
	}
	if isLegacySettings {
		settings.EnableAnthropicFallback = true
	}
	settings.GoogleAPIKey = strings.TrimSpace(settings.GoogleAPIKey)
	settings.AnthropicAPIKey = strings.TrimSpace(settings.AnthropicAPIKey)
	return settings
}

func workspaceSettingsEnv(settings WorkspaceSettings) []string {
	settings = normalizeWorkspaceSettings(settings)
	env := []string{
		"HOST_INPUT_ROOT=" + settings.InputPath,
		"HOST_STORAGE_ROOT=" + settings.StoragePath,
		"DEFAULT_PROVIDER=" + settings.DefaultProvider,
		"GOOGLE_MODEL=" + settings.GoogleModel,
		"GOOGLE_EMBEDDING_MODEL=" + settings.GoogleEmbeddingModel,
		"ANTHROPIC_MODEL=" + settings.AnthropicModel,
		"EMBEDDING_PROVIDER=" + settings.EmbeddingProvider,
		"ENABLE_ANTHROPIC_FALLBACK=" + strconv.FormatBool(settings.EnableAnthropicFallback),
		"MIN_EXTRACTION_CONFIDENCE=" + strconv.FormatFloat(settings.MinExtractionConfidence, 'f', -1, 64),
		"MAX_RUN_BUDGET_USD=" + strconv.FormatFloat(settings.MaxRunBudgetUSD, 'f', -1, 64),
	}
	if settings.GoogleAPIKey != "" {
		env = append(env, "GOOGLE_API_KEY="+settings.GoogleAPIKey)
	}
	if settings.AnthropicAPIKey != "" {
		env = append(env, "ANTHROPIC_API_KEY="+settings.AnthropicAPIKey)
	}
	return env
}

func workspaceSettingsPath() (string, error) {
	projectRoot, err := os.Getwd()
	if err != nil {
		return "", err
	}
	return filepath.Join(projectRoot, "data", "settings.json"), nil
}

func validateWorkspaceSettings(settings WorkspaceSettings) error {
	if settings.InputPath == "" {
		return errors.New("input path is required")
	}
	if settings.StoragePath == "" {
		return errors.New("storage path is required")
	}
	if filepath.Clean(settings.InputPath) == filepath.Clean(settings.StoragePath) {
		return errors.New("input and storage paths must be different")
	}
	if !isAllowedProvider(settings.DefaultProvider, []string{"google", "anthropic", "local"}) {
		return errors.New("default provider must be google, anthropic or local")
	}
	if !isAllowedProvider(settings.EmbeddingProvider, []string{"google", "local"}) {
		return errors.New("embedding provider must be google or local")
	}
	if settings.MinExtractionConfidence <= 0 || settings.MinExtractionConfidence > 1 {
		return errors.New("minimum extraction confidence must be between 0 and 1")
	}
	if settings.MaxRunBudgetUSD <= 0 {
		return errors.New("maximum run budget must be greater than 0")
	}
	return nil
}

func isAllowedProvider(value string, allowed []string) bool {
	for _, option := range allowed {
		if value == option {
			return true
		}
	}
	return false
}

func ensureWorkspaceDirectories(settings WorkspaceSettings) error {
	if err := os.MkdirAll(settings.InputPath, 0o755); err != nil {
		return err
	}
	return os.MkdirAll(settings.StoragePath, 0o755)
}

func openFile(path string) error {
	var command *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		command = exec.Command("rundll32.exe", "url.dll,FileProtocolHandler", path)
	case "darwin":
		command = exec.Command("open", path)
	default:
		command = exec.Command("xdg-open", path)
	}
	return command.Start()
}

func waitForBackend(url string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	var lastErr error
	for time.Now().Before(deadline) {
		if err := pingBackend(url); err == nil {
			return nil
		} else {
			lastErr = err
		}
		time.Sleep(1500 * time.Millisecond)
	}
	if lastErr == nil {
		return errors.New("backend health check timed out")
	}
	return lastErr
}

func pingBackend(url string) error {
	client := http.Client{Timeout: 2 * time.Second}
	response, err := client.Get(url)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode >= 300 {
		return fmt.Errorf("backend status %d", response.StatusCode)
	}
	return nil
}
