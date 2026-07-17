// ============================================================================
// ZÉNITH
// Module : Tracking / Route Deviation Engine
// Layer  : Domain / Services
// File   : RouteDeviationEngine.ts
// ============================================================================

import { AuditEngine } from './AuditEngine';
import { NotificationService } from './NotificationService';
import { LoggingService } from './LoggingService';

export enum DeviationLevel {
  NONE = 'NONE',
  SLIGHT = 'SLIGHT',     // < 50 meters
  MEDIUM = 'MEDIUM',     // 50-200 meters
  CRITICAL = 'CRITICAL'  // > 200 meters
}

export class RouteDeviationEngineClass {
  // Haversine distance helper
  private computeDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371e3;
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Evaluates the driver's current coordinates against the pre-calculated routing path.
   * If the routing path is empty, we interpolate a path from origin to destination for zero-trust fallback.
   */
  public evaluateDeviation(
    current: { lat: number; lng: number },
    routePoints: { lat: number; lng: number }[],
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
  ): { level: DeviationLevel; distanceMeters: number } {
    let referencePoints = [...routePoints];

    // Zero-trust fallback: Interpolate 20 points along a straight path if routing data is missing
    if (referencePoints.length < 2) {
      referencePoints = [];
      const steps = 20;
      for (let i = 0; i <= steps; i++) {
        referencePoints.push({
          lat: origin.lat + (destination.lat - origin.lat) * (i / steps),
          lng: origin.lng + (destination.lng - origin.lng) * (i / steps)
        });
      }
    }

    // Find the closest point in the reference path
    let minDistance = Infinity;
    for (const point of referencePoints) {
      const dist = this.computeDistance(current.lat, current.lng, point.lat, point.lng);
      if (dist < minDistance) {
        minDistance = dist;
      }
    }

    let level = DeviationLevel.NONE;
    if (minDistance > 200) {
      level = DeviationLevel.CRITICAL;
    } else if (minDistance > 50) {
      level = DeviationLevel.MEDIUM;
    } else if (minDistance > 10) {
      level = DeviationLevel.SLIGHT;
    }

    return { level, distanceMeters: Math.round(minDistance) };
  }

  /**
   * Processes critical route deviations.
   * Registers an immutable audit, alerts the passenger, the driver, and the central fleet administrator.
   */
  public async handleCriticalDeviation(
    rideId: string,
    passengerId: string,
    driverId: string,
    passengerName: string,
    driverName: string,
    distanceMeters: number,
    currentLocation: { lat: number; lng: number }
  ): Promise<void> {
    LoggingService.warn('ROUTE_DEVIATION', `¡DESVIACIÓN CRÍTICA DETECTADA! El conductor se desvió ${distanceMeters}m del trayecto seguro para el viaje ${rideId}`);

    // 1. Audit Log (Inmutable)
    await AuditEngine.logEvent({
      eventType: 'SECURITY_ALERT',
      severity: 'CRITICAL',
      actorId: driverId,
      actorName: driverName,
      description: `Desviación crítica de ruta detectada (${distanceMeters} metros fuera del trayecto protegido).`,
      metadata: {
        rideId,
        passengerId,
        passengerName,
        driverId,
        driverName,
        deviationDistanceMeters: distanceMeters,
        lat: currentLocation.lat,
        lng: currentLocation.lng,
        timestampString: new Date().toISOString()
      }
    });

    // 2. Notify Passenger
    await NotificationService.send(
      passengerId,
      '¡Alerta de Desviación!',
      `Detectamos un cambio de rumbo inesperado de ${distanceMeters} metros. Su seguridad es prioridad; nuestro centro de monitoreo ha sido notificado.`,
      'alert'
    );

    // 3. Notify Driver
    await NotificationService.send(
      driverId,
      '¡Alerta de Ruta Correctiva!',
      `Se encuentra fuera del trayecto sugerido por ${distanceMeters}m. Por favor regrese a la ruta o póngase en contacto con la central.`,
      'alert'
    );

    // 4. Notify System Admin (via generic central notification system or mock console action)
    // We can broadcast to any active admins or simply write to a fleet_alerts collection.
    // Let's write an alert to a fleet_alerts Firestore collection for the fleet monitor to subscribe to.
    try {
      const { db } = await import('../firebase/config');
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      await addDoc(collection(db, 'fleet_alerts'), {
        rideId,
        driverId,
        driverName,
        passengerId,
        passengerName,
        deviationDistanceMeters: distanceMeters,
        lat: currentLocation.lat,
        lng: currentLocation.lng,
        type: 'ROUTE_DEVIATION',
        timestamp: serverTimestamp(),
        resolved: false
      });
    } catch (err) {
      LoggingService.error('ROUTE_DEVIATION', 'Falla al guardar alerta de flota en base de datos', err);
    }
  }
}

export const RouteDeviationEngine = new RouteDeviationEngineClass();
