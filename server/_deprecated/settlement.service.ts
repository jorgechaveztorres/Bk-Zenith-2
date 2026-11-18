import { db } from '../config/firebase';
import { FieldValue } from 'firebase-admin/firestore';

export class SettlementService {
  static async process(driverId: string, bankDetails: string) {
    if (!db) throw new Error("Base de datos no disponible.");

    const userRef = db.collection('users').doc(driverId);
    
    // We use a transaction to prevent race conditions during settlement
    return await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) throw new Error("Conductor no encontrado.");
      
      const userData = userDoc.data();
      const wallet = userData?.wallet;
      
      if (!wallet || wallet.availableBalance <= 10) {
        throw new Error("Saldo insuficiente para liquidar (Mínimo S/. 10.00).");
      }
      
      const amountToSettle = wallet.availableBalance;
      
      transaction.update(userRef, {
        'wallet.availableBalance': 0,
        'wallet.digitalBalance': 0,
        'wallet.pendingSettlement': (wallet.pendingSettlement || 0) + amountToSettle
      });
      
      const settlementRecord = {
        id: `SET_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        driverId,
        amountSettled: amountToSettle,
        commissionCollected: wallet.accumulatedCommission || 0,
        cashDebtCompensated: wallet.cashDebt || 0,
        bankDetails,
        status: 'COMPLETED',
        timestamp: new Date().toISOString(),
      };
      
      const settlementRef = db.collection('settlements').doc(settlementRecord.id);
      transaction.set(settlementRef, {
        ...settlementRecord,
        createdAt: FieldValue.serverTimestamp()
      });

      return { 
        message: `Liquidación de S/. ${amountToSettle.toFixed(2)} procesada exitosamente.`,
        record: settlementRecord
      };
    });
  }
}
