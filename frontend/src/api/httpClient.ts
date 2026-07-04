const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';
const MAX_NETWORK_RETRIES = 4;
const RETRY_DELAY_MS = 2000;

type ApiErrorPayload = {
  detail?: string;
};

type RequestOptions = RequestInit & {
  timeoutMs?: number;
};

export async function request<TResponse>(path: string, init: RequestOptions = {}): Promise<TResponse> {
  const { timeoutMs = 30_000, ...fetchInit } = init;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_NETWORK_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
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

      lastError = buildNetworkError(error);
      if (attempt < MAX_NETWORK_RETRIES - 1) {
        await sleep(RETRY_DELAY_MS);
      }
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  throw lastError ?? new Error('No pudimos conectar con el backend local.');
}

function isRetryableNetworkError(error: Error): boolean {
  if (error.message.startsWith('HTTP ')) return false;
  return true;
}

function buildNetworkError(error: unknown): Error {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new Error('La búsqueda tardó demasiado. Intentá de nuevo.');
  }
  if (error instanceof TypeError || (error instanceof Error && error.message.includes('fetch'))) {
    return new Error(
      'Backend local no disponible. Abrí Docker Desktop y ejecutá: docker compose up -d en Archivo-GO.',
    );
  }
  if (error instanceof Error) {
    return error;
  }
  return new Error('No pudimos conectar con el backend local.');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
