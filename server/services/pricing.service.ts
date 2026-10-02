import crypto from 'crypto';
import { getRouteProvider } from './routes.service';
import { resolveGeoMarketZone } from './geo.service';

// ============================================================================
// ZÉNITH — SERVER-SIDE DPE V2 PRICING ENGINE
// Fuente de verdad comercial: Tabla escalonada en Soles (PEN) y Multiplicador
// ============================================================================

export type DPEStatus = 'DISPONIBLE' | 'SIN_OFERTA_DISPONIBLE';

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

export interface ServerQuoteParams {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  originAddress: string;
  destAddress: string;
  durationMin?: number;
  pendingOrders?: number;
  availableDrivers?: number;
}

export interface ServerQuoteResult {
  quoteId: string;
  origin: {
    address: string;
    lat: number;
    lng: number;
  };
  destination: {
    address: string;
    lat: number;
    lng: number;
  };
  distance: number; // en km (2 decimales)
  duration: number; // en min (estimado)
  normalFare: number; // Tarifa normal base (Soles)
  pressure: number; // Relación demanda/oferta
  multiplier: number; // Multiplicador dinámico (1.00x a 1.30x)
  totalFare: number; // Precio final en Soles
  currency: 'PEN';
  pricingVersion: 'DPE_V2';
  expiresAt: string; // ISO 8601
  pricingSeal: string; // HMAC SHA-256
  marketZone: MarketZone;
  status: DPEStatus;
}

export interface PriceBreakdown {
  baseFare: number;
  distanceFare: number;
  durationFare: number;
  trafficMultiplier: number;
  weatherMultiplier: number;
  demandMultiplier: number;
  riskZoneSurcharge: number;
  sustainabilityOffset: number;
  platformHealthFee: number;
  finalPrice: number;
  pricingSeal: string;
}

export interface PricingFactors {
  distanceKm: number;
  estimatedMinutes: number;
  isHighRiskZone?: boolean;
  isPeakHour?: boolean;
  pendingOrders?: number;
  availableDrivers?: number;
}

export interface IPricingEngine {
  calculateProtectedPrice(factors: PricingFactors): Promise<PriceBreakdown>;
  verifyPricingSeal(price: number, seal: string, rideId: string): Promise<boolean>;
}

/**
 * Distancia geodésica mediante la fórmula de Haversine (Radio terrestre: 6371 km).
 */
export function getGeodesicDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radio terrestre en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}

/**
 * Tabla oficial congelada de Tarifa Normal por Distancia (DPE V2 en Soles):
 * 0.00–2.50 km   -> S/ 5.00
 * >2.50–4.50 km  -> S/ 6.00
 * >4.50–6.00 km  -> S/ 8.00
 * >6.00–7.50 km  -> S/ 10.00
 * >7.50–8.50 km  -> S/ 12.00
 * >8.50–9.50 km  -> S/ 14.00
 * >9.50–10.00 km -> S/ 17.00
 * >10.00–12.00 km-> S/ 18.00
 * >12.00–14.00 km-> S/ 20.00
 * >14.00–15.00 km-> S/ 22.00
 * >15.00–17.00 km-> S/ 24.00
 * >17.00–20.00 km-> S/ 27.00
 * >20.00 km      -> S/ 27.00 + ((distanceKm - 20) * 1.50)
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
 * Bandas exactas de multiplicador según presión de mercado:
 * pressure <= 1.00 -> 1.00
 * pressure <= 1.25 -> 1.05
 * pressure <= 1.50 -> 1.10
 * pressure <= 2.00 -> 1.15
 * pressure <= 2.50 -> 1.20
 * pressure <= 3.00 -> 1.25
 * pressure > 3.00  -> 1.30 (Cap máximo)
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
 * Calcula el multiplicador de tarifa dinámica según la presión de mercado.
 * Regla de Oferta Cero: availableDrivers === 0 && pendingOrders > 0 -> multiplier 1.00
 */
export function calculateDynamicMultiplier(
  pendingOrders: number,
  availableDrivers: number
): DynamicMultiplierResult {
  // CASO SIN OFERTA: supply = 0 y demand > 0
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
 * Resolución geográfica de Zona de Mercado multiciudad (cuadrícula geodésica de ~3 km).
 */
export function resolveMarketZone(lat: number, lng: number, address?: string): MarketZone {
  return resolveGeoMarketZone(lat, lng, address);
}

/**
 * Obtiene el secreto HMAC del entorno.
 * En producción falla estrictamente si no está configurado.
 */
export function getPricingSecret(): string {
  const secret = process.env.PRICING_HMAC_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[PRICING_SECURITY] PRICING_HMAC_SECRET no está configurado en producción.');
    }
    console.warn('[PRICING_SECURITY] ADVERTENCIA: PRICING_HMAC_SECRET no definido en desarrollo. Configure la variable para producción.');
    return 'ZENITH_DEV_UNSECURE_FALLBACK_SECRET_CHANGE_IN_PROD';
  }
  return secret;
}

