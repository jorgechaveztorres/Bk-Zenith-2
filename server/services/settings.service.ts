import type { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../config/mysql';

/**
 * Parámetros de negocio guardados en la tabla app_settings (comisión, tiempos, distancias).
 * Se pueden cambiar en la base sin recompilar. Caché de 60 s.
 */
const TTL_MS = 60_000;
let cache: { at: number; values: Map<string, string> } | null = null;

const load = async (): Promise<Map<string, string>> => {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.values;
  const [rows] = await getPool().query<RowDataPacket[]>('SELECT setting_key, setting_value FROM app_settings');
  const values = new Map<string, string>();
  for (const r of rows) values.set(String(r.setting_key), String(r.setting_value).replace(/^"|"$/g, ''));
  cache = { at: Date.now(), values };
  return values;
};

export const getNumberSetting = async (key: string, fallback: number): Promise<number> => {
  const v = (await load()).get(key);
  const n = v === undefined ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** Para pruebas: olvida la caché. */
export const clearSettingsCache = () => {
  cache = null;
};
