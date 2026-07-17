import { LoggingService } from './LoggingService';
import { db } from '../firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ObservabilityService } from './ObservabilityService';

export interface InAppNotificationData {
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'alert' | 'promo';
}

export interface INotificationEngine {
  sendInAppNotification(data: InAppNotificationData): Promise<boolean>;
  sendSMSPush(phoneNumber: string, message: string): Promise<boolean>;
}

export class NotificationEngineClass implements INotificationEngine {
  
  /**
   * Envía una notificación en tiempo real guardándola en la subcolección del usuario en Firestore.
   */
  async sendInAppNotification(data: InAppNotificationData): Promise<boolean> {
    if (!data.userId) {
      LoggingService.warn('NOTIFICATION_ENGINE', 'Intento de enviar notificación sin userId válido.');
      return false;
    }

    try {
      LoggingService.info('NOTIFICATION_ENGINE', `Despachando notificación [${data.type}] para el usuario ${data.userId}`);

      const notifRef = collection(db, 'users', data.userId, 'notifications');
      await addDoc(notifRef, {
        title: data.title,
        message: data.message,
        type: data.type,
        read: false,
        createdAt: serverTimestamp()
      });

      // Rastrear escritura en la telemetría
      ObservabilityService.trackFirestoreWrite();
      LoggingService.info('NOTIFICATION_ENGINE', `Notificación guardada en Firestore para usuario: ${data.userId}`);
      return true;
    } catch (error) {
      LoggingService.error('NOTIFICATION_ENGINE', `Error al enviar notificación en la app a ${data.userId}`, error);
      ObservabilityService.trackRecoverableError();
      return false;
    }
  }

  /**
   * Despacha un mensaje de texto SMS o de inserción mediante pasarela externa (decoupled).
   */
  async sendSMSPush(phoneNumber: string, message: string): Promise<boolean> {
    try {
      LoggingService.info('NOTIFICATION_ENGINE', `Enviando SMS de sistema a ${phoneNumber}`);
      
      // Simulación de llamada a API segura de mensajería (p. ej. Twilio o Firebase Cloud Messaging)
      const mockApiDelay = new Promise(resolve => setTimeout(resolve, 200));
      await mockApiDelay;

      LoggingService.info('NOTIFICATION_ENGINE', `SMS despachado con éxito a ${phoneNumber}: "${message}"`);
      return true;
    } catch (error) {
      LoggingService.error('NOTIFICATION_ENGINE', `Error al despachar SMS de sistema a ${phoneNumber}`, error);
      return false;
    }
  }
}

export const NotificationEngine = new NotificationEngineClass();
