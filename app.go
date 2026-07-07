package main

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"archivo-digital-inteligente/internal/localengine"
	"archivo-digital-inteligente/internal/localengine/settings"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx context.Context
}

type ServiceStatus struct {
	BackendReady    bool   `json:"backendReady"`
	Message         string `json:"message"`
	DockerAvailable bool   `json:"dockerAvailable"`
}

type WorkspaceSettings struct {
	BackendURL                string  `json:"backendUrl"`
	GatewayURL                string  `json:"gatewayUrl"`
	GatewayToken              string  `json:"gatewayToken"`
	DeploymentMode            string  `json:"deploymentMode"`
	LocalEngineListenAddress  string  `json:"localEngineListenAddress"`
	InputPath               string  `json:"inputPath"`
	StoragePath             string  `json:"storagePath"`
	DefaultProvider         string  `json:"defaultProvider"`
	GoogleAPIKey            string  `json:"googleApiKey"`
	GoogleModel             string  `json:"googleModel"`
	GoogleEmbeddingModel    string  `json:"googleEmbeddingModel"`
	AnthropicAPIKey         string  `json:"anthropicApiKey"`
	AnthropicModel          string  `json:"anthropicModel"`
	OpenAIAPIKey            string  `json:"openaiApiKey"`
	OpenAIModel             string  `json:"openaiModel"`
	OpenAIEmbeddingModel    string  `json:"openaiEmbeddingModel"`
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
	_ = app.persistDeploymentMigration()
	go func() {
		_ = app.StartServices()
	}()
}

func (app *App) persistDeploymentMigration() error {
	settings, err := loadWorkspaceSettings()
	if err != nil {
		return err
	}
	migrated := migrateLegacyDeploymentSettings(settings)
	migrated = normalizeWorkspaceSettings(migrated)
	if migrated.DeploymentMode == settings.DeploymentMode && migrated.BackendURL == settings.BackendURL {
		return nil
	}
	return saveWorkspaceSettings(migrated)
}

func (app *App) Shutdown(ctx context.Context) {
	// El backend Docker queda corriendo de forma independiente al cerrar la app.
}

func (app *App) StartServices() error {
	settings, err := loadWorkspaceSettings()
	if err != nil {
		return err
	}
	settings = normalizeWorkspaceSettings(settings)
	if err := ensureWorkspaceDirectories(settings); err != nil {
		return err
	}
	if isLocalDeployment(settings) {
		return startLocalEngine(settings)
	}
	if !isDockerAvailable() {
		if usesLocalDockerBackend(settings.BackendURL) {
			settings.DeploymentMode = "local"
			settings.BackendURL = "http://" + settings.LocalEngineListenAddress
			_ = saveWorkspaceSettings(settings)
			return startLocalEngine(settings)
		}
		return nil
	}
	if err := runCommandWithSettings(settings, "docker", "compose", "up", "-d"); err != nil {
		return err
	}
	if err := syncInputFolderToContainer(settings.InputPath); err != nil {
		return err
	}
	healthURL := normalizeBackendURL(settings.BackendURL) + "/health"
	return waitForBackend(healthURL, 90*time.Second)
}

func syncInputFolderToContainer(inputPath string) error {
	if inputPath == "" {
		return errors.New("input path is required")
	}
	if hasContainerInputFiles() {
		return nil
	}
	cleanPath := filepath.Clean(inputPath)
	if _, err := os.Stat(cleanPath); err != nil {
		return fmt.Errorf("input path is not available: %w", err)
	}
	source := filepath.ToSlash(cleanPath) + "/."
	return runCommand("docker", "cp", source, "archivo_backend:/host/input/")
}

func hasContainerInputFiles() bool {
	command := exec.Command("docker", "exec", "archivo_backend", "sh", "-c", "ls -A /host/input | head -1")
	output, err := command.Output()
	return err == nil && strings.TrimSpace(string(output)) != ""
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
	if err := ensureWorkspaceDirectories(settings); err != nil {
		return err
	}
	if err := saveWorkspaceSettings(settings); err != nil {
		return err
	}
	if isLocalDeployment(settings) {
		_ = localengine.Stop()
		return startLocalEngine(settings)
	}
	if !isDockerAvailable() {
		return nil
	}
	_ = app.StopServices()
	return app.StartServices()
}

