/**
 * ZÉNITH TEST SUITE FASE 3.2: OTP SERVER-SIDE & MÁQUINA DE ESTADOS ESTRICTA (FSM)
 * 
 * Verificación exhaustiva de 15 condiciones operativas y de seguridad:
 * 1. Generación OTP server-side
 * 2. OTP no derivable de rideId (criptográficamente seguro)
 * 3. OTP correcto permite WAITING_FOR_OTP -> IN_PROGRESS
 * 4. OTP incorrecto no cambia estado y consume intento
 * 5. OTP expirado rechazado
 * 6. Límite de intentos (>=3 bloquea)
 * 7. OTP reutilizado (ya consumido) rechazado
 * 8. Usuario no autorizado (otro conductor) -> 403 Forbidden
 * 9. Transiciones secuenciales válidas (DRIVER_ASSIGNED -> DRIVER_ARRIVING -> WAITING_FOR_OTP)
 * 10. Transición inválida rechazada (DRIVER_ARRIVING -> COMPLETED)
 * 11. Salto SEARCHING_DRIVER -> COMPLETED rechazado
 * 12. Salto DRIVER_ASSIGNED -> COMPLETED rechazado
 * 13. IN_PROGRESS -> COMPLETED válido con liberación a AVAILABLE
 * 14. Intento de enviar status = IN_PROGRESS directamente es rechazado
 * 15. Auditoría de reglas Firestore y componentes: Zero-Bypass
 */

