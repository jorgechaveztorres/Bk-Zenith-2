// ============================================================================
// ZÉNITH MASTER - LABORATORIO DE SIMULACIÓN OPERACIONAL (LSO)
// Layer  : Domain / Types
// File   : lso_types.ts
// ============================================================================

/**
 * Representa los estados posibles de una simulación global dentro del LSO.
 */
export enum SimulationStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  STOPPED = 'STOPPED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

/**
 * Escenarios operacionales predefinidos para pruebas de estrés.
 */
export enum SimulationScenario {
  OFF_PEAK = 'OFF_PEAK',         // Hora valle con tráfico bajo y demanda normal
  RUSH_HOUR = 'RUSH_HOUR',       // Hora punta con alta demanda y tráfico congestionado
  RAIN = 'RAIN',                 // Lluvia persistente, reduce velocidad y aumenta precios
  ACCIDENT = 'ACCIDENT',         // Accidente que bloquea vías y altera rutas de conductores
  EXTREME_DEMAND = 'EXTREME_DEMAND', // Demanda masiva que satura la asignación de conductores
  NETWORK_DROP = 'NETWORK_DROP', // Caída parcial de red móvil para conductores virtuales
  FIREBASE_DROP = 'FIREBASE_DROP', // Simulación de desconexión total o latencia extrema con Firebase
  AUTO_RECOVERY = 'AUTO_RECOVERY' // Escenario de caída de red seguido por una recuperación automática
}

/**
 * Tipos de eventos generados por el motor de eventos de la simulación.
 */
export enum SimulationEventType {
  RIDE_CREATED = 'RIDE_CREATED',
  RIDE_OFFER_MADE = 'RIDE_OFFER_MADE',
  RIDE_OFFER_ACCEPTED = 'RIDE_OFFER_ACCEPTED',
  RIDE_OFFER_REJECTED = 'RIDE_OFFER_REJECTED',
  RIDE_COMPLETED = 'RIDE_COMPLETED',
  RIDE_CANCELLED = 'RIDE_CANCELLED',
  GPS_POSITION_UPDATED = 'GPS_POSITION_UPDATED',
  DRIVER_STATE_CHANGED = 'DRIVER_STATE_CHANGED',
  NETWORK_LOST = 'NETWORK_LOST',
  NETWORK_RESTORED = 'NETWORK_RESTORED',
  FIREBASE_ERROR = 'FIREBASE_ERROR',
  FIREBASE_RECONNECTED = 'FIREBASE_RECONNECTED',
  SYSTEM_ALERT = 'SYSTEM_ALERT',
  TEST_LOG = 'TEST_LOG'
}

/**
 * Estados operacionales de un conductor virtual en simulación.
 */
export enum DriverState {
  OFFLINE = 'OFFLINE',
  IDLE = 'IDLE',
  OFFERING = 'OFFERING',
  ASSIGNED = 'ASSIGNED',
  PICKING_UP = 'PICKING_UP',
  ARRIVED = 'ARRIVED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED'
}

/**
 * Estados posibles de un viaje virtual dentro de la simulación.
 */
export enum RideState {
  PENDING = 'PENDING',
  NEGOTIATING = 'NEGOTIATING',
  ACCEPTED = 'ACCEPTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

/**
 * Estado de conectividad de los nodos virtuales con el servidor.
 */
export enum NetworkState {
  CONNECTED = 'CONNECTED',
  UNSTABLE = 'UNSTABLE',
  DISCONNECTED = 'DISCONNECTED'
}

/**
 * Calidad de la señal GPS simulada de un conductor.
 */
export enum GpsState {
  EXCELLENT = 'EXCELLENT',
  GOOD = 'GOOD',
  POOR = 'POOR',
  LOST = 'LOST'
}

/**
 * Estatus final de validaciones automatizadas para los subsistemas.
 */
export enum ValidationStatus {
  PASS = 'PASS',
  WARNING = 'WARNING',
  FAIL = 'FAIL'
}

/**
 * Tipos de clima que afectan la simulación.
 */
export enum WeatherType {
  SUNNY = 'SUNNY',
  CLOUDY = 'CLOUDY',
  RAINY = 'RAINY',
  STORMY = 'STORMY'
}

/**
 * Niveles de congestión de tráfico para el motor de rutas.
 */
export enum TrafficLevel {
  LOW = 'LOW',
  MODERATE = 'MODERATE',
  HIGH = 'HIGH',
  JAMMED = 'JAMMED'
}

/**
 * Factor de aceleración de tiempo de la simulación.
 */
export enum SimulationSpeed {
  X1 = 'X1',
  X2 = 'X2',
  X5 = 'X5',
  X10 = 'X10',
  X25 = 'X25',
  X50 = 'X50'
}

/**
 * Coordenadas de geolocalización estándares.
 */
export interface GPSCoordinates {
  lat: number;
  lng: number;
}

/**
 * Estructura de segmento de ruta simulada.
 */
export interface RouteSegment {
  start: GPSCoordinates;
  end: GPSCoordinates;
  distanceMeters: number;
  durationSeconds: number;
  trafficModifier: number;
}

/**
 * Ruta completa simulada entre dos puntos.
 */
export interface SimulationRoute {
  origin: GPSCoordinates;
  destination: GPSCoordinates;
  waypoints: GPSCoordinates[];
  segments: RouteSegment[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
}

/**
 * Estado de batería del vehículo simulado.
 */
export interface BatteryStatus {
  percentage: number;       // 0 a 100
  isCharging: boolean;      // Indica si está cargando
  depletionRate: number;    // Velocidad de descarga por minuto simulado
}
