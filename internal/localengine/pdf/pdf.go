package pdf

import (
	"fmt"
	"os"
	"strings"

	"github.com/ledongthuc/pdf"
)

func ExtractTextByPage(filePath string) ([]string, error) {
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
	pages, err := ExtractTextByPage(filePath)
	if err != nil {
		return 0, false, err
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
