// ============================================================================
// ZÉNITH
// Module : Financial / Wallet Service V2
// Layer  : Domain / Services
// File   : WalletService.ts
// ============================================================================

import { db } from '../config/firebase';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { TopupRequest, Wallet, WalletMovement } from '../../src/types'; 

export const WalletService = {
  // Initialize wallet V2 for any user (passenger or driver)
  getOrCreateWallet: async (userId: string) => {
    if (!db) throw new Error("Base de datos no disponible.");
    const userDocRef = db.collection('users').doc(userId);
    const snap = await userDocRef.get();
    
    if (snap.exists) {
      const data = snap.data();
      if (data?.wallet) {
        const loadedWallet = data.wallet;
        return {
          availableBalance: loadedWallet.availableBalance !== undefined ? loadedWallet.availableBalance : 0.00,
          retainedBalance: loadedWallet.retainedBalance !== undefined ? loadedWallet.retainedBalance : 0.00,
          dailyEarnings: loadedWallet.dailyEarnings !== undefined ? loadedWallet.dailyEarnings : 0.00,
          weeklyEarnings: loadedWallet.weeklyEarnings !== undefined ? loadedWallet.weeklyEarnings : 0.00,
          digitalBalance: loadedWallet.digitalBalance !== undefined ? loadedWallet.digitalBalance : 0.00,
          cashDebt: loadedWallet.cashDebt !== undefined ? loadedWallet.cashDebt : 0.00,
          movements: loadedWallet.movements || [],
          
          // Wallet V2 extensions
          pendingBalance: loadedWallet.pendingBalance !== undefined ? loadedWallet.pendingBalance : 0.00,
          promotionalBalance: loadedWallet.promotionalBalance !== undefined ? loadedWallet.promotionalBalance : 25.00,
          compensationBalance: loadedWallet.compensationBalance !== undefined ? loadedWallet.compensationBalance : 0.00,
          accumulatedCommission: loadedWallet.accumulatedCommission !== undefined ? loadedWallet.accumulatedCommission : 0.00,
          monthlyEarnings: loadedWallet.monthlyEarnings !== undefined ? loadedWallet.monthlyEarnings : 0.00,
          dailyBalanceHist: loadedWallet.dailyBalanceHist || {
            Lunes: 120, Martes: 155, Miercoles: 190, Jueves: 240, Viernes: 320, Sabado: 410, Domingo: 480
          },
          weeklyBalanceHist: loadedWallet.weeklyBalanceHist || {
            'Semana 1': 480, 'Semana 2': 610, 'Semana 3': 850, 'Semana 4': 1100
          },
          monthlyBalanceHist: loadedWallet.monthlyBalanceHist || {
            Enero: 1100, Febrero: 1450, Marzo: 1980, Abril: 2450, Mayo: 3100, Junio: 4200
          }
        };
      }
    }
    
    const defaultWallet = {
      availableBalance: 0.00,
      retainedBalance: 0.00,
      dailyEarnings: 0.00,
      weeklyEarnings: 0.00,
      pendingSettlement: 0.00,
      digitalBalance: 0.00,
      cashDebt: 0.00,
      todaySettlements: 0,
      nextSettlementDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      pendingBalance: 0.00,
      promotionalBalance: 0.00,
      compensationBalance: 0.00,
      accumulatedCommission: 0.00,
      monthlyEarnings: 0.00,
      dailyBalanceHist: {},
      weeklyBalanceHist: {},
      monthlyBalanceHist: {},
      movements: []
    };

    await userDocRef.update({
      wallet: defaultWallet
    });
    
    return defaultWallet;
  },

  // Acreditación Atómica de Recarga Verificada (V1 - Yape Personal)
  creditVerifiedTopup: async (topupId: string, operatorId: string) => {
    if (!db) throw new Error("Base de datos no disponible.");

    return await db.runTransaction(async (transaction) => {
      // 1. Leer topup
      const topupRef = db.collection('topup_requests').doc(topupId);
      const topupSnap = await transaction.get(topupRef);
      if (!topupSnap.exists) {
        throw new Error(`RECARGA_NO_ENCONTRADA: La solicitud ${topupId} no existe.`);
      }

      const topupData = topupSnap.data() as TopupRequest;

      // 2. Confirmar status === VERIFIED
      if (topupData.status !== 'VERIFIED') {
        throw new Error(`ESTADO_INVALIDO: Solo se pueden acreditar recargas en estado VERIFIED. Estado actual: ${topupData.status}`);
      }

      // 3. La acreditación solo procede desde una conciliación VERIFIED con movimiento trazable.
      if (topupData.status !== 'VERIFIED' || topupData.reconciliation?.status !== 'VERIFIED' || !topupData.reconciliation.matchedMovementId) {
        throw new Error('CONCILIACION_NO_VERIFICADA: La recarga no tiene una conciliación VERIFIED y trazable.');
      }

      if (topupData.creditedAt) {
        throw new Error(`IDEMPOTENCIA: La recarga ${topupId} ya fue acreditada previamente.`);
      }

      // Validar monto a acreditar
      const verifiedAmount = Number((topupData.verifiedAmount ?? topupData.requestedAmount).toFixed(2));
      if (verifiedAmount <= 0) {
        throw new Error(`MONTO_INVALIDO: El monto a acreditar debe ser mayor a 0.`);
      }

      // 4. Confirmar que el movimiento no haya sido utilizado anteriormente
      const movementFingerprint = topupData.reconciliation.matchedMovementId;
      const processedRef = db.collection('processed_bank_movements').doc(movementFingerprint);
      const processedSnap = await transaction.get(processedRef);
      if (processedSnap.exists) {
        throw new Error(`MOVIMIENTO_REUTILIZADO: El movimiento bancario ${movementFingerprint} ya fue procesado en la recarga ${processedSnap.data()?.topupId}.`);
      }

      // 5. Leer Wallet actual del conductor
      const driverId = topupData.driverId;
      const userRef = db.collection('users').doc(driverId);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) {
        throw new Error(`CONDUCTOR_NO_ENCONTRADO: El perfil del conductor ${driverId} no existe.`);
      }

      const userData = userSnap.data();
      const currentWallet = (userData?.wallet as Partial<Wallet> | undefined) ?? {
        availableBalance: 0,
        retainedBalance: 0,
        movements: [] as WalletMovement[]
      };

      const currentBalance = Number((currentWallet.availableBalance || 0).toFixed(2));
      const newAvailableBalance = Number((currentBalance + verifiedAmount).toFixed(2));

      // 6 & 7. Registrar movimiento de Wallet
      const txId = `WTX-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const newMov = {
        id: txId,
        type: 'topup_yape',
        amount: verifiedAmount,
        description: `Recarga verificada vía Yape (${topupData.referenceCode})`,
        createdAt: Timestamp.now(),
        referenceId: topupId
      };

      const updatedWallet = {
        ...currentWallet,
        availableBalance: newAvailableBalance,
        digitalBalance: newAvailableBalance,
        updatedAt: FieldValue.serverTimestamp(),
        movements: [newMov, ...(currentWallet.movements || []).slice(0, 49)]
      };

      // 8. Registrar processed_bank_movement
      transaction.set(processedRef, {
        movementFingerprint,
        topupId,
        referenceCode: topupData.referenceCode,
        driverId,
        amount: verifiedAmount,
        operatorId,
        creditedAt: FieldValue.serverTimestamp()
      });

      // 9 & 10. Cambiar topup a CREDITED y guardar timestamp y referencia de transacción
      const creditedTimestamp = new Date().toISOString();
      const newAuditEntry = {
        fromStatus: 'VERIFIED',
        toStatus: 'CREDITED',
        timestamp: creditedTimestamp,
        actorId: operatorId,
        actorRole: 'operator',
        reason: 'Acreditación atómica de saldo completada con éxito',
        metadata: {
          verifiedAmount,
          txId,
          previousBalance: currentBalance,
          newBalance: newAvailableBalance
        }
      };

      transaction.update(topupRef, {
        status: 'CREDITED',
        creditedAt: creditedTimestamp,
        creditedTxId: txId,
        finalBalanceSnapshot: newAvailableBalance,
        updatedAt: creditedTimestamp,
        auditHistory: FieldValue.arrayUnion(newAuditEntry)
      });

      // Actualizar balance en el usuario
      transaction.update(userRef, {
        wallet: updatedWallet
      });

      // Registrar también en wallets/{driverId}/movements/{txId} para escalabilidad
      const standaloneMovRef = db.collection('wallets').doc(driverId).collection('movements').doc(txId);
      transaction.set(standaloneMovRef, {
        ...newMov,
        topupId,
        referenceCode: topupData.referenceCode,
        creditedBy: operatorId,
        createdAt: FieldValue.serverTimestamp()
      });

      // Registrar asiento contable en accounting_ledger
      const ledgerRef = db.collection('accounting_ledger').doc(txId);
      transaction.set(ledgerRef, {
        id: txId,
        type: 'WALLET_TOPUP_CREDIT',
        debitAccount: 'ACTIVO_BANCO_YAPE_ZENITH',
        creditAccount: 'PASIVO_WALLET_MOTORIZADO',
        amount: verifiedAmount,
        driverId,
        referenceCode: topupData.referenceCode,
        topupId,
        operatorId,
        createdAt: FieldValue.serverTimestamp()
      });

      return {
        success: true,
        topupId,
        txId,
        driverId,
        creditedAmount: verifiedAmount,
        newBalance: newAvailableBalance
      };
    });
  },


};
