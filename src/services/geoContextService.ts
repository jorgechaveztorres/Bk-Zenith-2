/**
 * ZÉNITH MULTICIUDAD PERÚ — SERVICIO DE CONTEXTO GEOGRÁFICO
 * 
 * Este servicio proporciona detección dinámica de ubicación física del usuario (GPS),
 * Reverse Geocoding a través de Google Maps Geocoder y contexto de ciudad/región.
 * 
 * REGLA FUNDAMENTAL:
 * La ubicación detectada actúa EXCLUSIVAMENTE como contexto y sesgo visual/sugerencias.
 * NUNCA restringe la operación a una ciudad ni reemplaza obligatoriamente los campos
 * de origen/destino ingresados por el usuario.
 */

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

/**
 * Obtiene la última ubicación guardada en almacenamiento local si existe
 */
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

/**
 * Guarda la última ubicación válida conocida en almacenamiento local
 */
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

/**
 * Solicita la posición física actual del dispositivo mediante Geolocation API
 */
export function requestCurrentBrowserPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator?.geolocation) {
      return reject(new Error('Geolocation no es soportado por este navegador.'));
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        saveLastKnownLocation(coords);
        resolve(coords);
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  });
}

/**
 * Ejecuta Reverse Geocoding usando el servicio de Google Maps Geocoder
 * para traducir coordenadas (lat, lng) en dirección, localidad y región en Perú.
 */
export function reverseGeocodeLocation(
  lat: number,
  lng: number
): Promise<DetectedGeoContext> {
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

        // Recorrer los componentes de dirección para extraer la localidad y la región
        primary.address_components?.forEach(comp => {
          if (comp.types.includes('locality')) {
            city = comp.long_name;
          } else if (!city && comp.types.includes('administrative_area_level_2')) {
            city = comp.long_name;
          }

          if (comp.types.includes('administrative_area_level_1')) {
            region = comp.long_name;
          }

          if (comp.types.includes('country')) {
            country = comp.long_name;
          }
        });

        // Si no se detectó localidad explícita, usar la región
        if (!city && region) {
          city = region;
        }

        const displayName = city ? `${city}, ${country}` : primary.formatted_address;

        resolve({
          lat,
          lng,
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
