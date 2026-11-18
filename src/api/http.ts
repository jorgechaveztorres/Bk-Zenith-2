/**
 * ZÉNITH — Cliente HTTP de la API MySQL (reemplaza a Firebase en la app).
 *
 * - Guarda la sesión (token de 1 h + token de renovación de 30 días) en el teléfono.
 * - Si el servidor responde 401, renueva la sesión una sola vez y repite la llamada.
 * - Los errores llegan como ApiError con el mensaje en español que manda el servidor.
 */
import type { ApiSession, ApiUser } from './types';

const PROD_BASE = 'https://shocos.nom.pe/zenith-api';

const env: Partial<ImportMetaEnv> & { DEV?: boolean } = (import.meta as { env?: ImportMetaEnv & { DEV?: boolean } }).env ?? {};

/** En desarrollo (npm run dev) la API vive en el mismo servidor; en el APK y en producción, en cPanel. */
let API_BASE: string = (env.VITE_API_BASE ?? (env.DEV ? '' : PROD_BASE)).replace(/\/+$/, '');

export const getApiBase = (): string => API_BASE;
/** Solo para pruebas automáticas (scripts/test-app-client.ts). */
export const setApiBase = (url: string) => {
  API_BASE = url.replace(/\/+$/, '');
};

/** wss://shocos.nom.pe/zenith-api/ws (o el mismo host en desarrollo). */
export const wsUrl = (): string => {
  if (API_BASE) return `${API_BASE.replace(/^http/, 'ws')}/ws`;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// ---------------------------------------------------------------- Sesión guardada
const KEY = 'zenith_session_v1';

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  /** ms epoch en que vence el accessToken (con margen). */
  accessExpiresAt: number;
  user: ApiUser;
}

let current: StoredSession | null = null;
const listeners = new Set<(user: ApiUser | null) => void>();

const readStored = (): StoredSession | null => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
};

const writeStored = (s: StoredSession | null) => {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    // Almacenamiento no disponible: la sesión vive solo mientras la app esté abierta.
  }
};

current = readStored();

export const getSessionUser = (): ApiUser | null => current?.user ?? null;
export const hasSession = (): boolean => current !== null;

export const onSessionChange = (fn: (user: ApiUser | null) => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const emit = () => {
  const u = current?.user ?? null;
  for (const fn of listeners) fn(u);
};

export const saveSession = (s: ApiSession) => {
  current = {
    accessToken: s.accessToken,
    refreshToken: s.refreshToken,
    accessExpiresAt: Date.now() + Math.max(60, s.expiresIn - 60) * 1000,
    user: s.user,
  };
  writeStored(current);
  emit();
};

export const updateSessionUser = (user: ApiUser) => {
  if (!current) return;
  current = { ...current, user };
  writeStored(current);
  emit();
};

export const clearSession = () => {
  current = null;
  writeStored(null);
  emit();
};

export const getRefreshToken = (): string | null => current?.refreshToken ?? null;

/** Solo para pruebas automáticas: simula que el token de 1 h ya venció. */
export const expireAccessTokenForTest = () => {
  if (current) current = { ...current, accessExpiresAt: 0 };
};

// ---------------------------------------------------------------- Llamadas
interface ServerBody {
  success?: boolean;
  message?: string;
}

const rawRequest = async <T>(method: string, path: string, body: unknown, token: string | null): Promise<T> => {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Sin conexión. Revisa tu internet e intenta de nuevo.');
  }

  let data: (T & ServerBody) | null = null;
  try {
    data = (await res.json()) as T & ServerBody;
  } catch {
    data = null;
  }
  if (!res.ok || !data || data.success === false) {
    throw new ApiError(res.status, data?.message || `Error del servidor (${res.status}).`);
  }
  return data;
};

/** Una sola renovación a la vez, aunque varias llamadas fallen juntas. */
let refreshing: Promise<string | null> | null = null;

export const refreshAccessToken = (): Promise<string | null> => {
  if (refreshing) return refreshing;
  const rt = current?.refreshToken;
  if (!rt) return Promise.resolve(null);
  refreshing = rawRequest<ApiSession>('POST', '/auth/refresh', { refreshToken: rt }, null)
    .then((s) => {
      saveSession(s);
      return s.accessToken;
    })
    .catch((err: unknown) => {
      // Solo se cierra la sesión si el servidor la rechazó; sin internet se conserva.
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) clearSession();
      return null;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
};

/** Token vigente (lo renueva si está por vencer). */
export const getAccessToken = async (): Promise<string | null> => {
  if (!current) return null;
  if (Date.now() < current.accessExpiresAt) return current.accessToken;
  return refreshAccessToken();
};

export interface RequestOptions {
  /** false = llamada pública (login, registro). Por defecto true. */
  auth?: boolean;
}

export const api = async <T>(method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> => {
  if (opts.auth === false) return rawRequest<T>(method, path, body, null);

  const token = await getAccessToken();
  if (!token) throw new ApiError(401, 'Debes iniciar sesión.');
  try {
    return await rawRequest<T>(method, path, body, token);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      const fresh = await refreshAccessToken();
      if (fresh) return rawRequest<T>(method, path, body, fresh);
    }
    throw err;
  }
};

export const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : 'Ocurrió un error. Intenta de nuevo.';
