import { useState, type FormEvent } from 'react';
import { useIngest } from '../../hooks/useIngest';
import { useWorkspaceSettings } from '../../hooks/useWorkspaceSettings';
import { AuditSummary } from './AuditSummary';
import { ProgressUpload } from './ProgressUpload';

type IngestionPanelProps = {
  onIngestComplete: () => Promise<void>;
};

export function IngestionPanel({ onIngestComplete }: IngestionPanelProps) {
  const [sampleLimit, setSampleLimit] = useState<number>(500);
  const { audit, ingest, isAuditing, isIngesting, error, performAudit, performIngest } =
    useIngest(onIngestComplete);
  const {
    settings,
    isSavingSettings,
    settingsMessage,
    settingsError,
    setInputPath,
    selectInputPath,
    persistSettings,
  } = useWorkspaceSettings();
  const hasSourcePath = settings.inputPath.trim().length > 0;
  const canRun = hasSourcePath && !isSavingSettings;

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
      {settingsError ? <section className="inlineError strong">{settingsError}</section> : null}
      {settingsMessage ? <p className="successMessage">{settingsMessage}</p> : null}

      <form onSubmit={handleAudit}>
        <label>
          Carpeta de documentos en esta PC
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

        <button
          type="button"
          className="secondary"
          disabled={!hasSourcePath || isSavingSettings}
          onClick={() => void persistSettings()}
        >
          {isSavingSettings ? 'Guardando carpeta...' : 'Guardar carpeta de origen'}
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
