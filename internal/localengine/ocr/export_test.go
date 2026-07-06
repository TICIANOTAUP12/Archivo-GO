package ocr

// FindRenderedPageImageForTest exposes render output discovery for unit tests.
func FindRenderedPageImageForTest(outputPrefix string) (string, error) {
	return findRenderedPageImageAt(outputPrefix)
}
