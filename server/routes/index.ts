import { Router } from 'express';
import rideRoutes from './ride.routes';
import walletRoutes from './wallet.routes';
import topupRoutes from './topup.routes';
import pricingRoutes from './pricing.routes';
import authRoutes from './auth.routes';
import geoRoutes from './geo.routes';
import restaurantRoutes from './restaurants.routes';
import adminRoutes from './admin.routes';
import driverDocumentsRoutes from './driver-documents.routes';
import pushRoutes from './push.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/rides', rideRoutes);
router.use('/wallet', walletRoutes);
router.use('/topups', topupRoutes);
router.use('/pricing', pricingRoutes);
router.use('/geo', geoRoutes);
router.use('/restaurants', restaurantRoutes);
router.use('/admin', adminRoutes);
router.use('/driver', driverDocumentsRoutes);
router.use('/push', pushRoutes);

export default router;
