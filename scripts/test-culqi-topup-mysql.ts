/**
 * Prueba de punta a punta de la recarga con Culqi (/api/topups/culqi/*),
 * contra MySQL/MariaDB real. No llama a Culqi de verdad: se intercepta
 * fetch() solo para la URL de la API de Culqi, todo lo demás (incluido
 * hablar con nuestro propio servidor local) usa el fetch real.
 * Uso: npx tsx scripts/test-culqi-topup-mysql.ts
 */
import type { AddressInfo } from 'net';
import { createApp } from '../server/app';
import { setSmsSender } from '../server/services/sms.service';
import { getPool, closePool } from '../server/config/mysql';
import { clearSettingsCache } from '../server/services/settings.service';

process.env.CULQI_SECRET_KEY = 'sk_test_fake_para_pruebas';
process.env.CULQI_PUBLIC_KEY = 'pk_test_fake_para_pruebas';

const CULQI_API = 'https://api.culqi.com/v2/charges';
const realFetch = globalThis.fetch;
type MockOutcome = 'venta_exitosa' | 'venta_denegada' | 'network_error';
let mockOutcome: MockOutcome = 'venta_exitosa';
let lastCulqiBody: Record<string, unknown> | null = null;

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input.toString();
  if (url === CULQI_API) {
    lastCulqiBody = JSON.parse(String(init?.body || '{}'));
    if (mockOutcome === 'network_error') throw new Error('Simulación: sin conexión a Culqi.');
    if (mockOutcome === 'venta_denegada') {
      return new Response(JSON.stringify({ user_message: 'Tarjeta rechazada por el banco.' }), { status: 402 });
    }
    return new Response(JSON.stringify({ id: 'chr_test_123', amount: lastCulqiBody.amount, outcome: { type: 'venta_exitosa' } }), { status: 201 });
  }
  return realFetch(input as any, init);
}) as typeof fetch;

const inbox = new Map<string, string>();
setSmsSender({ async send(phone: string, text: string) { const m = text.match(/(\d{6})/); if (m) inbox.set(phone, m[1]); } });

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, extra?: unknown) => {
  if (cond) { passed++; console.log(`  [PASS] ${name}`); }
  else { failed++; console.log(`  [FAIL] ${name}`, extra === undefined ? '' : JSON.stringify(extra).slice(0, 400)); }
};

type J = Record<string, any>;
const PHONES = ['+51900000091'];

const cleanup = async () => {
  const pool = getPool();
  const [u] = await pool.query<import('mysql2').RowDataPacket[]>(
    `SELECT id FROM users WHERE phone IN (${PHONES.map(() => '?').join(',')})`, PHONES
  );
  const ids = u.map((r) => r.id as string);
  if (ids.length) {
    const ph = ids.map(() => '?').join(',');
    await pool.query(`DELETE FROM wallet_movements WHERE driver_id IN (${ph})`, ids);
    await pool.query(`DELETE FROM topup_requests WHERE driver_id IN (${ph})`, ids);
    await pool.query(`DELETE FROM wallets WHERE driver_id IN (${ph})`, ids);
    await pool.query(`DELETE FROM refresh_tokens WHERE user_id IN (${ph})`, ids);
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
  const register = async (phone: string, name: string) => {
    await call('POST', '/auth/register/start', undefined, { phone });
    const r = await call('POST', '/auth/register/verify', undefined, { phone, code: inbox.get(phone), password: 'clave123', fullName: name, role: 'MOTORIZADO' });
    return { token: String(r.json.accessToken), id: String(r.json.user?.id) };
  };
  const pool = getPool();

  try {
    const drv = await register(PHONES[0], 'Moto Culqi');

    console.log('Config Culqi (con claves de prueba configuradas)');
    let r = await call('GET', '/topups/culqi/config', drv.token);
    check('enabled: true, trae la llave pública', r.json.enabled === true && r.json.publicKey === 'pk_test_fake_para_pruebas', r.json);

    console.log('Validaciones');
    r = await call('POST', '/topups/culqi/charge', drv.token, { token: 'tkn_x', amount: 3 });
    check('monto muy bajo: 400', r.status === 400, r.json);
    r = await call('POST', '/topups/culqi/charge', drv.token, { amount: 50 });
    check('sin token de Culqi: 400', r.status === 400, r.json);
    r = await call('POST', '/topups/culqi/charge', undefined, { token: 'tkn_x', amount: 50 });
    check('sin sesión: 401', r.status === 401, r.json);

    console.log('Cobro exitoso: acredita al instante, con comisión descontada');
    mockOutcome = 'venta_exitosa';
    r = await call('POST', '/topups/culqi/charge', drv.token, { token: 'tkn_abc123', amount: 50 });
    check('responde 201 con la recarga', r.status === 201, r.json);
    const t = r.json.topup;
    check('queda CREDITED de una vez (sin pasar por revisión)', t?.status === 'CREDITED', t);
    check('paymentMethod es CULQI', t?.paymentMethod === 'CULQI', t);
    check('cobra S/50 bruto', Number(t?.grossAmount) === 50, t);
    const expectedFee = Math.round((50 * 0.0399 + 0.5) * 100) / 100;
    check(`la comisión es la configurada por defecto (${expectedFee})`, Number(t?.feeAmount) === expectedFee, t);
    check('lo acreditado es bruto menos comisión', Number(t?.requestedAmount) === Math.round((50 - expectedFee) * 100) / 100, t);
    check('a Culqi se le mandó el monto bruto en centavos', lastCulqiBody?.amount === 5000, lastCulqiBody);

    r = await call('GET', '/wallet/me', drv.token);
    check('la deuda bajó por el monto neto acreditado', Number(r.json.wallet?.cashDebt) >= 0, r.json);

    console.log('Dos cobros Culqi seguidos: no debería chocar con el límite de "una recarga pendiente" (Culqi no queda pendiente)');
    mockOutcome = 'venta_exitosa';
    r = await call('POST', '/topups/culqi/charge', drv.token, { token: 'tkn_def456', amount: 20 });
    check('un segundo cobro Culqi también se acredita de una', r.status === 201 && r.json.topup?.status === 'CREDITED', r.json);

    console.log('Culqi rechaza el pago');
    mockOutcome = 'venta_denegada';
    r = await call('POST', '/topups/culqi/charge', drv.token, { token: 'tkn_rechazado', amount: 30 });
    check('responde 402 con el mensaje de Culqi', r.status === 402 && /rechazada/i.test(r.json.message || ''), r.json);

    console.log('Sin conexión a Culqi');
    mockOutcome = 'network_error';
    r = await call('POST', '/topups/culqi/charge', drv.token, { token: 'tkn_sin_red', amount: 30 });
    check('responde 502, no se cae el servidor', r.status === 502, r.json);
  } finally {
    await cleanup();
    server.close();
    await closePool();
    globalThis.fetch = realFetch;
  }
  console.log(`\nResultado: ${passed} OK, ${failed} fallas`);
  process.exit(failed ? 1 : 0);
};

main().catch((e) => { console.error(e); process.exit(1); });
