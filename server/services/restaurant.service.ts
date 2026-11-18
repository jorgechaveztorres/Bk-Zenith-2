/**
 * ZÉNITH — MARKETPLACE DE COMIDA (restaurantes y menú)
 *
 * El restaurante publica su menú sin costo. Zénith no cobra comisión por
 * las ventas de comida: el único ingreso sigue siendo la comisión de envío
 * que ya se cobra al motorizado (ADR-004). Cualquier cuenta (pasajero o
 * motorizado) puede registrar su propio restaurante.
 */
import crypto from 'crypto';
import { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../config/mysql';
import { HttpError } from './http-error';

export interface MenuItemView {
  id: string;
  name: string;
  description: string | null;
  price: number;
  photoUrl: string | null;
  isAvailable: boolean;
  sortOrder: number;
}

export interface RestaurantView {
  id: string;
  ownerUserId: string;
  name: string;
  phone: string | null;
  address: string;
  lat: number;
  lng: number;
  city: string | null;
  photoUrl: string | null;
  isOpen: boolean;
  isActive: boolean;
  createdAt: string;
}

const toNum = (v: unknown): number => Number(v);
const toIso = (v: unknown): string => (v instanceof Date ? v.toISOString() : String(v));
const cleanText = (v: unknown, max: number): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;

const toRestaurantView = (r: RowDataPacket): RestaurantView => ({
  id: String(r.id),
  ownerUserId: String(r.owner_user_id),
  name: String(r.name),
  phone: r.phone ?? null,
  address: String(r.address),
  lat: toNum(r.lat),
  lng: toNum(r.lng),
  city: r.city ?? null,
  photoUrl: r.photo_url ?? null,
  isOpen: Boolean(r.is_open),
  isActive: Boolean(r.is_active),
  createdAt: toIso(r.created_at),
});

const toMenuItemView = (r: RowDataPacket): MenuItemView => ({
  id: String(r.id),
  name: String(r.name),
  description: r.description ?? null,
  price: toNum(r.price),
  photoUrl: r.photo_url ?? null,
  isAvailable: Boolean(r.is_available),
  sortOrder: Number(r.sort_order),
});

export interface CreateRestaurantInput {
  ownerUserId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  city?: string;
  phone?: string;
  photoUrl?: string;
}

export interface UpsertMenuItemInput {
  name: string;
  description?: string;
  price: number;
  photoUrl?: string;
  isAvailable?: boolean;
  sortOrder?: number;
}

export class RestaurantService {
  /** Crea el restaurante del usuario (uno por dueño en esta primera versión). */
  static async create(input: CreateRestaurantInput): Promise<RestaurantView> {
    const name = cleanText(input.name, 150);
    const address = cleanText(input.address, 255);
    if (!name) throw new HttpError(400, 'Falta el nombre del restaurante.');
    if (!address) throw new HttpError(400, 'Falta la dirección del restaurante.');
    if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) throw new HttpError(400, 'Ubicación inválida.');

    const pool = getPool();
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM restaurants WHERE owner_user_id = ? AND is_active = 1 LIMIT 1', [input.ownerUserId]
    );
    if (existing[0]) throw new HttpError(409, 'Ya tienes un restaurante publicado.');

    const id = crypto.randomUUID();
    await pool.execute(
      `INSERT INTO restaurants (id, owner_user_id, name, phone, address, lat, lng, city, photo_url, is_open, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`,
      [id, input.ownerUserId, name, cleanText(input.phone, 20) ?? null, address, input.lat, input.lng,
        cleanText(input.city, 80) ?? null, cleanText(input.photoUrl, 255) ?? null]
    );
    return this.getOwned(id, input.ownerUserId);
  }

  static async getOwned(restaurantId: string, ownerUserId: string): Promise<RestaurantView> {
    const [rows] = await getPool().query<RowDataPacket[]>(
      'SELECT * FROM restaurants WHERE id = ? AND owner_user_id = ?', [restaurantId, ownerUserId]
    );
    if (!rows[0]) throw new HttpError(404, 'Restaurante no encontrado.');
    return toRestaurantView(rows[0]);
  }

  static async myRestaurant(ownerUserId: string): Promise<RestaurantView | null> {
    const [rows] = await getPool().query<RowDataPacket[]>(
      'SELECT * FROM restaurants WHERE owner_user_id = ? AND is_active = 1 LIMIT 1', [ownerUserId]
    );
    return rows[0] ? toRestaurantView(rows[0]) : null;
  }

  /** Lista pública de restaurantes abiertos (para que el cliente elija dónde pedir). */
  static async listOpen(city?: string): Promise<RestaurantView[]> {
    const pool = getPool();
    const [rows] = city
      ? await pool.query<RowDataPacket[]>(
          'SELECT * FROM restaurants WHERE is_active = 1 AND is_open = 1 AND city = ? ORDER BY name LIMIT 100', [city]
        )
      : await pool.query<RowDataPacket[]>(
          'SELECT * FROM restaurants WHERE is_active = 1 AND is_open = 1 ORDER BY name LIMIT 100'
        );
    return rows.map(toRestaurantView);
  }

  static async getPublic(restaurantId: string): Promise<RestaurantView> {
    const [rows] = await getPool().query<RowDataPacket[]>(
      'SELECT * FROM restaurants WHERE id = ? AND is_active = 1', [restaurantId]
    );
    if (!rows[0]) throw new HttpError(404, 'Restaurante no encontrado.');
    return toRestaurantView(rows[0]);
  }

  static async setOpen(restaurantId: string, ownerUserId: string, isOpen: boolean): Promise<RestaurantView> {
    await this.getOwned(restaurantId, ownerUserId);
    await getPool().execute('UPDATE restaurants SET is_open = ? WHERE id = ?', [isOpen ? 1 : 0, restaurantId]);
    return this.getOwned(restaurantId, ownerUserId);
  }

  // ---- Menú ----

  static async listMenuPublic(restaurantId: string): Promise<MenuItemView[]> {
    const [rows] = await getPool().query<RowDataPacket[]>(
      'SELECT * FROM menu_items WHERE restaurant_id = ? AND is_available = 1 ORDER BY sort_order, name', [restaurantId]
    );
    return rows.map(toMenuItemView);
  }

  static async listMenuOwner(restaurantId: string, ownerUserId: string): Promise<MenuItemView[]> {
    await this.getOwned(restaurantId, ownerUserId);
    const [rows] = await getPool().query<RowDataPacket[]>(
      'SELECT * FROM menu_items WHERE restaurant_id = ? ORDER BY sort_order, name', [restaurantId]
    );
    return rows.map(toMenuItemView);
  }

  static async addMenuItem(restaurantId: string, ownerUserId: string, input: UpsertMenuItemInput): Promise<MenuItemView> {
    await this.getOwned(restaurantId, ownerUserId);
    const name = cleanText(input.name, 150);
    if (!name) throw new HttpError(400, 'Falta el nombre del plato.');
    const price = Number(input.price);
    if (!Number.isFinite(price) || price <= 0) throw new HttpError(400, 'Precio inválido.');

    const id = crypto.randomUUID();
    await getPool().execute(
      `INSERT INTO menu_items (id, restaurant_id, name, description, price, photo_url, is_available, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, restaurantId, name, cleanText(input.description, 300) ?? null, price.toFixed(2),
        cleanText(input.photoUrl, 255) ?? null, input.isAvailable === false ? 0 : 1, input.sortOrder ?? 0]
    );
    const [rows] = await getPool().query<RowDataPacket[]>('SELECT * FROM menu_items WHERE id = ?', [id]);
    return toMenuItemView(rows[0]);
  }

  static async updateMenuItem(
    restaurantId: string, ownerUserId: string, itemId: string, input: Partial<UpsertMenuItemInput>
  ): Promise<MenuItemView> {
    await this.getOwned(restaurantId, ownerUserId);
    const [rows] = await getPool().query<RowDataPacket[]>(
      'SELECT * FROM menu_items WHERE id = ? AND restaurant_id = ?', [itemId, restaurantId]
    );
    if (!rows[0]) throw new HttpError(404, 'Plato no encontrado.');

    const sets: string[] = [];
    const vals: Array<string | number> = [];
    if (input.name !== undefined) { sets.push('name = ?'); vals.push(cleanText(input.name, 150) || rows[0].name); }
    if (input.description !== undefined) { sets.push('description = ?'); vals.push(cleanText(input.description, 300) ?? null); }
    if (input.price !== undefined) {
      const price = Number(input.price);
      if (!Number.isFinite(price) || price <= 0) throw new HttpError(400, 'Precio inválido.');
      sets.push('price = ?'); vals.push(price.toFixed(2));
    }
    if (input.photoUrl !== undefined) { sets.push('photo_url = ?'); vals.push(cleanText(input.photoUrl, 255) ?? null); }
    if (input.isAvailable !== undefined) { sets.push('is_available = ?'); vals.push(input.isAvailable ? 1 : 0); }
    if (input.sortOrder !== undefined) { sets.push('sort_order = ?'); vals.push(input.sortOrder); }

    if (sets.length) {
      await getPool().execute(`UPDATE menu_items SET ${sets.join(', ')} WHERE id = ?`, [...vals, itemId]);
    }
    const [updated] = await getPool().query<RowDataPacket[]>('SELECT * FROM menu_items WHERE id = ?', [itemId]);
    return toMenuItemView(updated[0]);
  }

  /**
   * Verifica que los platos pedidos existan, estén disponibles y pertenezcan al restaurante,
   * y devuelve sus precios actuales del servidor (el cliente nunca fija el precio).
   */
  static async priceOrderItems(
    restaurantId: string, items: Array<{ menuItemId: string; quantity: number }>
  ): Promise<{ restaurant: RestaurantView; priced: Array<{ menuItemId: string; name: string; price: number; quantity: number }>; subtotal: number }> {
    if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, 'El pedido no tiene platos.');
    const restaurant = await this.getPublic(restaurantId);
    if (!restaurant.isOpen) throw new HttpError(409, 'El restaurante está cerrado ahora.');

    const [rows] = await getPool().query<RowDataPacket[]>(
      'SELECT * FROM menu_items WHERE restaurant_id = ? AND is_available = 1', [restaurantId]
    );
    const byId = new Map(rows.map((r) => [String(r.id), r]));

    let subtotal = 0;
    const priced = items.map((it) => {
      const qty = Math.trunc(Number(it.quantity));
      if (!Number.isFinite(qty) || qty < 1 || qty > 50) throw new HttpError(400, 'Cantidad inválida.');
      const row = byId.get(String(it.menuItemId));
      if (!row) throw new HttpError(409, 'Un plato del pedido ya no está disponible. Actualiza el menú.');
      const price = toNum(row.price);
      subtotal += price * qty;
      return { menuItemId: String(row.id), name: String(row.name), price, quantity: qty };
    });

    return { restaurant, priced, subtotal: Math.round(subtotal * 100) / 100 };
  }
}
