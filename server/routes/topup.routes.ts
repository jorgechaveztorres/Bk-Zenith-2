import { Router, Request, Response } from 'express';
import { requireSession, requireAppRole, SessionRequest } from '../middlewares/session.middleware';
import { TopupService, TopupStatus } from '../services/topup.service';
import { HttpError } from '../services/http-error';

const router = Router();
router.use(requireSession);

const uid = (req: Request) => (req as SessionRequest).session?.sub || '';

const handle = (fn: (req: Request) => Promise<unknown>, okStatus = 200) => async (req: Request, res: Response) => {
  try {
    const data = await fn(req);
    res.status(okStatus).json({ success: true, ...(data && typeof data === 'object' ? data : {}) });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.statusCode).json({ success: false, message: err.message });
    console.error('[TOPUP] Error inesperado:', err);
    res.status(500).json({ success: false, message: 'Error del servidor. Intenta de nuevo.' });
  }
};

const VALID_STATUS: TopupStatus[] = ['RECEIPT_SUBMITTED', 'REJECTED', 'CREDITED'];

// --------------------------------------------------- Rutas del motorizado
router.post('/', requireAppRole(['driver']), handle(async (req) => ({
  topup: await TopupService.createRequest(uid(req), req.body?.amount, req.body?.operationNumber),
}), 201));

router.get('/mine', requireAppRole(['driver']), handle(async (req) => ({
  topups: await TopupService.myHistory(uid(req)),
})));

// --------------------------------------------------------- Rutas del admin
router.get('/', requireAppRole(['admin']), handle(async (req) => {
  const status = typeof req.query.status === 'string' && VALID_STATUS.includes(req.query.status as TopupStatus)
    ? (req.query.status as TopupStatus) : undefined;
  return { topups: await TopupService.list(status) };
}));

router.post('/:id/credit', requireAppRole(['admin']), handle(async (req) => ({
  topup: await TopupService.credit(req.params.id, uid(req)),
})));

router.post('/:id/reject', requireAppRole(['admin']), handle(async (req) => ({
  topup: await TopupService.reject(req.params.id, uid(req), String(req.body?.reason || '')),
})));

export default router;
