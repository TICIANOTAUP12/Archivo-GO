import { useEffect, useState, type FormEvent } from 'react';
import { useIngest } from '../../hooks/useIngest';
import { useWorkspaceSettings } from '../../hooks/useWorkspaceSettings';
import { getWorkspaceSettings } from '../../api/native';
import type { WorkspaceSettings } from '../../api/native';
import { FolderPathPicker } from '../settings/FolderPathPicker';
import { AuditSummary } from './AuditSummary';
import { ProgressUpload } from './ProgressUpload';

type IngestionPanelProps = {
  isBackendReady: boolean;
  onIngestComplete: () => Promise<void>;
  onRetryBackend?: () => Promise<void>;
};

const processSteps = [
  'Examinar... → elegí carpeta de origen y de destino.',
  'Guardá las carpetas.',
  'En IA: modo local + Gateway URL + API key + Guardar configuración.',
  'Tocá Procesar carpeta con IA para analizar, extraer datos y organizar el archivo.',
];

function processingLabel(phase: 'auditing' | 'ingesting'): string {
  if (phase === 'auditing') {
    return 'Paso 1/2: analizando archivos, páginas y costo estimado...';
  }
  return 'Paso 2/2: procesando con OCR, IA y organizando copias indexadas...';
}

function resolveProcessBlockReason(input: {
  hasSourcePath: boolean;
  hasStoragePath: boolean;
  isBackendReady: boolean;
  deploymentMode: string;
  gatewayUrl: string;
  settings: WorkspaceSettings;
}): string | null {
  if (!input.hasSourcePath) {
    return 'Elegí la carpeta de origen con Examinar...';
  }
  if (!input.hasStoragePath) {
    return 'Elegí la carpeta de destino con Examinar...';
  }
  if (input.deploymentMode !== 'local') {
    return 'En IA elegí Modo "Motor local SQLite (Win7)" y tocá Guardar configuración.';
  }
  if (!input.isBackendReady) {
    return 'Motor local no conectado. Guardá en IA y tocá Reintentar conexión arriba.';
  }
  if (!input.gatewayUrl.trim()) {
    return 'Falta Gateway URL en IA (campo "URL del gateway", no "URL del backend"). Guardá configuración.';
  }
  if (!input.settings.gatewayToken.trim()) {
    return 'Falta el token del gateway en IA. Copiá el token completo y Guardá configuración.';
  }
  if (input.settings.defaultProvider === 'anthropic' && !input.settings.anthropicApiKey.trim()) {
    return 'Falta la API key de Anthropic Claude en IA → Guardar configuración.';
  }
  if (input.settings.defaultProvider === 'google' && !input.settings.googleApiKey.trim()) {
    return 'Falta la API key de Google en IA → Guardar configuración.';
  }
  if (input.settings.defaultProvider === 'openai' && !input.settings.openaiApiKey.trim()) {
    return 'Falta la API key de OpenAI en IA → Guardar configuración.';
  }
  return null;
}

function maskGatewayUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return 'no configurada';
  return trimmed;
}

