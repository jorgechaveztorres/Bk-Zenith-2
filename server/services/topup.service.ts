// ============================================================================
// ZÉNITH
// Module : Financial / Topup Service (Pilot V1 - Yape Personal con Validación Humana)
// Layer  : Domain / Services
// File   : topup.service.ts
// ============================================================================

import { db } from '../config/firebase';
import { FieldValue } from 'firebase-admin/firestore';
import { TopupRequest, TopupAuditEntry } from '../../src/types';
import { ReconciliationService, BankMovementInput } from './reconciliation.service';
import { WalletService } from './wallet.service';

export const TopupService = {
  /**
   * Genera un código de referencia no predecible de 6 caracteres alfanuméricos.
   * Ejemplo: ZNTH-482910 o ZNTH-K7P9X2
   */
  generateReferenceCode: (): string => {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Sin 0, 1, O, I para evitar confusión visual
    let randomPart = '';
    for (let i = 0; i < 6; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `ZNTH-${randomPart}`;
  },

  /**
   * 1. MOTORIZADO SOLICITA RECARGA
   * Valida monto, genera ID único, código de referencia y auditoría inicial.
   * REGLA FAIL-CLOSED: La persistencia en Firestore es OBLIGATORIA. Si falla, la operación aborta.
   */
  createTopupRequest: async (
    driverId: string,
    requestedAmount: number,
    driverMeta: { name?: string; phone?: string }
  ): Promise<TopupRequest> => {
    if (typeof requestedAmount !== 'number' || !Number.isFinite(requestedAmount) || requestedAmount <= 0 || Math.round(requestedAmount * 100) <= 0) {
      throw new Error('MONTO_INVALIDO: El monto de recarga debe ser un número positivo mayor a S/ 0.00.');
    }

    if (!driverId) {
      throw new Error('AUTH_ERROR: Identificador de conductor requerido.');
    }

    if (!db) {
      throw new Error('FIRESTORE_UNAVAILABLE: La base de datos central no está disponible.');
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const topupId = `TOPUP-${dateStr}-${randomSuffix}`;
    const referenceCode = TopupService.generateReferenceCode();

    // Expiración por defecto: 24 horas
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const initialAudit: TopupAuditEntry = {
      fromStatus: 'NONE',
      toStatus: 'CREATED',
      timestamp: now.toISOString(),
      actorId: driverId,
      actorRole: 'driver',
      reason: `Solicitud de recarga creada por S/ ${requestedAmount.toFixed(2)}`,
      metadata: { requestedAmount, referenceCode }
    };

    const newTopup: TopupRequest = {
      id: topupId,
      referenceCode,
      driverId,
      driverName: driverMeta.name || 'Conductor ZÉNITH',
      driverPhone: driverMeta.phone || '',
      requestedAmount: Math.round(requestedAmount * 100) / 100,
      status: 'CREATED',
      auditHistory: [initialAudit],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt
    };

    // Escritura estricta en Firestore. Sin silenciar errores.
    await db.collection('topup_requests').doc(topupId).set({
      ...newTopup,
      createdAtServer: FieldValue.serverTimestamp(),
      updatedAtServer: FieldValue.serverTimestamp()
    });

    return newTopup;
  },

  /**
   * Obtener una solicitud de recarga por ID directamente de Firestore.
   */
  getTopupById: async (topupId: string): Promise<TopupRequest | null> => {
    if (!db) throw new Error('FIRESTORE_UNAVAILABLE: Base de datos no disponible.');
    const snap = await db.collection('topup_requests').doc(topupId).get();
    if (!snap.exists) return null;
    return snap.data() as TopupRequest;
  },

  /**
   * Obtener el historial de solicitudes de un motorizado directamente de Firestore.
   */
  getDriverTopupHistory: async (driverId: string): Promise<TopupRequest[]> => {
    if (!db) throw new Error('FIRESTORE_UNAVAILABLE: Base de datos no disponible.');
    const snap = await db.collection('topup_requests')
      .where('driverId', '==', driverId)
      .limit(25)
      .get();

    const list: TopupRequest[] = [];
    snap.forEach(doc => list.push(doc.data() as TopupRequest));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  /**
   * Obtener todas las solicitudes pendientes para la consola del operador humano.
   */
  getPendingTopups: async (): Promise<TopupRequest[]> => {
    if (!db) throw new Error('FIRESTORE_UNAVAILABLE: Base de datos no disponible.');
    const snap = await db.collection('topup_requests')
      .where('status', 'in', ['CREATED', 'RECEIPT_SUBMITTED', 'REVIEW', 'VERIFIED'])
      .limit(50)
      .get();

    const list: TopupRequest[] = [];
    snap.forEach(doc => list.push(doc.data() as TopupRequest));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  /**
   * 3. INGESTA DE COMPROBANTE VISUAL (EVIDENCIA AUXILIAR OPCIONAL)
   * REGLA V1: No se invoca Gemini ni OCR. La captura sirve exclusivamente como evidencia
   * complementaria para la inspección visual del operador humano.
   */
  submitReceiptAndAnalyze: async (
    topupId: string,
    driverId: string,
    receiptBase64: string,
    receiptUrl?: string
  ): Promise<TopupRequest> => {
    if (!db) throw new Error('FIRESTORE_UNAVAILABLE: Base de datos no disponible.');

    const topupRef = db.collection('topup_requests').doc(topupId);
    const snap = await topupRef.get();
    if (!snap.exists) throw new Error('RECARGA_NO_ENCONTRADA: Recarga no encontrada en Firestore.');

    const topup = snap.data() as TopupRequest;

    if (topup.driverId !== driverId) {
      throw new Error('ACCESO_DENEGADO: No tiene autorización sobre esta recarga.');
    }

    if (topup.status === 'CREDITED' || topup.status === 'REJECTED') {
      throw new Error(`ESTADO_TERMINAL: La recarga se encuentra en estado terminal (${topup.status}).`);
    }

    if (new Date(topup.expiresAt) < new Date()) {
      throw new Error('SOLICITUD_EXPIRADA: Esta solicitud de recarga ha superado el tiempo límite.');
    }

    // Marcar como RECEIPT_SUBMITTED en Firestore
    const nowIso = new Date().toISOString();
    const submitAudit: TopupAuditEntry = {
      fromStatus: topup.status,
      toStatus: 'RECEIPT_SUBMITTED',
      timestamp: nowIso,
      actorId: driverId,
      actorRole: 'driver',
      reason: 'Comprobante visual adjuntado como evidencia auxiliar para revisión humana del operador.'
    };

    if (typeof receiptBase64 !== 'string' || receiptBase64.length === 0 || receiptBase64.length > 500000) {
      throw new Error('COMPROBANTE_INVALIDO: La evidencia debe ser texto válido y no superar 500000 caracteres.');
    }
    if (receiptUrl && (!/^https:\/\//i.test(receiptUrl) || receiptUrl.length > 2048)) {
      throw new Error('URL_COMPROBANTE_INVALIDA: La URL debe usar HTTPS y no superar 2048 caracteres.');
    }

    const cleanBase64 = receiptBase64;
    await topupRef.update({
      receiptBase64: cleanBase64,
      receiptUrl: receiptUrl || null,
      status: 'RECEIPT_SUBMITTED',
      updatedAt: nowIso,
      auditHistory: FieldValue.arrayUnion(submitAudit)
    });

    const updatedSnap = await topupRef.get();
    return updatedSnap.data() as TopupRequest;
  },

  /**
   * 4 & 5. CONCILIACIÓN CON MOVIMIENTO REAL CONFIRMADO POR EL OPERADOR
   * El operador humano ingresa los datos del dinero recibido en el Yape receptor.
   */
  reconcileTopup: async (
    topupId: string,
    bankMovement: BankMovementInput | null,
    operatorId: string
  ): Promise<TopupRequest> => {
    if (!db) throw new Error('FIRESTORE_UNAVAILABLE: Base de datos no disponible.');
    if (!operatorId || typeof operatorId !== 'string') {
      throw new Error('OPERADOR_INVALIDO: Se requiere identificar al operador.');
    }

    if (bankMovement) {
      if (
        typeof bankMovement.amount !== 'number' ||
        !Number.isFinite(bankMovement.amount) ||
        bankMovement.amount <= 0 ||
        Math.round(bankMovement.amount * 100) <= 0
      ) {
        throw new Error('MONTO_MOVIMIENTO_INVALIDO: El monto recibido debe ser un número positivo válido.');
      }
      if (
        typeof bankMovement.date !== 'string' ||
        typeof bankMovement.time !== 'string' ||
        typeof bankMovement.payerName !== 'string' ||
        !bankMovement.payerName.trim()
      ) {
        throw new Error('MOVIMIENTO_INVALIDO: Fecha, hora y nombre del pagador son obligatorios.');
      }
    }

    const topupRef = db.collection('topup_requests').doc(topupId);
    const initialSnap = await topupRef.get();
    if (!initialSnap.exists) throw new Error('RECARGA_NO_ENCONTRADA: Recarga no encontrada en Firestore.');

    const initialTopup = initialSnap.data() as TopupRequest;
    if (initialTopup.status === 'CREDITED') {
      throw new Error('IDEMPOTENCIA: Esta solicitud ya fue acreditada.');
    }
    if (initialTopup.status === 'REJECTED') {
      throw new Error('ESTADO_TERMINAL: Una solicitud REJECTED no puede volver a conciliarse.');
    }
    if (initialTopup.status === 'VERIFIED') {
      throw new Error('ESTADO_INMUTABLE: Una conciliación VERIFIED no puede ser reemplazada; debe pasar por acreditación o rechazo explícito.');
    }
    if (new Date(initialTopup.expiresAt).getTime() < Date.now()) {
      throw new Error('SOLICITUD_EXPIRADA: La solicitud ha expirado.');
    }

    const movementDocId: string | null = bankMovement
      ? (bankMovement.securityCode && bankMovement.operationNumber
          ? `MOV-${bankMovement.operationNumber}-${bankMovement.securityCode}`
          : `MOV-${bankMovement.date}-${bankMovement.time}-${bankMovement.amount}-${bankMovement.payerName.replace(/\s+/g, '_')}`)
      : null;

    // Evaluación fuera de la transacción; el estado final y la reserva del movimiento
    // se confirman juntos dentro de una única transacción serializable.
    let reconciliation = await ReconciliationService.evaluateReconciliation(
      initialTopup,
      bankMovement,
      operatorId
    );

    const nowIso = new Date().toISOString();
    const movementRef = movementDocId
      ? db.collection('bank_movements').doc(movementDocId)
      : null;
    const processedMovementRef = movementDocId
      ? db.collection('processed_bank_movements').doc(movementDocId)
      : null;

    await db.runTransaction(async (transaction) => {
      // Todas las lecturas ocurren antes de cualquier escritura.
      const currentSnap = await transaction.get(topupRef);
      if (!currentSnap.exists) throw new Error('RECARGA_NO_ENCONTRADA: Recarga no encontrada en Firestore.');
      const currentTopup = currentSnap.data() as TopupRequest;

      let movementSnap = null;
      let processedSnap = null;
      if (movementRef && processedMovementRef) {
        movementSnap = await transaction.get(movementRef);
        processedSnap = await transaction.get(processedMovementRef);
      }

      if (currentTopup.status === 'CREDITED') {
        throw new Error('IDEMPOTENCIA: Esta solicitud ya fue acreditada.');
      }
      if (currentTopup.status === 'REJECTED') {
        throw new Error('ESTADO_TERMINAL: Una solicitud REJECTED no puede volver a conciliarse.');
      }
      if (currentTopup.status === 'VERIFIED') {
        throw new Error('ESTADO_INMUTABLE: Una conciliación VERIFIED no puede ser reemplazada; debe pasar por acreditación o rechazo explícito.');
      }
      if (new Date(currentTopup.expiresAt).getTime() < Date.now()) {
        throw new Error('SOLICITUD_EXPIRADA: La solicitud ha expirado.');
      }

      // No aceptar un resultado calculado sobre una versión anterior de la solicitud.
      if (
        currentTopup.driverId !== initialTopup.driverId ||
        currentTopup.requestedAmount !== initialTopup.requestedAmount ||
        currentTopup.referenceCode !== initialTopup.referenceCode
      ) {
        throw new Error('RECARGA_MODIFICADA: La solicitud cambió durante la conciliación; vuelva a cargarla e intente otra vez.');
      }

      const movementAlreadyProcessed = Boolean(processedSnap?.exists);
      if (movementAlreadyProcessed && movementDocId) {
        reconciliation = {
          ...reconciliation,
          status: 'REJECTED',
          reconciledAt: nowIso,
          reconciledBy: 'OPERATOR_MANUAL',
          reconciledOperatorId: operatorId,
          discrepancies: [
            ...(reconciliation.discrepancies || []),
            `El movimiento bancario (${movementDocId}) ya fue utilizado en una recarga previa.`
          ],
          notes: 'Intento de duplicidad o reuso de movimiento detectado en la comprobación transaccional.',
          verifiedAmount: 0,
          matchedMovementId: movementDocId
        };
      }

      if (movementSnap?.exists && !movementAlreadyProcessed) {
        const existingTopupId = movementSnap.data()?.matchedTopupId;
        if (existingTopupId && existingTopupId !== topupId) {
          throw new Error(
            `MOVIMIENTO_YA_ASIGNADO: El movimiento bancario ${movementDocId} ya está vinculado a la recarga ${existingTopupId}.`
          );
        }
      }

      const reconciliationAudit: TopupAuditEntry = {
        fromStatus: currentTopup.status,
        toStatus: reconciliation.status,
        timestamp: nowIso,
        actorId: operatorId,
        actorRole: 'operator',
        reason: `Conciliación del operador: estado resultante ${reconciliation.status}. ${reconciliation.notes || ''}`,
        metadata: {
          discrepancies: reconciliation.discrepancies,
          verifiedAmount: reconciliation.verifiedAmount,
          movementDocId,
          duplicateMovement: movementAlreadyProcessed
        }
      };

      // Solo reservar el movimiento si aún no está contabilizado como procesado.
      if (movementRef && bankMovement && movementDocId && !movementAlreadyProcessed) {
        transaction.set(movementRef, {
          ...bankMovement,
          id: movementDocId,
          source: 'YAPE_PERSONAL_MANUAL',
          operatorId,
          matchedTopupId: topupId,
          confirmedAt: nowIso,
          createdAtServer: FieldValue.serverTimestamp()
        }, { merge: true });
      }

      transaction.update(topupRef, {
        reconciliation,
        verifiedAmount: reconciliation.verifiedAmount,
        bankMovementId: movementAlreadyProcessed ? null : movementDocId,
        status: reconciliation.status,
        updatedAt: nowIso,
        auditHistory: FieldValue.arrayUnion(reconciliationAudit)
      });
    });

    const updatedSnap = await topupRef.get();
    return updatedSnap.data() as TopupRequest;
  },

  /**
   * APROBACIÓN MANUAL DE CASOS EN 'REVIEW'
   * Autorización formal por parte del operador humano tras verificar con el chofer o el banco.
   */
  approveReviewTopup: async (
    topupId: string,
    operatorId: string,
    operatorNotes: string
  ): Promise<TopupRequest> => {
    if (!db) throw new Error('FIRESTORE_UNAVAILABLE: Base de datos no disponible.');

    const topupRef = db.collection('topup_requests').doc(topupId);
    const nowIso = new Date().toISOString();

    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(topupRef);
      if (!snap.exists) throw new Error('RECARGA_NO_ENCONTRADA: Recarga no encontrada en Firestore.');

      const topup = snap.data() as TopupRequest;
      if (topup.status !== 'REVIEW') {
        throw new Error(`ESTADO_INVALIDO: Solo se pueden aprobar solicitudes en estado REVIEW. Estado actual: ${topup.status}`);
      }

      if (
        topup.reconciliation?.status !== 'REVIEW' ||
        !topup.reconciliation.matchedMovementId ||
        topup.bankMovementId !== topup.reconciliation.matchedMovementId
      ) {
        throw new Error('CONCILIACION_NO_VERIFICABLE: El caso REVIEW no tiene una conciliación trazable a un movimiento confirmado.');
      }

      const movementRef = db!.collection('bank_movements').doc(topup.reconciliation.matchedMovementId);
      const movementSnap = await transaction.get(movementRef);
      if (!movementSnap.exists || movementSnap.data()?.matchedTopupId !== topupId) {
        throw new Error('MOVIMIENTO_NO_VERIFICADO: No existe un movimiento bancario confirmado y vinculado a esta recarga.');
      }

      const approvedAudit: TopupAuditEntry = {
        fromStatus: 'REVIEW',
        toStatus: 'VERIFIED',
        timestamp: nowIso,
        actorId: operatorId,
        actorRole: 'operator',
        reason: `Aprobación manual autorizada tras revisión: ${operatorNotes}`,
        metadata: { operatorNotes }
      };

      transaction.update(topupRef, {
        status: 'VERIFIED',
        updatedAt: nowIso,
        'reconciliation.status': 'VERIFIED',
        'reconciliation.notes': `Aprobado manualmente por operador ${operatorId}: ${operatorNotes}`,
        auditHistory: FieldValue.arrayUnion(approvedAudit)
      });
    });

    const updatedSnap = await topupRef.get();
    return updatedSnap.data() as TopupRequest;
  },

  /**
   * RECHAZO EXPLÍCITO POR EL OPERADOR.
   * La transición se ejecuta en transacción para evitar carreras con la acreditación.
   */
  rejectTopup: async (
    topupId: string,
    operatorId: string,
    reason: string
  ): Promise<TopupRequest> => {
    if (!db) throw new Error('FIRESTORE_UNAVAILABLE: Base de datos no disponible.');

    const topupRef = db.collection('topup_requests').doc(topupId);
    const nowIso = new Date().toISOString();

    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(topupRef);
      if (!snap.exists) throw new Error('RECARGA_NO_ENCONTRADA: Recarga no encontrada en Firestore.');

      const topup = snap.data() as TopupRequest;
      if (topup.status === 'CREDITED') {
        throw new Error('IDEMPOTENCIA: No se puede rechazar una recarga ya acreditada.');
      }
      if (topup.status === 'VERIFIED') {
        throw new Error('ESTADO_INMUTABLE: Una recarga VERIFIED debe acreditarse o resolverse mediante un procedimiento financiero auditado; no puede rechazarse directamente.');
      }
      if (topup.status === 'REJECTED') {
        throw new Error('ESTADO_TERMINAL: La solicitud ya está rechazada.');
      }

      const rejectAudit: TopupAuditEntry = {
        fromStatus: topup.status,
        toStatus: 'REJECTED',
        timestamp: nowIso,
        actorId: operatorId,
        actorRole: 'operator',
        reason: `Rechazado por operador: ${reason}`
      };

      transaction.update(topupRef, {
        status: 'REJECTED',
        updatedAt: nowIso,
        'reconciliation.status': 'REJECTED',
        'reconciliation.notes': reason,
        auditHistory: FieldValue.arrayUnion(rejectAudit)
      });
    });

    const updatedSnap = await topupRef.get();
    return updatedSnap.data() as TopupRequest;
  },

  /**
   * ACREDITACIÓN ATÓMICA FINAL
   * Delega exclusivamente a WalletService.creditVerifiedTopup (Firestore runTransaction).
   */
  creditTopup: async (topupId: string, operatorId: string) => {
    return await WalletService.creditVerifiedTopup(topupId, operatorId);
  }
};
