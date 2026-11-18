/**
 * ZÉNITH — Cobro con Culqi (tarjeta y Yape, con menos fricción que el Yape manual).
 *
 * El celular del motorizado genera un token con Culqi Checkout (culqi.com) y lo manda
 * al servidor; aquí se crea el cargo real contra la API de Culqi. Las credenciales
 * (llave secreta) viven solo en variables de entorno, nunca en el código ni en el chat.
 */
import { HttpError } from './http-error';

const CULQI_API = 'https://api.culqi.com/v2/charges';

export interface CulqiCharge {
  id: string;
  amountCents: number;
  outcomeType: string; // "venta_exitosa" cuando el cargo se aprueba
}

export const CulqiService = {
  isConfigured(): boolean {
    return Boolean(process.env.CULQI_SECRET_KEY);
  },

  /** Crea el cargo por `amountSoles` (en soles, con decimales) contra el token del celular. */
  async createCharge(token: string, amountSoles: number, email: string): Promise<CulqiCharge> {
    const secretKey = process.env.CULQI_SECRET_KEY;
    if (!secretKey) throw new HttpError(503, 'El cobro con Culqi no está disponible por ahora. Usa la recarga manual por Yape.');

    const amountCents = Math.round(amountSoles * 100);
    let res: Response;
    try {
      res = await fetch(CULQI_API, {
        method: 'POST',
        headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amountCents, currency_code: 'PEN', email, source_id: token }),
      });
    } catch (err) {
      console.error('[CULQI] No se pudo contactar a Culqi:', (err as Error).message);
      throw new HttpError(502, 'No se pudo conectar con Culqi. Intenta de nuevo o usa la recarga manual.');
    }

    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok) {
      const msg = typeof body.user_message === 'string' ? body.user_message : 'Culqi rechazó el pago.';
      throw new HttpError(402, msg);
    }
    const outcome = body.outcome as { type?: string } | undefined;
    return {
      id: String(body.id),
      amountCents: Number(body.amount ?? amountCents),
      outcomeType: outcome?.type || 'desconocido',
    };
  },
};
