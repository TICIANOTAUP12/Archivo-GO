package main

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

var (
	appVersion     = "0.0.0-dev"
	releaseChannel = ""
)

type AppInfo struct {
	Version        string `json:"version"`
	ReleaseChannel string `json:"releaseChannel"`
}

func (app *App) GetAppInfo() AppInfo {
	return AppInfo{
		Version:        currentAppVersion(),
		ReleaseChannel: currentReleaseChannel(),
	}
}

func currentAppVersion() string {
	return strings.TrimPrefix(strings.TrimSpace(appVersion), "v")
}

func currentReleaseChannel() string {
	if channel := strings.TrimSpace(releaseChannel); channel != "" {
		return channel
	}
	return detectReleaseChannel()
}

func detectReleaseChannel() string {
	root, err := appRootDir()
	if err == nil && hasWebView2Runtime(filepath.Join(root, "webview2")) {
		return "windows-386-win7"
	}
	if exe, err := os.Executable(); err == nil {
		name := strings.ToLower(filepath.Base(exe))
		if strings.Contains(name, "win7") {
			return "windows-386-win7"
		}
	}
	if runtime.GOARCH == "386" {
		return "windows-386"
	}
	return "windows-amd64"
}
