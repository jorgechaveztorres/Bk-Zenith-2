/**
 * Prueba de punta a punta de la calificación de pedidos (/api/rides/:id/rate),
 * contra MySQL/MariaDB real.
 * Uso: npx tsx scripts/test-rating-mysql.ts
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
const PHONES = ['+51900000071', '+51900000072', '+51900000073', '+51900000074'];
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

  const completeRide = async (cliToken: string, drvToken: string) => {
    const q = await quote(cliToken);
    let r = await call('POST', '/rides/request', cliToken, { quote: q, paymentMethod: 'efectivo' });
    const rideId = String(r.json.ride?.id);
    const otp = String(r.json.otpCode);
    await new Promise((res) => setTimeout(res, 300));
    const offer = await call('GET', '/rides/driver/offer', drvToken);
    await call('POST', `/rides/driver/offers/${offer.json.offer.assignmentId}/accept`, drvToken);
    await call('POST', `/rides/${rideId}/status`, drvToken, { status: 'DRIVER_ARRIVING' });
    await call('POST', `/rides/${rideId}/status`, drvToken, { status: 'WAITING_FOR_OTP' });
    await call('POST', `/rides/${rideId}/verify-otp`, drvToken, { code: otp });
    await call('POST', `/rides/${rideId}/status`, drvToken, { status: 'COMPLETED' });
    return rideId;
  };

  try {
    const cli1 = await register(PHONES[0], 'Cliente Rating 1', 'CLIENTE');
    const cli2 = await register(PHONES[1], 'Cliente Rating 2', 'CLIENTE');
    const drv = await register(PHONES[2], 'Moto Rating', 'MOTORIZADO');
    const admin = await register(PHONES[3], 'Admin Rating', 'CLIENTE');
    await pool.query('UPDATE users SET is_admin = 1 WHERE id = ?', [admin.id]);
    const loginAdmin = await call('POST', '/auth/login', undefined, { phone: PHONES[3].replace('+51', ''), password: 'clave123' });
    const adminToken = String(loginAdmin.json.accessToken);
    await call('POST', `/admin/drivers/${drv.id}/approve`, adminToken);
    await call('POST', '/rides/driver/presence', drv.token, { lat: PLAZA.lat, lng: PLAZA.lng, online: true });

    console.log('No se puede calificar un pedido que no existe o no es propio');
    let r = await call('POST', '/rides/not-a-real-id/rate', cli1.token, { rating: 5 });
    check('pedido inexistente: 404', r.status === 404, r.json);

    console.log('No se puede calificar antes de que termine');
    const q = await quote(cli1.token);
    r = await call('POST', '/rides/request', cli1.token, { quote: q, paymentMethod: 'efectivo' });
    const earlyRideId = String(r.json.ride?.id);
    r = await call('POST', `/rides/${earlyRideId}/rate`, cli1.token, { rating: 5 });
    check('pedido no entregado: 400', r.status === 400, r.json);
    await call('POST', `/rides/${earlyRideId}/cancel`, cli1.token, { reason: 'prueba' });

    console.log('Calificar un pedido entregado');
    const rideId = await completeRide(cli1.token, drv.token);
    r = await call('POST', `/rides/${rideId}/rate`, cli1.token, { rating: 0 });
    check('calificación fuera de rango (0): 400', r.status === 400, r.json);
    r = await call('POST', `/rides/${rideId}/rate`, cli1.token, { rating: 6 });
    check('calificación fuera de rango (6): 400', r.status === 400, r.json);
    r = await call('POST', `/rides/${rideId}/rate`, cli1.token, { rating: 4, feedback: 'Buen servicio, llegó rápido' });
    check('califica con 4 estrellas y comentario', r.status === 200 && r.json.ride?.rating === 4, r.json);
    check('el comentario queda guardado', r.json.ride?.feedback === 'Buen servicio, llegó rápido', r.json);

    r = await call('POST', `/rides/${rideId}/rate`, cli1.token, { rating: 5 });
    check('no se puede calificar dos veces el mismo pedido', r.status === 409, r.json);

    console.log('Otro cliente no puede calificar un pedido que no es suyo');
    r = await call('POST', `/rides/${rideId}/rate`, cli2.token, { rating: 1 });
    check('calificar un pedido ajeno: 403', r.status === 403, r.json);

    console.log('El promedio del motorizado se recalcula');
    let dr = await call('GET', '/admin/drivers?status=APPROVED', adminToken);
    let found = dr.json.drivers?.find((a: J) => a.userId === drv.id);
    check('el promedio refleja la primera calificación (4.00)', Number(found?.rating) === 4, found);

    const rideId2 = await completeRide(cli2.token, drv.token);
    r = await call('POST', `/rides/${rideId2}/rate`, cli2.token, { rating: 2 });
    check('segundo cliente califica con 2 estrellas', r.status === 200 && r.json.ride?.rating === 2, r.json);

    dr = await call('GET', '/admin/drivers?status=APPROVED', adminToken);
    found = dr.json.drivers?.find((a: J) => a.userId === drv.id);
    check('el promedio ahora es (4+2)/2 = 3.00', Number(found?.rating) === 3, found);

    console.log('El motorizado no puede calificarse a sí mismo');
    r = await call('POST', `/rides/${rideId2}/rate`, drv.token, { rating: 5 });
    check('el motorizado no puede calificar: 403', r.status === 403, r.json);

    console.log('Requiere sesión');
    r = await call('POST', `/rides/${rideId}/rate`, undefined, { rating: 5 });
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
