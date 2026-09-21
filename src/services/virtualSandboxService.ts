import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, assertSandboxIsolated } from '../firebase/config';
import { User, UserRole } from '../types';
import {
  createDraftOrder,
  publishOrder,
  acceptOrderAsMotorizado,
  OperationRecord
} from './operationalOrdersService';

// ============================================================================
// IDENTIDADES SINTÉTICAS AISLADAS (SANDBOX)
// ============================================================================
export const VIRTUAL_SANDBOX_USERS = {
  CLIENT: {
    uid: 'sandbox-virtual-client-01',
    fullName: 'Cliente Virtual Sandbox (Test)',
    email: 'client.sandbox@zenith.virtual.test',
    phone: '+51 900 000 001',
    role: UserRole.PASSENGER,
    activeRole: UserRole.PASSENGER,
    rolesEnabled: [UserRole.PASSENGER] as (UserRole | 'CLIENTE' | 'MOTORIZADO')[],
    rating: 5.0,
    isVirtual: true
  },
  MOTORIZADO: {
    uid: 'sandbox-virtual-driver-01',
    fullName: 'Motorizado Virtual Sandbox (Test)',
    email: 'driver.sandbox@zenith.virtual.test',
    phone: '+51 900 000 002',
    plate: 'VIRT-999-SBX',
    vehicleModel: 'Honda Wave 110 Virtual',
    role: UserRole.DRIVER,
    activeRole: UserRole.DRIVER,
    rolesEnabled: [UserRole.DRIVER] as (UserRole | 'CLIENTE' | 'MOTORIZADO')[],
    rating: 5.0,
    isVirtual: true
  },
  // Identidad para verificar multirrol
  MULTIROLE_USER: {
    uid: 'sandbox-virtual-multirole-01',
    fullName: 'Usuario Multirrol Sandbox (Test)',
    email: 'multirole.sandbox@zenith.virtual.test',
    phone: '+51 900 000 003',
    role: UserRole.PASSENGER,
    activeRole: UserRole.PASSENGER,
    rolesEnabled: [UserRole.PASSENGER, UserRole.DRIVER] as (UserRole | 'CLIENTE' | 'MOTORIZADO')[],
    rating: 5.0,
    isVirtual: true
  }
};

export interface VirtualSandboxStepLog {
  step: string;
  success: boolean;
  timestamp: string;
  details?: string;
  data?: Record<string, unknown>;
}

export interface VirtualSandboxExecutionResult {
  success: boolean;
  totalDurationMs: number;
  orderId: string;
  clientUid: string;
  driverUid: string;
  finalOrderStatus: string;
  multiroleVerified: boolean;
  logs: VirtualSandboxStepLog[];
  order?: OperationRecord;
}

/**
 * Registra o actualiza en Firestore (Emulator) un usuario virtual sintético.
 */
