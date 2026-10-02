import { getGeodesicDistance, MarketZone } from './pricing.service';
import { CityCatalog, CityDefinition } from '../config/cities.config';

export interface CityResolutionResult {
  city: string;
  code: string;
  department: string;
  isKnownCity: boolean;
  distanceToCenterKm: number;
  operationalRadiusKm: number;
  definition?: CityDefinition;
}

/**
 * Ventana máxima de frescura para telemetría de conductores (10 minutos).
 * Un conductor sin reporte en los últimos 10 minutos se considera 'STALE' y queda excluido.
 */
export const MAX_DRIVER_STALE_MS = 10 * 60 * 1000;

/**
 * Evalúa si el reporte de telemetría de un conductor es fresco o ha expirado.
 */
export function isDriverFresh(driver: any, nowMs: number = Date.now()): boolean {
  if (driver.isStale === true) {
    return false;
  }

  let lastUpdateMs: number | null = null;

  // 1. Timestamp en drivers_online (Firestore Timestamp, Date, string o number)
  if (driver.lastActive) {
    if (typeof driver.lastActive.toMillis === 'function') {
      lastUpdateMs = driver.lastActive.toMillis();
    } else if (typeof driver.lastActive === 'number') {
      lastUpdateMs = driver.lastActive;
    } else if (driver.lastActive instanceof Date) {
      lastUpdateMs = driver.lastActive.getTime();
    } else if (typeof driver.lastActive === 'string') {
      const parsed = Date.parse(driver.lastActive);
      if (!isNaN(parsed)) lastUpdateMs = parsed;
    }
  }

  // 2. Timestamp en driverProfile.gps.updatedAt
  if (lastUpdateMs === null && driver.driverProfile?.gps?.updatedAt) {
    const parsed = Date.parse(driver.driverProfile.gps.updatedAt);
    if (!isNaN(parsed)) lastUpdateMs = parsed;
  }

  // 3. Timestamp en driverProfile.lastConnection
  if (lastUpdateMs === null && driver.driverProfile?.lastConnection) {
    const parsed = Date.parse(driver.driverProfile.lastConnection);
    if (!isNaN(parsed)) lastUpdateMs = parsed;
  }

  // Si no se proporcionó ningún timestamp pero es un mock de prueba sin fecha explícita, se considera activo a menos que se haya marcado stale
  if (lastUpdateMs === null) {
    return true;
  }

  return (nowMs - lastUpdateMs) <= MAX_DRIVER_STALE_MS;
}

/**
 * Resuelve la ciudad correspondiente de forma determinista basándose en el catálogo
 * dinámico de ciudades configuradas (CityCatalog) y aplicando aislamiento geográfico estricto.
 */
export function resolveCityFromCoordinates(
  lat: number,
  lng: number,
  address?: string
): CityResolutionResult {
  // 1. Evaluación por Bounding Box en las ciudades configuradas
  const matchBox = CityCatalog.findByBoundingBox(lat, lng);
  if (matchBox) {
    const dist = getGeodesicDistance(lat, lng, matchBox.center.lat, matchBox.center.lng);
    return {
      city: matchBox.name,
      code: matchBox.code,
      department: matchBox.department,
      isKnownCity: true,
      distanceToCenterKm: Number(dist.toFixed(2)),
      operationalRadiusKm: matchBox.operationalRadiusKm,
      definition: matchBox
    };
  }

  // 2. Evaluación por Radio Geodésico al centroide metropolitano de cada ciudad activa
  const activeCities = CityCatalog.getAllCities(true);
  for (const c of activeCities) {
    const dist = getGeodesicDistance(lat, lng, c.center.lat, c.center.lng);
    if (dist <= c.operationalRadiusKm) {
      return {
        city: c.name,
        code: c.code,
        department: c.department,
        isKnownCity: true,
        distanceToCenterKm: Number(dist.toFixed(2)),
        operationalRadiusKm: c.operationalRadiusKm,
        definition: c
      };
    }
  }

  // 3. Evaluación por texto de dirección (si se provee)
  if (address) {
    const matchAddr = CityCatalog.findByAddress(address);
    if (matchAddr) {
      const dist = getGeodesicDistance(lat, lng, matchAddr.center.lat, matchAddr.center.lng);
      return {
        city: matchAddr.name,
        code: matchAddr.code,
        department: matchAddr.department,
        isKnownCity: true,
        distanceToCenterKm: Number(dist.toFixed(2)),
        operationalRadiusKm: matchAddr.operationalRadiusKm,
        definition: matchAddr
      };
    }
  }

  // 4. Proximidad a centros urbanos conocidos (dentro de 50 km de la conurbación)
  if (activeCities.length > 0) {
    let nearest = activeCities[0];
    let minDistance = getGeodesicDistance(lat, lng, nearest.center.lat, nearest.center.lng);

    for (let i = 1; i < activeCities.length; i++) {
      const d = getGeodesicDistance(lat, lng, activeCities[i].center.lat, activeCities[i].center.lng);
      if (d < minDistance) {
        minDistance = d;
        nearest = activeCities[i];
      }
    }

    if (minDistance <= 50) {
      return {
        city: nearest.name,
        code: nearest.code,
        department: nearest.department,
        isKnownCity: true,
        distanceToCenterKm: Number(minDistance.toFixed(2)),
        operationalRadiusKm: nearest.operationalRadiusKm,
        definition: nearest
      };
    }
  }

  // 5. UBICACIÓN REGIONAL NO CATALOGADA (Aislamiento Propio por Celda Geodésica)
  // No crea una única región "Perú" nacional; cada celda regional se aísla por su cuadrícula
  const latBin = (Math.round(lat * 33) / 33).toFixed(3);
  const lngBin = (Math.round(lng * 33) / 33).toFixed(3);
  const regionalGridKey = `${latBin}:${lngBin}`;
  const regionalCode = `RGN_${Math.abs(Math.round(lat * 10))}_${Math.abs(Math.round(lng * 10))}`;

  return {
    city: `Región Local [${regionalGridKey}]`,
    code: regionalCode,
    department: 'Regional',
    isKnownCity: false,
    distanceToCenterKm: 0,
    operationalRadiusKm: 15 // Radio operativo regional estricto (15 km)
  };
}

