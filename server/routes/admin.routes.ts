import { Router, Request, Response } from 'express';
import { requireSession, requireAppRole, SessionRequest } from '../middlewares/session.middleware';
import { AdminService, DriverReviewStatus } from '../services/admin.service';
import { HttpError } from '../services/http-error';

const router = Router();
router.use(requireSession);
router.use(requireAppRole(['admin']));

const uid = (req: Request) => (req as SessionRequest).session?.sub || '';

const handle = (fn: (req: Request) => Promise<unknown>, okStatus = 200) => async (req: Request, res: Response) => {
  try {
    const data = await fn(req);
    res.status(okStatus).json({ success: true, ...(data && typeof data === 'object' ? data : {}) });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.statusCode).json({ success: false, message: err.message });
    console.error('[ADMIN] Error inesperado:', err);
    res.status(500).json({ success: false, message: 'Error del servidor. Intenta de nuevo.' });
  }
};

const VALID_STATUS: DriverReviewStatus[] = ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'];

router.get('/drivers', handle(async (req) => {
  const status = typeof req.query.status === 'string' && VALID_STATUS.includes(req.query.status as DriverReviewStatus)
    ? (req.query.status as DriverReviewStatus) : undefined;
  return { drivers: await AdminService.listDrivers(status) };
}));

router.post('/drivers/:id/approve', handle(async (req) => ({
  driver: await AdminService.approve(req.params.id, uid(req)),
})));

router.post('/drivers/:id/reject', handle(async (req) => ({
  driver: await AdminService.reject(req.params.id, uid(req), String(req.body?.reason || '')),
})));

export default router;
