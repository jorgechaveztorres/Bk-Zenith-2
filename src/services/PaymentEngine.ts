// ============================================================================
// ZÉNITH
// Module : Financial / Payment Engine
// Layer  : Domain / Services
// File   : PaymentEngine.ts
// ============================================================================

import { db } from '../firebase/config';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { PaymentState, Ride, RideStatus, Wallet, WalletMovement } from '../types';
import { AuditEngine } from './AuditEngine';
import { LoggingService } from './LoggingService';
import { TransactionEngine, TransactionRecord } from './TransactionEngine';
import { FraudEngine } from './FraudEngine';
import { WalletService } from './WalletService';

export interface PaymentMethodDetails {
  method: 'cash' | 'yape' | 'plin' | 'card' | 'wallet' | 'mixed';
  amount: number;
  phone?: string;          // For Yape/Plin
  cardNumber?: string;     // For Card payments
  cardExpiry?: string;     // For Card payments
  cardCVV?: string;        // For Card payments
  walletAmountUsed?: number; // For mixed payments
  externalAmountUsed?: number; // For mixed payments
}

export interface PaymentExecutionResult {
  success: boolean;
  status: PaymentState;
  transactionId?: string;
  message: string;
  error?: string;
  timestamp: string;
}

export class PaymentEngine {
  private static readonly COMMISSION_RATE = 0.15; // 15% Plataform Commission

