/**
 * Prueba de punta a punta de la billetera (deuda de comisión) y la recarga
 * Yape manual, contra MySQL/MariaDB real.
 * Requiere schema.sql + migraciones 001-005 y variables DB_* / JWT_SECRET / OTP_SECRET.
 * Uso: npx tsx scripts/test-wallet-mysql.ts
 */
import type { AddressInfo } from 'net';
import { createApp } from '../server/app';
import { setSmsSender } from '../server/services/sms.service';
import { setRouteProvider, MockRouteProvider } from '../server/services/routes.service';
import { getPool, closePool } from '../server/config/mysql';
import { clearSettingsCache } from '../server/services/settings.service';

const inbox = new Map<string, string>();
setSmsSender({ async send(phone: string, text: string) { const m = text.match(/(\d{6})/); if (m) inbox.set(phone, m[1]); } });
setRouteProvider(new MockRouteProvider({ distanceKm: 3.2, durationMinutes: 9 }));

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, extra?: unknown) => {
  if (cond) { passed++; console.log(`  [PASS] ${name}`); }
  else { failed++; console.log(`  [FAIL] ${name}`, extra === undefined ? '' : JSON.stringify(extra).slice(0, 400)); }
};

type J = Record<string, any>;
const PHONES = ['+51900000051', '+51900000052', '+51900000053'];
const PLAZA = { lat: -8.1116, lng: -79.0288 };
const DEST = { lat: -8.0950, lng: -79.0400 };

