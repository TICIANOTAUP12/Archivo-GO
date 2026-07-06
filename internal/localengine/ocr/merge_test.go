package ocr_test

import (
	"os"
	"path/filepath"
	"testing"

	"archivo-digital-inteligente/internal/localengine/ocr"
)

func TestShouldOCRPDF(t *testing.T) {
	if ocr.ShouldOCRPDF([]string{"texto nativo suficientemente largo para evitar OCR"}, false) {
		t.Fatalf("expected native PDF to skip OCR")
	}
	if !ocr.ShouldOCRPDF([]string{""}, true) {
		t.Fatalf("expected scanned PDF to require OCR")
	}
	if !ocr.ShouldOCRPDF([]string{"corto"}, false) {
		t.Fatalf("expected low-text PDF to require OCR")
	}
}

func TestMergePageTextsPrefersOCR(t *testing.T) {
	native := []string{"", "nativo"}
	ocrTexts := []string{"ocr pagina 1", ""}
	merged := ocr.MergePageTexts(native, ocrTexts)
	if merged[0] != "ocr pagina 1" {
		t.Fatalf("expected OCR text on page 1, got %q", merged[0])
	}
	if merged[1] != "nativo" {
		t.Fatalf("expected native fallback on page 2, got %q", merged[1])
	}
}

func TestFindRenderedPageImage(t *testing.T) {
	tempDir := t.TempDir()
	singleFile := filepath.Join(tempDir, "page-1.png")
	if err := os.WriteFile(singleFile, []byte("png"), 0o644); err != nil {
		t.Fatalf("write file: %v", err)
	}
	found, err := ocr.FindRenderedPageImageForTest(filepath.Join(tempDir, "page-1"))
	if err != nil {
		t.Fatalf("find image: %v", err)
	}
	if found != singleFile {
		t.Fatalf("expected %s, got %s", singleFile, found)
	}
}
