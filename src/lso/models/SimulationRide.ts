// ============================================================================
// ZÉNITH MASTER - LABORATORIO DE SIMULACIÓN OPERACIONAL (LSO)
// Layer  : Domain / Models
// File   : SimulationRide.ts
// ============================================================================

import { GPSCoordinates, RideState, SimulationRoute } from '../types/lso_types';

/**
 * Representa una contraoferta o negociación dentro del flujo del pedido virtual.
 */
export interface SimulationOfferNegotiation {
  offerId: string;
  senderUid: string;
  senderRole: 'driver' | 'passenger';
  amount: number;
  timestamp: string; // ISO string virtual
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
}

/**
 * Modelo completo de un pedido o viaje virtual dentro del LSO.
 * Contiene coordenadas, ruta simulada, precios calculados y trazas temporales.
 */
export interface SimulationRide {
  /**
   * Identificador único de viaje virtual
   */
  id: string;

  /**
   * Identificador del pasajero virtual que generó el pedido
   */
  passengerId: string;

  /**
   * Nombre completo del pasajero simulado
   */
  passengerName: string;

  /**
   * Identificador del conductor virtual asignado (si lo hubiere)
   */
  driverId: string | null;

  /**
   * Nombre completo del conductor asignado
   */
  driverName: string | null;

  /**
   * Punto geográfico y dirección de origen del viaje
   */
  origin: GPSCoordinates & { address: string };

  /**
   * Punto geográfico y dirección de destino del viaje
   */
  destination: GPSCoordinates & { address: string };

  /**
   * Distancia de conducción real calculada en metros
   */
  distanceMeters: number;

  /**
   * Duración aproximada de viaje en segundos
   */
  estimatedDurationSeconds: number;

  /**
   * Tarifa base inicial sugerida calculada mediante Pricing Engine
   */
  suggestedPrice: number;

  /**
   * Tarifa de mutuo acuerdo final posterior a la negociación de ofertas
   */
  finalPrice: number | null;

  /**
   * Estado actual del viaje virtual
   */
  state: RideState;

  /**
   * Estructura geométrica y de segmentos de la ruta a seguir por el conductor
   */
  route: SimulationRoute | null;

  /**
   * Índice del waypoint o punto de ruta actual en el que se encuentra el conductor
   */
  currentWaypointIndex: number;

  /**
   * Historial cronológico de negociaciones y ofertas de precio
   */
  negotiations: SimulationOfferNegotiation[];

  /**
   * Calificación o puntuación otorgada al finalizar el viaje (1.0 a 5.0)
   */
  rating: number | null;

  /**
   * Comentarios/Feedback simulado del pasajero
   */
  feedback: string | null;

  /**
   * Tiempos de ciclo de vida del pedido (Timestamps ISO en tiempo de simulación)
   */
  timestamps: {
    created: string;
    accepted: string | null;
    pickupArrived: string | null;
    started: string | null;
    completed: string | null;
    cancelled: string | null;
  };
}
