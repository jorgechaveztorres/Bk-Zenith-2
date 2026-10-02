// ============================================================================
// ZÉNITH
// Module : Pricing — Dynamic Pricing Engine (DPE V2 MVP)
// Layer  : Domain / Utils
// File   : pricingEngine.ts
// ============================================================================

export type DPEStatus = 'DISPONIBLE' | 'SIN_OFERTA_DISPONIBLE';
export type DistanceSource = 'GOOGLE_DIRECTIONS' | 'GOOGLE_ROUTES' | 'GEODESIC_FALLBACK';

export interface MarketZone {
  id: string;
  name: string;
  city: string;
  gridKey: string;
}

export interface DynamicMultiplierResult {
  multiplier: number;
  pressure: number;
  status: DPEStatus;
  message: string;
}

export interface PricingOptions {
  /**
   * Distancia vial real directa (en km), obtenida de Google Directions API si está disponible.
   * Si no se proporciona, se utilizará la distancia geodésica Haversine como fallback.
   */
  distanceKm?: number;
  /**
   * Duración vial real estimada (en minutos).
   */
  durationMin?: number;
  /**
   * Cantidad de pedidos pendientes en la zona de mercado.
   */
  pendingOrders?: number;
  /**
   * Cantidad de motorizados disponibles y conectados en la zona de mercado.
   */
  availableDrivers?: number;
  /**
   * Presión de mercado directa (si ya fue calculada previamente como demand / supply).
   */
  marketPressure?: number;
  /**
   * Identificador o zona de mercado explícita.
   */
  marketZoneId?: string;
  /**
   * Fuente declarada de la distancia.
   */
  distanceSource?: DistanceSource;
}

export interface PricingResult {
  distance: number; // in km
  duration: number; // in minutes
  basePrice: number; // Tarifa normal base (S/5, S/6, etc.)
  distancePrice: number; // Compatibilidad con componentes visuales anteriores
  durationPrice: number; // Compatibilidad con componentes visuales anteriores
  multiplier: number; // Multiplicador dinámico (1.00 a 1.30)
  totalFare: number; // Precio final calculado en Soles
  seal: string; // Sello de seguridad criptográfico ZÉNITH
  expiresAt: Date; // Fecha de expiración

  // Extensiones DPE V2 MVP
  normalFare: number;
  marketPressure: number;
  marketZone: MarketZone;
  pendingOrdersCount: number;
  availableDriversCount: number;
  status: DPEStatus;
  statusMessage: string;
  pricingVersion: '2.0.0-dpe-mvp';
  distanceSource: DistanceSource;
}

/**
 * Calculates geodesic distance between two coordinates using the Haversine formula.
 */
export function getGeodesicDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(1));
}

/**
 * Tabla oficial congelada de Tarifa Normal por Distancia (DPE V2):
 * 0–2.5 km    -> S/5.00
 * >2.5–4.5 km -> S/6.00
 * >4.5–6 km   -> S/8.00
 * >6–7.5 km   -> S/10.00
 * >7.5–8.5 km -> S/12.00
 * >8.5–9.5 km -> S/14.00
 * >9.5–10 km  -> S/17.00
 * >10–12 km   -> S/18.00
 * >12–14 km   -> S/20.00
 * >14–15 km   -> S/22.00
 * >15–17 km   -> S/24.00
 * >17–20 km   -> S/27.00
 *
 * Regla especial para >20 km:
 * normalFare = 27 + ((distanceKm - 20) × 1.50)
 * Redondeado a 2 decimales.
 */
export function calculateNormalFare(distanceKm: number): number {
  const d = Math.max(0, distanceKm);
  if (d <= 2.5) return 5.00;
  if (d <= 4.5) return 6.00;
  if (d <= 6.0) return 8.00;
  if (d <= 7.5) return 10.00;
  if (d <= 8.5) return 12.00;
  if (d <= 9.5) return 14.00;
  if (d <= 10.0) return 17.00;
  if (d <= 12.0) return 18.00;
  if (d <= 14.0) return 20.00;
  if (d <= 15.0) return 22.00;
  if (d <= 17.0) return 24.00;
  if (d <= 20.0) return 27.00;

  // Distancia superior a 20 km: S/ 27 base + S/ 1.50 por km adicional
  const extraKm = d - 20;
  const extraFare = extraKm * 1.50;
  return Number((27 + extraFare).toFixed(2));
}

