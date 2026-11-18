/**
 * Prueba de avisos en tiempo real (WebSocket) contra MySQL/MariaDB real.
 * Uso: npx tsx scripts/test-realtime-mysql.ts   (mismas variables que test-rides-mysql)
 */
import type { AddressInfo } from 'net';
import WebSocket from 'ws';
import type { RowDataPacket } from 'mysql2/promise';
import { createApp } from '../server/app';
import { RealtimeHub, realtimePaths } from '../server/realtime/hub';
import { setSmsSender } from '../server/services/sms.service';
import { setRouteProvider, EstimateRouteProvider } from '../server/services/routes.service';
import { getPool, closePool } from '../server/config/mysql';
import { clearSettingsCache } from '../server/services/settings.service';

process.env.BASE_PATH = '/zenith-api';
const inbox = new Map<string, string>();
setSmsSender({ async send(phone: string, text: string) { const m = text.match(/(\d{6})/); if (m) inbox.set(phone, m[1]); } });
setRouteProvider(new EstimateRouteProvider());

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, extra?: unknown) => {
  if (cond) { passed++; console.log(`  [PASS] ${name}`); }
  else { failed++; console.log(`  [FAIL] ${name}`, extra === undefined ? '' : JSON.stringify(extra).slice(0, 300)); }
};

type J = Record<string, any>; // JSON libre de la API (solo pruebas)
const PHONES = ['+51900000011', '+51900000012'];

const cleanup = async () => {
  const pool = getPool();
  const [u] = await pool.query<RowDataPacket[]>(`SELECT id FROM users WHERE phone IN (?, ?)`, PHONES);
  const ids = u.map((r) => String(r.id));
  if (ids.length) {
    const ph = ids.map(() => '?').join(',');
    const [rides] = await pool.query<RowDataPacket[]>(`SELECT id FROM rides WHERE passenger_id IN (${ph})`, ids);
    const rIds = rides.map((r) => String(r.id));
    if (rIds.length) {
      const rp = rIds.map(() => '?').join(',');
      for (const t of ['assignments', 'dispatch_logs', 'operational_events']) await pool.query(`DELETE FROM ${t} WHERE ride_id IN (${rp})`, rIds);
      await pool.query(`DELETE FROM idempotency_keys WHERE resource_id IN (${rp})`, rIds);
      await pool.query(`DELETE FROM rides WHERE id IN (${rp})`, rIds);
    }
    for (const [t, c] of [['drivers_online', 'driver_id'], ['refresh_tokens', 'user_id'], ['audit_logs', 'actor_id'], ['wallets', 'driver_id']]) {
      await pool.query(`DELETE FROM ${t} WHERE ${c} IN (${ph})`, ids);
    }
    await pool.query(`DELETE FROM users WHERE id IN (${ph})`, ids);
  }
  await pool.query(`DELETE FROM otp_codes WHERE phone IN (?, ?)`, PHONES);
};

/** Cliente WebSocket que guarda los avisos recibidos. */
const connect = (url: string, token: string) => new Promise<{ ws: WebSocket; events: J[]; waitFor: (pred: (e: J) => boolean, ms?: number) => Promise<J | null> }>((resolve, reject) => {
  const ws = new WebSocket(url);
  const events: J[] = [];
  const waiters: Array<{ pred: (e: J) => boolean; done: (e: J | null) => void }> = [];
  ws.on('message', (raw) => {
    const e = JSON.parse(String(raw)) as J;
    events.push(e);
    for (const w of [...waiters]) if (w.pred(e)) { waiters.splice(waiters.indexOf(w), 1); w.done(e); }
    if (e.type === 'ready') resolve({ ws, events, waitFor });
  });
  ws.on('open', () => ws.send(JSON.stringify({ type: 'auth', token })));
  ws.on('close', (code) => reject(new Error(`cerrado ${code}`)));
  ws.on('error', reject);
  const waitFor = (pred: (e: J) => boolean, ms = 3000) => new Promise<J | null>((done) => {
    const hit = events.find(pred);
    if (hit) return done(hit);
    const w = { pred, done };
    waiters.push(w);
    setTimeout(() => { const i = waiters.indexOf(w); if (i >= 0) { waiters.splice(i, 1); done(null); } }, ms);
  });
});

