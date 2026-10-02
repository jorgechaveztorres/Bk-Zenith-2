import { LoggingService } from './LoggingService';
import { auth } from '../firebase/config';
import { ObservabilityService } from './ObservabilityService';

export interface InAppNotificationData {
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'alert' | 'promo';
  rideId?: string;
}

export interface INotificationEngine {
  sendInAppNotification(data: InAppNotificationData): Promise<boolean>;
  sendSMSPush(phoneNumber: string, message: string): Promise<boolean>;
}

export class NotificationEngineClass implements INotificationEngine {
  
  /**
   * Envía una notificación en tiempo real despachándola a través del backend seguro con Server-Authority.
   */
  async sendInAppNotification(data: InAppNotificationData): Promise<boolean> {
    if (!data.userId) {
      LoggingService.warn('NOTIFICATION_ENGINE', 'Intento de enviar notificación sin userId válido.');
      return false;
    }

    const user = auth.currentUser;
    if (!user) {
      LoggingService.warn('NOTIFICATION_ENGINE', 'Intento de enviar notificación sin sesión autenticada activa.');
      return false;
    }

    try {
      LoggingService.info('NOTIFICATION_ENGINE', `Despachando notificación [${data.type}] para el usuario ${data.userId} vía Backend`);

      const idToken = await user.getIdToken();

      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          recipientUserId: data.userId,
          title: data.title,
          message: data.message,
          type: data.type,
          rideId: data.rideId
        })
      });

      if (!response.ok) {
        const errPayload = await response.json().catch(() => ({}));
        throw new Error(errPayload.message || `Fallo al despachar notificación en backend (HTTP ${response.status})`);
      }

      // Rastrear escritura en la telemetría
      ObservabilityService.trackFirestoreWrite();
      LoggingService.info('NOTIFICATION_ENGINE', `Notificación despachada con éxito vía backend para usuario: ${data.userId}`);
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
