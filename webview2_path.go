package main

import (
	"os"
	"path/filepath"
	"strings"
)

func resolveWebView2BrowserPath() string {
	exe, err := os.Executable()
	if err != nil {
		return ""
	}

	baseDir := filepath.Dir(exe)
	candidates := []string{
		filepath.Join(baseDir, "webview2"),
		filepath.Join(baseDir, "Microsoft.WebView2.FixedVersionRuntime.109.0.1518.78.x86"),
	}

	for _, candidate := range candidates {
		if hasWebView2Runtime(candidate) {
			return candidate
		}
	}

	entries, err := os.ReadDir(baseDir)
	if err != nil {
		return ""
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		name := strings.ToLower(entry.Name())
		if !strings.Contains(name, "webview2") {
			continue
		}
		candidate := filepath.Join(baseDir, entry.Name())
		if hasWebView2Runtime(candidate) {
			return candidate
		}
	}

	return ""
}

func hasWebView2Runtime(dir string) bool {
	info, err := os.Stat(filepath.Join(dir, "msedgewebview2.exe"))
	return err == nil && !info.IsDir()
}