const main = async () => {
  clearSettingsCache();
  await cleanup();
  const server = createApp().listen(0);
  const hub = new RealtimeHub(realtimePaths()).attach(server);
  const port = (server.address() as AddressInfo).port;
  const base = `http://127.0.0.1:${port}/zenith-api/api`;
  const wsUrl = `ws://127.0.0.1:${port}/zenith-api/ws`;
  const call = async (method: string, path: string, token?: string, body?: unknown) => {
    const r = await fetch(base + path, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, json: (await r.json()) as J };
  };
  const register = async (phone: string, name: string, role: string) => {
    await call('POST', '/auth/register/start', undefined, { phone });
    const r = await call('POST', '/auth/register/verify', undefined, { phone, code: inbox.get(phone), password: 'clave123', fullName: name, role });
    return { token: String(r.json.accessToken), id: String(r.json.user?.id) };
  };
  const sockets: WebSocket[] = [];

  try {
    const cli = await register(PHONES[0], 'Cliente RT', 'CLIENTE');
    const drv = await register(PHONES[1], 'Moto RT', 'MOTORIZADO');
    await getPool().query(`UPDATE driver_profiles SET status = 'APPROVED' WHERE user_id = ?`, [drv.id]);

    console.log('Conexión');
    const badCode = await new Promise<number>((res) => {
      const ws = new WebSocket(wsUrl);
      ws.on('open', () => ws.send(JSON.stringify({ type: 'auth', token: 'falso' })));
      ws.on('close', (c) => res(c));
      ws.on('error', () => res(-1));
    });
    check('token falso: conexión rechazada (4001)', badCode === 4001, badCode);
    const wrongPath = await new Promise<boolean>((res) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/zenith-api/otra-cosa`);
      ws.on('open', () => res(false));
      ws.on('error', () => res(true));
    });
    check('solo acepta la ruta /ws', wrongPath);
    const C = await connect(wsUrl, cli.token);
    const D = await connect(`ws://127.0.0.1:${port}/ws`, drv.token);
    sockets.push(C.ws, D.ws);
    check('cliente conectado con sesión', hub.connectionsOf(cli.id) === 1);
    check('motorizado conectado (también por /ws)', hub.connectionsOf(drv.id) === 1);

    console.log('Avisos de pedido');
    await call('POST', '/rides/driver/presence', drv.token, { lat: -8.1150, lng: -79.0300, online: true });
    const q = (await call('POST', '/pricing/quote', cli.token, {
      originLat: -8.1116, originLng: -79.0288, destLat: -8.0950, destLng: -79.0400,
      originAddress: 'Plaza de Armas', destAddress: 'Av. España',
    })).json.quote;
    const t0 = Date.now();
    const req = await call('POST', '/rides/request', cli.token, { quote: q });
    const rideId = String(req.json.ride?.id);
    const offer = await D.waitFor((e) => e.type === 'offer' && e.rideId === rideId);
    check('la oferta llega al motorizado al instante (sin consultar)', !!offer, D.events);
    console.log(`     (llegó en ${Date.now() - t0} ms)`);

    const acc = await call('POST', `/rides/driver/offers/${offer?.assignmentId}/accept`, drv.token);
    check('acepta', acc.json.ride?.status === 'DRIVER_ASSIGNED', acc.json);
    const assigned = await C.waitFor((e) => e.type === 'ride' && e.status === 'DRIVER_ASSIGNED');
    check('el cliente recibe aviso: motorizado asignado', !!assigned, C.events);

    await call('POST', '/rides/driver/presence', drv.token, { lat: -8.1130, lng: -79.0295, heading: 90, online: true });
    const loc = await C.waitFor((e) => e.type === 'ride.location');
    check('el cliente recibe la ubicación de la moto en vivo', loc?.lat === -8.113 && loc?.heading === 90, loc);

    await call('POST', `/rides/${rideId}/status`, drv.token, { status: 'DRIVER_ARRIVING' });
    const arriving = await C.waitFor((e) => e.type === 'ride' && e.status === 'DRIVER_ARRIVING');
    check('el cliente recibe aviso: en camino', !!arriving);
    await call('POST', `/rides/${rideId}/cancel`, cli.token, { reason: 'prueba' });
    const cancelled = await D.waitFor((e) => e.type === 'ride' && e.status === 'CANCELLED');
    check('el motorizado recibe aviso: el cliente canceló', !!cancelled, D.events);

    console.log('Oferta cerrada');
    const q2 = (await call('POST', '/pricing/quote', cli.token, {
      originLat: -8.1116, originLng: -79.0288, destLat: -8.0950, destLng: -79.0400,
      originAddress: 'Plaza de Armas', destAddress: 'Av. España',
    })).json.quote;
    const r2 = await call('POST', '/rides/request', cli.token, { quote: q2 });
    const ride2 = String(r2.json.ride?.id);
    const offer2 = await D.waitFor((e) => e.type === 'offer' && e.rideId === ride2);
    await call('POST', `/rides/${ride2}/cancel`, cli.token, {});
    const closed = await D.waitFor((e) => e.type === 'offer.closed' && e.assignmentId === offer2?.assignmentId);
    check('si el cliente cancela, la oferta desaparece del celular del motorizado', closed?.reason === 'CANCELLED', D.events.slice(-3));

    console.log('Privacidad');
    const leak = C.events.some((e) => e.type === 'offer' || e.type === 'offer.closed');
    check('el cliente nunca recibe ofertas de motorizados', !leak);

    C.ws.close();
    await new Promise((r) => setTimeout(r, 200));
    check('al cerrar la app se libera la conexión', hub.connectionsOf(cli.id) === 0);
  } finally {
    for (const s of sockets) s.terminate();
    hub.close();
    await cleanup();
    server.close();
    await closePool();
  }
  console.log(`\nResultado: ${passed} OK, ${failed} fallas`);
  process.exit(failed ? 1 : 0);
};

main().catch((e) => { console.error(e); process.exit(1); });
