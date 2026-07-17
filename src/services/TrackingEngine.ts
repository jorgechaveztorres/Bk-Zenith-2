// ============================================================================
// ZÉNITH
// Module : Tracking / Live Tracking Engine
// Layer  : Domain / Services
// File   : TrackingEngine.ts
// ============================================================================

import { db } from '../firebase/config';
import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { EtaEngine } from './EtaEngine';
import { RouteDeviationEngine, DeviationLevel } from './RouteDeviationEngine';
import { AuditEngine } from './AuditEngine';
import { LoggingService } from './LoggingService';

export interface TrackingStats {
  elapsedSeconds: number;
  distanceMeters: number;
  currentSpeedKmh: number;
  avgSpeedKmh: number;
  etaMinutes: number;
  stoppedSeconds: number;
  lastUpdated: number;
}

export interface GpsState {
  precision: number;
  signalLoss: boolean;
  frozen: boolean;
  impossibleSpeedDetected: boolean;
  spoofingDetected: boolean;
}

class TrackingEngineClass {
  // In-memory caches to evaluate historical coordinates, frozen signals, and speed violations
  private rideHistories: Map<string, { lat: number; lng: number; timestamp: number }[]> = new Map();
  private stoppedAccumulators: Map<string, number> = new Map();
  private lastMovementTimes: Map<string, number> = new Map();
  private accumulatedDistances: Map<string, number> = new Map();
  private startTimes: Map<string, number> = new Map();
  private lastFiredAlerts: Map<string, { [key: string]: number }> = new Map();

  /**
   * Initializes tracking caches for a new active ride journey.
   */
  public startRideTracking(rideId: string, startTime: number = Date.now()): void {
    this.rideHistories.set(rideId, []);
    this.stoppedAccumulators.set(rideId, 0);
    this.lastMovementTimes.set(rideId, startTime);
    this.accumulatedDistances.set(rideId, 0);
    this.startTimes.set(rideId, startTime);
    this.lastFiredAlerts.set(rideId, {});
    
    LoggingService.info('TRACKING_ENGINE', `[Zénith] Registro inicial de tracking activado para viaje: ${rideId}`);
    
    AuditEngine.logEvent({
      eventType: 'SECURITY_ALERT',
      severity: 'INFO',
      actorId: 'SYSTEM',
      actorName: 'TrackingEngine',
      description: `Inicio del protocolo de tracking en tiempo real para el viaje ${rideId}`,
      metadata: { rideId, timestamp: startTime }
    });
  }

  /**
   * Resets and cleans up caches for a finalized journey.
   */
  public stopRideTracking(rideId: string): void {
    this.rideHistories.delete(rideId);
    this.stoppedAccumulators.delete(rideId);
    this.lastMovementTimes.delete(rideId);
    this.accumulatedDistances.delete(rideId);
    this.startTimes.delete(rideId);
    this.lastFiredAlerts.delete(rideId);

    LoggingService.info('TRACKING_ENGINE', `[Zénith] Caches de seguimiento liberados para viaje: ${rideId}`);

    AuditEngine.logEvent({
      eventType: 'SECURITY_ALERT',
      severity: 'INFO',
      actorId: 'SYSTEM',
      actorName: 'TrackingEngine',
      description: `Fin del protocolo de tracking en tiempo real para el viaje ${rideId}`,
      metadata: { rideId, timestamp: Date.now() }
    });
  }