export function IngestionPanel({ isBackendReady, onIngestComplete, onRetryBackend }: IngestionPanelProps) {
  const [sampleLimit, setSampleLimit] = useState<number>(25);
  const [savedGatewayUrl, setSavedGatewayUrl] = useState<string>('');
  const [savedGatewayToken, setSavedGatewayToken] = useState<string>('');
  const {
    audit,
    ingest,
    isAuditing,
    isIngesting,
    isProcessing,
    processingPhase,
    error,
    performAudit,
    performFullProcessing,
  } = useIngest(onIngestComplete);
  const {
    settings,
    isSavingSettings,
    settingsMessage,
    settingsError,
    setInputPath,
    setStoragePath,
    selectInputPath,
    selectStoragePath,
    persistSettings,
    reloadSettings,
  } = useWorkspaceSettings();

  useEffect(() => {
    void reloadSettings().then(async () => {
      const latest = await getWorkspaceSettings().catch(() => null);
      setSavedGatewayUrl(latest?.gatewayUrl?.trim() ?? '');
      setSavedGatewayToken(latest?.gatewayToken?.trim() ?? '');
    });
  }, [reloadSettings]);

  const effectiveGatewayUrl = savedGatewayUrl || settings.gatewayUrl;
  const effectiveGatewayToken = savedGatewayToken || settings.gatewayToken;
  const hasGatewayToken = effectiveGatewayToken.trim().length > 0;
  const hasSourcePath = settings.inputPath.trim().length > 0;
  const hasStoragePath = settings.storagePath.trim().length > 0;
  const canConfigure = hasSourcePath && hasStoragePath && !isSavingSettings;
  const canAudit = canConfigure && isBackendReady && !isProcessing;
  const canProcess =
    canAudit &&
    effectiveGatewayUrl.trim().length > 0 &&
    effectiveGatewayToken.trim().length > 0;
  const processBlockReason = resolveProcessBlockReason({
    hasSourcePath,
    hasStoragePath,
    isBackendReady,
    deploymentMode: settings.deploymentMode,
    gatewayUrl: effectiveGatewayUrl,
    settings,
  });

  async function handleStartProcessing(): Promise<void> {
    if (!canConfigure) return;
    await reloadSettings();
    const latest = await getWorkspaceSettings().catch(() => null);
    if (latest) {
      setSavedGatewayUrl(latest.gatewayUrl?.trim() ?? '');
    }
    await persistSettings();
    await onRetryBackend?.();
    const gatewayUrl = latest?.gatewayUrl?.trim() ?? '';
    if (!gatewayUrl) {
      return;
    }
    await performFullProcessing(latest?.inputPath?.trim() || settings.inputPath, sampleLimit);
  }

  function handleAuditOnly(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void performAudit(settings.inputPath, sampleLimit);
  }

  return (
    <section className="card">
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">Carga documental</p>
          <h2>Procesar archivo con IA</h2>
        </div>
      </div>

      <section className="processGuide">
        <h3>Pasos del proceso</h3>
        <ol>
          {processSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="inlineHint">
          Gateway IA guardado: <strong>{maskGatewayUrl(effectiveGatewayUrl)}</strong>
          {hasGatewayToken ? ' · Token: configurado' : ' · Token: falta en IA'}
          {settings.deploymentMode === 'local' && effectiveGatewayUrl ? ' · Modo local activo' : null}
        </p>
      </section>

      {error ? <section className="inlineError strong">{error}</section> : null}
      {settingsError ? <section className="inlineError strong">{settingsError}</section> : null}
      {settingsMessage ? <p className="successMessage">{settingsMessage}</p> : null}

      <div className="pathPickerGrid">
        <FolderPathPicker
          label="Carpeta de origen (documentos a procesar)"
          hint="PDFs e imágenes que querés analizar e indexar."
          value={settings.inputPath}
          placeholder="Ej. C:\ARCHIVOS_GO\ENARGAS"
          disabled={isSavingSettings || isProcessing}
          onChange={setInputPath}
          onBrowse={() => void selectInputPath()}
        />
        <FolderPathPicker
          label="Carpeta de destino (copias organizadas)"
          hint="Donde se guardan los casos procesados en esta PC."
          value={settings.storagePath}
          placeholder="Ej. C:\ARCHIVOS_GO\storage"
          disabled={isSavingSettings || isProcessing}
          onChange={setStoragePath}
          onBrowse={() => void selectStoragePath()}
        />
      </div>

      <button
        type="button"
        className="secondary"
        disabled={!canConfigure || isProcessing}
        onClick={() => void persistSettings()}
      >
        {isSavingSettings ? 'Guardando carpetas...' : 'Guardar carpetas'}
      </button>

      <section className="primaryActionCard">
        <div>
          <h3>Archivado inteligente</h3>
          <p className="muted">
            Analiza la carpeta, lee PDFs e imágenes con OCR, extrae patentes/trámites/matriculas con IA,
            organiza copias en destino e indexa todo para buscar desde el Buscador.
          </p>
        </div>
        <button
          type="button"
          className="primaryActionButton"
          disabled={!canProcess}
          onClick={() => void handleStartProcessing()}
        >
          {isProcessing
            ? processingPhase === 'auditing'
              ? 'Analizando carpeta...'
              : 'Procesando con IA...'
            : 'Procesar carpeta con IA'}
        </button>
        {!canProcess && processBlockReason ? (
          <p className="inlineHint warningHint">{processBlockReason}</p>
        ) : null}
        {!isBackendReady && canConfigure && settings.deploymentMode !== 'local' ? (
          <p className="inlineHint warningHint">
            Para procesar activá modo local en IA, configurá gateway URL + API key, y guardá.
          </p>
        ) : null}
        {!canConfigure ? (
          <p className="inlineHint">Elegí y guardá ambas carpetas para habilitar el procesamiento.</p>
        ) : null}
      </section>

      {isAuditing ? <ProgressUpload label={processingLabel('auditing')} /> : null}
      {isIngesting ? <ProgressUpload label={processingLabel('ingesting')} /> : null}
      {audit ? <AuditSummary audit={audit} /> : null}

      <form className="optionalAuditForm" onSubmit={handleAuditOnly}>
        <label>
          Muestra para estimar costo (Win7: dejar en 25 o menos)
          <input
            type="number"
            min={1}
            max={200}
            value={sampleLimit}
            disabled={isProcessing}
            onChange={(event) => setSampleLimit(Number(event.target.value))}
          />
        </label>
        <button type="submit" className="ghostButton" disabled={isAuditing || !canAudit}>
          {isAuditing ? 'Auditando...' : 'Solo auditar costo (sin procesar)'}
        </button>
      </form>

      {ingest ? (
        <p className="successMessage">
          Procesamiento iniciado: corrida {ingest.run_id} con {ingest.queued_documents} documentos en cola.
          Revisá el avance en Documentos o en la lista de recientes.
        </p>
      ) : null}
    </section>
  );
}
