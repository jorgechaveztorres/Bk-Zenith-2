/**
 * Prueba de punta a punta de los documentos del motorizado (vehículo,
 * licencia y fotos) contra MySQL/MariaDB real.
 * Requiere schema.sql + migraciones 001-006 y variables DB_* / JWT_SECRET.
 * Uso: npx tsx scripts/test-driver-documents-mysql.ts
 */
import type { AddressInfo } from 'net';
import fs from 'fs';
import path from 'path';
import { createApp } from '../server/app';
import { setSmsSender } from '../server/services/sms.service';
import { getPool, closePool } from '../server/config/mysql';
import { clearSettingsCache } from '../server/services/settings.service';
import { UPLOAD_ROOT } from '../server/services/driver-documents.service';

const inbox = new Map<string, string>();
setSmsSender({ async send(phone: string, text: string) { const m = text.match(/(\d{6})/); if (m) inbox.set(phone, m[1]); } });

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, extra?: unknown) => {
  if (cond) { passed++; console.log(`  [PASS] ${name}`); }
  else { failed++; console.log(`  [FAIL] ${name}`, extra === undefined ? '' : JSON.stringify(extra).slice(0, 400)); }
};

type J = Record<string, any>;
const PHONES = ['+51900000061', '+51900000062', '+51900000099'];

// 1x1 px JPEG válido, para probar la subida real.
const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAAAAAAAD/2wBDAAMDAwMDAwMDAwMEBAMEBQgFBQUFCgkICAgICQsLCwsLCwsLDA0NDRENDQ8PDw8PERQUFBQUGBgYGBgYGBgY/8AACwgAAQABAQERAP/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscFS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4eLj5OXm5+jp6vHy8/T19vf4+fr/2gAMAwEAAhEDEQA/AL+AAP/Z',
  'base64'
);

const cleanup = async () => {
  const pool = getPool();
  const [u] = await pool.query<import('mysql2').RowDataPacket[]>(
    `SELECT id FROM users WHERE phone IN (${PHONES.map(() => '?').join(',')})`, PHONES
  );
  const ids = u.map((r) => r.id as string);
  if (ids.length) {
    const ph = ids.map(() => '?').join(',');
    await pool.query(`DELETE FROM audit_logs WHERE actor_id IN (${ph}) OR target_id IN (${ph})`, [...ids, ...ids]);
    await pool.query(`DELETE FROM drivers_online WHERE driver_id IN (${ph})`, ids);
    await pool.query(`DELETE FROM refresh_tokens WHERE user_id IN (${ph})`, ids);
    await pool.query(`DELETE FROM wallets WHERE driver_id IN (${ph})`, ids);
    await pool.query(`DELETE FROM driver_profiles WHERE user_id IN (${ph})`, ids);
    await pool.query(`DELETE FROM users WHERE id IN (${ph})`, ids);
    for (const id of ids) fs.rmSync(path.join(UPLOAD_ROOT, id), { recursive: true, force: true });
  }
  await pool.query(`DELETE FROM otp_codes WHERE phone IN (${PHONES.map(() => '?').join(',')})`, PHONES);
};

