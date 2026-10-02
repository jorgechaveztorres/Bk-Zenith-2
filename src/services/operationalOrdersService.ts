import { 
  doc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  serverTimestamp, 
  runTransaction,
  collection,
  query,
  where,
  getDocs,
  limit
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { User, UserRole, DocumentStatus } from '../types';
import {
  extractIdentityContext,
  extractWalletContext,
  canAcceptOrder,
  OperationalContext
} from './OperationalEligibilityEngine';

// ============================================================================
// MÁQUINA DE ESTADOS EXPLÍCITA DE LA OPERACIÓN (ZÉNITH PROTOCOL)
// ============================================================================
export type OperationStatus = 'CREADO' | 'PUBLICADO' | 'ASIGNADO' | 'ACEPTADO' | 'ACTIVO' | 'FINALIZADO';

export const OPERATION_STATUS_FLOW: OperationStatus[] = [
  'CREADO',
  'PUBLICADO',
  'ASIGNADO',
  'ACEPTADO',
  'ACTIVO',
  'FINALIZADO'
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

  // Tarifación DPE V2 (Motor de Precios Dinámicos)
  protectedPrice?: number;
  finalPrice?: number;
  pricingSeal?: string;
  pricingVersion?: string;
  basePrice?: number;
  multiplier?: number;
  marketPressure?: number;
  currency?: string;

  // Marcas de tiempo de cada transición de estado
  createdAt: string;
  publishedAt?: string;
  assignedAt?: string;
  acceptedAt?: string;
  activatedAt?: string;
  finalizedAt?: string;
  completedAt?: string;
  updatedAt: string;

  // Campos de entrega Zénith MVP V1.1 (Receptor, Paquete, Evidencia, Contingencia)
  packageInfo?: any;
  receptor?: any;
  pagador?: any;
  solicitante?: any;
  evidenceLevel?: string;
  returnContingency?: any;
  [key: string]: any;
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
 * Limpieza exclusiva de órdenes TEST huérfanas de actores antes de iniciar una nueva prueba.
 * No altera órdenes reales ni órdenes completadas (FINALIZADO).
 */
export function cleanOrphanTestOrders(driverUid?: string, passengerUid?: string): void {
  const all = getStoredOrders();
  const cleaned = all.filter(o => {
    const isActorOrder = 
      (driverUid && o.driverId === driverUid) ||
      o.driverId === 'test-motorizado-01' ||
      (passengerUid && o.passengerId === passengerUid) ||
      o.passengerId === 'solicitante-test-01';
    return !(isActorOrder && o.status !== 'FINALIZADO');
  });
  if (cleaned.length !== all.length) {
    saveOrdersToStorage(cleaned);
  }
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
  distanceText?: string;
  durationText?: string;
  distanceMeters?: number;
  durationSeconds?: number;
  polylinePoints?: { lat: number; lng: number }[];
  passengerId?: string;
  passengerName?: string;
  passengerPhone?: string;
  protectedPrice?: number;
  finalPrice?: number;
  pricingSeal?: string;
  pricingVersion?: string;
  basePrice?: number;
  multiplier?: number;
  marketPressure?: number;
  currency?: string;
  packageInfo?: any;
  receptor?: any;
  pagador?: any;
  solicitante?: any;
  evidenceLevel?: string;
  returnContingency?: any;
  [key: string]: any;
}): OperationRecord {
  const now = new Date().toISOString();
  const id = params.id || `OP-${Date.now().toString().slice(-6)}`;

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
    distanceText: params.distanceText || '0 km',
    durationText: params.durationText || '0 min',
    distanceMeters: params.distanceMeters || 0,
    durationSeconds: params.durationSeconds || 0,
    polylinePointsCount: params.polylinePoints?.length || 0,
    polylinePoints: params.polylinePoints || [],
    passengerId: params.passengerId || 'solicitante-test-01',
    passengerName: params.passengerName || 'Carlos Mendoza (Solicitante)',
    passengerPhone: params.passengerPhone || '+51 948 112 233',
    protectedPrice: params.protectedPrice,
    finalPrice: params.finalPrice ?? params.protectedPrice,
    pricingSeal: params.pricingSeal,
    pricingVersion: params.pricingVersion || '2.0.0-dpe-mvp',
    basePrice: params.basePrice,
    multiplier: params.multiplier,
    marketPressure: params.marketPressure,
    currency: params.currency || 'PEN',
    createdAt: now,
    updatedAt: now,
    packageInfo: params.packageInfo,
    receptor: params.receptor,
    pagador: params.pagador,
    solicitante: params.solicitante,
    evidenceLevel: params.evidenceLevel,
    returnContingency: params.returnContingency
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
    const cleanData = JSON.parse(JSON.stringify(updated));
    await setDoc(doc(db, 'rides', updated.id), {
      ...cleanData,
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
    userProfile?: Partial<User>;
  }
): Promise<OperationRecord> {
  const orderRef = doc(db, 'rides', orderId);
  const now = new Date().toISOString();

  // 1. OBTENCIÓN DEL CONTEXTO OPERATIVO REAL (Detección de operaciones incompatibles activas)
  const storedOrders = getStoredOrders();
  const hasActiveLocal = storedOrders.some(
    o => o.driverId === driver.driverId && 
         o.id !== orderId && 
         (o.status === 'ACEPTADO' || o.status === 'ACTIVO' || o.status === 'ASIGNADO')
  );

  let hasActiveRemote = false;
  try {
    const activeQuery = query(
      collection(db, 'rides'),
      where('driverId', '==', driver.driverId),
      where('status', 'in', ['ACEPTADO', 'ACTIVO', 'ASIGNADO', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'IN_PROGRESS']),
      limit(2)
    );
    const activeSnap = await Promise.race([
      getDocs(activeQuery),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 1500))
    ]);
    if (activeSnap) {
      hasActiveRemote = activeSnap.docs.some(d => d.id !== orderId);
    }
  } catch (_e) {
    // Si la consulta remota falla o entra en timeout (offline), prevalece la verificación local
  }

  const operationalContext: OperationalContext = {
    hasActiveOperation: hasActiveLocal || hasActiveRemote,
    currentTransitStatus: null
  };

  // 2. TRANSACCIÓN ATÓMICA EN FIRESTORE (Erradica Race Conditions entre múltiples motorizados)
  try {
    await runTransaction(db, async (transaction) => {
      // A. LECTURAS FIRESTORE OBLIGATORIAS (Preceden a cualquier escritura según Firestore rules)
      const orderDoc = await transaction.get(orderRef);
      const userRef = doc(db, 'users', driver.driverId);
      const userDoc = await transaction.get(userRef);

      // B. CONSTRUCCIÓN DE IDENTITY Y WALLET CONTEXT DESDE FUENTE DE VERDAD
      let userData: Partial<User>;
      if (userDoc.exists()) {
        userData = userDoc.data() as User;
      } else if (driver.userProfile) {
        userData = driver.userProfile;
      } else {
        userData = {
          uid: driver.driverId,
          activeRole: UserRole.DRIVER,
          driverProfile: {
            status: DocumentStatus.PENDING
          } as any,
          wallet: {
            availableBalance: 0
          } as any
        };
      }

      const identityContext = extractIdentityContext(userData);
      const walletContext = extractWalletContext(userData.wallet);

      // C. EVALUACIÓN ESTRICTA DE ELEGIBILIDAD OPERATIVA
      const eligibility = canAcceptOrder(identityContext, walletContext, operationalContext);
      if (!eligibility.eligible) {
        const error = new Error(`OPERATIONAL_ELIGIBILITY_REJECTED: [${eligibility.code}] ${eligibility.reason}`);
        (error as any).code = eligibility.code;
        (error as any).reason = eligibility.reason;
        throw error;
      }

      // D. CONCURRENCY CHECK ORIGINAL Y ACTUALIZACIÓN ATÓMICA (INTACTOS)
      if (orderDoc.exists()) {
        const cloudData = orderDoc.data();
        // Si el estado en la nube ya no es PUBLICADO ni asignado a este motorizado, rechazar atómicamente
        if (cloudData.status !== 'PUBLICADO' && cloudData.driverId !== driver.driverId) {
          throw new Error(
            `CONCURRENCY_CONFLICT: El pedido ${orderId} ya fue tomado por otro motorizado (${cloudData.driverName || 'Asignado'}). Estado actual: ${cloudData.status}`
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
      }
    });
  } catch (err: any) {
    if (err?.message && (err.message.includes('CONCURRENCY_CONFLICT') || err.message.includes('OPERATIONAL_ELIGIBILITY_REJECTED'))) {
      // Elevar inmediatamente para abortar cualquier mutación
      throw err;
    }
    console.warn('[ZENITH-FIRESTORE] Transacción remota omitida/offline, procediendo con verificación local:', err?.message || err);
  }

  // 3. Verificación y actualización de almacenamiento local
  // Si la transacción remota no corrió (offline), evaluar elegibilidad localmente para no permitir estados inválidos
  const localDriverData: Partial<User> = driver.userProfile || {
    uid: driver.driverId,
    activeRole: UserRole.DRIVER
  };

  const localEligibility = canAcceptOrder(
    extractIdentityContext(localDriverData),
    extractWalletContext(localDriverData.wallet),
    operationalContext
  );

  if (!localEligibility.eligible) {
    const error = new Error(`OPERATIONAL_ELIGIBILITY_REJECTED: [${localEligibility.code}] ${localEligibility.reason}`);
    (error as any).code = localEligibility.code;
    (error as any).reason = localEligibility.reason;
    throw error;
  }

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
 * ESTADO 6: FINALIZADO
 * Cierre operacional de la carrera al arribar a destino.
 * Transición válida únicamente desde ACTIVO.
 * Operación estrictamente idempotente si ya está FINALIZADO.
 */
export async function finalizeOrder(orderId: string): Promise<OperationRecord> {
  const all = getStoredOrders();
  const idx = all.findIndex(o => o.id === orderId);
  if (idx === -1) {
    throw new Error(`Pedido ${orderId} no encontrado.`);
  }

  const currentOrder = all[idx];

  // Caso A: Idempotencia si ya está FINALIZADO
  if (currentOrder.status === 'FINALIZADO') {
    return currentOrder;
  }

  // Caso B: Solo se permite transición válida desde ACTIVO
  if (currentOrder.status !== 'ACTIVO') {
    throw new Error(
      `TRANSICIÓN INVÁLIDA: No se puede finalizar una orden en estado '${currentOrder.status}'. Solo se permite finalizar pedidos en estado 'ACTIVO'.`
    );
  }

  const now = new Date().toISOString();
  const updated: OperationRecord = {
    ...currentOrder,
    status: 'FINALIZADO',
    finalizedAt: currentOrder.finalizedAt || now,
    completedAt: currentOrder.completedAt || now,
    updatedAt: now
  };

  all[idx] = updated;
  saveOrdersToStorage(all);

  try {
    await updateDoc(doc(db, 'rides', updated.id), {
      status: 'FINALIZADO',
      finalizedAt: serverTimestamp(),
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (e) {
    console.log('[ZENITH-FIRESTORE] Estado FINALIZADO persistido localmente.');
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
            if (index !== -1) {
              const STATUS_WEIGHT: Record<string, number> = {
                CREADO: 1,
                PUBLICADO: 2,
                ASIGNADO: 3,
                ACEPTADO: 4,
                ACTIVO: 5,
                FINALIZADO: 6
              };
              const currentWeight = STATUS_WEIGHT[all[index].status] || 0;
              const remoteWeight = STATUS_WEIGHT[remoteData.status] || 0;

              // NO degradar el estado local si el remoto tiene un estado anterior (stale snapshot)
              if (remoteWeight >= currentWeight && all[index].status !== remoteData.status) {
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
