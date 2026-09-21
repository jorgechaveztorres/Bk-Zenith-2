import { Router } from 'express';
import paymentRoutes from './payment.routes';
import settlementRoutes from './settlement.routes';
import rideRoutes from './ride.routes';
import walletRoutes from './wallet.routes';
import auditRoutes from './audit.routes';
import ledgerRoutes from './ledger.routes';

const router = Router();

router.use('/payments', paymentRoutes);
router.use('/settlements', settlementRoutes);
router.use('/rides', rideRoutes);
router.use('/wallet', walletRoutes);
router.use('/audit', auditRoutes);
router.use('/ledger', ledgerRoutes);

export default router;
