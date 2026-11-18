/**
 * Prueba de punta a punta del panel admin (aprobar/rechazar motorizados)
 * contra MySQL/MariaDB real. Requiere schema.sql + migraciones 001-004
 * y variables DB_* / JWT_SECRET / OTP_SECRET / PRICING_HMAC_SECRET.
 * Uso: npx tsx scripts/test-admin-mysql.ts
 */
import type { AddressInfo } from 'net';
import { createApp } from '../server/app';
import { setSmsSender } from '../server/services/sms.service';
import { getPool, closePool } from '../server/config/mysql';
import { clearSettingsCache } from '../server/services/settings.service';

const inbox = new Map<string, string>();
setSmsSender({ async send(phone: string, text: string) { const m = text.match(/(\d{6})/); if (m) inbox.set(phone, m[1]); } });

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, extra?: unknown) => {
  if (cond) { passed++; console.log(`  [PASS] ${name}`); }
  else { failed++; console.log(`  [FAIL] ${name}`, extra === undefined ? '' : JSON.stringify(extra).slice(0, 400)); }
};

type J = Record<string, any>;
const PHONES = ['+51900000041', '+51900000042', '+51900000043', '+51900000044'];

const cleanup = async () => {
  const pool = getPool();
  const [u] = await pool.query<import('mysql2').RowDataPacket[]>(
    `SELECT id FROM users WHERE phone IN (${PHONES.map(() => '?').join(',')})`, PHONES
  );
  const ids = u.map((r) => r.id as string);
  if (ids.length) {
    const ph = ids.map(() => '?').join(',');
    await pool.query(`DELETE FROM audit_logs WHERE target_id IN (${ph}) OR actor_id IN (${ph})`, [...ids, ...ids]);
    await pool.query(`DELETE FROM drivers_online WHERE driver_id IN (${ph})`, ids);
    await pool.query(`DELETE FROM refresh_tokens WHERE user_id IN (${ph})`, ids);
    await pool.query(`DELETE FROM wallets WHERE driver_id IN (${ph})`, ids);
    await pool.query(`DELETE FROM driver_profiles WHERE user_id IN (${ph})`, ids);
    await pool.query(`DELETE FROM users WHERE id IN (${ph})`, ids);
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

  try {
    const cliente = await register(PHONES[0], 'Cliente Cualquiera', 'CLIENTE');
    const d1 = await register(PHONES[1], 'Moto Nueva Uno', 'MOTORIZADO');
    const d2 = await register(PHONES[2], 'Moto Nueva Dos', 'MOTORIZADO');

    console.log('Acceso al panel');
    let r = await call('GET', '/admin/drivers', cliente.token);
    check('un cliente normal no entra al panel admin', r.status === 403, r.json);
    r = await call('GET', '/admin/drivers', d1.token);
    check('un motorizado normal no entra al panel admin', r.status === 403, r.json);

    // Da permisos de admin (como se hace hoy a mano, por phpMyAdmin) y renueva el token:
    // el "adm" del JWT se fija al entrar, así que hay que volver a loguearse para que se note.
    let admin = await register(PHONES[3], 'Admin Prueba', 'CLIENTE');
    await pool.query('UPDATE users SET is_admin = 1 WHERE id = ?', [admin.id]);
    const loginAdmin = await call('POST', '/auth/login', undefined, { phone: PHONES[3].replace('+51', ''), password: 'clave123' });
    admin = { ...admin, token: String(loginAdmin.json.accessToken) };

    console.log('Listado de pendientes');
    r = await call('GET', '/admin/drivers?status=PENDING', admin.token);
    check('ambos motorizados nuevos aparecen pendientes', r.status === 200
      && r.json.drivers?.some((x: J) => x.userId === d1.id) && r.json.drivers?.some((x: J) => x.userId === d2.id), r.json);

    console.log('Aprobar y rechazar');
    r = await call('POST', `/admin/drivers/${d1.id}/approve`, admin.token);
    check('aprueba al primer motorizado', r.status === 200 && r.json.driver?.status === 'APPROVED', r.json);

    r = await call('POST', `/admin/drivers/${d2.id}/reject`, admin.token, { reason: 'Licencia vencida' });
    check('rechaza al segundo con motivo', r.status === 200 && r.json.driver?.status === 'REJECTED'
      && r.json.driver?.rejectionReason === 'Licencia vencida', r.json);

    r = await call('POST', `/admin/drivers/${d2.id}/reject`, admin.token, { reason: '   ' });
    check('rechazar sin motivo real es rechazado (400)', r.status === 400, r.json);

    r = await call('POST', `/admin/drivers/no-existe/approve`, admin.token);
    check('aprobar un id que no existe da 404', r.status === 404, r.json);

    console.log('El motorizado aprobado ya puede conectarse');
    r = await call('POST', '/rides/driver/presence', d1.token, { lat: -8.11, lng: -79.02, online: true });
    check('el aprobado se conecta sin problema', r.status === 200 && r.json.status === 'AVAILABLE', r.json);
    r = await call('POST', '/rides/driver/presence', d2.token, { lat: -8.11, lng: -79.02, online: true });
    check('el rechazado sigue sin poder conectarse', r.status === 403, r.json);

    console.log('Filtros del panel');
    r = await call('GET', '/admin/drivers?status=APPROVED', admin.token);
    check('el filtro de aprobados ya no trae al rechazado', r.status === 200
      && r.json.drivers?.some((x: J) => x.userId === d1.id) && !r.json.drivers?.some((x: J) => x.userId === d2.id), r.json);
    r = await call('GET', '/admin/drivers?status=REJECTED', admin.token);
    check('el filtro de rechazados trae al segundo motorizado', r.status === 200
      && r.json.drivers?.some((x: J) => x.userId === d2.id), r.json);
  } finally {
    await cleanup();
    server.close();
    await closePool();
  }
  console.log(`\nResultado: ${passed} OK, ${failed} fallas`);
  process.exit(failed ? 1 : 0);
};

main().catch((e) => { console.error(e); process.exit(1); });
