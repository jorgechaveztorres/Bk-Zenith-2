/**
 * ZÉNITH MULTICIUDAD PERÚ — SERVICIO DE CONTEXTO GEOGRÁFICO
 *
 * La ubicación detectada se utiliza únicamente como contexto/sugerencia y
 * nunca restringe la ciudad ni reemplaza los campos de origen/destino.
 */
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export interface DetectedGeoContext {
  lat: number;
  lng: number;
  formattedAddress: string;
  city: string;
  region: string;
  country: string;
  displayName: string;
  timestamp: number;
}

export const PERU_NEUTRAL_CENTER: google.maps.LatLngLiteral = {
  lat: -9.189967,
  lng: -75.015152
};
export const PERU_DEFAULT_ZOOM = 6;
export const LOCALITY_DEFAULT_ZOOM = 13;
const STORAGE_KEY_LAST_KNOWN = 'zenith_last_known_location';

export function getLastKnownLocation(): { lat: number; lng: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LAST_KNOWN);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') {
      return { lat: parsed.lat, lng: parsed.lng };
    }
  } catch (err) {
    console.warn('[ZENITH-GEO] Error al leer última ubicación guardada:', err);
  }
  return null;
}

export function saveLastKnownLocation(location: { lat: number; lng: number }): void {
  try {
    localStorage.setItem(STORAGE_KEY_LAST_KNOWN, JSON.stringify({
      lat: location.lat,
      lng: location.lng,
      timestamp: Date.now()
    }));
  } catch (err) {
    console.warn('[ZENITH-GEO] Error al guardar última ubicación:', err);
  }
}

/** Solicita ubicación usando el plugin nativo en Android y Geolocation del navegador fuera de Capacitor. */
export async function requestCurrentBrowserPosition(): Promise<{ lat: number; lng: number }> {
  if (Capacitor.isNativePlatform()) {
    const current = await Geolocation.checkPermissions();
    let permission = current;
    const locationGranted = current.location === 'granted' || current.coarseLocation === 'granted';
    if (!locationGranted) {
      permission = await Geolocation.requestPermissions();
    }
    const granted = permission.location === 'granted' || permission.coarseLocation === 'granted';
    if (!granted) throw new Error('Permiso de ubicación denegado. Habilita el permiso de ubicación para ZÉNITH en los ajustes de Android.');

    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      });
      const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
      saveLastKnownLocation(coords);
      return coords;
    } catch (err: any) {
      const message = String(err?.message || err || '');
      if (message.includes('OS-PLUG-GLOC-0007') || /location services are not enabled/i.test(message)) {
        throw new Error('La ubicación está desactivada. Activa el GPS del dispositivo e inténtalo de nuevo.');
      }
      throw err;
    }
  }

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator?.geolocation) {
      return reject(new Error('La geolocalización no está disponible en este navegador.'));
    }
    navigator.geolocation.getCurrentPosition(
      position => {
        const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
        saveLastKnownLocation(coords);
        resolve(coords);
      },
      error => reject(error),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}

export function reverseGeocodeLocation(lat: number, lng: number): Promise<DetectedGeoContext> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.google?.maps?.Geocoder) {
      return reject(new Error('Google Maps Geocoder no está disponible en este momento.'));
    }
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === window.google.maps.GeocoderStatus.OK && results && results.length > 0) {
        const primary = results[0];
        let city = '';
        let region = '';
        let country = 'Perú';
        primary.address_components?.forEach(comp => {
          if (comp.types.includes('locality')) {
            city = comp.long_name;
          } else if (!city && comp.types.includes('administrative_area_level_2')) {
            city = comp.long_name;
          }
          if (comp.types.includes('administrative_area_level_1')) region = comp.long_name;
          if (comp.types.includes('country')) country = comp.long_name;
        });
        if (!city && region) city = region;
        const displayName = city ? `${city}, ${country}` : primary.formatted_address;
        resolve({
          lat, lng,
          formattedAddress: primary.formatted_address,
          city: city || 'Perú',
          region: region || '',
          country,
          displayName,
          timestamp: Date.now()
        });
      } else {
        reject(new Error(`Reverse geocoding falló con estatus: ${status}`));
      }
    });
  });
}
