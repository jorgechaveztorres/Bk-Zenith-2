/**
 * ZÉNITH — Notificaciones push (Web Push / VAPID).
 *
 * Reemplaza a Firebase Cloud Messaging (ya quitado del proyecto). Estándar web,
 * gratis, sin depender de ningún proveedor externo. Se enchufa al bus de avisos
 * en tiempo real (realtime/bus.ts) para avisar aunque el celular tenga la app
 * cerrada o en segundo plano.
 */
import * as webpush from 'web-push';
import type { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../config/mysql';
import { HttpError } from './http-error';
import { onRealtime, type RealtimeEvent } from '../realtime/bus';

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

let configured = false;
const ensureConfigured = () => {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:soporte@shocos.nom.pe';
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
};

const newId = (): string => `push_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

export const PushService = {
  /** Clave pública que el navegador necesita para suscribirse. */
  publicKey(): string | null {
    return process.env.VAPID_PUBLIC_KEY || null;
  },

  /** Guarda (o reemplaza) la suscripción de este celular/navegador para el usuario. */
  async subscribe(userId: string, sub: PushSubscriptionInput): Promise<void> {
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      throw new HttpError(400, 'Suscripción push incompleta.');
    }
    await getPool().query(
      `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth)`,
      [newId(), userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth]
    );
  },

  /** El celular ya no quiere más avisos (o el usuario cerró sesión). */
  async unsubscribe(endpoint: string): Promise<void> {
    if (!endpoint) return;
    await getPool().query('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
  },

  /** Manda el aviso a todos los celulares suscritos de ese usuario (mejor esfuerzo). */
  async sendToUser(userId: string, payload: { title: string; body: string; data?: Record<string, unknown> }): Promise<void> {
    if (!ensureConfigured()) return; // sin claves VAPID configuradas: no hay push, la app sigue por WebSocket/consulta.
    const [rows] = await getPool().query<RowDataPacket[]>(
      'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?', [userId]
    );
    const json = JSON.stringify(payload);
    await Promise.all(rows.map(async (r) => {
      try {
        await webpush.sendNotification(
          { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
          json
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // El navegador/OS invalidó esta suscripción (desinstaló la app, etc.): se borra sola.
          await getPool().query('DELETE FROM push_subscriptions WHERE id = ?', [r.id]).catch(() => undefined);
        } else {
          console.error('[PUSH] No se pudo enviar a', r.endpoint, (err as Error).message);
        }
      }
    }));
  },
};

/** Mensajes en español para cada aviso en tiempo real que vale la pena empujar como push. */
const describe = (event: RealtimeEvent): { title: string; body: string } | null => {
  switch (event.type) {
    case 'offer':
      return { title: 'Nuevo pedido disponible', body: 'Tienes 15 segundos para aceptarlo.' };
    case 'ride': {
      const labels: Record<string, string> = {
        DRIVER_ASSIGNED: 'Un motorizado aceptó tu pedido.',
        DRIVER_ARRIVING: 'El motorizado está en camino.',
        WAITING_FOR_OTP: 'El motorizado llegó. Dale tu código.',
        COMPLETED: 'Tu pedido fue entregado.',
        CANCELLED: 'Tu pedido fue cancelado.',
        EXPIRED: 'No encontramos un motorizado disponible.',
      };
      const body = labels[event.status];
      return body ? { title: 'ZÉNITH', body } : null;
    }
    default:
      return null;
  }
};

/** Se conecta una sola vez al bus de avisos; cada servicio sigue avisando igual que antes. */
onRealtime((userId, event) => {
  const msg = describe(event);
  if (!msg) return;
  PushService.sendToUser(userId, msg).catch((err) => console.error('[PUSH] Error al avisar:', (err as Error).message));
});
