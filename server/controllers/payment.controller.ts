import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { PaymentService } from '../services/payment.service';

export const processPayment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { rideId, passengerId, driverId, amount, details } = req.body;
    const userId = req.user!.uid; // Guaranteed by requireAuth

    // Zero-Trust Validation: Prevent ID spoofing
    // A user can only process payments where they are the passenger (or driver if handling cash).
    // In most cases, the passenger pays.
    if (userId !== passengerId && userId !== driverId) {
      return res.status(403).json({ success: false, message: 'Operación denegada. El usuario no participa en este viaje.' });
    }

    // Input validation
    if (!rideId || !amount || !details) {
      return res.status(400).json({ success: false, message: 'Faltan parámetros obligatorios.' });
    }

    const result = await PaymentService.process(rideId, passengerId, driverId, amount, details);
    
    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    console.error('[PAYMENT_CONTROLLER] Error procesando pago:', error.message);
    return res.status(500).json({ success: false, message: error.message || 'Error interno del servidor.' });
  }
};
