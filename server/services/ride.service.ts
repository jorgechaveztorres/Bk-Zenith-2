/**
 * ZÉNITH — PEDIDOS (MySQL)
 *
 * Ciclo de vida:
 *   SEARCHING_DRIVER -> (motorizado acepta oferta) DRIVER_ASSIGNED -> DRIVER_ARRIVING
 *   -> WAITING_FOR_OTP -> (código correcto) IN_PROGRESS -> COMPLETED
 *   En cualquier punto antes de terminar: CANCELLED. Sin aceptación a tiempo: EXPIRED.
 */
import crypto from 'crypto';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getPool, withTransaction } from '../config/mysql';
import { verifyQuoteSignature, ServerQuoteResult } from './pricing.service';
import { resolveCityFromCoordinates } from './geo.service';
import { DispatchService } from './dispatch.service';
import { getNumberSetting } from './settings.service';
import { WalletService } from './wallet.service';
import { HttpError } from './http-error';
import { notify, PendingNotice } from '../realtime/bus';

/** Aviso "el pedido cambió" para el cliente y el motorizado asignado. */
const rideNotices = (v: RideView): PendingNotice[] => {
  const ev = { type: 'ride' as const, rideId: v.id, status: v.status };
  const out: PendingNotice[] = [{ userId: v.passengerId, event: ev }];
  if (v.driverId) out.push({ userId: v.driverId, event: ev });
  return out;
};

export type RideStatus =
  | 'SEARCHING_DRIVER' | 'DRIVER_ASSIGNED' | 'DRIVER_ARRIVING' | 'WAITING_FOR_OTP'
  | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';

/** Cambios que el motorizado puede pedir directamente (IN_PROGRESS solo con código). */
export const DRIVER_TRANSITIONS: Record<string, RideStatus[]> = {
  DRIVER_ASSIGNED: ['DRIVER_ARRIVING'],
  DRIVER_ARRIVING: ['WAITING_FOR_OTP'],
  IN_PROGRESS: ['COMPLETED'],
};

const OTP_MAX_ATTEMPTS = 3;

const otpSecret = (): string => {
  const s = process.env.OTP_SECRET;
  if (!s && process.env.NODE_ENV === 'production') throw new Error('OTP_SECRET no configurado.');
  return s || 'ZENITH_DEV_OTP_SECRET';
};

export const hashOtp = (rideId: string, code: string): string =>
  crypto.createHmac('sha256', otpSecret()).update(`${rideId}:${code}`).digest('hex');

export interface DeliveryDetails {
  description?: string;
  receptorName?: string;
  receptorPhone?: string;
  notes?: string;
}

/** Ítem de comida tal como quedó fijado al momento del pedido (precio congelado). */
export interface FoodOrderItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface FoodOrderDetails {
  restaurantId: string;
  restaurantName: string;
  items: FoodOrderItem[];
  subtotal: number;
  notes?: string;
}

export type OrderType = 'DELIVERY' | 'FOOD';

export interface RequestRideInput {
  quote: ServerQuoteResult;
  passengerId: string;
  paymentMethod?: string;
  idempotencyKey?: string;
  delivery?: DeliveryDetails;
  orderType?: OrderType;
  restaurantId?: string;
  food?: FoodOrderDetails;
}

export interface RideView {
  id: string;
  status: RideStatus;
  passengerId: string;
  passengerName: string | null;
  driverId: string | null;
  driverName: string | null;
  driverPhone: string | null;
  origin: { address: string; lat: number; lng: number };
  destination: { address: string; lat: number; lng: number };
  driverLocation: { lat: number; lng: number } | null;
  price: number;
  distanceKm: number | null;
  paymentMethod: string;
  delivery: DeliveryDetails | null;
  orderType: OrderType;
  food: FoodOrderDetails | null;
  restaurantId: string | null;
  createdAt: string;
  acceptedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

const toNum = (v: unknown): number => Number(v);
const toIso = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : v ? String(v) : null);
const parseJson = <T>(v: unknown): T | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') {
    try { return JSON.parse(v) as T; } catch { return null; }
  }
  return v as T;
};

