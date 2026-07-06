import { useCallback, useEffect, useState } from 'react';
import { setBackendBaseUrl } from '../api/backendConfig';
import { checkBackendHealth } from '../api/endpoints';
import { getNativeServiceStatus, getWorkspaceSettings, startNativeServices } from '../api/native';

export type BackendBootstrapStatus = 'checking' | 'ready' | 'offline' | 'starting';

type UseBackendBootstrapResult = {
  backendStatus: BackendBootstrapStatus;
  backendMessage: string;
  isBackendReady: boolean;
  retryBackend: () => Promise<void>;
};

const MAX_ATTEMPTS = 40;
const RETRY_DELAY_MS = 3000;
const STARTUP_DELAY_MS = 5000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function isBackendHealthy(): Promise<boolean> {
  try {
    const health = await checkBackendHealth();
    return health.status === 'ok' && health.database === 'ok';
  } catch {
    return false;
  }
}

export function useBackendBootstrap(): UseBackendBootstrapResult {
  const [backendStatus, setBackendStatus] = useState<BackendBootstrapStatus>('checking');
  const [backendMessage, setBackendMessage] = useState('Verificando servicios locales...');

  const ensureBackendReady = useCallback(async (): Promise<void> => {
    setBackendStatus('checking');
    setBackendMessage('Verificando servicios locales...');

    const loadedSettings = await getWorkspaceSettings().catch(() => null);
    if (loadedSettings?.backendUrl) {
      setBackendBaseUrl(loadedSettings.backendUrl);
    }

    if (await isBackendHealthy()) {
      setBackendStatus('ready');
      setBackendMessage('Backend conectado');
      return;
    }

    setBackendStatus('starting');
    setBackendMessage('Iniciando Docker y backend local...');

    try {
      await startNativeServices().catch(() => undefined);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'No pudimos iniciar los servicios.';
      setBackendStatus('offline');
      setBackendMessage(detail);
      return;
    }

    await sleep(STARTUP_DELAY_MS);

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      if (await isBackendHealthy()) {
        setBackendStatus('ready');
        setBackendMessage('Backend conectado');
        return;
      }
      await sleep(RETRY_DELAY_MS);
    }

    const nativeStatus = await getNativeServiceStatus().catch(() => null);
    if (nativeStatus?.backendReady) {
      setBackendStatus('ready');
      setBackendMessage(nativeStatus.message);
      return;
    }

    setBackendStatus('offline');
    if (nativeStatus?.dockerAvailable === false) {
      setBackendMessage(
        'Backend no disponible en esta PC. Windows 7 no soporta Docker: procesá documentos desde una PC con Windows 10/11 y Docker Desktop. Acá podés configurar carpetas y buscar si el backend está conectado.',
      );
      return;
    }

    setBackendMessage(
      'Backend local no disponible. Abrí Docker Desktop y ejecutá: docker compose up -d en Archivo-GO.',
    );
  }, []);

  useEffect(() => {
    void ensureBackendReady();
  }, [ensureBackendReady]);

  return {
    backendStatus,
    backendMessage,
    isBackendReady: backendStatus === 'ready',
    retryBackend: ensureBackendReady,
  };
}
