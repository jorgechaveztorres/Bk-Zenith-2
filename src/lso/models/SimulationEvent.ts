// ============================================================================
// ZÉNITH MASTER - LABORATORIO DE SIMULACIÓN OPERACIONAL (LSO)
// Layer  : Domain / Models
// File   : SimulationEvent.ts
// ============================================================================

import { SimulationEventType } from '../types/lso_types';

/**
 * Evento estructurado generado por el motor de eventos de simulación.
 * Se utiliza para auditar el comportamiento del sistema, calcular costos, registrar errores y reproducir estados.
 */
export interface SimulationEvent {
  /**
   * Identificador único secuencial del evento
   */
  id: string;

  /**
   * Timestamp virtual de simulación en formato ISO
   */
  timestamp: string;

  /**
   * Timestamp real del reloj del sistema (para medición de latencias reales)
   */
  realTimestamp: string;

  /**
   * Clasificación o tipo específico del evento
   */
  type: SimulationEventType;

  /**
   * Descripción literal humanamente entendible de lo ocurrido
   */
  message: string;

  /**
   * Identificador del conductor virtual asociado (si aplica)
   */
  driverId?: string;

  /**
   * Identificador del viaje/pedido virtual asociado (si aplica)
   */
  rideId?: string;

  /**
   * Datos estructurados específicos o metadatos de depuración adjuntos al evento
   */
  payload?: Record<string, any>;

  /**
   * Latencia de procesamiento medida o inyectada en milisegundos
   */
  latencyMs?: number;

  /**
   * Impacto de consumo simulado en el almacenamiento Firestore para este evento concreto
   */
  firestoreImpact?: {
    reads: number;
    writes: number;
  };
}