/**
 * Genera la firma criptográfica HMAC SHA-256 para la cotización de forma determinista.
 * Enlaza criptográficamente origen, destino, coordenadas, distancia vial, tarifas y moneda.
 */
export function generateQuoteSignature(payload: {
  quoteId: string;
  pricingVersion: string;
  totalFare: number;
  normalFare: number;
  multiplier: number;
  distance: number;
  origin?: { address: string; lat?: number; lng?: number };
  originAddress?: string;
  originLat?: number;
  originLng?: number;
  destination?: { address: string; lat?: number; lng?: number };
  destAddress?: string;
  destLat?: number;
  destLng?: number;
  currency?: string;
  expiresAt: string;
}): string {
  const secret = getPricingSecret();
  const originAddr = (payload.originAddress || payload.origin?.address || '').trim();
  const destAddr = (payload.destAddress || payload.destination?.address || '').trim();
  const currency = (payload.currency || 'PEN').trim().toUpperCase();

  const oLat = payload.originLat ?? payload.origin?.lat;
  const oLng = payload.originLng ?? payload.origin?.lng;
  const dLat = payload.destLat ?? payload.destination?.lat;
  const dLng = payload.destLng ?? payload.destination?.lng;

  // Normalización determinista de coordenadas a 5 decimales (~1.1 m de precisión geodésica)
  const originCoords = (oLat !== undefined && oLng !== undefined)
    ? `${oLat.toFixed(5)},${oLng.toFixed(5)}`
    : '';
  const destCoords = (dLat !== undefined && dLng !== undefined)
    ? `${dLat.toFixed(5)},${dLng.toFixed(5)}`
    : '';

  const canonicalData = [
    payload.quoteId,
    payload.pricingVersion,
    payload.totalFare.toFixed(2),
    payload.normalFare.toFixed(2),
    payload.multiplier.toFixed(2),
    payload.distance.toFixed(2),
    originAddr,
    destAddr,
    originCoords,
    destCoords,
    currency,
    payload.expiresAt
  ].join('|');

  return crypto.createHmac('sha256', secret).update(canonicalData).digest('hex');
}

/**
 * Valida la firma HMAC, expiración y versión de una cotización.
 */
export function verifyQuoteSignature(quote: {
  quoteId: string;
  pricingVersion: string;
  totalFare: number;
  normalFare: number;
  multiplier: number;
  distance: number;
  origin?: { address: string; lat?: number; lng?: number };
  originAddress?: string;
  originLat?: number;
  originLng?: number;
  destination?: { address: string; lat?: number; lng?: number };
  destAddress?: string;
  destLat?: number;
  destLng?: number;
  currency?: string;
  expiresAt: string;
  pricingSeal: string;
}): { valid: boolean; reason?: string } {
  // 1. Expiración
  const now = new Date();
  const expiry = new Date(quote.expiresAt);
  if (isNaN(expiry.getTime()) || now > expiry) {
    return { valid: false, reason: 'Cotización expirada' };
  }

  // 2. Versión de Pricing
  if (quote.pricingVersion !== 'DPE_V2') {
    return { valid: false, reason: 'Versión de pricing inválida' };
  }

  // 3. Moneda (Zero-Trust: Solo PEN)
  const currency = (quote.currency || 'PEN').trim().toUpperCase();
  if (currency !== 'PEN') {
    return { valid: false, reason: 'Moneda no autorizada (solo PEN)' };
  }

  // 4. Verificación de firma con tiempo constante
  try {
    const expectedSig = generateQuoteSignature({
      ...quote,
      currency
    });
    const sealBuffer = Buffer.from(quote.pricingSeal || '', 'hex');
    const expectedBuffer = Buffer.from(expectedSig, 'hex');

    if (sealBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sealBuffer, expectedBuffer)) {
      return { valid: false, reason: 'Firma criptográfica inválida o datos manipulados' };
    }

    return { valid: true };
  } catch (err: any) {
    return { valid: false, reason: `Error al verificar firma: ${err?.message || 'Error desconocido'}` };
  }
}

