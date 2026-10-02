import { auth } from '../firebase/config';
import { calculatePricing, PricingResult } from '../utils/pricingEngine';

export interface RequestQuoteParams {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  originAddress: string;
  destAddress: string;
  durationMin?: number;
}

export interface ServerQuote {
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
  distance: number;
  duration: number;
  normalFare: number;
  pressure: number;
  multiplier: number;
  totalFare: number;
  currency: 'PEN';
  pricingVersion: 'DPE_V2';
  expiresAt: string;
  pricingSeal: string;
  marketZone: any;
  status: 'DISPONIBLE' | 'SIN_OFERTA_DISPONIBLE';
}

export type PricingResultWithQuote = PricingResult & { quoteId: string; rawQuote: ServerQuote; };

export class PricingService {
  /**
   * Solicita una cotización oficial protegida al backend (Server-Side DPE V2).
   * La distancia, tarifa base, multiplicador y firma criptográfica son gobernados por el servidor.
   */
  static async requestQuote(params: RequestQuoteParams): Promise<PricingResultWithQuote> {
    try {
      const currentUser = auth.currentUser;
      const token = currentUser ? await currentUser.getIdToken() : '';

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/pricing/quote', {
        method: 'POST',
        headers,
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Error del servidor al cotizar (${response.status})`);
      }

      const data = await response.json();
      if (!data.success || !data.quote) {
        throw new Error(data.message || 'Respuesta de cotización inválida.');
      }

      const q: ServerQuote = data.quote;

      // Adaptador para compatibilidad total con los componentes que consumen PricingResult
      return {
        quoteId: q.quoteId,
        rawQuote: q,
        distance: q.distance,
        duration: q.duration,
        basePrice: q.normalFare,
        normalFare: q.normalFare,
        distancePrice: 0,
        durationPrice: 0,
        multiplier: q.multiplier,
        totalFare: q.totalFare,
        seal: q.pricingSeal, // Sello criptográfico HMAC del servidor
        expiresAt: new Date(q.expiresAt),
        marketPressure: q.pressure,
        marketZone: q.marketZone,
        pendingOrdersCount: 1,
        availableDriversCount: 1,
        status: q.status,
        statusMessage: q.status === 'SIN_OFERTA_DISPONIBLE'
          ? 'Sin motorizados disponibles en la zona. Tarifa no inflada artificialmente.'
          : `Presión de mercado: ${q.pressure.toFixed(2)} (Multiplicador: ×${q.multiplier.toFixed(2)})`,
        pricingVersion: '2.0.0-dpe-mvp',
        distanceSource: 'GOOGLE_ROUTES'
      };
    } catch (err: any) {
      console.error('[PRICING_SERVICE] Error al solicitar cotización oficial al servidor:', err);
      throw err;
    }
  }
}
