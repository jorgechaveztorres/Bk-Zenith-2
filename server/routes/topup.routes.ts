// ============================================================================
// ZÉNITH
// Module : Financial / Topup Routes (Pilot V1 - Yape Personal)
// Layer  : Infrastructure / Routes
// File   : topup.routes.ts
// ============================================================================

import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { topupController } from '../controllers/topup.controller';
import rateLimit from 'express-rate-limit';

const router = Router();

const topupRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, message: 'Demasiadas solicitudes de recarga. Intente nuevamente en unos minutos.' }
});

// Rutas del motorizado
router.post('/request', requireAuth, topupRateLimiter, topupController.createRequest);
router.post('/receipt', requireAuth, topupRateLimiter, topupController.submitReceipt);
router.get('/status/:topupId', requireAuth, topupController.getStatus);
router.get('/my-history', requireAuth, topupController.getMyHistory);

// Rutas del operador / conciliación
router.get('/pending', requireAuth, topupController.getPending);
router.post('/reconcile', requireAuth, topupController.reconcile);
router.post('/approve-review', requireAuth, topupController.approveReview);
router.post('/reject', requireAuth, topupController.reject);
router.post('/credit', requireAuth, topupController.credit);

export default router;
