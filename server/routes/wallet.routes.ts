import { Router, Request, Response } from 'express';
import { requireSession, requireAppRole, SessionRequest } from '../middlewares/session.middleware';
import { WalletService } from '../services/wallet.service';
import { HttpError } from '../services/http-error';

const router = Router();
router.use(requireSession);
router.use(requireAppRole(['driver']));

const uid = (req: Request) => (req as SessionRequest).session?.sub || '';

const handle = (fn: (req: Request) => Promise<unknown>, okStatus = 200) => async (req: Request, res: Response) => {
  try {
    const data = await fn(req);
    res.status(okStatus).json({ success: true, ...(data && typeof data === 'object' ? data : {}) });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.statusCode).json({ success: false, message: err.message });
    console.error('[WALLET] Error inesperado:', err);
    res.status(500).json({ success: false, message: 'Error del servidor. Intenta de nuevo.' });
  }
};

router.get('/me', handle(async (req) => ({ wallet: await WalletService.getOrCreateWallet(uid(req)) })));
router.get('/movements', handle(async (req) => ({ movements: await WalletService.getMovements(uid(req)) })));

export default router;
