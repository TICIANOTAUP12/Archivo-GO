import { useServiceStatus } from '../../hooks/useServiceStatus';
import { useWorkspaceSettings } from '../../hooks/useWorkspaceSettings';
import type { WorkspaceSettings } from '../../api/native';

export function SettingsPanel() {
  const {
    settings,
    isSavingSettings,
    settingsMessage,
    settingsError,
    setDefaultProvider,
    setGoogleApiKey,
    setGoogleModel,
    setGoogleEmbeddingModel,
    setAnthropicApiKey,
    setAnthropicModel,
    setEmbeddingProvider,
    setEnableAnthropicFallback,
    setMinExtractionConfidence,
    setMaxRunBudgetUsd,
    persistSettings,
  } = useWorkspaceSettings();
  const { serviceStatus, isCheckingStatus, refreshServiceStatus } = useServiceStatus();

  return (
    <section className="panelStack">
      <div className="sectionHero">
        <p className="eyebrow">Configuración</p>
        <h1>Configuración de IA</h1>
        <p className="heroText">
          Definí las keys y modelos que auditan el texto extraído de PDFs e imágenes.
        </p>
      </div>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>Estado de servicios</h2>
            <p className="muted">
              {serviceStatus
                ? serviceStatus.message
                : 'Disponible dentro de la app de escritorio Wails.'}
            </p>
          </div>
          <button
            type="button"
            className="secondary compactButton"
            disabled={isCheckingStatus}
            onClick={() => void refreshServiceStatus()}
          >
            {isCheckingStatus ? 'Chequeando...' : 'Chequear'}
          </button>
        </div>
        <span className={serviceStatus?.backendReady ? 'statusBadge' : 'statusBadge warning'}>
          {serviceStatus?.backendReady ? 'Backend conectado' : 'Backend sin confirmar'}
        </span>
      </section>

      <section className="card settingsGrid">
        <div>
          <h2>Modelos y keys</h2>
          <p className="muted">
            Estos valores se guardan localmente y se pasan al backend cuando Wails reinicia los servicios.
          </p>
        </div>

        <label>
          Proveedor principal
          <select
            value={settings.defaultProvider}
            onChange={(event) => setDefaultProvider(parseDefaultProvider(event.target.value))}
          >
            <option value="google">Google Gemini</option>
            <option value="anthropic">Anthropic Claude</option>
            <option value="local">Local sin IA externa</option>
          </select>
        </label>

        <label>
          Modelo Google
          <input value={settings.googleModel} onChange={(event) => setGoogleModel(event.target.value)} />
        </label>

        <label>
          Modelo de embeddings
          <input
            value={settings.googleEmbeddingModel}
            onChange={(event) => setGoogleEmbeddingModel(event.target.value)}
          />
        </label>

        <label>
          Modelo Anthropic
          <input value={settings.anthropicModel} onChange={(event) => setAnthropicModel(event.target.value)} />
        </label>

        <label>
          Proveedor de embeddings
          <select
            value={settings.embeddingProvider}
            onChange={(event) => setEmbeddingProvider(parseEmbeddingProvider(event.target.value))}
          >
            <option value="local">Local</option>
            <option value="google">Google Gemini</option>
          </select>
        </label>

        <label>
          Google API Key
          <input
            type="password"
            value={settings.googleApiKey}
            onChange={(event) => setGoogleApiKey(event.target.value)}
            placeholder="Pegá la key de Google AI Studio"
            autoComplete="off"
          />
        </label>

        <label>
          Anthropic API Key fallback
          <input
            type="password"
            value={settings.anthropicApiKey}
            onChange={(event) => setAnthropicApiKey(event.target.value)}
            placeholder="Opcional para fallback"
            autoComplete="off"
          />
        </label>

        <label>
          Confianza mínima de extracción
          <input
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={settings.minExtractionConfidence}
            onChange={(event) => setMinExtractionConfidence(Number(event.target.value))}
          />
        </label>

        <label>
          Presupuesto máximo por corrida USD
          <input
            type="number"
            min={1}
            step={1}
            value={settings.maxRunBudgetUsd}
            onChange={(event) => setMaxRunBudgetUsd(Number(event.target.value))}
          />
        </label>

        <label className="checkboxLabel">
          <input
            type="checkbox"
            checked={settings.enableAnthropicFallback}
            onChange={(event) => setEnableAnthropicFallback(event.target.checked)}
          />
          Usar Anthropic como fallback
        </label>
      </section>

      {settingsError ? <section className="inlineError strong">{settingsError}</section> : null}
      {settingsMessage ? <section className="successMessage">{settingsMessage}</section> : null}
      <button
        type="button"
        disabled={isSavingSettings}
        onClick={() => void persistSettings()}
      >
        {isSavingSettings ? 'Guardando configuración...' : 'Guardar IA y reiniciar servicios'}
      </button>
    </section>
  );
}

function parseDefaultProvider(value: string): WorkspaceSettings['defaultProvider'] {
  if (value === 'anthropic' || value === 'local') return value;
  return 'google';
}

function parseEmbeddingProvider(value: string): WorkspaceSettings['embeddingProvider'] {
  return value === 'google' ? 'google' : 'local';
}
