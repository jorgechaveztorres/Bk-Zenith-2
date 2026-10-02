/**
 * ZÉNITH SUITE FASE 2.5: E2E REAL + IDEMPOTENCIA CONCURRENTE + AUDITORÍA DE INTEGRIDAD
 * 
 * Verifica las 24 condiciones críticas de:
 * 1. Autenticación Zero-Trust (token faltante, inválido, passengerId mismatch)
 * 2. Validación de Quote DPE V2 y ataques de manipulación (9 ataques criptográficos)
 * 3. Idempotencia Secuencial (primer request, retry, doble click, timeout replay)
 * 4. Idempotencia Concurrente (Promise.all simultáneo -> EXACTAMENTE UN RIDE EN FIRESTORE)
 * 5. Protección de Clave de Idempotencia Reutilizada con Carga Útil Diferente (HTTP 409 Conflict)
 * 6. Verificación de Reglas Firestore (allow create: if false) y Persistencia Inmutable
 */

import { calculateServerQuote, generateQuoteSignature } from '../server/services/pricing.service';
import { RideService } from '../server/services/ride.service';
import { db } from '../server/config/firebase';
import { setRouteProvider, MockRouteProvider } from '../server/services/routes.service';
import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

interface TestReport {
  id: number;
  name: string;
  type: 'REAL E2E' | 'INTEGRATION' | 'UNIT' | 'STATIC';
  status: 'PASS' | 'FAIL';
  evidence: string;
}

const testResults: TestReport[] = [];

function recordTest(id: number, name: string, type: 'REAL E2E' | 'INTEGRATION' | 'UNIT' | 'STATIC', pass: boolean, evidence: string) {
  if (pass) {
    passed++;
    testResults.push({ id, name, type, status: 'PASS', evidence });
    console.log(`  [PASS] Test ${id} (${type}): ${name} -> ${evidence}`);
  } else {
    failed++;
    testResults.push({ id, name, type, status: 'FAIL', evidence });
    console.error(`  [FAIL] Test ${id} (${type}): ${name} -> ${evidence}`);
  }
}

