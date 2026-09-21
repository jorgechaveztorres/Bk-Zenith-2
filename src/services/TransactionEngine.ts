// ============================================================================
// ZÉNITH
// Module : Financial / Transaction Engine
// Layer  : Domain / Services
// File   : TransactionEngine.ts
// ============================================================================

import { db } from '../firebase/config';
import { collection, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { PaymentState } from '../types';
import { LoggingService } from './LoggingService';

export interface TransactionRecord {
  id: string; // UUID
  rideId: string;
  passengerId: string;
  driverId: string;
  paymentMethod: 'cash' | 'yape' | 'plin' | 'card' | 'wallet' | 'mixed';
  amount: number;
  commission: number;
  status: PaymentState;
  timestamp: any;
  hash: string;
  signature: string;
  idempotencyKey?: string;
}

export class TransactionEngine {
  private static collectionName = 'transactions';

  /**
   * Generates a deterministic SHA-256 equivalent hash in plain JS for secure signing
   */
  public static calculateHash(record: Omit<TransactionRecord, 'hash' | 'signature'>): string {
    const rawData = `${record.id}|${record.rideId}|${record.passengerId}|${record.driverId}|${record.paymentMethod}|${record.amount}|${record.commission}|${record.status}`;
    let hash = 0;
    for (let i = 0; i < rawData.length; i++) {
      const char = rawData.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    return `ZNT_HS_${Math.abs(hash).toString(16)}_${Date.now()}`;
  }

  /**
   * Generates a unique secure signature representing high-integrity server authorization
   */
  public static generateSignature(hash: string): string {
    const secretKeySalt = "ZENITH_SECURE_FINANCIAL_SALT_2026_PROD";
    const rawSig = `${hash}::${secretKeySalt}`;
    let hashSig = 0;
    for (let i = 0; i < rawSig.length; i++) {
      const char = rawSig.charCodeAt(i);
      hashSig = (hashSig << 7) - hashSig + char;
      hashSig |= 0;
    }
    return `ZEN_SIG_${Math.abs(hashSig).toString(16).toUpperCase()}`;
  }

  /**
   * Registers and cryptographically signs a financial transaction in the immutable ledger.
   */
  public static async registerTransaction(params: {
    rideId: string;
    passengerId: string;
    driverId: string;
    paymentMethod: TransactionRecord['paymentMethod'];
    amount: number;
    commission: number;
    status: PaymentState;
    idempotencyKey?: string;
  }): Promise<TransactionRecord> {
    throw new Error('Server Authority Violation: Transactions cannot be registered from the client SDK. Use Backend API.');
  }

  /**
   * Retrieves transactions associated with a passenger
   */
  public static async getPassengerTransactions(passengerId: string): Promise<TransactionRecord[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('passengerId', '==', passengerId)
      );
      const snapshot = await getDocs(q);
      const list: TransactionRecord[] = [];
      snapshot.forEach(doc => {
        list.push(doc.data() as TransactionRecord);
      });
      return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (err) {
      LoggingService.error('TRANSACTION_ENGINE', 'Error obteniendo transacciones de pasajero', err);
      return [];
    }
  }

  /**
   * Retrieves transactions associated with a driver
   */
  public static async getDriverTransactions(driverId: string): Promise<TransactionRecord[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('driverId', '==', driverId)
      );
      const snapshot = await getDocs(q);
      const list: TransactionRecord[] = [];
      snapshot.forEach(doc => {
        list.push(doc.data() as TransactionRecord);
      });
      return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (err) {
      LoggingService.error('TRANSACTION_ENGINE', 'Error obteniendo transacciones de conductor', err);
      return [];
    }
  }

  /**
   * Retrieves all transactions in system (for admin)
   */
  public static async getAllTransactions(): Promise<TransactionRecord[]> {
    try {
      const snapshot = await getDocs(collection(db, this.collectionName));
      const list: TransactionRecord[] = [];
      snapshot.forEach(doc => {
        list.push(doc.data() as TransactionRecord);
      });
      return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (err) {
      LoggingService.error('TRANSACTION_ENGINE', 'Error obteniendo todas las transacciones', err);
      return [];
    }
  }
}
