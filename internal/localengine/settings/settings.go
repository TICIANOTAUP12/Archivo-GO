package settings

type WorkspaceSettings struct {
	BackendURL                string  `json:"backendUrl"`
	GatewayURL                string  `json:"gatewayUrl"`
	GatewayToken              string  `json:"gatewayToken"`
	DeploymentMode            string  `json:"deploymentMode"`
	InputPath                 string  `json:"inputPath"`
	StoragePath               string  `json:"storagePath"`
	DefaultProvider           string  `json:"defaultProvider"`
	GoogleAPIKey              string  `json:"googleApiKey"`
	GoogleModel               string  `json:"googleModel"`
	GoogleEmbeddingModel      string  `json:"googleEmbeddingModel"`
	AnthropicAPIKey           string  `json:"anthropicApiKey"`
	AnthropicModel            string  `json:"anthropicModel"`
	OpenAIAPIKey              string  `json:"openaiApiKey"`
	OpenAIModel               string  `json:"openaiModel"`
	OpenAIEmbeddingModel      string  `json:"openaiEmbeddingModel"`
	EmbeddingProvider         string  `json:"embeddingProvider"`
	EnableAnthropicFallback   bool    `json:"enableAnthropicFallback"`
	MinExtractionConfidence   float64 `json:"minExtractionConfidence"`
	MaxRunBudgetUSD           float64 `json:"maxRunBudgetUsd"`
	LocalEngineListenAddress  string  `json:"localEngineListenAddress"`
}

func (settings WorkspaceSettings) ResolveExtractionAPIKey() string {
	switch settings.DefaultProvider {
	case "google":
		return settings.GoogleAPIKey
	case "anthropic":
		return settings.AnthropicAPIKey
	case "openai":
		return settings.OpenAIAPIKey
	default:
		return ""
	}
}

func (settings WorkspaceSettings) ResolveExtractionModel() string {
	switch settings.DefaultProvider {
	case "google":
		if settings.GoogleModel != "" {
			return settings.GoogleModel
		}
		return "gemini-2.5-flash"
	case "anthropic":
		if settings.AnthropicModel != "" {
			return settings.AnthropicModel
		}
		return "claude-haiku-4-5"
	case "openai":
		if settings.OpenAIModel != "" {
			return settings.OpenAIModel
		}
		return "gpt-4o-mini"
	default:
		return ""
	}
}

func (settings WorkspaceSettings) ResolveEmbeddingAPIKey() string {
	switch settings.EmbeddingProvider {
	case "google":
		return settings.GoogleAPIKey
	case "openai":
		return settings.OpenAIAPIKey
	default:
		return ""
	}
}

func (settings WorkspaceSettings) ResolveEmbeddingModel() string {
	switch settings.EmbeddingProvider {
	case "google":
		if settings.GoogleEmbeddingModel != "" {
			return settings.GoogleEmbeddingModel
		}
		return "gemini-embedding-001"
	case "openai":
		if settings.OpenAIEmbeddingModel != "" {
			return settings.OpenAIEmbeddingModel
		}
		return "text-embedding-3-small"
	default:
		return ""
	}
}
