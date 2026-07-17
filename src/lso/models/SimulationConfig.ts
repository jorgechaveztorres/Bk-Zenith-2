// ============================================================================
// ZÉNITH MASTER - LABORATORIO DE SIMULACIÓN OPERACIONAL (LSO)
// Layer  : Domain / Models
// File   : SimulationConfig.ts
// ============================================================================

import { SimulationSpeed } from '../types/lso_types';

/**
 * Modelo central de configuración para una instancia de simulación del LSO.
 * Permite parametrizar el comportamiento y la intensidad de la carga operacional.
 */
export interface SimulationConfig {
  /**
   * Identificador único de la configuración
   */
  id: string;

  /**
   * Nombre representativo de la configuración (ej. "Stress Test Rush Hour")
   */
  name: string;

  /**
   * Cantidad de conductores virtuales a instanciar y controlar simultáneamente.
   * Valores soportados: 10, 25, 50, 100, 200, 500.
   */
  driverCount: number;

  /**
   * Cantidad de pedidos/viajes a simular en la sesión.
   * Valores soportados: 1, 5, 10, 25, 50, 100, 250, 500.
   */
  rideCount: number;

  /**
   * Velocidad o factor multiplicador del tiempo en la simulación.
   */
  speed: SimulationSpeed;

  /**
   * Duración total máxima de la sesión de simulación en minutos virtuales.
   */
  durationMinutes: number;

  /**
   * Frecuencia de actualización de la posición GPS de los conductores (en segundos reales).
   */
  gpsIntervalSeconds: number;

  /**
   * Probabilidad (0.0 a 1.0) de que un pasajero virtual cancele un pedido iniciado.
   */
  cancelProbability: number;

  /**
   * Probabilidad (0.0 a 1.0) de que se realicen contraofertas de tarifa entre conductor y pasajero.
   */
  counterOfferProbability: number;

  /**
   * Probabilidad (0.0 a 1.0) de que ocurra lluvia durante la simulación.
   */
  rainProbability: number;

  /**
   * Probabilidad (0.0 a 1.0) de que ocurra un accidente que bloquee rutas de tránsito.
   */
  accidentProbability: number;

  /**
   * Probabilidad (0.0 a 1.0) de pérdida de señal móvil/GPS en los conductores.
   */
  signalLossProbability: number;

  /**
   * Probabilidad (0.0 a 1.0) de simular fallas parciales o totales de conexión de red/Firebase.
   */
  firebaseFailureProbability: number;

  /**
   * Semilla aleatoria utilizada para la generación reproducible de pedidos y posiciones.
   * Permite repetir las condiciones exactas de una simulación para depurar bugs.
   */
  randomSeed: string;

  /**
   * Fecha y hora de creación de la configuración
   */
  createdAt: string;
}