export const toRideView = (r: RowDataPacket): RideView => {
  const orderType = (r.order_type === 'FOOD' ? 'FOOD' : 'DELIVERY') as OrderType;
  const isFood = orderType === 'FOOD';
  return {
    id: String(r.id),
    status: r.status as RideStatus,
    passengerId: String(r.passenger_id),
    passengerName: r.passenger_name ?? null,
    driverId: r.driver_id ?? null,
    driverName: r.driver_name ?? null,
    driverPhone: r.driver_phone ?? null,
    origin: { address: String(r.origin_address), lat: toNum(r.origin_lat), lng: toNum(r.origin_lng) },
    destination: { address: String(r.destination_address), lat: toNum(r.destination_lat), lng: toNum(r.destination_lng) },
    driverLocation: r.driver_lat !== null && r.driver_lat !== undefined ? { lat: toNum(r.driver_lat), lng: toNum(r.driver_lng) } : null,
    price: toNum(r.protected_price),
    distanceKm: r.distance_km !== null ? toNum(r.distance_km) : null,
    paymentMethod: String(r.payment_method),
    delivery: isFood ? null : parseJson<DeliveryDetails>(r.package_info),
    orderType,
    food: isFood ? parseJson<FoodOrderDetails>(r.package_info) : null,
    restaurantId: r.restaurant_id ?? null,
    createdAt: toIso(r.created_at) || '',
    acceptedAt: toIso(r.accepted_at),
    startedAt: toIso(r.started_at),
    completedAt: toIso(r.completed_at),
  };
};

const lockRide = async (conn: PoolConnection, rideId: string): Promise<RowDataPacket> => {
  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT *, (otp_expires_at IS NOT NULL AND otp_expires_at <= NOW(3)) AS otp_expired FROM rides WHERE id = ? FOR UPDATE', [rideId]
  );
  if (!rows[0]) throw new HttpError(404, 'Pedido no encontrado.');
  return rows[0];
};

const event = async (
  conn: PoolConnection, rideId: string, actorRole: 'SOLICITANTE' | 'MOTORIZADO' | 'SYSTEM',
  actorId: string, action: string, result = 'OK'
) => {
  await conn.execute(
    'INSERT INTO operational_events (ride_id, actor_role, actor_id, action, result) VALUES (?, ?, ?, ?, ?)',
    [rideId, actorRole, actorId, action, result]
  );
};

const cleanText = (v: unknown, max: number): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;

