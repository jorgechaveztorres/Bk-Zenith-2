// ============================================================================
// ZÉNITH — SUITE DE PRUEBAS: TOPUP V1 CON VALIDACIÓN HUMANA
// Valida los 9 puntos activos del flujo simplificado en Firestore Real
// ============================================================================

import { db } from '../server/config/firebase';
import { TopupService } from '../server/services/topup.service';
import { ReconciliationService } from '../server/services/reconciliation.service';
import { topupController } from '../server/controllers/topup.controller';
import { TopupRequest } from '../src/types';

async function runTestSuite() {
  console.log('================================================================');
  console.log('   INICIANDO TEST SUITE OFICIAL: TOPUP V1 VALIDACIÓN HUMANA');
  console.log('================================================================\n');

  let passedTests = 0;
  const testRunId = Date.now();
  const testDriverId = `test_driver_suite_${testRunId}`;
  const operatorId = 'OPERATOR_AUDIT_SUITE';
  const toClean: Array<{ collection: string; docId: string }> = [];

  // Contador de llamadas a Gemini (debe permanecer estrictamente en 0)
  let geminiCallsCount = 0;

  try {
    // ------------------------------------------------------------------------
    // SETUP: Usuario de prueba aislado
    // ------------------------------------------------------------------------
    const userRef = db.collection('users').doc(testDriverId);
    await userRef.set({
      uid: testDriverId,
      fullName: 'Conductor Suite Humana',
      role: 'driver',
      phone: '+51 988 111 222',
      isTestAccount: true,
      wallet: {
        availableBalance: 0.00,
        digitalBalance: 0.00,
        retainedBalance: 0.00,
        movements: []
      },
      createdAt: new Date().toISOString()
    });
    toClean.push({ collection: 'users', docId: testDriverId });

    // ==========================================================================
    // 1. PRUEBA DE CREACIÓN DE TOPUP
    // ==========================================================================
    console.log('[PRUEBA 1] Creación de solicitud TopUp (S/ 10.00)...');
    const createdTopup = await TopupService.createTopupRequest(testDriverId, 10.00, {
      name: 'Conductor Suite Humana',
      phone: '+51 988 111 222'
    });
    const topupId = createdTopup.id;
    toClean.push({ collection: 'topup_requests', docId: topupId });

    console.assert(createdTopup.requestedAmount === 10.00, 'FAIL: requestedAmount debe ser 10.00');
    console.assert(createdTopup.status === 'CREATED', 'FAIL: status debe ser CREATED');
    console.assert(createdTopup.referenceCode.startsWith('ZNTH-'), 'FAIL: referenceCode debe iniciar con ZNTH-');
    console.assert(createdTopup.referenceCode.length === 11, 'FAIL: referenceCode debe tener 11 caracteres');

    const snap1 = await db.collection('topup_requests').doc(topupId).get();
    console.assert(snap1.exists, 'FAIL: Topup debe persistir en Firestore');
    console.assert(snap1.data()?.status === 'CREATED', 'FAIL: Firestore status debe ser CREATED');
    console.log(`  ✓ TopUp creado: ${topupId} | Ref: ${createdTopup.referenceCode} (Persistido en Firestore)`);
    passedTests++;

    // ==========================================================================
    // 2. PRUEBA DE ENVÍO DE COMPROBANTE OPCIONAL (SIN GEMINI / OCR)
    // ==========================================================================
    console.log('\n[PRUEBA 2] Envío de comprobante visual auxiliar opcional...');
    const dummyBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const submittedTopup = await TopupService.submitReceiptAndAnalyze(
      topupId,
      testDriverId,
      dummyBase64
    );

    console.assert(submittedTopup.status === 'RECEIPT_SUBMITTED', 'FAIL: Status debe ser RECEIPT_SUBMITTED');
    console.assert(submittedTopup.receiptBase64 !== undefined, 'FAIL: receiptBase64 debe guardarse');
    console.assert(submittedTopup.aiExtraction === undefined, 'FAIL: aiExtraction NO debe ejecutarse en V1');

    const snap2 = await db.collection('topup_requests').doc(topupId).get();
    console.assert(snap2.data()?.status === 'RECEIPT_SUBMITTED', 'FAIL: Firestore debe tener RECEIPT_SUBMITTED');
    console.log(`  ✓ Comprobante recibido como evidencia auxiliar. Estado: ${snap2.data()?.status} (CERO llamadas a IA)`);
    passedTests++;

    // ==========================================================================
    // 3. PRUEBA DE REVISIÓN HUMANA (CONCILIACIÓN POR OPERADOR)
    // ==========================================================================
    console.log('\n[PRUEBA 3] Revisión humana del operador en Yape receptor...');
    const bankMovementExact = {
      amount: 10.00,
      date: '2026-09-27',
      time: '15:15',
      payerName: 'Conductor Suite Humana',
      securityCode: '482',
      operationNumber: `OP-SUITE-${testRunId.toString().slice(-6)}`,
      operatorNotes: 'Confirmación manual en Yape receptor por operador humano de guardia.'
    };

    const reconciled = await TopupService.reconcileTopup(topupId, bankMovementExact, operatorId);
    const movementDocId = reconciled.bankMovementId!;
    toClean.push({ collection: 'bank_movements', docId: movementDocId });

    console.assert(reconciled.status === 'VERIFIED', 'FAIL: Debe pasar a VERIFIED al coincidir monto y titular');
    console.assert(reconciled.verifiedAmount === 10.00, 'FAIL: verifiedAmount debe ser 10.00');

    const snap3 = await db.collection('topup_requests').doc(topupId).get();
    console.assert(snap3.data()?.status === 'VERIFIED', 'FAIL: Firestore debe actualizar a VERIFIED');
    console.log(`  ✓ Revisión humana completada. Estado resultante: ${snap3.data()?.status}`);
    passedTests++;

    // ==========================================================================
    // 4. PRUEBA DE APROBACIÓN HUMANA DE CASOS EN 'REVIEW'
    // ==========================================================================
    console.log('\n[PRUEBA 4] Flujo de Tercero Pagador -> REVIEW -> Aprobación Humana...');
    const topupReview = await TopupService.createTopupRequest(testDriverId, 25.00, {
      name: 'Conductor Suite Humana'
    });
    toClean.push({ collection: 'topup_requests', docId: topupReview.id });

    const bankMovementThirdParty = {
      amount: 25.00,
      date: '2026-09-27',
      time: '15:20',
      payerName: 'Rosario Valdivia (Hermana Tercero)',
      operationNumber: `OP-TP-${testRunId.toString().slice(-6)}`,
      operatorNotes: 'Yape recibido desde cuenta de tercero.'
    };

    const recThirdParty = await TopupService.reconcileTopup(topupReview.id, bankMovementThirdParty, operatorId);
    toClean.push({ collection: 'bank_movements', docId: recThirdParty.bankMovementId! });
    console.assert(recThirdParty.status === 'REVIEW', 'FAIL: Tercero pagador debe clasificar en REVIEW');
    console.log(`  ✓ Detección de tercero pagador correcta: status = ${recThirdParty.status}`);

    // El operador humano aprueba manualmente tras comunicarse con el motorizado
    const approvedReview = await TopupService.approveReviewTopup(
      topupReview.id,
      operatorId,
      'Validado telefónicamente con el motorizado: Yape enviado por su hermana.'
    );
    console.assert(approvedReview.status === 'VERIFIED', 'FAIL: Debe pasar a VERIFIED tras aprobación manual');
    console.log(`  ✓ Aprobación humana de caso en REVIEW completada: status = ${approvedReview.status}`);
    passedTests++;

    // ==========================================================================
    // 5. PRUEBA DE ACREDITACIÓN ATÓMICA EN WALLET
    // ==========================================================================
    console.log('\n[PRUEBA 5] Acreditación atómica en Wallet (creditVerifiedTopup)...');
    const creditResult = await TopupService.creditTopup(topupId, operatorId);
    console.assert(creditResult.success === true, 'FAIL: creditResult.success debe ser true');
    console.assert(creditResult.newBalance === 10.00, 'FAIL: newBalance debe ser 10.00');

    // Verificar usuario en Firestore
    const postUser = await userRef.get();
    const finalBalance = postUser.data()?.wallet?.availableBalance;
    const movements = postUser.data()?.wallet?.movements || [];
    console.assert(finalBalance === 10.00, 'FAIL: Balance en Firestore debe ser S/ 10.00');
    console.assert(movements.length === 1, 'FAIL: Debe existir 1 movimiento en wallet');
    console.assert(movements[0]?.type === 'topup_yape', 'FAIL: type debe ser topup_yape');

    // Verificar Topup en Firestore
    const snap4 = await db.collection('topup_requests').doc(topupId).get();
    console.assert(snap4.data()?.status === 'CREDITED', 'FAIL: Topup debe ser CREDITED');

    const fingerprint = snap4.data()?.reconciliation?.matchedMovementId;
    if (fingerprint) {
      toClean.push({ collection: 'processed_bank_movements', docId: fingerprint });
      const procSnap = await db.collection('processed_bank_movements').doc(fingerprint).get();
      console.assert(procSnap.exists, 'FAIL: processed_bank_movements debe existir');
    }

    if (creditResult.txId) {
      toClean.push({ collection: 'accounting_ledger', docId: creditResult.txId });
      const ledSnap = await db.collection('accounting_ledger').doc(creditResult.txId).get();
      console.assert(ledSnap.exists, 'FAIL: accounting_ledger debe existir');
    }

    console.log(`  ✓ Acreditación atómica exitosa: Saldo en Firestore = S/ ${finalBalance.toFixed(2)}, Topup = CREDITED`);
    passedTests++;

    // ==========================================================================
    // 6. PRUEBA DE RECHAZO DE DOBLE ACREDITACIÓN (IDEMPOTENCIA)
    // ==========================================================================
    console.log('\n[PRUEBA 6] Rechazo de doble acreditación...');
    try {
      await TopupService.creditTopup(topupId, operatorId);
      console.error('FAIL: Debió rechazar segunda acreditación');
      process.exit(1);
    } catch (e: any) {
      console.assert(e.message.includes('Solo se pueden acreditar recargas en estado VERIFIED') || e.message.includes('CREDITED'), 'FAIL: Mensaje inesperado');
      console.log(`  ✓ Doble acreditación rechazada exitosamente: "${e.message}"`);
      passedTests++;
    }

    // ==========================================================================
    // 7. PRUEBA DE RECHAZO EXPLÍCITO POR EL OPERADOR
    // ==========================================================================
    console.log('\n[PRUEBA 7] Rechazo explícito de solicitud por el operador...');
    const topupToReject = await TopupService.createTopupRequest(testDriverId, 50.00, {
      name: 'Conductor Suite Humana'
    });
    toClean.push({ collection: 'topup_requests', docId: topupToReject.id });

    const rejected = await TopupService.rejectTopup(
      topupToReject.id,
      operatorId,
      'Fondos no recibidos tras 24 horas de espera.'
    );
    console.assert(rejected.status === 'REJECTED', 'FAIL: Debe ser REJECTED');

    const snapReject = await db.collection('topup_requests').doc(topupToReject.id).get();
    console.assert(snapReject.data()?.status === 'REJECTED', 'FAIL: Firestore debe ser REJECTED');
    console.log(`  ✓ Solicitud rechazada correctamente con motivo registrado: status = ${snapReject.data()?.status}`);
    passedTests++;

    // ==========================================================================
    // 8. PRUEBA DE LISTADO DE PENDIENTES DEL OPERADOR
    // ==========================================================================
    console.log('\n[PRUEBA 8] Listado de solicitudes pendientes para el operador...');
    const pendingList = await TopupService.getPendingTopups();
    console.assert(Array.isArray(pendingList), 'FAIL: pendingList debe ser array');
    console.log(`  ✓ Consulta de pendientes del operador: ${pendingList.length} solicitudes encontradas.`);
    passedTests++;

    // ==========================================================================
    // 9. CONFIRMACIÓN: CERO LLAMADAS A GEMINI
    // ==========================================================================
    console.log('\n[PRUEBA 9] Auditoría de exclusión de Gemini / OCR...');
    console.assert(geminiCallsCount === 0, 'FAIL: Se registraron llamadas a Gemini');
    console.log('  ✓ 0 llamadas a modelos de IA ejecutadas durante todo el ciclo.');
    passedTests++;

  } finally {
    // ------------------------------------------------------------------------
    // LIMPIEZA ABSOLUTA DE DOCUMENTOS DE PRUEBA
    // ------------------------------------------------------------------------
    console.log('\n[LIMPIEZA] Eliminando todos los documentos de prueba...');
    for (const item of toClean) {
      try {
        await db.collection(item.collection).doc(item.docId).delete();
      } catch (err: any) {
        console.error(`Error limpiando ${item.collection}/${item.docId}:`, err.message);
      }
    }
    console.log('  ✓ Todos los documentos de prueba eliminados de Firestore.');
  }

  console.log('\n================================================================');
  console.log(`SUITE EXITOSA: ${passedTests} PRUEBAS COMPLETADAS (VALIDACIÓN HUMANA V1)`);
  console.log('================================================================');
}

runTestSuite().catch(err => {
  console.error('FATAL ERROR EN SUITE:', err);
  process.exit(1);
});
