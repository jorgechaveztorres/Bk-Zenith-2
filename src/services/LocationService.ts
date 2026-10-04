import { Capacitor } from '@capacitor/core';
import { Geolocation, type Position, type WatchPositionCallback } from '@capacitor/geolocation';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Location } from '../types';

export enum GPSMode {
  SIMULATION = 'SIMULATION',
  PRODUCTION = 'PRODUCTION'
}

export interface GPSStatus {
  precision: number;
  signalLoss: boolean;
  mode: GPSMode;
}

type StatusListener = (status: GPSStatus) => void;

class LocationService {
  private activeWatchId: string | null = null;
  private activeBrowserWatchId: number | null = null;
  private activeIntervalId: ReturnType<typeof setInterval> | null = null;
  private currentMode: GPSMode = GPSMode.SIMULATION;
  private listeners = new Set<StatusListener>();
  private lastLat = 0;
  private lastLng = 0;
  private lastWriteTime = 0;
  private isSignalLost = false;
  private currentPrecision = 5;

  constructor() {
    this.currentMode = localStorage.getItem('zenith_gps_mode') === GPSMode.PRODUCTION
      ? GPSMode.PRODUCTION : GPSMode.SIMULATION;
  }

  public subscribeToStatus(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener({ precision: this.currentPrecision, signalLoss: this.isSignalLost, mode: this.currentMode });
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener({
      precision: this.currentPrecision,
      signalLoss: this.isSignalLost,
      mode: this.currentMode
    }));
  }

  public setGPSMode(mode: GPSMode): void {
    this.currentMode = mode;
    localStorage.setItem('zenith_gps_mode', mode);
    this.notifyListeners();
  }

  public getGPSMode(): GPSMode {
    return this.currentMode;
  }

  public async requestPermission(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      const permissions = await Geolocation.requestPermissions();
      return permissions.location === 'granted' || permissions.coarseLocation === 'granted';
    }
    if (!navigator.geolocation) return false;
    return new Promise(resolve => navigator.geolocation.getCurrentPosition(
      () => resolve(true),
      () => resolve(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    ));
  }

  public async checkPermission(): Promise<'granted' | 'denied' | 'prompt'> {
    if (Capacitor.isNativePlatform()) {
      const permissions = await Geolocation.checkPermissions();
      if (permissions.location === 'granted' || permissions.coarseLocation === 'granted') return 'granted';
      if (permissions.location === 'denied' || permissions.coarseLocation === 'denied') return 'denied';
      return 'prompt';
    }
    if (!navigator.permissions) return 'prompt';
    try {
      return (await navigator.permissions.query({ name: 'geolocation' })).state;
    } catch {
      return 'prompt';
    }
  }

  private computeDistance(a: number, b: number, c: number, d: number): number {
    const R = 6371e3;
    const p1 = a * Math.PI / 180;
    const p2 = c * Math.PI / 180;
    const dp = (c - a) * Math.PI / 180;
    const dl = (d - b) * Math.PI / 180;
    const x = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  private shouldWriteUpdate(lat: number, lng: number): boolean {
    if (this.lastWriteTime === 0) return true;
    return Date.now() - this.lastWriteTime > 20000 ||
      this.computeDistance(this.lastLat, this.lastLng, lat, lng) >= 5;
  }

  private async persistLocation(rideId: string, position: Position, onUpdate?: (location: Location) => void): Promise<void> {
    this.currentPrecision = position.coords.accuracy;
    this.notifyListeners();
    const { latitude: lat, longitude: lng } = position.coords;
    if (!this.shouldWriteUpdate(lat, lng)) return;

    const location: Location = {
      address: `Socio en Tránsito - Precisión: ${this.currentPrecision.toFixed(1)}m`,
      lat,
      lng
    };
    this.lastLat = lat;
    this.lastLng = lng;
    this.lastWriteTime = Date.now();

    try {
      await setDoc(doc(db, 'rides', rideId), { driverLocation: location, updatedAt: serverTimestamp() }, { merge: true });
      onUpdate?.(location);
    } catch (error) {
      console.error('[ZENITH-GPS] Error writing coordinates:', error);
    }
  }

  public startTracking(rideId: string, origin: Location, destination: Location, onUpdate?: (location: Location) => void): void {
    this.stopTracking();
    this.isSignalLost = false;
    this.notifyListeners();

    if (this.currentMode !== GPSMode.PRODUCTION) {
      this.startSimulationTracking(rideId, origin, destination, onUpdate);
      return;
    }

    if (Capacitor.isNativePlatform()) {
      void this.startNativeTracking(rideId, onUpdate);
      return;
    }

    if (navigator.geolocation) {
      this.activeBrowserWatchId = navigator.geolocation.watchPosition(
        position => void this.persistLocation(rideId, position as unknown as Position, onUpdate),
        () => this.handleLocationError(),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      this.handleLocationError();
    }
  }

  private async startNativeTracking(rideId: string, onUpdate?: (location: Location) => void): Promise<void> {
    try {
      const permission = await this.checkPermission();
      if (permission !== 'granted' && !(await this.requestPermission())) {
        this.handleLocationError();
        return;
      }

      const callback: WatchPositionCallback = (position, error) => {
        if (error || !position) {
          this.handleLocationError();
          return;
        }
        void this.persistLocation(rideId, position, onUpdate);
      };

      this.activeWatchId = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
        callback
      );
    } catch (error) {
      console.error('[ZENITH-GPS] Native GPS initialization failed:', error);
      this.handleLocationError();
    }
  }

  private handleLocationError(): void {
    this.isSignalLost = true;
    this.notifyListeners();
  }

  private startSimulationTracking(rideId: string, origin: Location, destination: Location, onUpdate?: (location: Location) => void): void {
    let step = 0;
    const totalSteps = 10;
    this.activeIntervalId = setInterval(() => {
      if (++step > totalSteps) {
        this.stopSimulationTimerOnly();
        return;
      }
      const position: Position = {
        coords: {
          latitude: origin.lat + (destination.lat - origin.lat) * (step / totalSteps),
          longitude: origin.lng + (destination.lng - origin.lng) * (step / totalSteps),
          accuracy: 5,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null
        },
        timestamp: Date.now()
      };
      void this.persistLocation(rideId, position, onUpdate);
    }, 4000);
  }

  private stopSimulationTimerOnly(): void {
    if (this.activeIntervalId !== null) {
      clearInterval(this.activeIntervalId);
      this.activeIntervalId = null;
    }
  }

  public stopTracking(): void {
    if (this.activeWatchId !== null) {
      void Geolocation.clearWatch({ id: this.activeWatchId }).catch(() => undefined);
      this.activeWatchId = null;
    }
    if (this.activeBrowserWatchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.activeBrowserWatchId);
      this.activeBrowserWatchId = null;
    }
    this.stopSimulationTimerOnly();
    this.isSignalLost = false;
    this.notifyListeners();
  }
}

export const locationService = new LocationService();
