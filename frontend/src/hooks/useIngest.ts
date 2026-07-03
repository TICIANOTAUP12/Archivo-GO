import { useState } from 'react';
import { auditSource, ingestSource } from '../api/endpoints';
import type { AuditResponse, IngestResponse } from '../types';

type UseIngestResult = {
  audit: AuditResponse | null;
  ingest: IngestResponse | null;
  isAuditing: boolean;
  isIngesting: boolean;
  error: string | null;
  performAudit: (sourcePath: string, sampleLimit: number) => Promise<void>;
  performIngest: (sourcePath: string) => Promise<void>;
};

export function useIngest(onIngestComplete?: () => Promise<void>): UseIngestResult {
  const [audit, setAudit] = useState<AuditResponse | null>(null);
  const [ingest, setIngest] = useState<IngestResponse | null>(null);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [isIngesting, setIsIngesting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  async function performAudit(sourcePath: string, sampleLimit: number): Promise<void> {
    const trimmedPath = sourcePath.trim();
    if (!trimmedPath) {
      setError('Ingresá una carpeta o archivo para auditar.');
      return;
    }

    setIsAuditing(true);
    setError(null);
    setIngest(null);

    try {
      const response = await auditSource(trimmedPath, sampleLimit);
      setAudit(response);
    } catch (auditError) {
      setAudit(null);
      setError(auditError instanceof Error ? auditError.message : 'No pudimos completar la auditoría.');
    } finally {
      setIsAuditing(false);
    }
  }

  async function performIngest(sourcePath: string): Promise<void> {
    const trimmedPath = sourcePath.trim();
    if (!trimmedPath) {
      setError('Ingresá una carpeta o archivo para procesar.');
      return;
    }

    setIsIngesting(true);
    setError(null);

    try {
      const response = await ingestSource(trimmedPath, null);
      setIngest(response);
      await onIngestComplete?.();
    } catch (ingestError) {
      setError(ingestError instanceof Error ? ingestError.message : 'No pudimos iniciar la ingesta.');
    } finally {
      setIsIngesting(false);
    }
  }

  return { audit, ingest, isAuditing, isIngesting, error, performAudit, performIngest };
}
