package db_test

import (
	"path/filepath"
	"testing"

	"archivo-digital-inteligente/internal/localengine/db"
)

func TestOpenSQLiteDatabase(t *testing.T) {
	store, err := db.Open(filepath.Join(t.TempDir(), "archivo.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer store.Close()
	if err := store.Ping(); err != nil {
		t.Fatalf("ping db: %v", err)
	}
}
