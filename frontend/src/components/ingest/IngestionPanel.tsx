import { useState, type FormEvent } from 'react';
import { useIngest } from '../../hooks/useIngest';
import { useWorkspaceSettings } from '../../hooks/useWorkspaceSettings';
import { FolderPathPicker } from '../settings/FolderPathPicker';
import { AuditSummary } from './AuditSummary';
import { ProgressUpload } from './ProgressUpload';

type IngestionPanelProps = {
  isBackendReady: boolean;
  onIngestComplete: () => Promise<void>;
};

const processSteps = [
  'Examinar... → elegí carpeta de origen y de destino.',
  'Guardá las carpetas.',
  'Tocá Procesar carpeta con IA para analizar, extraer datos y organizar el archivo.',
];

function processingLabel(phase: 'auditing' | 'ingesting'): string {
  if (phase === 'auditing') {
    return 'Paso 1/2: analizando archivos, páginas y costo estimado...';
  }
  return 'Paso 2/2: procesando con OCR, IA y organizando copias indexadas...';
}

export function IngestionPanel({ isBackendReady, onIngestComplete }: IngestionPanelProps) {
  const [sampleLimit, setSampleLimit] = useState<number>(500);
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
  } = useWorkspaceSettings();
  const hasSourcePath = settings.inputPath.trim().length > 0;
  const hasStoragePath = settings.storagePath.trim().length > 0;
  const canConfigure = hasSourcePath && hasStoragePath && !isSavingSettings;
  const canProcess = canConfigure && isBackendReady && !isProcessing;

  async function handleStartProcessing(): Promise<void> {
    if (!canConfigure) return;
    await persistSettings();
    await performFullProcessing(settings.inputPath, sampleLimit);
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
        {!isBackendReady ? (
          <p className="inlineHint warningHint">
            Para procesar hace falta el backend con Docker (Windows 10/11). En Windows 7 esta PC solo corre la interfaz.
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
          Muestra para estimar costo (solo auditoría)
          <input
            type="number"
            min={1}
            max={10000}
            value={sampleLimit}
            disabled={isProcessing}
            onChange={(event) => setSampleLimit(Number(event.target.value))}
          />
        </label>
        <button type="submit" className="ghostButton" disabled={isAuditing || !canProcess}>
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
