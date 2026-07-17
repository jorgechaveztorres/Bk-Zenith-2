// ============================================================================
// ZÉNITH
// Module : Tracking / ETA Engine
// Layer  : Domain / Services
// File   : EtaEngine.ts
// ============================================================================

import { Location } from '../types';

export interface EtaResult {
  remainingDistanceMeters: number;
  remainingTimeMinutes: number;
  etaTime: Date;
  averageSpeedKmh: number;
  instantSpeedKmh: number;
  stoppedTimeSeconds: number;
}

export class EtaEngineClass {
  // Compute distance in meters using Haversine
  public computeDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371e3; // Earth radius in meters
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
   * Calculates the full ETA package between a current driver position and the destination/passenger.
   * Standard default speed is 30 km/h for urban transit if average is not yet stable.
   */
  public calculateEta(
    current: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    history: { lat: number; lng: number; timestamp: number }[] = [],
    stoppedTimeSeconds: number = 0
  ): EtaResult {
    const remainingDistanceMeters = this.computeDistance(current.lat, current.lng, destination.lat, destination.lng);

    // Calculate instant speed from the last two historical positions
    let instantSpeedKmh = 0;
    if (history.length >= 2) {
      const last = history[history.length - 1];
      const prev = history[history.length - 2];
      const dist = this.computeDistance(prev.lat, prev.lng, last.lat, last.lng);
      const timeSec = (last.timestamp - prev.timestamp) / 1000;

      if (timeSec > 0) {
        instantSpeedKmh = (dist / timeSec) * 3.6; // convert m/s to km/h
      }
    }

    // Calculate average speed from history, fallback to 30 km/h
    let averageSpeedKmh = 30.0;
    if (history.length >= 2) {
      const first = history[0];
      const last = history[history.length - 1];
      const totalDist = history.reduce((sum, p, i) => {
        if (i === 0) return sum;
        const prev = history[i - 1];
        return sum + this.computeDistance(prev.lat, prev.lng, p.lat, p.lng);
      }, 0);
      const totalTimeSec = (last.timestamp - first.timestamp) / 1000;

      if (totalTimeSec > 5) {
        const calculatedAvg = (totalDist / totalTimeSec) * 3.6;
        if (calculatedAvg > 2.0 && calculatedAvg < 150.0) {
          averageSpeedKmh = calculatedAvg;
        }
      }
    }

    // Standard traffic buffer multiplier
    const trafficMultiplier = 1.25;
    // Calculate remaining time in minutes
    // Time = Distance / Speed
    const speedMs = (averageSpeedKmh / 3.6) || 8.33; // 8.33 m/s approx 30 km/h
    const remainingTimeSeconds = (remainingDistanceMeters / speedMs) * trafficMultiplier;
    const remainingTimeMinutes = Math.max(1, Math.round(remainingTimeSeconds / 60));

    // Calculate ETA Time
    const etaTime = new Date();
    etaTime.setSeconds(etaTime.getSeconds() + remainingTimeSeconds);

    return {
      remainingDistanceMeters: Math.round(remainingDistanceMeters),
      remainingTimeMinutes,
      etaTime,
      averageSpeedKmh: parseFloat(averageSpeedKmh.toFixed(1)),
      instantSpeedKmh: parseFloat(instantSpeedKmh.toFixed(1)),
      stoppedTimeSeconds
    };
  }
}

export const EtaEngine = new EtaEngineClass();
