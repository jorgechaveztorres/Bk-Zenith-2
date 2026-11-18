/**
 * Prueba de punta a punta del CLIENTE de la app (src/api/*) contra el servidor real + MySQL.
 * El cliente usa los mismos módulos que la app; el motorizado se simula con fetch directo
 * (la sesión de la app es una sola por teléfono).
 * El buscador de direcciones (Nominatim) se reemplaza por un servidor falso local.
 *
 * Requiere DB_* y JWT_SECRET como test:rides. Uso: npm run test:app
 */
import http from 'http';
import type { AddressInfo } from 'net';
import type { RowDataPacket } from 'mysql2/promise';

// --- Navegador mínimo para los módulos de la app
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, extra?: unknown) => {
  if (cond) { passed++; console.log(`  [PASS] ${name}`); }
  else { failed++; console.log(`  [FAIL] ${name}`, extra === undefined ? '' : JSON.stringify(extra).slice(0, 400)); }
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const waitUntil = async (fn: () => boolean, ms = 4000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (fn()) return true; await sleep(50); }
  return fn();
};

const PHONES = ['+51900000021', '+51900000022'];
const PLAZA = { lat: -8.1116, lng: -79.0288 };
const DEST = { lat: -8.0950, lng: -79.0400 };

// --- Nominatim falso
let nominatimCalls = 0;
const fakeNominatim = http.createServer((req, res) => {
  nominatimCalls++;
  const url = new URL(req.url || '/', 'http://x');
  res.setHeader('Content-Type', 'application/json');
  if (url.pathname === '/search') {
    res.end(JSON.stringify([{ lat: String(DEST.lat), lon: String(DEST.lng), display_name: 'largo', address: { road: 'Avenida España', house_number: '123', suburb: 'Centro', city: 'Trujillo' } }]));
  } else if (url.pathname === '/reverse') {
    res.end(JSON.stringify({ lat: url.searchParams.get('lat'), lon: url.searchParams.get('lon'), display_name: 'largo', address: { road: 'Jirón Pizarro', suburb: 'Centro', city: 'Trujillo' } }));
  } else { res.statusCode = 404; res.end('{}'); }
});

