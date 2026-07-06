package ocr

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

const defaultRenderDPI = "220"

func (engine Engine) PopplerAvailable() bool {
	if strings.TrimSpace(engine.pdftoppmPath) == "" {
		return false
	}
	command := exec.Command(engine.pdftoppmPath, "-v")
	command.Env = engine.popplerEnv()
	return command.Run() == nil
}

func (engine Engine) renderPDFPage(pdfPath string, pageNumber int, outputPrefix string) error {
	if pageNumber < 1 {
		return fmt.Errorf("page number must be positive")
	}
	page := strconv.Itoa(pageNumber)
	command := exec.Command(
		engine.pdftoppmPath,
		"-png",
		"-r", defaultRenderDPI,
		"-f", page,
		"-l", page,
		"-singlefile",
		pdfPath,
		outputPrefix,
	)
	command.Env = engine.popplerEnv()
	_, err := command.CombinedOutput()
	if err != nil {
		return engine.renderPDFPageLegacy(pdfPath, pageNumber, outputPrefix, page)
	}
	if _, statErr := findRenderedPageImageAt(outputPrefix); statErr != nil {
		return engine.renderPDFPageLegacy(pdfPath, pageNumber, outputPrefix, page)
	}
	return nil
}

func (engine Engine) renderPDFPageLegacy(pdfPath string, pageNumber int, outputPrefix, page string) error {
	command := exec.Command(
		engine.pdftoppmPath,
		"-png",
		"-r", defaultRenderDPI,
		"-f", page,
		"-l", page,
		pdfPath,
		outputPrefix,
	)
	command.Env = engine.popplerEnv()
	output, err := command.CombinedOutput()
	if err != nil {
		return fmt.Errorf("pdftoppm page %d failed: %w: %s", pageNumber, err, strings.TrimSpace(string(output)))
	}
	return nil
}

func findRenderedPageImage(outputPrefix string) (string, error) {
	return findRenderedPageImageAt(outputPrefix)
}

func findRenderedPageImageAt(outputPrefix string) (string, error) {
	candidates := []string{
		outputPrefix + ".png",
		outputPrefix + "-1.png",
	}
	for _, candidate := range candidates {
		if fileExists(candidate) {
			return candidate, nil
		}
	}
	matches, err := filepath.Glob(outputPrefix + "-*.png")
	if err != nil {
		return "", err
	}
	for _, match := range matches {
		if fileExists(match) {
			return match, nil
		}
	}
	return "", fmt.Errorf("rendered page image not found for prefix %s", outputPrefix)
}

func (engine Engine) popplerEnv() []string {
	env := os.Environ()
	popplerDir := filepath.Dir(engine.pdftoppmPath)
	if popplerDir != "" && popplerDir != "." {
		pathValue := popplerDir
		for _, entry := range env {
			if strings.HasPrefix(strings.ToUpper(entry), "PATH=") {
				pathValue = popplerDir + string(os.PathListSeparator) + entry[len("PATH="):]
				break
			}
		}
		env = append(env, "PATH="+pathValue)
	}
	return env
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}
