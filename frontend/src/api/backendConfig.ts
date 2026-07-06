const DEFAULT_BACKEND_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

let backendBaseUrl = DEFAULT_BACKEND_URL;

export function normalizeBackendUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return DEFAULT_BACKEND_URL;

  let normalized = trimmed.replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }
  return normalized;
}

export function setBackendBaseUrl(url: string): void {
  backendBaseUrl = normalizeBackendUrl(url);
}

export function getBackendBaseUrl(): string {
  return backendBaseUrl;
}

export function resetBackendBaseUrl(): void {
  backendBaseUrl = DEFAULT_BACKEND_URL;
}
