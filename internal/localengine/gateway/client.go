package gateway

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"archivo-digital-inteligente/internal/localengine/models"
	"archivo-digital-inteligente/internal/localengine/settings"
)

type Client struct {
	baseURL string
	token   string
	http    *http.Client
}

func NewClient(settings settings.WorkspaceSettings) *Client {
	baseURL := strings.TrimRight(strings.TrimSpace(settings.GatewayURL), "/")
	return &Client{
		baseURL: baseURL,
		token:   strings.TrimSpace(settings.GatewayToken),
		http: &http.Client{
			Timeout: 120 * time.Second,
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{
					MinVersion: tls.VersionTLS12,
				},
			},
		},
	}
}

type processPageRequest struct {
	Text                     string  `json:"text"`
	Provider                 string  `json:"provider"`
	APIKey                   string  `json:"api_key,omitempty"`
	Model                    string  `json:"model,omitempty"`
	EmbeddingProvider        string  `json:"embedding_provider"`
	EmbeddingModel           string  `json:"embedding_model,omitempty"`
	EnableAnthropicFallback  bool    `json:"enable_anthropic_fallback"`
	AnthropicAPIKey          string  `json:"anthropic_api_key,omitempty"`
	AnthropicModel           string  `json:"anthropic_model,omitempty"`
	MinExtractionConfidence  float64 `json:"min_extraction_confidence"`
}

func (client *Client) ProcessPage(ctx context.Context, text string, settings settings.WorkspaceSettings) (models.ProcessPageResponse, error) {
	if client.baseURL == "" {
		return models.ProcessPageResponse{}, fmt.Errorf("gateway URL is not configured")
	}
	payload := processPageRequest{
		Text:                    text,
		Provider:                settings.DefaultProvider,
		APIKey:                  settings.ResolveExtractionAPIKey(),
		Model:                   settings.ResolveExtractionModel(),
		EmbeddingProvider:       settings.EmbeddingProvider,
		EmbeddingModel:          settings.ResolveEmbeddingModel(),
		EnableAnthropicFallback: settings.EnableAnthropicFallback,
		AnthropicAPIKey:         settings.AnthropicAPIKey,
		AnthropicModel:          settings.AnthropicModel,
		MinExtractionConfidence: settings.MinExtractionConfidence,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return models.ProcessPageResponse{}, err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, client.baseURL+"/v1/process-page", bytes.NewReader(body))
	if err != nil {
		return models.ProcessPageResponse{}, err
	}
	request.Header.Set("Content-Type", "application/json")
	if client.token != "" {
		request.Header.Set("X-Gateway-Token", client.token)
	}
	response, err := client.http.Do(request)
	if err != nil {
		return models.ProcessPageResponse{}, err
	}
	defer response.Body.Close()
	responseBody, err := io.ReadAll(response.Body)
	if err != nil {
		return models.ProcessPageResponse{}, err
	}
	if response.StatusCode >= 300 {
		return models.ProcessPageResponse{}, fmt.Errorf("gateway status %d: %s", response.StatusCode, string(responseBody))
	}
	var parsed models.ProcessPageResponse
	if err := json.Unmarshal(responseBody, &parsed); err != nil {
		return models.ProcessPageResponse{}, err
	}
	return parsed, nil
}

type embedRequest struct {
	Text     string `json:"text"`
	Provider string `json:"provider"`
	APIKey   string `json:"api_key,omitempty"`
	Model    string `json:"model,omitempty"`
}

type embedResponse struct {
	Embedding  []float64          `json:"embedding"`
	TokenUsage models.TokenUsage  `json:"token_usage"`
	CostUSD    float64            `json:"cost_usd"`
}

func (client *Client) Embed(ctx context.Context, text string, settings settings.WorkspaceSettings) ([]float64, error) {
	if client.baseURL == "" {
		return nil, fmt.Errorf("gateway URL is not configured")
	}
	payload := embedRequest{
		Text:     text,
		Provider: settings.EmbeddingProvider,
		APIKey:   settings.ResolveEmbeddingAPIKey(),
		Model:    settings.ResolveEmbeddingModel(),
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, client.baseURL+"/v1/embed", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	request.Header.Set("Content-Type", "application/json")
	if client.token != "" {
		request.Header.Set("X-Gateway-Token", client.token)
	}
	response, err := client.http.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	responseBody, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, err
	}
	if response.StatusCode >= 300 {
		return nil, fmt.Errorf("gateway embed status %d: %s", response.StatusCode, string(responseBody))
	}
	var parsed embedResponse
	if err := json.Unmarshal(responseBody, &parsed); err != nil {
		return nil, err
	}
	return parsed.Embedding, nil
}

func (client *Client) Health(ctx context.Context) error {
	if client.baseURL == "" {
		return fmt.Errorf("gateway URL is not configured")
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, client.baseURL+"/health", nil)
	if err != nil {
		return err
	}
	if client.token != "" {
		request.Header.Set("X-Gateway-Token", client.token)
	}
	response, err := client.http.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode >= 300 {
		return fmt.Errorf("gateway health status %d", response.StatusCode)
	}
	return nil
}
