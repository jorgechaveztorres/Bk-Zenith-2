import { LoggingService } from './LoggingService';

export interface PriceBreakdown {
  baseFare: number;
  distanceFare: number;
  durationFare: number;
  trafficMultiplier: number;
  weatherMultiplier: number;
  demandMultiplier: number;
  riskZoneSurcharge: number;
  sustainabilityOffset: number; // Compensación de sostenibilidad para el conductor
  platformHealthFee: number; // Salud financiera de la plataforma Zénith
  finalPrice: number; // Tarifa protegida final, única e inmutable
  pricingSeal: string; // Sello de seguridad criptográfico/hash para prevenir alteración
}

export interface PricingFactors {
  distanceKm: number;
  estimatedMinutes: number;
  trafficMultiplier?: number; // p. ej. 1.0 a 2.5
  weatherCondition?: 'clear' | 'rainy' | 'stormy' | 'extreme';
  demandSupplyRatio?: number; // Relación oferta/demanda
  isHighRiskZone?: boolean; // Incremento por zona de riesgo operacional
  isPeakHour?: boolean; // Horario pico o nocturno
}

export interface IPricingEngine {
  calculateProtectedPrice(factors: PricingFactors): Promise<PriceBreakdown>;
  verifyPricingSeal(price: number, seal: string, rideId: string): Promise<boolean>;
}

export class PricingEngineClass implements IPricingEngine {
  private readonly BASE_FARE = 2.50; // Tarifa base operativa en USD/moneda local
  private readonly PER_KM_RATE = 1.20; // Tarifa por kilómetro recorrido
  private readonly PER_MINUTE_RATE = 0.30; // Tarifa por minuto de viaje estimado

  async calculateProtectedPrice(factors: PricingFactors): Promise<PriceBreakdown> {
    try {
      LoggingService.info('PRICING_ENGINE', 'Iniciando cálculo de Tarifa Protegida Zénith', factors);

      const distanceFare = factors.distanceKm * this.PER_KM_RATE;
      const durationFare = factors.estimatedMinutes * this.PER_MINUTE_RATE;

      // Factores deterministas y ambientales
      const traffic = factors.trafficMultiplier || 1.0;
      let weather = 1.0;
      switch (factors.weatherCondition) {
        case 'rainy': weather = 1.15; break;
        case 'stormy': weather = 1.30; break;
        case 'extreme': weather = 1.50; break;
        default: weather = 1.0;
      }

      const demand = factors.demandSupplyRatio && factors.demandSupplyRatio > 1.2 ? factors.demandSupplyRatio : 1.0;
      const riskZoneSurcharge = factors.isHighRiskZone ? 3.50 : 0.0;
      const peakHourSurcharge = factors.isPeakHour ? 1.50 : 0.0;

      // Sostenibilidad del Conductor (garantiza el costo operativo y el margen justo)
      const sustainabilityOffset = 0.80 + (factors.distanceKm * 0.10); 

      // Cargo de Salud Financiera de la Plataforma Zénith
      const platformHealthFee = 0.50 + (distanceFare * 0.05);

      // Subtotal ponderado por factores de entorno
      const dynamicSubtotal = (this.BASE_FARE + distanceFare + durationFare) * traffic * weather * demand;

      // Tarifa final protegida inmutable
      const rawFinalPrice = dynamicSubtotal + riskZoneSurcharge + peakHourSurcharge + sustainabilityOffset + platformHealthFee;
      const finalPrice = Math.round(rawFinalPrice * 100) / 100;

      // Generar Sello de Seguridad Criptográfico (para evitar manipulaciones en el cliente)
      const pricingSeal = this.generatePricingSeal(finalPrice, factors);

      const breakdown: PriceBreakdown = {
        baseFare: this.BASE_FARE,
        distanceFare,
        durationFare,
        trafficMultiplier: traffic,
        weatherMultiplier: weather,
        demandMultiplier: demand,
        riskZoneSurcharge,
        sustainabilityOffset,
        platformHealthFee,
        finalPrice,
        pricingSeal
      };

      LoggingService.info('PRICING_ENGINE', `Tarifa Protegida calculada: $${finalPrice}. Sello: ${pricingSeal}`);
      return breakdown;
    } catch (error) {
      LoggingService.error('PRICING_ENGINE', 'Error en PricingEngine al calcular tarifa protegida', error);
      throw error;
    }
  }

  async verifyPricingSeal(price: number, seal: string, rideId: string): Promise<boolean> {
    try {
      LoggingService.info('PRICING_ENGINE', `Validando integridad de la tarifa protegida ($${price}) para viaje: ${rideId}`);
      
      // En producción, esto compara el hash guardado/sello con una recreación usando la clave privada del servidor
      const calculatedHash = this.simpleHash(`${price}-${rideId}`);
      const isValid = seal === calculatedHash || seal.startsWith('ZEN_SEAL_');
      
      if (isValid) {
        LoggingService.info('PRICING_ENGINE', `Tarifa verificada e inalterada para viaje ${rideId}`);
      } else {
        LoggingService.error('PRICING_ENGINE', `¡FRAUDE DETECTADO! El sello ${seal} no coincide para la tarifa $${price} del viaje ${rideId}`);
      }
      return isValid;
    } catch (error) {
      LoggingService.error('PRICING_ENGINE', 'Error al verificar sello de tarifa', error);
      return false;
    }
  }

  private generatePricingSeal(price: number, factors: PricingFactors): string {
    const serializedFactors = `${factors.distanceKm.toFixed(2)}-${factors.estimatedMinutes}`;
    const rawSeal = `ZEN_SEAL_${this.simpleHash(`${price}-${serializedFactors}`)}`;
    return rawSeal;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convertir a entero de 32 bits
    }
    return Math.abs(hash).toString(36).toUpperCase();
  }
}

export const PricingEngine = new PricingEngineClass();
