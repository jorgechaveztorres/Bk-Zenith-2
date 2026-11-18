/**
 * Prueba de punta a punta del marketplace de comida (restaurantes + menú + pedido)
 * contra MySQL/MariaDB real. Requiere schema.sql + migrations 002 y 003,
 * y variables DB_* / JWT_SECRET / OTP_SECRET / PRICING_HMAC_SECRET.
 * Uso: npx tsx scripts/test-food-mysql.ts
 */
import type { AddressInfo } from 'net';
import { createApp } from '../server/app';
import { setSmsSender } from '../server/services/sms.service';
import { setRouteProvider, MockRouteProvider } from '../server/services/routes.service';
import { getPool, closePool } from '../server/config/mysql';
import { clearSettingsCache } from '../server/services/settings.service';

const inbox = new Map<string, string>();
setSmsSender({ async send(phone: string, text: string) { const m = text.match(/(\d{6})/); if (m) inbox.set(phone, m[1]); } });
setRouteProvider(new MockRouteProvider({ distanceKm: 1.8, durationMinutes: 6 }));

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, extra?: unknown) => {
  if (cond) { passed++; console.log(`  [PASS] ${name}`); }
  else { failed++; console.log(`  [FAIL] ${name}`, extra === undefined ? '' : JSON.stringify(extra).slice(0, 400)); }
};

type J = Record<string, any>;
const PHONES = ['+51900000031', '+51900000032', '+51900000033'];

const REST = { lat: -8.1116, lng: -79.0288 };
const CUST = { lat: -8.0950, lng: -79.0400 };

const cleanup = async () => {
  const pool = getPool();
  const [u] = await pool.query<import('mysql2').RowDataPacket[]>(
    `SELECT id FROM users WHERE phone IN (${PHONES.map(() => '?').join(',')})`, PHONES
  );
  const ids = u.map((r) => r.id as string);
  if (ids.length) {
    const ph = ids.map(() => '?').join(',');
    const [rests] = await pool.query<import('mysql2').RowDataPacket[]>(`SELECT id FROM restaurants WHERE owner_user_id IN (${ph})`, ids);
    const restIds = rests.map((r) => r.id as string);
    if (restIds.length) {
      const rp = restIds.map(() => '?').join(',');
      await pool.query(`DELETE FROM menu_items WHERE restaurant_id IN (${rp})`, restIds);
      await pool.query(`UPDATE rides SET restaurant_id = NULL WHERE restaurant_id IN (${rp})`, restIds);
      await pool.query(`DELETE FROM restaurants WHERE id IN (${rp})`, restIds);
    }
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

  try {
    const owner = await register(PHONES[0], 'Doña Rosa', 'CLIENTE');
    const other = await register(PHONES[1], 'Otro Dueño', 'CLIENTE');
    const cliente = await register(PHONES[2], 'Cliente Hambriento', 'CLIENTE');

    console.log('Restaurante y menú');
    let r = await call('POST', '/restaurants/mine', owner.token, {
      name: 'Pollería Doña Rosa', address: 'Jr. Pizarro 450, Trujillo', lat: REST.lat, lng: REST.lng, city: 'Trujillo', phone: '944000111',
    });
    check('el dueño crea su restaurante gratis', r.status === 201 && r.json.restaurant?.name === 'Pollería Doña Rosa', r.json);
    const restaurantId = String(r.json.restaurant.id);

    r = await call('POST', '/restaurants/mine', owner.token, { name: 'Otro', address: 'X', lat: REST.lat, lng: REST.lng });
    check('un dueño no puede tener dos restaurantes', r.status === 409, r.json);

    r = await call('POST', `/restaurants/${restaurantId}/menu`, other.token, { name: 'Intruso', price: 10 });
    check('otro usuario no puede tocar el menú ajeno', r.status === 404, r.json);

    r = await call('POST', `/restaurants/${restaurantId}/menu`, owner.token, { name: '1/4 Pollo a la brasa', description: 'Con papas y ensalada', price: 18.5 });
    check('agrega plato 1', r.status === 201 && r.json.item?.price === 18.5, r.json);
    const item1 = String(r.json.item.id);
    r = await call('POST', `/restaurants/${restaurantId}/menu`, owner.token, { name: 'Gaseosa 500ml', price: 3 });
    check('agrega plato 2', r.status === 201, r.json);
    const item2 = String(r.json.item.id);

    r = await call('GET', `/restaurants/${restaurantId}/menu`, cliente.token);
    check('el cliente ve el menú público', r.status === 200 && r.json.menu?.length === 2, r.json);

    r = await call('GET', '/restaurants', cliente.token);
    check('el restaurante aparece en la lista de abiertos', r.status === 200 && r.json.restaurants?.some((x: J) => x.id === restaurantId), r.json);

    console.log('Pedido de comida (reutiliza el motor de precio/despacho)');
    const q = (await call('POST', '/pricing/quote', cliente.token, {
      originLat: REST.lat, originLng: REST.lng, destLat: CUST.lat, destLng: CUST.lng,
      originAddress: 'Pollería Doña Rosa', destAddress: 'Av. España 1200, Trujillo',
    })).json.quote;
    check('cotización de envío del pedido de comida', !!q?.pricingSeal, q);

    r = await call('POST', `/restaurants/${restaurantId}/orders`, cliente.token, {
      quote: q, paymentMethod: 'cash',
      items: [{ menuItemId: item1, quantity: 2 }, { menuItemId: item2, quantity: 1 }],
      notes: 'Sin ají por favor',
    });
    check('se crea el pedido de comida', r.status === 201 && r.json.ride?.status === 'SEARCHING_DRIVER', r.json);
    check('el subtotal lo calcula el servidor (no el cliente)', r.json.subtotal === 40, r.json);
    const foodRideId = String(r.json.ride.id);

    r = await call('GET', `/rides/${foodRideId}`, cliente.token);
    check('el pedido guarda el detalle de comida con precios congelados', r.json.ride?.food?.restaurantName === 'Pollería Doña Rosa'
      && r.json.ride?.food?.items?.length === 2 && r.json.ride?.food?.subtotal === 40 && r.json.ride?.orderType === 'FOOD', r.json);
    check('el origen del pedido es el restaurante', Math.abs(r.json.ride?.origin?.lat - REST.lat) < 0.0001, r.json);

    r = await call('POST', `/restaurants/${restaurantId}/orders`, cliente.token, {
      quote: q, items: [{ menuItemId: 'no-existe', quantity: 1 }],
    });
    check('no se puede pedir dos veces activo a la vez (ya tiene un pedido en curso)', r.status === 409, r.json);

    console.log('Cierre del restaurante');
    r = await call('PATCH', `/restaurants/${restaurantId}/open`, owner.token, { isOpen: false });
    check('el dueño cierra su restaurante', r.status === 200 && r.json.restaurant?.isOpen === false, r.json);
    r = await call('GET', '/restaurants', cliente.token);
    check('un restaurante cerrado no aparece en la lista pública', !r.json.restaurants?.some((x: J) => x.id === restaurantId), r.json);
  } finally {
    await cleanup();
    server.close();
    await closePool();
  }
  console.log(`\nResultado: ${passed} OK, ${failed} fallas`);
  process.exit(failed > 0 ? 1 : 0);
};

main().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
