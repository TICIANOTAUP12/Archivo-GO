package ocr

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type Engine struct {
	tesseractPath string
	tessdataPrefix string
}

func NewEngine(appRoot string) Engine {
	tesseractPath := filepath.Join(appRoot, "tesseract", "tesseract.exe")
	if _, err := os.Stat(tesseractPath); err != nil {
		tesseractPath = "tesseract"
	}
	return Engine{
		tesseractPath: tesseractPath,
		tessdataPrefix: filepath.Join(appRoot, "tesseract", "tessdata"),
	}
}

func (engine Engine) Available() bool {
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
	// Without poppler on Win7 bundle, OCR single-page images only; PDF OCR falls back per page via empty -> caller merges native text.
	results := make([]string, pageCount)
	for index := range results {
		results[index] = ""
	}
	return results, nil
}
