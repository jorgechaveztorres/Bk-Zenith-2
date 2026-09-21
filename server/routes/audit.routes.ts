import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { db } from '../config/firebase';
import { FieldValue } from 'firebase-admin/firestore';

const router = Router();

router.post('/log', requireAuth, async (req, res) => {
  try {
    const record = req.body;
    if (!db) throw new Error("Base de datos no disponible.");
    
    // Server authority: enforce actorId is the caller (unless it's an emergency etc, but zero trust is better)
    const uid = (req as any).user.uid;
    if (record.actorId !== uid) {
       // We can just override it
       record.actorId = uid;
    }

    const auditRef = db.collection('audit_logs').doc();
    await auditRef.set({
      ...record,
      id: auditRef.id,
      timestamp: FieldValue.serverTimestamp(),
      environment: 'production-sandbox'
    });
    
    return res.json({ success: true, id: auditRef.id });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
