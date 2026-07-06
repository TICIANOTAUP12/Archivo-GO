package ocr

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type Engine struct {
	tesseractPath  string
	tessdataPrefix string
	pdftoppmPath   string
}

func NewEngine(appRoot string) Engine {
	tesseractPath := filepath.Join(appRoot, "tesseract", "tesseract.exe")
	if _, err := os.Stat(tesseractPath); err != nil {
		tesseractPath = "tesseract"
	}
	pdftoppmPath := filepath.Join(appRoot, "poppler", "pdftoppm.exe")
	if _, err := os.Stat(pdftoppmPath); err != nil {
		pdftoppmPath = "pdftoppm"
	}
	return Engine{
		tesseractPath:  tesseractPath,
		tessdataPrefix: filepath.Join(appRoot, "tesseract", "tessdata"),
		pdftoppmPath:   pdftoppmPath,
	}
}

func (engine Engine) Available() bool {
	return engine.TesseractAvailable()
}

func (engine Engine) TesseractAvailable() bool {
	command := exec.Command(engine.tesseractPath, "--version")
	return command.Run() == nil
}

func (engine Engine) OCRImage(imagePath string) (string, error) {
	args := []string{imagePath, "stdout", "-l", "spa+eng"}
	command := exec.Command(engine.tesseractPath, args...)
	command.Env = append(os.Environ(), "TESSDATA_PREFIX="+engine.tessdataPrefix)
	output, err := command.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("tesseract failed: %w: %s", err, string(output))
	}
	return strings.TrimSpace(string(output)), nil
}

func (engine Engine) OCRPDFPages(pdfPath string, pageCount int) ([]string, error) {
	if pageCount < 1 {
		return nil, fmt.Errorf("pageCount must be positive")
	}
	if !engine.TesseractAvailable() {
		return nil, fmt.Errorf("tesseract not available")
	}
	if !engine.PopplerAvailable() {
		return nil, fmt.Errorf("poppler pdftoppm not available")
	}

	tempDir, err := os.MkdirTemp("", "archivo-pdf-ocr-")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(tempDir)

	results := make([]string, pageCount)
	for pageNumber := 1; pageNumber <= pageCount; pageNumber++ {
		outputPrefix := filepath.Join(tempDir, fmt.Sprintf("page-%d", pageNumber))
		if err := engine.renderPDFPage(pdfPath, pageNumber, outputPrefix); err != nil {
			results[pageNumber-1] = ""
			continue
		}
		imagePath, err := findRenderedPageImage(outputPrefix)
		if err != nil {
			results[pageNumber-1] = ""
			continue
		}
		text, err := engine.OCRImage(imagePath)
		_ = os.Remove(imagePath)
		if err != nil {
			results[pageNumber-1] = ""
			continue
		}
		results[pageNumber-1] = text
	}
	return results, nil
}
