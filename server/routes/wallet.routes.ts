import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { walletController } from '../controllers/wallet.controller';

const router = Router();


router.post('/getOrCreate', requireAuth, walletController.getOrCreateWallet);

export default router;
