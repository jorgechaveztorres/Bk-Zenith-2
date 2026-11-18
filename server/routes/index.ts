import { Router } from 'express';
import paymentRoutes from './payment.routes';
import settlementRoutes from './settlement.routes';
import rideRoutes from './ride.routes';
import walletRoutes from './wallet.routes';
import auditRoutes from './audit.routes';
import ledgerRoutes from './ledger.routes';
import topupRoutes from './topup.routes';
import notificationRoutes from './notification.routes';
import pricingRoutes from './pricing.routes';
import authRoutes from './auth.routes';
import geoRoutes from './geo.routes';
import restaurantRoutes from './restaurants.routes';
import adminRoutes from './admin.routes';
import driverDocumentsRoutes from './driver-documents.routes';
import pushRoutes from './push.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/payments', paymentRoutes);
router.use('/settlements', settlementRoutes);
router.use('/rides', rideRoutes);
router.use('/wallet', walletRoutes);
router.use('/topups', topupRoutes);
router.use('/audit', auditRoutes);
router.use('/ledger', ledgerRoutes);
router.use('/notifications', notificationRoutes);
router.use('/pricing', pricingRoutes);
router.use('/geo', geoRoutes);
router.use('/restaurants', restaurantRoutes);
router.use('/admin', adminRoutes);
router.use('/driver', driverDocumentsRoutes);
router.use('/push', pushRoutes);

export default router;
