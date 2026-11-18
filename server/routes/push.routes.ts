import { Router, Request, Response } from 'express';
import { requireSession, SessionRequest } from '../middlewares/session.middleware';
import { PushService } from '../services/push.service';
import { HttpError } from '../services/http-error';

const router = Router();

const uid = (req: Request) => (req as SessionRequest).session?.sub || '';

const handle = (fn: (req: Request) => Promise<unknown>, okStatus = 200) => async (req: Request, res: Response) => {
  try {
    const data = await fn(req);
    res.status(okStatus).json({ success: true, ...(data && typeof data === 'object' ? data : {}) });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.statusCode).json({ success: false, message: err.message });
    console.error('[PUSH] Error inesperado:', err);
    res.status(500).json({ success: false, message: 'Error del servidor. Intenta de nuevo.' });
  }
};

// Pública: el navegador la necesita antes de iniciar sesión para armar la suscripción.
router.get('/vapid-public-key', (_req, res) => {
  res.status(200).json({ success: true, publicKey: PushService.publicKey() });
});

router.use(requireSession);

router.post('/subscribe', handle(async (req) => {
  await PushService.subscribe(uid(req), req.body?.subscription);
}));

router.post('/unsubscribe', handle(async (req) => {
  await PushService.unsubscribe(req.body?.endpoint);
}));

export default router;