func (app *App) OpenHelpManual() error {
	path, err := resolveHelpManualPath()
	if err != nil {
		return err
	}
	return openFile(path)
}

func (app *App) SelectDirectory(title string) (string, error) {
	if app.ctx == nil {
		return "", errors.New("desktop context is not ready")
	}
	return wailsruntime.OpenDirectoryDialog(app.ctx, wailsruntime.OpenDialogOptions{Title: title})
}

func (app *App) ServiceStatus() ServiceStatus {
	settings, settingsErr := loadWorkspaceSettings()
	healthURL := "http://localhost:8080/health"
	if settingsErr == nil {
		healthURL = normalizeBackendURL(settings.BackendURL) + "/health"
	}
	dockerAvailable := isDockerAvailable()
	if err := pingBackend(healthURL); err != nil {
		message := err.Error()
		if settingsErr == nil && isLocalDeployment(settings) {
			message = "Motor local no disponible. Verificá que la app tenga permisos y que el puerto 8090 esté libre."
		} else if !dockerAvailable {
			message = "Backend no disponible. En Windows 7 usá modo local (motor SQLite + gateway IA). Configurá gateway URL en IA."
		}
		return ServiceStatus{BackendReady: false, Message: message, DockerAvailable: dockerAvailable}
	}
	if settingsErr == nil && isLocalDeployment(settings) {
		return ServiceStatus{BackendReady: true, Message: "Motor local activo (SQLite)", DockerAvailable: dockerAvailable}
	}
	return ServiceStatus{BackendReady: true, Message: "Backend disponible", DockerAvailable: dockerAvailable}
}

func (app *App) TestGatewayConnection() error {
	settings, err := loadWorkspaceSettings()
	if err != nil {
		return err
	}
	gatewayURL := normalizeBackendURL(settings.GatewayURL)
	if strings.TrimSpace(gatewayURL) == "" {
		return errors.New("gateway URL is required")
	}
	token := strings.TrimSpace(settings.GatewayToken)

	healthRequest, err := http.NewRequest(http.MethodGet, gatewayURL+"/health", nil)
	if err != nil {
		return err
	}
	client := gatewayHTTPClient(15 * time.Second)
	healthResponse, err := client.Do(healthRequest)
	if err != nil {
		return fmt.Errorf("no se pudo conectar al gateway: %w", err)
	}
	healthResponse.Body.Close()
	if healthResponse.StatusCode >= 300 {
		return fmt.Errorf("gateway health status %d", healthResponse.StatusCode)
	}

	payload, err := json.Marshal(map[string]string{
		"text":     "Patente TEST123",
		"provider": "local",
	})
	if err != nil {
		return err
	}
	probeRequest, err := http.NewRequest(http.MethodPost, gatewayURL+"/v1/extract", bytes.NewReader(payload))
	if err != nil {
		return err
	}
	probeRequest.Header.Set("Content-Type", "application/json")
	if token != "" {
		probeRequest.Header.Set("X-Gateway-Token", token)
	}
	probeResponse, err := client.Do(probeRequest)
	if err != nil {
		return fmt.Errorf("gateway probe failed: %w", err)
	}
	defer probeResponse.Body.Close()
	if probeResponse.StatusCode == http.StatusUnauthorized {
		return errors.New("token del gateway inválido o vacío (copiá el token completo y guardá configuración)")
	}
	if probeResponse.StatusCode >= 300 {
		body, _ := io.ReadAll(probeResponse.Body)
		return fmt.Errorf("gateway probe status %d: %s", probeResponse.StatusCode, strings.TrimSpace(string(body)))
	}
	return nil
}

func gatewayHTTPClient(timeout time.Duration) *http.Client {
	return &http.Client{
		Timeout: timeout,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{
				MinVersion: tls.VersionTLS12,
			},
		},
	}
}

