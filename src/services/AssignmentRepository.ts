import { collection, doc, setDoc, updateDoc, serverTimestamp, getDoc, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { AuditRepository } from './AuditRepository';
import { NotificationService } from './NotificationService';

export type AssignmentStatus = 'OFFERED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';

export interface Assignment {
  assignmentId: string;
  rideId: string;
  driverId: string;
  dispatchScore: number;
  attemptNumber: number;
  assignedAt: any; // serverTimestamp()
  expiresAt: any; // serverTimestamp() + 15 seconds
  acceptedAt?: any;
  rejectedAt?: any;
  completedAt?: any;
  status: AssignmentStatus;
  auditId: string;
  notes?: string;
}

export interface DispatchLog {
  logId: string;
  rideId: string;
  driverId?: string;
  event: 'ASSIGNMENT_OFFERED' | 'ASSIGNMENT_ACCEPTED' | 'ASSIGNMENT_REJECTED' | 'ASSIGNMENT_EXPIRED' | 'ASSIGNMENT_CANCELLED' | 'NO_DRIVERS_AVAILABLE';
  attemptNumber: number;
  dispatchScore?: number;
  timestamp: any; // serverTimestamp()
  details?: string;
}

export class AssignmentRepository {
  private static assignmentsCollection = 'assignments';
  private static logsCollection = 'dispatch_logs';

  /**
   * Crea una nueva asignación de oferta de viaje en Firestore.
   */
  static async createAssignment(params: {
    rideId: string;
    driverId: string;
    dispatchScore: number;
    attemptNumber: number;
  }): Promise<Assignment> {
    const assignmentId = `ASG_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const auditId = `AUD_DS_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // Calculamos la fecha de expiración inmutable de 15 segundos en el cliente y guardamos marcas de tiempo seguras
    const now = new Date();
    const expiresAtDate = new Date(now.getTime() + 15 * 1000);

    const assignment: Assignment = {
      assignmentId,
      rideId: params.rideId,
      driverId: params.driverId,
      dispatchScore: params.dispatchScore,
      attemptNumber: params.attemptNumber,
      assignedAt: serverTimestamp(),
      expiresAt: expiresAtDate.toISOString(), // ISO String para comparación estricta de tiempo o timestamps
      status: 'OFFERED',
      auditId
    };

    // Grabamos la oferta en Firestore
    await setDoc(doc(db, this.assignmentsCollection, assignmentId), assignment);

    // Registramos la auditoría de inicio en dispatch_logs
    await this.logDispatchEvent({
      rideId: params.rideId,
      driverId: params.driverId,
      event: 'ASSIGNMENT_OFFERED',
      attemptNumber: params.attemptNumber,
      dispatchScore: params.dispatchScore,
      details: `Viaje asignado temporalmente con score de despacho: ${params.dispatchScore}`
    });

    // Despachamos una notificación Push de alta prioridad interna al conductor
    await NotificationService.send(
      params.driverId,
      '¡Nueva Oferta de Viaje Disponible!',
      `Tiene un viaje disponible para aceptación inmediata. Expira en 15 segundos.`,
      'info'
    );

    return assignment;
  }

  /**
   * Registra la aceptación oficial del conductor.
   */
  static async acceptAssignment(assignmentId: string): Promise<void> {
    const asgRef = doc(db, this.assignmentsCollection, assignmentId);
    const snap = await getDoc(asgRef);
    if (!snap.exists()) throw new Error('Asignación inexistente.');

    const asg = snap.data() as Assignment;
    if (asg.status !== 'OFFERED') {
      throw new Error(`Asignación inválida para aceptación. Estado actual: ${asg.status}`);
    }

    // Actualizamos la asignación a ACCEPTED
    await updateDoc(asgRef, {
      status: 'ACCEPTED',
      acceptedAt: serverTimestamp()
    });

    // Registramos en la auditoría inmutable
    await this.logDispatchEvent({
      rideId: asg.rideId,
      driverId: asg.driverId,
      event: 'ASSIGNMENT_ACCEPTED',
      attemptNumber: asg.attemptNumber,
      dispatchScore: asg.dispatchScore,
      details: 'El conductor aceptó la solicitud formalmente en el tiempo establecido.'
    });
  }

  /**
   * Registra el rechazo explícito del conductor.
   */
  static async rejectAssignment(assignmentId: string, notes?: string): Promise<void> {
    const asgRef = doc(db, this.assignmentsCollection, assignmentId);
    const snap = await getDoc(asgRef);
    if (!snap.exists()) return;

    const asg = snap.data() as Assignment;
    if (asg.status !== 'OFFERED') return;

    await updateDoc(asgRef, {
      status: 'REJECTED',
      rejectedAt: serverTimestamp(),
      notes: notes || 'Rechazo manual del operador'
    });

    await this.logDispatchEvent({
      rideId: asg.rideId,
      driverId: asg.driverId,
      event: 'ASSIGNMENT_REJECTED',
      attemptNumber: asg.attemptNumber,
      dispatchScore: asg.dispatchScore,
      details: `El conductor rechazó manualmente el viaje. Motivo: ${notes || 'N/A'}`
    });
  }

  /**
   * Registra la expiración automática (Timeout de 15 segundos sin responder).
   */
  static async expireAssignment(assignmentId: string): Promise<void> {
    const asgRef = doc(db, this.assignmentsCollection, assignmentId);
    const snap = await getDoc(asgRef);
    if (!snap.exists()) return;

    const asg = snap.data() as Assignment;
    if (asg.status !== 'OFFERED') return;

    await updateDoc(asgRef, {
      status: 'EXPIRED',
      notes: 'Expiración automática por temporizador (15s)'
    });

    await this.logDispatchEvent({
      rideId: asg.rideId,
      driverId: asg.driverId,
      event: 'ASSIGNMENT_EXPIRED',
      attemptNumber: asg.attemptNumber,
      dispatchScore: asg.dispatchScore,
      details: 'El temporizador de 15 segundos expiró sin acción por parte del operador.'
    });
  }

  /**
   * Registra la cancelación del viaje o asignación.
   */
  static async cancelAssignment(assignmentId: string, reason?: string): Promise<void> {
    const asgRef = doc(db, this.assignmentsCollection, assignmentId);
    const snap = await getDoc(asgRef);
    if (!snap.exists()) return;

    const asg = snap.data() as Assignment;
    await updateDoc(asgRef, {
      status: 'CANCELLED',
      notes: reason || 'Cancelado por el cliente o administración'
    });

    await this.logDispatchEvent({
      rideId: asg.rideId,
      driverId: asg.driverId,
      event: 'ASSIGNMENT_CANCELLED',
      attemptNumber: asg.attemptNumber,
      dispatchScore: asg.dispatchScore,
      details: `Asignación cancelada. Motivo: ${reason || 'N/D'}`
    });
  }

  /**
   * Registra un evento de auditoría de despacho en la colección dispatch_logs.
   */
  static async logDispatchEvent(params: {
    rideId: string;
    driverId?: string;
    event: DispatchLog['event'];
    attemptNumber: number;
    dispatchScore?: number;
    details?: string;
  }): Promise<void> {
    const logId = `LOG_DS_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const logData: DispatchLog = {
      logId,
      rideId: params.rideId,
      driverId: params.driverId || '',
      event: params.event,
      attemptNumber: params.attemptNumber,
      dispatchScore: params.dispatchScore || 0,
      timestamp: serverTimestamp(),
      details: params.details || ''
    };
    await setDoc(doc(db, this.logsCollection, logId), logData);
  }

  /**
   * Recupera el histórico de logs de despacho para un viaje específico de forma inmutable.
   */
  static async getDispatchLogsForRide(rideId: string): Promise<DispatchLog[]> {
    try {
      const q = query(
        collection(db, this.logsCollection),
        where('rideId', '==', rideId),
        orderBy('timestamp', 'asc')
      );
      const snapshot = await getDocs(q);
      const logs: DispatchLog[] = [];
      snapshot.forEach((doc) => {
        logs.push(doc.data() as DispatchLog);
      });
      return logs;
    } catch {
      // Fallback si falta algún índice de Firestore en sandbox
      const qFallback = query(collection(db, this.logsCollection), where('rideId', '==', rideId));
      const snapshot = await getDocs(qFallback);
      const logsFallback: DispatchLog[] = [];
      snapshot.forEach((doc) => {
        logsFallback.push(doc.data() as DispatchLog);
      });
      return logsFallback.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));
    }
  }
}
