/**
 * ZÉNITH — BILLETERA DEL MOTORIZADO (MySQL)
 *
 * Modelo InDrive: el cliente paga en efectivo/Yape directo al motorizado.
 * El motorizado le "debe" a Zénith la comisión de cada pedido (cash_debt).
 * Para seguir pagar esa deuda recarga vía Yape (ver topup.service.ts); el
 * admin confirma la recarga y se descuenta de la deuda.
 *
 * Los primeros `new_driver_free_days` días desde su aprobación, el
 * motorizado no paga comisión (decisión del negocio, ver app_settings).
 */
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getPool } from '../config/mysql';
import { getNumberSetting } from './settings.service';
import { HttpError } from './http-error';

export interface WalletView {
  driverId: string;
  cashDebt: number;
  accumulatedCommission: number;
  debtLimit: number;
  blocked: boolean;
  freeUntil: string | null;
  isInFreePeriod: boolean;
}

export interface WalletMovementView {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string | null;
  rideId: string | null;
  topupId: string | null;
  createdAt: string;
}

const toIso = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : v ? String(v) : null);
const money = (n: number): number => Math.round(n * 100) / 100;

const newMovementId = (): string =>
  `wm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

export class WalletService {
  /** Calcula hasta cuándo el motorizado tiene comisión 0%, a partir de su fecha de aprobación. */
  static async freePeriodEnd(conn: PoolConnection | null, driverId: string): Promise<Date | null> {
    const sql = `SELECT reviewed_at, created_at, status FROM driver_profiles WHERE user_id = ?`;
    const [rows] = conn
      ? await conn.query<RowDataPacket[]>(sql, [driverId])
      : await getPool().query<RowDataPacket[]>(sql, [driverId]);
    const p = rows[0];
    if (!p) return null;
    const anchor = p.reviewed_at || p.created_at;
    if (!anchor) return null;
    const freeDays = await getNumberSetting('new_driver_free_days', 14);
    const end = new Date(anchor);
    end.setDate(end.getDate() + freeDays);
    return end;
  }

  static async getOrCreateWallet(driverId: string): Promise<WalletView> {
    const pool = getPool();
    await pool.execute('INSERT IGNORE INTO wallets (driver_id) VALUES (?)', [driverId]);
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT driver_id, cash_debt, accumulated_commission FROM wallets WHERE driver_id = ?', [driverId]
    );
    const w = rows[0];
    if (!w) throw new HttpError(404, 'No se encontró la billetera.');
    const debtLimit = await getNumberSetting('wallet_debt_limit', 50);
    const freeUntil = await WalletService.freePeriodEnd(null, driverId);
    return {
      driverId,
      cashDebt: money(Number(w.cash_debt)),
      accumulatedCommission: money(Number(w.accumulated_commission)),
      debtLimit,
      blocked: Number(w.cash_debt) > debtLimit,
      freeUntil: freeUntil ? freeUntil.toISOString() : null,
      isInFreePeriod: Boolean(freeUntil && freeUntil.getTime() > Date.now()),
    };
  }

  static async getMovements(driverId: string, limit = 50): Promise<WalletMovementView[]> {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT id, type, amount, balance_after, description, ride_id, topup_id, created_at
       FROM wallet_movements WHERE driver_id = ? ORDER BY created_at DESC LIMIT ?`,
      [driverId, limit]
    );
    return rows.map((r) => ({
      id: String(r.id),
      type: String(r.type),
      amount: money(Number(r.amount)),
      balanceAfter: money(Number(r.balance_after)),
      description: r.description ?? null,
      rideId: r.ride_id ?? null,
      topupId: r.topup_id ?? null,
      createdAt: toIso(r.created_at) || '',
    }));
  }

  /** Si la deuda ya supera el límite, no puede conectarse a recibir pedidos. */
  static async isBlockedByDebt(conn: PoolConnection, driverId: string): Promise<boolean> {
    const [rows] = await conn.query<RowDataPacket[]>('SELECT cash_debt FROM wallets WHERE driver_id = ?', [driverId]);
    const debt = rows[0] ? Number(rows[0].cash_debt) : 0;
    const limit = await getNumberSetting('wallet_debt_limit', 50);
    return debt > limit;
  }

  /**
   * Se llama dentro de la misma transacción al completar un pedido.
   * Cobra la comisión de la plataforma (0% en los días gratis) como deuda del motorizado.
   */
  static async chargeRideCommission(conn: PoolConnection, rideId: string, driverId: string, grossAmount: number): Promise<void> {
    await conn.execute('INSERT IGNORE INTO wallets (driver_id) VALUES (?)', [driverId]);

    const freeUntil = await WalletService.freePeriodEnd(conn, driverId);
    const inFreePeriod = Boolean(freeUntil && freeUntil.getTime() > Date.now());
    if (inFreePeriod) return; // sin comisión durante los días gratis

    const rate = await getNumberSetting('platform_commission_rate', 0.10);
    const minAmount = await getNumberSetting('commission_min_amount', 0.50);
    const commission = money(Math.max(grossAmount * rate, minAmount));
    if (commission <= 0) return;

    const [res] = await conn.execute(
      `UPDATE wallets SET cash_debt = cash_debt + ?, accumulated_commission = accumulated_commission + ?, version = version + 1
       WHERE driver_id = ?`,
      [commission, commission, driverId]
    );
    if ((res as { affectedRows: number }).affectedRows === 0) return;

    const [after] = await conn.query<RowDataPacket[]>('SELECT cash_debt FROM wallets WHERE driver_id = ?', [driverId]);
    await conn.execute(
      `INSERT INTO wallet_movements (id, driver_id, type, amount, balance_after, description, ride_id)
       VALUES (?, ?, 'platform_commission', ?, ?, ?, ?)`,
      [newMovementId(), driverId, commission, money(Number(after[0].cash_debt)), `Comisión Zénith (${(rate * 100).toFixed(0)}%) pedido #${rideId.slice(0, 8)}`, rideId]
    );
  }

  /** Se llama al acreditar una recarga Yape (ver topup.service.ts): abona la deuda del motorizado. */
  static async applyTopupCredit(conn: PoolConnection, driverId: string, topupId: string, amount: number): Promise<void> {
    await conn.execute('INSERT IGNORE INTO wallets (driver_id) VALUES (?)', [driverId]);
    await conn.execute(
      `UPDATE wallets SET cash_debt = GREATEST(0, cash_debt - ?), version = version + 1 WHERE driver_id = ?`,
      [amount, driverId]
    );
    const [after] = await conn.query<RowDataPacket[]>('SELECT cash_debt FROM wallets WHERE driver_id = ?', [driverId]);
    await conn.execute(
      `INSERT INTO wallet_movements (id, driver_id, type, amount, balance_after, description, topup_id)
       VALUES (?, ?, 'topup_yape', ?, ?, 'Recarga Yape acreditada', ?)`,
      [newMovementId(), driverId, money(amount), money(Number(after[0].cash_debt)), topupId]
    );
  }
}
