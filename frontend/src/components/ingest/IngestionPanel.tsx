import { useState, type FormEvent } from 'react';
import { useIngest } from '../../hooks/useIngest';
import { useWorkspaceSettings } from '../../hooks/useWorkspaceSettings';
import { FolderPathPicker } from '../settings/FolderPathPicker';
import { AuditSummary } from './AuditSummary';
import { ProgressUpload } from './ProgressUpload';

type IngestionPanelProps = {
  onIngestComplete: () => Promise<void>;
};

const processSteps = [
  'Tocá Examinar... y elegí la carpeta con PDFs e imágenes.',
  'Guardá la carpeta de origen para que la app la recuerde.',
  'Auditá costo para ver archivos, páginas y gasto estimado.',
  'Si el costo cierra, ingestá para indexar y poder buscar.',
];

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
    setStoragePath,
    selectInputPath,
    selectStoragePath,
    persistSettings,
  } = useWorkspaceSettings();
  const hasSourcePath = settings.inputPath.trim().length > 0;
  const hasStoragePath = settings.storagePath.trim().length > 0;
  const canRun = hasSourcePath && hasStoragePath && !isSavingSettings;

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

      <form onSubmit={handleAudit}>
        <div className="pathPickerGrid">
          <FolderPathPicker
            label="Carpeta de origen (documentos a procesar)"
            hint="PDFs e imágenes que querés auditar e ingestar."
            value={settings.inputPath}
            placeholder="Ej. C:\ARCHIVOS_GO\ENARGAS"
            disabled={isSavingSettings}
            onChange={setInputPath}
            onBrowse={() => void selectInputPath()}
          />
          <FolderPathPicker
            label="Carpeta de destino (copias organizadas)"
            hint="Donde se guardan los casos procesados en esta PC."
            value={settings.storagePath}
            placeholder="Ej. C:\ARCHIVOS_GO\storage"
            disabled={isSavingSettings}
            onChange={setStoragePath}
            onBrowse={() => void selectStoragePath()}
          />
        </div>

        <button
          type="button"
          className="secondary"
          disabled={!hasSourcePath || !hasStoragePath || isSavingSettings}
          onClick={() => void persistSettings()}
        >
          {isSavingSettings ? 'Guardando carpetas...' : 'Guardar carpetas'}
        </button>

        <label>
          Muestra para estimar costo
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
