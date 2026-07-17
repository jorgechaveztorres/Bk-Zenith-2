// ============================================================================
// ZÉNITH MASTER - LABORATORIO DE SIMULACIÓN OPERACIONAL (LSO)
// Layer  : Domain / Models
// File   : SimulationDriver.ts
// ============================================================================

import { GPSCoordinates, DriverState, BatteryStatus, NetworkState, GpsState } from '../types/lso_types';

/**
 * Representa a un conductor virtual operando dentro de la simulación del LSO.
 * Contiene tanto datos de identidad como métricas de estado físico y de red simuladas.
 */
export interface SimulationDriver {
  /**
   * Identificador único (UID) del conductor virtual
   */
  uid: string;

  /**
   * Nombre completo del conductor
   */
  name: string;

  /**
   * Calificación o Rating histórico del conductor (de 1.0 a 5.0)
   */
  rating: number;

  /**
   * Posición geográfica actual del conductor (Latitud/Longitud)
   */
  position: GPSCoordinates;

  /**
   * Estado operacional actual en el ciclo de vida del viaje
   */
  state: DriverState;

  /**
   * Velocidad actual de desplazamiento simulado en km/h
   */
  speedKmh: number;

  /**
   * Dirección de orientación en grados (Heading, de 0 a 359)
   */
  bearing: number;

  /**
   * Estado simulado de batería física del dispositivo móvil/vehículo
   */
  battery: BatteryStatus;

  /**
   * Calidad de la conexión de red inalámbrica del terminal móvil
   */
  networkState: NetworkState;

  /**
   * Calidad e integridad de la recepción de señal satelital GPS
   */
  gpsState: GpsState;

  /**
   * ID del viaje activo si el conductor está asignado, recogiendo o en viaje
   */
  activeRideId: string | null;

  /**
   * Patente o placa del vehículo simulado
   */
  vehiclePlate: string;

  /**
   * Tipo de vehículo (ej. "moto", "auto")
   */
  vehicleType: 'car' | 'motorcycle';

  /**
   * Total de viajes completados por este conductor durante la sesión actual
   */
  ridesCompletedInSession: number;

  /**
   * Indica si el conductor virtual ha perdido conexión repentinamente (falla inducida)
   */
  isConnectionDropped: boolean;

  /**
   * Timestamp de la última actualización de estado (en formato ISO de tiempo virtual)
   */
  lastUpdated: string;
}
