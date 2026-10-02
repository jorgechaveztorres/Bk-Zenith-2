/**
 * ZÉNITH // VALIDACIÓN: EMITIR OPERACIÓN ZÉNITH (CREADO -> PUBLICADO -> MOTORIZADO)
 */
import { auth, db } from '../src/firebase/config';
import { signInAnonymously } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import {
  createDraftOrder,
  publishOrder,
  getStoredOrders,
  getAvailableOrders,
  subscribeToOperations,
  OperationRecord
} from '../src/services/operationalOrdersService';
import { calculatePricing } from '../src/utils/pricingEngine';
import { ProductType, EvidenceLevel } from '../src/types';

const memoryStorage = new Map<string, string>();
const localStorageShim = {
  getItem: (key: string): string | null => memoryStorage.get(key) ?? null,
  setItem: (key: string, val: unknown): void => { memoryStorage.set(key, String(val)); },
  removeItem: (key: string): void => { memoryStorage.delete(key); },
  clear: (): void => { memoryStorage.clear(); },
  get length(): number { return memoryStorage.size; },
  key: (i: number): string | null => Array.from(memoryStorage.keys())[i] ?? null
};

(globalThis as any).localStorage = localStorageShim;
(globalThis as any).window = {
  localStorage: localStorageShim,
  dispatchEvent: (e: any) => true,
  addEventListener: () => {},
  removeEventListener: () => {}
};

