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

// Rutas de operación financiera: requieren rol administrativo.
// La autorización se valida contra Custom Claims o el perfil server-side en Firestore.
const requireFinancialOperator = [requireAuth, requireRole(['admin'])];

router.get('/pending', ...requireFinancialOperator, topupController.getPending);
router.post('/reconcile', ...requireFinancialOperator, topupController.reconcile);
router.post('/approve-review', ...requireFinancialOperator, topupController.approveReview);
router.post('/reject', ...requireFinancialOperator, topupController.reject);
router.post('/credit', ...requireFinancialOperator, topupController.credit);

export default router;
