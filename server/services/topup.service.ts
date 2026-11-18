/**
 * ZÉNITH — RECARGA YAPE DEL MOTORIZADO (MySQL, V1 manual)
 *
 * El motorizado yapea a la cuenta de Zénith y escribe el número de operación.
 * Un admin revisa esa lista y confirma (acredita contra su deuda) o rechaza.
 * Sin OCR/IA en esta versión: eso queda para una siguiente iteración si hace falta.
 */
import type { RowDataPacket } from 'mysql2/promise';
import { getPool, withTransaction } from '../config/mysql';
import { WalletService } from './wallet.service';
import { HttpError } from './http-error';
import { CulqiService } from './culqi.service';
import { getNumberSetting } from './settings.service';

export type TopupStatus = 'RECEIPT_SUBMITTED' | 'REJECTED' | 'CREDITED';
export type TopupPaymentMethod = 'YAPE_MANUAL' | 'CULQI';

export interface TopupView {
  id: string;
  driverId: string;
  driverName: string | null;
  driverPhone: string | null;
  requestedAmount: number;
  operationNumber: string | null;
  paymentMethod: TopupPaymentMethod;
  grossAmount: number | null;
  feeAmount: number | null;
  status: TopupStatus;
  rejectionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  creditedAt: string | null;
  createdAt: string;
}

const toIso = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : v ? String(v) : null);
const money = (n: number): number => Math.round(n * 100) / 100;

const newId = (): string => `tp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
const newReference = (): string => `Z-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const SELECT = `
  SELECT t.id, t.driver_id, t.requested_amount, t.operation_number, t.payment_method,
         t.gross_amount, t.fee_amount, t.status,
         t.rejection_reason, t.reviewed_by, t.reviewed_at, t.credited_at, t.created_at,
         u.full_name AS driver_name, u.phone AS driver_phone
  FROM topup_requests t JOIN users u ON u.id = t.driver_id
`;

const toView = (r: RowDataPacket): TopupView => ({
  id: String(r.id),
  driverId: String(r.driver_id),
  driverName: r.driver_name ?? null,
  driverPhone: r.driver_phone ?? null,
  requestedAmount: money(Number(r.requested_amount)),
  operationNumber: r.operation_number ?? null,
  paymentMethod: (r.payment_method as TopupPaymentMethod) || 'YAPE_MANUAL',
  grossAmount: r.gross_amount !== null && r.gross_amount !== undefined ? money(Number(r.gross_amount)) : null,
  feeAmount: r.fee_amount !== null && r.fee_amount !== undefined ? money(Number(r.fee_amount)) : null,
  status: r.status as TopupStatus,
  rejectionReason: r.rejection_reason ?? null,
  reviewedBy: r.reviewed_by ?? null,
  reviewedAt: toIso(r.reviewed_at),
  creditedAt: toIso(r.credited_at),
  createdAt: toIso(r.created_at) || '',
});

const audit = async (adminId: string, action: string, targetId: string, details: Record<string, unknown>) => {
  await getPool().execute(
    'INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?, ?)',
    [adminId, 'ADMIN', action, 'topup_request', targetId, JSON.stringify(details)]
  ).catch((err) => console.error('[TOPUP] No se pudo auditar:', (err as Error).message));
};

export class TopupService {
  /** El motorizado dice "ya yapeé tanto, con este número de operación". */
  static async createRequest(driverId: string, amount: unknown, operationNumber: unknown): Promise<TopupView> {
    const requested = Number(amount);
    if (!Number.isFinite(requested) || requested < 5 || requested > 2000) {
      throw new HttpError(400, 'El monto debe estar entre S/ 5 y S/ 2000.');
    }
    const op = typeof operationNumber === 'string' ? operationNumber.trim().slice(0, 30) : '';
    if (!op) throw new HttpError(400, 'Escribe el número de operación de tu Yape.');

    const pool = getPool();
    const [pending] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM topup_requests WHERE driver_id = ? AND status = 'RECEIPT_SUBMITTED' LIMIT 1`, [driverId]
    );
    if (pending[0]) throw new HttpError(409, 'Ya tienes una recarga esperando revisión.');

    const id = newId();
    const expiresAt = new Date(Date.now() + 72 * 3600 * 1000);
    await pool.execute(
      `INSERT INTO topup_requests (id, reference_code, driver_id, requested_amount, operation_number, status, expires_at)
       VALUES (?, ?, ?, ?, ?, 'RECEIPT_SUBMITTED', ?)`,
      [id, newReference(), driverId, money(requested), op, expiresAt]
    );
    const [rows] = await pool.query<RowDataPacket[]>(`${SELECT} WHERE t.id = ?`, [id]);
    return toView(rows[0]);
  }

  /**
   * Recarga con Culqi (tarjeta/Yape por botón, sin escribir número de operación).
   * Se cobra el monto completo al motorizado; la comisión de Culqi se descuenta
   * del monto que se le acredita en la billetera (dejar esto claro en la app).
   * Al ser una confirmación de Culqi, se acredita de inmediato, sin revisión del admin.
   */
  static async chargeWithCulqi(driverId: string, token: unknown, amount: unknown, email: unknown): Promise<TopupView> {
    const requested = Number(amount);
    if (!Number.isFinite(requested) || requested < 5 || requested > 2000) {
      throw new HttpError(400, 'El monto debe estar entre S/ 5 y S/ 2000.');
    }
    if (typeof token !== 'string' || !token.trim()) throw new HttpError(400, 'Falta el token de pago de Culqi.');

    const pool = getPool();
    const [pending] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM topup_requests WHERE driver_id = ? AND status = 'RECEIPT_SUBMITTED' LIMIT 1`, [driverId]
    );
    if (pending[0]) throw new HttpError(409, 'Ya tienes una recarga esperando revisión.');

