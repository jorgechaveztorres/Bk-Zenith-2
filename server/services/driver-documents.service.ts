/**
 * ZÉNITH — DOCUMENTOS DEL MOTORIZADO (vehículo, licencia, fotos)
 *
 * El motorizado llena sus datos y sube la foto de su licencia/brevete y
 * del vehículo. Al enviarlos, su estado pasa a UNDER_REVIEW (si estaba
 * PENDING o REJECTED) para que el admin lo revise con evidencia real,
 * en vez de aprobar solo con el texto de la solicitud.
 */
import fs from 'fs';
import path from 'path';
import type { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../config/mysql';
import { HttpError } from './http-error';

export const UPLOAD_ROOT = path.join(process.cwd(), 'uploads', 'driver-docs');

export type DocumentKind = 'license' | 'vehicle';

export interface DriverProfileView {
  userId: string;
  status: string;
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
  yapePlinPhone: string | null;
  hasLicensePhoto: boolean;
  hasVehiclePhoto: boolean;
  documentsSubmittedAt: string | null;
  rejectionReason: string | null;
}

const toIso = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : v ? String(v) : null);

const str = (v: unknown, max: number): string | null => {
  const s = typeof v === 'string' ? v.trim().slice(0, max) : '';
  return s || null;
};

const SELECT = `
  SELECT user_id, status, vehicle_category, vehicle_plate, vehicle_brand, vehicle_model, vehicle_year, vehicle_color,
         license_number, license_expiry, yape_plin_phone, license_photo_path, vehicle_photo_path,
         documents_submitted_at, rejection_reason
  FROM driver_profiles WHERE user_id = ?
`;

const toView = (r: RowDataPacket): DriverProfileView => ({
  userId: String(r.user_id),
  status: String(r.status),
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
  yapePlinPhone: r.yape_plin_phone ?? null,
  hasLicensePhoto: Boolean(r.license_photo_path),
  hasVehiclePhoto: Boolean(r.vehicle_photo_path),
  documentsSubmittedAt: toIso(r.documents_submitted_at),
  rejectionReason: r.rejection_reason ?? null,
});

export interface SubmitDocumentsInput {
  vehicleCategory?: unknown;
  vehiclePlate?: unknown;
  vehicleBrand?: unknown;
  vehicleModel?: unknown;
  vehicleYear?: unknown;
  vehicleColor?: unknown;
  licenseNumber?: unknown;
  licenseExpiry?: unknown;
  yapePlinPhone?: unknown;
  licensePhotoPath: string | null;
  vehiclePhotoPath: string | null;
}

export class DriverDocumentsService {
  static async getProfile(driverId: string): Promise<DriverProfileView> {
    const [rows] = await getPool().query<RowDataPacket[]>(SELECT, [driverId]);
    if (!rows[0]) throw new HttpError(404, 'Perfil de motorizado no encontrado.');
    return toView(rows[0]);
  }

  static async submit(driverId: string, input: SubmitDocumentsInput): Promise<DriverProfileView> {
    const plate = str(input.vehiclePlate, 15);
    const licenseNumber = str(input.licenseNumber, 30);
    if (!plate) throw new HttpError(400, 'Escribe la placa de tu vehículo.');
    if (!licenseNumber) throw new HttpError(400, 'Escribe el número de tu licencia/brevete.');

    const pool = getPool();
    const [cur] = await pool.query<RowDataPacket[]>('SELECT status, license_photo_path, vehicle_photo_path FROM driver_profiles WHERE user_id = ? FOR UPDATE', [driverId]);
    const current = cur[0];
    if (!current) throw new HttpError(404, 'Perfil de motorizado no encontrado.');

    const licensePhotoPath = input.licensePhotoPath || current.license_photo_path || null;
    const vehiclePhotoPath = input.vehiclePhotoPath || current.vehicle_photo_path || null;
    if (!licensePhotoPath) throw new HttpError(400, 'Sube la foto de tu licencia/brevete.');
    if (!vehiclePhotoPath) throw new HttpError(400, 'Sube una foto de tu vehículo con la placa visible.');

    const year = Number(input.vehicleYear);
    const expiry = typeof input.licenseExpiry === 'string' && input.licenseExpiry.trim() ? input.licenseExpiry.trim() : null;
    const nextStatus = (current.status === 'PENDING' || current.status === 'REJECTED') ? 'UNDER_REVIEW' : current.status;

    await pool.execute(
      `UPDATE driver_profiles SET
         vehicle_category = ?, vehicle_plate = ?, vehicle_brand = ?, vehicle_model = ?,
         vehicle_year = ?, vehicle_color = ?, license_number = ?, license_expiry = ?, yape_plin_phone = ?,
         license_photo_path = ?, vehicle_photo_path = ?, documents_submitted_at = NOW(3),
         status = ?, rejection_reason = CASE WHEN ? = 'UNDER_REVIEW' THEN NULL ELSE rejection_reason END
       WHERE user_id = ?`,
      [
        str(input.vehicleCategory, 40), plate, str(input.vehicleBrand, 60), str(input.vehicleModel, 60),
        Number.isFinite(year) ? year : null, str(input.vehicleColor, 30), licenseNumber, expiry, str(input.yapePlinPhone, 20),
        licensePhotoPath, vehiclePhotoPath, nextStatus, nextStatus, driverId,
      ]
    );
    return DriverDocumentsService.getProfile(driverId);
  }

  /** Ruta en disco del documento, si existe y el id es válido (evita path traversal). */
  static async resolveDocumentPath(driverId: string, kind: DocumentKind): Promise<string> {
    if (!/^[a-zA-Z0-9_-]+$/.test(driverId)) throw new HttpError(400, 'Id inválido.');
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT license_photo_path, vehicle_photo_path FROM driver_profiles WHERE user_id = ?`, [driverId]
    );
    const r = rows[0];
    if (!r) throw new HttpError(404, 'No encontrado.');
    const rel = kind === 'license' ? r.license_photo_path : r.vehicle_photo_path;
    if (!rel) throw new HttpError(404, 'Todavía no sube esta foto.');
    const full = path.join(UPLOAD_ROOT, String(rel));
    if (!full.startsWith(UPLOAD_ROOT) || !fs.existsSync(full)) throw new HttpError(404, 'Archivo no encontrado.');
    return full;
  }
}
