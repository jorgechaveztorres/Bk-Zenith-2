import { db } from '../config/firebase';
import { FieldValue } from 'firebase-admin/firestore';

export class PaymentService {
  static async process(rideId: string, passengerId: string, driverId: string, amount: number, details: any) {
    if (!db) throw new Error("Base de datos no disponible.");

    // Real Fraud Check (Mocked backend logic for now, but running on Server)
    const riskScore = Math.random() * 10;
    if (riskScore > 8) {
      throw new Error("Bloqueado por prevención de fraude.");
    }

    let message = "Pago procesado exitosamente.";

    // Process wallet deduction securely on server
    if (details.method === 'wallet' || details.method === 'mixed') {
      const walletAmt = details.walletAmountUsed || amount;
      
      await db.runTransaction(async (transaction) => {
        const userRef = db.collection('users').doc(passengerId);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) throw new Error("Usuario no encontrado.");
        
        const userData = userDoc.data();
        const currentWallet = userData?.wallet || { availableBalance: 0 };
        
        if (currentWallet.availableBalance < walletAmt) {
          throw new Error("Saldo de billetera insuficiente.");
        }
        
        // Deduct
        transaction.update(userRef, {
          'wallet.availableBalance': currentWallet.availableBalance - walletAmt,
          'wallet.digitalBalance': currentWallet.availableBalance - walletAmt
        });
      });
      message = "Pago debitado exitosamente de la billetera digital.";
    }

    // Record transaction
    const txRef = db.collection('transactions').doc();
    const transactionRecord = {
      id: txRef.id,
      rideId,
      passengerId,
      driverId,
      amount,
      method: details.method,
      status: "CAPTURED",
      timestamp: FieldValue.serverTimestamp()
    };

    await txRef.set(transactionRecord);

    return { message, transactionId: txRef.id };
  }
}
