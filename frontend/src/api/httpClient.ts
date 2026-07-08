import { getBackendBaseUrl } from './backendConfig';

const MAX_NETWORK_RETRIES = 4;
const RETRY_DELAY_MS = 2000;

type ApiErrorPayload = {
  detail?: string;
};

type RequestOptions = RequestInit & {
  timeoutMs?: number;
  timeoutMessage?: string;
};

export async function request<TResponse>(path: string, init: RequestOptions = {}): Promise<TResponse> {
  const { timeoutMs = 60_000, timeoutMessage, ...fetchInit } = init;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_NETWORK_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${getBackendBaseUrl()}${path}`, {
        ...fetchInit,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...fetchInit.headers,
        },
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
        throw new Error(payload.detail ?? `HTTP ${response.status}`);
      }

      return (await response.json()) as TResponse;
    } catch (error) {
      if (error instanceof Error && !isRetryableNetworkError(error)) {
        throw error;
      }

      lastError = buildNetworkError(error, timeoutMessage);
      if (attempt < MAX_NETWORK_RETRIES - 1) {
        await sleep(RETRY_DELAY_MS);
      }
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  throw lastError ?? new Error('No pudimos conectar con el backend.');
}

function isRetryableNetworkError(error: Error): boolean {
  if (error.message.startsWith('HTTP ')) return false;
  return true;
}

function buildNetworkError(error: unknown, timeoutMessage?: string): Error {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new Error(timeoutMessage ?? 'La solicitud tardó demasiado. Intentá de nuevo.');
  }
  if (error instanceof TypeError || (error instanceof Error && error.message.includes('fetch'))) {
    return new Error(
      `No pudimos conectar con el backend en ${getBackendBaseUrl()}. Verificá la URL en IA o que Docker esté corriendo.`,
    );
  }
  if (error instanceof Error) {
    return error;
  }
  return new Error('No pudimos conectar con el backend.');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