func (app *App) OpenFile(path string) error {
	return app.OpenDocument("", path)
}

func (app *App) OpenDocument(storagePath, sourcePath string) error {
	resolvedPath, err := resolveDocumentOpenPath(storagePath, sourcePath)
	if err != nil {
		return err
	}
	return openFile(resolvedPath)
}

func resolveDocumentOpenPath(storagePath, sourcePath string) (string, error) {
	candidates := buildDocumentOpenCandidates(storagePath, sourcePath)
	for _, candidate := range candidates {
		if fileExists(candidate) {
			return candidate, nil
		}
	}
	if len(candidates) == 0 {
		return "", errors.New("no hay una ruta de archivo disponible para abrir")
	}
	return "", fmt.Errorf("archivo no encontrado en el equipo (probó %d rutas)", len(candidates))
}

func buildDocumentOpenCandidates(storagePath, sourcePath string) []string {
	settings, settingsErr := loadWorkspaceSettings()
	projectRoot, rootErr := os.Getwd()
	if rootErr != nil {
		projectRoot = ""
	}

	var candidates []string
	addCandidate := func(path string) {
		path = strings.TrimSpace(path)
		if path == "" {
			return
		}
		cleanPath := filepath.Clean(path)
		for _, existing := range candidates {
			if existing == cleanPath {
				return
			}
		}
		candidates = append(candidates, cleanPath)
	}

	addCandidate(storagePath)
	addCandidate(sourcePath)

	if projectRoot != "" {
		for _, path := range []string{storagePath, sourcePath} {
			if path != "" && !filepath.IsAbs(path) {
				addCandidate(filepath.Join(projectRoot, path))
			}
		}
	}

	if settingsErr == nil {
		for _, path := range []string{storagePath, sourcePath} {
			if mapped := mapStorageAlias(path, settings.StoragePath); mapped != "" {
				addCandidate(mapped)
			}
		}

		filename := filepath.Base(strings.TrimSpace(storagePath))
		if filename == "." || filename == "" {
			filename = filepath.Base(strings.TrimSpace(sourcePath))
		}
		if filename != "" && filename != "." {
			addCandidate(filepath.Join(settings.StoragePath, "casos", filename))
			if found, ok := findFileByName(settings.StoragePath, filename); ok {
				addCandidate(found)
			}
			if found, ok := findFileByName(settings.InputPath, filename); ok {
				addCandidate(found)
			}
		}
	}

	return candidates
}

func mapStorageAlias(path, storageRoot string) string {
	path = strings.TrimSpace(path)
	if path == "" || storageRoot == "" {
		return ""
	}

	slashPath := filepath.ToSlash(path)
	prefixes := []string{"data/storage/", "/host/storage/"}
	for _, prefix := range prefixes {
		if strings.HasPrefix(slashPath, prefix) {
			relative := strings.TrimPrefix(slashPath, prefix)
			return filepath.Join(storageRoot, filepath.FromSlash(relative))
		}
	}
	return ""
}

func findFileByName(root, filename string) (string, bool) {
	root = strings.TrimSpace(root)
	filename = strings.TrimSpace(filename)
	if root == "" || filename == "" {
		return "", false
	}

	info, err := os.Stat(root)
	if err != nil || !info.IsDir() {
		return "", false
	}

	var found string
	_ = filepath.WalkDir(root, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil || found != "" {
			return nil
		}
		if entry.IsDir() {
			return nil
		}
		if entry.Name() == filename {
			found = path
			return fs.SkipAll
		}
		return nil
	})

	return found, found != ""
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
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

func appRootDir() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return os.Getwd()
	}
	return filepath.Dir(exe), nil
}

func isDockerAvailable() bool {
	_, err := exec.LookPath("docker")
	return err == nil
}