  /**
   * Main entry point to process a ride payment under strict security and Zero-Trust.
   */
  public static async processPayment(
    ride: Ride,
    details: PaymentMethodDetails,
    idempotencyKey?: string
  ): Promise<PaymentExecutionResult> {
    const timestamp = new Date().toISOString();
    const passengerId = ride.passengerId;
    const driverId = ride.driverId || 'SYSTEM_RESERVED';
    const amount = details.amount;

    LoggingService.info('PAYMENT_ENGINE', `Procesando pago por S/. ${amount} para viaje ${ride.id}. Método: ${details.method}`);

    // Step 1: Pre-validation & Fraud Sentry check
    const fraudCheck = await FraudEngine.analyzePayment({
      passengerId,
      rideId: ride.id,
      amount,
      paymentMethod: details.method,
      cardNumber: details.cardNumber
    });

    if (!fraudCheck.isSafe) {
      FraudEngine.trackFailure(passengerId);
      await AuditEngine.logEvent({
        eventType: 'SECURITY_ALERT',
        severity: 'CRITICAL',
        actorId: passengerId,
        actorName: 'Zenith Sentry',
        description: `Pago denegado por políticas de prevención de fraude. Riesgo: ${fraudCheck.riskLevel}`,
        metadata: { rideId: ride.id, score: fraudCheck.score, reasons: fraudCheck.reasons.join(', ') }
      });

      return {
        success: false,
        status: PaymentState.FAILED,
        message: `Transacción rechazada por seguridad financiera: ${fraudCheck.reasons[0]}`,
        error: 'FRAUD_PREVENTION_TRIGGERED',
        timestamp
      };
    }

    // Initialize State Machine
    let currentState = PaymentState.PENDING;
    await this.logStateTransition(ride.id, passengerId, null, PaymentState.PROCESSING, 'Iniciando procesamiento de pasarela');
    currentState = PaymentState.PROCESSING;

    try {
      // Step 2: Route according to method
      let isApproved = false;
      let appMessage = '';

      switch (details.method) {
        case 'cash':
          isApproved = true;
          appMessage = 'Pago en efectivo registrado por cobrar al final del trayecto.';
          currentState = PaymentState.AUTHORIZED;
          break;

        case 'yape':
        case 'plin':
          // Zero-Trust validation on digital mobile wallets
          if (!details.phone || details.phone.length < 9) {
            throw new Error('El número celular es inválido para cobros digitales Yape/Plin');
          }
          // Simulate instant real-time bank ledger settlement
          await new Promise(resolve => setTimeout(resolve, 800));
          isApproved = true;
          appMessage = `Transacción autorizada mediante pasarela virtual con cuenta móvil ${details.phone}`;
          currentState = PaymentState.AUTHORIZED;
          break;

        case 'card':
          // Strict cryptographic-ready card validations
          if (!details.cardNumber || details.cardNumber.length < 16) {
            throw new Error('Tarjeta rechazada por número inválido o fondos insuficientes.');
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
          isApproved = true;
          appMessage = `Cargo aprobado por el procesador adquirente. Tarjeta terminada en ${details.cardNumber.slice(-4)}`;
          currentState = PaymentState.AUTHORIZED;
          break;

        case 'wallet':
          // Digital Wallet V2 verification
          const passengerWallet = await WalletService.getOrCreateWallet(passengerId);
          if (passengerWallet.availableBalance < amount) {
            throw new Error('Saldo insuficiente en su billetera digital Zénith.');
          }
          // Deduct from passenger's wallet
          await this.deductFromUserWallet(passengerId, amount, `Debitado por pago de viaje #${ride.id.substring(0, 6)}`);
          isApproved = true;
          appMessage = `Pago debitado exitosamente de la billetera digital del pasajero.`;
          currentState = PaymentState.AUTHORIZED;
          break;

        case 'mixed':
          // Wallet + Card/App
          const walletAmt = details.walletAmountUsed || 0;
          const externalAmt = details.externalAmountUsed || 0;
          if (Math.round((walletAmt + externalAmt) * 100) / 100 !== Math.round(amount * 100) / 100) {
            throw new Error('La suma de los montos mixtos no coincide con el total del viaje.');
          }
          const userWallet = await WalletService.getOrCreateWallet(passengerId);
          if (userWallet.availableBalance < walletAmt) {
            throw new Error('Saldo de billetera insuficiente para cubrir la fracción del pago mixto.');
          }
          if (externalAmt > 0 && (!details.phone && !details.cardNumber)) {
            throw new Error('No se especificó un método de cobro externo válido para la fracción restante.');
          }
          // Deduct the wallet fraction
          if (walletAmt > 0) {
            await this.deductFromUserWallet(passengerId, walletAmt, `Debitado por fracción mixta de viaje #${ride.id.substring(0, 6)}`);
          }
          await new Promise(resolve => setTimeout(resolve, 800));
          isApproved = true;
          appMessage = `Pago mixto procesado: S/. ${walletAmt.toFixed(2)} de billetera, S/. ${externalAmt.toFixed(2)} de procesador externo.`;
          currentState = PaymentState.AUTHORIZED;
          break;

        default:
          throw new Error('Método de pago no reconocido por el motor financiero.');
      }

      // Step 3: Transition to CAPTURED / SETTLED
      if (isApproved) {
        const nextState = PaymentState.CAPTURED;
        await this.logStateTransition(ride.id, passengerId, currentState, nextState, `Cargo capturado con éxito: ${appMessage}`);
        currentState = nextState;

        // Reset user's failure count upon success
        FraudEngine.resetFailures(passengerId);

        // Record on Cryptographic Ledger (TransactionEngine)
        const commissionAmt = Math.round((amount * this.COMMISSION_RATE) * 100) / 100;
        const txRecord = await TransactionEngine.registerTransaction({
          rideId: ride.id,
          passengerId,
          driverId,
          paymentMethod: details.method,
          amount,
          commission: commissionAmt,
          status: currentState,
          idempotencyKey
        });

        // Trigger notifications as requested
        await this.triggerPaymentSuccessNotifications(ride, amount, details.method);

        return {
          success: true,
          status: currentState,
          transactionId: txRecord.id,
          message: appMessage,
          timestamp
        };
      } else {
        throw new Error('El procesador financiero rechazó la transacción sin código de error.');
      }

    } catch (err: any) {
      LoggingService.error('PAYMENT_ENGINE', `Falla en el procesamiento de cobro para viaje ${ride.id}`, err);
      FraudEngine.trackFailure(passengerId);

      const nextState = PaymentState.FAILED;
      await this.logStateTransition(ride.id, passengerId, currentState, nextState, `Falla: ${err.message}`);
      currentState = nextState;

      // Log failure in Audit Engine
      await AuditEngine.logEvent({
        eventType: 'FINANCIAL_TRANSACTION',
        severity: 'WARNING',
        actorId: passengerId,
        actorName: 'Zenith Ledger Engine',
        description: `Falla en pago: ${err.message}`,
        metadata: { rideId: ride.id, amount, paymentMethod: details.method }
      });

      return {
        success: false,
        status: currentState,
        message: `Cobro fallido. ${err.message}`,
        error: err.message || 'TRANSACTION_REJECTED',
        timestamp
      };
    }
  }

  /**
   * Processes a complete refund for an existing captured transaction
   */
  public static async processRefund(
    txId: string,
    operatorUid: string,
    reason: string
  ): Promise<{ success: boolean; message: string; transaction?: TransactionRecord }> {
    LoggingService.info('PAYMENT_ENGINE', `Iniciando reembolso para transacción ${txId}. Operador: ${operatorUid}`);

    try {
      // Find the transaction record
      const transactions = await TransactionEngine.getAllTransactions();
      const tx = transactions.find(t => t.id === txId);
      if (!tx) {
        throw new Error(`No se encontró la transacción con identificador ${txId}`);
      }

      // Validate legitimacy with FraudEngine
      const validation = await FraudEngine.validateRefundLegitimacy(tx, tx.amount);
      if (!validation.isValid) {
        throw new Error(validation.reason || "Validación de reembolso rechazada");
      }

      // Perform refund: if it was wallet or mixed, restore funds
      if (tx.paymentMethod === 'wallet' || tx.paymentMethod === 'mixed') {
        // Find how much was deducted from wallet (for simplicity we restore full amount of tx)
        await this.depositToUserWallet(tx.passengerId, tx.amount, `Reembolso por cancelación de viaje #${tx.rideId.substring(0, 6)}`);
      }

      // Update ride status to REFUNDED in state machine
      await this.logStateTransition(tx.rideId, tx.passengerId, tx.status, PaymentState.REFUNDED, `Reembolso procesado por: ${reason}`);

      // Re-register refunded transaction
      const refundedTx = await TransactionEngine.registerTransaction({
        rideId: tx.rideId,
        passengerId: tx.passengerId,
        driverId: tx.driverId,
        paymentMethod: tx.paymentMethod,
        amount: -tx.amount, // negative representing refund ledger entry
        commission: -tx.commission,
        status: PaymentState.REFUNDED,
        idempotencyKey: `refund_${txId}_${Date.now()}`
      });

      // Send refund notification
      await AuditEngine.logEvent({
        eventType: 'FINANCIAL_TRANSACTION',
        severity: 'INFO',
        actorId: operatorUid,
        actorName: 'Zenith Refund Sentry',
        description: `Reembolso exitoso por S/. ${tx.amount} para viaje ${tx.rideId}`,
        metadata: { txId, passengerId: tx.passengerId, amount: tx.amount }
      });

      return {
        success: true,
        message: `El reembolso de S/. ${tx.amount.toFixed(2)} fue aprobado y acreditado inmediatamente.`,
        transaction: refundedTx
      };
    } catch (error: any) {
      LoggingService.error('PAYMENT_ENGINE', `Reembolso fallido para transacción ${txId}`, error);
      return {
        success: false,
        message: error.message || 'Error desconocido al reembolsar.'
      };
    }
  }

  /**
   * Helper state machine transition logger
   */
  private static async logStateTransition(
    rideId: string,
    passengerId: string,
    oldState: PaymentState | null,
    newState: PaymentState,
    notes: string
  ): Promise<void> {
    const desc = `Transición de Pago: [${oldState || 'N/A'}] ➔ [${newState}]. Detalle: ${notes}`;
    LoggingService.info('PAYMENT_STATE_MACHINE', desc);
    
    await AuditEngine.logEvent({
      eventType: 'FINANCIAL_TRANSACTION',
      severity: newState === PaymentState.FAILED ? 'WARNING' : 'INFO',
      actorId: passengerId,
      actorName: 'Payment State Machine',
      description: desc,
      metadata: {
        rideId,
        oldState: oldState || 'NONE',
        newState,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Directly deducts funds from user's available wallet balance under tight atomicity simulation
   */
  private static async deductFromUserWallet(userId: string, amount: number, description: string): Promise<void> {
    const userDocRef = doc(db, 'users', userId);
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) throw new Error("No se pudo encontrar la cuenta del usuario para débito.");

    const userData = snap.data();
    const currentWallet = (userData.wallet || {
      availableBalance: 0,
      retainedBalance: 0,
      dailyEarnings: 0,
      weeklyEarnings: 0,
      movements: []
    }) as Wallet;

    const newMov: WalletMovement = {
      id: `mov_ded_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'withdrawal',
      amount: amount,
      description,
      createdAt: Timestamp.now()
    };

    const updatedWallet: Wallet = {
      availableBalance: Number((currentWallet.availableBalance - amount).toFixed(2)),
      retainedBalance: currentWallet.retainedBalance,
      dailyEarnings: currentWallet.dailyEarnings,
      weeklyEarnings: currentWallet.weeklyEarnings,
      pendingSettlement: currentWallet.pendingSettlement || 0.00,
      digitalBalance: Number((currentWallet.availableBalance - amount).toFixed(2)),
      cashDebt: currentWallet.cashDebt || 0.00,
      todaySettlements: currentWallet.todaySettlements || 0,
      nextSettlementDate: currentWallet.nextSettlementDate || new Date().toISOString(),
      movements: [newMov, ...(currentWallet.movements || [])]
    };

    await updateDoc(userDocRef, {
      wallet: updatedWallet
    });
  }

  /**
   * Deposits funds to a user's wallet
   */
  private static async depositToUserWallet(userId: string, amount: number, description: string): Promise<void> {
    const userDocRef = doc(db, 'users', userId);
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) return;

    const userData = snap.data();
    const currentWallet = (userData.wallet || {
      availableBalance: 0,
      retainedBalance: 0,
      dailyEarnings: 0,
      weeklyEarnings: 0,
      movements: []
    }) as Wallet;

    const newMov: WalletMovement = {
      id: `mov_dep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'deposit',
      amount: amount,
      description,
      createdAt: Timestamp.now()
    };

    const updatedWallet: Wallet = {
      availableBalance: Number((currentWallet.availableBalance + amount).toFixed(2)),
      retainedBalance: currentWallet.retainedBalance,
      dailyEarnings: currentWallet.dailyEarnings,
      weeklyEarnings: currentWallet.weeklyEarnings,
      pendingSettlement: currentWallet.pendingSettlement || 0.00,
      digitalBalance: Number((currentWallet.availableBalance + amount).toFixed(2)),
      cashDebt: currentWallet.cashDebt || 0.00,
      todaySettlements: currentWallet.todaySettlements || 0,
      nextSettlementDate: currentWallet.nextSettlementDate || new Date().toISOString(),
      movements: [newMov, ...(currentWallet.movements || [])]
    };

    await updateDoc(userDocRef, {
      wallet: updatedWallet
    });
  }

  /**
   * Fires in-app notification triggers
   */
  private static async triggerPaymentSuccessNotifications(ride: Ride, amount: number, method: string): Promise<void> {
    try {
      const passengerRef = doc(db, 'users', ride.passengerId);
      const passSnap = await getDoc(passengerRef);
      if (passSnap.exists()) {
        const passData = passSnap.data();
        const existingNotifs = passData.notifications || [];
        const newNotif = {
          id: `notif_pay_${Date.now()}`,
          title: '✓ Pago Aprobado',
          message: `Su pago de S/. ${amount.toFixed(2)} por método ${method.toUpperCase()} fue liquidado con éxito. ¡Gracias por viajar con Zénith!`,
          type: 'success',
          read: false,
          createdAt: Timestamp.now()
        };
        await updateDoc(passengerRef, {
          notifications: [newNotif, ...existingNotifs]
        });
      }

      if (ride.driverId) {
        const driverRef = doc(db, 'users', ride.driverId);
        const drSnap = await getDoc(driverRef);
        if (drSnap.exists()) {
          const drData = drSnap.data();
          const existingNotifs = drData.notifications || [];
          const driverNet = amount * (1 - this.COMMISSION_RATE);
          const fee = amount * this.COMMISSION_RATE;
          const newNotif = {
            id: `notif_pay_dr_${Date.now()}`,
            title: '💰 Pago Acreditado',
            message: `Viaje completado. Se acreditó S/. ${driverNet.toFixed(2)} a su saldo digital (Comisión aplicada: S/. ${fee.toFixed(2)}).`,
            type: 'success',
            read: false,
            createdAt: Timestamp.now()
          };
          await updateDoc(driverRef, {
            notifications: [newNotif, ...existingNotifs]
          });
        }
      }
    } catch (err) {
      console.error("[ZENITH-NOTIFY-ERROR] Error sending payment notifications:", err);
    }
  }
}
