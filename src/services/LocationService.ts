// ============================================================================
// ZÉNITH
// Module : Location / GPS
// Layer  : Domain / Services
// File   : LocationService.ts
// ============================================================================

import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Location } from '../types';

export enum GPSMode {
  SIMULATION = 'SIMULATION',
  PRODUCTION = 'PRODUCTION'
}

export interface GPSStatus {
  precision: number;       // in meters
  signalLoss: boolean;     // signal loss indicator
  mode: GPSMode;           // current GPS mode
}

type StatusListener = (status: GPSStatus) => void;

class LocationService {
  private activeWatchId: number | null = null;
  private activeIntervalId: NodeJS.Timeout | null = null;
  private reconnectTimeoutId: NodeJS.Timeout | null = null;
  private currentMode: GPSMode = GPSMode.SIMULATION;
  private listeners: Set<StatusListener> = new Set();

  // Intelligent Update state caches to save battery & Firestore write costs
  private lastLat: number = 0;
  private lastLng: number = 0;
  private lastWriteTime: number = 0;

  // Signal state
  private isSignalLost: boolean = false;
  private currentPrecision: number = 5.0; // Simulated meters accuracy

  constructor() {
    const savedMode = localStorage.getItem('zenith_gps_mode');
    if (savedMode === GPSMode.PRODUCTION) {
      this.currentMode = GPSMode.PRODUCTION;
    } else {
      this.currentMode = GPSMode.SIMULATION;
    }
  }

  /**
   * Register a callback to observe GPS statuses like signal strength, mode, and accuracy.
   */
  public subscribeToStatus(listener: StatusListener): () => void {
    this.listeners.add(listener);
    // Send immediate initial status
    listener({
      precision: this.currentPrecision,
      signalLoss: this.isSignalLost,
      mode: this.currentMode
    });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const status: GPSStatus = {
      precision: this.currentPrecision,
      signalLoss: this.isSignalLost,
      mode: this.currentMode
    };
    this.listeners.forEach(listener => listener(status));
  }

  /**
   * Toggles the operational GPS mode and persists the choice.
   */
  public setGPSMode(mode: GPSMode): void {
    this.currentMode = mode;
    localStorage.setItem('zenith_gps_mode', mode);
    console.log(`[ZENITH-GPS] Mode transitioned to: ${mode}`);
    this.notifyListeners();
  }

  /**
   * Retrieves the current active GPS mode.
   */
  public getGPSMode(): GPSMode {
    return this.currentMode;
  }

  /**
   * Haversine formula to compute distance in meters between two coordinates.
   */
  private computeDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371e3; // Earth's radius in meters
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
   * Evaluates if we should write coordinates to Firestore.
   * Battery saving strategy: Skip writes if movement is less than 5 meters AND less than 20 seconds have elapsed.
   */
  private shouldWriteUpdate(lat: number, lng: number): boolean {
    const now = Date.now();
    if (this.lastWriteTime === 0) return true;

    const distanceMoved = this.computeDistance(this.lastLat, this.lastLng, lat, lng);
    const timeElapsed = now - this.lastWriteTime;

    // Force write anyway if 20 seconds have passed to keep the pulse active
    if (timeElapsed > 20000) return true;

    // Write if driver moved more than 5 meters
    return distanceMoved >= 5.0;
  }

