// ============================================================================
// ZÉNITH
// Module : Financial / Settlement Engine
// Layer  : Domain / Services
// File   : SettlementEngine.ts
// ============================================================================

import { db } from '../firebase/config';
import { doc, getDoc, updateDoc, Timestamp, collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { Wallet, WalletMovement, FirestoreTimestamp } from '../types';
import { LoggingService } from './LoggingService';
import { AuditEngine } from './AuditEngine';
import { TransactionEngine, TransactionRecord } from './TransactionEngine';

export interface SettlementRecord {
  id: string;
  driverId: string;
  amountSettled: number;
  commissionCollected: number;
  cashDebtCompensated: number;
  bankDetails: string;
  status: 'COMPLETED' | 'FAILED' | 'RECONCILED';
  timestamp: string;
  reconciliationReport?: string;
}

export class SettlementEngine {
  private static collectionName = 'settlements';

  /**
   * Automatically reconciles and triggers a driver payout (settlement) to their bank account.
   */
  public static async executeAutomaticSettlement(
    driverId: string,
    bankDetails: string
  ): Promise<{ success: boolean; message: string; record?: SettlementRecord }> {
    LoggingService.info('SETTLEMENT_ENGINE', `Ejecutando proceso de liquidación automática para conductor: ${driverId}`);

    try {
      const userRef = doc(db, 'users', driverId);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        throw new Error("No se pudo encontrar la cuenta del conductor para liquidación.");
      }

      const userData = snap.data();
      const wallet = userData.wallet as Wallet;
      if (!wallet) {
        throw new Error("El conductor no cuenta con una billetera digital Zenith activa.");
      }

      // Reconciliation pre-check
      const reconciliation = await this.reconcileDriverLedger(driverId, wallet);
      if (!reconciliation.isBalanced) {
        LoggingService.warn('SETTLEMENT_ENGINE', `Discrepancia contable detectada antes de liquidar: ${reconciliation.message}`);
        // Create an warning event
        await AuditEngine.logEvent({
          eventType: 'SECURITY_ALERT',
          severity: 'WARNING',
          actorId: driverId,
          actorName: 'Zenith Settlement Auditor',
          description: `Discrepancia contable detectada. Liquidación suspendida. ${reconciliation.message}`,
          metadata: { driverId, balance: wallet.availableBalance, ledgerSum: reconciliation.ledgerSum }
        });
        throw new Error(`Conciliación fallida: ${reconciliation.message}. Liquidación detenida.`);
      }

      const amountToSettle = wallet.availableBalance;
      if (amountToSettle <= 10.00) { // S/. 10 minimum payout
        return {
          success: false,
          message: `Saldo disponible de S/. ${amountToSettle.toFixed(2)} es insuficiente para liquidar (Mínimo S/. 10.00).`
        };
      }

      const settlementId = `SET_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      
      // Perform adjustment: Available balance goes to zero, transferred to digital payouts
      const newMov: WalletMovement = {
        id: `mov_settle_${Date.now()}`,
        type: 'withdrawal',
        amount: amountToSettle,
        description: `Liquidación automática transferida a cuenta bancaria: ${bankDetails}`,
        createdAt: Timestamp.now()
      };

      const updatedWallet: Wallet = {
        ...wallet,
        availableBalance: 0,
        digitalBalance: 0,
        pendingSettlement: Number((wallet.pendingSettlement + amountToSettle).toFixed(2)),
        todaySettlements: (wallet.todaySettlements || 0) + 1,
        movements: [newMov, ...(wallet.movements || [])]
      };

      await updateDoc(userRef, {
        wallet: updatedWallet
      });

      // Create settlement ledger record in Firestore
      const settlementRecord: SettlementRecord = {
        id: settlementId,
        driverId,
        amountSettled: amountToSettle,
        commissionCollected: wallet.accumulatedCommission || 0,
        cashDebtCompensated: wallet.cashDebt,
        bankDetails,
        status: 'COMPLETED',
        timestamp: new Date().toISOString(),
        reconciliationReport: reconciliation.message
      };

      await addDoc(collection(db, this.collectionName), {
        ...settlementRecord,
        createdAt: serverTimestamp()
      });

      // Send driver in-app notification
      const existingNotifs = userData.notifications || [];
      const newNotif = {
        id: `notif_settle_${Date.now()}`,
        title: '💵 Liquidación Realizada',
        message: `Se ha procesado su liquidación por S/. ${amountToSettle.toFixed(2)} hacia su cuenta de banco.`,
        type: 'success',
        read: false,
        createdAt: Timestamp.now()
      };
      await updateDoc(userRef, {
        notifications: [newNotif, ...existingNotifs]
      });

      await AuditEngine.logEvent({
        eventType: 'FINANCIAL_TRANSACTION',
        severity: 'INFO',
        actorId: driverId,
        actorName: 'Settlement Engine',
        description: `Liquidación automática completada exitosamente por S/. ${amountToSettle.toFixed(2)}`,
        metadata: { settlementId, amountToSettle, bankDetails }
      });

      return {
        success: true,
        message: `Liquidación de S/. ${amountToSettle.toFixed(2)} procesada exitosamente.`,
        record: settlementRecord
      };
    } catch (err: any) {
      LoggingService.error('SETTLEMENT_ENGINE', `Error de liquidación automática para ${driverId}`, err);
      
      // Notify Admin on payout failure
      await AuditEngine.logEvent({
        eventType: 'FINANCIAL_TRANSACTION',
        severity: 'CRITICAL',
        actorId: driverId,
        actorName: 'Settlement Engine',
        description: `Liquidación fallida para conductor ${driverId}: ${err.message}`,
        metadata: { driverId, error: err.message }
      });

      return {
        success: false,
        message: `Error al liquidar fondos: ${err.message}`
      };
    }
  }

  /**
   * Applies cash-to-digital offsets when driver earns digital trips while holding cash debt.
   */
  public static async applyCashCompensation(
    driverId: string,
    compensationAmount: number,
    notes: string
  ): Promise<Wallet> {
    LoggingService.info('SETTLEMENT_ENGINE', `Aplicando compensación de efectivo por S/. ${compensationAmount} para conductor ${driverId}`);
    
    const userRef = doc(db, 'users', driverId);
    const snap = await getDoc(userRef);
    if (!snap.exists()) throw new Error("No se pudo encontrar el conductor.");

    const userData = snap.data();
    const wallet = userData.wallet as Wallet;
    if (!wallet) throw new Error("El conductor no cuenta con una billetera.");

    const newMov: WalletMovement = {
      id: `mov_comp_${Date.now()}`,
      type: 'cash_compensation',
      amount: compensationAmount,
      description: `Ajuste compensatorio: ${notes}`,
      createdAt: Timestamp.now()
    };

    const newCashDebt = Math.max(0, Number((wallet.cashDebt - compensationAmount).toFixed(2)));
    const newAvailable = Number((wallet.availableBalance + compensationAmount).toFixed(2));

    const updatedWallet: Wallet = {
      ...wallet,
      availableBalance: newAvailable,
      cashDebt: newCashDebt,
      compensationBalance: Number(((wallet.compensationBalance || 0) + compensationAmount).toFixed(2)),
      movements: [newMov, ...(wallet.movements || [])]
    };

    await updateDoc(userRef, {
      wallet: updatedWallet
    });

    return updatedWallet;
  }

  /**
   * Validates and matches transaction ledger records with the actual wallet state.
   */
  public static async reconcileDriverLedger(
    driverId: string,
    wallet: Wallet
  ): Promise<{ isBalanced: boolean; ledgerSum: number; message: string }> {
    try {
      const txs = await TransactionEngine.getDriverTransactions(driverId);
      
      // Calculate net earnings based on ledger
      let calculatedEarnings = 120.00; // starting credit in base wallet
      txs.forEach(t => {
        if (t.status === 'CAPTURED' || t.status === 'SETTLED') {
          if (t.paymentMethod !== 'cash') {
            calculatedEarnings += (t.amount - t.commission);
          } else {
            // cash payment commission is debited
            calculatedEarnings -= t.commission;
          }
        } else if (t.status === 'REFUNDED') {
          // subtraction
          calculatedEarnings += (t.amount - t.commission); // amounts are negative
        }
      });

      // Deduct already completed payouts
      const completedPayouts = wallet.movements
        .filter(m => m.description.includes('Liquidación automática') || m.description.includes('Retiro'))
        .reduce((sum, m) => sum + m.amount, 0);

      const netExpectedAvailable = Number((calculatedEarnings - completedPayouts).toFixed(2));
      const difference = Math.abs(netExpectedAvailable - wallet.availableBalance);

      if (difference <= 1.00) { // Allow tiny roundings up to 1.00 PEN
        return {
          isBalanced: true,
          ledgerSum: netExpectedAvailable,
          message: `Conciliación exitosa. Saldo digital balanceado (diferencia: S/. ${difference.toFixed(2)})`
        };
      } else {
        return {
          isBalanced: false,
          ledgerSum: netExpectedAvailable,
          message: `Discrepancia contable detectada: Esperado S/. ${netExpectedAvailable.toFixed(2)}, Encontrado S/. ${wallet.availableBalance.toFixed(2)}`
        };
      }
    } catch (err: any) {
      return {
        isBalanced: false,
        ledgerSum: 0,
        message: `Error al realizar conciliación contable: ${err.message}`
      };
    }
  }

  /**
   * Retrieves all completed settlements (for admin view)
   */
  public static async getAllSettlements(): Promise<SettlementRecord[]> {
    try {
      const snapshot = await getDocs(collection(db, this.collectionName));
      const list: SettlementRecord[] = [];
      snapshot.forEach(doc => {
        list.push(doc.data() as SettlementRecord);
      });
      return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (err) {
      return [];
    }
  }
}

function serverTimestamp() {
  return Timestamp.now();
}