    const [feePct, feeFixed] = await Promise.all([
      getNumberSetting('culqi_fee_pct', 3.99),
      getNumberSetting('culqi_fee_fixed', 0.50),
    ]);
    const fee = money(requested * (feePct / 100) + feeFixed);
    const net = money(requested - fee);
    if (net <= 0) throw new HttpError(400, 'El monto es muy bajo para cubrir la comisión del cobro.');

    const chargeEmail = typeof email === 'string' && email.includes('@') ? email : `motorizado-${driverId}@zenith.pe`;
    const charge = await CulqiService.createCharge(token, requested, chargeEmail);
    if (charge.outcomeType !== 'venta_exitosa') {
      throw new HttpError(402, 'Culqi no confirmó el pago. Intenta de nuevo.');
    }

    const id = newId();
    const expiresAt = new Date(Date.now() + 72 * 3600 * 1000);
    await withTransaction(async (conn) => {
      await conn.execute(
        `INSERT INTO topup_requests
           (id, reference_code, driver_id, requested_amount, payment_method, culqi_charge_id,
            gross_amount, fee_amount, status, credited_at, expires_at)
         VALUES (?, ?, ?, ?, 'CULQI', ?, ?, ?, 'CREDITED', NOW(3), ?)`,
        [id, newReference(), driverId, net, charge.id, money(requested), fee, expiresAt]
      );
      await WalletService.applyTopupCredit(conn, driverId, id, net);
    });
    const [rows] = await pool.query<RowDataPacket[]>(`${SELECT} WHERE t.id = ?`, [id]);
    return toView(rows[0]);
  }

  static async myHistory(driverId: string, limit = 20): Promise<TopupView[]> {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `${SELECT} WHERE t.driver_id = ? ORDER BY t.created_at DESC LIMIT ?`, [driverId, limit]
    );
    return rows.map(toView);
  }

  /** Para el admin: lista de recargas, filtrable por estado. */
  static async list(status?: TopupStatus): Promise<TopupView[]> {
    const pool = getPool();
    const [rows] = status
      ? await pool.query<RowDataPacket[]>(`${SELECT} WHERE t.status = ? ORDER BY t.created_at ASC`, [status])
      : await pool.query<RowDataPacket[]>(`${SELECT} ORDER BY FIELD(t.status,'RECEIPT_SUBMITTED','CREDITED','REJECTED'), t.created_at DESC`);
    return rows.map(toView);
  }

  /** El admin confirma que vio el Yape entrar: acredita contra la deuda del motorizado. */
  static async credit(topupId: string, adminId: string): Promise<TopupView> {
    await withTransaction(async (conn) => {
      const [rows] = await conn.query<RowDataPacket[]>('SELECT * FROM topup_requests WHERE id = ? FOR UPDATE', [topupId]);
      const t = rows[0];
      if (!t) throw new HttpError(404, 'Recarga no encontrada.');
      if (t.status !== 'RECEIPT_SUBMITTED') throw new HttpError(400, 'Esta recarga ya fue revisada.');
      await conn.execute(
        `UPDATE topup_requests SET status = 'CREDITED', reviewed_by = ?, reviewed_at = NOW(3), credited_at = NOW(3) WHERE id = ?`,
        [adminId, topupId]
      );
      await WalletService.applyTopupCredit(conn, String(t.driver_id), topupId, Number(t.requested_amount));
    });
    await audit(adminId, 'TOPUP_CREDITED', topupId, {});
    const [rows] = await getPool().query<RowDataPacket[]>(`${SELECT} WHERE t.id = ?`, [topupId]);
    return toView(rows[0]);
  }

  static async reject(topupId: string, adminId: string, reason: string): Promise<TopupView> {
    const cleanReason = reason.trim().slice(0, 255);
    if (!cleanReason) throw new HttpError(400, 'Escribe el motivo del rechazo.');
    const pool = getPool();
    const [res] = await pool.execute(
      `UPDATE topup_requests SET status = 'REJECTED', rejection_reason = ?, reviewed_by = ?, reviewed_at = NOW(3)
       WHERE id = ? AND status = 'RECEIPT_SUBMITTED'`,
      [cleanReason, adminId, topupId]
    );
    if ((res as { affectedRows: number }).affectedRows === 0) throw new HttpError(400, 'Recarga no encontrada o ya revisada.');
    await audit(adminId, 'TOPUP_REJECTED', topupId, { reason: cleanReason });
    const [rows] = await pool.query<RowDataPacket[]>(`${SELECT} WHERE t.id = ?`, [topupId]);
    return toView(rows[0]);
  }
}
