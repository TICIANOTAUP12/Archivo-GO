package search

import (
	"context"
	"regexp"
	"strings"

	"archivo-digital-inteligente/internal/localengine/gateway"
	"archivo-digital-inteligente/internal/localengine/models"
	"archivo-digital-inteligente/internal/localengine/repository"
	"archivo-digital-inteligente/internal/localengine/settings"
)

type Service struct {
	repo         *repository.Repository
	loadSettings func() (settings.WorkspaceSettings, error)
}

func NewService(repo *repository.Repository, loadSettings func() (settings.WorkspaceSettings, error)) *Service {
	return &Service{repo: repo, loadSettings: loadSettings}
}

type parsedQuery struct {
	Query      string
	Patente    string
	NumeroCaso string
	Matricula  string
	Persona    string
}

func (service *Service) SearchDocuments(ctx context.Context, request models.SearchRequest) ([]models.SearchResult, error) {
	parsed := mergeRequestFilters(request)
	workspaceSettings, err := service.loadSettings()
	if err != nil {
		return nil, err
	}
	queryEmbedding := localHashEmbedding(parsed.Query)
	if workspaceSettings.GatewayURL != "" {
		client := gateway.NewClient(workspaceSettings)
		if embedding, embedErr := client.Embed(ctx, parsed.Query, workspaceSettings); embedErr == nil && len(embedding) > 0 {
			queryEmbedding = embedding
		}
	}
	limit := request.Limit
	if limit <= 0 {
		limit = 20
	}
	candidates, err := service.repo.SearchCandidates(sanitizeFTSQuery(parsed.Query), limit*5)
	if err != nil || len(candidates) == 0 {
		candidates, err = service.repo.ListAllPages(limit * 5)
		if err != nil {
			return nil, err
		}
	}
	results := make([]models.SearchResult, 0, limit)
	for _, candidate := range candidates {
		fields := repository.ParseFieldsJSON(candidate.FieldsJSON)
		score := scoreCandidate(parsed, fields, candidate, queryEmbedding)
		if score <= 0 {
			continue
		}
		matchKind := detectMatchKind(parsed, fields, candidate)
		var storagePath *string
		if candidate.StoragePath.Valid {
			value := candidate.StoragePath.String
			storagePath = &value
		}
		results = append(results, models.SearchResult{
			DocumentID: candidate.DocumentID,
			PageID:     candidate.PageID,
			Filename:   candidate.Filename,
			SourcePath: candidate.SourcePath,
			StoragePath: storagePath,
			PageNumber: candidate.PageNumber,
			Snippet:    repository.Snippet(candidate.TextContent, 420),
			Matricula:  fields.Matricula,
			Patente:    fields.Patente,
			NumeroCaso: fields.NumeroCaso,
			MatchKind:  &matchKind,
			Score:      score,
		})
	}
	sortResults(results)
	if len(results) > limit {
		results = results[:limit]
	}
	return results, nil
}

func mergeRequestFilters(request models.SearchRequest) parsedQuery {
	parsed := parseSearchQuery(request.Query)
	if request.Patente != nil {
		parsed.Patente = *request.Patente
	}
	if request.NumeroCaso != nil {
		parsed.NumeroCaso = *request.NumeroCaso
	}
	if request.Matricula != nil {
		parsed.Matricula = *request.Matricula
	}
	if request.Persona != nil {
		parsed.Persona = *request.Persona
	}
	return parsed
}

func parseSearchQuery(query string) parsedQuery {
	return parsedQuery{Query: strings.TrimSpace(query)}
}

func sanitizeFTSQuery(query string) string {
	parts := strings.Fields(query)
	if len(parts) == 0 {
		return query
	}
	escaped := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.ReplaceAll(part, `"`, "")
		if part != "" {
			escaped = append(escaped, part)
		}
	}
	return strings.Join(escaped, " OR ")
}

func scoreCandidate(parsed parsedQuery, fields models.ExtractedFields, candidate repository.PageCandidate, queryEmbedding []float64) float64 {
	text := strings.ToLower(candidate.TextContent + " " + candidate.Filename + " " + candidate.SourcePath)
	score := 0.0
	if parsed.Query != "" && strings.Contains(text, strings.ToLower(parsed.Query)) {
		score += 0.45
	}
	if len(candidate.Embedding) > 0 && len(queryEmbedding) > 0 {
		similarity := repository.CosineSimilarity(candidate.Embedding, queryEmbedding)
		score += similarity * 0.35
	}
	if parsed.Patente != "" && fieldMatches(fields.Patente, parsed.Patente, text) {
		score += 0.20
	} else if parsed.NumeroCaso != "" && fieldMatches(fields.NumeroCaso, parsed.NumeroCaso, text) {
		score += 0.20
	} else if parsed.Persona != "" && strings.Contains(text, strings.ToLower(parsed.Persona)) {
		score += 0.18
	} else if parsed.Matricula != "" && fieldMatches(fields.Matricula, parsed.Matricula, text) {
		score += 0.16
	}
	return score
}

func fieldMatches(value *string, filter, text string) bool {
	if value == nil {
		return strings.Contains(text, strings.ToLower(filter))
	}
	return strings.EqualFold(*value, filter) || strings.Contains(text, strings.ToLower(filter))
}

func detectMatchKind(parsed parsedQuery, fields models.ExtractedFields, candidate repository.PageCandidate) string {
	text := strings.ToLower(candidate.TextContent)
	if parsed.Patente != "" && fieldMatches(fields.Patente, parsed.Patente, text) {
		return "patente"
	}
	if parsed.NumeroCaso != "" && fieldMatches(fields.NumeroCaso, parsed.NumeroCaso, text) {
		return "tramite"
	}
	if parsed.Persona != "" && strings.Contains(text, strings.ToLower(parsed.Persona)) {
		return "persona"
	}
	if parsed.Matricula != "" && fieldMatches(fields.Matricula, parsed.Matricula, text) {
		return "matricula"
	}
	return "texto"
}

func sortResults(results []models.SearchResult) {
	for i := 0; i < len(results); i++ {
		for j := i + 1; j < len(results); j++ {
			if results[j].Score > results[i].Score {
				results[i], results[j] = results[j], results[i]
			}
		}
	}
}

func localHashEmbedding(text string) []float64 {
	buckets := make([]float64, 768)
	tokenPattern := regexp.MustCompile(`[\wáéíóúñÁÉÍÓÚÑ]+`)
	for _, token := range tokenPattern.FindAllString(strings.ToLower(text), -1) {
		hash := fnvHash(token)
		index := int(hash % 768)
		sign := 1.0
		if hash%2 == 0 {
			sign = -1
		}
		buckets[index] += sign
	}
	return normalizeVector(buckets)
}

func fnvHash(text string) uint32 {
	var hash uint32 = 2166136261
	for index := 0; index < len(text); index++ {
		hash ^= uint32(text[index])
		hash *= 16777619
	}
	return hash
}

func normalizeVector(values []float64) []float64 {
	var magnitude float64
	for _, value := range values {
		magnitude += value * value
	}
	if magnitude == 0 {
		return values
	}
	root := mathSqrt(magnitude)
	for index, value := range values {
		values[index] = value / root
	}
	return values
}

func mathSqrt(value float64) float64 {
	if value <= 0 {
		return 0
	}
	estimate := value
	for index := 0; index < 10; index++ {
		estimate = (estimate + value/estimate) / 2
	}
	return estimate
}