export async function seedVirtualSandboxUser(user: typeof VIRTUAL_SANDBOX_USERS.CLIENT | typeof VIRTUAL_SANDBOX_USERS.MOTORIZADO | typeof VIRTUAL_SANDBOX_USERS.MULTIROLE_USER): Promise<void> {
  assertSandboxIsolated('Creación de usuario virtual Sandbox');
  const userRef = doc(db, 'users', user.uid);
  await setDoc(userRef, {
    ...user,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

/**
 * Ejecuta el laboratorio virtual completo en el Sandbox (Firebase Emulator).
 * Flujo:
 * 1. Verificación obligatoria de aislamiento (assertSandboxIsolated).
 * 2. Creación / Siembra de Cliente Virtual.
 * 3. Creación / Siembra de Motorizado Virtual.
 * 4. Verificación de usuario Multirrol (UID con CLIENTE + MOTORIZADO).
 * 5. Cliente Virtual formula borrador de pedido (CREADO).
 * 6. Cliente Virtual publica pedido (PUBLICADO).
 * 7. Motorizado Virtual acepta pedido mediante runTransaction atómico (ACEPTADO).
 * 8. Verificación estricta de estado final y driverId asignado.
 */
export async function runVirtualSandboxLifecycle(customOptions?: {
  originAddress?: string;
  destinationAddress?: string;
}): Promise<VirtualSandboxExecutionResult> {
  const startTime = Date.now();
  const logs: VirtualSandboxStepLog[] = [];

  const addLog = (step: string, success: boolean, details?: string, data?: Record<string, unknown>) => {
    logs.push({
      step,
      success,
      timestamp: new Date().toISOString(),
      details,
      data
    });
  };

  // 1. SEGURIDAD: Comprobación estricta de aislamiento del emulador
  try {
    assertSandboxIsolated('Ejecución del Sandbox Virtual');
    addLog('ASSERT_SANDBOX_ISOLATED', true, 'Aislamiento certificado: Conexión apuntando al Firebase Emulator.');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    addLog('ASSERT_SANDBOX_ISOLATED', false, message);
    return {
      success: false,
      totalDurationMs: Date.now() - startTime,
      orderId: '',
      clientUid: '',
      driverUid: '',
      finalOrderStatus: 'ABORTED',
      multiroleVerified: false,
      logs
    };
  }

  // 2. CREAR CLIENTE VIRTUAL
  try {
    await seedVirtualSandboxUser(VIRTUAL_SANDBOX_USERS.CLIENT);
    addLog('SEED_VIRTUAL_CLIENT', true, `Cliente virtual sembrado: ${VIRTUAL_SANDBOX_USERS.CLIENT.uid}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    addLog('SEED_VIRTUAL_CLIENT', false, `Error creando cliente virtual: ${message}`);
    throw err;
  }

  // 3. CREAR MOTORIZADO VIRTUAL
  try {
    await seedVirtualSandboxUser(VIRTUAL_SANDBOX_USERS.MOTORIZADO);
    addLog('SEED_VIRTUAL_DRIVER', true, `Motorizado virtual sembrado: ${VIRTUAL_SANDBOX_USERS.MOTORIZADO.uid}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    addLog('SEED_VIRTUAL_DRIVER', false, `Error creando motorizado virtual: ${message}`);
    throw err;
  }

  // 4. VERIFICACIÓN MULTIRROL (1 UID con CLIENTE + MOTORIZADO simultáneamente)
  let multiroleVerified = false;
  try {
    await seedVirtualSandboxUser(VIRTUAL_SANDBOX_USERS.MULTIROLE_USER);
    const snap = await getDoc(doc(db, 'users', VIRTUAL_SANDBOX_USERS.MULTIROLE_USER.uid));
    if (snap.exists()) {
      const data = snap.data() as User;
      const hasPassenger = data.rolesEnabled?.includes(UserRole.PASSENGER) || false;
      const hasDriver = data.rolesEnabled?.includes(UserRole.DRIVER) || false;
      if (hasPassenger && hasDriver) {
        multiroleVerified = true;
        addLog('VERIFY_MULTIROLE', true, `Multirrol comprobado en UID ${data.uid}: roles=${JSON.stringify(data.rolesEnabled)}`);
      } else {
        addLog('VERIFY_MULTIROLE', false, 'Faltan roles en arreglo rolesEnabled');
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    addLog('VERIFY_MULTIROLE', false, `Error en verificación multirrol: ${message}`);
  }

  // 5. CLIENTE VIRTUAL CREA PEDIDO SANDBOX (ESTADO: CREADO)
  let orderRecord: OperationRecord;
  try {
    const origin = customOptions?.originAddress || 'Plaza de Armas de Arequipa, Perú';
    const destination = customOptions?.destinationAddress || 'Plaza de Cayma, Arequipa, Perú';

    orderRecord = createDraftOrder({
      originAddress: origin,
      originLat: -16.39889,
      originLng: -71.53500,
      destinationAddress: destination,
      destLat: -16.38500,
      destLng: -71.54200,
      distanceText: '3.4 km',
      durationText: '11 min',
      distanceMeters: 3400,
      durationSeconds: 660,
      polylinePoints: [
        { lat: -16.39889, lng: -71.53500 },
        { lat: -16.39200, lng: -71.53800 },
        { lat: -16.38500, lng: -71.54200 }
      ],
      passengerId: VIRTUAL_SANDBOX_USERS.CLIENT.uid,
      passengerName: VIRTUAL_SANDBOX_USERS.CLIENT.fullName,
      passengerPhone: VIRTUAL_SANDBOX_USERS.CLIENT.phone
    });

    addLog('CREATE_DRAFT_ORDER', true, `Pedido formulado con ID: ${orderRecord.id}`, {
      status: orderRecord.status,
      passengerId: orderRecord.passengerId
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    addLog('CREATE_DRAFT_ORDER', false, `Error formulando borrador: ${message}`);
    throw err;
  }

  // 6. CLIENTE VIRTUAL PUBLICA EL PEDIDO (ESTADO: PUBLICADO)
  try {
    orderRecord = await publishOrder(orderRecord.id);
    if (orderRecord.status !== 'PUBLICADO') {
      throw new Error(`Estado inesperado tras publicación: ${orderRecord.status}`);
    }
    addLog('PUBLISH_ORDER', true, `Pedido ${orderRecord.id} publicado en red virtual (Estado: PUBLICADO)`, {
      status: orderRecord.status,
      publishedAt: orderRecord.publishedAt
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    addLog('PUBLISH_ORDER', false, `Error publicando pedido: ${message}`);
    throw err;
  }

  // 7. MOTORIZADO VIRTUAL ACEPTA EL PEDIDO ATÓMICAMENTE (ESTADO: ACEPTADO)
  try {
    orderRecord = await acceptOrderAsMotorizado(orderRecord.id, {
      driverId: VIRTUAL_SANDBOX_USERS.MOTORIZADO.uid,
      driverName: VIRTUAL_SANDBOX_USERS.MOTORIZADO.fullName,
      driverPhone: VIRTUAL_SANDBOX_USERS.MOTORIZADO.phone,
      driverPlate: VIRTUAL_SANDBOX_USERS.MOTORIZADO.plate,
      driverVehicle: VIRTUAL_SANDBOX_USERS.MOTORIZADO.vehicleModel
    });

    if (orderRecord.status !== 'ACEPTADO') {
      throw new Error(`Estado erróneo tras aceptación: ${orderRecord.status}`);
    }

    if (orderRecord.driverId !== VIRTUAL_SANDBOX_USERS.MOTORIZADO.uid) {
      throw new Error(`driverId erróneo: esperado ${VIRTUAL_SANDBOX_USERS.MOTORIZADO.uid}, obtenido ${orderRecord.driverId}`);
    }

    addLog('ACCEPT_ORDER_ATOMIC', true, `Pedido ${orderRecord.id} aceptado por motorizado virtual`, {
      status: orderRecord.status,
      driverId: orderRecord.driverId,
      acceptedAt: orderRecord.acceptedAt
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    addLog('ACCEPT_ORDER_ATOMIC', false, `Error en aceptación atómica: ${message}`);
    throw err;
  }

  // 8. VERIFICACIÓN Y CIERRE DE CICLO
  const isCompleteSuccess = orderRecord.status === 'ACEPTADO' &&
    orderRecord.driverId === VIRTUAL_SANDBOX_USERS.MOTORIZADO.uid &&
    multiroleVerified;

  addLog('LIFECYCLE_COMPLETION', isCompleteSuccess, isCompleteSuccess ? 'Ciclo Sandbox 100% exitoso y validado.' : 'Ciclo completado con observaciones.');

  return {
    success: isCompleteSuccess,
    totalDurationMs: Date.now() - startTime,
    orderId: orderRecord.id,
    clientUid: VIRTUAL_SANDBOX_USERS.CLIENT.uid,
    driverUid: VIRTUAL_SANDBOX_USERS.MOTORIZADO.uid,
    finalOrderStatus: orderRecord.status,
    multiroleVerified,
    logs,
    order: orderRecord
  };
}
