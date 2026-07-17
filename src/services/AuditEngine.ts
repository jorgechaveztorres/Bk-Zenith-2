import { LoggingService } from './LoggingService';
import { db } from '../firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ObservabilityService } from './ObservabilityService';

export interface AuditRecord {
  id?: string;
  eventType: 'SECURITY_ALERT' | 'OTP_VALIDATION' | 'RIDE_REQUESTED' | 'RIDE_CLOSED' | 'FINANCIAL_TRANSACTION' | 'SOS_EMERGENCY' | 'ROLE_SWITCH';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  actorId: string;
  actorName: string;
  description: string;
  metadata: Record<string, string | number | boolean | null>;
}

export interface IAuditEngine {
  logEvent(record: AuditRecord): Promise<boolean>;
}

export class AuditEngineClass implements IAuditEngine {
  
  /**
   * Registra un evento de auditoría de manera inmutable en Firestore.
   */
  async logEvent(record: AuditRecord): Promise<boolean> {
    try {
      LoggingService.info('AUDIT_ENGINE', `Registrando auditoría de tipo ${record.eventType} [${record.severity}]`);

      // Enviar a Firestore de manera segura y asíncrona
      const auditCollection = collection(db, 'audit_logs');
      await addDoc(auditCollection, {
        ...record,
        timestamp: serverTimestamp(),
        environment: 'production-sandbox'
      });

      // Rastrear escritura en la telemetría de observabilidad
      ObservabilityService.trackFirestoreWrite();

      LoggingService.info('AUDIT_ENGINE', 'Evento de auditoría guardado con éxito de forma inmutable');
      return true;
    } catch (error) {
      // Las fallas en auditoría no deben botar la app, pero sí deben registrarse a nivel crítico en el logger local
      LoggingService.error('AUDIT_ENGINE', `FALLA CRÍTICA al guardar registro de auditoría de ${record.eventType}`, error);
      ObservabilityService.trackRecoverableError();
      return false;
    }
  }
}

export const AuditEngine = new AuditEngineClass();