export class RideService {
  /** El cliente confirma la cotización firmada y se crea el pedido. */
  static async requestRide(input: RequestRideInput): Promise<{ ride: RideView; otpCode: string; idempotent: boolean }> {
    const { quote } = input;
    if (!quote || typeof quote !== 'object') throw new HttpError(400, 'Falta la cotización.');

    const check = verifyQuoteSignature(quote);
    if (!check.valid) throw new HttpError(400, `Cotización no válida: ${check.reason}. Vuelve a cotizar.`);

    const paymentMethod = ['cash', 'yape', 'plin'].includes(String(input.paymentMethod)) ? String(input.paymentMethod) : 'cash';
    const idemKey = (cleanText(input.idempotencyKey, 120) || quote.quoteId).slice(0, 120);
    const payloadHash = crypto.createHash('sha256')
      .update(JSON.stringify({ p: input.passengerId, q: quote.quoteId, f: quote.totalFare.toFixed(2) }))
      .digest('hex');

    const orderType: OrderType = input.orderType === 'FOOD' ? 'FOOD' : 'DELIVERY';

    const delivery: DeliveryDetails | null = orderType === 'DELIVERY' && input.delivery ? {
      description: cleanText(input.delivery.description, 300),
      receptorName: cleanText(input.delivery.receptorName, 150),
      receptorPhone: cleanText(input.delivery.receptorPhone, 20),
      notes: cleanText(input.delivery.notes, 300),
    } : null;

    if (orderType === 'FOOD' && !input.food) throw new HttpError(400, 'Falta el detalle del pedido de comida.');
    const food: FoodOrderDetails | null = orderType === 'FOOD' && input.food ? input.food : null;
    const packageInfo = orderType === 'FOOD' ? food : delivery;

    const searchSeconds = await getNumberSetting('search_timeout_seconds', 300);
    const otpMinutes = await getNumberSetting('pickup_otp_minutes', 60);

    const result = await withTransaction(async (conn) => {
      const [idem] = await conn.query<RowDataPacket[]>(
        'SELECT resource_id, payload_hash FROM idempotency_keys WHERE idem_key = ? FOR UPDATE', [idemKey]
      );
      if (idem[0]) {
        if (idem[0].payload_hash !== payloadHash) throw new HttpError(409, 'Esta cotización ya se usó para otro pedido.');
        const [rows] = await conn.query<RowDataPacket[]>('SELECT * FROM rides WHERE id = ?', [idem[0].resource_id]);
        if (!rows[0]) throw new HttpError(409, 'Pedido no disponible.');
        return { ride: toRideView(rows[0]), otpCode: String(rows[0].otp_code || ''), idempotent: true };
      }

      // Un cliente no puede tener dos pedidos activos a la vez.
      const [active] = await conn.query<RowDataPacket[]>(
        `SELECT id FROM rides WHERE passenger_id = ?
         AND status IN ('SEARCHING_DRIVER','DRIVER_ASSIGNED','DRIVER_ARRIVING','WAITING_FOR_OTP','IN_PROGRESS') LIMIT 1`,
        [input.passengerId]
      );
      if (active[0]) throw new HttpError(409, 'Ya tienes un pedido en curso.');

      const [users] = await conn.query<RowDataPacket[]>('SELECT full_name, phone, is_blocked FROM users WHERE id = ?', [input.passengerId]);
      const user = users[0];
      if (!user || user.is_blocked) throw new HttpError(403, 'Cuenta no disponible.');

      const rideId = crypto.randomUUID();
      const otpCode = crypto.randomInt(1000, 10000).toString();
      const city = quote.marketZone?.city || resolveCityFromCoordinates(quote.origin.lat, quote.origin.lng, quote.origin.address).city;

      await conn.execute(
        `INSERT INTO rides (
           id, passenger_id, passenger_name, passenger_phone, status, order_type, restaurant_id, city,
           origin_address, origin_lat, origin_lng, destination_address, destination_lat, destination_lng,
           distance_km, duration_min, protected_price, normal_fare, multiplier, payment_method,
           pricing_seal, pricing_version, quote_id, solicitude_status, package_info,
           otp_code, otp_hash, otp_expires_at, search_expires_at)
         VALUES (?, ?, ?, ?, 'SEARCHING_DRIVER', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'REQUESTED', ?,
                 ?, ?, NOW(3) + INTERVAL ? MINUTE, NOW(3) + INTERVAL ? SECOND)`,
        [
          rideId, input.passengerId, user.full_name, user.phone, orderType, input.restaurantId ?? null, city,
          quote.origin.address.slice(0, 255), quote.origin.lat, quote.origin.lng,
          quote.destination.address.slice(0, 255), quote.destination.lat, quote.destination.lng,
          quote.distance, quote.duration ?? null, quote.totalFare, quote.normalFare, quote.multiplier, paymentMethod,
          quote.pricingSeal, quote.pricingVersion, quote.quoteId, packageInfo ? JSON.stringify(packageInfo) : null,
          otpCode, hashOtp(rideId, otpCode), otpMinutes, searchSeconds,
        ]
      );
      await conn.execute(
        `INSERT INTO idempotency_keys (idem_key, user_id, scope, resource_id, payload_hash) VALUES (?, ?, 'RIDE_REQUEST', ?, ?)`,
        [idemKey, input.passengerId, rideId, payloadHash]
      );
      await event(conn, rideId, 'SOLICITANTE', input.passengerId, 'RIDE_REQUESTED');
      const [rows] = await conn.query<RowDataPacket[]>('SELECT * FROM rides WHERE id = ?', [rideId]);
      return { ride: toRideView(rows[0]), otpCode, idempotent: false };
    });

    if (!result.idempotent) {
      DispatchService.runDispatchCycle(result.ride.id).catch((err) =>
        console.error('[DISPATCH] No se pudo iniciar despacho:', (err as Error).message)
      );
    }
    return result;
  }

