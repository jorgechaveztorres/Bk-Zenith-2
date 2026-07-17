import { NotificationEngine, InAppNotificationData } from './NotificationEngine';
import { LoggingService } from './LoggingService';

export const createNotification = async (
  userId: string,
  title: string,
  message: string,
  type: 'info' | 'success' | 'alert' | 'promo' = 'info'
) => {
  await NotificationEngine.sendInAppNotification({
    userId,
    title,
    message,
    type
  });
};

export const NotificationService = {
  send: createNotification,

  /**
   * Notificación cuando el conductor acepta/toma el viaje solicitado por tarifa protegida
   */
  notifyRideAccepted: async (passengerId: string, driverId: string, passengerName: string, driverName: string, fare: number) => {
    LoggingService.info('NOTIFICATION_SERVICE', `Notificando aceptación de viaje por tarifa protegida ($${fare})`);
    
    await createNotification(
      passengerId,
      'Operador Asignado',
      `El operador ${driverName} ha confirmado el servicio asignado por un monto de $${fare}.`,
      'success'
    );
    await createNotification(
      driverId,
      'Servicio Asignado',
      `Se le ha asignado el servicio para el cliente ${passengerName} por un monto de $${fare}.`,
      'success'
    );
  },

  /**
   * Notificación cuando el viaje es cancelado por cualquiera de las partes
   */
  notifyRideCancelled: async (passengerId: string, driverId: string | undefined, cancelledByRole: string) => {
    const side = cancelledByRole === 'passenger' ? 'El cliente' : 'El operador';
    const msg = `${side} ha cancelado la solicitud operativa del viaje.`;
    
    await createNotification(passengerId, 'Servicio Cancelado', msg, 'alert');
    if (driverId) {
      await createNotification(driverId, 'Servicio Cancelado', msg, 'alert');
    }
  },

  /**
   * Notificación cuando el conductor llega al punto de inicio
   */
  notifyDriverArrived: async (passengerId: string, driverName: string) => {
    await createNotification(
      passengerId,
      'Conductor en Ubicación',
      `El operador ${driverName} ha llegado al punto de partida acordado.`,
      'success'
    );
  },

  /**
   * Notificación de inicio de tránsito
   */
  notifyRideStarted: async (passengerId: string) => {
    await createNotification(
      passengerId,
      'Viaje Iniciado',
      'Protocolo de tránsito activo. Las coordenadas GPS se están transmitiendo en tiempo real.',
      'info'
    );
  },

  /**
   * Notificación de finalización de viaje
   */
  notifyRideCompleted: async (passengerId: string, driverId: string, fare: number) => {
    await createNotification(
      passengerId,
      'Viaje Finalizado',
      'Ha llegado a su destino con éxito. Por favor proceda a calificar su experiencia.',
      'success'
    );
    await createNotification(
      driverId,
      'Servicio Completado',
      `Viaje completado con éxito. Se han acreditado $${fare} a su billetera digital.`,
      'success'
    );
  },

  /**
   * Notificación de calificación recibida
   */
  notifyRatingReceived: async (userId: string, rating: number, role: string) => {
    const userRoleText = role === 'driver' ? 'del cliente' : 'del operador';
    await createNotification(
      userId,
      'Calificación Recibida',
      `Has recibido una calificación de ${rating.toFixed(1)} estrellas ${userRoleText}.`,
      'success'
    );
  },

  /**
   * Notificaciones promocionales / institucionales
   */
  notifyPromotion: async (userId: string, title: string, description: string) => {
    await createNotification(userId, title, description, 'promo');
  }
};
