import { db } from '../../firebase/config';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  updateDoc 
} from 'firebase/firestore';
import { ITaxRepository, TaxDocument, TaxStatus, TaxDocumentType } from './TaxTypes';
import { AuditEngine } from '../AuditEngine';

export class TaxRepository implements ITaxRepository {
  private collectionName = 'tax_documents';

  async saveDocument(docData: TaxDocument): Promise<boolean> {
    try {
      const docRef = doc(db, this.collectionName, docData.id);
      await setDoc(docRef, {
        ...docData,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // Audit the action securely
      await AuditEngine.logEvent({
        eventType: 'FINANCIAL_TRANSACTION',
        severity: 'INFO',
        actorId: 'SYSTEM_TAX_ENGINE',
        actorName: 'Zénith Tax Engine',
        description: `Comprobante ${docData.type} ${docData.series}-${docData.correlative} registrado de forma segura.`,
        metadata: {
          documentId: docData.id,
          type: docData.type,
          status: docData.status,
          total: docData.total,
          passengerId: docData.passengerId
        }
      });

      return true;
    } catch (error) {
      console.error('[TaxRepository] Error saving document:', error);
      return false;
    }
  }

  async getDocumentById(id: string): Promise<TaxDocument | null> {
    try {
      const docRef = doc(db, this.collectionName, id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as TaxDocument;
      }
      return null;
    } catch (error) {
      console.error('[TaxRepository] Error getting document:', error);
      return null;
    }
  }

  async getDocumentByRideId(rideId: string): Promise<TaxDocument | null> {
    try {
      const q = query(collection(db, this.collectionName), where('rideId', '==', rideId), limit(1));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        return querySnapshot.docs[0].data() as TaxDocument;
      }
      return null;
    } catch (error) {
      console.error('[TaxRepository] Error getting document by rideId:', error);
      return null;
    }
  }

  async listDocuments(filters: { status?: TaxStatus; type?: TaxDocumentType; limitCount?: number }): Promise<TaxDocument[]> {
    try {
      const constraints = [];
      if (filters.status) {
        constraints.push(where('status', '==', filters.status));
      }
      if (filters.type) {
        constraints.push(where('type', '==', filters.type));
      }
      
      // Attempt to retrieve without index dependency if ordering fails
      const q = query(collection(db, this.collectionName), ...constraints);
      const querySnapshot = await getDocs(q);
      const docs: TaxDocument[] = [];
      querySnapshot.forEach((docSnap) => {
        docs.push(docSnap.data() as TaxDocument);
      });
      
      // Sort in-memory to prevent composite index requirements in clean environments
      docs.sort((a, b) => b.issueDate.localeCompare(a.issueDate));
      
      if (filters.limitCount) {
        return docs.slice(0, filters.limitCount);
      }
      return docs;
    } catch (error) {
      console.error('[TaxRepository] Error listing documents:', error);
      return [];
    }
  }

  async updateDocumentStatus(id: string, status: TaxStatus, auditMeta: Record<string, string | number | boolean | null>): Promise<boolean> {
    try {
      const docRef = doc(db, this.collectionName, id);
      await updateDoc(docRef, {
        status,
        updatedAt: new Date().toISOString()
      });

      // Audit transition
      await AuditEngine.logEvent({
        eventType: 'FINANCIAL_TRANSACTION',
        severity: 'INFO',
        actorId: 'SYSTEM_TAX_ENGINE',
        actorName: 'Zénith Tax Engine',
        description: `Comprobante ${id} cambió a estado ${status}`,
        metadata: {
          documentId: id,
          newStatus: status,
          ...auditMeta
        }
      });

      return true;
    } catch (error) {
      console.error('[TaxRepository] Error updating status:', error);
      return false;
    }
  }

  async logError(id: string, errorMsg: string): Promise<boolean> {
    try {
      const docRef = doc(db, this.collectionName, id);
      const docSnap = await getDoc(docRef);
      const currentRetry = docSnap.exists() ? (docSnap.data().retryCount || 0) : 0;
      
      await updateDoc(docRef, {
        lastError: errorMsg,
        retryCount: currentRetry + 1,
        updatedAt: new Date().toISOString()
      });

      await AuditEngine.logEvent({
        eventType: 'SECURITY_ALERT',
        severity: 'WARNING',
        actorId: 'SYSTEM_TAX_ENGINE',
        actorName: 'Zénith Tax Engine',
        description: `Falla en procesamiento de comprobante ${id}: ${errorMsg}`,
        metadata: {
          documentId: id,
          error: errorMsg,
          retryCount: currentRetry + 1
        }
      });

      return true;
    } catch (error) {
      console.error('[TaxRepository] Error logging error:', error);
      return false;
    }
  }
}
