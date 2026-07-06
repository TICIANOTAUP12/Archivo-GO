package inventory_test

import (
	"os"
	"path/filepath"
	"testing"

	"archivo-digital-inteligente/internal/localengine/inventory"
)

func TestAuditSourceEmptyDirectory(t *testing.T) {
	tempDir := t.TempDir()
	audit, err := inventory.AuditSource(tempDir, 10)
	if err != nil {
		t.Fatalf("audit failed: %v", err)
	}
	if audit.TotalFiles != 0 {
		t.Fatalf("expected 0 files, got %d", audit.TotalFiles)
	}
}

func TestAuditSourceWithPDFPlaceholder(t *testing.T) {
	tempDir := t.TempDir()
	filePath := filepath.Join(tempDir, "sample.txt")
	if err := os.WriteFile(filePath, []byte("patente XLF030"), 0o644); err != nil {
		t.Fatalf("write file: %v", err)
	}
	// txt not supported - should still return 0 files
	audit, err := inventory.AuditSource(tempDir, 10)
	if err != nil {
		t.Fatalf("audit failed: %v", err)
	}
	if audit.TotalFiles != 0 {
		t.Fatalf("expected unsupported file to be ignored")
	}
}
