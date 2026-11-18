/**
 * GPS del teléfono (Capacitor en el APK, navigator.geolocation en el navegador).
 */
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export interface Fix {
  lat: number;
  lng: number;
  heading: number | null;
  speedKmh: number | null;
  accuracy: number;
}

const toFix = (c: { latitude: number; longitude: number; heading?: number | null; speed?: number | null; accuracy: number }): Fix => ({
  lat: c.latitude,
  lng: c.longitude,
  heading: Number.isFinite(c.heading) ? Number(c.heading) : null,
  speedKmh: Number.isFinite(c.speed) ? Number(c.speed) * 3.6 : null,
  accuracy: c.accuracy,
});

const ensurePermission = async () => {
  if (!Capacitor.isNativePlatform()) return;
  const p = await Geolocation.checkPermissions();
  if (p.location === 'granted') return;
  const r = await Geolocation.requestPermissions();
  if (r.location !== 'granted') throw new Error('Activa el permiso de ubicación para Zénith.');
};

export const currentFix = async (): Promise<Fix> => {
  await ensurePermission();
  try {
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 });
    return toFix(pos.coords);
  } catch {
    throw new Error('No pudimos leer tu ubicación. Activa el GPS e intenta de nuevo.');
  }
};

/** Sigue la ubicación; devuelve la función para detener. */
export const watchFix = async (onFix: (f: Fix) => void, onError?: (msg: string) => void): Promise<() => void> => {
  await ensurePermission();
  const id = await Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }, (pos, err) => {
    if (pos) onFix(toFix(pos.coords));
    else if (err) onError?.('Se perdió la señal de GPS.');
  });
  return () => {
    void Geolocation.clearWatch({ id });
  };
};

/** Navegación gratis: abre Google Maps / Waze del teléfono (no usa la API de Google). */
export const navUrl = (lat: number, lng: number, app: 'google' | 'waze' = 'google') =>
  app === 'waze'
    ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