  /**
   * Process a new GPS location reading from a driver.
   * Performs an array of Zero-Trust checks, calculates distance, ETA, deviations, and updates Firestore selectively.
   */
  public async processDriverLocation(params: {
    rideId: string;
    driverId: string;
    driverName: string;
    passengerId: string;
    passengerName: string;
    lat: number;
    lng: number;
    precision: number;
    batteryLevel: number;
    isInternetStable: boolean;
    routePoints?: { lat: number; lng: number }[];
    originLoc: { lat: number; lng: number };
    destinationLoc: { lat: number; lng: number };
  }): Promise<{ stats: TrackingStats; gpsState: GpsState; deviationLevel: DeviationLevel } | null> {
    const {
      rideId,
      driverId,
      driverName,
      passengerId,
      passengerName,
      lat,
      lng,
      precision,
      batteryLevel,
      isInternetStable,
      routePoints = [],
      originLoc,
      destinationLoc
    } = params;

    const now = Date.now();

    // Ensure caches are initialized
    if (!this.rideHistories.has(rideId)) {
      this.startRideTracking(rideId, now);
    }

    const history = this.rideHistories.get(rideId) || [];
    const prevLoc = history.length > 0 ? history[history.length - 1] : null;

    let distanceMoved = 0;
    let timeElapsedSeconds = 0;
    let isFrozen = false;
    let isImpossibleSpeed = false;
    let isSpoofingDetected = false;
    let isGpsSignalLost = precision > 100 || !isInternetStable;

    if (prevLoc) {
      distanceMoved = EtaEngine.computeDistance(prevLoc.lat, prevLoc.lng, lat, lng);
      timeElapsedSeconds = (now - prevLoc.timestamp) / 1000;

      // 1. Detect Impossible Speeds (Zero-Trust Guard)
      // Speed threshold set at 150 km/h (41.6 m/s)
      if (timeElapsedSeconds > 0) {
        const speedKmh = (distanceMoved / timeElapsedSeconds) * 3.6;
        if (speedKmh > 150.0 && distanceMoved > 100) {
          isImpossibleSpeed = true;
          LoggingService.warn('TRACKING_ENGINE', `¡VELOCIDAD IMPOSIBLE DETECTADA! Conductor ${driverName} moviéndose a ${speedKmh.toFixed(1)} km/h`);
          this.triggerAlertOnce(rideId, 'IMPOSSIBLE_SPEED', async () => {
            await AuditEngine.logEvent({
              eventType: 'SECURITY_ALERT',
              severity: 'CRITICAL',
              actorId: driverId,
              actorName: driverName,
              description: `Alerta de velocidad física imposible: ${speedKmh.toFixed(1)} km/h. Sospecha de spoofing o salto de coordenadas.`,
              metadata: { rideId, speedKmh, lat, lng, distanceMoved, timeElapsedSeconds }
            });
          });
        }

        // 2. Detect Coordinates Spoofing Jumps (>1.5 km in <5s)
        if (distanceMoved > 1500 && timeElapsedSeconds < 5) {
          isSpoofingDetected = true;
          LoggingService.error('TRACKING_ENGINE', `¡SALTO ABRUPTO DE COORDENADAS DETECTADO! Conductor ${driverName} saltó ${distanceMoved.toFixed(0)}m en ${timeElapsedSeconds.toFixed(1)}s`);
          this.triggerAlertOnce(rideId, 'COORDINATE_SPOOF', async () => {
            await AuditEngine.logEvent({
              eventType: 'SECURITY_ALERT',
              severity: 'CRITICAL',
              actorId: driverId,
              actorName: driverName,
              description: `Salto abrupto de ubicación detectado (${distanceMoved.toFixed(0)}m en ${timeElapsedSeconds.toFixed(1)}s). Bloqueo de telemetría sugerido.`,
              metadata: { rideId, distanceMoved, timeElapsedSeconds, lat, lng }
            });
          });
        }
      }

      // 3. Detect Frozen GPS (Coordinates unvaried for > 40s during travel)
      const lastMovementTime = this.lastMovementTimes.get(rideId) || now;
      if (distanceMoved > 2.0) {
        this.lastMovementTimes.set(rideId, now);
      } else {
        const secondsFrozen = (now - lastMovementTime) / 1000;
        if (secondsFrozen > 40) {
          isFrozen = true;
          LoggingService.warn('TRACKING_ENGINE', `¡GPS CONGELADO DETECTADO! Las coordenadas de ${driverName} no han variado por ${secondsFrozen.toFixed(0)}s`);
          this.triggerAlertOnce(rideId, 'GPS_FREEZE', async () => {
            await AuditEngine.logEvent({
              eventType: 'SECURITY_ALERT',
              severity: 'WARNING',
              actorId: driverId,
              actorName: driverName,
              description: `Sensor de ubicación congelado detectado durante trayecto activo (sin cambios de coordenadas en 40s).`,
              metadata: { rideId, secondsFrozen, lat, lng }
            });
          });
        }
      }
    }

    // Accumulate distance covered if normal movement is validated
    let accumulatedDistance = this.accumulatedDistances.get(rideId) || 0;
    if (!isImpossibleSpeed && !isSpoofingDetected && distanceMoved > 1.5) {
      accumulatedDistance += distanceMoved;
      this.accumulatedDistances.set(rideId, accumulatedDistance);
    }

    // Accumulate stopped seconds (instant speed < 2.5 km/h)
    let currentSpeedKmh = 0;
    if (prevLoc && timeElapsedSeconds > 0) {
      currentSpeedKmh = (distanceMoved / timeElapsedSeconds) * 3.6;
    }
    let stoppedSeconds = this.stoppedAccumulators.get(rideId) || 0;
    if (prevLoc && currentSpeedKmh < 2.5) {
      stoppedSeconds += timeElapsedSeconds;
      this.stoppedAccumulators.set(rideId, stoppedSeconds);

      // Log stopping event once at 30s threshold
      if (stoppedSeconds >= 30) {
        this.triggerAlertOnce(rideId, 'STATIONARY_DETENTION', async () => {
          await AuditEngine.logEvent({
            eventType: 'SECURITY_ALERT',
            severity: 'INFO',
            actorId: driverId,
            actorName: driverName,
            description: `Detención prolongada detectada en ruta (detenido por más de 30 segundos).`,
            metadata: { rideId, stoppedSeconds, lat, lng }
          });
        });
      }
    } else if (currentSpeedKmh >= 2.5 && stoppedSeconds > 10) {
      // Vehicle resumed motion
      const priorDetention = stoppedSeconds;
      this.stoppedAccumulators.set(rideId, 0); // reset
      await AuditEngine.logEvent({
        eventType: 'SECURITY_ALERT',
        severity: 'INFO',
        actorId: driverId,
        actorName: driverName,
        description: `Reanudación de trayecto después de una detención de ${priorDetention.toFixed(0)} segundos.`,
        metadata: { rideId, lat, lng }
      });
    }

    // Log GPS signal loss / recovery
    if (isGpsSignalLost) {
      this.triggerAlertOnce(rideId, 'GPS_LOSS', async () => {
        await AuditEngine.logEvent({
          eventType: 'SECURITY_ALERT',
          severity: 'WARNING',
          actorId: driverId,
          actorName: driverName,
          description: `Pérdida de señal GPS de alta precisión detectada. Precisión reportada: ${precision}m. Estabilidad de internet: ${isInternetStable}`,
          metadata: { rideId, precision, isInternetStable }
        });
      });
    } else if (prevLoc && (prevLoc.lat !== lat || prevLoc.lng !== lng)) {
      // If precision was bad before and is good now, log recovery
      const hadGpsLoss = (this.lastFiredAlerts.get(rideId)?.['GPS_LOSS'] || 0) > 0;
      if (hadGpsLoss && precision <= 15) {
        // Reset alert state
        const alerts = this.lastFiredAlerts.get(rideId) || {};
        delete alerts['GPS_LOSS'];
        this.lastFiredAlerts.set(rideId, alerts);

        await AuditEngine.logEvent({
          eventType: 'SECURITY_ALERT',
          severity: 'INFO',
          actorId: driverId,
          actorName: driverName,
          description: `Señal de posicionamiento GPS de alta precisión restablecida (${precision.toFixed(1)}m).`,
          metadata: { rideId, precision }
        });
      }
    }

    // 4. Update coordinates history cache
    history.push({ lat, lng, timestamp: now });
    // Keep last 15 elements to optimize memory footprint
    if (history.length > 15) {
      history.shift();
    }
    this.rideHistories.set(rideId, history);

    // 5. Evaluate Route Deviation
    const { level: deviationLevel, distanceMeters: deviationDistance } = RouteDeviationEngine.evaluateDeviation(
      { lat, lng },
      routePoints,
      originLoc,
      destinationLoc
    );

    if (deviationLevel === DeviationLevel.CRITICAL) {
      this.triggerAlertOnce(rideId, 'CRITICAL_DEVIATION', async () => {
        await RouteDeviationEngine.handleCriticalDeviation(
          rideId,
          passengerId,
          driverId,
          passengerName,
          driverName,
          deviationDistance,
          { lat, lng }
        );
      });
    }

    // 6. Calculate continuous ETA details
    const etaRes = EtaEngine.calculateEta(
      { lat, lng },
      destinationLoc,
      history,
      stoppedSeconds
    );

    const startTime = this.startTimes.get(rideId) || now;
    const elapsedSeconds = Math.round((now - startTime) / 1000);

    const stats: TrackingStats = {
      elapsedSeconds,
      distanceMeters: Math.round(accumulatedDistance),
      currentSpeedKmh: etaRes.instantSpeedKmh,
      avgSpeedKmh: etaRes.averageSpeedKmh,
      etaMinutes: etaRes.remainingTimeMinutes,
      stoppedSeconds: Math.round(stoppedSeconds),
      lastUpdated: now
    };

    const gpsState: GpsState = {
      precision,
      signalLoss: isGpsSignalLost,
      frozen: isFrozen,
      impossibleSpeedDetected: isImpossibleSpeed,
      spoofingDetected: isSpoofingDetected
    };

    // 7. Write consolidated tracking packets directly to the Firestore `rides` collection
    try {
      const rideRef = doc(db, 'rides', rideId);
      await updateDoc(rideRef, {
        driverLocation: {
          address: `Socio en Tránsito - Precisión: ${precision.toFixed(1)}m`,
          lat,
          lng
        },
        trackingStats: stats,
        gpsState: {
          precision,
          signalLoss: isGpsSignalLost,
          frozen: isFrozen,
          batteryLevel,
          impossibleSpeedDetected: isImpossibleSpeed,
          spoofingDetected: isSpoofingDetected
        },
        routeDeviation: {
          level: deviationLevel,
          distanceMeters: deviationDistance
        },
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      LoggingService.error('TRACKING_ENGINE', `Error actualizando Firestore con datos consolidados de tracking para ${rideId}`, err);
    }

    return { stats, gpsState, deviationLevel };
  }

  /**
   * Helper to execute a security notification or audit event only once per session or with an interval block
   */
  private triggerAlertOnce(rideId: string, alertKey: string, alertFn: () => Promise<void>): void {
    const alerts = this.lastFiredAlerts.get(rideId) || {};
    const lastTime = alerts[alertKey] || 0;
    const now = Date.now();

    // 40 seconds throttle for repetitive tracking alerts
    if (now - lastTime > 40000) {
      alerts[alertKey] = now;
      this.lastFiredAlerts.set(rideId, alerts);
      alertFn().catch(err => {
        LoggingService.error('TRACKING_ENGINE', `Error disparando alerta de tracking ${alertKey}`, err);
      });
    }
  }
}

export const TrackingEngine = new TrackingEngineClass();
