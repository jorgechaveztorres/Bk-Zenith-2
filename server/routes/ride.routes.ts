import { Router, Request, Response } from 'express';
import { requireSession, requireAppRole, SessionRequest } from '../middlewares/session.middleware';
import { RideService } from '../services/ride.service';
import { DriverService } from '../services/driver.service';
import { HttpError } from '../services/http-error';
import type { ServerQuoteResult } from '../services/pricing.service';

const router = Router();
router.use(requireSession);

const uid = (req: Request) => (req as SessionRequest).session?.sub || '';
const isAdmin = (req: Request) => (req as SessionRequest).session?.adm === true;

const handle = (fn: (req: Request) => Promise<unknown>, okStatus = 200) => async (req: Request, res: Response) => {
  try {
    const data = await fn(req);
    res.status(okStatus).json({ success: true, ...(data && typeof data === 'object' ? data : {}) });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.statusCode).json({ success: false, message: err.message });
    console.error('[RIDES] Error inesperado:', err);
    res.status(500).json({ success: false, message: 'Error del servidor. Intenta de nuevo.' });
  }
};

// ---------------------------------------------------------------- Cliente
router.post('/request', requireAppRole(['passenger', 'driver']), handle(async (req) => {
  const r = await RideService.requestRide({
    quote: req.body?.quote as ServerQuoteResult,
    passengerId: uid(req),
    paymentMethod: req.body?.paymentMethod,
    idempotencyKey: req.body?.idempotencyKey,
    delivery: req.body?.delivery,
  });
  return { ride: r.ride, otpCode: r.otpCode, idempotent: r.idempotent };
}, 201));

router.get('/active', handle(async (req) => ({ ride: await RideService.getActiveRide(uid(req)) })));

// ---------------------------------------------------------------- Motorizado
router.post('/driver/presence', requireAppRole(['driver']), handle((req) => DriverService.updatePresence(uid(req), {
  lat: req.body?.lat, lng: req.body?.lng, online: req.body?.online, heading: req.body?.heading, speedKmh: req.body?.speedKmh,
})));

router.get('/driver/offer', requireAppRole(['driver']), handle(async (req) => ({ offer: await DriverService.getCurrentOffer(uid(req)) })));

router.post('/driver/offers/:assignmentId/accept', requireAppRole(['driver']), handle(async (req) => ({
  ride: await RideService.acceptOffer(req.params.assignmentId, uid(req)),
})));

router.post('/driver/offers/:assignmentId/reject', requireAppRole(['driver']), handle(async (req) => {
  await RideService.rejectOffer(req.params.assignmentId, uid(req));
  return {};
}));

router.post('/:rideId/status', requireAppRole(['driver']), handle(async (req) => ({
  ride: await RideService.updateStatus(req.params.rideId, uid(req), String(req.body?.status || '')),
})));

router.post('/:rideId/verify-otp', requireAppRole(['driver']), handle(async (req) => ({
  ride: await RideService.verifyOtp(req.params.rideId, uid(req), req.body?.code),
})));

// ---------------------------------------------------------------- Ambos
router.get('/:rideId', handle(async (req) => ({ ride: await RideService.getRide(req.params.rideId, uid(req), isAdmin(req)) })));

router.post('/:rideId/cancel', handle(async (req) => ({
  ride: await RideService.cancelRide(req.params.rideId, uid(req), req.body?.reason),
})));

export default router;
