import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { db } from '../config/firebase';

const router = Router();

router.post('/record', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const data = req.body;
    if (!db) throw new Error("Base de datos no disponible.");
    
    const id = data.id || `LED-${Date.now()}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const ledgerRef = db.collection('accounting_ledger').doc(id);
    await ledgerRef.set(data);
    
    return res.json({ success: true, id });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
