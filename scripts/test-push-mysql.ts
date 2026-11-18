/**
 * Prueba de punta a punta de las suscripciones Web Push (/api/push/*),
 * contra MySQL/MariaDB real. No llama a servidores push reales (eso
 * requeriría salir a internet); prueba la persistencia y las validaciones.
 * Uso: npx tsx scripts/test-push-mysql.ts
 */
import type { AddressInfo } from 'net';
import { createApp } from '../server/app';
import { setSmsSender } from '../server/services/sms.service';
import { getPool, closePool } from '../server/config/mysql';
import { clearSettingsCache } from '../server/services/settings.service';
import { PushService } from '../server/services/push.service';

const inbox = new Map<string, string>();
setSmsSender({ async send(phone: string, text: string) { const m = text.match(/(\d{6})/); if (m) inbox.set(phone, m[1]); } });

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, extra?: unknown) => {
  if (cond) { passed++; console.log(`  [PASS] ${name}`); }
  else { failed++; console.log(`  [FAIL] ${name}`, extra === undefined ? '' : JSON.stringify(extra).slice(0, 400)); }
};

type J = Record<string, any>;
const PHONES = ['+51900000081', '+51900000082'];

const cleanup = async () => {
  const pool = getPool();
  const [u] = await pool.query<import('mysql2').RowDataPacket[]>(
    `SELECT id FROM users WHERE phone IN (${PHONES.map(() => '?').join(',')})`, PHONES
  );
  const ids = u.map((r) => r.id as string);
  if (ids.length) {
    const ph = ids.map(() => '?').join(',');
    await pool.query(`DELETE FROM refresh_tokens WHERE user_id IN (${ph})`, ids);
    await pool.query(`DELETE FROM push_subscriptions WHERE user_id IN (${ph})`, ids);
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
    const r = await call('POST', '/auth/register/verify', undefined, { phone, code: inbox.get(phone), password: 'clave123', fullName: name, role: 'CLIENTE' });
    return { token: String(r.json.accessToken), id: String(r.json.user?.id) };
  };
  const pool = getPool();

  try {
    const u1 = await register(PHONES[0], 'Push Uno');
    const u2 = await register(PHONES[1], 'Push Dos');

    console.log('Clave pública VAPID (sin sesión)');
    let r = await call('GET', '/push/vapid-public-key');
    check('responde 200 con la clave configurada en .env', r.status === 200 && typeof r.json.publicKey === 'string' && r.json.publicKey.length > 0, r.json);

    console.log('Suscribirse requiere sesión');
    r = await call('POST', '/push/subscribe', undefined, { subscription: { endpoint: 'https://push.example/1', keys: { p256dh: 'a', auth: 'b' } } });
    check('sin token: 401', r.status === 401, r.json);

    console.log('Suscripción incompleta se rechaza');
    r = await call('POST', '/push/subscribe', u1.token, { subscription: { endpoint: 'https://push.example/1' } });
    check('faltan keys: 400', r.status === 400, r.json);

    console.log('Suscripción válida se guarda');
    const endpoint = 'https://push.example/compartido';
    r = await call('POST', '/push/subscribe', u1.token, { subscription: { endpoint, keys: { p256dh: 'clave-p256dh-1', auth: 'clave-auth-1' } } });
    check('se guarda sin error', r.status === 200, r.json);
    let [rows] = await pool.query<import('mysql2').RowDataPacket[]>('SELECT * FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
    check('queda una fila con el usuario correcto', rows.length === 1 && rows[0].user_id === u1.id, rows);

    console.log('El mismo endpoint, otro usuario: se actualiza, no se duplica');
    r = await call('POST', '/push/subscribe', u2.token, { subscription: { endpoint, keys: { p256dh: 'clave-p256dh-2', auth: 'clave-auth-2' } } });
    check('se guarda sin error', r.status === 200, r.json);
    [rows] = await pool.query<import('mysql2').RowDataPacket[]>('SELECT * FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
    check('sigue siendo una sola fila, ahora del segundo usuario', rows.length === 1 && rows[0].user_id === u2.id, rows);

    console.log('Desuscribirse borra la fila');
    r = await call('POST', '/push/unsubscribe', u2.token, { endpoint });
    check('responde 200', r.status === 200, r.json);
    [rows] = await pool.query<import('mysql2').RowDataPacket[]>('SELECT * FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
    check('la fila ya no existe', rows.length === 0, rows);

    console.log('Enviar a un usuario sin suscripciones no lanza error');
    await PushService.sendToUser(u1.id, { title: 'Prueba', body: 'Hola' });
    check('sendToUser resuelve sin lanzar (sin suscripciones activas)', true);

    console.log('Borrar el usuario borra sus suscripciones en cascada');
    await call('POST', '/push/subscribe', u1.token, { subscription: { endpoint: 'https://push.example/cascada', keys: { p256dh: 'x', auth: 'y' } } });
    await pool.query('DELETE FROM users WHERE id = ?', [u1.id]);
    [rows] = await pool.query<import('mysql2').RowDataPacket[]>('SELECT * FROM push_subscriptions WHERE user_id = ?', [u1.id]);
    check('ON DELETE CASCADE limpia la suscripción', rows.length === 0, rows);
  } finally {
    await cleanup();
    server.close();
    await closePool();
  }
  console.log(`\nResultado: ${passed} OK, ${failed} fallas`);
  process.exit(failed ? 1 : 0);
};

main().catch((e) => { console.error(e); process.exit(1); });
