/**
 * ZÉNITH — Buscador de direcciones gratis (OpenStreetMap / Nominatim).
 *
 * Pasa por nuestro servidor para cumplir las reglas de Nominatim:
 *  - se identifica con User-Agent propio,
 *  - máximo 1 consulta por segundo (cola),
 *  - guarda en memoria las respuestas repetidas (24 h).
 * Antes del lanzamiento con mucho tráfico conviene un proveedor pagado o Nominatim propio.
 */
import { HttpError } from './http-error';

export interface GeoResult {
  address: string;
  lat: number;
  lng: number;
}

const BASE = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org';
const USER_AGENT = process.env.NOMINATIM_USER_AGENT || 'ZenithDelivery/1.0 (shocos.nom.pe)';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 2000;
const MIN_GAP_MS = 1100;

/** Recuadro de preferencia: Trujillo metropolitano (no excluye otras zonas). */
const TRUJILLO_VIEWBOX = '-79.20,-7.95,-78.85,-8.25';

const cache = new Map<string, { at: number; value: GeoResult[] }>();
let chain: Promise<unknown> = Promise.resolve();
let lastCall = 0;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Cola de 1 consulta/segundo hacia Nominatim. */
const throttled = <T>(fn: () => Promise<T>): Promise<T> => {
  const run = chain.then(async () => {
    const gap = Date.now() - lastCall;
    if (gap < MIN_GAP_MS) await wait(MIN_GAP_MS - gap);
    lastCall = Date.now();
    return fn();
  });
  chain = run.catch(() => undefined);
  return run;
};

const cached = async (key: string, fn: () => Promise<GeoResult[]>): Promise<GeoResult[]> => {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  const value = await throttled(fn);
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), value });
  return value;
};

interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  house_number?: string;
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  city?: string;
  town?: string;
  village?: string;
}

interface NominatimItem {
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  address?: NominatimAddress;
}

/** "Av. España 123, Centro, Trujillo" en vez del texto largo de OSM. */
const shortAddress = (it: NominatimItem): string => {
  const a = it.address || {};
  const street = a.road || a.pedestrian;
  const parts = [
    it.name && it.name !== street ? it.name : undefined,
    street ? `${street}${a.house_number ? ` ${a.house_number}` : ''}` : undefined,
    a.neighbourhood || a.suburb || a.quarter,
    a.city || a.town || a.village,
  ].filter((p): p is string => !!p);
  const text = parts.length >= 2 ? parts.join(', ') : it.display_name;
  return text.slice(0, 255);
};

const call = async (path: string, params: Record<string, string>): Promise<unknown> => {
  const url = `${BASE}${path}?${new URLSearchParams({ format: 'jsonv2', addressdetails: '1', 'accept-language': 'es', ...params })}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  } catch {
    throw new HttpError(502, 'El buscador de direcciones no responde. Intenta de nuevo.');
  }
  if (!res.ok) throw new HttpError(502, 'El buscador de direcciones no responde. Intenta de nuevo.');
  return res.json();
};

const toResult = (it: NominatimItem): GeoResult => ({ address: shortAddress(it), lat: Number(it.lat), lng: Number(it.lon) });

export const searchAddress = async (rawQuery: unknown): Promise<GeoResult[]> => {
  const q = typeof rawQuery === 'string' ? rawQuery.trim().replace(/\s+/g, ' ').slice(0, 120) : '';
  if (q.length < 3) throw new HttpError(400, 'Escribe al menos 3 letras.');
  return cached(`s:${q.toLowerCase()}`, async () => {
    const data = (await call('/search', { q, countrycodes: 'pe', viewbox: TRUJILLO_VIEWBOX, limit: '6' })) as NominatimItem[];
    return Array.isArray(data) ? data.map(toResult).filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng)) : [];
  });
};

export const reverseGeocode = async (rawLat: unknown, rawLng: unknown): Promise<GeoResult> => {
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new HttpError(400, 'Ubicación inválida.');
  }
  // ~11 m de precisión en la llave para aprovechar el caché.
  const key = `r:${lat.toFixed(4)},${lng.toFixed(4)}`;
  const [hit] = await cached(key, async () => {
    const data = (await call('/reverse', { lat: String(lat), lon: String(lng), zoom: '18' })) as NominatimItem & { error?: string };
    if (!data || data.error) return [{ address: `Punto en el mapa (${lat.toFixed(5)}, ${lng.toFixed(5)})`, lat, lng }];
    return [{ ...toResult(data), lat, lng }];
  });
  return hit;
};