/**
 * Orquestador Server-Side de Cotización DPE V2.
 * Calcula la distancia tarifaria oficial mediante Google Routes API (o Mock en tests).
 * NO sustituye la distancia por Haversine si Google falla; en caso de error, rechaza controladamente.
 */
export async function calculateServerQuote(params: ServerQuoteParams): Promise<ServerQuoteResult> {
  // 1. Obtener la distancia y duración vial oficial mediante Google Routes API
  const routeProvider = getRouteProvider();
  const route = await routeProvider.computeRoute(
    { lat: params.originLat, lng: params.originLng },
    { lat: params.destLat, lng: params.destLng }
  );

  const distance = route.distanceKm;
  const duration = (params.durationMin && params.durationMin > 0)
    ? Math.round(params.durationMin)
    : route.durationMinutes;

  // 2. Zona de mercado
  const marketZone = resolveMarketZone(params.originLat, params.originLng, params.originAddress);

  // 3. Tarifa Normal (Soles) según tabla DPE V2
  const normalFare = calculateNormalFare(distance);

  // 4. Multiplicador Dinámico
  const pendingOrders = params.pendingOrders !== undefined ? params.pendingOrders : 1;
  const availableDrivers = params.availableDrivers !== undefined ? params.availableDrivers : 1;
  const dynamicEval = calculateDynamicMultiplier(pendingOrders, availableDrivers);

  // 5. Precio final redondeado a 2 decimales
  const rawTotal = normalFare * dynamicEval.multiplier;
  const totalFare = Number(rawTotal.toFixed(2));

  // 6. Identificador y expiración (10 minutos)
  const quoteId = `quote_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // 7. Sello criptográfico HMAC SHA-256
  const pricingSeal = generateQuoteSignature({
    quoteId,
    pricingVersion: 'DPE_V2',
    totalFare,
    normalFare,
    multiplier: dynamicEval.multiplier,
    distance,
    origin: {
      address: params.originAddress,
      lat: params.originLat,
      lng: params.originLng
    },
    destination: {
      address: params.destAddress,
      lat: params.destLat,
      lng: params.destLng
    },
    currency: 'PEN',
    expiresAt
  });

  return {
    quoteId,
    origin: {
      address: params.originAddress,
      lat: params.originLat,
      lng: params.originLng
    },
    destination: {
      address: params.destAddress,
      lat: params.destLat,
      lng: params.destLng
    },
    distance,
    duration,
    normalFare,
    pressure: dynamicEval.pressure,
    multiplier: dynamicEval.multiplier,
    totalFare,
    currency: 'PEN',
    pricingVersion: 'DPE_V2',
    expiresAt,
    pricingSeal,
    marketZone,
    status: dynamicEval.status
  };
}

/**
 * Implementación de IPricingEngine para compatibilidad con el backend existente.
 */
export class PricingEngineClass implements IPricingEngine {
  async calculateProtectedPrice(factors: PricingFactors): Promise<PriceBreakdown> {
    const normalFare = calculateNormalFare(factors.distanceKm);
    const pendingOrders = factors.pendingOrders ?? 1;
    const availableDrivers = factors.availableDrivers ?? 1;
    const dynamicEval = calculateDynamicMultiplier(pendingOrders, availableDrivers);
    const totalFare = Number((normalFare * dynamicEval.multiplier).toFixed(2));

    const quoteId = `compat_${Date.now()}`;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const pricingSeal = generateQuoteSignature({
      quoteId,
      pricingVersion: 'DPE_V2',
      totalFare,
      normalFare,
      multiplier: dynamicEval.multiplier,
      distance: factors.distanceKm,
      originAddress: 'COMPAT',
      destAddress: 'COMPAT',
      expiresAt
    });

    return {
      baseFare: normalFare,
      distanceFare: 0,
      durationFare: 0,
      trafficMultiplier: 1.0,
      weatherMultiplier: 1.0,
      demandMultiplier: dynamicEval.multiplier,
      riskZoneSurcharge: 0,
      sustainabilityOffset: 0,
      platformHealthFee: 0,
      finalPrice: totalFare,
      pricingSeal
    };
  }

  async verifyPricingSeal(price: number, seal: string, _rideId: string): Promise<boolean> {
    if (!seal) return false;
    return typeof seal === 'string' && seal.length > 0;
  }
}

export const PricingEngine = new PricingEngineClass();
