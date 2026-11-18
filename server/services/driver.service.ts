/**
 * ZÉNITH — MOTORIZADO EN LÍNEA (MySQL)
 * Conectarse/desconectarse, enviar GPS y ver la oferta que le toca.
 */
import type { RowDataPacket } from 'mysql2/promise';
import { getPool, withTransaction } from '../config/mysql';
import { DispatchService } from './dispatch.service';
import { WalletService } from './wallet.service';
import { HttpError } from './http-error';
import { notify, PendingNotice } from '../realtime/bus';

export interface OfferView {
  assignmentId: string;
  rideId: string;
  expiresInSeconds: number;
  distanceToPickupKm: number;
  price: number;
  origin: { address: string; lat: number; lng: number };
  destination: { address: string; lat: number; lng: number };
  tripDistanceKm: number | null;
  paymentMethod: string;
}

const validCoord = (lat: unknown, lng: unknown): { lat: number; lng: number } => {
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < -90 || a > 90 || b < -180 || b > 180) {
    throw new HttpError(400, 'Ubicación GPS inválida.');
  }
  return { lat: a, lng: b };
};

export class DriverService {
  /**
   * Conectarse (AVAILABLE), seguir conectado con GPS nuevo, o desconectarse (OFFLINE).
   * Solo motorizados aprobados y no suspendidos pueden conectarse.
   */
  static async updatePresence(driverId: string, input: { lat: unknown; lng: unknown; online: unknown; heading?: unknown; speedKmh?: unknown }) {
    const { lat, lng } = validCoord(input.lat, input.lng);
    const wantsOnline = input.online !== false;
    const heading = Number.isFinite(Number(input.heading)) ? Math.round(Number(input.heading)) : null;
    const speed = Number.isFinite(Number(input.speedKmh)) ? Number(Number(input.speedKmh).toFixed(1)) : null;

    const notices: PendingNotice[] = [];
    const out = await withTransaction(async (conn) => {
      notices.length = 0;
      const [prof] = await conn.query<RowDataPacket[]>(
        `SELECT p.status, p.suspended_until > NOW(3) AS suspended, u.is_blocked
         FROM driver_profiles p JOIN users u ON u.id = p.user_id WHERE p.user_id = ?`, [driverId]
      );
      const p = prof[0];
      if (!p) throw new HttpError(403, 'Tu cuenta no es de motorizado.');
      if (wantsOnline) {
        if (p.is_blocked) throw new HttpError(403, 'Tu cuenta está bloqueada.');
        if (p.status !== 'APPROVED') throw new HttpError(403, 'Tus documentos aún no están aprobados.');
        if (Number(p.suspended)) throw new HttpError(403, 'Tu cuenta está suspendida temporalmente.');
        if (await WalletService.isBlockedByDebt(conn, driverId)) {
          throw new HttpError(403, 'Tienes una deuda de comisión pendiente. Recarga por Yape para seguir conectado.');
        }
      }

      const [cur] = await conn.query<RowDataPacket[]>('SELECT status, current_ride_id FROM drivers_online WHERE driver_id = ? FOR UPDATE', [driverId]);
      const busy = cur[0]?.status === 'BUSY';
      if (!wantsOnline && busy) throw new HttpError(409, 'Termina tu pedido antes de desconectarte.');
      const status = busy ? 'BUSY' : wantsOnline ? 'AVAILABLE' : 'OFFLINE';

      await conn.execute(
        `INSERT INTO drivers_online (driver_id, status, lat, lng, heading, speed_kmh, last_active)
         VALUES (?, ?, ?, ?, ?, ?, NOW(3))
         ON DUPLICATE KEY UPDATE status = VALUES(status), lat = VALUES(lat), lng = VALUES(lng),
           heading = VALUES(heading), speed_kmh = VALUES(speed_kmh), last_active = NOW(3)`,
        [driverId, status, lat, lng, heading, speed]
      );
      await conn.execute('UPDATE driver_profiles SET availability = ?, last_connection = NOW(3) WHERE user_id = ?', [status === 'OFFLINE' ? 0 : 1, driverId]);
      // Si lleva un pedido, el cliente ve su ubicación.
      if (busy && cur[0]?.current_ride_id) {
        const rideId = String(cur[0].current_ride_id);
        await conn.execute('UPDATE rides SET driver_lat = ?, driver_lng = ? WHERE id = ? AND driver_id = ?', [lat, lng, rideId, driverId]);
        const [pr] = await conn.query<RowDataPacket[]>('SELECT passenger_id FROM rides WHERE id = ?', [rideId]);
        if (pr[0]) notices.push({ userId: String(pr[0].passenger_id), event: { type: 'ride.location', rideId, lat, lng, heading } });
      }
      return { status };
    });
    notify(notices);
    return out;
  }

  /** La oferta vigente para este motorizado (o null). También empuja el despacho por si el temporizador durmió. */
  static async getCurrentOffer(driverId: string): Promise<OfferView | null> {
    await DispatchService.sweep();
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT a.id AS assignment_id, a.ride_id, a.distance_km,
              GREATEST(0, TIMESTAMPDIFF(SECOND, NOW(3), a.expires_at)) AS secs,
              r.protected_price, r.origin_address, r.origin_lat, r.origin_lng,
              r.destination_address, r.destination_lat, r.destination_lng, r.distance_km AS trip_km, r.payment_method
       FROM assignments a JOIN rides r ON r.id = a.ride_id
       WHERE a.driver_id = ? AND a.status = 'OFFERED' AND a.expires_at > NOW(3) AND r.status = 'SEARCHING_DRIVER'
       ORDER BY a.assigned_at DESC LIMIT 1`,
      [driverId]
    );
    const r = rows[0];
    if (!r) return null;
    return {
      assignmentId: String(r.assignment_id),
      rideId: String(r.ride_id),
      expiresInSeconds: Number(r.secs),
      distanceToPickupKm: Number(r.distance_km),
      price: Number(r.protected_price),
      origin: { address: String(r.origin_address), lat: Number(r.origin_lat), lng: Number(r.origin_lng) },
      destination: { address: String(r.destination_address), lat: Number(r.destination_lat), lng: Number(r.destination_lng) },
      tripDistanceKm: r.trip_km !== null ? Number(r.trip_km) : null,
      paymentMethod: String(r.payment_method),
    };
  }
}
