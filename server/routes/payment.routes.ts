import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { processPayment } from '../controllers/payment.controller';

const router = Router();

// Zénith Enterprise: Zero-Trust. All requests must be authenticated via JWT.
router.post('/process', requireAuth, processPayment);

export default router;
