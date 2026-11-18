/**
 * ZÉNITH — DESPACHO (MySQL)
 *
 * Cómo se reparte un pedido:
 *  1. El pedido queda en SEARCHING_DRIVER.
 *  2. Se busca al motorizado DISPONIBLE más cercano al recojo, con GPS reciente,
 *     dentro de dispatch_max_km, que no haya rechazado/dejado vencer este pedido
 *     y que no tenga otra oferta abierta.
 *  3. Se le ofrece por offer_timeout_seconds (15 s).
 *  4. Si rechaza o se vence, pasa al siguiente. Si nadie acepta en
 *     search_timeout_seconds, el pedido queda EXPIRED.
 *
 * sweep() revisa ofertas vencidas y pedidos sin oferta; lo llama un temporizador
 * del servidor y también cada consulta del motorizado (por si el proceso estuvo dormido).
 */
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getPool, withTransaction } from '../config/mysql';
import { getNumberSetting } from './settings.service';
import { notify, PendingNotice } from '../realtime/bus';

export interface DispatchCycleResult {
  dispatched: boolean;
  rideId: string;
  status: 'OFFERED' | 'NO_DRIVERS' | 'EXPIRED' | 'NOT_SEARCHING';
  assignedDriverId?: string;
  attemptNumber?: number;
}

const KM_PER_DEG_LAT = 111.32;

