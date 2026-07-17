import { doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { DocumentStatus, User } from '../types';
import { AuditRepository } from './AuditRepository';
import { NotificationService } from './NotificationService';
import { NotificationEngine } from './NotificationEngine';

export interface AdminActionInput {
  driverId: string;
  adminUid: string;
  adminEmail: string;
  comment: string;
  technicalObservations?: string;
}

export class DriverApprovalService {
  /**
   * Aprueba completamente la documentación de un conductor.
   */
  static async approveDriver(input: {
    driverId: string;
    adminUid: string;
    adminEmail: string;
    comment: string;
    technicalObservations?: string;
  }, currentStatus: DocumentStatus): Promise<void> {
    const userRef = doc(db, 'users', input.driverId);
    
    // Actualización de estado en Firestore bajo Zero-Trust
    await updateDoc(userRef, {
      'driverProfile.status': DocumentStatus.APPROVED,
      'driverProfile.updatedAt': serverTimestamp(),
      'onboardingComplete': true
    });

    // Auditoría inmutable de la acción
    await AuditRepository.logAction({
      driverId: input.driverId,
      adminUid: input.adminUid,
      adminEmail: input.adminEmail,
      action: 'APPROVE',
      previousStatus: currentStatus,
      newStatus: DocumentStatus.APPROVED,
      comment: input.comment || 'Aprobación exitosa de expediente',
      technicalObservations: input.technicalObservations || 'Toda la documentación cumple con los estándares Zenith Pro.'
    });

    // Despacho de notificaciones multicanal automáticas
    await NotificationService.send(
      input.driverId,
      'Documentación Aprobada',
      '¡Felicitaciones! Su documentación fue aprobada con éxito. Ya puede iniciar operaciones en la red de Zénith.',
      'success'
    );

    // Simular correo electrónico y notificación push
    await NotificationEngine.sendSMSPush(
      '+51900000000', // Conductor teléfono (simulado o de perfil)
      'ZÉNITH: Su documentación ha sido APROBADA. Bienvenido a la red.'
    );
  }

  /**
   * Rechaza la postulación del conductor con un motivo obligatorio.
   */
  static async rejectDriver(input: AdminActionInput, currentStatus: DocumentStatus): Promise<void> {
    if (!input.comment.trim()) {
      throw new Error('El comentario de rechazo es obligatorio y no puede estar vacío.');
    }

    const userRef = doc(db, 'users', input.driverId);
    await updateDoc(userRef, {
      'driverProfile.status': DocumentStatus.REJECTED,
      'driverProfile.updatedAt': serverTimestamp()
    });

    await AuditRepository.logAction({
      driverId: input.driverId,
      adminUid: input.adminUid,
      adminEmail: input.adminEmail,
      action: 'REJECT',
      previousStatus: currentStatus,
      newStatus: DocumentStatus.REJECTED,
      comment: input.comment,
      technicalObservations: input.technicalObservations || 'Revisión técnica fallida o datos inconsistentes.'
    });

    await NotificationService.send(
      input.driverId,
      'Documentación Rechazada',
      `Su documentación fue rechazada. Motivo: ${input.comment}`,
      'alert'
    );

    await NotificationEngine.sendSMSPush(
      '+51900000000',
      `ZÉNITH: Documentación rechazada. Motivo: ${input.comment}`
    );
  }

  /**
   * Solicita actualizar un documento o subsanar observaciones.
   */
  static async requestDocuments(input: AdminActionInput, currentStatus: DocumentStatus): Promise<void> {
    if (!input.comment.trim()) {
      throw new Error('El comentario de observaciones requeridas es obligatorio.');
    }

    const userRef = doc(db, 'users', input.driverId);
    // Cambiamos el estado a PENDING para que el onboarding de conductor se reactive
    await updateDoc(userRef, {
      'driverProfile.status': DocumentStatus.PENDING,
      'driverProfile.updatedAt': serverTimestamp()
    });

    await AuditRepository.logAction({
      driverId: input.driverId,
      adminUid: input.adminUid,
      adminEmail: input.adminEmail,
      action: 'REQUEST_DOCS',
      previousStatus: currentStatus,
      newStatus: DocumentStatus.PENDING,
      comment: input.comment,
      technicalObservations: input.technicalObservations || 'Se requiere reemplazo de capturas ilegibles.'
    });

    await NotificationService.send(
      input.driverId,
      'Subsanación de Documentos',
      `Debe actualizar su licencia o documentos pendientes. Detalle: ${input.comment}`,
      'info'
    );

    await NotificationEngine.sendSMSPush(
      '+51900000000',
      `ZÉNITH: Acción requerida. Actualice su documentación: ${input.comment}`
    );
  }

  /**
   * Suspende la cuenta del conductor.
   */
  static async suspendDriver(input: AdminActionInput, currentStatus: DocumentStatus): Promise<void> {
    if (!input.comment.trim()) {
      throw new Error('El comentario de suspensión es obligatorio.');
    }

    const userRef = doc(db, 'users', input.driverId);
    await updateDoc(userRef, {
      'driverProfile.status': DocumentStatus.SUSPENDED,
      'driverProfile.availability': false, // Forzar desconexión
      'driverProfile.updatedAt': serverTimestamp()
    });

    await AuditRepository.logAction({
      driverId: input.driverId,
      adminUid: input.adminUid,
      adminEmail: input.adminEmail,
      action: 'SUSPEND',
      previousStatus: currentStatus,
      newStatus: DocumentStatus.SUSPENDED,
      comment: input.comment,
      technicalObservations: input.technicalObservations || 'Suspensión temporal por infracción o bloqueo preventivo.'
    });

    await NotificationService.send(
      input.driverId,
      'Cuenta Suspendida',
      `Su cuenta fue suspendida por administración. Motivo: ${input.comment}`,
      'alert'
    );

    await NotificationEngine.sendSMSPush(
      '+51900000000',
      `ZÉNITH: Su cuenta ha sido suspendida. Motivo: ${input.comment}`
    );
  }

  /**
   * Reactiva a un conductor suspendido o rechazado.
   */
  static async reactivateDriver(input: AdminActionInput, currentStatus: DocumentStatus): Promise<void> {
    if (!input.comment.trim()) {
      throw new Error('El comentario de reactivación es obligatorio.');
    }

    const userRef = doc(db, 'users', input.driverId);
    await updateDoc(userRef, {
      'driverProfile.status': DocumentStatus.APPROVED,
      'driverProfile.updatedAt': serverTimestamp()
    });

    await AuditRepository.logAction({
      driverId: input.driverId,
      adminUid: input.adminUid,
      adminEmail: input.adminEmail,
      action: 'REACTIVATE',
      previousStatus: currentStatus,
      newStatus: DocumentStatus.APPROVED,
      comment: input.comment,
      technicalObservations: input.technicalObservations || 'Reactivación del operador tras cumplir sanción o rectificación.'
    });

    await NotificationService.send(
      input.driverId,
      'Cuenta Reactivada',
      'Su cuenta de operador ha sido reactivada. Ya puede volver a recibir viajes en el radar.',
      'success'
    );

    await NotificationEngine.sendSMSPush(
      '+51900000000',
      'ZÉNITH: Su cuenta ha sido reactivada. El radar vuelve a estar operativo.'
    );
  }

  /**
   * Elimina completamente el expediente del conductor de Firestore.
   */
  static async deleteDriverRecord(input: AdminActionInput, currentStatus: DocumentStatus): Promise<void> {
    if (!input.comment.trim()) {
      throw new Error('Debe especificar un motivo legal o comercial para eliminar el expediente.');
    }

    const userRef = doc(db, 'users', input.driverId);
    
    // Primero auditamos para mantener rastro antes de borrar la entidad
    await AuditRepository.logAction({
      driverId: input.driverId,
      adminUid: input.adminUid,
      adminEmail: input.adminEmail,
      action: 'DELETE_RECORD',
      previousStatus: currentStatus,
      newStatus: 'DELETED',
      comment: input.comment,
      technicalObservations: input.technicalObservations || 'Eliminación final de datos de conductor.'
    });

    // Eliminación segura de Firestore
    await deleteDoc(userRef);
  }
}
