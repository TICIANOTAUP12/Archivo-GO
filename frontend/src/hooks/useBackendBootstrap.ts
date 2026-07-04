import { useEffect } from 'react';
import { checkBackendHealth } from '../api/endpoints';
import { startNativeServices } from '../api/native';

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

export function useBackendBootstrap(): void {
  useEffect(() => {
    let cancelled = false;

    async function ensureBackendReady(): Promise<void> {
      if (await isBackendHealthy()) return;

      await startNativeServices().catch(() => undefined);
      await sleep(STARTUP_DELAY_MS);

      for (let attempt = 0; attempt < MAX_ATTEMPTS && !cancelled; attempt += 1) {
        if (await isBackendHealthy()) return;
        await sleep(RETRY_DELAY_MS);
      }
    }

    void ensureBackendReady();

    return () => {
      cancelled = true;
    };
  }, []);
}
