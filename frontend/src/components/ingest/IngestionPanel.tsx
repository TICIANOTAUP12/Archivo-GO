import { useState, type FormEvent } from 'react';
import { useIngest } from '../../hooks/useIngest';
import { useWorkspaceSettings } from '../../hooks/useWorkspaceSettings';
import { AuditSummary } from './AuditSummary';
import { ProgressUpload } from './ProgressUpload';

type IngestionPanelProps = {
  isBackendReady: boolean;
  onIngestComplete: () => Promise<void>;
};

export function IngestionPanel({ isBackendReady, onIngestComplete }: IngestionPanelProps) {
  const [sampleLimit, setSampleLimit] = useState<number>(500);
  const { audit, ingest, isAuditing, isIngesting, error, performAudit, performIngest } =
    useIngest(onIngestComplete);
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
  const canRun = isBackendReady && hasSourcePath && hasStoragePath && !isSavingSettings;

  function handleAudit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void performAudit(settings.inputPath, sampleLimit);
  }

  return (
    <section className="card">
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">Carga documental</p>
          <h2>Auditoría e ingesta</h2>
        </div>
      </div>

      {error ? <section className="inlineError strong">{error}</section> : null}
      {!isBackendReady ? <section className="inlineError strong">Backend desconectado. Iniciá los servicios antes de auditar o ingestar.</section> : null}
      {settingsError ? <section className="inlineError strong">{settingsError}</section> : null}
      {settingsMessage ? <p className="successMessage">{settingsMessage}</p> : null}

      <form onSubmit={handleAudit}>
        <div className="pathPickerGrid">
          <label>
            De dónde tomar documentos
            <div className="pathPicker">
              <input
                value={settings.inputPath}
                onChange={(event) => setInputPath(event.target.value)}
                placeholder="Seleccioná la carpeta de PDFs e imágenes"
                required
              />
              <button type="button" className="secondary compactButton" onClick={() => void selectInputPath()}>
                Seleccionar
              </button>
            </div>
          </label>
          <label>
            Dónde guardar casos procesados
            <div className="pathPicker">
              <input
                value={settings.storagePath}
                onChange={(event) => setStoragePath(event.target.value)}
                placeholder="Seleccioná la carpeta destino del archivo digital"
                required
              />
              <button type="button" className="secondary compactButton" onClick={() => void selectStoragePath()}>
                Seleccionar
              </button>
            </div>
          </label>
        </div>

        <button
          type="button"
          className="secondary"
          disabled={!hasSourcePath || !hasStoragePath || isSavingSettings}
          onClick={() => void persistSettings()}
        >
          {isSavingSettings ? 'Guardando carpetas...' : 'Guardar carpetas de esta PC'}
        </button>
        <label>
          Muestra
          <input
            type="number"
            min={1}
            max={10000}
            value={sampleLimit}
            onChange={(event) => setSampleLimit(Number(event.target.value))}
          />
        </label>
        <button disabled={isAuditing || !canRun}>{isAuditing ? 'Auditando...' : 'Auditar costo'}</button>
      </form>

      {isAuditing ? <ProgressUpload label="Revisando archivos y páginas estimadas" /> : null}
      {audit ? <AuditSummary audit={audit} /> : null}

      {audit ? (
        <button
          type="button"
          className="secondary"
          disabled={isIngesting || !canRun}
          onClick={() => void performIngest(settings.inputPath)}
        >
          {isIngesting ? 'Procesando...' : 'Ingestar documentos'}
        </button>
      ) : null}

      {isIngesting ? <ProgressUpload label="Procesando documentos con OCR y LLM" /> : null}
      {ingest ? (
        <p className="muted">
          Corrida {ingest.run_id} con {ingest.queued_documents} documentos en cola.
        </p>
      ) : null}
    </section>
  );
}
