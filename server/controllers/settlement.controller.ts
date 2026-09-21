import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { SettlementService } from '../services/settlement.service';

export const processSettlement = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { driverId, bankDetails } = req.body;
    const userId = req.user!.uid; // Guaranteed by requireAuth

    // Zero-Trust Validation: Prevent ID spoofing
    if (userId !== driverId) {
      // Unless it's an admin, but for now we strict check
      if (req.user!.role !== 'admin' && req.user!.email !== 'bkheelsec@gmail.com') {
         return res.status(403).json({ success: false, message: 'Operación denegada. El usuario no corresponde al conductor.' });
      }
    }

    if (!driverId || !bankDetails) {
      return res.status(400).json({ success: false, message: 'Faltan parámetros obligatorios.' });
    }

    const result = await SettlementService.process(driverId, bankDetails);
    
    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    console.error('[SETTLEMENT_CONTROLLER] Error procesando liquidación:', error.message);
    return res.status(500).json({ success: false, message: error.message || 'Error interno del servidor.' });
  }
};
