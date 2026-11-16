/**
 * Prueba completa del login Zénith contra MySQL/MariaDB real.
 * Requiere: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME (base con database/schema.sql cargado) y JWT_SECRET.
 * Uso: npx tsx scripts/test-auth-mysql.ts
 */
import type { AddressInfo } from 'net';
import { createApp } from '../server/app';
import { setSmsSender } from '../server/services/sms.service';
import { getPool, closePool } from '../server/config/mysql';

const inbox = new Map<string, string>();
setSmsSender({
  async send(phone: string, text: string) {
    const m = text.match(/(\d{6})/);
    if (m) inbox.set(phone, m[1]);
  },
});

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, extra?: unknown) => {
  if (cond) { passed++; console.log(`  [PASS] ${name}`); }
  else { failed++; console.log(`  [FAIL] ${name}`, extra ?? ''); }
};

interface Json { success?: boolean; message?: string; accessToken?: string; refreshToken?: string; user?: { id: string; role: string; phone: string } }

const main = async () => {
  process.env.BASE_PATH = '/zenith-api';
  const pool = getPool();
  await pool.query("DELETE FROM users WHERE phone IN ('+51911111111','+51922222222')");
  await pool.query("DELETE FROM otp_codes WHERE phone IN ('+51911111111','+51922222222')");

  const server = createApp().listen(0);
  const port = (server.address() as AddressInfo).port;
  const base = `http://127.0.0.1:${port}/zenith-api/api`;
  const post = async (path: string, body: unknown, token?: string) => {
    const r = await fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    return { status: r.status, json: (await r.json()) as Json };
  };
  const get = async (path: string, token?: string) => {
    const r = await fetch(base + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    return { status: r.status, json: (await r.json()) as Json };
  };

  try {
    console.log('Ruta en subcarpeta (bug 404 de cPanel)');
    const h = await fetch(`http://127.0.0.1:${port}/zenith-api/api/health`);
    check('GET /zenith-api/api/health responde 200', h.status === 200);
    const h2 = await fetch(`http://127.0.0.1:${port}/api/health`);
    check('GET /api/health también responde 200', h2.status === 200);

    console.log('Registro de motorizado (SMS + clave)');
    let r = await post('/auth/register/start', { phone: '911 111 111' });
    check('pide código por SMS', r.status === 200 && inbox.has('+51911111111'), r);
    r = await post('/auth/register/verify', { phone: '911111111', code: '000000', password: 'clave123', fullName: 'Moto Prueba', role: 'MOTORIZADO' });
    check('código incorrecto es rechazado', r.status === 400, r);
    r = await post('/auth/register/verify', { phone: '+51911111111', code: inbox.get('+51911111111'), password: 'clave123', fullName: 'Moto Prueba', role: 'MOTORIZADO' });
    check('código correcto crea la cuenta y entrega sesión', r.status === 200 && !!r.json.accessToken && r.json.user?.role === 'driver', r);
    const driverId = r.json.user?.id || '';
    const [w] = await pool.query('SELECT driver_id FROM wallets WHERE driver_id = ?', [driverId]);
    check('se crea su billetera en S/ 0.00', Array.isArray(w) && w.length === 1);
    r = await post('/auth/register/verify', { phone: '+51911111111', code: inbox.get('+51911111111'), password: 'clave123', fullName: 'Moto Prueba', role: 'driver' });
    check('el mismo código no sirve dos veces', r.status === 400, r);
    r = await post('/auth/register/start', { phone: '911111111' });
    check('no deja registrar el mismo celular dos veces', r.status === 409, r);

    console.log('Entrar con celular + clave (sin SMS)');
    inbox.clear();
    r = await post('/auth/login', { phone: '911111111', password: 'malaclave' });
    check('clave incorrecta: 401', r.status === 401, r);
    r = await post('/auth/login', { phone: '911111111', password: 'clave123' });
    check('clave correcta: entra', r.status === 200 && !!r.json.accessToken, r);
    check('entrar NO gasta SMS', inbox.size === 0);
    const access = r.json.accessToken || '';
    const refresh1 = r.json.refreshToken || '';
    const me = await get('/auth/me', access);
    check('/auth/me devuelve su perfil', me.status === 200 && me.json.user?.id === driverId, me);
    const meNo = await get('/auth/me');
    check('/auth/me sin sesión: 401', meNo.status === 401);

    console.log('Renovar sesión');
    r = await post('/auth/refresh', { refreshToken: refresh1 });
    check('renueva con token válido', r.status === 200 && !!r.json.refreshToken, r);
    const refresh2 = r.json.refreshToken || '';
    r = await post('/auth/refresh', { refreshToken: refresh1 });
    check('token viejo reutilizado: cierra todas las sesiones', r.status === 401, r);
    r = await post('/auth/refresh', { refreshToken: refresh2 });
    check('tras el reuso, el token nuevo también queda anulado', r.status === 401, r);

    console.log('Olvidé mi clave');
    r = await post('/auth/password/forgot', { phone: '922222222' });
    check('celular no registrado: responde igual (no revela)', r.status === 200 && !inbox.has('+51922222222'), r);
    r = await post('/auth/password/forgot', { phone: '911111111' });
    check('celular registrado: llega SMS', r.status === 200 && inbox.has('+51911111111'), r);
    r = await post('/auth/password/reset', { phone: '911111111', code: inbox.get('+51911111111'), newPassword: 'nueva456' });
    check('cambia la clave con el código', r.status === 200 && !!r.json.accessToken, r);
    r = await post('/auth/login', { phone: '911111111', password: 'clave123' });
    check('la clave vieja ya no sirve', r.status === 401, r);
    r = await post('/auth/login', { phone: '911111111', password: 'nueva456' });
    check('la clave nueva sí sirve', r.status === 200, r);

    console.log('Límite de SMS');
    await pool.query("DELETE FROM otp_codes WHERE phone = '+51922222222'");
    const results: number[] = [];
    for (let i = 0; i < 4; i++) results.push((await post('/auth/register/start', { phone: '922222222' })).status);
    check('máximo 3 SMS cada 15 min por celular', results.join(',') === '200,200,200,429', results);

    console.log('Validaciones');
    r = await post('/auth/register/start', { phone: '12345' });
    check('celular inválido: 400', r.status === 400, r);
  } finally {
    await pool.query("DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE phone IN ('+51911111111','+51922222222'))");
    await pool.query("DELETE FROM audit_logs WHERE actor_id IN (SELECT id FROM users WHERE phone IN ('+51911111111','+51922222222'))");
    await pool.query("DELETE FROM wallets WHERE driver_id IN (SELECT id FROM users WHERE phone IN ('+51911111111','+51922222222'))");
    await pool.query("DELETE FROM users WHERE phone IN ('+51911111111','+51922222222')");
    await pool.query("DELETE FROM otp_codes WHERE phone IN ('+51911111111','+51922222222')");
    server.close();
    await closePool();
  }

  console.log(`\nResultado: ${passed} OK, ${failed} fallas`);
  process.exit(failed ? 1 : 0);
};

main().catch((e) => { console.error(e); process.exit(1); });
