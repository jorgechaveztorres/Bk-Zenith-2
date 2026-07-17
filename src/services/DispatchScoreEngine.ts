import { DriverOnlineStatus } from './DriverPresenceService';
import { Location } from '../types';

export interface DispatchScoreResult {
  driverId: string;
  driverName: string;
  score: number;
  distanceKm: number;
  etaMinutes: number;
  breakdown: {
    distanceScore: number;
    ratingScore: number;
    acceptanceScore: number;
    cancellationScore: number;
    hardwareScore: number;
    financialScore: number;
  };
}

export class DispatchScoreEngine {
  /**
   * Calcula el score ponderado de despacho para un conductor con relación a un origen de viaje.
   * Filtra severamente y ordena bajo un algoritmo determinista matemático.
   */
  static calculateScore(
    driver: DriverOnlineStatus,
    origin: Location,
    metrics: {
      recentAcceptanceRate: number; // 0.0 to 1.0 (ej. 0.95)
      recentCancellationRate: number; // 0.0 to 1.0 (ej. 0.05)
      walletDebtRatio: number; // 0.0 to 1.0 (basado en cashDebt contra límite)
      disciplinaryPoints: number; // 0 to 100 (100 = impecable, 0 = suspendido)
    }
  ): DispatchScoreResult {
    // 1. Distancia Geográfica por Haversine (Km)
    const distanceKm = this.getHaversineDistance(
      driver.lat,
      driver.lng,
      origin.lat,
      origin.lng
    );

    // 2. Tiempo Estimado de Llegada (ETA) aproximado: asumiendo velocidad urbana promedio de 30 km/h + 1 min de retardo de arranque
    const etaMinutes = Math.max(1.5, Math.round((distanceKm / 30) * 60 + 1));

    // 3. Score por Distancia (Máximo 40 Puntos)
    // Decrece linealmente: menor a 1km = 40 pts, mayor a 6km = 0 pts
    let distanceScore = 0;
    if (distanceKm <= 1.0) {
      distanceScore = 40;
    } else if (distanceKm < 6.0) {
      distanceScore = 40 - ((distanceKm - 1.0) / 5.0) * 40;
    }

    // 4. Score por Calificación / Rating (Máximo 20 Puntos)
    // Rating 5.0 = 20 pts, Rating 4.0 = 10 pts, Rating inferior a 4.0 = decrece exponencialmente
    const rating = driver.rating || 4.5;
    const ratingScore = Math.max(0, Math.min(20, (rating - 3.5) * 20));

    // 5. Score por Aceptaciones Recientes (Máximo 15 Puntos)
    const acceptanceScore = metrics.recentAcceptanceRate * 15;

    // 6. Score por Cancelaciones Recientes (Penalización sobre Máximo 15 Puntos)
    // Menos cancelaciones = mayor puntaje
    const cancellationScore = (1.0 - metrics.recentCancellationRate) * 15;

    // 7. Score de Hardware (Máximo 5 Puntos)
    // Conexión excelente, GPS de alta precisión y batería llena otorgan el máximo
    let hardwareScore = 5;
    if (driver.gpsPrecision !== 'high') hardwareScore -= 1.5;
    if (driver.isBatteryCritical) hardwareScore -= 2.0;
    if (!driver.hasInternet) hardwareScore -= 1.5;
    hardwareScore = Math.max(0, hardwareScore);

    // 8. Score Financiero y Disciplinario (Máximo 5 Puntos)
    // Mayor deuda de efectivo o penalizaciones disminuye el score
    let financialScore = 5 * (1.0 - metrics.walletDebtRatio);
    financialScore = financialScore * (metrics.disciplinaryPoints / 100);
    financialScore = Math.max(0, financialScore);

    // Total final Score (Máximo 100 Puntos)
    const rawScore = distanceScore + ratingScore + acceptanceScore + cancellationScore + hardwareScore + financialScore;
    const finalScore = Math.round(Math.max(1, Math.min(100, rawScore)) * 100) / 100;

    return {
      driverId: driver.driverId,
      driverName: driver.fullName,
      score: finalScore,
      distanceKm: Math.round(distanceKm * 100) / 100,
      etaMinutes,
      breakdown: {
        distanceScore: Math.round(distanceScore * 10) / 10,
        ratingScore: Math.round(ratingScore * 10) / 10,
        acceptanceScore: Math.round(acceptanceScore * 10) / 10,
        cancellationScore: Math.round(cancellationScore * 10) / 10,
        hardwareScore: Math.round(hardwareScore * 10) / 10,
        financialScore: Math.round(financialScore * 10) / 10
      }
    };
  }

  /**
   * Fórmula del semiverseno (Haversine) para cálculo de distancias sobre una esfera (radio de la Tierra = 6371 Km).
   */
  private static getHaversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Radio de la Tierra en km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLng = this.deg2rad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private static deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