  /** Datos del pedido para cliente o motorizado asignado. */
  static async getRide(rideId: string, userId: string, isAdmin = false): Promise<RideView & { otpCode?: string }> {
    const [rows] = await getPool().query<RowDataPacket[]>('SELECT * FROM rides WHERE id = ?', [rideId]);
    const r = rows[0];
    if (!r) throw new HttpError(404, 'Pedido no encontrado.');
    const isPassenger = r.passenger_id === userId;
    if (!isPassenger && r.driver_id !== userId && !isAdmin) throw new HttpError(403, 'No tienes acceso a este pedido.');
    const view = toRideView(r);
    // El código de recojo solo lo ve el cliente, y solo mientras sirve.
    if (isPassenger && !Number(r.otp_verified) && ['DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'WAITING_FOR_OTP', 'SEARCHING_DRIVER'].includes(String(r.status))) {
      return { ...view, otpCode: String(r.otp_code || '') };
    }
    return view;
  }

  /** Pedido activo del usuario (cliente o motorizado), para reanudar la pantalla al abrir la app. */
  static async getActiveRide(userId: string): Promise<RideView | null> {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT * FROM rides WHERE (passenger_id = ? OR driver_id = ?)
       AND status IN ('SEARCHING_DRIVER','DRIVER_ASSIGNED','DRIVER_ARRIVING','WAITING_FOR_OTP','IN_PROGRESS')
       ORDER BY created_at DESC LIMIT 1`,
      [userId, userId]
    );
    return rows[0] ? toRideView(rows[0]) : null;
  }

  /** El motorizado acepta la oferta que se le hizo. */
  static async acceptOffer(assignmentId: string, driverId: string): Promise<RideView> {
    const view = await withTransaction(async (conn) => {
      const [pre] = await conn.query<RowDataPacket[]>('SELECT ride_id, driver_id FROM assignments WHERE id = ?', [assignmentId]);
      if (!pre[0] || pre[0].driver_id !== driverId) throw new HttpError(404, 'Oferta no encontrada.');

      // Bloquear primero el pedido y recién después releer la oferta: si el motorizado
      // toca "aceptar" dos veces a la vez, el segundo toque ve el resultado del primero.
      const ride = await lockRide(conn, String(pre[0].ride_id));
      const [asg] = await conn.query<RowDataPacket[]>(
        'SELECT id, status, expires_at > NOW(3) AS alive FROM assignments WHERE id = ? FOR UPDATE', [assignmentId]
      );
      const a = asg[0];
      if (a.status === 'ACCEPTED' && ride.driver_id === driverId) return toRideView(ride); // reintento seguro
      if (a.status !== 'OFFERED' || !Number(a.alive)) throw new HttpError(409, 'La oferta ya venció.');
      if (ride.status !== 'SEARCHING_DRIVER') throw new HttpError(409, 'El pedido ya no está disponible.');

      const [drv] = await conn.query<RowDataPacket[]>(
        `SELECT d.status, u.full_name, u.phone, d.lat, d.lng FROM drivers_online d JOIN users u ON u.id = d.driver_id
         WHERE d.driver_id = ? FOR UPDATE`, [driverId]
      );
      const d = drv[0];
      if (!d || d.status !== 'AVAILABLE') throw new HttpError(409, 'Debes estar disponible para aceptar.');

      await conn.execute(`UPDATE assignments SET status = 'ACCEPTED', responded_at = NOW(3) WHERE id = ?`, [assignmentId]);
      await conn.execute(
        `UPDATE rides SET status = 'DRIVER_ASSIGNED', solicitude_status = 'ASSIGNED', transit_status = 'TO_PICKUP',
           driver_id = ?, driver_name = ?, driver_phone = ?, driver_lat = ?, driver_lng = ?, accepted_at = NOW(3)
         WHERE id = ?`,
        [driverId, d.full_name, d.phone, d.lat, d.lng, ride.id]
      );
      await conn.execute(`UPDATE drivers_online SET status = 'BUSY', current_ride_id = ? WHERE driver_id = ?`, [ride.id, driverId]);
      await conn.execute(
        `INSERT INTO dispatch_logs (ride_id, driver_id, assignment_id, event, details) VALUES (?, ?, ?, 'ASSIGNMENT_ACCEPTED', 'Aceptado por el motorizado')`,
        [ride.id, driverId, assignmentId]
      );
      await event(conn, String(ride.id), 'MOTORIZADO', driverId, 'OFFER_ACCEPTED');
      const [rows] = await conn.query<RowDataPacket[]>('SELECT * FROM rides WHERE id = ?', [ride.id]);
      return toRideView(rows[0]);
    });
    notify(rideNotices(view));
    return view;
  }

  /** El motorizado rechaza: se ofrece al siguiente al instante. */
  static async rejectOffer(assignmentId: string, driverId: string): Promise<void> {
    const rideId = await withTransaction(async (conn) => {
      const [asg] = await conn.query<RowDataPacket[]>('SELECT ride_id, driver_id, status FROM assignments WHERE id = ? FOR UPDATE', [assignmentId]);
      const a = asg[0];
      if (!a || a.driver_id !== driverId) throw new HttpError(404, 'Oferta no encontrada.');
      if (a.status !== 'OFFERED') return String(a.ride_id);
      await conn.execute(`UPDATE assignments SET status = 'REJECTED', responded_at = NOW(3) WHERE id = ?`, [assignmentId]);
      await conn.execute(
        `INSERT INTO dispatch_logs (ride_id, driver_id, assignment_id, event, details) VALUES (?, ?, ?, 'ASSIGNMENT_REJECTED', 'Rechazado por el motorizado')`,
        [a.ride_id, driverId, assignmentId]
      );
      return String(a.ride_id);
    });
    await DispatchService.runDispatchCycle(rideId);
  }

  /** Avance del motorizado: en camino -> llegué (pide código) -> entregado. */
  static async updateStatus(rideId: string, driverId: string, next: string): Promise<RideView> {
    const view = await withTransaction(async (conn) => {
      const ride = await lockRide(conn, rideId);
      if (ride.driver_id !== driverId) throw new HttpError(403, 'Este pedido no es tuyo.');
      const allowed = DRIVER_TRANSITIONS[String(ride.status)] || [];
      if (!allowed.includes(next as RideStatus)) {
        throw new HttpError(400, next === 'IN_PROGRESS'
          ? 'Para iniciar el viaje debes ingresar el código del cliente.'
          : `No se puede pasar de ${ride.status} a ${next}.`);
      }
      const extra: Record<string, string> = {
        DRIVER_ARRIVING: ", transit_status = 'TO_PICKUP'",
        WAITING_FOR_OTP: ", transit_status = 'AT_PICKUP', pickup_arrived_at = NOW(3)",
        COMPLETED: ", transit_status = 'AT_DESTINATION', solicitude_status = 'COMPLETED', destination_arrived_at = NOW(3), completed_at = NOW(3)",
      };
      await conn.execute(`UPDATE rides SET status = ?${extra[next] || ''} WHERE id = ?`, [next, rideId]);
      if (next === 'COMPLETED') {
        await conn.execute(`UPDATE drivers_online SET status = 'AVAILABLE', current_ride_id = NULL WHERE driver_id = ?`, [driverId]);
        await WalletService.chargeRideCommission(conn, rideId, driverId, Number(ride.protected_price));
      }
      await event(conn, rideId, 'MOTORIZADO', driverId, `STATUS_${next}`);
      const [rows] = await conn.query<RowDataPacket[]>('SELECT * FROM rides WHERE id = ?', [rideId]);
      return toRideView(rows[0]);
    });
    notify(rideNotices(view));
    return view;
  }

  /** El motorizado ingresa el código que le dicta el cliente. 3 intentos. */
  static async verifyOtp(rideId: string, driverId: string, code: unknown): Promise<RideView> {
    const outcome = await withTransaction(async (conn) => {
      const ride = await lockRide(conn, rideId);
      if (ride.driver_id !== driverId) throw new HttpError(403, 'Este pedido no es tuyo.');
      if (ride.status !== 'WAITING_FOR_OTP') throw new HttpError(400, 'Primero marca que llegaste al punto de recojo.');
      if (Number(ride.otp_attempts) >= OTP_MAX_ATTEMPTS) throw new HttpError(429, 'Código bloqueado por intentos. Contacta a soporte.');
      if (Number(ride.otp_expired)) throw new HttpError(400, 'El código venció. Contacta a soporte.');

      const given = typeof code === 'string' ? code.trim() : '';
      const ok = /^\d{4}$/.test(given) &&
        crypto.timingSafeEqual(Buffer.from(hashOtp(rideId, given), 'hex'), Buffer.from(String(ride.otp_hash), 'hex'));
      if (!ok) {
        await conn.execute('UPDATE rides SET otp_attempts = otp_attempts + 1 WHERE id = ?', [rideId]);
        await event(conn, rideId, 'MOTORIZADO', driverId, 'OTP_CHECK', 'WRONG');
        return { ok: false as const, left: OTP_MAX_ATTEMPTS - Number(ride.otp_attempts) - 1 };
      }
      await conn.execute(
        `UPDATE rides SET status = 'IN_PROGRESS', otp_verified = 1, transit_status = 'IN_TRANSIT',
           solicitude_status = 'ACTIVE', started_at = NOW(3), driver_started_trip_at = NOW(3) WHERE id = ?`, [rideId]
      );
      await event(conn, rideId, 'MOTORIZADO', driverId, 'OTP_CHECK', 'OK');
      const [rows] = await conn.query<RowDataPacket[]>('SELECT * FROM rides WHERE id = ?', [rideId]);
      return { ok: true as const, ride: toRideView(rows[0]) };
    });
    // El intento fallido se guarda (fuera del rollback) y luego se informa.
    if (!outcome.ok) throw new HttpError(400, `Código incorrecto. Te quedan ${Math.max(0, outcome.left)} intentos.`);
    notify(rideNotices(outcome.ride));
    return outcome.ride;
  }

  /** Cancelar: el cliente o el motorizado asignado, antes de que termine. */
  static async cancelRide(rideId: string, userId: string, reason?: string): Promise<RideView> {
    const offerClosed: PendingNotice[] = [];
    const view = await withTransaction(async (conn) => {
      offerClosed.length = 0;
      const ride = await lockRide(conn, rideId);
      const isPassenger = ride.passenger_id === userId;
      const isDriver = ride.driver_id === userId;
      if (!isPassenger && !isDriver) throw new HttpError(403, 'No puedes cancelar este pedido.');
      if (['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(String(ride.status))) throw new HttpError(400, 'El pedido ya terminó.');
      if (ride.status === 'IN_PROGRESS') throw new HttpError(400, 'El pedido ya está en camino; contacta a soporte.');

      await conn.execute(
        `UPDATE rides SET status = 'CANCELLED', solicitude_status = 'CANCELLED', cancelled_by = ?, cancel_reason = ? WHERE id = ?`,
        [userId, cleanText(reason, 255) ?? null, rideId]
      );
      const [openOffers] = await conn.query<RowDataPacket[]>(`SELECT id, driver_id FROM assignments WHERE ride_id = ? AND status = 'OFFERED'`, [rideId]);
      for (const o of openOffers) {
        offerClosed.push({ userId: String(o.driver_id), event: { type: 'offer.closed', assignmentId: String(o.id), reason: 'CANCELLED' } });
      }
      await conn.execute(`UPDATE assignments SET status = 'CANCELLED', responded_at = NOW(3) WHERE ride_id = ? AND status = 'OFFERED'`, [rideId]);
      if (ride.driver_id) {
        await conn.execute(`UPDATE drivers_online SET status = 'AVAILABLE', current_ride_id = NULL WHERE driver_id = ?`, [ride.driver_id]);
      }
      await event(conn, rideId, isPassenger ? 'SOLICITANTE' : 'MOTORIZADO', userId, 'RIDE_CANCELLED');
      const [rows] = await conn.query<RowDataPacket[]>('SELECT * FROM rides WHERE id = ?', [rideId]);
      return toRideView(rows[0]);
    });
    notify([...rideNotices(view), ...offerClosed]);
    return view;
  }
}