const cleanup = async () => {
  const pool = getPool();
  const [u] = await pool.query<import('mysql2').RowDataPacket[]>(
    `SELECT id FROM users WHERE phone IN (${PHONES.map(() => '?').join(',')})`, PHONES
  );
  const ids = u.map((r) => r.id as string);
  if (ids.length) {
    const ph = ids.map(() => '?').join(',');
    const [rides] = await pool.query<import('mysql2').RowDataPacket[]>(`SELECT id FROM rides WHERE passenger_id IN (${ph})`, ids);
    const rIds = rides.map((r) => r.id as string);
    if (rIds.length) {
      const rp = rIds.map(() => '?').join(',');
      for (const t of ['assignments', 'dispatch_logs', 'operational_events']) await pool.query(`DELETE FROM ${t} WHERE ride_id IN (${rp})`, rIds);
      await pool.query(`DELETE FROM idempotency_keys WHERE resource_id IN (${rp})`, rIds);
      await pool.query(`DELETE FROM rides WHERE id IN (${rp})`, rIds);
    }
    await pool.query(`DELETE FROM wallet_movements WHERE driver_id IN (${ph})`, ids);
    await pool.query(`DELETE FROM topup_requests WHERE driver_id IN (${ph})`, ids);
    await pool.query(`DELETE FROM drivers_online WHERE driver_id IN (${ph})`, ids);
    await pool.query(`DELETE FROM refresh_tokens WHERE user_id IN (${ph})`, ids);
    await pool.query(`DELETE FROM audit_logs WHERE actor_id IN (${ph}) OR target_id IN (${ph})`, [...ids, ...ids]);
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
  const quote = async (token: string) => (await call('POST', '/pricing/quote', token, {
    originLat: PLAZA.lat, originLng: PLAZA.lng, destLat: DEST.lat, destLng: DEST.lng,
    originAddress: 'Plaza de Armas, Trujillo', destAddress: 'Av. España 1200, Trujillo',
  })).json.quote;
  const pool = getPool();

  try {
    const cli = await register(PHONES[0], 'Cliente Billetera', 'CLIENTE');
    const drv = await register(PHONES[1], 'Moto Billetera', 'MOTORIZADO');
    let admin = await register(PHONES[2], 'Admin Billetera', 'CLIENTE');
    await pool.query('UPDATE users SET is_admin = 1 WHERE id = ?', [admin.id]);
    const loginAdmin = await call('POST', '/auth/login', undefined, { phone: PHONES[2].replace('+51', ''), password: 'clave123' });
    admin = { ...admin, token: String(loginAdmin.json.accessToken) };

    console.log('Billetera recién creada');
    let r = await call('GET', '/wallet/me', drv.token);
    check('billetera arranca en S/ 0.00 de deuda', r.status === 200 && r.json.wallet?.cashDebt === 0, r.json);
    r = await call('GET', '/wallet/me', cli.token);
    check('un cliente no tiene billetera de motorizado', r.status === 403, r.json);

    console.log('Días gratis para motorizado nuevo: aprobar y simular que ya pasaron');
    await call('POST', `/admin/drivers/${drv.id}/approve`, admin.token);
    // Lo aprobamos "hace 20 días" para que ya no esté en el periodo gratis de 14 días.
    await pool.query(`UPDATE driver_profiles SET reviewed_at = reviewed_at - INTERVAL 20 DAY WHERE user_id = ?`, [drv.id]);

    console.log('Completar un pedido cobra comisión como deuda');
    let o = await call('POST', '/rides/driver/presence', drv.token, { lat: PLAZA.lat, lng: PLAZA.lng, online: true });
    check('motorizado aprobado se conecta', o.status === 200, o.json);
    const q = await quote(cli.token);
    r = await call('POST', '/rides/request', cli.token, { quote: q, paymentMethod: 'efectivo' });
    const rideId = String(r.json.ride?.id);
    const otp = String(r.json.otpCode);
    await new Promise((res) => setTimeout(res, 300));
    const offer = await call('GET', '/rides/driver/offer', drv.token);
    await call('POST', `/rides/driver/offers/${offer.json.offer.assignmentId}/accept`, drv.token);
    await call('POST', `/rides/${rideId}/status`, drv.token, { status: 'DRIVER_ARRIVING' });
    await call('POST', `/rides/${rideId}/status`, drv.token, { status: 'WAITING_FOR_OTP' });
    await call('POST', `/rides/${rideId}/verify-otp`, drv.token, { code: otp });
    r = await call('POST', `/rides/${rideId}/status`, drv.token, { status: 'COMPLETED' });
    check('el pedido se completa', r.json.ride?.status === 'COMPLETED', r.json);

    const expectedCommission = Math.max(Number(q.totalFare) * 0.10, 0.50);
    r = await call('GET', '/wallet/me', drv.token);
    check('la deuda sube con la comisión del pedido', Math.abs(r.json.wallet?.cashDebt - expectedCommission) < 0.01, { wallet: r.json.wallet, expectedCommission });
    r = await call('GET', '/wallet/movements', drv.token);
    check('el movimiento de comisión queda registrado', r.json.movements?.some((m: J) => m.type === 'platform_commission' && m.rideId === rideId), r.json);

    console.log('Recarga Yape: pedir, listar, acreditar');
    r = await call('POST', '/topups', cli.token, { amount: 20, operationNumber: '123456' });
    check('un cliente no puede pedir recarga de motorizado', r.status === 403, r.json);
    r = await call('POST', '/topups', drv.token, { amount: 20, operationNumber: '   ' });
    check('sin número de operación lo rechaza', r.status === 400, r.json);
    r = await call('POST', '/topups', drv.token, { amount: 20, operationNumber: '123456' });
    check('crea la recarga', r.status === 201 && r.json.topup?.status === 'RECEIPT_SUBMITTED', r.json);
    const topupId = String(r.json.topup?.id);
    r = await call('POST', '/topups', drv.token, { amount: 10, operationNumber: '999999' });
    check('no puede tener dos recargas esperando revisión', r.status === 409, r.json);

    r = await call('GET', '/topups?status=RECEIPT_SUBMITTED', drv.token);
    check('un motorizado no entra al listado del admin', r.status === 403, r.json);
    r = await call('GET', '/topups?status=RECEIPT_SUBMITTED', admin.token);
    check('el admin ve la recarga pendiente', r.json.topups?.some((t: J) => t.id === topupId), r.json);

    r = await call('POST', `/topups/${topupId}/credit`, admin.token);
    check('el admin acredita la recarga', r.status === 200 && r.json.topup?.status === 'CREDITED', r.json);
    r = await call('GET', '/wallet/me', drv.token);
    const expectedAfterCredit = Math.max(0, expectedCommission - 20);
    check('la deuda baja con la recarga acreditada', Math.abs(r.json.wallet?.cashDebt - expectedAfterCredit) < 0.01, r.json);
    r = await call('GET', '/wallet/movements', drv.token);
    check('el movimiento de recarga queda registrado', r.json.movements?.some((m: J) => m.type === 'topup_yape' && m.topupId === topupId), r.json);

    r = await call('POST', `/topups/${topupId}/credit`, admin.token);
    check('no se puede acreditar dos veces la misma recarga', r.status === 400, r.json);

    console.log('Rechazo de recarga');
    r = await call('POST', '/topups', drv.token, { amount: 5, operationNumber: '555555' });
    const topup2 = String(r.json.topup?.id);
    r = await call('POST', `/topups/${topup2}/reject`, admin.token, { reason: '   ' });
    check('rechazar sin motivo real es rechazado', r.status === 400, r.json);
    r = await call('POST', `/topups/${topup2}/reject`, admin.token, { reason: 'No se ve el Yape en la cuenta' });
    check('rechaza la recarga con motivo', r.status === 200 && r.json.topup?.status === 'REJECTED', r.json);

    console.log('Límite de deuda bloquea la conexión');
    await pool.query('UPDATE wallets SET cash_debt = 60 WHERE driver_id = ?', [drv.id]);
    await call('POST', '/rides/driver/presence', drv.token, { lat: PLAZA.lat, lng: PLAZA.lng, online: false });
    r = await call('POST', '/rides/driver/presence', drv.token, { lat: PLAZA.lat, lng: PLAZA.lng, online: true });
    check('con deuda sobre el límite no puede conectarse', r.status === 403, r.json);
    await pool.query('UPDATE wallets SET cash_debt = 0 WHERE driver_id = ?', [drv.id]);
    r = await call('POST', '/rides/driver/presence', drv.token, { lat: PLAZA.lat, lng: PLAZA.lng, online: true });
    check('al pagar la deuda puede conectarse de nuevo', r.status === 200, r.json);
  } finally {
    await cleanup();
    server.close();
    await closePool();
  }
  console.log(`\nResultado: ${passed} OK, ${failed} fallas`);
  process.exit(failed ? 1 : 0);
};

main().catch((e) => { console.error(e); process.exit(1); });