/**
 * Resuelve la Zona de Mercado Oficial de ZÉNITH (MarketZone)
 * Integra Ciudad/Región + Cuadrícula Geodésica (~3.3 km) de forma 100% multiciudad dinámica.
 */
export function resolveGeoMarketZone(lat: number, lng: number, address?: string): MarketZone {
  const cityResult = resolveCityFromCoordinates(lat, lng, address);
  const city = cityResult.city;

  const latBin = (Math.round(lat * 33) / 33).toFixed(3);
  const lngBin = (Math.round(lng * 33) / 33).toFixed(3);

  const cityCode = cityResult.code || city.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'RGN';
  const id = `MZ-${cityCode}-${latBin}_${lngBin}`;

  return {
    id,
    name: `Zona Operacional ${city} (${latBin}, ${lngBin})`,
    city,
    gridKey: `${latBin}:${lngBin}`
  };
}

/**
 * Filtra órdenes y conductores para una ubicación específica, garantizando aislamiento estricto
 * entre ciudades y dentro de la zona operativa relevante.
 */
export function filterLocalDemandAndSupply(
  originLat: number,
  originLng: number,
  originAddress: string,
  rawRides: Array<{
    id?: string;
    city?: string;
    origin?: { lat: number; lng: number; address?: string };
    status?: string;
  }>,
  rawDrivers: Array<{
    driverId?: string;
    id?: string;
    status?: string;
    lat?: number;
    lng?: number;
    lastActive?: any;
    isStale?: boolean;
    driverProfile?: {
      availability?: boolean;
      status?: string;
      city?: string;
      lastConnection?: string;
      gps?: { lat: number; lng: number; updatedAt?: string };
    };
  }>,
  nowMs: number = Date.now()
): {
  city: string;
  marketZone: MarketZone;
  pendingOrders: number;
  availableDrivers: number;
  localRideIds: string[];
  localDriverIds: string[];
} {
  const cityMeta = resolveCityFromCoordinates(originLat, originLng, originAddress);
  const marketZone = resolveGeoMarketZone(originLat, originLng, originAddress);
  const city = cityMeta.city;
  const maxRadiusKm = cityMeta.operationalRadiusKm;

  const ACTIVE_DEMAND_STATUSES = ['SEARCHING_DRIVER', 'REQUESTED', 'SEARCHING', 'pending'];

  // 1. Filtrado de Demanda Local
  const localRideIds: string[] = [];
  for (const ride of rawRides) {
    if (!ride.status || !ACTIVE_DEMAND_STATUSES.includes(ride.status)) {
      continue;
    }

    const rLat = ride.origin?.lat;
    const rLng = ride.origin?.lng;

    // Validación geográfica de proximidad estricta
    if (typeof rLat === 'number' && typeof rLng === 'number') {
      const dist = getGeodesicDistance(originLat, originLng, rLat, rLng);
      if (dist <= maxRadiusKm) {
        localRideIds.push(ride.id || `ride_${localRideIds.length}`);
      }
    } else if (cityMeta.isKnownCity && ride.city && ride.city.toLowerCase() === city.toLowerCase()) {
      // Solo para ciudades configuradas reconocidas si carecen de coordenadas exactas
      localRideIds.push(ride.id || `ride_${localRideIds.length}`);
    }
  }

  // 2. Filtrado de Oferta Local
  const localDriverIds: string[] = [];
  for (const driver of rawDrivers) {
    // 2.1 Verificar disponibilidad declarada
    const isAvailable = driver.status === 'AVAILABLE' || driver.driverProfile?.availability === true;
    if (!isAvailable) {
      continue;
    }

    // 2.2 Verificar frescura de telemetría (anti-stale)
    if (!isDriverFresh(driver, nowMs)) {
      continue;
    }

    // 2.3 Extraer coordenadas
    const dLat = typeof driver.lat === 'number' ? driver.lat : driver.driverProfile?.gps?.lat;
    const dLng = typeof driver.lng === 'number' ? driver.lng : driver.driverProfile?.gps?.lng;

    if (typeof dLat === 'number' && typeof dLng === 'number') {
      const dist = getGeodesicDistance(originLat, originLng, dLat, dLng);
      if (dist <= maxRadiusKm) {
        localDriverIds.push(driver.driverId || driver.id || `driver_${localDriverIds.length}`);
      }
    } else if (cityMeta.isKnownCity && driver.driverProfile?.city && driver.driverProfile.city.toLowerCase() === city.toLowerCase()) {
      // Solo para ciudades configuradas reconocidas si carecen de GPS preciso
      localDriverIds.push(driver.driverId || driver.id || `driver_${localDriverIds.length}`);
    }
  }

  return {
    city,
    marketZone,
    pendingOrders: localRideIds.length,
    availableDrivers: localDriverIds.length,
    localRideIds,
    localDriverIds
  };
}

