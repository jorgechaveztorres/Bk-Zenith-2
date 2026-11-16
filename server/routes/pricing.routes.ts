import { Router, Request, Response } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { requireSession } from '../middlewares/session.middleware';
import { getPool } from '../config/mysql';
import { calculateServerQuote, verifyQuoteSignature, ServerQuoteResult } from '../services/pricing.service';
import { getNumberSetting } from '../services/settings.service';

const router = Router();
router.use(requireSession);

const KM_PER_DEG_LAT = 111.32;

/** Pedidos esperando y motorizados libres cerca del recojo (para el multiplicador dinámico). */
const localDemandSupply = async (lat: number, lng: number): Promise<{ pendingOrders: number; availableDrivers: number }> => {
  const radiusKm = await getNumberSetting('dispatch_max_km', 6);
  const freshSeconds = await getNumberSetting('driver_fresh_seconds', 120);
  const dLat = radiusKm / KM_PER_DEG_LAT;
  const dLng = radiusKm / (KM_PER_DEG_LAT * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));
  const box = [lat - dLat, lat + dLat, lng - dLng, lng + dLng];
  const [demand] = await getPool().query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM rides WHERE status = 'SEARCHING_DRIVER'
     AND origin_lat BETWEEN ? AND ? AND origin_lng BETWEEN ? AND ?`, box
  );
  const [supply] = await getPool().query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM drivers_online WHERE status = 'AVAILABLE'
     AND last_active > NOW(3) - INTERVAL ? SECOND
     AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?`, [freshSeconds, ...box]
  );
  // +1 cuenta el pedido que se está cotizando.
  return { pendingOrders: Number(demand[0]?.n || 0) + 1, availableDrivers: Number(supply[0]?.n || 0) };
};

/**
 * POST /api/pricing/quote — precio oficial firmado por el servidor (válido 10 min).
 * Body: originLat, originLng, destLat, destLng, originAddress, destAddress
 */
router.post('/quote', async (req: Request, res: Response) => {
  const b = req.body || {};
  const nums = [b.originLat, b.originLng, b.destLat, b.destLng].map(Number);
  const [oLat, oLng, dLat, dLng] = nums;
  if (nums.some((n) => !Number.isFinite(n)) || Math.abs(oLat) > 90 || Math.abs(dLat) > 90 || Math.abs(oLng) > 180 || Math.abs(dLng) > 180) {
    return res.status(400).json({ success: false, message: 'Ubicaciones inválidas.' });
  }
  if (typeof b.originAddress !== 'string' || !b.originAddress.trim() || typeof b.destAddress !== 'string' || !b.destAddress.trim()) {
    return res.status(400).json({ success: false, message: 'Escribe la dirección de recojo y de entrega.' });
  }
  try {
    const { pendingOrders, availableDrivers } = await localDemandSupply(oLat, oLng);
    const quote = await calculateServerQuote({
      originLat: oLat, originLng: oLng, destLat: dLat, destLng: dLng,
      originAddress: b.originAddress.trim().slice(0, 255),
      destAddress: b.destAddress.trim().slice(0, 255),
      pendingOrders, availableDrivers,
    });
    return res.json({ success: true, quote });
  } catch (err) {
    const msg = (err as Error).message || '';
    console.error('[PRICING] Error:', msg);
    const isRoute = /Google|Routes|ruta|Coordenadas/i.test(msg);
    return res.status(isRoute ? 502 : 500).json({
      success: false,
      message: isRoute ? 'No pudimos calcular la ruta. Intenta de nuevo.' : 'Error del servidor. Intenta de nuevo.',
    });
  }
});

/** POST /api/pricing/verify — comprueba que una cotización no fue alterada ni venció. */
router.post('/verify', (req: Request, res: Response) => {
  const quote = req.body?.quote as ServerQuoteResult | undefined;
  if (!quote) return res.status(400).json({ success: false, message: 'Falta la cotización.' });
  const v = verifyQuoteSignature(quote);
  return v.valid ? res.json({ success: true, valid: true }) : res.status(400).json({ success: false, valid: false, reason: v.reason });
});

export default router;
