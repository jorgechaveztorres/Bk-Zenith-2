import { LoggingService } from './LoggingService';
import { User, Location } from '../types';

export interface DriverAssignmentScore {
  driverId: string;
  driverName: string;
  distanceKm: number;
  etaMinutes: number;
  zenithTrustScore: number; // Índice de confianza Zénith (0-100) basado en rating y aceptación
  matchingPriorityScore: number; // Puntuación de emparejamiento final
}

export interface IAssignmentEngine {
  findOptimalDriver(rideOrigin: Location, availableDrivers: User[]): Promise<DriverAssignmentScore | null>;
  rankDriversByPriority(rideOrigin: Location, availableDrivers: User[]): Promise<DriverAssignmentScore[]>;
}

export class AssignmentEngineClass implements IAssignmentEngine {
  
  /**
   * Calcula el Índice de Confianza Zénith (ZTS) del conductor
   */
  calculateZenithTrustScore(driver: User): number {
    // Rating base va de 1 a 5, convertimos proporcionalmente a base 80
    const ratingScore = driver.rating ? (driver.rating / 5.0) * 80 : 80;
    
    // Penalización/Bonificación simulada. En prod considera tasas de cancelación y reportes de seguridad.
    const historicalReliability = 20; 
    
    const finalScore = Math.min(100, Math.max(0, ratingScore + historicalReliability));
    return Math.round(finalScore);
  }

  /**
   * Calcula la distancia haversina simple entre dos ubicaciones
   */
  private getDistanceKm(loc1: Location, loc2: Location): number {
    const R = 6371; // Radio de la Tierra en Km
    const dLat = (loc2.lat - loc1.lat) * (Math.PI / 180);
    const dLng = (loc2.lng - loc1.lng) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(loc1.lat * (Math.PI / 180)) *
        Math.cos(loc2.lat * (Math.PI / 180)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async rankDriversByPriority(rideOrigin: Location, availableDrivers: User[]): Promise<DriverAssignmentScore[]> {
    try {
      LoggingService.info('ASSIGNMENT_ENGINE', `Evaluando prioridad de emparejamiento para ${availableDrivers.length} conductores disponibles`);

      const ranked = availableDrivers.map(driver => {
        // En producción se obtiene la ubicación en tiempo real del conductor desde Redis o Firestore GeoFirestore
        const driverLocationMock: Location = driver.favorites && driver.favorites.length > 0 
          ? { lat: driver.favorites[0].lat, lng: driver.favorites[0].lng, address: driver.favorites[0].address }
          : { lat: rideOrigin.lat + 0.01, lng: rideOrigin.lng + 0.01, address: 'Operador Cercano' };

        const distanceKm = this.getDistanceKm(rideOrigin, driverLocationMock);
        
        // Asumiendo velocidad urbana promedio de 30 km/h -> 2 min por km + 2 min buffer
        const etaMinutes = Math.round((distanceKm / 30) * 60 + 2);
        
        const zts = this.calculateZenithTrustScore(driver);

        // Algoritmo de Prioridad Democrática Zénith (Evita el favoritismo o manipulación de listas)
        // La prioridad final pondera: 60% Proximidad y 40% Índice de Confianza (ZTS)
        const proximityWeight = Math.max(0, 100 - (distanceKm * 15)); // Penaliza fuertemente más allá de 6.6 km
        const matchingPriorityScore = Math.round((proximityWeight * 0.6) + (zts * 0.4));

        return {
          driverId: driver.uid,
          driverName: driver.fullName,
          distanceKm: Math.round(distanceKm * 100) / 100,
          etaMinutes,
          zenithTrustScore: zts,
          matchingPriorityScore
        };
      });

      // Ordenar descendentemente por puntuación de prioridad de coincidencia
      const sorted = ranked.sort((a, b) => b.matchingPriorityScore - a.matchingPriorityScore);
      
      LoggingService.debug('ASSIGNMENT_ENGINE', 'Ranking de emparejamiento completado con éxito', sorted);
      return sorted;
    } catch (error) {
      LoggingService.error('ASSIGNMENT_ENGINE', 'Error al calcular ranking de emparejamiento', error);
      throw error;
    }
  }

  async findOptimalDriver(rideOrigin: Location, availableDrivers: User[]): Promise<DriverAssignmentScore | null> {
    try {
      if (availableDrivers.length === 0) {
        LoggingService.warn('ASSIGNMENT_ENGINE', 'Búsqueda de conductor óptimo cancelada: No hay conductores disponibles.');
        return null;
      }

      const ranked = await this.rankDriversByPriority(rideOrigin, availableDrivers);
      const optimal = ranked[0] || null;

      if (optimal) {
        LoggingService.info('ASSIGNMENT_ENGINE', `Conductor óptimo asignado automáticamente: ${optimal.driverName} (ZTS: ${optimal.zenithTrustScore}, Prioridad: ${optimal.matchingPriorityScore})`);
      }
      return optimal;
    } catch (error) {
      LoggingService.error('ASSIGNMENT_ENGINE', 'Error al buscar conductor óptimo', error);
      throw error;
    }
  }
}

export const AssignmentEngine = new AssignmentEngineClass();
