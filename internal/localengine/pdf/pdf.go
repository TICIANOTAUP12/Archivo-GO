package pdf

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/ledongthuc/pdf"
)

func ExtractTextByPage(filePath string) (pages []string, err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			pages = nil
			err = fmt.Errorf("pdf reader crashed on %s: %v", filepath.Base(filePath), recovered)
		}
	}()
	return extractTextByPage(filePath)
}

func extractTextByPage(filePath string) ([]string, error) {
	file, reader, err := pdf.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("open pdf: %w", err)
	}
	defer file.Close()

	pageCount := reader.NumPage()
	if pageCount == 0 {
		return []string{""}, nil
	}
	pages := make([]string, 0, pageCount)
	for pageIndex := 1; pageIndex <= pageCount; pageIndex++ {
		page := reader.Page(pageIndex)
		if page.V.IsNull() {
			pages = append(pages, "")
			continue
		}
		text, err := page.GetPlainText(nil)
		if err != nil {
			pages = append(pages, "")
			continue
		}
		pages = append(pages, strings.TrimSpace(text))
	}
	return pages, nil
}

func InspectPDF(filePath string) (pageCount int, hasNativeText bool, err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			pageCount = 1
			hasNativeText = false
			err = fmt.Errorf("pdf inspect crashed on %s: %v", filepath.Base(filePath), recovered)
		}
	}()
	pages, extractErr := ExtractTextByPage(filePath)
	if extractErr != nil {
		return 0, false, extractErr
	}
	pageCount = len(pages)
	for _, pageText := range pages {
		if len(strings.TrimSpace(pageText)) >= 40 {
			hasNativeText = true
			break
		}
	}
	return pageCount, hasNativeText, nil
}

func FileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}
