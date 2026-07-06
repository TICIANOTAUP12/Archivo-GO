package main

import (
	"archive/zip"
	"encoding/json"
	"errors"
	"fmt"
	"io"
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

const (
	githubOwner = "TICIANOTAUP12"
	githubRepo  = "Archivo-GO"
)

type UpdateCheckResult struct {
	CurrentVersion  string `json:"currentVersion"`
	LatestVersion   string `json:"latestVersion"`
	UpdateAvailable bool   `json:"updateAvailable"`
	ReleaseNotes    string `json:"releaseNotes"`
	Message         string `json:"message"`
}

type githubRelease struct {
	TagName     string        `json:"tag_name"`
	Body        string        `json:"body"`
	Assets      []githubAsset `json:"assets"`
	HTMLURL     string        `json:"html_url"`
	PublishedAt time.Time     `json:"published_at"`
}

type githubAsset struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
	Size               int64  `json:"size"`
}

func (app *App) CheckForUpdates() (UpdateCheckResult, error) {
	result := UpdateCheckResult{
		CurrentVersion: currentAppVersion(),
		Message:        "Estás usando la última versión disponible.",
	}

	release, err := fetchLatestRelease()
	if err != nil {
		return result, err
	}

	latestVersion := strings.TrimPrefix(strings.TrimSpace(release.TagName), "v")
	result.LatestVersion = latestVersion
	if !isVersionNewer(latestVersion, result.CurrentVersion) {
		return result, nil
	}

	asset, err := findReleaseAsset(release.Assets, currentReleaseChannel())
	if err != nil {
		return result, fmt.Errorf("release %s publicado pero sin paquete para %s", latestVersion, currentReleaseChannel())
	}

	result.UpdateAvailable = true
	result.ReleaseNotes = strings.TrimSpace(release.Body)
	result.Message = fmt.Sprintf(
		"Hay una versión nueva (%s). Paquete listo: %s (%.1f MB).",
		latestVersion,
		asset.Name,
		float64(asset.Size)/(1024*1024),
	)
	return result, nil
}

func (app *App) InstallLatestUpdate() error {
	if runtime.GOOS != "windows" {
		return errors.New("auto-actualización disponible solo en Windows")
	}

	release, err := fetchLatestRelease()
	if err != nil {
		return err
	}

	latestVersion := strings.TrimPrefix(strings.TrimSpace(release.TagName), "v")
	if !isVersionNewer(latestVersion, currentAppVersion()) {
		return errors.New("ya tenés la última versión instalada")
	}

	asset, err := findReleaseAsset(release.Assets, currentReleaseChannel())
	if err != nil {
		return err
	}

	installDir, err := appRootDir()
	if err != nil {
		return err
	}

	workDir := filepath.Join(os.TempDir(), "archivo-scivoli-update", latestVersion)
	if err := os.RemoveAll(workDir); err != nil {
		return err
	}
	if err := os.MkdirAll(workDir, 0o755); err != nil {
		return err
	}

	zipPath := filepath.Join(workDir, asset.Name)
	if err := downloadFile(asset.BrowserDownloadURL, zipPath); err != nil {
		return fmt.Errorf("no pudimos descargar la actualización: %w", err)
	}

	extractDir := filepath.Join(workDir, "extracted")
	if err := extractZip(zipPath, extractDir); err != nil {
		return fmt.Errorf("no pudimos descomprimir la actualización: %w", err)
	}

	newExecutable, err := findUpdatedExecutable(extractDir, currentReleaseChannel())
	if err != nil {
		return err
	}
	launchExecutable := filepath.Join(installDir, filepath.Base(newExecutable))

	scriptPath := filepath.Join(workDir, "apply-update.bat")
	if err := writeUpdateScript(scriptPath, installDir, extractDir, launchExecutable); err != nil {
		return err
	}

	if err := launchUpdateScript(scriptPath); err != nil {
		return err
	}

	if app.ctx != nil {
		wailsruntime.Quit(app.ctx)
	}
	return nil
}

func fetchLatestRelease() (githubRelease, error) {
	client := http.Client{Timeout: 30 * time.Second}
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/releases/latest", githubOwner, githubRepo)
	request, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return githubRelease{}, err
	}
	request.Header.Set("Accept", "application/vnd.github+json")
	request.Header.Set("User-Agent", "ArchivoScivoliGNC-updater")

	response, err := client.Do(request)
	if err != nil {
		return githubRelease{}, fmt.Errorf("sin conexión para buscar actualizaciones: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode == http.StatusNotFound {
		return githubRelease{}, errors.New("no se encontró release público (repo privado: hace falta internet + acceso a GitHub Releases)")
	}
	if response.StatusCode >= 300 {
		return githubRelease{}, fmt.Errorf("GitHub respondió %d al buscar releases", response.StatusCode)
	}

	var release githubRelease
	if err := json.NewDecoder(response.Body).Decode(&release); err != nil {
		return githubRelease{}, err
	}
	if release.TagName == "" {
		return githubRelease{}, errors.New("release inválido desde GitHub")
	}
	return release, nil
}