async function validateEmitirOperacionZenithFlow() {
  console.log('>>> INICIANDO PRUEBA REAL: EMITIR OPERACIÓN ZÉNITH <<<');

  // 1. Autenticación con Firebase Auth
  const cred = await signInAnonymously(auth);
  const clientUid = cred.user.uid;
  console.log(`[AUTH] Cliente autenticado con UID: ${clientUid}`);

  // 2. Simulación de los datos del formulario (ZenithOrderCreationModal)
  const origin = {
    address: 'Calle Mercaderes 140, Arequipa, Perú',
    lat: -16.3988,
    lng: -71.5369
  };
  const destination = {
    address: 'Av. Cayma 600, Cayma, Arequipa, Perú',
    lat: -16.3812,
    lng: -71.5452
  };
  const productDescription = 'Documentos notariales urgentes para firma legal';
  const productType = ProductType.NON_PERISHABLE;
  const declaredValue = 120;
  const receptorName = 'Dra. María Elena Torres';
  const receptorPhone = '+51 988 776 655';

  // 3. Cálculo de tarifa inmutable DPE
  const pricing = calculatePricing(
    origin.lat,
    origin.lng,
    destination.lat,
    destination.lng,
    origin.address,
    destination.address
  );
  const fare = pricing.totalFare;
  console.log(`[PRICING] Tarifa DPE calculada: S/ ${fare.toFixed(2)} (Distancia: ${pricing.distance.toFixed(2)} km, Sello: ${pricing.seal})`);

  // 4. PASO A: Crear Borrador Operativo (Estado: CREADO)
  console.log('\n--- PASO 1: CREAR BORRADOR OPERATIVO (ESTADO: CREADO) ---');
  const draft = createDraftOrder({
    originAddress: origin.address,
    originLat: origin.lat,
    originLng: origin.lng,
    destinationAddress: destination.address,
    destLat: destination.lat,
    destLng: destination.lng,
    distanceText: `${pricing.distance.toFixed(1)} km`,
    durationText: `${pricing.duration} min`,
    distanceMeters: Math.round(pricing.distance * 1000),
    durationSeconds: Math.round(pricing.duration * 60),
    polylinePoints: [],
    passengerId: clientUid,
    passengerName: 'Carlos Mendoza (Cliente Test)',
    passengerPhone: '+51 948 112 233',
    protectedPrice: fare,
    finalPrice: fare,
    pricingSeal: pricing.seal,
    pricingVersion: pricing.pricingVersion,
    basePrice: pricing.normalFare,
    multiplier: pricing.multiplier,
    marketPressure: pricing.marketPressure,
    currency: 'PEN',
    packageInfo: {
      description: productDescription,
      type: productType,
      declaredValue,
      packageConditionNotes: 'Sobre cerrado y sellado',
      initialPhotos: []
    },
    receptor: {
      name: receptorName,
      phone: receptorPhone,
      address: destination.address,
      reference: 'Frente a banco',
      lat: destination.lat,
      lng: destination.lng
    },
    evidenceLevel: EvidenceLevel.E2_CONFIRMED,
    returnContingency: {
      agreed: true,
      returnLocation: origin,
      returnFareAdditional: Number((fare * 0.8).toFixed(2))
    }
  });

  console.log(`[ORDER CREATED] ID generado: ${draft.id}`);
  console.log(`[ORDER CREATED] Estado inicial: ${draft.status}`);
  if (draft.status !== 'CREADO') {
    throw new Error(`Estado inicial incorrecto: se esperaba 'CREADO', se obtuvo '${draft.status}'`);
  }
  if (!draft.id.startsWith('OP-')) {
    throw new Error(`ID no cumple formato real OP-XXXXXX: ${draft.id}`);
  }

  // Verificar que en estado CREADO aún no está disponible para motorizados
  const availableBefore = getAvailableOrders().filter(o => o.id === draft.id);
  console.log(`[DISPONIBILIDAD MOTORIZADO PRE-PUBLICACIÓN] Órdenes disponibles con este ID: ${availableBefore.length}`);
  if (availableBefore.length !== 0) {
    throw new Error('La orden no debería estar disponible para motorizados en estado CREADO');
  }

  // 5. PASO B: Publicar Pedido (Botón: "EMITIR OPERACIÓN ZÉNITH" ejecuta publishOrder)
  console.log('\n--- PASO 2: EMITIR OPERACIÓN ZÉNITH -> PUBLICAR PEDIDO (ESTADO: PUBLICADO) ---');
  const published = await publishOrder(draft.id);
  console.log(`[ORDER PUBLISHED] ID: ${published.id}`);
  console.log(`[ORDER PUBLISHED] Estado tras emitir: ${published.status}`);
  console.log(`[ORDER PUBLISHED] Timestamp publicación: ${published.publishedAt}`);
  if (published.status !== 'PUBLICADO') {
    throw new Error(`Estado tras emitir incorrecto: se esperaba 'PUBLICADO', se obtuvo '${published.status}'`);
  }

  // 6. PASO C: Cambiar a MOTORIZADO y Verificar que la nueva operación aparece en "PEDIDOS DISPONIBLES EN RED"
  console.log('\n--- PASO 3: CAMBIO A MOTORIZADO & VERIFICACIÓN EN "PEDIDOS DISPONIBLES EN RED" ---');
  const availableAfter = getAvailableOrders();
  const foundOrder = availableAfter.find(o => o.id === published.id);
  console.log(`[MOTORIZADO VIEW] Total de pedidos disponibles en red: ${availableAfter.length}`);
  console.log(`[MOTORIZADO VIEW] Pedido encontrado en pedidos disponibles:`, foundOrder ? {
    id: foundOrder.id,
    status: foundOrder.status,
    origin: foundOrder.originAddress,
    destination: foundOrder.destinationAddress,
    tarifa: `S/ ${foundOrder.protectedPrice?.toFixed(2)}`,
    solicitante: foundOrder.passengerName,
    receptor: foundOrder.receptor?.name
  } : 'NO ENCONTRADO');

  if (!foundOrder) {
    throw new Error('Fallo: La orden publicada no aparece en getAvailableOrders()');
  }
  if (foundOrder.status !== 'PUBLICADO') {
    throw new Error(`Fallo: El estado en pedidos disponibles no es PUBLICADO: ${foundOrder.status}`);
  }

  // 7. PASO D: Verificar Persistencia y Documento con ID Real y Estado PUBLICADO
  console.log('\n--- PASO 4: VERIFICACIÓN DE PERSISTENCIA Y DOCUMENTO REAL ---');
  const storedAll = getStoredOrders();
  const persistentDoc = storedAll.find(o => o.id === published.id);
  console.log(`[STORAGE PERSISTENCE] Documento persistido en almacenamiento:`, {
    id: persistentDoc?.id,
    status: persistentDoc?.status,
    protectedPrice: persistentDoc?.protectedPrice,
    evidenceLevel: persistentDoc?.evidenceLevel
  });
  if (!persistentDoc || persistentDoc.status !== 'PUBLICADO') {
    throw new Error('Fallo: La orden no quedó persistida en almacenamiento con estado PUBLICADO');
  }

  console.log('\n======================================================');
  console.log('>>> FLUJO CLIENTE -> EMITIR OPERACIÓN ZÉNITH -> PUBLICADO -> MOTORIZADO EXITOSO <<<');
  console.log('======================================================');
  process.exit(0);
}

validateEmitirOperacionZenithFlow().catch(err => {
  console.error('[TEST ERROR FATAL]', err);
  process.exit(1);
});
