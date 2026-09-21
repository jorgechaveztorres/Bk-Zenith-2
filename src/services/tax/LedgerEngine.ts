import { db } from '../../firebase/config';
import { collection, doc, setDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { LedgerEntry } from './TaxTypes';
import { AuditEngine } from '../AuditEngine';

export class LedgerEngineClass {
  private collectionName = 'accounting_ledger';

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
    const res = await fetch('/api/ledger/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer DUMMY_TOKEN_UNTIL_AUTH_IS_WIRED_ON_FRONTEND` },
      body: JSON.stringify(params)
    });
    
    if (!res.ok) throw new Error('Fallo al registrar ledger en backend');
    const data = await res.json();
    return data.id;
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
