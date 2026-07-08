import { useState } from 'react';
import { auditSource, ingestSource } from '../api/endpoints';
import type { AuditResponse, IngestResponse } from '../types';

export type ProcessingPhase = 'idle' | 'auditing' | 'ingesting' | 'done';

type UseIngestResult = {
  audit: AuditResponse | null;
  ingest: IngestResponse | null;
  isAuditing: boolean;
  isIngesting: boolean;
  isProcessing: boolean;
  processingPhase: ProcessingPhase;
  error: string | null;
  performAudit: (sourcePath: string, sampleLimit: number, options?: { keepPhase?: boolean }) => Promise<AuditResponse | null>;
  performIngest: (sourcePath: string, runId: string | null, maxDocuments: number | null) => Promise<IngestResponse | null>;
  performFullProcessing: (sourcePath: string, sampleLimit: number, maxDocuments: number | null) => Promise<void>;
};

export function useIngest(onIngestComplete?: () => Promise<void>): UseIngestResult {
  const [audit, setAudit] = useState<AuditResponse | null>(null);
  const [ingest, setIngest] = useState<IngestResponse | null>(null);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [isIngesting, setIsIngesting] = useState<boolean>(false);
  const [processingPhase, setProcessingPhase] = useState<ProcessingPhase>('idle');
  const [error, setError] = useState<string | null>(null);

  async function performAudit(
    sourcePath: string,
    sampleLimit: number,
    options?: { keepPhase?: boolean },
  ): Promise<AuditResponse | null> {
    const trimmedPath = sourcePath.trim();
    if (!trimmedPath) {
      setError('Ingresá una carpeta o archivo para auditar.');
      return null;
    }

    setIsAuditing(true);
    setProcessingPhase('auditing');
    setError(null);
    setIngest(null);

    try {
      const response = await auditSource(trimmedPath, sampleLimit);
      setAudit(response);
      return response;
    } catch (auditError) {
      setAudit(null);
      setError(auditError instanceof Error ? auditError.message : 'No pudimos completar la auditoría.');
      return null;
    } finally {
      setIsAuditing(false);
      if (!options?.keepPhase) {
        setProcessingPhase((currentPhase) => (currentPhase === 'auditing' ? 'idle' : currentPhase));
      }
    }
  }

  async function performIngest(
    sourcePath: string,
    runId: string | null,
    maxDocuments: number | null,
  ): Promise<IngestResponse | null> {
    const trimmedPath = sourcePath.trim();
    if (!trimmedPath) {
      setError('Ingresá una carpeta o archivo para procesar.');
      return null;
    }

    setIsIngesting(true);
    setProcessingPhase('ingesting');
    setError(null);

    try {
      const response = await ingestSource(trimmedPath, runId, maxDocuments);
      setIngest(response);
      setProcessingPhase('done');
      await onIngestComplete?.();
      return response;
    } catch (ingestError) {
      const message =
        ingestError instanceof Error ? ingestError.message : 'No pudimos iniciar la ingesta.';
      setError(
        message.includes('abort') || message.includes('tardó demasiado')
          ? 'La carpeta es muy grande o Win7 tardó demasiado. Probá con máximo 5–10 archivos por corrida.'
          : message,
      );
      return null;
    } finally {
      setIsIngesting(false);
      setProcessingPhase((currentPhase) => (currentPhase === 'ingesting' ? 'idle' : currentPhase));
    }
  }

  async function performFullProcessing(
    sourcePath: string,
    sampleLimit: number,
    maxDocuments: number | null,
  ): Promise<void> {
    setProcessingPhase('auditing');
    const auditResult = await performAudit(sourcePath, sampleLimit, { keepPhase: true });
    if (!auditResult) {
      setProcessingPhase('idle');
      return;
    }

    if (auditResult.total_files === 0) {
      setError('No hay PDFs ni imágenes compatibles en la carpeta elegida.');
      setProcessingPhase('idle');
      return;
    }

    await performIngest(sourcePath, auditResult.run_id, maxDocuments);
  }

  return {
    audit,
    ingest,
    isAuditing,
    isIngesting,
    isProcessing: isAuditing || isIngesting,
    processingPhase,
    error,
    performAudit,
    performIngest,
    performFullProcessing,
  };
}
