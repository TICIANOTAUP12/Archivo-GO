package ocr

import "strings"

func MergePageTexts(nativeTexts []string, ocrTexts []string) []string {
	if len(nativeTexts) == 0 {
		return ocrTexts
	}
	merged := make([]string, len(nativeTexts))
	for index := range nativeTexts {
		ocrText := ""
		if index < len(ocrTexts) {
			ocrText = strings.TrimSpace(ocrTexts[index])
		}
		if ocrText != "" {
			merged[index] = ocrText
			continue
		}
		merged[index] = nativeTexts[index]
	}
	return merged
}

func ShouldOCRPDF(nativeTexts []string, isProbablyScanned bool) bool {
	if isProbablyScanned {
		return true
	}
	for _, text := range nativeTexts {
		if len(strings.TrimSpace(text)) >= 40 {
			return false
		}
	}
	return true
}
