// ============================================================================
// ZÉNITH
// Module : Financial / Reconciliation Service (Three-Way Match)
// Layer  : Domain / Services
// File   : reconciliation.service.ts
// ============================================================================

import { db } from '../config/firebase';
import { TopupRequest, BankMovement, ReconciliationResult } from '../../src/types';

export interface BankMovementInput {
  amount: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  payerName: string;
  securityCode?: string;
  operationNumber?: string;
  operatorNotes?: string;
}

export const ReconciliationService = {
  /**
   * Conciliación de Tres Vías (Three-Way Match) según reglas congeladas de ZÉNITH:
   * A. Solicitud de ZÉNITH (TopupRequest)
   * B. Datos extraídos de la captura por IA (YapeReceiptExtraction)
   * C. Movimiento real confirmado manualmente por el operador en el Yape receptor (BankMovementInput)
   */
  evaluateReconciliation: async (
    topup: TopupRequest,
    bankMovement: BankMovementInput | null,
    operatorId: string
  ): Promise<ReconciliationResult> => {
    const discrepancies: string[] = [];
    const notes: string[] = [];

    // REGLA 1: Movimiento real no confirmado por el operador -> REJECTED
    if (!bankMovement) {
      return {
        status: 'REJECTED',
        reconciledAt: new Date().toISOString(),
        reconciledBy: 'OPERATOR_MANUAL',
        reconciledOperatorId: operatorId,
        discrepancies: ['No existe confirmación de movimiento real en el Yape receptor de Zénith.'],
        notes: 'Rechazado automáticamente por ausencia de fondos en cuenta receptora.',
        verifiedAmount: 0
      };
    }

    // REGLA 2: Movimiento real ya utilizado previamente -> REJECTED
    const movementFingerprint = bankMovement.securityCode && bankMovement.operationNumber
      ? `MOV-${bankMovement.operationNumber}-${bankMovement.securityCode}`
      : `MOV-${bankMovement.date}-${bankMovement.time}-${bankMovement.amount}-${bankMovement.payerName.replace(/\s+/g, '_')}`;

    if (!db) {
      throw new Error('FIRESTORE_UNAVAILABLE: Base de datos no disponible.');
    }

    const processedSnap = await db.collection('processed_bank_movements').doc(movementFingerprint).get();
    if (processedSnap.exists) {
      return {
        status: 'REJECTED',
        reconciledAt: new Date().toISOString(),
        reconciledBy: 'OPERATOR_MANUAL',
        reconciledOperatorId: operatorId,
        discrepancies: [`El movimiento bancario (${movementFingerprint}) ya fue utilizado en una recarga previa.`],
        notes: 'Intento de duplicidad o reuso de comprobante detectado.',
        verifiedAmount: 0,
        matchedMovementId: movementFingerprint
      };
    }

    // REGLA 3: Comparar montos
    const requested = Number(topup.requestedAmount.toFixed(2));
    const realReceived = Number(bankMovement.amount.toFixed(2));

    if (realReceived <= 0) {
      return {
        status: 'REJECTED',
        reconciledAt: new Date().toISOString(),
        reconciledBy: 'OPERATOR_MANUAL',
        reconciledOperatorId: operatorId,
        discrepancies: ['El monto recibido en banco es menor o igual a 0.'],
        verifiedAmount: 0
      };
    }

    // Si el monto del banco no coincide con el solicitado
    if (requested !== realReceived) {
      discrepancies.push(`Monto solicitado (S/ ${requested.toFixed(2)}) difiere del monto real recibido (S/ ${realReceived.toFixed(2)}).`);
    }

    // REGLA 4: Comparar datos de captura si existe extracción de IA
    const ai = topup.aiExtraction;
    if (ai) {
      if (ai.amount !== null && Number(ai.amount.toFixed(2)) !== realReceived) {
        discrepancies.push(`Monto extraído en captura (S/ ${ai.amount.toFixed(2)}) no coincide con el monto real en cuenta (S/ ${realReceived.toFixed(2)}).`);
      }

      if (ai.securityCode && bankMovement.securityCode && ai.securityCode !== bankMovement.securityCode) {
        discrepancies.push(`Código de seguridad de captura (${ai.securityCode}) no coincide con el movimiento real (${bankMovement.securityCode}).`);
      }

      if (ai.operationNumber && bankMovement.operationNumber && ai.operationNumber !== bankMovement.operationNumber) {
        discrepancies.push(`Número de operación de captura (${ai.operationNumber}) no coincide con el movimiento real (${bankMovement.operationNumber}).`);
      }

      if (ai.confidence < 0.5) {
        notes.push('La captura presenta baja nitidez visual o datos parcialmente legibles.');
      }
    } else {
      notes.push('No se adjuntó captura de pantalla preliminar; validado contra confirmación física del operador.');
    }

    // REGLA 5: Nombre del pagador vs Conductor (Regla de Terceros: REVIEW, nunca REJECTED)
    const normalize = (str: string) => str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const cleanDriverName = normalize(topup.driverName || '');
    const cleanPayerName = normalize(bankMovement.payerName || '');

    const namesMatch = cleanDriverName && cleanPayerName && (
      cleanDriverName.includes(cleanPayerName) ||
      cleanPayerName.includes(cleanDriverName) ||
      cleanDriverName.split(' ')[0] === cleanPayerName.split(' ')[0]
    );

    if (!namesMatch && cleanPayerName.length > 0) {
      notes.push(`Pagador en Yape ("${bankMovement.payerName}") difiere del titular de la cuenta ZÉNITH ("${topup.driverName}"). Posible recarga por tercero.`);
    }

    // EVALUACIÓN DE DECISIÓN FINAL
    // 1. REJECTED: Si hay contradicción crítica en montos o códigos de seguridad
    const hasCriticalAmountError = requested !== realReceived && Math.abs(requested - realReceived) > 50;
    const hasCriticalCodeMismatch = discrepancies.some(d => d.includes('Código de seguridad'));

    if (hasCriticalAmountError || hasCriticalCodeMismatch) {
      return {
        status: 'REJECTED',
        reconciledAt: new Date().toISOString(),
        reconciledBy: 'OPERATOR_MANUAL',
        reconciledOperatorId: operatorId,
        discrepancies,
        notes: notes.join(' | ') || 'Discrepancias críticas entre la solicitud y los fondos reales.',
        verifiedAmount: 0,
        matchedMovementId: movementFingerprint
      };
    }

    // 2. REVIEW: Diferencias moderadas de monto, pagador tercero, o datos incompletos
    if (discrepancies.length > 0 || !namesMatch || (ai && ai.confidence < 0.6)) {
      return {
        status: 'REVIEW',
        reconciledAt: new Date().toISOString(),
        reconciledBy: 'OPERATOR_MANUAL',
        reconciledOperatorId: operatorId,
        discrepancies,
        notes: notes.join(' | ') || 'Requiere autorización manual del operador debido a discrepancias.',
        verifiedAmount: realReceived,
        matchedMovementId: movementFingerprint
      };
    }

    // 3. VERIFIED: Todo coincide exactamente sin contradicciones
    return {
      status: 'VERIFIED',
      reconciledAt: new Date().toISOString(),
      reconciledBy: 'OPERATOR_MANUAL',
      reconciledOperatorId: operatorId,
      discrepancies: [],
      notes: notes.join(' | ') || 'Conciliación exacta de tres vías confirmada.',
      verifiedAmount: realReceived,
      matchedMovementId: movementFingerprint
    };
  }
};
