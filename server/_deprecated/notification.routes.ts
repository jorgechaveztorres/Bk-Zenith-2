import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth.middleware';
import { db } from '../config/firebase';

const router = Router();

const ACTIVE_RIDE_STATUSES = [
  'DRIVER_ASSIGNED',
  'DRIVER_ARRIVING',
  'WAITING_FOR_OTP',
  'IN_PROGRESS',
  'ACCEPTED',
  'ARRIVED',
  'ASIGNADO',
  'ACTIVO'
];

/**
 * POST /api/notifications/send
 * Despacha notificaciones con server-authority, validando actor, destinatario y relación en rides.
 */
router.post('/send', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { recipientUserId, title, message, type, rideId } = req.body;

    // 1. Validación de campos obligatorios
    if (!recipientUserId || !title || !message || !type) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos obligatorios: recipientUserId, title, message y type son requeridos.'
      });
    }

    // 2. Validación de tipo exclusivo
    const allowedTypes = ['info', 'success', 'alert', 'promo'];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de notificación inválido. Tipos permitidos: info, success, alert, promo.'
      });
    }

    // 3. Límites de longitud
    if (typeof title !== 'string' || title.length > 120) {
      return res.status(400).json({
        success: false,
        message: 'El título no debe exceder los 120 caracteres.'
      });
    }

    if (typeof message !== 'string' || message.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'El mensaje no debe exceder los 500 caracteres.'
      });
    }

    const callerUid = req.user?.uid;
    if (!callerUid) {
      return res.status(401).json({
        success: false,
        message: 'No autenticado.'
      });
    }

    // 4. Autorización de notificaciones
    const isSelf = recipientUserId === callerUid;
    const isAdmin = req.user?.role === 'admin';

    if (!isSelf && !isAdmin) {
      // Caso C: Usuario -> Contraparte de ride (rideId es obligatorio)
      if (!rideId) {
        return res.status(403).json({
          success: false,
          message: 'No tiene autorización para enviar notificaciones a este usuario fuera de un servicio activo.'
        });
      }

      if (!db) {
        return res.status(500).json({
          success: false,
          message: 'Base de datos no disponible.'
        });
      }

      const rideDoc = await db.collection('rides').doc(rideId).get();
      if (!rideDoc.exists) {
        return res.status(403).json({
          success: false,
          message: 'No tiene autorización para enviar notificaciones a este usuario fuera de un servicio activo.'
        });
      }

      const rideData = rideDoc.data();

      // Comprobar que el viaje se encuentra en un estado operacional activo
      if (!rideData?.status || !ACTIVE_RIDE_STATUSES.includes(rideData.status)) {
        return res.status(403).json({
          success: false,
          message: 'No tiene autorización para enviar notificaciones a este usuario fuera de un servicio activo.'
        });
      }

      const isPassengerToDriver = rideData.passengerId === callerUid && rideData.driverId === recipientUserId;
      const isDriverToPassenger = rideData.driverId === callerUid && rideData.passengerId === recipientUserId;

      if (!isPassengerToDriver && !isDriverToPassenger) {
        return res.status(403).json({
          success: false,
          message: 'No tiene autorización para enviar notificaciones a este usuario fuera de un servicio activo.'
        });
      }
    }

    if (!db) {
      return res.status(500).json({
        success: false,
        message: 'Base de datos no disponible.'
      });
    }

    // 5. Persistencia mediante Firebase Admin SDK con datos gobernados por el servidor
    const docRef = await db
      .collection('users')
      .doc(recipientUserId)
      .collection('notifications')
      .add({
        title,
        message,
        type,
        ...(rideId ? { rideId } : {}),
        senderUid: callerUid,
        read: false,
        createdAt: new Date().toISOString(),
        serverVerified: true
      });

    return res.status(200).json({
      success: true,
      notificationId: docRef.id
    });
  } catch (error: any) {
    console.error('[NOTIFICATION_ROUTES] Error al despachar notificación:', error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'Error interno del servidor al procesar la notificación.'
    });
  }
});

export default router;
