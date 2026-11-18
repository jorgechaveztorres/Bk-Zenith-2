/**
 * ZÉNITH — PANEL ADMIN: aprobar/rechazar motorizados.
 * Hasta ahora esto se hacía a mano por phpMyAdmin (UPDATE driver_profiles ... SET status='APPROVED').
 * Solo cuentas con users.is_admin = 1 pueden usar estas rutas (ver requireAppRole(['admin'])).
 */
import type { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../config/mysql';
import { HttpError } from './http-error';

export type DriverReviewStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export interface DriverApplicationView {
  userId: string;
  fullName: string;
  phone: string | null;
  status: DriverReviewStatus;
  isBlocked: boolean;
  vehicle: {
    category: string | null;
    plate: string | null;
    brand: string | null;
    model: string | null;
    year: number | null;
    color: string | null;
  };
  licenseNumber: string | null;
  licenseExpiry: string | null;
  rejectionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

const toIso = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : v ? String(v) : null);

const toView = (r: RowDataPacket): DriverApplicationView => ({
  userId: String(r.user_id),
  fullName: String(r.full_name),
  phone: r.phone ?? null,
  status: r.status as DriverReviewStatus,
  isBlocked: Boolean(r.is_blocked),
  vehicle: {
    category: r.vehicle_category ?? null,
    plate: r.vehicle_plate ?? null,
    brand: r.vehicle_brand ?? null,
    model: r.vehicle_model ?? null,
    year: r.vehicle_year ?? null,
    color: r.vehicle_color ?? null,
  },
  licenseNumber: r.license_number ?? null,
  licenseExpiry: toIso(r.license_expiry),
  rejectionReason: r.rejection_reason ?? null,
  reviewedBy: r.reviewed_by ?? null,
  reviewedAt: toIso(r.reviewed_at),
  createdAt: toIso(r.created_at) || '',
});

const SELECT = `
  SELECT p.user_id, p.status, p.rejection_reason, p.reviewed_by, p.reviewed_at, p.created_at,
         p.vehicle_category, p.vehicle_plate, p.vehicle_brand, p.vehicle_model, p.vehicle_year, p.vehicle_color,
         p.license_number, p.license_expiry,
         u.full_name, u.phone, u.is_blocked
  FROM driver_profiles p JOIN users u ON u.id = p.user_id
`;

const audit = async (adminId: string, action: string, targetId: string, details: Record<string, unknown>) => {
  await getPool().execute(
    'INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?, ?)',
    [adminId, 'ADMIN', action, 'driver_profile', targetId, JSON.stringify(details)]
  ).catch((err) => console.error('[ADMIN] No se pudo auditar:', (err as Error).message));
};

export class AdminService {
  static async listDrivers(status?: DriverReviewStatus): Promise<DriverApplicationView[]> {
    const pool = getPool();
    const [rows] = status
      ? await pool.query<RowDataPacket[]>(`${SELECT} WHERE p.status = ? ORDER BY p.created_at ASC`, [status])
      : await pool.query<RowDataPacket[]>(`${SELECT} ORDER BY FIELD(p.status,'UNDER_REVIEW','PENDING','APPROVED','SUSPENDED','REJECTED'), p.created_at ASC`);
    return rows.map(toView);
  }

  static async approve(driverId: string, adminId: string): Promise<DriverApplicationView> {
    const pool = getPool();
    const [res] = await pool.execute(
      `UPDATE driver_profiles SET status = 'APPROVED', rejection_reason = NULL, reviewed_by = ?, reviewed_at = NOW(3) WHERE user_id = ?`,
      [adminId, driverId]
    );
    if ((res as { affectedRows: number }).affectedRows === 0) throw new HttpError(404, 'Motorizado no encontrado.');
    await audit(adminId, 'DRIVER_APPROVED', driverId, {});
    const [rows] = await pool.query<RowDataPacket[]>(`${SELECT} WHERE p.user_id = ?`, [driverId]);
    return toView(rows[0]);
  }

  static async reject(driverId: string, adminId: string, reason: string): Promise<DriverApplicationView> {
    const cleanReason = reason.trim().slice(0, 255);
    if (!cleanReason) throw new HttpError(400, 'Escribe el motivo del rechazo.');
    const pool = getPool();
    const [res] = await pool.execute(
      `UPDATE driver_profiles SET status = 'REJECTED', rejection_reason = ?, reviewed_by = ?, reviewed_at = NOW(3) WHERE user_id = ?`,
      [cleanReason, adminId, driverId]
    );
    if ((res as { affectedRows: number }).affectedRows === 0) throw new HttpError(404, 'Motorizado no encontrado.');
    await audit(adminId, 'DRIVER_REJECTED', driverId, { reason: cleanReason });
    const [rows] = await pool.query<RowDataPacket[]>(`${SELECT} WHERE p.user_id = ?`, [driverId]);
    return toView(rows[0]);
  }
}
