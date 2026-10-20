// ============================================================================
// ZÉNITH
// Module : Financial / Topup Routes (Pilot V1 - Yape Personal)
// Layer  : Infrastructure / Routes
// File   : topup.routes.ts
// ============================================================================

import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { topupController } from '../controllers/topup.controller';
import rateLimit from 'express-rate-limit';

const router = Router();

const topupRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, message: 'Demasiadas solicitudes de recarga. Intente nuevamente en unos minutos.' }
});

// Rutas de usuario autenticado. El backend deriva el UID del token verificado.
router.post('/request', requireAuth, topupRateLimiter, topupController.createRequest);
router.post('/receipt', requireAuth, topupRateLimiter, topupController.submitReceipt);
router.get('/status/:topupId', requireAuth, topupController.getStatus);
router.get('/my-history', requireAuth, topupController.getMyHistory);

// Operaciones financieras privilegiadas: autenticación Y autorización administrativa obligatorias.
const requireFinanceAdmin = [requireAuth, requireRole(['admin'])] as const;
router.get('/pending', ...requireFinanceAdmin, topupController.getPending);
router.post('/reconcile', ...requireFinanceAdmin, topupController.reconcile);
router.post('/approve-review', ...requireFinanceAdmin, topupController.approveReview);
router.post('/reject', ...requireFinanceAdmin, topupController.reject);
router.post('/credit', ...requireFinanceAdmin, topupController.credit);

export default router;
