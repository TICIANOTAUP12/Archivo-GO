import { useState } from 'react';
import { testGatewayConnection } from '../../api/native';
import { useServiceStatus } from '../../hooks/useServiceStatus';
import { useWorkspaceSettings } from '../../hooks/useWorkspaceSettings';
import type { DeploymentMode, WorkspaceSettings } from '../../api/native';

export function SettingsPanel() {
  const {
    settings,
    isSavingSettings,
    settingsMessage,
    settingsError,
    setBackendUrl,
    setDeploymentMode,
    setGatewayUrl,
    setGatewayToken,
    setDefaultProvider,
    setGoogleApiKey,
    setGoogleModel,
    setGoogleEmbeddingModel,
    setAnthropicApiKey,
    setAnthropicModel,
    setOpenAIApiKey,
    setOpenAIModel,
    setOpenAIEmbeddingModel,
    setEmbeddingProvider,
    setEnableAnthropicFallback,
    setMinExtractionConfidence,
    setMaxRunBudgetUsd,
    persistSettings,
  } = useWorkspaceSettings();
  const { serviceStatus, isCheckingStatus, refreshServiceStatus } = useServiceStatus();
  const [gatewayTestMessage, setGatewayTestMessage] = useState<string | null>(null);
  const [isTestingGateway, setIsTestingGateway] = useState(false);
  const isLocalMode = settings.deploymentMode === 'local';

  async function handleTestGateway(): Promise<void> {
    setGatewayTestMessage(null);
    setIsTestingGateway(true);
    try {
      await persistSettings();
      await testGatewayConnection();
      setGatewayTestMessage('Gateway conectado correctamente.');
    } catch (error) {
      setGatewayTestMessage(error instanceof Error ? error.message : 'No se pudo conectar al gateway.');
    } finally {
      setIsTestingGateway(false);
    }
  }

  return (
    <section className="panelStack">
      <div className="sectionHero">
        <p className="eyebrow">Configuración</p>
        <h1>Conexión IA</h1>
        <p className="heroText">
          Keys, modelos, gateway y modo de despliegue. Las carpetas de origen y destino se configuran en Carga.
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
          {serviceStatus?.backendReady
            ? isLocalMode
              ? 'Motor local activo'
              : 'Backend conectado'
            : 'Backend sin confirmar'}
        </span>
      </section>

      <section className="card">
        <h2>Modo de despliegue</h2>
        <p className="muted">
          <strong>Docker</strong> para Win10/11 con Docker Desktop. <strong>Local</strong> para Win7: motor SQLite en
          esta PC + gateway IA remoto.
        </p>
        <label>
          Modo
          <select
            value={settings.deploymentMode}
            onChange={(event) => setDeploymentMode(parseDeploymentMode(event.target.value))}
          >
            <option value="docker">Docker + PostgreSQL (Win10/11)</option>
            <option value="local">Motor local SQLite (Win7)</option>
          </select>
        </label>
        <label>
          URL del backend local
          <input
            value={settings.backendUrl}
            onChange={(event) => setBackendUrl(event.target.value)}
            placeholder={isLocalMode ? 'http://127.0.0.1:8090' : 'http://localhost:8080'}
            autoComplete="off"
          />
        </label>
      </section>

      {isLocalMode ? (
        <section className="card">
          <h2>Gateway IA (VPS)</h2>
          <p className="muted">
            URL del servidor stateless que procesa texto con Gemini, ChatGPT o Claude. No guarda tus archivos.
          </p>
          <label>
            URL del gateway
            <input
              value={settings.gatewayUrl}
              onChange={(event) => setGatewayUrl(event.target.value)}
              placeholder="https://gateway.tudominio.com"
              autoComplete="off"
            />
          </label>
          <label>
            Token del gateway (opcional)
            <input
              type="password"
              value={settings.gatewayToken}
              onChange={(event) => setGatewayToken(event.target.value)}
              placeholder="X-Gateway-Token del VPS"
              autoComplete="off"
            />
          </label>
          <button type="button" className="secondary" disabled={isTestingGateway} onClick={() => void handleTestGateway()}>
            {isTestingGateway ? 'Probando gateway...' : 'Probar gateway'}
          </button>
          {gatewayTestMessage ? <p className="muted">{gatewayTestMessage}</p> : null}
        </section>
      ) : (
        <section className="card">
          <h2>Servidor backend Docker</h2>
          <p className="muted">
            URL del backend Docker. Ejemplo: <code>http://localhost:8080</code> o un servidor remoto con Docker.
          </p>
          <label>
            URL del backend
            <input
              value={settings.backendUrl}
              onChange={(event) => setBackendUrl(event.target.value)}
              placeholder="http://localhost:8080"
              autoComplete="off"
            />
          </label>
        </section>
      )}

      <section className="card settingsGrid">
        <div>
          <h2>Modelos y keys</h2>
          <p className="muted">Se guardan en esta PC. En modo local, Go las envía al gateway por cada página procesada.</p>
        </div>

        <label>
          Proveedor principal
          <select
            value={settings.defaultProvider}
            onChange={(event) => setDefaultProvider(parseDefaultProvider(event.target.value))}
          >
            <option value="google">Google Gemini</option>
            <option value="openai">OpenAI ChatGPT</option>
            <option value="anthropic">Anthropic Claude</option>
            <option value="local">Local sin IA externa</option>
          </select>
        </label>

        <label>
          Modelo Google
          <input value={settings.googleModel} onChange={(event) => setGoogleModel(event.target.value)} />
        </label>

        <label>
          Modelo embeddings Google
          <input
            value={settings.googleEmbeddingModel}
            onChange={(event) => setGoogleEmbeddingModel(event.target.value)}
          />
        </label>

        <label>
          Modelo OpenAI
          <input value={settings.openaiModel} onChange={(event) => setOpenAIModel(event.target.value)} />
        </label>

        <label>
          Modelo embeddings OpenAI
          <input value={settings.openaiEmbeddingModel} onChange={(event) => setOpenAIEmbeddingModel(event.target.value)} />
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
            <option value="openai">OpenAI</option>
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
          OpenAI API Key
          <input
            type="password"
            value={settings.openaiApiKey}
            onChange={(event) => setOpenAIApiKey(event.target.value)}
            placeholder="sk-..."
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
      <button type="button" disabled={isSavingSettings} onClick={() => void persistSettings()}>
        {isSavingSettings ? 'Guardando configuración...' : 'Guardar IA y reiniciar servicios'}
      </button>
    </section>
  );
}

function parseDeploymentMode(value: string): DeploymentMode {
  return value === 'local' ? 'local' : 'docker';
}

function parseDefaultProvider(value: string): WorkspaceSettings['defaultProvider'] {
  if (value === 'anthropic' || value === 'local' || value === 'openai') return value;
  return 'google';
}

function parseEmbeddingProvider(value: string): WorkspaceSettings['embeddingProvider'] {
  if (value === 'google' || value === 'openai') return value;
  return 'local';
}
