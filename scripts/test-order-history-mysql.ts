/**
 * Prueba de punta a punta del historial de pedidos (/api/rides/history),
 * contra MySQL/MariaDB real.
 * Uso: npx tsx scripts/test-order-history-mysql.ts
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
const PHONES = ['+51900000061', '+51900000062', '+51900000063'];
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
    const [rides] = await pool.query<import('mysql2').RowDataPacket[]>(
      `SELECT id FROM rides WHERE passenger_id IN (${ph}) OR driver_id IN (${ph})`, [...ids, ...ids]
    );
    const rIds = rides.map((r) => r.id as string);
    if (rIds.length) {
      const rp = rIds.map(() => '?').join(',');
      for (const t of ['assignments', 'dispatch_logs', 'operational_events']) await pool.query(`DELETE FROM ${t} WHERE ride_id IN (${rp})`, rIds);
      await pool.query(`DELETE FROM idempotency_keys WHERE resource_id IN (${rp})`, rIds);
      await pool.query(`DELETE FROM rides WHERE id IN (${rp})`, rIds);
    }
    await pool.query(`DELETE FROM wallet_movements WHERE driver_id IN (${ph})`, ids);
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
    const cli = await register(PHONES[0], 'Cliente Historial', 'CLIENTE');
    const drv = await register(PHONES[1], 'Moto Historial', 'MOTORIZADO');
    const admin = await register(PHONES[2], 'Admin Historial', 'CLIENTE');
    await pool.query('UPDATE users SET is_admin = 1 WHERE id = ?', [admin.id]);
    const loginAdmin = await call('POST', '/auth/login', undefined, { phone: PHONES[2].replace('+51', ''), password: 'clave123' });
    const adminToken = String(loginAdmin.json.accessToken);
    await call('POST', `/admin/drivers/${drv.id}/approve`, adminToken);

    console.log('Historial vacío al empezar');
    let r = await call('GET', '/rides/history', cli.token);
    check('cliente sin pedidos: historial vacío', r.status === 200 && Array.isArray(r.json.items) && r.json.items.length === 0 && r.json.total === 0, r.json);

    console.log('Un pedido activo no aparece en el historial');
    await call('POST', '/rides/driver/presence', drv.token, { lat: PLAZA.lat, lng: PLAZA.lng, online: true });
    let q = await quote(cli.token);
    r = await call('POST', '/rides/request', cli.token, { quote: q, paymentMethod: 'efectivo' });
    const activeRideId = String(r.json.ride?.id);
    r = await call('GET', '/rides/history', cli.token);
    check('pedido en curso no sale en el historial', !r.json.items.some((it: J) => it.id === activeRideId), r.json);
    r = await call('POST', `/rides/${activeRideId}/cancel`, cli.token, { reason: 'ya no lo necesito' });
    check('se cancela para dejar al cliente libre', r.json.ride?.status === 'CANCELLED', r.json);

    console.log('Pedido completado aparece en el historial de ambos');
    q = await quote(cli.token);
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

    r = await call('GET', '/rides/history', cli.token);
    check('el cliente ve el pedido completado', r.json.items?.[0]?.id === rideId && r.json.items[0].status === 'COMPLETED', r.json);
    check('el total cuenta cancelado + completado', r.json.total === 2, r.json);
    r = await call('GET', '/rides/history', drv.token);
    check('el motorizado también ve el pedido en su historial', r.json.items?.some((it: J) => it.id === rideId), r.json);
    check('el motorizado no ve pedidos ajenos (solo el suyo)', r.json.total === 1, r.json);

    console.log('Orden: el más reciente primero');
    r = await call('GET', '/rides/history', cli.token);
    const createdDates = r.json.items.map((it: J) => it.createdAt);
    check('orden descendente por fecha', createdDates[0] >= createdDates[1], createdDates);

    console.log('Paginación: pageSize=1 trae de una en una, con hasMore');
    r = await call('GET', '/rides/history?page=1&pageSize=1', cli.token);
    check('primera página trae 1 ítem y avisa que hay más', r.json.items.length === 1 && r.json.hasMore === true, r.json);
    const firstId = r.json.items[0].id;
    r = await call('GET', '/rides/history?page=2&pageSize=1', cli.token);
    check('segunda página trae el otro pedido, sin repetir', r.json.items.length === 1 && r.json.items[0].id !== firstId && r.json.hasMore === false, r.json);

    console.log('pageSize tiene un tope (no se puede pedir una página gigante)');
    r = await call('GET', '/rides/history?pageSize=9999', cli.token);
    check('pageSize se recorta a un máximo razonable', r.json.pageSize <= 50, r.json);

    console.log('Requiere sesión');
    r = await call('GET', '/rides/history');
    check('sin token: 401', r.status === 401, r.json);
  } finally {
    await cleanup();
    server.close();
    await closePool();
  }
  console.log(`\nResultado: ${passed} OK, ${failed} fallas`);
  process.exit(failed ? 1 : 0);
};

main().catch((e) => { console.error(e); process.exit(1); });
