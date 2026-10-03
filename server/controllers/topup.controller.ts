// ============================================================================
// ZÉNITH
// Module : Financial / Topup Controller (Pilot V1 - Yape Personal)
// Layer  : Presentation / Controller
// File   : topup.controller.ts
// ============================================================================

import { Request, Response } from 'express';
import { TopupService } from '../services/topup.service';
import { db } from '../config/firebase';

export const topupController = {
  /**
   * POST /api/topups/request
   * Motorizado solicita recarga.
   * Regla de Seguridad: driverId se deriva EXCLUSIVAMENTE del token JWT de Firebase.
   */
  createRequest: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user || !user.uid) {
        return res.status(401).json({ success: false, message: 'Usuario no autenticado.' });
      }

      const { amount } = req.body;
      const requestedAmount = Number(amount);

      if (isNaN(requestedAmount) || requestedAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'El monto de recarga debe ser un número positivo mayor a S/ 0.00.'
        });
      }

      // Obtener nombre y teléfono del usuario desde Firestore
      let driverName = 'Conductor ZÉNITH';
      let driverPhone = '';
      if (db) {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
          const uData = userDoc.data();
          driverName = uData?.fullName || uData?.name || driverName;
          driverPhone = uData?.phone || driverPhone;
        }
      }

      const topup = await TopupService.createTopupRequest(user.uid, requestedAmount, {
        name: driverName,
        phone: driverPhone
      });

      return res.status(201).json({
        success: true,
        topup
      });
    } catch (error: any) {
      console.error('[TOPUP_CONTROLLER] Error creando solicitud de recarga:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  /**
   * POST /api/topups/receipt
   * Motorizado adjunta captura de pantalla del Yape.
   */
  submitReceipt: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user || !user.uid) {
        return res.status(401).json({ success: false, message: 'Usuario no autenticado.' });
      }

      const { topupId, receiptBase64, receiptUrl } = req.body;
      if (!topupId || (!receiptBase64 && !receiptUrl)) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere topupId y la captura en base64 o URL.'
        });
      }

      const updated = await TopupService.submitReceiptAndAnalyze(
        topupId,
        user.uid,
        receiptBase64 || receiptUrl,
        receiptUrl
      );

      return res.json({
        success: true,
        topup: updated
      });
    } catch (error: any) {
      console.error('[TOPUP_CONTROLLER] Error enviando comprobante:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  /**
   * GET /api/topups/status/:topupId
   * Consulta el estado de una recarga.
   */
  getStatus: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { topupId } = req.params;

      const topup = await TopupService.getTopupById(topupId);
      if (!topup) {
        return res.status(404).json({ success: false, message: 'Recarga no encontrada.' });
      }

      // Verificación de propiedad (el motorizado solo puede consultar las suyas, admin puede ver todas)
      if (topup.driverId !== user.uid && user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acceso denegado a esta recarga.' });
      }

      return res.json({ success: true, topup });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  /**
   * GET /api/topups/my-history
   * Obtiene las solicitudes de recarga del motorizado autenticado.
   */
  getMyHistory: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const history = await TopupService.getDriverTopupHistory(user.uid);
      return res.json({ success: true, history });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  /**
   * POST /api/topups/reconcile
   * El operador confirma el movimiento real en el Yape receptor y ejecuta conciliación de 3 vías.
   */
  reconcile: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { topupId, bankMovement } = req.body;

      if (!topupId) {
        return res.status(400).json({ success: false, message: 'Se requiere topupId.' });
      }

      const operatorId = user?.uid || 'OPERATOR_DESK';
      const reconciled = await TopupService.reconcileTopup(topupId, bankMovement || null, operatorId);

      return res.json({
        success: true,
        topup: reconciled
      });
    } catch (error: any) {
      console.error('[TOPUP_CONTROLLER] Error en conciliación:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  /**
   * POST /api/topups/approve-review
   * El operador aprueba manualmente una recarga que cayó en REVIEW tras validación humana.
   */
  approveReview: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { topupId, notes } = req.body;

      if (!topupId) {
        return res.status(400).json({ success: false, message: 'Se requiere topupId.' });
      }

      const operatorId = user?.uid || 'OPERATOR_DESK';
      const approved = await TopupService.approveReviewTopup(topupId, operatorId, notes || 'Aprobado manualmente.');

      return res.json({
        success: true,
        topup: approved
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  /**
   * POST /api/topups/credit
   * Ejecuta la acreditación atómica de una recarga en estado VERIFIED.
   */
  credit: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { topupId } = req.body;

      if (!topupId) {
        return res.status(400).json({ success: false, message: 'Se requiere topupId.' });
      }

      const operatorId = user?.uid || 'OPERATOR_DESK';
      const result = await TopupService.creditTopup(topupId, operatorId);

      return res.json({
        success: true,
        result
      });
    } catch (error: any) {
      console.error('[TOPUP_CONTROLLER] Error en acreditación atómica:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  /**
   * GET /api/topups/pending
   * Lista de solicitudes pendientes para revisión del operador humano.
   */
  getPending: async (req: Request, res: Response) => {
    try {
      const list = await TopupService.getPendingTopups();
      return res.json({ success: true, topups: list });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  /**
   * POST /api/topups/reject
   * El operador humano rechaza explícitamente una solicitud con motivo.
   */
  reject: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { topupId, reason } = req.body;
      if (!topupId) {
        return res.status(400).json({ success: false, message: 'Se requiere topupId.' });
      }

      const operatorId = user?.uid || 'OPERATOR_DESK';
      const rejected = await TopupService.rejectTopup(topupId, operatorId, reason || 'Rechazado por operador.');
      return res.json({ success: true, topup: rejected });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
};
