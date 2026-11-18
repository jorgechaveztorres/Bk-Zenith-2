import { getGeodesicDistance } from './pricing.service';

export interface RouteCoordinates {
  lat: number;
  lng: number;
}

export interface RouteResult {
  distanceMeters: number;
  distanceKm: number;
  durationSeconds: number;
  durationMinutes: number;
  encodedPolyline?: string;
  source: 'GOOGLE_ROUTES' | 'MOCK_TEST' | 'ESTIMATE';
}

export interface IRouteProvider {
  computeRoute(origin: RouteCoordinates, destination: RouteCoordinates): Promise<RouteResult>;
}

/**
 * Proveedor oficial: Google Routes API (REST v2)
 * Endpoint: https://routes.googleapis.com/directions/v2:computeRoutes
 * Calcula la distancia vial real y duración en automóvil.
 */
export class GoogleRoutesProvider implements IRouteProvider {
  private apiKey: string;
  private timeoutMs: number;

  constructor(apiKey?: string, timeoutMs: number = 7000) {
    this.apiKey = apiKey || process.env.GOOGLE_MAPS_PLATFORM_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
    this.timeoutMs = timeoutMs;
  }

  async computeRoute(origin: RouteCoordinates, destination: RouteCoordinates): Promise<RouteResult> {
    if (!this.apiKey || this.apiKey === 'MY_GOOGLE_MAPS_KEY') {
      throw new Error('Google Routes API Key no configurada en el servidor (GOOGLE_MAPS_PLATFORM_KEY).');
    }

    // Validación de coordenadas
    if (
      isNaN(origin.lat) || isNaN(origin.lng) ||
      isNaN(destination.lat) || isNaN(destination.lng) ||
      origin.lat < -90 || origin.lat > 90 ||
      destination.lat < -90 || destination.lat > 90 ||
      origin.lng < -180 || origin.lng > 180 ||
      destination.lng < -180 || destination.lng > 180
    ) {
      throw new Error('Coordenadas de origen o destino fuera de rango.');
    }

    const endpoint = 'https://routes.googleapis.com/directions/v2:computeRoutes';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const requestBody = {
        origin: {
          location: {
            latLng: {
              latitude: origin.lat,
              longitude: origin.lng
            }
          }
        },
        destination: {
          location: {
            latLng: {
              latitude: destination.lat,
              longitude: destination.lng
            }
          }
        },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_UNAWARE',
        computeAlternativeRoutes: false
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const status = response.status;
        const errMsg = errorBody?.error?.message || `Error HTTP ${status} en Google Routes API`;
        throw new Error(`Google Routes API falló (${status}): ${errMsg}`);
      }

      const data = await response.json();

      if (!data || !Array.isArray(data.routes) || data.routes.length === 0) {
        throw new Error('Google Routes API no encontró una ruta vial válida entre los puntos especificados.');
      }

      const route = data.routes[0];
      const distanceMeters = Number(route.distanceMeters);

      if (isNaN(distanceMeters) || distanceMeters <= 0) {
        throw new Error('Google Routes API retornó una distancia vial inválida o igual a 0 metros.');
      }

      // Parsea duración tipo "450s"
      let durationSeconds = 0;
      if (typeof route.duration === 'string') {
        durationSeconds = parseInt(route.duration.replace('s', ''), 10) || 0;
      }

      const distanceKm = Number((distanceMeters / 1000).toFixed(3));
      const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));

      // Sanity Check: Una ruta vial por carretera nunca puede ser menor que la geodésica esférica
      const geodesicKm = getGeodesicDistance(origin.lat, origin.lng, destination.lat, destination.lng);
      if (distanceKm < geodesicKm * 0.90) {
        throw new Error(
          `Inconsistencia física detectada: Distancia vial Google (${distanceKm.toFixed(2)} km) es menor que la geodésica mínima (${geodesicKm.toFixed(2)} km).`
        );
      }

      return {
        distanceMeters,
        distanceKm,
        durationSeconds,
        durationMinutes,
        encodedPolyline: route.polyline?.encodedPolyline,
        source: 'GOOGLE_ROUTES'
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`Timeout al consultar Google Routes API (${this.timeoutMs}ms excedidos).`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Proveedor para pruebas y desarrollo controlado (Mock / Fake)
 */
export class MockRouteProvider implements IRouteProvider {
  private customDistanceKm?: number;
  private customDurationMinutes?: number;
  private shouldFail?: boolean;
  private failureReason?: string;

  constructor(options?: {
    distanceKm?: number;
    durationMinutes?: number;
    shouldFail?: boolean;
    failureReason?: string;
  }) {
    this.customDistanceKm = options?.distanceKm;
    this.customDurationMinutes = options?.durationMinutes;
    this.shouldFail = options?.shouldFail;
    this.failureReason = options?.failureReason;
  }

  setScenario(options: {
    distanceKm?: number;
    durationMinutes?: number;
    shouldFail?: boolean;
    failureReason?: string;
  }) {
    this.customDistanceKm = options.distanceKm;
    this.customDurationMinutes = options.durationMinutes;
    this.shouldFail = options.shouldFail;
    this.failureReason = options.failureReason;
  }

  async computeRoute(origin: RouteCoordinates, destination: RouteCoordinates): Promise<RouteResult> {
    if (this.shouldFail) {
      throw new Error(this.failureReason || 'Fallo simulado en Google Routes Provider.');
    }

    // Coordenadas inválidas
    if (
      isNaN(origin.lat) || isNaN(origin.lng) ||
      isNaN(destination.lat) || isNaN(destination.lng) ||
      origin.lat < -90 || origin.lat > 90 ||
      destination.lat < -90 || destination.lat > 90 ||
      origin.lng < -180 || origin.lng > 180 ||
      destination.lng < -180 || destination.lng > 180
    ) {
      throw new Error('Coordenadas de origen o destino fuera de rango.');
    }

    const distanceKm = this.customDistanceKm !== undefined
      ? this.customDistanceKm
      : Number((getGeodesicDistance(origin.lat, origin.lng, destination.lat, destination.lng) * 1.25).toFixed(3));

    const distanceMeters = Math.round(distanceKm * 1000);
    const durationMinutes = this.customDurationMinutes !== undefined
      ? this.customDurationMinutes
      : Math.max(1, Math.round(distanceKm * 2.5));

    return {
      distanceMeters,
      distanceKm,
      durationSeconds: durationMinutes * 60,
      durationMinutes,
      source: 'MOCK_TEST'
    };
  }
}

/**
 * Proveedor GRATUITO (sin Google, sin internet): distancia en línea recta multiplicada
 * por un factor de calles urbanas. Es una aproximación: en Trujillo el recorrido real
 * suele ser entre 1.2 y 1.5 veces la línea recta. Sirve para desarrollar y probar sin
 * gastar; antes del lanzamiento se cambia a Google con ROUTE_PROVIDER=google.
 */
export class EstimateRouteProvider implements IRouteProvider {
  constructor(private roadFactor = 1.35, private avgSpeedKmh = 22) {}

  async computeRoute(origin: RouteCoordinates, destination: RouteCoordinates): Promise<RouteResult> {
    const bad = (c: RouteCoordinates) =>
      !Number.isFinite(c.lat) || !Number.isFinite(c.lng) || Math.abs(c.lat) > 90 || Math.abs(c.lng) > 180;
    if (bad(origin) || bad(destination)) throw new Error('Coordenadas de origen o destino fuera de rango.');

    const straightKm = getGeodesicDistance(origin.lat, origin.lng, destination.lat, destination.lng);
    const distanceKm = Number(Math.max(0.3, straightKm * this.roadFactor).toFixed(3));
    const durationMinutes = Math.max(2, Math.round((distanceKm / this.avgSpeedKmh) * 60));
    return {
      distanceMeters: Math.round(distanceKm * 1000),
      distanceKm,
      durationSeconds: durationMinutes * 60,
      durationMinutes,
      source: 'ESTIMATE',
    };
  }
}

/**
 * Proveedor activo según ROUTE_PROVIDER:
 *  - "google": Google Routes API (cuesta dinero; requiere GOOGLE_MAPS_PLATFORM_KEY con Routes API habilitada).
 *  - cualquier otro valor o vacío: estimación gratuita. Así nunca se gasta en Google sin decidirlo.
 */
const defaultProvider = (): IRouteProvider =>
  (process.env.ROUTE_PROVIDER || '').toLowerCase() === 'google' ? new GoogleRoutesProvider() : new EstimateRouteProvider();

let activeRouteProvider: IRouteProvider = defaultProvider();

export function setRouteProvider(provider: IRouteProvider) {
  activeRouteProvider = provider;
}

export function getRouteProvider(): IRouteProvider {
  return activeRouteProvider;
}
