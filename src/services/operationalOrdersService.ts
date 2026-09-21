import { doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db, auth } from '../firebase/config';

// ============================================================================
// MÁQUINA DE ESTADOS EXPLÍCITA DE LA OPERACIÓN (ZÉNITH PROTOCOL)
// ============================================================================
export type OperationStatus = 'CREADO' | 'PUBLICADO' | 'ASIGNADO' | 'ACEPTADO' | 'ACTIVO';

export const OPERATION_STATUS_FLOW: OperationStatus[] = [
  'CREADO',
  'PUBLICADO',
  'ASIGNADO',
  'ACEPTADO',
  'ACTIVO'
];

export interface OperationRecord {
  id: string;
  isTestOperation: boolean;
  status: OperationStatus;
  originAddress: string;
  originLat: number;
  originLng: number;
  destinationAddress: string;
  destLat: number;
  destLng: number;
  distanceText: string;
  durationText: string;
  distanceMeters: number;
  durationSeconds: number;
  polylinePointsCount: number;
  polylinePoints?: { lat: number; lng: number }[];
  
  // Solicitante
  passengerId: string;
  passengerName: string;
  passengerPhone: string;
  
  // Motorizado
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  driverPlate?: string;
  driverVehicle?: string;

  // Telemetría GPS
  driverLocation?: {
    lat: number;
    lng: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
    updatedAt?: string;
  };

  // Marcas de tiempo de cada transición de estado
  createdAt: string;
  publishedAt?: string;
  assignedAt?: string;
  acceptedAt?: string;
  activatedAt?: string;
  updatedAt: string;
}

const STORAGE_KEY = 'zenith_operational_orders_v1';
const CHANNEL_NAME = 'zenith_heart_operations_sync';

// Crear canal de comunicación inter-pestañas / inter-roles en tiempo real
let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  } catch (e) {
    console.warn('[ZENITH-SYNC] BroadcastChannel no soportado:', e);
  }
}

// ============================================================================
// LECTURA DE ALMACÉN LOCAL PERSISTENTE
// ============================================================================
export function getStoredOrders(): OperationRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[ZENITH-SYNC] Error leyendo órdenes almacenadas:', err);
    return [];
  }
}

export function saveOrdersToStorage(orders: OperationRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    // Notificar a otras pestañas/componentes
    if (broadcastChannel) {
      broadcastChannel.postMessage({ type: 'ORDERS_UPDATED', timestamp: Date.now() });
    }
    // Disparar evento local
    window.dispatchEvent(new CustomEvent('zenith:orders_updated'));
  } catch (err) {
    console.warn('[ZENITH-SYNC] Error guardando órdenes en storage:', err);
  }
}

// ============================================================================
// CONSULTAS OPERATIVAS
// ============================================================================

/**
 * Consulta de pedidos disponibles para el Motorizado.
 * Regla: Solo pedidos en estado estrictamente 'PUBLICADO'.
 */
export function getAvailableOrders(): OperationRecord[] {
  const all = getStoredOrders();
  return all.filter(op => op.status === 'PUBLICADO');
}

/**
 * Obtener un pedido específico por ID.
 */
export function getOrderById(id: string): OperationRecord | null {
  const all = getStoredOrders();
  return all.find(op => op.id === id) || null;
}

// ============================================================================
// TRANSICIONES DE LA MÁQUINA DE ESTADOS
// ============================================================================

/**
 * ESTADO 1: CREADO
 * El Solicitante formula el pedido con coordenadas y ruta calculada.
 */
export function createDraftOrder(params: {
  originAddress: string;
  originLat: number;
  originLng: number;
  destinationAddress: string;
  destLat: number;
  destLng: number;
  distanceText: string;
  durationText: string;
  distanceMeters: number;
  durationSeconds: number;
  polylinePoints: { lat: number; lng: number }[];
  passengerId?: string;
  passengerName?: string;
  passengerPhone?: string;
}): OperationRecord {
  const now = new Date().toISOString();
  const id = `OP-${Date.now().toString().slice(-6)}`;

  const order: OperationRecord = {
    id,
    isTestOperation: true,
    status: 'CREADO',
    originAddress: params.originAddress,
    originLat: params.originLat,
    originLng: params.originLng,
    destinationAddress: params.destinationAddress,
    destLat: params.destLat,
    destLng: params.destLng,
    distanceText: params.distanceText,
    durationText: params.durationText,
    distanceMeters: params.distanceMeters,
    durationSeconds: params.durationSeconds,
    polylinePointsCount: params.polylinePoints.length,
    polylinePoints: params.polylinePoints,
    passengerId: params.passengerId || 'solicitante-test-01',
    passengerName: params.passengerName || 'Carlos Mendoza (Solicitante)',
    passengerPhone: params.passengerPhone || '+51 948 112 233',
    createdAt: now,
    updatedAt: now
  };

  const all = getStoredOrders();
  const filtered = all.filter(o => o.id !== id);
  saveOrdersToStorage([order, ...filtered]);

  return order;
}

