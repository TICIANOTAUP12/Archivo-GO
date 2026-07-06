package main

import (
	_ "embed"
	"os"
	"path/filepath"
)

//go:embed docs/manual-de-uso.html
var embeddedHelpManual []byte

func resolveHelpManualPath() (string, error) {
	root, err := appRootDir()
	if err == nil {
		candidates := []string{
			filepath.Join(root, "manual-de-uso.html"),
			filepath.Join(root, "docs", "manual-de-uso.html"),
		}
		for _, candidate := range candidates {
			if fileExists(candidate) {
				return candidate, nil
			}
		}
	}

	cacheDir, err := os.UserCacheDir()
	if err != nil {
		return "", err
	}
	manualDir := filepath.Join(cacheDir, "ArchivoScivoliGNC")
	if err := os.MkdirAll(manualDir, 0o755); err != nil {
		return "", err
	}
	path := filepath.Join(manualDir, "manual-de-uso.html")
	if err := os.WriteFile(path, embeddedHelpManual, 0o644); err != nil {
		return "", err
	}
	return path, nil
}