  /**
   * Starts real-time tracking of the operator's position and streams updates to Firestore.
   */
  public startTracking(
    rideId: string,
    origin: Location,
    destination: Location,
    onUpdate?: (location: Location) => void
  ): void {
    this.stopTracking();

    console.log(`[ZENITH-GPS] Initializing smart tracking in ${this.currentMode} mode for Ride: ${rideId}`);
    this.isSignalLost = false;
    this.currentPrecision = this.currentMode === GPSMode.PRODUCTION ? 4.2 : 5.0;
    this.notifyListeners();

    if (this.currentMode === GPSMode.PRODUCTION && navigator.geolocation) {
      this.activeWatchId = navigator.geolocation.watchPosition(
        async (position) => {
          // Check for simulated signal recovery if it was lost
          if (this.isSignalLost) {
            this.isSignalLost = false;
            console.log('[ZENITH-GPS] Production GPS Signal RECOVERED.');
          }

          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          this.currentPrecision = position.coords.accuracy;
          this.notifyListeners();

          // Intelligent Update Check
          if (!this.shouldWriteUpdate(lat, lng)) {
            console.log('[ZENITH-GPS] Location update throttled (Battery & Firestore write optimized).');
            return;
          }

          const updatedLoc: Location = {
            address: `Socio en Tránsito - Precisión: ${this.currentPrecision.toFixed(1)}m`,
            lat,
            lng
          };

          this.lastLat = lat;
          this.lastLng = lng;
          this.lastWriteTime = Date.now();

          console.log(`[ZENITH-GPS] Production GPS Write: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
          
          try {
            await setDoc(doc(db, 'rides', rideId), {
              driverLocation: updatedLoc,
              updatedAt: serverTimestamp()
            }, { merge: true });

            if (onUpdate) {
              onUpdate(updatedLoc);
            }
          } catch (error) {
            console.error('[ZENITH-GPS] Error writing production coordinates:', error);
          }
        },
        (error) => {
          console.error('[ZENITH-GPS] Production watchPosition failed. Triggering auto-reconnection flow...', error);
          this.isSignalLost = true;
          this.notifyListeners();
          
          // Intelligent reconnection loop
          this.reconnectTimeoutId = setTimeout(() => {
            console.log('[ZENITH-GPS] Reconnection attempt: Routing fallback to Simulation...');
            this.startSimulationTracking(rideId, origin, destination, onUpdate);
          }, 5000);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      this.startSimulationTracking(rideId, origin, destination, onUpdate);
    }
  }

  /**
   * Starts simulation path interpolation from origin to destination with signal loss events.
   */
  private startSimulationTracking(
    rideId: string,
    origin: Location,
    destination: Location,
    onUpdate?: (location: Location) => void
  ): void {
    let step = 0;
    const totalSteps = 10;

    this.activeIntervalId = setInterval(async () => {
      // Simulate brief signal loss (10% probability) for UI verification
      const roll = Math.random();
      if (roll < 0.1 && !this.isSignalLost) {
        this.isSignalLost = true;
        this.currentPrecision = 150.0; // degraded accuracy
        this.notifyListeners();
        console.warn('[ZENITH-GPS] Simulated signal loss event triggered.');
        return;
      }

      if (this.isSignalLost) {
        // Automatic Signal recovery
        this.isSignalLost = false;
        this.currentPrecision = 4.8;
        this.notifyListeners();
        console.log('[ZENITH-GPS] Simulated signal recovered automatically.');
      }

      if (step >= totalSteps) {
        if (this.activeIntervalId) {
          clearInterval(this.activeIntervalId);
          this.activeIntervalId = null;
        }
        return;
      }
      step++;

      const lat = origin.lat + (destination.lat - origin.lat) * (step / totalSteps);
      const lng = origin.lng + (destination.lng - origin.lng) * (step / totalSteps);

      // Fluctuating precision simulation
      this.currentPrecision = 4.0 + Math.random() * 2.5;
      this.notifyListeners();

      if (!this.shouldWriteUpdate(lat, lng)) {
        console.log('[ZENITH-GPS] Simulated update throttled.');
        return;
      }

      const simulatedLoc: Location = {
        address: `Móvil Operativo en Tránsito - Paso ${step}/${totalSteps}`,
        lat,
        lng
      };

      this.lastLat = lat;
      this.lastLng = lng;
      this.lastWriteTime = Date.now();

      console.log(`[ZENITH-GPS] Simulated Step ${step}/${totalSteps}: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);

      try {
        await setDoc(doc(db, 'rides', rideId), {
          driverLocation: simulatedLoc,
          updatedAt: serverTimestamp()
        }, { merge: true });

        if (onUpdate) {
          onUpdate(simulatedLoc);
        }
      } catch (error) {
        console.error('[ZENITH-GPS] Error writing simulation coordinates:', error);
      }
    }, 4000);
  }

  /**
   * Stops any active tracking and releases system resources.
   */
  public stopTracking(): void {
    if (this.activeWatchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.activeWatchId);
      this.activeWatchId = null;
      console.log('[ZENITH-GPS] Production GPS watcher stopped.');
    }

    if (this.activeIntervalId !== null) {
      clearInterval(this.activeIntervalId);
      this.activeIntervalId = null;
      console.log('[ZENITH-GPS] Simulation GPS interval stopped.');
    }

    if (this.reconnectTimeoutId !== null) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    this.isSignalLost = false;
    this.notifyListeners();
  }
}

export const locationService = new LocationService();
