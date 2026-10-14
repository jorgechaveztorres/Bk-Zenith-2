import { Capacitor } from '@capacitor/core';
import { Geolocation, Position, PermissionStatus as GeoPermissionStatus } from '@capacitor/geolocation';
import { Camera, CameraPermissionType } from '@capacitor/camera';
import { Haptics, NotificationType, ImpactStyle } from '@capacitor/haptics';

export interface ZenithPermissionReport {
  isNative: boolean;
  platform: string;
  location: 'granted' | 'denied' | 'prompt' | 'unknown';
  camera: 'granted' | 'denied' | 'prompt' | 'unknown';
}

class NativePlatformService {
  public isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  public getPlatform(): string {
    return Capacitor.getPlatform();
  }

  /**
   * Solicita proactivamente todos los permisos nativos en Android al inicio o en el onboarding
   */
  public async requestCorePermissions(): Promise<ZenithPermissionReport> {
    const isNat = this.isNative();
    let locationStatus: 'granted' | 'denied' | 'prompt' | 'unknown' = 'unknown';
    let cameraStatus: 'granted' | 'denied' | 'prompt' | 'unknown' = 'unknown';

    if (isNat) {
      try {
        // 1. Permiso nativo de Ubicación (GPS fino y aproximado)
        const geoPerm = await Geolocation.requestPermissions({
          permissions: ['location', 'coarseLocation']
        });
        locationStatus = geoPerm.location === 'granted' ? 'granted' : (geoPerm.location === 'denied' ? 'denied' : 'prompt');
      } catch (err) {
        console.warn('[NATIVE_BRIDGE] Error solicitando permisos de ubicación nativos:', err);
      }

      try {
        // 2. Permiso nativo de Cámara (para comprobantes de entrega o vouchers)
        const camPerm = await Camera.requestPermissions({
          permissions: ['camera', 'photos']
        });
        cameraStatus = camPerm.camera === 'granted' ? 'granted' : (camPerm.camera === 'denied' ? 'denied' : 'prompt');
      } catch (err) {
        console.warn('[NATIVE_BRIDGE] Error solicitando permisos de cámara nativos:', err);
      }
    } else {
      // Entorno Web estándar
      if (typeof window !== 'undefined' && 'geolocation' in navigator) {
        try {
          if (navigator.permissions && navigator.permissions.query) {
            const status = await navigator.permissions.query({ name: 'geolocation' as any });
            locationStatus = status.state;
          }
        } catch {
          locationStatus = 'prompt';
        }
      }
      cameraStatus = 'granted'; // La web solicitará al disparar input file / getUserMedia
    }

    return {
      isNative: isNat,
      platform: this.getPlatform(),
      location: locationStatus,
      camera: cameraStatus
    };
  }

  /**
   * Obtiene la posición actual usando el canal nativo de Capacitor en Android o fallback web
   */
  public async getCurrentPosition(): Promise<{ lat: number; lng: number; accuracy?: number }> {
    if (this.isNative()) {
      try {
        const pos: Position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000
        });
        return {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        };
      } catch (nativeErr) {
        console.warn('[NATIVE_BRIDGE] Fallback a geolocalización web tras error nativo:', nativeErr);
      }
    }

    // Fallback estándar en navegador
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !navigator.geolocation) {
        return reject(new Error('Geolocalización no soportada en este entorno.'));
      }
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy
        }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );
    });
  }

  /**
   * Vibración háptica nativa cuando entra una nueva orden de delivery o abordaje
   */
  public async notifyOrderAlert(): Promise<void> {
    if (!this.isNative()) return;
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch {
      // Ignorar si el dispositivo no soporta hápticos
    }
  }

  public async tapFeedback(): Promise<void> {
    if (!this.isNative()) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      // Ignorar
    }
  }
}

export const nativePlatform = new NativePlatformService();
