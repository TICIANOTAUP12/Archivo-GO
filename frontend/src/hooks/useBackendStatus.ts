import { useCallback, useEffect, useState } from 'react';
import { checkBackendHealth } from '../api/endpoints';
import { getNativeServiceStatus, startNativeServices } from '../api/native';

type BackendStatus = 'checking' | 'ready' | 'offline' | 'starting';

type UseBackendStatusResult = {
  backendStatus: BackendStatus;
  backendMessage: string;
  isBackendReady: boolean;
  checkBackend: () => Promise<void>;
  startBackend: () => Promise<void>;
};

export function useBackendStatus(): UseBackendStatusResult {
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking');
  const [backendMessage, setBackendMessage] = useState<string>('Verificando servicios locales...');

  const checkBackend = useCallback(async (): Promise<void> => {
    setBackendStatus('checking');
    setBackendMessage('Verificando servicios locales...');
    try {
      const health = await checkBackendHealth();
      const isReady = health.status === 'ok' && health.database === 'ok';
      setBackendStatus(isReady ? 'ready' : 'offline');
      setBackendMessage(isReady ? 'Backend conectado' : 'Backend iniciado, pero la base de datos no está lista.');
      return;
    } catch {
      const nativeStatus = await getNativeServiceStatus().catch(() => null);
      if (nativeStatus?.backendReady) {
        setBackendStatus('ready');
        setBackendMessage(nativeStatus.message);
        return;
      }
      setBackendStatus('offline');
      setBackendMessage('Servicios locales no disponibles.');
    }
  }, []);

  async function startBackend(): Promise<void> {
    setBackendStatus('starting');
    setBackendMessage('Iniciando Docker y backend local...');
    try {
      await startNativeServices();
      await checkBackend();
    } catch (error) {
      setBackendStatus('offline');
      const detail = error instanceof Error ? error.message : 'No pudimos iniciar los servicios.';
      const isBrowserDev = typeof window.go?.main?.App?.StartServices !== 'function';
      setBackendMessage(
        isBrowserDev
          ? `${detail} Desde el navegador, levantá Docker manualmente: docker compose up -d en la carpeta Archivo-GO.`
          : detail,
      );
    }
  }

  useEffect(() => {
    void checkBackend();
  }, [checkBackend]);

  return {
    backendStatus,
    backendMessage,
    isBackendReady: backendStatus === 'ready',
    checkBackend,
    startBackend,
  };
}
