import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import * as rideController from '../controllers/ride.controller';

const router = Router();

router.post('/request', requireAuth, rideController.requestRide);
router.post('/:rideId/accept', requireAuth, rideController.acceptRide);
router.post('/:rideId/cancel', requireAuth, rideController.cancelRide);
router.post('/:rideId/status', requireAuth, rideController.updateRideStatus);

export default router;
