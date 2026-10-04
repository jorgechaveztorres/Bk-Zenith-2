import { Capacitor } from '@capacitor/core';

const configuredBase = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');

export function getApiBaseUrl(): string {
  if (configuredBase) return configuredBase;
  if (!Capacitor.isNativePlatform()) return '';
  throw new Error('ZENITH_API_BASE_URL_NOT_CONFIGURED: El APK necesita VITE_API_BASE_URL apuntando al backend HTTPS de producción.');
}

export function apiUrl(path: string): string {
  if (!path.startsWith('/api/')) return path;
  const base = getApiBaseUrl();
  return base ? base + path : path;
}

export function installApiFetchBridge(): void {
  if (typeof window === 'undefined') return;
  const marker = '__ZENITH_API_FETCH_BRIDGE__';
  if ((window as any)[marker]) return;
  const nativeFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.startsWith('/api/')) return nativeFetch(apiUrl(input), init);
    if (input instanceof URL && input.pathname.startsWith('/api/')) return nativeFetch(apiUrl(input.pathname + input.search), init);
    if (input instanceof Request && input.url.startsWith(window.location.origin + '/api/')) {
      const url = new URL(input.url);
      return nativeFetch(apiUrl(url.pathname + url.search), init);
    }
    return nativeFetch(input, init);
  }) as typeof window.fetch;
  (window as any)[marker] = true;
}