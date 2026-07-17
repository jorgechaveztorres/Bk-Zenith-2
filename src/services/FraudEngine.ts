// ============================================================================
// ZÉNITH
// Module : Financial / Fraud Engine
// Layer  : Domain / Services
// File   : FraudEngine.ts
// ============================================================================

import { AuditEngine } from './AuditEngine';
import { LoggingService } from './LoggingService';
import { TransactionRecord } from './TransactionEngine';
import { Wallet } from '../types';

export interface FraudAnalysisResult {
  isSafe: boolean;
  score: number; // 0 (perfectly safe) to 100 (critical fraud detected)
  reasons: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export class FraudEngine {
  private static recentPayments: Map<string, { timestamp: number; amount: number }> = new Map();
  private static failedAttempts: Map<string, { count: number; lastTime: number }> = new Map();

  /**
   * Analyzes a pending payment to see if it triggers fraud safeguards
   */
  public static async analyzePayment(params: {
    passengerId: string;
    rideId: string;
    amount: number;
    paymentMethod: string;
    cardNumber?: string;
  }): Promise<FraudAnalysisResult> {
    const reasons: string[] = [];
    let score = 0;

    // Rule 1: Check duplicate payments in rapid succession (same user & amount)
    const passengerKey = `${params.passengerId}_${params.amount}`;
    const now = Date.now();
    const existing = this.recentPayments.get(passengerKey);
    
    if (existing && (now - existing.timestamp < 30000)) { // 30 seconds window
      score += 65;
      reasons.push("Pago duplicado detectado: Transacción idéntica en menos de 30 segundos.");
    }

    // Rule 2: Check for rapid consecutive transaction failures
    const attempts = this.failedAttempts.get(params.passengerId);
    if (attempts && attempts.count >= 3 && (now - attempts.lastTime < 300000)) { // 5 minutes window
      score += 40;
      reasons.push(`Intentos repetitivos fallidos: ${attempts.count} transacciones rechazadas recientemente.`);
    }

    // Rule 3: Check for unusual massive amounts
    if (params.amount > 500) {
      score += 30;
      reasons.push("Monto anómalamente alto para transporte urbano (> S/. 500.00).");
    }

    // Rule 4: Card safety checks (simulated high frequency check)
    if (params.paymentMethod === 'card' && !params.cardNumber) {
      score += 50;
      reasons.push("Intento de cobro por tarjeta sin credenciales firmadas válidas.");
    }

    // Determine risk levels
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (score >= 80) {
      riskLevel = 'CRITICAL';
    } else if (score >= 50) {
      riskLevel = 'HIGH';
    } else if (score >= 20) {
      riskLevel = 'MEDIUM';
    }

    const isSafe = riskLevel !== 'CRITICAL' && riskLevel !== 'HIGH';

    // Log to AuditEngine if risky
    if (!isSafe || riskLevel !== 'LOW') {
      await AuditEngine.logEvent({
        eventType: 'SECURITY_ALERT',
        severity: isSafe ? 'WARNING' : 'CRITICAL',
        actorId: params.passengerId,
        actorName: 'Zenith Fraud Sentry',
        description: `Alerta de seguridad financiera para pasajero ${params.passengerId}. Riesgo: ${riskLevel}. Score: ${score}`,
        metadata: {
          rideId: params.rideId,
          amount: params.amount,
          paymentMethod: params.paymentMethod,
          riskLevel,
          score,
          reasons: reasons.join('; ')
        }
      });
    }

    // Cache current payment timestamp
    this.recentPayments.set(passengerKey, { timestamp: now, amount: params.amount });

    return {
      isSafe,
      score,
      reasons,
      riskLevel
    };
  }

  /**
   * Evaluates if a driver's wallet profile is healthy enough to accept rides or request settlements
   */
  public static async analyzeWalletSafety(wallet: Wallet, driverId: string): Promise<boolean> {
    const minThreshold = -50.00; // Limit for negative balance (cash commission debt)
    
    if (wallet.availableBalance < minThreshold) {
      await AuditEngine.logEvent({
        eventType: 'SECURITY_ALERT',
        severity: 'WARNING',
        actorId: driverId,
        actorName: 'Zenith Wallet Auditing',
        description: `Bloqueo operativo por saldo negativo excesivo. Saldo: S/. ${wallet.availableBalance}`,
        metadata: {
          availableBalance: wallet.availableBalance,
          cashDebt: wallet.cashDebt,
          threshold: minThreshold
        }
      });
      LoggingService.warn('FRAUD_ENGINE', `Conductor ${driverId} bloqueado por saldo disponible excesivamente negativo: ${wallet.availableBalance}`);
      return false;
    }
    return true;
  }

  /**
   * Audits and checks if a refund request is legitimate and safe
   */
  public static async validateRefundLegitimacy(
    tx: TransactionRecord,
    refundAmount: number
  ): Promise<{ isValid: boolean; reason?: string }> {
    // Rule A: Refund amount cannot exceed original payment amount
    if (refundAmount > tx.amount) {
      await AuditEngine.logEvent({
        eventType: 'SECURITY_ALERT',
        severity: 'CRITICAL',
        actorId: tx.passengerId,
        actorName: 'Zenith Fraud Sentry',
        description: `Reembolso anómalo detectado: Monto solicitado supera al original.`,
        metadata: {
          txId: tx.id,
          originalAmount: tx.amount,
          requestedRefund: refundAmount
        }
      });
      return { isValid: false, reason: "El monto del reembolso no puede ser mayor al pago original." };
    }

    // Rule B: Can only refund captured or settled transactions
    if (tx.status !== 'CAPTURED' && tx.status !== 'SETTLED' && tx.status !== 'AUTHORIZED') {
      return { isValid: false, reason: `No se puede reembolsar una transacción en estado: ${tx.status}` };
    }

    return { isValid: true };
  }

  /**
   * Tracks a payment failure to dynamically increase user fraud risk score on consecutive failures
   */
  public static trackFailure(passengerId: string) {
    const now = Date.now();
    const existing = this.failedAttempts.get(passengerId) || { count: 0, lastTime: 0 };
    this.failedAttempts.set(passengerId, {
      count: existing.count + 1,
      lastTime: now
    });
  }

  /**
   * Resets the consecutive failure counter for a user upon successful payment authorization
   */
  public static resetFailures(passengerId: string) {
    this.failedAttempts.delete(passengerId);
  }
}