/**
 * ESTADO 2: PUBLICADO
 * El Solicitante confirma "PUBLICAR PEDIDO DE PRUEBA".
 * El pedido pasa a estar DISPONIBLE para los motorizados.
 */
export async function publishOrder(orderId: string): Promise<OperationRecord> {
  const all = getStoredOrders();
  const idx = all.findIndex(o => o.id === orderId);
  if (idx === -1) {
    throw new Error(`Pedido ${orderId} no encontrado.`);
  }

  const now = new Date().toISOString();
  const updated: OperationRecord = {
    ...all[idx],
    status: 'PUBLICADO',
    publishedAt: now,
    updatedAt: now
  };

  all[idx] = updated;
  saveOrdersToStorage(all);

  // Intentar sincronización opcional con Firestore para trazabilidad de nube
  try {
    await setDoc(doc(db, 'rides', updated.id), {
      ...updated,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.log('[ZENITH-FIRESTORE] Registro local persistido con éxito (nube opcional).');
  }

  return updated;
}

/**
 * ESTADO 3 & 4: ASIGNADO → ACEPTADO
 * El Motorizado acepta el pedido.
 * El pedido se asigna y confirma formalmente, dejando de ser disponible para otros.
 */
export async function acceptOrderAsMotorizado(
  orderId: string,
  driver: {
    driverId: string;
    driverName: string;
    driverPhone: string;
    driverPlate: string;
    driverVehicle?: string;
  }
): Promise<OperationRecord> {
  const orderRef = doc(db, 'rides', orderId);
  const now = new Date().toISOString();

  // 1. TRANSACCIÓN ATÓMICA EN FIRESTORE (Erradica Race Conditions entre múltiples motorizados)
  try {
    await runTransaction(db, async (transaction) => {
      const orderDoc = await transaction.get(orderRef);
      if (!orderDoc.exists()) {
        throw new Error(`FIRESTORE_ORDER_NOT_FOUND: Pedido ${orderId} no existe en Firestore.`);
      }

      const cloudData = orderDoc.data();
      if (cloudData.status !== 'PUBLICADO') {
        throw new Error(
          `CONCURRENCY_CONFLICT: El pedido ${orderId} ya fue tomado por otro motorizado (${cloudData.driverName || 'Asignado'}). Estado actual: ${cloudData.status}`
        );
      }

      if (typeof cloudData.driverId === 'string' && cloudData.driverId !== driver.driverId) {
        throw new Error(
          `CONCURRENCY_CONFLICT: El pedido ${orderId} ya está asignado a otro motorizado (${cloudData.driverId}).`
        );
      }

      transaction.update(orderRef, {
        status: 'ACEPTADO',
        driverId: driver.driverId,
        driverName: driver.driverName,
        driverPhone: driver.driverPhone,
        driverPlate: driver.driverPlate,
        driverVehicle: driver.driverVehicle || 'Motocicleta Operativa',
        acceptedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('CONCURRENCY_CONFLICT')) {
      // Conflicto de concurrencia real: elevar inmediatamente para que no se sobreescriba
      throw err;
    }

    // El emulador puede devolver PERMISSION_DENIED al revalidar las reglas
    // después de que otro proceso haya confirmado la transacción. Clasificar
    // ese caso por el estado confirmado en Firestore, sin aceptar localmente.
    const currentOrder = await getDoc(orderRef);
    if (currentOrder.exists()) {
      const currentData = currentOrder.data();
      if (currentData.status === 'ACEPTADO' && currentData.driverId !== driver.driverId) {
        throw new Error(
          `CONCURRENCY_CONFLICT: El pedido ${orderId} fue aceptado por otro motorizado (${currentData.driverId}).`
        );
      }
    }

    throw new Error(`FIRESTORE_ACCEPTANCE_FAILED: ${message}`, { cause: err });
  }

  // 2. Verificación y actualización de almacenamiento local
  const all = getStoredOrders();
  const idx = all.findIndex(o => o.id === orderId);
  if (idx === -1) {
    throw new Error(`Pedido ${orderId} no encontrado.`);
  }

  if (all[idx].status !== 'PUBLICADO' && all[idx].driverId !== driver.driverId) {
    throw new Error(`El pedido ${orderId} ya no está disponible (Estado local: ${all[idx].status}).`);
  }

  const updated: OperationRecord = {
    ...all[idx],
    status: 'ACEPTADO', // Transiciona a ACEPTADO
    driverId: driver.driverId,
    driverName: driver.driverName,
    driverPhone: driver.driverPhone,
    driverPlate: driver.driverPlate,
    driverVehicle: driver.driverVehicle || 'Motocicleta Operativa',
    assignedAt: all[idx].assignedAt || now,
    acceptedAt: now,
    updatedAt: now
  };

  all[idx] = updated;
  saveOrdersToStorage(all);

  return updated;
}

/**
 * ESTADO 5: ACTIVO
 * El Motorizado pone la operación en marcha activa para desplazarse físicamente.
 */
export async function activateOrder(orderId: string): Promise<OperationRecord> {
  const all = getStoredOrders();
  const idx = all.findIndex(o => o.id === orderId);
  if (idx === -1) {
    throw new Error(`Pedido ${orderId} no encontrado.`);
  }

  const now = new Date().toISOString();
  const updated: OperationRecord = {
    ...all[idx],
    status: 'ACTIVO',
    activatedAt: now,
    updatedAt: now
  };

  all[idx] = updated;
  saveOrdersToStorage(all);

  try {
    await updateDoc(doc(db, 'rides', updated.id), {
      status: 'ACTIVO',
      activatedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (e) {
    console.log('[ZENITH-FIRESTORE] Estado ACTIVO persistido localmente.');
  }

  return updated;
}

/**
 * Actualizar telemetría GPS del Motorizado en la operación activa
 */
export function updateOperationTelemetry(
  orderId: string,
  telemetry: {
    lat: number;
    lng: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
  }
): void {
  const all = getStoredOrders();
  const idx = all.findIndex(o => o.id === orderId);
  if (idx === -1) return;

  const now = new Date().toISOString();
  all[idx].driverLocation = {
    ...telemetry,
    updatedAt: now
  };
  all[idx].updatedAt = now;

  saveOrdersToStorage(all);

  // Firestore update silencioso
  try {
    updateDoc(doc(db, 'rides', orderId), {
      driverLocation: {
        ...telemetry,
        updatedAt: serverTimestamp()
      },
      updatedAt: serverTimestamp()
    }).catch(() => {});
  } catch (_) {}
}

// ============================================================================
// SUSCRIPCIÓN EN TIEMPO REAL
// ============================================================================
export function subscribeToOperations(callback: (orders: OperationRecord[]) => void): () => void {
  // Notificar estado actual inmediatamente
  callback(getStoredOrders());

  const handleUpdate = () => {
    callback(getStoredOrders());
  };

  window.addEventListener('zenith:orders_updated', handleUpdate);
  window.addEventListener('storage', handleUpdate);

  if (broadcastChannel) {
    broadcastChannel.onmessage = () => {
      callback(getStoredOrders());
    };
  }

  // Listener opcional a Firestore para cambios remotos
  let firestoreUnsub: (() => void) | null = null;
  try {
    // Si se requiere escuchar la colección 'rides'
    const activeOrders = getStoredOrders();
    if (activeOrders.length > 0 && activeOrders[0]?.id) {
      firestoreUnsub = onSnapshot(doc(db, 'rides', activeOrders[0].id), (snap) => {
        if (snap.exists()) {
          const remoteData = snap.data();
          if (remoteData?.status) {
            const all = getStoredOrders();
            const index = all.findIndex(o => o.id === snap.id);
            if (index !== -1 && all[index].status !== remoteData.status) {
              all[index] = {
                ...all[index],
                status: remoteData.status,
                driverId: remoteData.driverId || all[index].driverId,
                driverName: remoteData.driverName || all[index].driverName,
                driverPlate: remoteData.driverPlate || all[index].driverPlate,
                driverPhone: remoteData.driverPhone || all[index].driverPhone
              };
              saveOrdersToStorage(all);
            }
          }
        }
      }, () => {});
    }
  } catch (_) {}

  return () => {
    window.removeEventListener('zenith:orders_updated', handleUpdate);
    window.removeEventListener('storage', handleUpdate);
    if (firestoreUnsub) {
      firestoreUnsub();
    }
  };
}
