/**
 * Prueba de punta a punta del ciclo de pedidos contra MySQL/MariaDB real.
 * Requiere base con database/schema.sql + database/migrations/002_pedidos.sql
 * y variables DB_* y JWT_SECRET (o JWT_SECRET_FILE).
 * Uso: npx tsx scripts/test-rides-mysql.ts
 */
import type { AddressInfo } from 'net';
import { createApp } from '../server/app';
import { setSmsSender } from '../server/services/sms.service';
import { setRouteProvider, MockRouteProvider } from '../server/services/routes.service';
import { getPool, closePool } from '../server/config/mysql';
import { DispatchService } from '../server/services/dispatch.service';
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

type J = Record<string, any>; // respuesta JSON libre de la API (solo en pruebas)
const PHONES = ['+51900000001', '+51900000002', '+51900000003', '+51900000004'];

// Plaza de Armas de Trujillo y alrededores
const PLAZA = { lat: -8.1116, lng: -79.0288 };
const NEAR = { lat: -8.1150, lng: -79.0300 };   // ~0.4 km
const FAR = { lat: -8.1280, lng: -79.0350 };    // ~2 km
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
    await pool.query(`DELETE FROM drivers_online WHERE driver_id IN (${ph})`, ids);
    await pool.query(`DELETE FROM refresh_tokens WHERE user_id IN (${ph})`, ids);
    await pool.query(`DELETE FROM audit_logs WHERE actor_id IN (${ph})`, ids);
    await pool.query(`DELETE FROM wallets WHERE driver_id IN (${ph})`, ids);
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
    const cli = await register(PHONES[0], 'Cliente Prueba', 'CLIENTE');
    const d1 = await register(PHONES[1], 'Moto Cerca', 'MOTORIZADO');
    const d2 = await register(PHONES[2], 'Moto Lejos', 'MOTORIZADO');
    const d3 = await register(PHONES[3], 'Moto Sin Aprobar', 'MOTORIZADO');
    await pool.query(`UPDATE driver_profiles SET status = 'APPROVED' WHERE user_id IN (?, ?)`, [d1.id, d2.id]);

    console.log('Motorizados en línea');
    let r = await call('POST', '/rides/driver/presence', d3.token, { ...NEAR, online: true });
    check('sin documentos aprobados no puede conectarse', r.status === 403, r.json);
    r = await call('POST', '/rides/driver/presence', cli.token, { ...NEAR, online: true });
    check('un cliente no puede usar funciones de motorizado', r.status === 403, r.json);
    r = await call('POST', '/rides/driver/presence', d1.token, { ...NEAR, online: true });
    check('motorizado aprobado se conecta', r.status === 200 && r.json.status === 'AVAILABLE', r.json);
    await call('POST', '/rides/driver/presence', d2.token, { ...FAR, online: true });

    console.log('Cotizar y pedir');
    const q1 = await quote(cli.token);
    check('cotización firmada con precio', !!q1?.pricingSeal && q1.totalFare >= 5, q1);
    r = await call('POST', '/rides/request', cli.token, { quote: { ...q1, totalFare: 1 } });
    check('precio alterado es rechazado', r.status === 400, r.json);
    r = await call('POST', '/rides/request', cli.token, { quote: q1, paymentMethod: 'yape', delivery: { description: 'Sobre con documentos', receptorName: 'Ana', receptorPhone: '944555666' } });
    check('pedido creado buscando motorizado', r.status === 201 && r.json.ride?.status === 'SEARCHING_DRIVER', r.json);
    check('el cliente recibe código de recojo de 4 dígitos', /^\d{4}$/.test(String(r.json.otpCode)));
    const rideA = String(r.json.ride?.id);
    const otpA = String(r.json.otpCode);
    r = await call('POST', '/rides/request', cli.token, { quote: q1, paymentMethod: 'yape' });
    check('doble toque no duplica el pedido', r.json.ride?.id === rideA && r.json.idempotent === true, r.json);
    const q2 = await quote(cli.token);
    r = await call('POST', '/rides/request', cli.token, { quote: q2 });
    check('no puede tener dos pedidos activos', r.status === 409, r.json);

    console.log('Ofertas de 15 segundos');
    await new Promise((res) => setTimeout(res, 300));
    let o1 = await call('GET', '/rides/driver/offer', d1.token);
    const o2 = await call('GET', '/rides/driver/offer', d2.token);
    check('la oferta va primero al más cercano', o1.json.offer?.rideId === rideA && o2.json.offer === null, { o1: o1.json, o2: o2.json });
    check('la oferta muestra precio, recojo y segundos', o1.json.offer?.price === q1.totalFare && o1.json.offer?.expiresInSeconds <= 15);
    r = await call('POST', `/rides/driver/offers/${o1.json.offer.assignmentId}/reject`, d1.token);
    check('el cercano rechaza', r.status === 200, r.json);
    const o2b = await call('GET', '/rides/driver/offer', d2.token);
    check('pasa al siguiente al instante', o2b.json.offer?.rideId === rideA, o2b.json);
    r = await call('POST', `/rides/driver/offers/${o2b.json.offer.assignmentId}/accept`, d1.token);
    check('nadie puede aceptar la oferta de otro', r.status === 404, r.json);
    r = await call('POST', `/rides/driver/offers/${o2b.json.offer.assignmentId}/accept`, d2.token);
    check('el siguiente acepta: pedido asignado', r.status === 200 && r.json.ride?.status === 'DRIVER_ASSIGNED' && r.json.ride?.driverId === d2.id, r.json);
    r = await call('POST', `/rides/driver/offers/${o2b.json.offer.assignmentId}/accept`, d2.token);
    check('aceptar dos veces no rompe nada', r.status === 200, r.json);

    console.log('Seguimiento');
    r = await call('GET', `/rides/${rideA}`, cli.token);
    check('el cliente ve al motorizado asignado y su código', r.json.ride?.driverName === 'Moto Lejos' && r.json.ride?.otpCode === otpA, r.json);
    r = await call('GET', `/rides/${rideA}`, d1.token);
    check('otro motorizado no puede ver el pedido', r.status === 403);
    r = await call('GET', `/rides/${rideA}`, d2.token);
    check('el motorizado asignado NO ve el código', r.status === 200 && r.json.ride?.otpCode === undefined, r.json);
    r = await call('POST', '/rides/driver/presence', d2.token, { lat: -8.1200, lng: -79.0320, online: false });
    check('no puede desconectarse con un pedido en curso', r.status === 409, r.json);
    await call('POST', '/rides/driver/presence', d2.token, { lat: -8.1200, lng: -79.0320, online: true });
    r = await call('GET', `/rides/${rideA}`, cli.token);
    check('el cliente ve la ubicación del motorizado', r.json.ride?.driverLocation?.lat === -8.12, r.json.ride?.driverLocation);
    r = await call('GET', '/rides/active', d2.token);
    check('al abrir la app recupera su pedido activo', r.json.ride?.id === rideA);

    console.log('Recojo con código y entrega');
    r = await call('POST', `/rides/${rideA}/status`, d2.token, { status: 'IN_PROGRESS' });
    check('no puede saltarse el código', r.status === 400, r.json);
    r = await call('POST', `/rides/${rideA}/status`, d2.token, { status: 'DRIVER_ARRIVING' });
    check('en camino al recojo', r.json.ride?.status === 'DRIVER_ARRIVING', r.json);
    r = await call('POST', `/rides/${rideA}/verify-otp`, d2.token, { code: otpA });
    check('el código solo vale al llegar', r.status === 400, r.json);
    r = await call('POST', `/rides/${rideA}/status`, d2.token, { status: 'WAITING_FOR_OTP' });
    check('llegó al recojo', r.json.ride?.status === 'WAITING_FOR_OTP', r.json);
    const wrong = otpA === '1111' ? '2222' : '1111';
    r = await call('POST', `/rides/${rideA}/verify-otp`, d2.token, { code: wrong });
    check('código equivocado: avisa intentos restantes', r.status === 400 && /2 intentos/.test(String(r.json.message)), r.json);
    r = await call('POST', `/rides/${rideA}/verify-otp`, d2.token, { code: otpA });
    check('código correcto: en camino a la entrega', r.json.ride?.status === 'IN_PROGRESS', r.json);
    r = await call('POST', `/rides/${rideA}/cancel`, cli.token, {});
    check('ya en camino no se puede cancelar desde la app', r.status === 400, r.json);
    r = await call('POST', `/rides/${rideA}/status`, d2.token, { status: 'COMPLETED' });
    check('entregado', r.json.ride?.status === 'COMPLETED' && !!r.json.ride?.completedAt, r.json);
    const [dp] = await pool.query<import('mysql2').RowDataPacket[]>('SELECT status FROM drivers_online WHERE driver_id = ?', [d2.id]);
    check('el motorizado vuelve a quedar disponible', dp[0]?.status === 'AVAILABLE', dp[0]);

    console.log('Oferta vencida y cancelación');
    const q3 = await quote(cli.token);
    r = await call('POST', '/rides/request', cli.token, { quote: q3 });
    const rideB = String(r.json.ride?.id);
    await new Promise((res) => setTimeout(res, 300));
    o1 = await call('GET', '/rides/driver/offer', d1.token);
    check('nuevo pedido ofrecido al más cercano', o1.json.offer?.rideId === rideB, o1.json);
    await pool.query(`UPDATE assignments SET expires_at = NOW(3) - INTERVAL 1 SECOND WHERE ride_id = ? AND status = 'OFFERED'`, [rideB]);
    await DispatchService.sweep();
    const o2c = await call('GET', '/rides/driver/offer', d2.token);
    check('si no responde en 15 s, pasa al siguiente', o2c.json.offer?.rideId === rideB, o2c.json);
    r = await call('POST', `/rides/driver/offers/${o1.json.offer.assignmentId}/accept`, d1.token);
    check('la oferta vencida ya no se puede aceptar', r.status === 409, r.json);
    r = await call('POST', `/rides/${rideB}/cancel`, cli.token, { reason: 'Ya no lo necesito' });
    check('el cliente cancela mientras busca', r.json.ride?.status === 'CANCELLED', r.json);
    const o2d = await call('GET', '/rides/driver/offer', d2.token);
    check('la oferta desaparece al cancelar', o2d.json.offer === null, o2d.json);

    console.log('Sin motorizados');
    await call('POST', '/rides/driver/presence', d1.token, { ...NEAR, online: false });
    await call('POST', '/rides/driver/presence', d2.token, { ...FAR, online: false });
    const q4 = await quote(cli.token);
    r = await call('POST', '/rides/request', cli.token, { quote: q4 });
    const rideC = String(r.json.ride?.id);
    await new Promise((res) => setTimeout(res, 300));
    await pool.query('UPDATE rides SET search_expires_at = NOW(3) - INTERVAL 1 SECOND WHERE id = ?', [rideC]);
    await DispatchService.sweep();
    r = await call('GET', `/rides/${rideC}`, cli.token);
    check('si nadie acepta a tiempo, el pedido vence', r.json.ride?.status === 'EXPIRED', r.json);

    console.log('Carrera: dos aceptan a la vez');
    await call('POST', '/rides/driver/presence', d1.token, { ...NEAR, online: true });
    const q5 = await quote(cli.token);
    r = await call('POST', '/rides/request', cli.token, { quote: q5 });
    const rideD = String(r.json.ride?.id);
    await new Promise((res) => setTimeout(res, 300));
    o1 = await call('GET', '/rides/driver/offer', d1.token);
    const [a1, a2] = await Promise.all([
      call('POST', `/rides/driver/offers/${o1.json.offer.assignmentId}/accept`, d1.token),
      call('POST', `/rides/driver/offers/${o1.json.offer.assignmentId}/accept`, d1.token),
    ]);
    const [cnt] = await pool.query<import('mysql2').RowDataPacket[]>(`SELECT COUNT(*) AS n FROM assignments WHERE ride_id = ? AND status = 'ACCEPTED'`, [rideD]);
    check('aceptación simultánea: una sola asignación', a1.status === 200 && a2.status === 200 && Number(cnt[0]?.n) === 1, { a1: a1.status, a2: a2.status, n: cnt[0]?.n });
    await call('POST', `/rides/${rideD}/cancel`, d1.token, { reason: 'prueba' });
  } finally {
    await cleanup();
    server.close();
    await closePool();
  }
  console.log(`\nResultado: ${passed} OK, ${failed} fallas`);
  process.exit(failed ? 1 : 0);
};

main().catch((e) => { console.error(e); process.exit(1); });
