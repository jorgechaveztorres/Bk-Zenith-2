import { doc, setDoc, getDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { DocumentStatus, User } from '../types';

export interface DriverOnlineStatus {
  driverId: string;
  fullName: string;
  email: string;
  phone: string;
  category: string;
  plate: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  gpsPrecision: 'high' | 'optimized';
  batteryLevel: number; // 0.0 to 1.0
  isBatteryCritical: boolean;
  hasInternet: boolean;
  isGpsActive: boolean;
  status: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
  lastActive: any; // serverTimestamp()
  licenseExpiry: string;
  isBlocked: boolean;
  documentStatus: DocumentStatus;
  rating: number;
}

export class DriverPresenceService {
  private static collectionName = 'drivers_online';

  /**
   * Pone en línea a un conductor evaluando todas las condiciones de seguridad Zero-Trust.
   */
  static async goOnline(user: User, params: {
    lat: number;
    lng: number;
    speed: number;
    heading: number;
    gpsPrecision: 'high' | 'optimized';
    batteryLevel: number;
    hasInternet: boolean;
    isGpsActive: boolean;
  }): Promise<{ allowed: boolean; reason?: string }> {
    // 1. Verificación de Seguridad Crítica en Backend (Zero-Trust)
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      return { allowed: false, reason: 'CONTRATO_NULO: Conductor no existe en la base de datos central.' };
    }

    const userData = userSnap.data() as User;
    const isBlocked = userData.isBlocked === true;
    const documentStatus = userData.driverProfile?.status || DocumentStatus.PENDING;
    const vehicle = userData.driverProfile?.vehicle;
    const docData = userData.driverProfile?.documentation;

    if (isBlocked) {
      return { allowed: false, reason: 'DISCIPLINA: Cuenta actualmente bloqueada por infracciones de seguridad.' };
    }

    if (documentStatus !== DocumentStatus.APPROVED) {
      return { allowed: false, reason: `VALIDACIÓN: Su expediente actual tiene estado ${documentStatus}. Debe ser APPROVED para operar.` };
    }

    if (!vehicle || !docData) {
      return { allowed: false, reason: 'EXPEDIENTE: Estructura del perfil o vehículo incompleta.' };
    }

    // Comprobación de vigencia de licencia
    const isExpired = this.checkLicenseExpired(docData.licenseExpiry);
    if (isExpired) {
      return { allowed: false, reason: 'EXPEDIENTE: Su licencia de conducir se encuentra vencida.' };
    }

    // Comprobaciones físicas del hardware del operador
    if (params.batteryLevel < 0.15) {
      return { allowed: false, reason: 'HARDWARE: Batería inferior al 15% (Nivel crítico de desconexión preventiva).' };
    }

    if (!params.isGpsActive) {
      return { allowed: false, reason: 'HARDWARE: Señal GPS inactiva o bloqueada por el dispositivo.' };
    }

    if (!params.hasInternet) {
      return { allowed: false, reason: 'HARDWARE: Conectividad inestable o nula registrada por el motor.' };
    }

    // Si pasa todos los filtros de validación Zero-Trust, se registra en drivers_online
    const presenceData: DriverOnlineStatus = {
      driverId: user.uid,
      fullName: userData.fullName || 'Operador Zenith',
      email: userData.email,
      phone: userData.phone || '',
      category: vehicle.category || 'PRO',
      plate: vehicle.plate,
      lat: params.lat,
      lng: params.lng,
      speed: params.speed || 0,
      heading: params.heading || 0,
      gpsPrecision: params.gpsPrecision,
      batteryLevel: params.batteryLevel,
      isBatteryCritical: params.batteryLevel < 0.20,
      hasInternet: params.hasInternet,
      isGpsActive: params.isGpsActive,
      status: 'AVAILABLE',
      lastActive: serverTimestamp(),
      licenseExpiry: docData.licenseExpiry,
      isBlocked,
      documentStatus,
      rating: userData.driverProfile?.rating || userData.rating || 5.0
    };

    await setDoc(doc(db, this.collectionName, user.uid), presenceData);

    // Actualizamos también su driverProfile local para sincronización del radar
    await updateDoc(userRef, {
      'driverProfile.availability': true,
      'driverProfile.gps': {
        lat: params.lat,
        lng: params.lng,
        updatedAt: new Date().toISOString()
      },
      'driverProfile.lastConnection': new Date().toISOString()
    });

    return { allowed: true };
  }

  /**
   * Retira de forma segura al conductor de la red activa de despacho.
   */
  static async goOffline(driverId: string): Promise<void> {
    await deleteDoc(doc(db, this.collectionName, driverId));
    
    const userRef = doc(db, 'users', driverId);
    await updateDoc(userRef, {
      'driverProfile.availability': false,
      'driverProfile.lastConnection': new Date().toISOString()
    });
  }

  /**
   * Actualización periódica optimizada de la ubicación GPS y telemetría del operador.
   * Filtra por "movimiento significativo" en el cliente para no saturar Firestore.
   */
  static async updateLocation(driverId: string, params: {
    lat: number;
    lng: number;
    speed: number;
    heading: number;
    batteryLevel: number;
    hasInternet: boolean;
    isGpsActive: boolean;
  }): Promise<void> {
    const docRef = doc(db, this.collectionName, driverId);
    
    // Verificamos si existe el registro para evitar actualizaciones de fantasmas desconectados
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;

    await updateDoc(docRef, {
      lat: params.lat,
      lng: params.lng,
      speed: params.speed,
      heading: params.heading,
      batteryLevel: params.batteryLevel,
      isBatteryCritical: params.batteryLevel < 0.20,
      hasInternet: params.hasInternet,
      isGpsActive: params.isGpsActive,
      lastActive: serverTimestamp()
    });

    // Sincronizar espejo en el perfil de usuario general
    const userRef = doc(db, 'users', driverId);
    await updateDoc(userRef, {
      'driverProfile.gps': {
        lat: params.lat,
        lng: params.lng,
        updatedAt: new Date().toISOString()
      }
    });
  }

  /**
   * Establece el estado interno a BUSY para que el Dispatch Engine no le asigne viajes simultáneos.
   */
  static async setBusyState(driverId: string, isBusy: boolean): Promise<void> {
    const docRef = doc(db, this.collectionName, driverId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await updateDoc(docRef, {
        status: isBusy ? 'BUSY' : 'AVAILABLE',
        lastActive: serverTimestamp()
      });
    }
  }

  /**
   * Validador estricto de fecha de expiración de licencia.
   */
  private static checkLicenseExpired(expiryStr: string): boolean {
    if (!expiryStr) return true;
    try {
      const expiry = new Date(expiryStr);
      const today = new Date();
      return expiry <= today;
    } catch {
      return true;
    }
  }
}
