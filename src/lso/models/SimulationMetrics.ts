// ============================================================================
// ZÉNITH MASTER - LABORATORIO DE SIMULACIÓN OPERACIONAL (LSO)
// Layer  : Domain / Models
// File   : SimulationMetrics.ts
// ============================================================================

/**
 * Estructura de telemetría y contabilidad del LSO para monitorear en tiempo real.
 * Reúne métricas operacionales de viajes, de rendimiento tecnológico y de costos cloud.
 */
export interface SimulationMetrics {
  /**
   * Viajes simulados activos en este instante
   */
  activeRides: number;

  /**
   * Total acumulado de viajes completados con éxito
   */
  completedRides: number;

  /**
   * Total acumulado de viajes cancelados por pasajeros o conductores
   */
  cancelledRides: number;

  /**
   * Cantidad de conductores virtuales conectados en línea
   */
  activeDrivers: number;

  /**
   * Conductores virtuales actualmente ocupados o asignados a un servicio
   */
  busyDrivers: number;

  /**
   * Tiempo promedio de espera del pasajero desde que solicita el viaje hasta que se le asigna (en segundos)
   */
  averageWaitingTimeSeconds: number;

  /**
   * Tiempo promedio transcurrido entre la creación de una oferta de negociación y su aceptación (en segundos)
   */
  averageAcceptanceTimeSeconds: number;

  /**
   * Tiempo promedio transcurrido desde que inicia el viaje hasta la entrega en destino (en segundos)
   */
  averageDeliveryTimeSeconds: number;

  /**
   * Ingresos simulados brutos generados en moneda local (S/.) o USD
   */
  simulatedRevenue: number;

  /**
   * Contador de escrituras simuladas que se habrían realizado en Firebase Firestore
   */
  firestoreWrites: number;

  /**
   * Contador de lecturas simuladas que se habrían realizado en Firebase Firestore
   */
  firestoreReads: number;

  /**
   * Costo estimado aproximado en USD de las operaciones de Firestore de la simulación activa
   * calculando tarifas estándar de Firebase (ej: $0.18 por millón de lecturas, $1.08 por millón de escrituras)
   */
  estimatedFirebaseCostUsd: number;

  /**
   * Uso de memoria simulado/real medido durante el proceso (en Megabytes)
   */
  memoryUsageMb: number;

  /**
   * Cuadros por segundo (FPS) del render de mapas o loops de simulación
   */
  fps: number;

  /**
   * Uso simulado o real de CPU expresado en porcentaje (0% - 100%)
   */
  cpuUsagePercentage: number;

  /**
   * Tiempo de funcionamiento de la simulación activa en segundos virtuales
   */
  simulatedUptimeSeconds: number;
}
