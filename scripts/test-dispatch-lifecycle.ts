/**
 * ZÉNITH TEST SUITE FASE 3.1: DISPATCH SERVER-SIDE + ASIGNACIÓN ATÓMICA + AVAILABLE/BUSY
 * 
 * Verifica las 12 condiciones obligatorias:
 * 1. Conductor disponible puede aceptar (200/201, ride -> DRIVER_ASSIGNED)
 * 2. Conductor no autenticado -> 401
 * 3. Conductor no disponible -> rechazo (400/409)
 * 4. Ride inexistente -> 404
 * 5. Ride ya asignado -> 409 Conflict
 * 6. Doble aceptación concurrente -> exactamente un ganador (Promise.all real)
 * 7. Ganador queda en estado BUSY
 * 8. Perdedor permanece en estado AVAILABLE
 * 9. El ride contiene estrictamente un único driverId
 * 10. Frontend no contiene creación ni aceptación directa en /rides (sin bypass setDoc)
 * 11. PassengerFlow no ejecuta DispatchEngine como autoridad en background
 * 12. Consistencia y no-regresión operativa
 */

import { RideService } from '../server/services/ride.service';
import { DispatchService } from '../server/services/dispatch.service';
import { calculateServerQuote } from '../server/services/pricing.service';
import { setRouteProvider, MockRouteProvider } from '../server/services/routes.service';
import { db } from '../server/config/firebase';
import { FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

interface TestReport {
  id: number;
  name: string;
  type: 'REAL E2E' | 'INTEGRATION' | 'STATIC';
  status: 'PASS' | 'FAIL';
  evidence: string;
}

const testResults: TestReport[] = [];

function recordTest(id: number, name: string, type: 'REAL E2E' | 'INTEGRATION' | 'STATIC', pass: boolean, evidence: string) {
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
  console.log('  ZÉNITH — SUITE FASE 3.1: DISPATCH SERVER-SIDE & ASIGNACIÓN ATÓMICA');
  console.log('======================================================================\n');

  setRouteProvider(new MockRouteProvider({ distanceKm: 3.50, durationMinutes: 10 }));
  const baseUrl = 'http://localhost:3000';

  // Helper para crear un viaje de prueba en estado SEARCHING_DRIVER
  async function createTestRide(passengerUid: string) {
    const quote = await calculateServerQuote({
      originLat: -8.1116,
      originLng: -79.0287,
      destLat: -8.1250,
      destLng: -79.0300,
      originAddress: 'Av. España 100, Trujillo',
      destAddress: 'Mall Aventura, Trujillo',
      pendingOrders: 1,
      availableDrivers: 2
    });

    const key = `k_test_f3_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return await RideService.requestRide(
      { quote, passengerId: passengerUid, idempotencyKey: key },
      passengerUid
    );
  }

  // Helper para preparar un conductor en drivers_online
  async function setupDriver(driverId: string, status: 'AVAILABLE' | 'BUSY', city = 'Trujillo') {
    const driverRef = db.collection('drivers_online').doc(driverId);
    await driverRef.set({
      driverId,
      driverName: `Conductor Test ${driverId}`,
      status,
      city,
      lat: -8.1120,
      lng: -79.0290,
      rating: 4.9,
      lastActive: FieldValue.serverTimestamp()
    });
  }

  console.log('--- SECCIÓN 1: VALIDACIÓN HTTP Y AUTENTICACIÓN ---');

  // TEST 1 (Conductor no autenticado -> 401 en endpoint oficial)
  try {
    const res = await fetch(`${baseUrl}/api/rides/ride_dummy_123/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverLocation: { lat: -8.11, lng: -79.02 } })
    });
    const body: any = await res.json().catch(() => ({}));
    recordTest(
      1,
      'Conductor no autenticado intentando aceptar viaje devuelve HTTP 401',
      'REAL E2E',
      res.status === 401 && body.success === false,
      `HTTP status ${res.status}: ${body.message}`
    );
  } catch (err: any) {
    recordTest(1, 'Conductor no autenticado devuelve HTTP 401', 'REAL E2E', false, err.message);
  }

  console.log('\n--- SECCIÓN 2: ACEPTACIÓN Y CONTROL DE DISPONIBILIDAD (INTEGRATION) ---');

  const passengerUid = `pass_f31_${Date.now()}`;
  const driverA = `drv_f31_A_${Date.now()}`;
  const driverB = `drv_f31_B_${Date.now()}`;
  const driverC = `drv_f31_C_${Date.now()}`;

  // Configurar conductores
  await setupDriver(driverA, 'AVAILABLE');
  await setupDriver(driverB, 'AVAILABLE');
  await setupDriver(driverC, 'BUSY'); // Driver C está ocupado

  // TEST 2 (Conductor disponible puede aceptar -> ride DRIVER_ASSIGNED y conductor pasa a BUSY)
  const ride1 = await createTestRide(passengerUid);
  try {
    const acceptRes: any = await RideService.acceptRide(ride1.id, driverA, 'Carlos Driver A');
    
    // Verificar estado del viaje
    const rideSnap = await db.collection('rides').doc(ride1.id).get();
    const updatedRide = rideSnap.data()!;

    // Verificar estado del conductor en drivers_online
    const driverSnap = await db.collection('drivers_online').doc(driverA).get();
    const updatedDriver = driverSnap.data()!;

    const pass = (
      acceptRes.status === 'DRIVER_ASSIGNED' &&
      updatedRide.status === 'DRIVER_ASSIGNED' &&
      updatedRide.driverId === driverA &&
      updatedDriver.status === 'BUSY' &&
      updatedDriver.currentRideId === ride1.id
    );

    recordTest(
      2,
      'Conductor AVAILABLE acepta viaje: ride pasa a DRIVER_ASSIGNED y conductor pasa atómicamente a BUSY',
      'INTEGRATION',
      pass,
      `Ride: ${ride1.id} -> DRIVER_ASSIGNED | Driver: ${driverA} -> BUSY`
    );
  } catch (err: any) {
    recordTest(2, 'Conductor AVAILABLE acepta viaje', 'INTEGRATION', false, err.message);
  }

  // TEST 3 (Idempotencia / Retry seguro: El mismo conductor vuelve a aceptar el mismo viaje)
  try {
    const retryRes: any = await RideService.acceptRide(ride1.id, driverA, 'Carlos Driver A');
    recordTest(
      3,
      'Reintento de aceptación por el mismo conductor es idempotente y seguro (_idempotent: true)',
      'INTEGRATION',
      retryRes.id === ride1.id && retryRes._idempotent === true && retryRes.driverId === driverA,
      `Mismo ride ${retryRes.id} devuelto sin duplicación`
    );
  } catch (err: any) {
    recordTest(3, 'Reintento de aceptación por el mismo conductor', 'INTEGRATION', false, err.message);
  }

  // TEST 4 (Conductor NO disponible intenta aceptar -> rechazo 409/400)
  const ride2 = await createTestRide(passengerUid);
  try {
    let rejectedBusy = false;
    let busyMsg = '';
    try {
      await RideService.acceptRide(ride2.id, driverC, 'Carlos Driver C (BUSY)');
    } catch (err: any) {
      if (err.statusCode === 409 || err.statusCode === 400 || err.message.includes('disponible')) {
        rejectedBusy = true;
        busyMsg = err.message;
      }
    }
    recordTest(
      4,
      'Conductor con status BUSY o no AVAILABLE es rechazado al intentar aceptar',
      'INTEGRATION',
      rejectedBusy,
      `Rechazado con mensaje: "${busyMsg}"`
    );
  } catch (err: any) {
    recordTest(4, 'Conductor BUSY rechazado', 'INTEGRATION', false, err.message);
  }

  // TEST 5 (Ride inexistente -> 404)
  try {
    let rejected404 = false;
    try {
      await RideService.acceptRide('ride_totalmente_inexistente_9999', driverB);
    } catch (err: any) {
      if (err.statusCode === 404) rejected404 = true;
    }
    recordTest(
      5,
      'Aceptar viaje inexistente devuelve HTTP 404 Not Found',
      'INTEGRATION',
      rejected404,
      'Error 404 capturado correctamente'
    );
  } catch (err: any) {
    recordTest(5, 'Aceptar viaje inexistente devuelve 404', 'INTEGRATION', false, err.message);
  }

  // TEST 6 (Ride ya asignado intentado por OTRO conductor -> HTTP 409 Conflict)
  try {
    let rejectedConflict = false;
    let conflictMsg = '';
    try {
      await RideService.acceptRide(ride1.id, driverB, 'Carlos Driver B');
    } catch (err: any) {
      if (err.statusCode === 409) {
        rejectedConflict = true;
        conflictMsg = err.message;
      }
    }
    recordTest(
      6,
      'Ride previamente asignado intentado por otro conductor devuelve HTTP 409 Conflict',
      'INTEGRATION',
      rejectedConflict,
      `HTTP 409: "${conflictMsg}"`
    );
  } catch (err: any) {
    recordTest(6, 'Ride ya asignado devuelve 409 Conflict', 'INTEGRATION', false, err.message);
  }

  console.log('\n--- SECCIÓN 3: CONCURRENCIA REAL Y ASIGNACIÓN ATÓMICA ---');

  // Preparar dos conductores AVAILABLE para la carrera concurrente
  const driverWinner = `drv_race_win_${Date.now()}`;
  const driverLoser = `drv_race_lose_${Date.now()}`;
  await setupDriver(driverWinner, 'AVAILABLE');
  await setupDriver(driverLoser, 'AVAILABLE');

  const raceRide = await createTestRide(passengerUid);

  let winnerId = '';
  let loserId = '';
  let loserStatusCode = 0;

  // TEST 7 & 8: Doble aceptación simultánea con Promise.all
  try {
    const results = await Promise.allSettled([
      RideService.acceptRide(raceRide.id, driverWinner, 'Conductor Competidor 1'),
      RideService.acceptRide(raceRide.id, driverLoser, 'Conductor Competidor 2')
    ]);

    const fulfilled = results.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<any>[];
    const rejected = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];

    if (fulfilled.length === 1 && rejected.length === 1) {
      winnerId = fulfilled[0].value.driverId;
      loserId = winnerId === driverWinner ? driverLoser : driverWinner;
      loserStatusCode = (rejected[0].reason as any).statusCode || 500;
    }

    // Verificar en base de datos Firestore
    const raceSnap = await db.collection('rides').doc(raceRide.id).get();
    const finalRideData = raceSnap.data()!;

    // Verificar presencia del ganador
    const winSnap = await db.collection('drivers_online').doc(winnerId).get();
    const winData = winSnap.data()!;

    // Verificar presencia del perdedor
    const loseSnap = await db.collection('drivers_online').doc(loserId).get();
    const loseData = loseSnap.data()!;

    const raceSuccess = (
      fulfilled.length === 1 &&
      rejected.length === 1 &&
      loserStatusCode === 409 &&
      finalRideData.status === 'DRIVER_ASSIGNED' &&
      finalRideData.driverId === winnerId &&
      winData.status === 'BUSY' &&
      loseData.status === 'AVAILABLE'
    );

    recordTest(
      7,
      'Concurrencia real Promise.all: Exactamente un conductor gana y el otro recibe HTTP 409 Conflict',
      'INTEGRATION',
      raceSuccess,
      `Ganador: ${winnerId} (200 OK) | Perdedor: ${loserId} (HTTP 409 Conflict)`
    );

    recordTest(
      8,
      'Consistencia de Driver Presence: El ganador queda en BUSY y el perdedor permanece en AVAILABLE',
      'INTEGRATION',
      winData.status === 'BUSY' && loseData.status === 'AVAILABLE',
      `Ganador ${winnerId}: ${winData.status} | Perdedor ${loserId}: ${loseData.status}`
    );

    recordTest(
      9,
      'Unicidad del viaje: No existen dos driverId ni doble asignación en el documento de Firestore',
      'INTEGRATION',
      finalRideData.driverId === winnerId && !Array.isArray(finalRideData.driverId),
      `driverId único confirmado en Firestore: ${finalRideData.driverId}`
    );
  } catch (err: any) {
    recordTest(7, 'Concurrencia real Promise.all', 'INTEGRATION', false, err.message);
  }

  console.log('\n--- SECCIÓN 4: AUDITORÍA ESTÁTICA Y FRONTEND ZERO-BYPASS ---');

  // TEST 10 (Frontend no contiene creación directa ni setDoc de asignación)
  const driverFlowContent = fs.readFileSync(path.resolve(process.cwd(), 'src/components/DriverFlow.tsx'), 'utf8');
  const driverDashContent = fs.readFileSync(path.resolve(process.cwd(), 'src/components/driver/DriverDashboard.tsx'), 'utf8');
  
  const hasDirectSetDocInDriverFlow = /setDoc\s*\(\s*doc\s*\(\s*db\s*,\s*['"]rides['"][\s\S]{1,150}?DRIVER_ASSIGNED/.test(driverFlowContent);
  const hasDirectSetDocInDriverDash = /setDoc\s*\(\s*doc\s*\(\s*db\s*,\s*['"]rides['"][\s\S]{1,150}?DRIVER_ASSIGNED/.test(driverDashContent);
  
  const callsRideClientServiceInDriver = /RideClientService\.acceptRide/.test(driverFlowContent) && /RideClientService\.acceptRide/.test(driverDashContent);

  recordTest(
    10,
    'Frontend desmanteló asignación directa: DriverFlow y DriverDashboard usan exclusivamente RideClientService',
    'STATIC',
    !hasDirectSetDocInDriverFlow && !hasDirectSetDocInDriverDash && callsRideClientServiceInDriver,
    'Zero-bypass confirmado: setDoc(DRIVER_ASSIGNED) eliminado de los componentes de conductor'
  );

  // TEST 11 (PassengerFlow no ejecuta DispatchEngine como autoridad)
  const passengerFlowContent = fs.readFileSync(path.resolve(process.cwd(), 'src/components/PassengerFlow.tsx'), 'utf8');
  const passengerHasDispatchInterval = /DispatchEngine\.runDispatchCycle/.test(passengerFlowContent);

  recordTest(
    11,
    'PassengerFlow no ejecuta DispatchEngine: La autoridad de despacho fue erradicada del navegador del cliente',
    'STATIC',
    !passengerHasDispatchInterval,
    'setInterval y llamada cliente de DispatchEngine eliminados de PassengerFlow'
  );

  // TEST 12 (Despacho Server-Side autónomo: DispatchService genera oferta y auditoría)
  const rideToDispatch = await createTestRide(passengerUid);
  const dispatchDriver = `drv_disp_${Date.now()}`;
  await setupDriver(dispatchDriver, 'AVAILABLE', rideToDispatch.city);

  const dispatchResult = await DispatchService.runDispatchCycle(rideToDispatch.id);
  const passDispatch = (
    dispatchResult.dispatched === true &&
    dispatchResult.status === 'OFFERED' &&
    Boolean(dispatchResult.assignedDriverId)
  );

  recordTest(
    12,
    'DispatchService server-side opera con plena autoridad evaluando conductores y generando asignación OFFERED',
    'INTEGRATION',
    passDispatch,
    `Despacho server-side exitoso: oferta creada para conductor ${dispatchResult.assignedDriverId}`
  );

  console.log('\n======================================================================');
  console.log(`  RESULTADO FASE 3.1: ${passed} PASSED / ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('======================================================================\n');

  console.table(testResults);

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Error fatal en suite FASE 3.1:', err);
  process.exit(1);
});