const main = async () => {
  clearSettingsCache();
  await cleanup();
  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const call = async (method: string, path: string, token?: string, body?: unknown) => {
    const r = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, json: (await r.json()) as J };
  };
  const register = async (phone: string, name: string, role: 'CLIENTE' | 'MOTORIZADO') => {
    await call('POST', '/auth/register/start', undefined, { phone });
    const r = await call('POST', '/auth/register/verify', undefined, { phone, code: inbox.get(phone), password: 'clave123', fullName: name, role });
    return { token: String(r.json.accessToken), id: String(r.json.user?.id) };
  };
  const pool = getPool();

  const submitDocs = async (token: string, fields: Record<string, string>, opts: { withLicense?: boolean; withVehicle?: boolean } = { withLicense: true, withVehicle: true }) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.set(k, v);
    if (opts.withLicense !== false) form.set('licensePhoto', new Blob([TINY_JPEG], { type: 'image/jpeg' }), 'licencia.jpg');
    if (opts.withVehicle !== false) form.set('vehiclePhoto', new Blob([TINY_JPEG], { type: 'image/jpeg' }), 'vehiculo.jpg');
    const r = await fetch(`${base}/driver/profile`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    return { status: r.status, json: (await r.json()) as J };
  };

  try {
    const cli = await register(PHONES[0], 'Cliente Documentos', 'CLIENTE');
    const drv = await register(PHONES[1], 'Moto Documentos', 'MOTORIZADO');

    console.log('Perfil vacío al registrarse');
    let r = await call('GET', '/driver/profile', drv.token);
    check('arranca sin fotos', r.status === 200 && r.json.profile?.status === 'PENDING' && !r.json.profile?.hasLicensePhoto, r.json);
    r = await call('GET', '/driver/profile', cli.token);
    check('un cliente no tiene perfil de motorizado', r.status === 403, r.json);

    console.log('Enviar documentos incompletos');
    let res = await submitDocs(drv.token, { vehiclePlate: 'T1A-123', licenseNumber: 'Q12345678' }, { withVehicle: false });
    check('sin foto del vehículo lo rechaza', res.status === 400, res.json);
    res = await submitDocs(drv.token, { vehiclePlate: '', licenseNumber: 'Q12345678' });
    check('sin placa lo rechaza', res.status === 400, res.json);

    console.log('Enviar documentos completos');
    res = await submitDocs(drv.token, {
      vehicleCategory: 'moto', vehiclePlate: 'T1A-123', vehicleBrand: 'Honda', vehicleModel: 'CB110',
      vehicleYear: '2022', vehicleColor: 'Rojo', licenseNumber: 'Q12345678', licenseExpiry: '2027-05-01', yapePlinPhone: '944555666',
    });
    check('se guardan y pasa a revisión', res.status === 200 && res.json.profile?.status === 'UNDER_REVIEW'
      && res.json.profile?.hasLicensePhoto && res.json.profile?.hasVehiclePhoto && res.json.profile?.vehicle?.plate === 'T1A-123', res.json);

    console.log('El admin ve la solicitud con evidencia');
    let admin = await register('+51900000099', 'Admin Documentos', 'CLIENTE');
    await pool.query('UPDATE users SET is_admin = 1 WHERE id = ?', [admin.id]);
    const loginAdmin = await call('POST', '/auth/login', undefined, { phone: '900000099', password: 'clave123' });
    admin = { ...admin, token: String(loginAdmin.json.accessToken) };
    r = await call('GET', '/admin/drivers?status=UNDER_REVIEW', admin.token);
    const entry = r.json.drivers?.find((d: J) => d.userId === drv.id);
    check('aparece en revisión con ambas fotos marcadas', !!entry?.hasLicensePhoto && !!entry?.hasVehiclePhoto, entry);

    console.log('Ver las fotos (dueño y admin sí, terceros no)');
    const getDoc = (token: string, kind: string) =>
      fetch(`${base}/driver/documents/${drv.id}/${kind}`, { headers: { Authorization: `Bearer ${token}` } });
    let dr = await getDoc(drv.token, 'license');
    check('el motorizado ve su propia licencia', dr.status === 200 && (dr.headers.get('content-type') || '').includes('image'), { status: dr.status });
    dr = await getDoc(admin.token, 'vehicle');
    check('el admin ve la foto del vehículo', dr.status === 200 && (dr.headers.get('content-type') || '').includes('image'), { status: dr.status });
    dr = await getDoc(cli.token, 'license');
    check('otro usuario no puede ver el documento', dr.status === 403, { status: dr.status });

    console.log('Rechazar y volver a enviar');
    await call('POST', `/admin/drivers/${drv.id}/reject`, admin.token, { reason: 'Foto de licencia ilegible' });
    r = await call('GET', '/driver/profile', drv.token);
    check('queda rechazado con motivo', r.json.profile?.status === 'REJECTED' && r.json.profile?.rejectionReason, r.json);
    res = await submitDocs(drv.token, {
      vehicleCategory: 'moto', vehiclePlate: 'T1A-123', vehicleBrand: 'Honda', vehicleModel: 'CB110',
      vehicleYear: '2022', vehicleColor: 'Rojo', licenseNumber: 'Q12345678', licenseExpiry: '2027-05-01',
    });
    check('al reenviar vuelve a revisión y limpia el motivo', res.status === 200 && res.json.profile?.status === 'UNDER_REVIEW'
      && !res.json.profile?.rejectionReason, res.json);

    console.log('Aprobar con los documentos ya enviados');
    r = await call('POST', `/admin/drivers/${drv.id}/approve`, admin.token);
    check('se aprueba', r.status === 200 && r.json.driver?.status === 'APPROVED', r.json);
  } finally {
    await cleanup();
    server.close();
    await closePool();
  }
  console.log(`\nResultado: ${passed} OK, ${failed} fallas`);
  process.exit(failed ? 1 : 0);
};

main().catch((e) => { console.error(e); process.exit(1); });