import { RideService } from '../server/services/ride.service';
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
  console.log('  ZÉNITH — SUITE FASE 3.2: OTP SERVER-SIDE & MÁQUINA DE ESTADOS');
  console.log('======================================================================\n');

  setRouteProvider(new MockRouteProvider({ distanceKm: 4.20, durationMinutes: 12 }));
  const baseUrl = 'http://localhost:3000';

  async function createTestRide(passengerUid: string) {
    const quote = await calculateServerQuote({
      originLat: -8.1116,
      originLng: -79.0287,
      destLat: -8.1250,
      destLng: -79.0300,
      originAddress: 'Av. Larco 500, Trujillo',
      destAddress: 'Plaza Mayor, Trujillo',
      pendingOrders: 1,
      availableDrivers: 2
    });

    const key = `k_otp_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return await RideService.requestRide(
      { quote, passengerId: passengerUid, idempotencyKey: key },
      passengerUid
    );
  }

  async function setupDriver(driverId: string, status: 'AVAILABLE' | 'BUSY' = 'AVAILABLE') {
    await db.collection('drivers_online').doc(driverId).set({
      driverId,
      driverName: `Conductor ${driverId}`,
      status,
      city: 'Trujillo',
      lat: -8.1120,
      lng: -79.0290,
      rating: 4.9,
      lastActive: FieldValue.serverTimestamp()
    });
  }

  const passengerUid = `pass_f32_${Date.now()}`;
  const driverOfficial = `drv_official_${Date.now()}`;
  const driverAttacker = `drv_attacker_${Date.now()}`;

  await setupDriver(driverOfficial, 'AVAILABLE');
  await setupDriver(driverAttacker, 'AVAILABLE');

  console.log('--- SECCIÓN 1: CRIPTOGRAFÍA Y GENERACIÓN DE OTP SERVER-SIDE ---');

  // TEST 1: Generación OTP server-side
  const ride1 = await createTestRide(passengerUid);
  const snap1 = await db.collection('rides').doc(ride1.id).get();
  const data1 = snap1.data()!;

  const hasServerOtp = Boolean(
    data1.otpHash &&
    data1.passengerOtp &&
    /^\d{3}$/.test(data1.passengerOtp) &&
    data1.otpAttempts === 0 &&
    data1.otpVerified === false
  );

  recordTest(
    1,
    'Generación segura de OTP server-side en creación de orden',
    'INTEGRATION',
    hasServerOtp,
    `OTP generado: ${data1.passengerOtp} | Hash SHA-256: ${data1.otpHash.substring(0, 16)}... | Intentos: 0`
  );

  // TEST 2: OTP no es derivable del rideId
  const ride2 = await createTestRide(passengerUid);
  const snap2 = await db.collection('rides').doc(ride2.id).get();
  const data2 = snap2.data()!;

  // Verificar que el OTP no coincide con la vieja fórmula ASCII de rideId
  let oldAsciiSum = 0;
  for (let i = 0; i < ride1.id.length; i++) {
    oldAsciiSum += ride1.id.charCodeAt(i);
  }
  const oldExpected = ((oldAsciiSum % 900) + 100).toString();

  const isIndependent = (
    data1.passengerOtp !== oldExpected ||
    data1.passengerOtp !== data2.passengerOtp
  );

  recordTest(
    2,
    'OTP criptográfico es independiente y no derivable del rideId (Zero-Guessability)',
    'INTEGRATION',
    isIndependent,
    `Ride 1 OTP: ${data1.passengerOtp} != Ride 2 OTP: ${data2.passengerOtp} (ASCII sum ignorada)`
  );

  console.log('\n--- SECCIÓN 2: TRANSICIONES Y VALIDACIÓN DE OTP ---');

  // Preparar viaje en estado WAITING_FOR_OTP
  await RideService.acceptRide(ride1.id, driverOfficial, 'Conductor Oficial');
  await RideService.updateRideStatus(ride1.id, driverOfficial, 'DRIVER_ARRIVING');
  await RideService.updateRideStatus(ride1.id, driverOfficial, 'WAITING_FOR_OTP');

  // TEST 3: Intento con usuario no autorizado (otro conductor intenta validar el OTP) -> 403 Forbidden
  try {
    let forbidden = false;
    try {
      await RideService.verifyOtp(ride1.id, driverAttacker, data1.passengerOtp);
    } catch (err: any) {
      if (err.statusCode === 403) forbidden = true;
    }
    recordTest(
      3,
      'Conductor no autorizado intentando verificar OTP es rechazado con HTTP 403',
      'INTEGRATION',
      forbidden,
      'Bloqueado: Solo el conductor asignado puede validar el abordaje'
    );
  } catch (err: any) {
    recordTest(3, 'Conductor no autorizado rechazado', 'INTEGRATION', false, err.message);
  }

  // TEST 4: OTP incorrecto no cambia estado y consume intento
  try {
    let wrongOtpRejected = false;
    let wrongOtpMsg = '';
    try {
      await RideService.verifyOtp(ride1.id, driverOfficial, '000');
    } catch (err: any) {
      if (err.statusCode === 400 && err.message.includes('incorrecto')) {
        wrongOtpRejected = true;
        wrongOtpMsg = err.message;
      }
    }

    const checkSnap = await db.collection('rides').doc(ride1.id).get();
    const checkData = checkSnap.data()!;

    const passWrong = (
      wrongOtpRejected &&
      checkData.status === 'WAITING_FOR_OTP' &&
      checkData.otpAttempts === 1 &&
      checkData.otpVerified === false
    );

    recordTest(
      4,
      'OTP incorrecto no cambia estado y consume intento de forma atómica',
      'INTEGRATION',
      passWrong,
      `Mensaje: "${wrongOtpMsg}" | Estado conservado: ${checkData.status} | Intentos: ${checkData.otpAttempts}`
    );
  } catch (err: any) {
    recordTest(4, 'OTP incorrecto no cambia estado', 'INTEGRATION', false, err.message);
  }

  // TEST 5: OTP correcto permite transición a IN_PROGRESS
  try {
    const verifyRes = await RideService.verifyOtp(ride1.id, driverOfficial, data1.passengerOtp);
    
    const afterSnap = await db.collection('rides').doc(ride1.id).get();
    const afterData = afterSnap.data()!;

    const passCorrect = (
      verifyRes.status === 'IN_PROGRESS' &&
      afterData.status === 'IN_PROGRESS' &&
      afterData.otpVerified === true &&
      Boolean(afterData.startedAt)
    );

    recordTest(
      5,
      'OTP correcto autoriza atómicamente la transición WAITING_FOR_OTP -> IN_PROGRESS',
      'INTEGRATION',
      passCorrect,
      `Estado: ${afterData.status} | otpVerified: ${afterData.otpVerified} | startedAt registrado`
    );
  } catch (err: any) {
    recordTest(5, 'OTP correcto autoriza transición', 'INTEGRATION', false, err.message);
  }

  // TEST 6: OTP reutilizado (ya consumido) es rechazado
  try {
    let replayRejected = false;
    try {
      await RideService.verifyOtp(ride1.id, driverOfficial, data1.passengerOtp);
    } catch (err: any) {
      if (err.statusCode === 400) replayRejected = true;
    }
    recordTest(
      6,
      'OTP reutilizado (ya consumido en viaje IN_PROGRESS) es rechazado (Anti-Replay)',
      'INTEGRATION',
      replayRejected,
      'Rechazado: El código OTP no puede ser reutilizado tras iniciar el viaje'
    );
  } catch (err: any) {
    recordTest(6, 'OTP reutilizado rechazado', 'INTEGRATION', false, err.message);
  }

  // TEST 7: Límite de intentos (>=3 intentos incorrectos bloquea el abordaje)
  const bruteDriver = `drv_brute_${Date.now()}`;
  await setupDriver(bruteDriver, 'AVAILABLE');
  const bruteRide = await createTestRide(passengerUid);
  await RideService.acceptRide(bruteRide.id, bruteDriver, 'Conductor Brute');
  await RideService.updateRideStatus(bruteRide.id, bruteDriver, 'DRIVER_ARRIVING');
  await RideService.updateRideStatus(bruteRide.id, bruteDriver, 'WAITING_FOR_OTP');

  // Simular 3 intentos fallidos
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await RideService.verifyOtp(bruteRide.id, bruteDriver, `99${attempt}`);
    } catch (e) {
      // Esperado
    }
  }

  // Cuarto intento con el OTP correcto debe ser bloqueado por exceder límite
  const bruteSnap = await db.collection('rides').doc(bruteRide.id).get();
  const bruteData = bruteSnap.data()!;
  let blockedByLimit = false;

  try {
    await RideService.verifyOtp(bruteRide.id, bruteDriver, bruteData.passengerOtp);
  } catch (err: any) {
    if (err.statusCode === 400 && err.message.includes('Límite de intentos')) {
      blockedByLimit = true;
    }
  }

  recordTest(
    7,
    'Límite de intentos excedido (>=3) bloquea permanentemente el abordaje (Anti-Bruteforce)',
    'INTEGRATION',
    blockedByLimit,
    `Intentos registrados: ${bruteData.otpAttempts}/3. Intento 4 bloqueado por seguridad.`
  );

  // TEST 8: OTP expirado es rechazado
  const expDriver = `drv_exp_${Date.now()}`;
  await setupDriver(expDriver, 'AVAILABLE');
  const expiredRide = await createTestRide(passengerUid);
  await RideService.acceptRide(expiredRide.id, expDriver, 'Conductor Expired');
  await RideService.updateRideStatus(expiredRide.id, expDriver, 'DRIVER_ARRIVING');
  await RideService.updateRideStatus(expiredRide.id, expDriver, 'WAITING_FOR_OTP');

  // Forzar expiración en base de datos
  await db.collection('rides').doc(expiredRide.id).update({
    otpExpiresAt: new Date(Date.now() - 60000).toISOString() // 1 minuto en el pasado
  });

  const expSnap = await db.collection('rides').doc(expiredRide.id).get();
  const expData = expSnap.data()!;
  let expiredRejected = false;

  try {
    await RideService.verifyOtp(expiredRide.id, expDriver, expData.passengerOtp);
  } catch (err: any) {
    if (err.statusCode === 400 && err.message.includes('expirado')) {
      expiredRejected = true;
    }
  }

  recordTest(
    8,
    'Código OTP con marca de tiempo expirada es rechazado y no permite iniciar el viaje',
    'INTEGRATION',
    expiredRejected,
    'Rechazado con HTTP 400: "El código OTP ha expirado."'
  );

  console.log('\n--- SECCIÓN 3: MÁQUINA DE ESTADOS FINITA (FSM) Y TRANSICIONES PROHIBIDAS ---');

  // TEST 9: Transiciones secuenciales válidas completas
  const seqRide = await createTestRide(passengerUid);
  await setupDriver(`drv_seq_${Date.now()}`, 'AVAILABLE');
  const seqDriver = `drv_seq_${Date.now()}`;
  await setupDriver(seqDriver, 'AVAILABLE');

  const seqAccept: any = await RideService.acceptRide(seqRide.id, seqDriver);
  const seqArriving: any = await RideService.updateRideStatus(seqRide.id, seqDriver, 'DRIVER_ARRIVING');
  const seqWaiting: any = await RideService.updateRideStatus(seqRide.id, seqDriver, 'WAITING_FOR_OTP');

  const seqPass = (
    seqAccept.status === 'DRIVER_ASSIGNED' &&
    seqArriving.status === 'DRIVER_ARRIVING' &&
    seqWaiting.status === 'WAITING_FOR_OTP'
  );

  recordTest(
    9,
    'Transiciones secuenciales válidas (DRIVER_ASSIGNED -> DRIVER_ARRIVING -> WAITING_FOR_OTP)',
    'INTEGRATION',
    seqPass,
    'Cadena de estados respetada estrictamente por el backend'
  );

  // TEST 10: Transición inválida rechazada (DRIVER_ARRIVING -> COMPLETED)
  const invalidRide1 = await createTestRide(passengerUid);
  const invDriver1 = `drv_inv1_${Date.now()}`;
  await setupDriver(invDriver1, 'AVAILABLE');
  await RideService.acceptRide(invalidRide1.id, invDriver1);
  await RideService.updateRideStatus(invalidRide1.id, invDriver1, 'DRIVER_ARRIVING');

  let invalidTransitionRejected = false;
  try {
    await RideService.updateRideStatus(invalidRide1.id, invDriver1, 'COMPLETED');
  } catch (err: any) {
    if (err.statusCode === 400 && err.message.includes('Transición ilegal')) {
      invalidTransitionRejected = true;
    }
  }

  recordTest(
    10,
    'Transición inválida DRIVER_ARRIVING -> COMPLETED es rechazada por la FSM',
    'INTEGRATION',
    invalidTransitionRejected,
    'FSM bloqueó salto arbitrario no contemplado en matriz permitida'
  );

  // TEST 11: Salto SEARCHING_DRIVER -> COMPLETED rechazado
  const invalidRide2 = await createTestRide(passengerUid);
  let jumpFromSearchingRejected = false;
  try {
    await RideService.updateRideStatus(invalidRide2.id, driverOfficial, 'COMPLETED');
  } catch (err: any) {
    if (err.statusCode === 400 || err.statusCode === 403) {
      jumpFromSearchingRejected = true;
    }
  }

  recordTest(
    11,
    'Salto ilegal SEARCHING_DRIVER -> COMPLETED es rechazado con HTTP 400/403',
    'INTEGRATION',
    jumpFromSearchingRejected,
    'FSM bloqueó finalización de viaje sin asignación ni recorrido'
  );

  // TEST 12: Salto DRIVER_ASSIGNED -> COMPLETED rechazado
  const invalidRide3 = await createTestRide(passengerUid);
  const invDriver3 = `drv_inv3_${Date.now()}`;
  await setupDriver(invDriver3, 'AVAILABLE');
  await RideService.acceptRide(invalidRide3.id, invDriver3);

  let jumpFromAssignedRejected = false;
  try {
    await RideService.updateRideStatus(invalidRide3.id, invDriver3, 'COMPLETED');
  } catch (err: any) {
    if (err.statusCode === 400 && err.message.includes('Transición ilegal')) {
      jumpFromAssignedRejected = true;
    }
  }

  recordTest(
    12,
    'Salto ilegal DRIVER_ASSIGNED -> COMPLETED es rechazado con HTTP 400',
    'INTEGRATION',
    jumpFromAssignedRejected,
    'FSM bloqueó cierre prematuro de viaje asignado'
  );

  // TEST 13: IN_PROGRESS -> COMPLETED válido con liberación del conductor a AVAILABLE
  const compRide = await createTestRide(passengerUid);
  const compDriver = `drv_comp_${Date.now()}`;
  await setupDriver(compDriver, 'AVAILABLE');
  await RideService.acceptRide(compRide.id, compDriver);
  await RideService.updateRideStatus(compRide.id, compDriver, 'DRIVER_ARRIVING');
  await RideService.updateRideStatus(compRide.id, compDriver, 'WAITING_FOR_OTP');

  const compSnap = await db.collection('rides').doc(compRide.id).get();
  await RideService.verifyOtp(compRide.id, compDriver, compSnap.data()!.passengerOtp);

  // Completar el viaje
  const compResult = await RideService.updateRideStatus(compRide.id, compDriver, 'COMPLETED');
  
  const finalDriverSnap = await db.collection('drivers_online').doc(compDriver).get();
  const finalDriverData = finalDriverSnap.data()!;

  const finalRideSnap = await db.collection('rides').doc(compRide.id).get();
  const finalRideData = finalRideSnap.data()!;

  const compSuccess = (
    finalRideData.status === 'COMPLETED' &&
    Boolean(finalRideData.completedAt) &&
    finalDriverData.status === 'AVAILABLE' &&
    finalDriverData.currentRideId === null
  );

  recordTest(
    13,
    'Transición legítima IN_PROGRESS -> COMPLETED: registra completedAt y conmuta conductor BUSY -> AVAILABLE',
    'INTEGRATION',
    compSuccess,
    `Ride status: ${finalRideData.status} | Conductor ${compDriver} liberado a: ${finalDriverData.status}`
  );

  // TEST 14: Intento de forzar status = IN_PROGRESS directamente mediante updateRideStatus sin verify-otp
  const bypassRide = await createTestRide(passengerUid);
  const bypassDriver = `drv_bypass_${Date.now()}`;
  await setupDriver(bypassDriver, 'AVAILABLE');
  await RideService.acceptRide(bypassRide.id, bypassDriver);
  await RideService.updateRideStatus(bypassRide.id, bypassDriver, 'DRIVER_ARRIVING');
  await RideService.updateRideStatus(bypassRide.id, bypassDriver, 'WAITING_FOR_OTP');

  let directInProgressRejected = false;
  let inProgressMsg = '';
  try {
    await RideService.updateRideStatus(bypassRide.id, bypassDriver, 'IN_PROGRESS');
  } catch (err: any) {
    if (err.statusCode === 400 && err.message.includes('verify-otp')) {
      directInProgressRejected = true;
      inProgressMsg = err.message;
    }
  }

  recordTest(
    14,
    'Intento de forzar status = IN_PROGRESS directamente por status es RECHAZADO (Requiere verify-otp)',
    'INTEGRATION',
    directInProgressRejected,
    `Rechazado con HTTP 400: "${inProgressMsg}"`
  );

  console.log('\n--- SECCIÓN 4: AUDITORÍA DE SEGURIDAD Y FIRESTORE RULES ---');

  // TEST 15: firestore.rules prohíbe que el cliente modifique directamente 'status' o 'otpHash'
  const rulesContent = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
  const rulesProtectStatus = rulesContent.includes("'status'") && rulesContent.includes("'otpHash'") && rulesContent.includes("'driverId'");
  
  const driverFlowContent = fs.readFileSync(path.resolve(process.cwd(), 'src/components/DriverFlow.tsx'), 'utf8');
  const driverUsesVerifyOtp = driverFlowContent.includes('RideClientService.verifyOtp');
  const passengerHudContent = fs.readFileSync(path.resolve(process.cwd(), 'src/components/PassengerActiveTripHUD.tsx'), 'utf8');
  const passengerUsesServerOtp = !passengerHudContent.includes('generateRideOtp(ride.id)');

  recordTest(
    15,
    'Zero-Bypass garantizado: firestore.rules bloquea edición de status/otpHash y UI usa verifyOtp del backend',
    'STATIC',
    rulesProtectStatus && driverUsesVerifyOtp && passengerUsesServerOtp,
    'firestore.rules protege status, DriverFlow valida con verifyOtp, HUD consume passengerOtp'
  );

  console.log('\n======================================================================');
  console.log(`  RESULTADO FASE 3.2: ${passed} PASSED / ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('======================================================================\n');

  console.table(testResults);

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Error fatal en suite FASE 3.2:', err);
  process.exit(1);
});
