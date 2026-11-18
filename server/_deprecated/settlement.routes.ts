import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { processSettlement } from './settlement.controller';

const router = Router();

// Zénith Enterprise: Zero-Trust. All requests must be authenticated via JWT.
router.post('/process', requireAuth, processSettlement);

export default router;