/**
 * Obtiene el multiplicador dinámico correspondiente a la presión de mercado según las bandas congeladas:
 * ≤ 1.00        -> ×1.00
 * >1.00 – 1.25  -> ×1.05
 * >1.25 – 1.50  -> ×1.10
 * >1.50 – 2.00  -> ×1.15
 * >2.00 – 2.50  -> ×1.20
 * >2.50 – 3.00  -> ×1.25
 * >3.00         -> ×1.30 (Cap máximo)
 */
export function getMultiplierFromPressure(pressure: number): number {
  if (pressure <= 1.00) return 1.00;
  if (pressure <= 1.25) return 1.05;
  if (pressure <= 1.50) return 1.10;
  if (pressure <= 2.00) return 1.15;
  if (pressure <= 2.50) return 1.20;
  if (pressure <= 3.00) return 1.25;
  return 1.30;
}

/**
 * Calcula el multiplicador de tarifa dinámica según la presión de mercado:
 * presión = pedidos pendientes (demanda) / motorizados disponibles (oferta)
 *
 * Cero Oferta:
 * Si supply === 0 y demand > 0 -> Estado SIN_OFERTA_DISPONIBLE, multiplicador 1.00.
 */
export function calculateDynamicMultiplier(
  pendingOrders: number,
  availableDrivers: number
): DynamicMultiplierResult {
  // CASO SIN OFERTA (Regla congelada): supply = 0 y demand > 0
  if (availableDrivers === 0 && pendingOrders > 0) {
    return {
      multiplier: 1.00,
      pressure: Infinity,
      status: 'SIN_OFERTA_DISPONIBLE',
      message: 'Sin motorizados disponibles en la zona. Tarifa no inflada artificialmente.'
    };
  }

  // Sin demanda activa (demand = 0) o reposo
  if (pendingOrders === 0) {
    return {
      multiplier: 1.00,
      pressure: 0,
      status: 'DISPONIBLE',
      message: 'Presión normal del mercado (sin demanda activa).'
    };
  }

  const rawPressure = pendingOrders / availableDrivers;
  // Redondeo de presión a 4 decimales para evaluación exacta de umbrales
  const pressure = Number(rawPressure.toFixed(4));
  const multiplier = getMultiplierFromPressure(pressure);

  return {
    multiplier,
    pressure,
    status: 'DISPONIBLE',
    message: `Presión de mercado: ${pressure.toFixed(2)} (Multiplicador: ×${multiplier.toFixed(2)})`
  };
}

/**
 * Abstracción de Zona de Mercado (MarketZone).
 * Diseñada para desacoplar el motor tarifario de Uber H3 o geometrías complejas.
 * Opera en cualquier ciudad del Perú sin hardcodear Trujillo ni ninguna otra localidad.
 */
export function resolveMarketZone(lat: number, lng: number, address?: string): MarketZone {
  // Cuadrícula geodésica de ~3 km
  const latBin = (Math.round(lat * 33) / 33).toFixed(3);
  const lngBin = (Math.round(lng * 33) / 33).toFixed(3);

  let city = 'Perú';
  if (address) {
    if (/trujillo/i.test(address)) city = 'Trujillo';
    else if (/lima/i.test(address)) city = 'Lima';
    else if (/arequipa/i.test(address)) city = 'Arequipa';
    else if (/chiclayo/i.test(address)) city = 'Chiclayo';
    else if (/piura/i.test(address)) city = 'Piura';
    else if (/cusco|cuzco/i.test(address)) city = 'Cusco';
    else if (/huancayo/i.test(address)) city = 'Huancayo';
    else if (/iquitos/i.test(address)) city = 'Iquitos';
    else if (/tacna/i.test(address)) city = 'Tacna';
  }

  const id = `MZ-${city.toUpperCase()}-${latBin}_${lngBin}`;
  return {
    id,
    name: `Zona Operacional ${city} (${latBin}, ${lngBin})`,
    city,
    gridKey: `${latBin}:${lngBin}`
  };
}