func ensureDefaultWorkspaceSettings() error {
	settings, err := loadWorkspaceSettings()
	if err == nil && settings.InputPath != "" {
		return nil
	}

	projectRoot, err := appRootDir()
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
		settings.OpenAIModel == "" &&
		settings.EmbeddingProvider == "" &&
		settings.DeploymentMode == "" &&
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
	if settings.DeploymentMode == "" {
		if !isDockerAvailable() {
			settings.DeploymentMode = "local"
		} else {
			settings.DeploymentMode = "docker"
		}
	}
	settings = migrateLegacyDeploymentSettings(settings)
	if settings.LocalEngineListenAddress == "" {
		settings.LocalEngineListenAddress = "127.0.0.1:8090"
	}
	if isLocalDeployment(settings) && (settings.BackendURL == "" || settings.BackendURL == "http://localhost:8080") {
		settings.BackendURL = "http://" + settings.LocalEngineListenAddress
	}
	if settings.OpenAIModel == "" {
		settings.OpenAIModel = "gpt-4o-mini"
	}
	if settings.OpenAIEmbeddingModel == "" {
		settings.OpenAIEmbeddingModel = "text-embedding-3-small"
	}
	if settings.MinExtractionConfidence == 0 {
		settings.MinExtractionConfidence = 0.82
	}
	if settings.MaxRunBudgetUSD == 0 {
		settings.MaxRunBudgetUSD = 300
	}
	settings.BackendURL = normalizeBackendURL(settings.BackendURL)
	if settings.StoragePath == "" {
		if projectRoot, err := appRootDir(); err == nil {
			settings.StoragePath = filepath.Join(projectRoot, "data", "storage")
		}
	}
	if isLegacySettings {
		settings.EnableAnthropicFallback = true
	}
	settings.GoogleAPIKey = strings.TrimSpace(settings.GoogleAPIKey)
	settings.AnthropicAPIKey = strings.TrimSpace(settings.AnthropicAPIKey)
	settings.OpenAIAPIKey = strings.TrimSpace(settings.OpenAIAPIKey)
	if trimmedGateway := strings.TrimSpace(settings.GatewayURL); trimmedGateway != "" {
		settings.GatewayURL = strings.TrimRight(normalizeBackendURL(trimmedGateway), "/")
	} else {
		settings.GatewayURL = ""
	}
	settings.GatewayToken = strings.TrimSpace(settings.GatewayToken)
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
	env = append(env, "ANTHROPIC_API_KEY="+settings.AnthropicAPIKey)
	env = append(env, "OPENAI_API_KEY="+settings.OpenAIAPIKey)
	return env
}

func workspaceSettingsPath() (string, error) {
	projectRoot, err := appRootDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(projectRoot, "data", "settings.json"), nil
}

