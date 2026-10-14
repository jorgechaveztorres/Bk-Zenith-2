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

// Rutas del motorizado
router.post('/request', requireAuth, topupRateLimiter, topupController.createRequest);
router.post('/receipt', requireAuth, topupRateLimiter, topupController.submitReceipt);
router.get('/status/:topupId', requireAuth, topupController.getStatus);
router.get('/my-history', requireAuth, topupController.getMyHistory);

// Rutas financieras: autenticación y rol administrativo explícitos en cada ruta.
router.get('/pending', requireAuth, requireRole(['admin']), topupController.getPending);
router.post('/reconcile', requireAuth, requireRole(['admin']), topupController.reconcile);
router.post('/approve-review', requireAuth, requireRole(['admin']), topupController.approveReview);
router.post('/reject', requireAuth, requireRole(['admin']), topupController.reject);
router.post('/credit', requireAuth, requireRole(['admin']), topupController.credit);

export default router;
