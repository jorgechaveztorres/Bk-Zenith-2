// ============================================================================
// ZÉNITH
// Module : Tracking / Passenger Tracking Service
// Layer  : Domain / Services
// File   : PassengerTrackingService.ts
// ============================================================================

import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Ride } from '../types';
import { TrackingStats, GpsState } from './TrackingEngine';
import { DeviationLevel } from './RouteDeviationEngine';
import { LoggingService } from './LoggingService';

export interface TrackingTelemetry {
  driverLocation?: { lat: number; lng: number; address: string };
  stats?: TrackingStats;
  gpsState?: GpsState;
  deviation?: { level: DeviationLevel; distanceMeters: number };
  status: string;
}

export class PassengerTrackingServiceClass {
  /**
   * Establishes a real-time reactive subscription to the telemetry data of an active trip.
   * Feeds the client map and HUD with current location, precise ETA metrics, and sensor status.
   */
  public subscribeToRideTelemetry(
    rideId: string,
    onTelemetryReceived: (telemetry: TrackingTelemetry) => void,
    onError?: (error: Error) => void
  ): () => void {
    LoggingService.info('PASSENGER_TRACKING', `Subscribing to active telemetry for ride: ${rideId}`);

    const rideRef = doc(db, 'rides', rideId);

    const unsubscribe = onSnapshot(
      rideRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          LoggingService.warn('PASSENGER_TRACKING', `Document for ride ${rideId} does not exist.`);
          return;
        }

        const data = snapshot.data();
        
        const telemetry: TrackingTelemetry = {
          driverLocation: data.driverLocation,
          stats: data.trackingStats,
          gpsState: data.gpsState,
          deviation: data.routeDeviation,
          status: data.status
        };

        onTelemetryReceived(telemetry);
      },
      (error) => {
        LoggingService.error('PASSENGER_TRACKING', `Subscription failed for ride ${rideId}`, error);
        if (onError) {
          onError(error);
        }
      }
    );

    return unsubscribe;
  }
}

export const PassengerTrackingService = new PassengerTrackingServiceClass();