const main = async () => {
  await new Promise<void>((r) => fakeNominatim.listen(0, r));
  process.env.NOMINATIM_URL = `http://127.0.0.1:${(fakeNominatim.address() as AddressInfo).port}`;

  const { createApp } = await import('../server/app');
  const { RealtimeHub, realtimePaths } = await import('../server/realtime/hub');
  const { setSmsSender } = await import('../server/services/sms.service');
  const { setRouteProvider, MockRouteProvider } = await import('../server/services/routes.service');
  const { getPool, closePool } = await import('../server/config/mysql');
  const { clearSettingsCache } = await import('../server/services/settings.service');
  const { setApiBase, hasSession, getSessionUser, ApiError, expireAccessTokenForTest } = await import('../src/api/http');
  const { AuthApi, PricingApi, RidesApi, GeoApi } = await import('../src/api/endpoints');
  const { Realtime } = await import('../src/api/realtime');

  const inbox = new Map<string, string>();
  setSmsSender({ async send(phone: string, text: string) { const m = text.match(/(\d{6})/); if (m) inbox.set(phone, m[1]); } });
  setRouteProvider(new MockRouteProvider({ distanceKm: 3.2, durationMinutes: 9 }));
  clearSettingsCache();

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
      for (const [t, c] of [['drivers_online', 'driver_id'], ['refresh_tokens', 'user_id'], ['audit_logs', 'actor_id'], ['wallets', 'driver_id'], ['driver_profiles', 'user_id']]) {
        await pool.query(`DELETE FROM ${t} WHERE ${c} IN (${ph})`, ids);
      }
      await pool.query(`DELETE FROM users WHERE id IN (${ph})`, ids);
    }
    await pool.query(`DELETE FROM otp_codes WHERE phone IN (?, ?)`, PHONES);
  };

  await cleanup();
  const server = createApp().listen(0);
  const hub = new RealtimeHub(realtimePaths()).attach(server);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  setApiBase(base);

  // Motorizado por fetch directo
  const raw = async (method: string, path: string, token?: string, body?: unknown) => {
    const res = await fetch(`${base}/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };

  try {
    console.log('\n1. Cuenta del cliente (módulos de la app)');
    await AuthApi.startRegistration('900000021');
    check('SMS de registro enviado', !!inbox.get(PHONES[0]));
    const me = await AuthApi.completeRegistration({ phone: '900000021', code: inbox.get(PHONES[0]) || '', password: 'clave123', fullName: 'Cliente App', role: 'passenger' });
    check('registro deja sesión guardada', hasSession() && me.role === 'passenger' && store.size === 1);

    await AuthApi.logout();
    check('logout borra la sesión', !hasSession() && store.size === 0);

    let wrong = '';
    try { await AuthApi.login('900000021', 'malaclave'); } catch (e) { wrong = e instanceof ApiError ? e.message : ''; }
    check('clave errada da mensaje claro', wrong === 'Celular o clave incorrectos.', wrong);

    await AuthApi.login('900000021', 'clave123');
    check('login con celular + clave', getSessionUser()?.fullName === 'Cliente App');

    // Forzar token vencido: la app debe renovarlo sola.
    const oldRefresh = JSON.parse([...store.values()][0] || '{}').refreshToken;
    expireAccessTokenForTest();
    const me2 = await AuthApi.me();
    const newRefresh = JSON.parse([...store.values()][0] || '{}').refreshToken;
    check('renueva sesión vencida y responde /me', me2.id === me.id && newRefresh !== oldRefresh);

    console.log('\n2. Direcciones (OSM vía servidor)');
    const found = await GeoApi.search('Av España 123, Trujillo');
    check('buscar dirección', found.length === 1 && found[0].address === 'Avenida España 123, Centro, Trujillo', found);
    const before = nominatimCalls;
    await GeoApi.search('av españa 123, trujillo');
    check('búsqueda repetida sale del caché', nominatimCalls === before);
    const here = await GeoApi.reverse(PLAZA.lat, PLAZA.lng);
    check('dirección del punto tocado', here.address === 'Jirón Pizarro, Centro, Trujillo' && here.lat === PLAZA.lat, here);
    let shortErr = '';
    try { await GeoApi.search('ab'); } catch (e) { shortErr = (e as Error).message; }
    check('búsqueda corta rechazada', shortErr === 'Escribe al menos 3 letras.', shortErr);

    console.log('\n3. Motorizado listo');
    await raw('POST', '/auth/register/start', undefined, { phone: PHONES[1] });
    const dReg = await raw('POST', '/auth/register/verify', undefined, { phone: PHONES[1], code: inbox.get(PHONES[1]), password: 'clave123', fullName: 'Moto App', role: 'driver' });
    const dToken = String(dReg.body.accessToken);
    const dId = String((dReg.body.user as { id: string }).id);
    await getPool().query(`UPDATE driver_profiles SET status = 'APPROVED' WHERE user_id = ?`, [dId]);
    const pres = await raw('POST', '/rides/driver/presence', dToken, { lat: -8.1150, lng: -79.0300, online: true });
    check('motorizado conectado', pres.body.status === 'AVAILABLE', pres.body);

    console.log('\n4. Pedido del cliente con avisos en vivo');
    const events: Array<{ type: string; status?: string }> = [];
    Realtime.on((e) => events.push(e as { type: string; status?: string }));
    Realtime.start();
    check('WebSocket conectado', await waitUntil(() => Realtime.isConnected()));

    const origin = { ...PLAZA, address: here.address };
    const quote = await PricingApi.quote(origin, found[0]);
    check('precio firmado', quote.totalFare > 0 && !!quote.pricingSeal, quote);

    const ride = await RidesApi.request(quote, 'yape', { description: 'Caja de zapatos', receptorName: 'Ana', receptorPhone: '912345678' });
    check('pedido creado buscando motorizado', ride.status === 'SEARCHING_DRIVER' && /^\d{4}$/.test(ride.otpCode || ''), ride);
    const again = await RidesApi.active();
    check('pedido activo al reabrir la app', again?.id === ride.id);

    const offer = await raw('GET', '/rides/driver/offer', dToken);
    const o = offer.body.offer as { assignmentId: string } | null;
    check('motorizado recibe la oferta', !!o);
    await raw('POST', `/rides/driver/offers/${o?.assignmentId}/accept`, dToken);
    check('aviso al cliente: asignado', await waitUntil(() => events.some((e) => e.type === 'ride' && e.status === 'DRIVER_ASSIGNED')));

    const detail = await RidesApi.get(ride.id);
    check('cliente ve al motorizado y su código', detail.driverName === 'Moto App' && detail.otpCode === ride.otpCode, detail);

    await raw('POST', `/rides/${ride.id}/status`, dToken, { status: 'DRIVER_ARRIVING' });
    await raw('POST', '/rides/driver/presence', dToken, { lat: -8.1130, lng: -79.0295, heading: 90, online: true });
    check('aviso al cliente: ubicación en vivo', await waitUntil(() => events.some((e) => e.type === 'ride.location')));

    await raw('POST', `/rides/${ride.id}/status`, dToken, { status: 'WAITING_FOR_OTP' });
    const bad = await raw('POST', `/rides/${ride.id}/verify-otp`, dToken, { code: ride.otpCode === '0000' ? '1111' : '0000' });
    check('código errado rechazado', bad.status >= 400);
    const ok = await raw('POST', `/rides/${ride.id}/verify-otp`, dToken, { code: ride.otpCode });
    check('código correcto inicia el viaje', (ok.body.ride as { status: string })?.status === 'IN_PROGRESS', ok.body);

    let cancelErr = '';
    try { await RidesApi.cancel(ride.id); } catch (e) { cancelErr = (e as Error).message; }
    check('no se cancela en camino', cancelErr.includes('ya está en camino'), cancelErr);

    await raw('POST', `/rides/${ride.id}/status`, dToken, { status: 'COMPLETED' });
    check('aviso al cliente: entregado', await waitUntil(() => events.some((e) => e.type === 'ride' && e.status === 'COMPLETED')));
    const fin = await RidesApi.get(ride.id);
    check('pedido entregado y sin código', fin.status === 'COMPLETED' && fin.otpCode === undefined, fin);
    check('sin pedido activo', (await RidesApi.active()) === null);

    console.log('\n5. Cancelar antes del motorizado');
    const q2 = await PricingApi.quote(origin, found[0]);
    const r2 = await RidesApi.request(q2, 'cash');
    const c2 = await RidesApi.cancel(r2.id, 'Me equivoqué');
    check('cliente cancela mientras busca', c2.status === 'CANCELLED');

    Realtime.stop();
    check('WebSocket cerrado al salir', await waitUntil(() => !Realtime.isConnected()));
  } catch (err) {
    failed++;
    console.error('  [ERROR]', err);
  } finally {
    Realtime.stop();
    await cleanup();
    hub.close();
    server.close();
    fakeNominatim.close();
    await closePool();
  }
  console.log(`\nResultado: ${passed} OK, ${failed} fallas`);
  process.exit(failed ? 1 : 0);
};

void main();