const logDispatch = async (
  conn: PoolConnection,
  rideId: string,
  event: string,
  details: string,
  extra: { driverId?: string; assignmentId?: string; attempt?: number; distanceKm?: number } = {}
) => {
  await conn.execute(
    `INSERT INTO dispatch_logs (ride_id, driver_id, assignment_id, event, attempt_number, distance_km, details)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [rideId, extra.driverId ?? null, extra.assignmentId ?? null, event, extra.attempt ?? null, extra.distanceKm ?? null, details.slice(0, 500)]
  );
};

export class DispatchService {
  /** Intenta ofrecer el pedido al siguiente motorizado. Seguro de llamar varias veces. */
  static async runDispatchCycle(rideId: string): Promise<DispatchCycleResult> {
    const offerSeconds = await getNumberSetting('offer_timeout_seconds', 15);
    const maxKm = await getNumberSetting('dispatch_max_km', 6);
    const freshSeconds = await getNumberSetting('driver_fresh_seconds', 120);

    const notices: PendingNotice[] = [];
    const result = await withTransaction(async (conn): Promise<DispatchCycleResult> => {
      notices.length = 0; // si la transacción se reintenta, no duplicar avisos
      const [rides] = await conn.query<RowDataPacket[]>(
        `SELECT id, status, passenger_id, origin_lat, origin_lng, search_expires_at <= NOW(3) AS search_over
         FROM rides WHERE id = ? FOR UPDATE`,
        [rideId]
      );
      const ride = rides[0];
      if (!ride || ride.status !== 'SEARCHING_DRIVER') {
        return { dispatched: false, rideId, status: 'NOT_SEARCHING' };
      }

      // Vencer la oferta abierta si ya pasó su tiempo; si sigue vigente, no hacer nada.
      const [open] = await conn.query<RowDataPacket[]>(
        `SELECT id, driver_id, attempt_number, expires_at > NOW(3) AS alive
         FROM assignments WHERE ride_id = ? AND status = 'OFFERED' FOR UPDATE`,
        [rideId]
      );
      for (const a of open) {
        if (Number(a.alive)) {
          return { dispatched: true, rideId, status: 'OFFERED', assignedDriverId: String(a.driver_id), attemptNumber: Number(a.attempt_number) };
        }
        await conn.execute(`UPDATE assignments SET status = 'EXPIRED', responded_at = NOW(3) WHERE id = ?`, [a.id]);
        notices.push({ userId: String(a.driver_id), event: { type: 'offer.closed', assignmentId: String(a.id), reason: 'EXPIRED' } });
        await logDispatch(conn, rideId, 'ASSIGNMENT_EXPIRED', 'El motorizado no respondió a tiempo.', { driverId: String(a.driver_id), assignmentId: String(a.id) });
      }

      if (Number(ride.search_over)) {
        await conn.execute(`UPDATE rides SET status = 'EXPIRED', solicitude_status = 'CLOSED' WHERE id = ?`, [rideId]);
        await logDispatch(conn, rideId, 'SEARCH_EXPIRED', 'Nadie aceptó el pedido dentro del tiempo de búsqueda.');
        notices.push({ userId: String(ride.passenger_id), event: { type: 'ride', rideId, status: 'EXPIRED' } });
        return { dispatched: false, rideId, status: 'EXPIRED' };
      }

      const [cnt] = await conn.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM assignments WHERE ride_id = ?', [rideId]);
      const attempt = Number(cnt[0]?.n || 0) + 1;

      // Candidatos: caja geográfica para usar índice + distancia real (Haversine) en SQL.
      const lat = Number(ride.origin_lat);
      const lng = Number(ride.origin_lng);
      const dLat = maxKm / KM_PER_DEG_LAT;
      const dLng = maxKm / (KM_PER_DEG_LAT * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));
      const [cands] = await conn.query<RowDataPacket[]>(
        `SELECT d.driver_id, u.full_name,
                6371 * 2 * ASIN(SQRT(POW(SIN(RADIANS(d.lat - ?) / 2), 2) +
                  COS(RADIANS(?)) * COS(RADIANS(d.lat)) * POW(SIN(RADIANS(d.lng - ?) / 2), 2))) AS km
         FROM drivers_online d
         JOIN users u ON u.id = d.driver_id AND u.is_blocked = 0
         JOIN driver_profiles p ON p.user_id = d.driver_id AND p.status = 'APPROVED'
              AND (p.suspended_until IS NULL OR p.suspended_until < NOW(3))
         WHERE d.status = 'AVAILABLE'
           AND d.last_active > NOW(3) - INTERVAL ? SECOND
           AND d.lat BETWEEN ? AND ? AND d.lng BETWEEN ? AND ?
           AND d.driver_id NOT IN (SELECT a.driver_id FROM assignments a WHERE a.ride_id = ?)
           AND NOT EXISTS (SELECT 1 FROM assignments o WHERE o.driver_id = d.driver_id
                           AND o.status = 'OFFERED' AND o.expires_at > NOW(3))
         HAVING km <= ?
         ORDER BY km ASC
         LIMIT 1`,
        [lat, lat, lng, freshSeconds, lat - dLat, lat + dLat, lng - dLng, lng + dLng, rideId, maxKm]
      );
      const best = cands[0];
      if (!best) {
        await logDispatch(conn, rideId, 'NO_DRIVERS_AVAILABLE', 'No hay motorizados disponibles cerca.', { attempt });
        return { dispatched: false, rideId, status: 'NO_DRIVERS', attemptNumber: attempt };
      }

      const assignmentId = `ASG_${rideId}_${attempt}`;
      const km = Number(Number(best.km).toFixed(3));
      await conn.execute(
        `INSERT INTO assignments (id, ride_id, driver_id, driver_name, distance_km, attempt_number, status, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, 'OFFERED', NOW(3) + INTERVAL ? SECOND)`,
        [assignmentId, rideId, best.driver_id, best.full_name, km, attempt, offerSeconds]
      );
      await logDispatch(conn, rideId, 'ASSIGNMENT_OFFERED', `Ofrecido a motorizado a ${km.toFixed(2)} km`, {
        driverId: String(best.driver_id), assignmentId, attempt, distanceKm: km,
      });
      notices.push({ userId: String(best.driver_id), event: { type: 'offer', rideId, assignmentId } });
      return { dispatched: true, rideId, status: 'OFFERED', assignedDriverId: String(best.driver_id), attemptNumber: attempt };
    });
    notify(notices);
    return result;
  }

  /** Revisa todos los pedidos que buscan motorizado y sin oferta vigente. */
  static async sweep(): Promise<number> {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT r.id FROM rides r
       WHERE r.status = 'SEARCHING_DRIVER'
         AND NOT EXISTS (SELECT 1 FROM assignments a WHERE a.ride_id = r.id
                         AND a.status = 'OFFERED' AND a.expires_at > NOW(3))
       ORDER BY r.created_at ASC LIMIT 50`
    );
    for (const r of rows) {
      try {
        await DispatchService.runDispatchCycle(String(r.id));
      } catch (err) {
        console.error('[DISPATCH] Error en barrido:', (err as Error).message);
      }
    }
    return rows.length;
  }

  private static timer: NodeJS.Timeout | null = null;

  /** Barrido automático cada pocos segundos (se activa al arrancar el servidor). */
  static startSweeper(intervalMs = 4000) {
    if (DispatchService.timer) return;
    let running = false;
    DispatchService.timer = setInterval(async () => {
      if (running) return;
      running = true;
      try {
        await DispatchService.sweep();
      } catch (err) {
        console.error('[DISPATCH] Barrido falló:', (err as Error).message);
      } finally {
        running = false;
      }
    }, intervalMs);
    DispatchService.timer.unref();
  }

  static stopSweeper() {
    if (DispatchService.timer) clearInterval(DispatchService.timer);
    DispatchService.timer = null;
  }
}
