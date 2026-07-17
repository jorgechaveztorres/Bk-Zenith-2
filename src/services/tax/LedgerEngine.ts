import { db } from '../../firebase/config';
import { collection, doc, setDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { LedgerEntry } from './TaxTypes';
import { AuditEngine } from '../AuditEngine';

export class LedgerEngineClass {
  private collectionName = 'accounting_ledger';

  private generateLedgerHash(entry: Omit<LedgerEntry, 'hash'>): string {
    const serialized = JSON.stringify({
      id: entry.id,
      rideId: entry.rideId,
      passengerId: entry.passengerId,
      driverId: entry.driverId,
      date: entry.date,
      time: entry.time,
      subtotal: entry.subtotal,
      igv: entry.igv,
      commission: entry.commission,
      total: entry.total,
      paymentMethod: entry.paymentMethod,
      status: entry.status,
      auditId: entry.auditId
    });
    
    // Simple fast hashing
    let hash = 0;
    for (let i = 0; i < serialized.length; i++) {
      const char = serialized.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32-bit integer
    }
    return `LEDGER-CRYPT-HASH-[${entry.id}]-${Math.abs(hash).toString(16).toUpperCase()}-${Date.now()}`;
  }

  async recordEntry(params: {
    rideId: string;
    passengerId: string;
    driverId: string;
    subtotal: number;
    igv: number;
    commission: number;
    total: number;
    paymentMethod: string;
    status: string;
  }): Promise<string> {
    const id = `LED-${Date.now()}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const today = new Date();
    const date = today.toISOString().split('T')[0]; // YYYY-MM-DD
    const time = today.toTimeString().split(' ')[0]; // HH:mm:ss

    // Automatically audit log
    const auditId = `AUD_LEDGER_${Date.now()}`;

    const partialEntry: Omit<LedgerEntry, 'hash'> = {
      id,
      rideId: params.rideId,
      passengerId: params.passengerId,
      driverId: params.driverId,
      date,
      time,
      subtotal: params.subtotal,
      igv: params.igv,
      commission: params.commission,
      total: params.total,
      paymentMethod: params.paymentMethod,
      status: params.status,
      auditId,
      createdAt: new Date().toISOString()
    };

    const hash = this.generateLedgerHash(partialEntry);
    const completeEntry: LedgerEntry = {
      ...partialEntry,
      hash
    };

    // Store in firestore safely
    await setDoc(doc(db, this.collectionName, id), completeEntry);

    // Securely audit transition
    await AuditEngine.logEvent({
      eventType: 'FINANCIAL_TRANSACTION',
      severity: 'INFO',
      actorId: 'LEDGER_ENGINE',
      actorName: 'Zénith Ledger Accounting',
      description: `Asiento contable inmutable ${id} registrado para el viaje ${params.rideId}`,
      metadata: {
        ledgerId: id,
        rideId: params.rideId,
        total: params.total,
        hash
      }
    });

    return id;
  }

  async getLedgerEntries(): Promise<LedgerEntry[]> {
    try {
      const q = query(collection(db, this.collectionName), orderBy('createdAt', 'desc'), limit(100));
      const snapshot = await getDocs(q);
      const entries: LedgerEntry[] = [];
      snapshot.forEach((docSnap) => {
        entries.push(docSnap.data() as LedgerEntry);
      });
      // Sort in-memory fallback
      entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return entries;
    } catch (e) {
      console.error('[LedgerEngine] Error listing entries:', e);
      return [];
    }
  }
}

export const LedgerEngine = new LedgerEngineClass();
