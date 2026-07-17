// ============================================================================
// ZÉNITH MASTER - LABORATORIO DE SIMULACIÓN OPERACIONAL (LSO)
// Layer  : Domain / Models
// File   : Simulation.ts
// ============================================================================

import { SimulationStatus } from '../types/lso_types';
import { SimulationConfig } from './SimulationConfig';
import { SimulationScenarioConfig } from './SimulationScenario';
import { SimulationDriver } from './SimulationDriver';
import { SimulationRide } from './SimulationRide';
import { SimulationMetrics } from './SimulationMetrics';
import { SimulationEvent } from './SimulationEvent';

/**
 * Modelo de estado del motor de simulación activo (LSO Session).
 * Mantiene la referencia completa en memoria del ecosistema virtualizado durante el tiempo de ejecución.
 */
export interface SimulationSession {
  /**
   * Identificador único de la sesión de simulación activa
   */
  id: string;

  /**
   * Estado operacional actual del motor de simulación
   */
  status: SimulationStatus;

  /**
   * Configuración de entrada asignada a esta sesión
   */
  config: SimulationConfig;

  /**
   * Escenario operacional ambiental configurado para el experimento
   */
  scenario: SimulationScenarioConfig;

  /**
   * Catálogo indexado por UID de todos los conductores virtuales participando en la simulación
   */
  drivers: Record<string, SimulationDriver>;

  /**
   * Catálogo indexado por ID de todos los viajes virtuales gestionados en la sesión
   */
  rides: Record<string, SimulationRide>;

  /**
   * Métricas operacionales y de sistema agregadas en tiempo real
   */
  currentMetrics: SimulationMetrics;

  /**
   * Historial cronológico de eventos registrados desde el arranque de la sesión
   */
  events: SimulationEvent[];

  /**
   * Timestamp ISO que representa la fecha y hora de inicio de la simulación
   */
  realStartTime: string;

  /**
   * Hora virtual actual simulada dentro del LSO (en formato ISO)
   */
  virtualTime: string;

  /**
   * Segundos virtuales totales transcurridos desde el inicio de esta simulación
   */
  virtualElapsedSeconds: number;

  /**
   * Semilla aleatoria actual en uso (derivada de la configuración o autogenerada)
   */
  activeSeed: string;

  /**
   * Descripción del último error de ejecución crítico si el estado es FAILED
   */
  lastError: string | null;
}