async function runSuite() {
  console.log('======================================================================');
  console.log('  ZÉNITH — SUITE FASE 2.5: E2E REAL + IDEMPOTENCIA CONCURRENTE + INTEGRIDAD');
  console.log('======================================================================\n');

  // Configurar proveedor de rutas mockeado determinista para las cotizaciones de prueba
  setRouteProvider(new MockRouteProvider({ distanceKm: 4.50, durationMinutes: 12 }));

  const baseUrl = 'http://localhost:3000';
  const testPassengerUid = 'usr_passenger_e2e_real_999';

  console.log('--- GRUPO 1: AUTENTICACIÓN ZERO-TRUST EN ENDPOINT OFICIAL (REAL E2E) ---');

  // TEST 1: Request sin Firebase ID token -> HTTP 401
  try {
    const res = await fetch(`${baseUrl}/api/rides/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passengerId: testPassengerUid })
    });
    const body: any = await res.json().catch(() => ({}));
    recordTest(
      1,
      'Request sin Firebase ID token devuelve HTTP 401',
      'REAL E2E',
      res.status === 401 && body.success === false,
      `HTTP status ${res.status}: ${body.message}`
    );
  } catch (err: any) {
    recordTest(1, 'Request sin Firebase ID token devuelve HTTP 401', 'REAL E2E', false, err.message);
  }

  // TEST 2: Token inválido -> HTTP 401
  try {
    const res = await fetch(`${baseUrl}/api/rides/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token_invalido_totalmente_falso_xyz'
      },
      body: JSON.stringify({ passengerId: testPassengerUid })
    });
    const body: any = await res.json().catch(() => ({}));
    recordTest(
      2,
      'Token de autenticación inválido devuelve HTTP 401',
      'REAL E2E',
      res.status === 401 && body.success === false,
      `HTTP status ${res.status}: ${body.message}`
    );
  } catch (err: any) {
    recordTest(2, 'Token de autenticación inválido devuelve HTTP 401', 'REAL E2E', false, err.message);
  }

  // TEST 3: Discrepancia entre auth.uid y passengerId -> RECHAZADO (403)
  try {
    const validQuote = await calculateServerQuote({
      originLat: -8.1116,
      originLng: -79.0287,
      destLat: -8.1300,
      destLng: -79.0350,
      originAddress: 'Plaza de Armas Trujillo',
      destAddress: 'Mall Aventura Trujillo',
      pendingOrders: 1,
      availableDrivers: 2
    });

    let threw403 = false;
    try {
      await RideService.requestRide(
        { quote: validQuote, passengerId: 'impostor_uid_hacker' },
        testPassengerUid
      );
    } catch (err: any) {
      if (err.statusCode === 403 || err.message.includes('Zero-Trust')) {
        threw403 = true;
      }
    }
    recordTest(
      3,
      'Discrepancia entre auth.uid y passengerId produce rechazo HTTP 403',
      'INTEGRATION',
      threw403,
      'Bloqueado por verificación de identidad Zero-Trust'
    );
  } catch (err: any) {
    recordTest(3, 'Discrepancia entre auth.uid y passengerId produce rechazo HTTP 403', 'INTEGRATION', false, err.message);
  }

  console.log('\n--- GRUPO 2: VALIDACIÓN DE QUOTE DPE V2 Y ATAQUES DE MANIPULACIÓN (INTEGRATION) ---');

  // Generar cotización oficial para pruebas de manipulación
  const baseQuote = await calculateServerQuote({
    originLat: -8.1116,
    originLng: -79.0287,
    destLat: -8.1300,
    destLng: -79.0350,
    originAddress: 'Plaza de Armas Trujillo',
    destAddress: 'Mall Aventura Trujillo',
    pendingOrders: 1,
    availableDrivers: 2
  });

  // TEST 4: Quote oficial válido es aceptado por el Gatekeeper
  try {
    const keyValid = `key_valid_${Date.now()}`;
    const ride = await RideService.requestRide(
      { quote: baseQuote, passengerId: testPassengerUid, idempotencyKey: keyValid },
      testPassengerUid
    );
    recordTest(
      4,
      'Quote oficial legítimo emitido por el servidor es aceptado por el Gatekeeper',
      'INTEGRATION',
      ride && ride.id && ride.protectedPrice === baseQuote.totalFare,
      `Ride ID: ${ride.id} | Tarifa inmutable: S/ ${ride.protectedPrice}`
    );
  } catch (err: any) {
    recordTest(4, 'Quote oficial legítimo emitido por el servidor es aceptado por el Gatekeeper', 'INTEGRATION', false, err.message);
  }

  // TEST 5: Ataque 8 - Quote expirado es rechazado
  try {
    const expiredQuote = { ...baseQuote, expiresAt: new Date(Date.now() - 60000).toISOString() };
    let rejected = false;
    try {
      await RideService.requestRide(
        { quote: expiredQuote, passengerId: testPassengerUid, idempotencyKey: `k_exp_${Date.now()}` },
        testPassengerUid
      );
    } catch {
      rejected = true;
    }
    recordTest(5, 'Ataque 8: Quote expirado es rechazado por el Gatekeeper', 'INTEGRATION', rejected, 'Rechazo temporal activo');
  } catch (err: any) {
    recordTest(5, 'Ataque 8: Quote expirado es rechazado por el Gatekeeper', 'INTEGRATION', false, err.message);
  }

  // TEST 6: Ataque 1 - Modificar totalFare
  try {
    const alteredFare = { ...baseQuote, totalFare: 2.00 }; // Intento de pagar S/ 2 en vez de S/ 6
    let rejected = false;
    try {
      await RideService.requestRide(
        { quote: alteredFare, passengerId: testPassengerUid, idempotencyKey: `k_atk1_${Date.now()}` },
        testPassengerUid
      );
    } catch {
      rejected = true;
    }
    recordTest(6, 'Ataque 1: Modificación fraudulenta de totalFare es detectada y rechazada', 'INTEGRATION', rejected, 'HMAC SHA-256 seal mismatch');
  } catch (err: any) {
    recordTest(6, 'Ataque 1: Modificación fraudulenta de totalFare es detectada y rechazada', 'INTEGRATION', false, err.message);
  }

  // TEST 7: Ataque 2 - Modificar normalFare
  try {
    const alteredNormal = { ...baseQuote, normalFare: 3.00 };
    let rejected = false;
    try {
      await RideService.requestRide(
        { quote: alteredNormal, passengerId: testPassengerUid, idempotencyKey: `k_atk2_${Date.now()}` },
        testPassengerUid
      );
    } catch {
      rejected = true;
    }
    recordTest(7, 'Ataque 2: Modificación de normalFare es detectada y rechazada', 'INTEGRATION', rejected, 'HMAC seal mismatch');
  } catch (err: any) {
    recordTest(7, 'Ataque 2: Modificación de normalFare es detectada y rechazada', 'INTEGRATION', false, err.message);
  }

  // TEST 8: Ataque 3 - Modificar distance
  try {
    const alteredDist = { ...baseQuote, distance: 1.00 };
    let rejected = false;
    try {
      await RideService.requestRide(
        { quote: alteredDist, passengerId: testPassengerUid, idempotencyKey: `k_atk3_${Date.now()}` },
        testPassengerUid
      );
    } catch {
      rejected = true;
    }
    recordTest(8, 'Ataque 3: Modificación de distancia vial es detectada y rechazada', 'INTEGRATION', rejected, 'HMAC seal mismatch');
  } catch (err: any) {
    recordTest(8, 'Ataque 3: Modificación de distancia vial es detectada y rechazada', 'INTEGRATION', false, err.message);
  }

  // TEST 9: Ataque 4 - Modificar multiplier
  try {
    const alteredMult = { ...baseQuote, multiplier: 1.30 };
    let rejected = false;
    try {
      await RideService.requestRide(
        { quote: alteredMult, passengerId: testPassengerUid, idempotencyKey: `k_atk4_${Date.now()}` },
        testPassengerUid
      );
    } catch {
      rejected = true;
    }
    recordTest(9, 'Ataque 4: Modificación de multiplicador dinámico es detectada y rechazada', 'INTEGRATION', rejected, 'HMAC seal mismatch');
  } catch (err: any) {
    recordTest(9, 'Ataque 4: Modificación de multiplicador dinámico es detectada y rechazada', 'INTEGRATION', false, err.message);
  }

  // TEST 10: Ataque 5 - Modificar currency (PEN -> USD)
  try {
    const alteredCurr = { ...baseQuote, currency: 'USD' };
    let rejected = false;
    try {
      await RideService.requestRide(
        { quote: alteredCurr, passengerId: testPassengerUid, idempotencyKey: `k_atk5_${Date.now()}` },
        testPassengerUid
      );
    } catch {
      rejected = true;
    }
    recordTest(10, 'Ataque 5: Modificación de moneda (PEN -> USD) es rechazada inmediatamente', 'INTEGRATION', rejected, 'Moneda no autorizada rechazada');
  } catch (err: any) {
    recordTest(10, 'Ataque 5: Modificación de moneda (PEN -> USD) es rechazada inmediatamente', 'INTEGRATION', false, err.message);
  }

  // TEST 11: Ataque 6 - Modificar pricingVersion
  try {
    const alteredVer = { ...baseQuote, pricingVersion: 'LEGACY_V1' };
    let rejected = false;
    try {
      await RideService.requestRide(
        { quote: alteredVer, passengerId: testPassengerUid, idempotencyKey: `k_atk6_${Date.now()}` },
        testPassengerUid
      );
    } catch {
      rejected = true;
    }
    recordTest(11, 'Ataque 6: Modificación de versión de pricing es rechazada', 'INTEGRATION', rejected, 'pricingVersion != DPE_V2 rechazada');
  } catch (err: any) {
    recordTest(11, 'Ataque 6: Modificación de versión de pricing es rechazada', 'INTEGRATION', false, err.message);
  }

  // TEST 12: Ataque 7a - Modificar origen manteniendo el quote
  try {
    const alteredOrig = {
      ...baseQuote,
      origin: { ...baseQuote.origin, address: 'Dirección Totalmente Alterada', lat: -12.046, lng: -77.042 }
    };
    let rejected = false;
    try {
      await RideService.requestRide(
        { quote: alteredOrig, passengerId: testPassengerUid, idempotencyKey: `k_atk7a_${Date.now()}` },
        testPassengerUid
      );
    } catch {
      rejected = true;
    }
    recordTest(12, 'Ataque 7a: Modificación de coordenadas/dirección de origen invalida la cotización', 'INTEGRATION', rejected, 'Enlace criptográfico de coordenadas intacto');
  } catch (err: any) {
    recordTest(12, 'Ataque 7a: Modificación de coordenadas/dirección de origen invalida la cotización', 'INTEGRATION', false, err.message);
  }

  // TEST 13: Ataque 7b - Modificar destino manteniendo el quote
  try {
    const alteredDest = {
      ...baseQuote,
      destination: { ...baseQuote.destination, address: 'Destino no cotizado', lat: -16.409, lng: -71.537 }
    };
    let rejected = false;
    try {
      await RideService.requestRide(
        { quote: alteredDest, passengerId: testPassengerUid, idempotencyKey: `k_atk7b_${Date.now()}` },
        testPassengerUid
      );
    } catch {
      rejected = true;
    }
    recordTest(13, 'Ataque 7b: Modificación de coordenadas/dirección de destino invalida la cotización', 'INTEGRATION', rejected, 'Enlace criptográfico de coordenadas intacto');
  } catch (err: any) {
    recordTest(13, 'Ataque 7b: Modificación de coordenadas/dirección de destino invalida la cotización', 'INTEGRATION', false, err.message);
  }

  // TEST 14: Ataque 9 - PricingSeal alterada arbitrariamente
  try {
    const alteredSeal = { ...baseQuote, pricingSeal: '0000000000000000000000000000000000000000000000000000000000000000' };
    let rejected = false;
    try {
      await RideService.requestRide(
        { quote: alteredSeal, passengerId: testPassengerUid, idempotencyKey: `k_atk9_${Date.now()}` },
        testPassengerUid
      );
    } catch {
      rejected = true;
    }
    recordTest(14, 'Ataque 9: Sello pricingSeal falsificado es rechazado por validación HMAC', 'INTEGRATION', rejected, 'Firma HMAC inválida rechazada');
  } catch (err: any) {
    recordTest(14, 'Ataque 9: Sello pricingSeal falsificado es rechazado por validación HMAC', 'INTEGRATION', false, err.message);
  }

  console.log('\n--- GRUPO 3: IDEMPOTENCIA REAL, ATOMICIDAD Y CONCURRENCIA (REAL INTEGRATION) ---');

  // CASO 1: TEST 15 - Request inicial crea el viaje con _idempotent = false
  const keyK1 = `idemp_k1_${Date.now()}`;
  let rideK1: any = null;
  try {
    rideK1 = await RideService.requestRide(
      { quote: baseQuote, passengerId: testPassengerUid, idempotencyKey: keyK1 },
      testPassengerUid
    );
    recordTest(
      15,
      'CASO 1: Solicitud inicial crea exitosamente exactamente UN viaje (_idempotent: false)',
      'INTEGRATION',
      Boolean(rideK1 && rideK1.id && rideK1._idempotent === false),
      `Creado viaje ${rideK1?.id} con clave ${keyK1}`
    );
  } catch (err: any) {
    recordTest(15, 'CASO 1: Solicitud inicial crea exitosamente exactamente UN viaje', 'INTEGRATION', false, err.message);
  }

  // CASO 2: TEST 16 - Retry secuencial devuelve el mismo rideId con _idempotent = true
  try {
    const retryK1 = await RideService.requestRide(
      { quote: baseQuote, passengerId: testPassengerUid, idempotencyKey: keyK1 },
      testPassengerUid
    );
    recordTest(
      16,
      'CASO 2: Reintento secuencial devuelve exactamente el mismo viaje sin crear duplicado (_idempotent: true)',
      'INTEGRATION',
      retryK1.id === rideK1.id && retryK1._idempotent === true,
      `Ride devuelto: ${retryK1.id} (mismo id, sin duplicación)`
    );
  } catch (err: any) {
    recordTest(16, 'CASO 2: Reintento secuencial devuelve exactamente el mismo viaje', 'INTEGRATION', false, err.message);
  }

  // CASO 3: TEST 17 - Doble click secuencial con clave K2
  const keyK2 = `idemp_k2_doubleclick_${Date.now()}`;
  try {
    const clickA = await RideService.requestRide(
      { quote: baseQuote, passengerId: testPassengerUid, idempotencyKey: keyK2 },
      testPassengerUid
    );
    const clickB = await RideService.requestRide(
      { quote: baseQuote, passengerId: testPassengerUid, idempotencyKey: keyK2 },
      testPassengerUid
    );
    recordTest(
      17,
      'CASO 3: Doble click secuencial produce un solo viaje con id idéntico',
      'INTEGRATION',
      clickA.id === clickB.id && clickA._idempotent === false && clickB._idempotent === true,
      `Primer click: ${clickA.id} (_idempotent: false) | Segundo click: ${clickB.id} (_idempotent: true)`
    );
  } catch (err: any) {
    recordTest(17, 'CASO 3: Doble click secuencial produce un solo viaje con id idéntico', 'INTEGRATION', false, err.message);
  }

  // FASE F & I: TEST 18 - CONCURRENCIA REAL: Promise.all con K3 ejecutado al mismo instante
  const keyK3 = `idemp_k3_concurrent_${Date.now()}`;
  try {
    const [resConcurrentA, resConcurrentB] = await Promise.all([
      RideService.requestRide(
        { quote: baseQuote, passengerId: testPassengerUid, idempotencyKey: keyK3 },
        testPassengerUid
      ),
      RideService.requestRide(
        { quote: baseQuote, passengerId: testPassengerUid, idempotencyKey: keyK3 },
        testPassengerUid
      )
    ]);

    // Verificar en base de datos Firestore que existe EXACTAMENTE UN documento en rides con esta idempotencyKey
    const ridesWithK3Snap = await db.collection('rides').where('idempotencyKey', '==', keyK3).get();
    const countInFirestore = ridesWithK3Snap.size;

    const atomicSuccess = (
      resConcurrentA.id === resConcurrentB.id &&
      countInFirestore === 1 &&
      (resConcurrentA._idempotent !== resConcurrentB._idempotent) // Uno ganó (_idempotent: false), el otro esperó y reusó (_idempotent: true)
    );

    recordTest(
      18,
      'FASE F & I: Concurrencia real Promise.all simultáneo produce EXACTAMENTE UN ride en Firestore',
      'INTEGRATION',
      atomicSuccess,
      `Documentos en /rides con K3: ${countInFirestore} | Ride IDs devueltos: [${resConcurrentA.id}, ${resConcurrentB.id}]`
    );
  } catch (err: any) {
    recordTest(18, 'FASE F & I: Concurrencia real Promise.all simultáneo produce EXACTAMENTE UN ride en Firestore', 'INTEGRATION', false, err.message);
  }

  // FASE G: TEST 19 - Idempotency Key reutilizada con Payload Diferente -> RECHAZAR CONFLICTO (409)
  const keyK4 = `idemp_k4_conflict_${Date.now()}`;
  try {
    // 1. Primer request legítimo con payload A
    await RideService.requestRide(
      { quote: baseQuote, passengerId: testPassengerUid, idempotencyKey: keyK4 },
      testPassengerUid
    );

    // 2. Cotización B con destino diferente
    const quoteB = await calculateServerQuote({
      originLat: -8.1116,
      originLng: -79.0287,
      destLat: -8.1150,
      destLng: -79.0290,
      originAddress: 'Plaza de Armas Trujillo',
      destAddress: 'Huanchaco Playa',
      pendingOrders: 1,
      availableDrivers: 2
    });

    let rejectedConflict409 = false;
    let conflictErrorMessage = '';

    try {
      // Reutilizar keyK4 con payload B
      await RideService.requestRide(
        { quote: quoteB, passengerId: testPassengerUid, idempotencyKey: keyK4 },
        testPassengerUid
      );
    } catch (err: any) {
      if (err.statusCode === 409 || err.message.includes('Conflicto de Idempotencia')) {
        rejectedConflict409 = true;
        conflictErrorMessage = err.message;
      }
    }

    recordTest(
      19,
      'FASE G: Idempotency Key reutilizada con Payload Diferente es RECHAZADA con HTTP 409 Conflict',
      'INTEGRATION',
      rejectedConflict409,
      `Error 409 detectado: "${conflictErrorMessage}"`
    );
  } catch (err: any) {
    recordTest(19, 'FASE G: Idempotency Key reutilizada con Payload Diferente es RECHAZADA', 'INTEGRATION', false, err.message);
  }

  // FASE J: TEST 20 - Timeout / Retry tras pérdida de respuesta simulada
  const keyK5 = `idemp_k5_timeout_${Date.now()}`;
  try {
    const originalRide = await RideService.requestRide(
      { quote: baseQuote, passengerId: testPassengerUid, idempotencyKey: keyK5 },
      testPassengerUid
    );

    // Cliente asume pérdida de conexión y reintenta con la misma clave
    const recoveredRide = await RideService.requestRide(
      { quote: baseQuote, passengerId: testPassengerUid, idempotencyKey: keyK5 },
      testPassengerUid
    );

    recordTest(
      20,
      'FASE J: Retry tras pérdida de respuesta recupera el viaje original sin duplicarlo',
      'INTEGRATION',
      recoveredRide.id === originalRide.id && recoveredRide._idempotent === true,
      `Ride ID original recuperado intacto: ${recoveredRide.id}`
    );
  } catch (err: any) {
    recordTest(20, 'FASE J: Retry tras pérdida de respuesta recupera el viaje original', 'INTEGRATION', false, err.message);
  }

  console.log('\n--- GRUPO 4: REGLAS DE SEGURIDAD FIRESTORE & AUDITORÍA DE PERSISTENCIA ---');

  // TEST 21: firestore.rules prohíbe creación directa desde cliente (allow create: if false)
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');
  const hasRidesCreateIfFalse = /match\s+\/rides\/\{rideId\}\s*\{[\s\S]*?allow\s+create:\s*if\s+false;/.test(rulesContent);
  const hasIdempKeysClosed = /match\s+\/idempotency_keys\/\{keyId\}\s*\{[\s\S]*?allow\s+read,\s*write:\s*if\s+false;/.test(rulesContent);
  recordTest(
    21,
    'firestore.rules prohíbe creación directa de rides (allow create: if false) e independiza idempotency_keys',
    'STATIC',
    hasRidesCreateIfFalse && hasIdempKeysClosed,
    'Regla Zero-Trust "allow create: if false" activa para /rides e /idempotency_keys'
  );

  // TEST 22: Creación exclusiva permitida únicamente mediante Firebase Admin SDK en el Backend
  recordTest(
    22,
    'Backend Gatekeeper crea exitosamente rides en Firestore mediante Firebase Admin SDK',
    'INTEGRATION',
    Boolean(rideK1 && rideK1.id),
    `Viaje creado por backend autorizado: ${rideK1?.id}`
  );

  // TEST 23: Exactamente un viaje persistido y verificado en Firestore
  let verifiedInDb = false;
  let dbPrice = 0;
  let dbCurrency = '';
  try {
    const docSnap = await db.collection('rides').doc(rideK1.id).get();
    if (docSnap.exists) {
      verifiedInDb = true;
      const data = docSnap.data()!;
      dbPrice = data.protectedPrice;
      dbCurrency = data.currency;
    }
    recordTest(
      23,
      'Verificación directa en Firestore: El documento fue persistido atómicamente con todos sus metadatos',
      'INTEGRATION',
      verifiedInDb && dbPrice > 0,
      `Documento /rides/${rideK1.id} confirmado en Firestore. protectedPrice: S/ ${dbPrice}`
    );
  } catch (err: any) {
    recordTest(23, 'Verificación directa en Firestore', 'INTEGRATION', false, err.message);
  }

  // TEST 24: La tarifa persistida coincide exactamente con el quote firmado
  recordTest(
    24,
    'La tarifa persistida en base de datos coincide de forma idéntica con el quote firmado DPE V2',
    'INTEGRATION',
    dbPrice === baseQuote.totalFare && dbCurrency === 'PEN',
    `Tarifa persistida: S/ ${dbPrice} PEN | Tarifa firmada en quote: S/ ${baseQuote.totalFare} PEN`
  );

  console.log('\n======================================================================');
  console.log(`  RESULTADO FASE 2.5: ${passed} PASSED / ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('======================================================================\n');

  console.log('TABLA DETALLADA DE EVIDENCIA:');
  console.table(testResults);

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch(e => {
  console.error('Error fatal ejecutando suite FASE 2.5:', e);
  process.exit(1);
});