func validateWorkspaceSettings(settings WorkspaceSettings) error {
	if settings.BackendURL != "" {
		parsedURL, err := url.ParseRequestURI(normalizeBackendURL(settings.BackendURL))
		if err != nil || parsedURL.Host == "" {
			return errors.New("backend URL must be a valid http or https address")
		}
	}
	if settings.GatewayURL != "" {
		parsedGateway, err := url.ParseRequestURI(normalizeBackendURL(settings.GatewayURL))
		if err != nil || parsedGateway.Host == "" {
			return errors.New("gateway URL must be a valid http or https address")
		}
	}
	if settings.InputPath == "" {
		return errors.New("input path is required")
	}
	if settings.StoragePath == "" {
		return errors.New("storage path is required")
	}
	if filepath.Clean(settings.InputPath) == filepath.Clean(settings.StoragePath) {
		return errors.New("input and storage paths must be different")
	}
	if !isAllowedProvider(settings.DefaultProvider, []string{"google", "anthropic", "openai", "local"}) {
		return errors.New("default provider must be google, anthropic, openai or local")
	}
	if !isAllowedProvider(settings.EmbeddingProvider, []string{"google", "openai", "local"}) {
		return errors.New("embedding provider must be google, openai or local")
	}
	if !isAllowedProvider(settings.DeploymentMode, []string{"docker", "local"}) {
		return errors.New("deployment mode must be docker or local")
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

func normalizeBackendURL(raw string) string {
	raw = strings.TrimSpace(raw)
	raw = strings.ReplaceAll(raw, `\`, `/`)
	if raw == "" {
		return "http://localhost:8080"
	}
	raw = strings.TrimRight(raw, "/")
	lower := strings.ToLower(raw)
	if !strings.HasPrefix(lower, "http://") && !strings.HasPrefix(lower, "https://") {
		return "https://" + raw
	}
	return raw
}

func openFile(path string) error {
	absPath, err := filepath.Abs(path)
	if err != nil {
		return err
	}

	var command *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		// `start` abre .html con el navegador predeterminado (más fiable que rundll32 con rutas con espacios).
		command = exec.Command("cmd", "/c", "start", "", absPath)
	case "darwin":
		command = exec.Command("open", absPath)
	default:
		command = exec.Command("xdg-open", absPath)
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

func isLocalDeployment(settings WorkspaceSettings) bool {
	return strings.EqualFold(strings.TrimSpace(settings.DeploymentMode), "local")
}

func usesLocalDockerBackend(backendURL string) bool {
	normalized := normalizeBackendURL(strings.TrimSpace(backendURL))
	return normalized == "" || normalized == "http://localhost:8080" || normalized == "http://127.0.0.1:8080"
}

func migrateLegacyDeploymentSettings(settings WorkspaceSettings) WorkspaceSettings {
	if isDockerAvailable() || isLocalDeployment(settings) {
		return settings
	}
	if !usesLocalDockerBackend(settings.BackendURL) {
		return settings
	}
	settings.DeploymentMode = "local"
	if settings.LocalEngineListenAddress == "" {
		settings.LocalEngineListenAddress = "127.0.0.1:8090"
	}
	settings.BackendURL = "http://" + settings.LocalEngineListenAddress
	return settings
}

func startLocalEngine(settings WorkspaceSettings) error {
	appRoot, err := appRootDir()
	if err != nil {
		return err
	}
	dataDir := filepath.Join(appRoot, "data")
	return localengine.Start(localengine.Config{
		DataDir:       dataDir,
		AppRoot:       appRoot,
		ListenAddress: settings.LocalEngineListenAddress,
		LoadSettings:  loadLocalEngineSettings,
	})
}

func loadLocalEngineSettings() (settings.WorkspaceSettings, error) {
	workspaceSettings, err := loadWorkspaceSettings()
	if err != nil {
		return settings.WorkspaceSettings{}, err
	}
	return mapWorkspaceToLocalEngineSettings(workspaceSettings), nil
}

func mapWorkspaceToLocalEngineSettings(workspace WorkspaceSettings) settings.WorkspaceSettings {
	return settings.WorkspaceSettings{
		BackendURL:               workspace.BackendURL,
		GatewayURL:               workspace.GatewayURL,
		GatewayToken:             workspace.GatewayToken,
		DeploymentMode:           workspace.DeploymentMode,
		InputPath:                workspace.InputPath,
		StoragePath:              workspace.StoragePath,
		DefaultProvider:          workspace.DefaultProvider,
		GoogleAPIKey:             workspace.GoogleAPIKey,
		GoogleModel:              workspace.GoogleModel,
		GoogleEmbeddingModel:     workspace.GoogleEmbeddingModel,
		AnthropicAPIKey:          workspace.AnthropicAPIKey,
		AnthropicModel:           workspace.AnthropicModel,
		OpenAIAPIKey:             workspace.OpenAIAPIKey,
		OpenAIModel:              workspace.OpenAIModel,
		OpenAIEmbeddingModel:     workspace.OpenAIEmbeddingModel,
		EmbeddingProvider:        workspace.EmbeddingProvider,
		EnableAnthropicFallback:  workspace.EnableAnthropicFallback,
		MinExtractionConfidence:  workspace.MinExtractionConfidence,
		MaxRunBudgetUSD:          workspace.MaxRunBudgetUSD,
		LocalEngineListenAddress: workspace.LocalEngineListenAddress,
	}
}