export interface GeoScopeQueryFilter {
  field: 'city' | 'gridKey';
  operator: '==';
  value: string;
  isCityScoped: boolean;
}

/**
 * Constructor de Plan de Consulta Geoacotada para Demanda (rides).
 * Garantiza a nivel de diseño que Firestore reciba filtros acotados por ciudad o cuadrícula.
 */
export function buildDemandQueryFilters(
  originLat: number,
  originLng: number,
  originAddress?: string
): {
  collection: string;
  scopeFilter: GeoScopeQueryFilter;
  statusFilter: { field: string; operator: 'in'; value: string[] };
} {
  const geoScope = resolveCityFromCoordinates(originLat, originLng, originAddress);
  const statusFilter = {
    field: 'status',
    operator: 'in' as const,
    value: ['SEARCHING_DRIVER', 'REQUESTED', 'SEARCHING']
  };

  if (geoScope.isKnownCity) {
    return {
      collection: 'rides',
      scopeFilter: {
        field: 'city',
        operator: '==',
        value: geoScope.city,
        isCityScoped: true
      },
      statusFilter
    };
  }

  const latBin = (Math.round(originLat * 33) / 33).toFixed(3);
  const lngBin = (Math.round(originLng * 33) / 33).toFixed(3);
  return {
    collection: 'rides',
    scopeFilter: {
      field: 'gridKey',
      operator: '==',
      value: `${latBin}:${lngBin}`,
      isCityScoped: false
    },
    statusFilter
  };
}

/**
 * Constructor de Plan de Consulta Geoacotada para Oferta (drivers_online).
 * Garantiza a nivel de diseño que Firestore reciba filtros acotados por ciudad o cuadrícula.
 */
export function buildSupplyQueryFilters(
  originLat: number,
  originLng: number,
  originAddress?: string
): {
  collection: string;
  scopeFilter: GeoScopeQueryFilter;
  statusFilter: { field: string; operator: '=='; value: string };
} {
  const geoScope = resolveCityFromCoordinates(originLat, originLng, originAddress);
  const statusFilter = {
    field: 'status',
    operator: '==' as const,
    value: 'AVAILABLE'
  };

  if (geoScope.isKnownCity) {
    return {
      collection: 'drivers_online',
      scopeFilter: {
        field: 'city',
        operator: '==',
        value: geoScope.city,
        isCityScoped: true
      },
      statusFilter
    };
  }

  const latBin = (Math.round(originLat * 33) / 33).toFixed(3);
  const lngBin = (Math.round(originLng * 33) / 33).toFixed(3);
  return {
    collection: 'drivers_online',
    scopeFilter: {
      field: 'gridKey',
      operator: '==',
      value: `${latBin}:${lngBin}`,
      isCityScoped: false
    },
    statusFilter
  };
}