/**
 * Genera el sello de seguridad criptográfico para la cotización ZÉNITH DPE V2.
 */
export function generatePricingSeal(
  origin: string,
  dest: string,
  price: number,
  zoneId: string = 'MZ-PERU'
): string {
  const input = `${origin}_${dest}_${price}_${zoneId}_${Date.now()}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).toUpperCase();
  return `ZNTH-DPE2-${hex.substring(0, 4)}-${Math.floor(1000 + Math.random() * 9000)}`;
}

/**
 * ORQUESTADOR PRINCIPAL: ZÉNITH DPE V2 MVP
 * Secuencia:
 *   distancia
 *      ↓
 *   tarifa normal
 *      ↓
 *   presión de mercado
 *      ↓
 *   multiplicador
 *      ↓
 *   precio final
 */
export function calculatePricing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  originAddress: string,
  destAddress: string,
  options?: PricingOptions
): PricingResult {
  // 1. Determinar fuente y valor de distancia
  let distance: number;
  let distanceSource: DistanceSource;

  if (typeof options?.distanceKm === 'number' && options.distanceKm >= 0) {
    distance = parseFloat(options.distanceKm.toFixed(2));
    distanceSource = options.distanceSource || 'GOOGLE_DIRECTIONS';
  } else {
    distance = getGeodesicDistance(lat1, lon1, lat2, lon2);
    distanceSource = 'GEODESIC_FALLBACK';
  }

  // 2. Determinar duración
  let duration: number;
  if (typeof options?.durationMin === 'number' && options.durationMin > 0) {
    duration = Math.round(options.durationMin);
  } else {
    // Estimación urbana (40 km/h + 3 min de margen de congestión)
    duration = Math.max(2, Math.round((distance / 40) * 60 + 3));
  }

  // 3. Resolver Zona de Mercado
  const marketZone = resolveMarketZone(lat1, lon1, originAddress);

  // 4. Calcular Tarifa Normal según Tabla Oficial DPE V2
  const normalFare = calculateNormalFare(distance);

  // 5. Evaluar Presión de Mercado y Multiplicador Dinámico
  let dynamicEval: DynamicMultiplierResult;
  const pendingOrders = options?.pendingOrders !== undefined ? options.pendingOrders : 1;
  const availableDrivers = options?.availableDrivers !== undefined ? options.availableDrivers : 1;

  if (typeof options?.marketPressure === 'number') {
    const p = Number(options.marketPressure.toFixed(4));
    const multiplier = getMultiplierFromPressure(p);
    dynamicEval = {
      multiplier,
      pressure: p,
      status: 'DISPONIBLE',
      message: `Presión de mercado directa: ${p.toFixed(2)} (Multiplicador: ×${multiplier.toFixed(2)})`
    };
  } else {
    dynamicEval = calculateDynamicMultiplier(pendingOrders, availableDrivers);
  }

  // 6. Calcular Precio Final
  // precio final = round(tarifa normal * multiplicador, 2)
  const rawTotal = normalFare * dynamicEval.multiplier;
  const totalFare = Number(rawTotal.toFixed(2));

  // 7. Sello y Expiración
  const seal = generatePricingSeal(originAddress, destAddress, totalFare, marketZone.id);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  return {
    distance,
    duration,
    basePrice: normalFare, // Tarifa normal base
    distancePrice: 0, // Desglose unificado en tabla DPE V2
    durationPrice: 0, // Desglose unificado en tabla DPE V2
    multiplier: dynamicEval.multiplier,
    totalFare,
    seal,
    expiresAt,

    // Extensiones DPE V2 MVP
    normalFare,
    marketPressure: dynamicEval.pressure,
    marketZone,
    pendingOrdersCount: pendingOrders,
    availableDriversCount: availableDrivers,
    status: dynamicEval.status,
    statusMessage: dynamicEval.message,
    pricingVersion: '2.0.0-dpe-mvp',
    distanceSource
  };
}
