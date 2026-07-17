// ============================================================================
// ZÉNITH MASTER - LABORATORIO DE SIMULACIÓN OPERACIONAL (LSO)
// Layer  : Domain / Models
// File   : SimulationReport.ts
// ============================================================================

import { ValidationStatus } from '../types/lso_types';
import { SimulationConfig } from './SimulationConfig';
import { SimulationScenarioConfig } from './SimulationScenario';
import { SimulationMetrics } from './SimulationMetrics';
import { SimulationEvent } from './SimulationEvent';

/**
 * Detalle del resultado de la validación automatizada de un subsistema específico.
 */
export interface SubsystemValidationResult {
  /**
   * Estado de validación final (PASS, WARNING, FAIL)
   */
  status: ValidationStatus;

  /**
   * Puntuación porcentual obtenida (de 0 a 100) según criterios de éxito
   */
  score: number;

  /**
   * Descripción textual o justificación del veredicto del subsistema
   */
  details: string;

  /**
   * Lista de errores, advertencias o logs de falla descubiertos en este subsistema
   */
  anomaliesDetected: string[];
}

/**
 * Agrupación de todas las validaciones automatizadas de subsistemas de ZÉNITH.
 */
export interface SystemValidations {
  gps: SubsystemValidationResult;
  pricing: SubsystemValidationResult;
  firestore: SubsystemValidationResult;
  notifications: SubsystemValidationResult;
  wallet: SubsystemValidationResult;
  historial: SubsystemValidationResult;
  favoritos: SubsystemValidationResult;
  controlCenter: SubsystemValidationResult;
  dashboard: SubsystemValidationResult;
}

/**
 * Reporte consolidado definitivo generado tras concluir una sesión de simulación en el LSO.
 * Contiene resúmenes operacionales, telemetrías máximas, fallas capturadas e indicadores de estrés.
 */
export interface SimulationReport {
  /**
   * Identificador único del reporte
   */
  id: string;

  /**
   * Copia de la configuración utilizada para ejecutar la prueba
   */
  configuration: SimulationConfig;

  /**
   * Copia del escenario operacional de estrés simulado
   */
  scenario: SimulationScenarioConfig;

  /**
   * Métricas finales agregadas al término del ejercicio
   */
  finalMetrics: SimulationMetrics;

  /**
   * Resultados detallados de la autovalidación de calidad de todos los subsistemas de ZÉNITH
   */
  validations: SystemValidations;

  /**
   * Conclusión general de salud operativa del sistema bajo esta carga de estrés
   */
  overallStatus: ValidationStatus;

  /**
   * Cantidad absoluta de errores críticos detectados durante la simulación
   */
  totalErrorsLogged: number;

  /**
   * Fecha y hora en formato ISO del inicio del experimento
   */
  startedAt: string;

  /**
   * Fecha y hora en formato ISO de la conclusión del experimento
   */
  endedAt: string;

  /**
   * Listado total secuencial de eventos / trazas de auditoría generadas en la sesión
   */
  eventsLog: SimulationEvent[];
}
