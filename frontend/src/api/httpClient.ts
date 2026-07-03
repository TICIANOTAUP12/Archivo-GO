const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

type ApiErrorPayload = {
  detail?: string;
};

export async function request<TResponse>(path: string, init: RequestInit = {}): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  }).catch((error) => {
    throw new Error(buildNetworkErrorMessage(error));
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
    throw new Error(payload.detail ?? `HTTP ${response.status}`);
  }

  return (await response.json()) as TResponse;
}

function buildNetworkErrorMessage(error: unknown): string {
  const details = error instanceof Error ? error.message : 'sin detalle';
  return `Backend desconectado. Iniciá los servicios desde la app de escritorio o ejecutá docker compose up --build -d. Detalle: ${details}`;
}