func findReleaseAsset(assets []githubAsset, channel string) (githubAsset, error) {
	suffix := fmt.Sprintf("-%s.zip", channel)
	for _, asset := range assets {
		if strings.HasSuffix(strings.ToLower(asset.Name), strings.ToLower(suffix)) {
			return asset, nil
		}
	}
	return githubAsset{}, fmt.Errorf("no hay paquete %s en el último release", suffix)
}

func isVersionNewer(latest, current string) bool {
	latestParts := parseVersionParts(latest)
	currentParts := parseVersionParts(current)
	maxLen := len(latestParts)
	if len(currentParts) > maxLen {
		maxLen = len(currentParts)
	}
	for index := 0; index < maxLen; index++ {
		latestValue := 0
		currentValue := 0
		if index < len(latestParts) {
			latestValue = latestParts[index]
		}
		if index < len(currentParts) {
			currentValue = currentParts[index]
		}
		if latestValue > currentValue {
			return true
		}
		if latestValue < currentValue {
			return false
		}
	}
	return false
}

func parseVersionParts(version string) []int {
	version = strings.TrimPrefix(strings.TrimSpace(version), "v")
	parts := strings.Split(version, ".")
	values := make([]int, 0, len(parts))
	for _, part := range parts {
		digits := strings.TrimSpace(part)
		if dash := strings.Index(digits, "-"); dash >= 0 {
			digits = digits[:dash]
		}
		value, err := strconv.Atoi(digits)
		if err != nil {
			value = 0
		}
		values = append(values, value)
	}
	return values
}

func downloadFile(url, destination string) error {
	client := http.Client{Timeout: 15 * time.Minute}
	response, err := client.Get(url)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode >= 300 {
		return fmt.Errorf("descarga falló con HTTP %d", response.StatusCode)
	}

	file, err := os.Create(destination)
	if err != nil {
		return err
	}
	defer file.Close()

	_, err = io.Copy(file, response.Body)
	return err
}

func extractZip(zipPath, destination string) error {
	reader, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer reader.Close()

	if err := os.MkdirAll(destination, 0o755); err != nil {
		return err
	}

	for _, file := range reader.File {
		targetPath := filepath.Join(destination, file.Name)
		relative, relErr := filepath.Rel(destination, targetPath)
		if relErr != nil || strings.HasPrefix(relative, "..") {
			return fmt.Errorf("ruta inválida en zip: %s", file.Name)
		}
		if file.FileInfo().IsDir() {
			if err := os.MkdirAll(targetPath, 0o755); err != nil {
				return err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(targetPath), 0o755); err != nil {
			return err
		}
		if err := extractZipFile(file, targetPath); err != nil {
			return err
		}
	}
	return nil
}

func extractZipFile(file *zip.File, targetPath string) error {
	source, err := file.Open()
	if err != nil {
		return err
	}
	defer source.Close()

	destination, err := os.OpenFile(targetPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, file.Mode())
	if err != nil {
		return err
	}
	defer destination.Close()

	_, err = io.Copy(destination, source)
	return err
}

func findUpdatedExecutable(extractDir, channel string) (string, error) {
	var candidates []string
	err := filepath.WalkDir(extractDir, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil || entry.IsDir() {
			return nil
		}
		name := strings.ToLower(entry.Name())
		if !strings.HasSuffix(name, ".exe") {
			return nil
		}
		if !strings.HasPrefix(name, "archivoscivolignc") {
			return nil
		}
		if channel == "windows-386-win7" && !strings.Contains(name, "win7") {
			return nil
		}
		if channel == "windows-386" && strings.Contains(name, "win7") {
			return nil
		}
		candidates = append(candidates, path)
		return nil
	})
	if err != nil {
		return "", err
	}
	if len(candidates) == 0 {
		return "", errors.New("no se encontró el ejecutable nuevo dentro del paquete")
	}
	return candidates[0], nil
}

func writeUpdateScript(scriptPath, installDir, extractDir, newExecutable string) error {
	script := fmt.Sprintf(`@echo off
setlocal
timeout /t 2 /nobreak >nul
xcopy /E /Y /I /Q "%s\*" "%s\"
start "" "%s"
del "%%~f0"
`, extractDir, installDir, newExecutable)
	return os.WriteFile(scriptPath, []byte(script), 0o644)
}

func launchUpdateScript(scriptPath string) error {
	command := exec.Command("cmd.exe", "/C", scriptPath)
	return command.Start()
}
