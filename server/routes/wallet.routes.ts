import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { walletController } from '../controllers/wallet.controller';
import rateLimit from 'express-rate-limit';

const router = Router();

const financialRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Demasiadas solicitudes financieras, por favor intente más tarde.' }
});

router.post('/getOrCreate', requireAuth, walletController.getOrCreateWallet);
router.post('/deposit', requireAuth, financialRateLimiter, walletController.depositFunds);
router.post('/withdraw', requireAuth, financialRateLimiter, walletController.withdrawFunds);

export default router;
