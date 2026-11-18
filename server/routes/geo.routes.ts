import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { requireSession } from '../middlewares/session.middleware';
import { searchAddress, reverseGeocode } from '../services/geocode.service';
import { HttpError } from '../services/http-error';

const router = Router();
router.use(requireSession);
router.use(rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas búsquedas. Espera un momento.' },
}));

const handle = (fn: (req: Request) => Promise<unknown>) => async (req: Request, res: Response) => {
  try {
    res.json({ success: true, ...(await fn(req) as object) });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.statusCode).json({ success: false, message: err.message });
    console.error('[GEO] Error inesperado:', err);
    res.status(500).json({ success: false, message: 'Error del servidor. Intenta de nuevo.' });
  }
};

/** GET /api/geo/search?q=av españa 123 */
router.get('/search', handle(async (req) => ({ results: await searchAddress(req.query.q) })));

/** GET /api/geo/reverse?lat=-8.11&lng=-79.02 */
router.get('/reverse', handle(async (req) => ({ place: await reverseGeocode(req.query.lat, req.query.lng) })));

export default router;
