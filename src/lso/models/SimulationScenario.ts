// ============================================================================
// ZÉNITH MASTER - LABORATORIO DE SIMULACIÓN OPERACIONAL (LSO)
// Layer  : Domain / Models
// File   : SimulationScenario.ts
// ============================================================================

import { SimulationScenario as ScenarioType, TrafficLevel, WeatherType } from '../types/lso_types';

/**
 * Modelo que representa la configuración detallada de un escenario de simulación.
 * Define modificadores ambientales y operacionales que alteran las constantes físicas del simulador.
 */
export interface SimulationScenarioConfig {
  /**
   * Identificador del escenario (perteneciente al enum SimulationScenario)
   */
  id: ScenarioType;

  /**
   * Nombre legible del escenario
   */
  name: string;

  /**
   * Descripción del propósito de la prueba de estrés
   */
  description: string;

  /**
   * Nivel de densidad vehicular en las rutas de Trujillo
   */
  trafficLevel: TrafficLevel;

  /**
   * Condición climatológica predominante
   */
  weather: WeatherType;

  /**
   * Modificador de velocidad de conducción (factor de fricción climatológico/tráfico)
   * ej. 0.7 indica que los conductores van un 30% más lento
   */
  speedModifier: number;

  /**
   * Factor de recargo de tarifas simulado (Surge Multiplier)
   */
  priceMultiplier: number;

  /**
   * Frecuencia e intensidad estimada de fallas de red / desconexiones
   * 'none' | 'low' | 'high'
   */
  signalDisruptionLevel: 'none' | 'low' | 'high';

  /**
   * Latencia de red artificial simulada para escrituras y lecturas de Firestore (en ms)
   */
  simulatedNetworkLatencyMs: number;

  /**
   * Indica si se forzará una desconexión simulada de Firebase a mitad del ejercicio
   */
  triggerFirebaseOutage: boolean;

  /**
   * Minuto de simulación en el que ocurre el outage (si aplica)
   */
  outageStartMinute: number | null;

  /**
   * Duración en minutos virtuales del corte de servicio/red
   */
  outageDurationMinutes: number | null;
}
