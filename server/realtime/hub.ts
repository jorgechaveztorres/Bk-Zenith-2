/**
 * ZÉNITH — HUB WEBSOCKET
 *
 * Dirección: wss://<dominio><BASE_PATH>/ws   (ej. wss://shocos.nom.pe/zenith-api/ws)
 * Protocolo (JSON):
 *   1. La app se conecta y en menos de 10 s envía {"type":"auth","token":"<accessToken>"}.
 *      (El token NO va en la URL para que no quede en los registros del servidor.)
 *   2. Respuesta {"type":"ready","userId":"..."}; si falla, se cierra con código 4001.
 *   3. Desde ahí recibe avisos RealtimeEvent (ver bus.ts).
 *   4. El servidor envía ping cada 25 s; las conexiones muertas se cierran.
 *   Si el token vence, la app reconecta con uno nuevo.
 */
import type { Server as HttpServer, IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyAccessToken } from '../services/auth.service';
import { onRealtime, RealtimeEvent } from './bus';

interface ZenithSocket extends WebSocket {
  userId?: string;
  alive?: boolean;
}

const AUTH_TIMEOUT_MS = 10_000;
const PING_MS = 25_000;

export class RealtimeHub {
  private wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
  private byUser = new Map<string, Set<ZenithSocket>>();
  private pingTimer: NodeJS.Timeout;
  private unsubscribe: () => void;

  constructor(private paths: string[]) {
    this.wss.on('connection', (ws: ZenithSocket) => this.onConnection(ws));
    this.unsubscribe = onRealtime((userId, event) => this.send(userId, event));
    this.pingTimer = setInterval(() => this.heartbeat(), PING_MS);
    this.pingTimer.unref();
  }

  /** Conecta el hub al servidor HTTP: solo atiende la ruta del WebSocket. */
  attach(server: HttpServer) {
    server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      const url = (req.url || '').split('?')[0].replace(/\/+$/, '');
      if (!this.paths.includes(url)) {
        socket.destroy();
        return;
      }
      this.wss.handleUpgrade(req, socket, head, (ws) => this.wss.emit('connection', ws, req));
    });
    return this;
  }

  /** Cuántas conexiones activas tiene un usuario (para pruebas y diagnóstico). */
  connectionsOf(userId: string): number {
    return this.byUser.get(userId)?.size || 0;
  }

  close() {
    clearInterval(this.pingTimer);
    this.unsubscribe();
    for (const set of this.byUser.values()) for (const ws of set) ws.terminate();
    this.byUser.clear();
    this.wss.close();
  }

  private onConnection(ws: ZenithSocket) {
    ws.alive = true;
    ws.on('pong', () => { ws.alive = true; });
    const authTimer = setTimeout(() => ws.close(4001, 'auth timeout'), AUTH_TIMEOUT_MS);

    ws.on('message', (raw) => {
      let msg: { type?: unknown; token?: unknown };
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (msg.type === 'auth' && !ws.userId) {
        try {
          const claims = verifyAccessToken(String(msg.token || ''));
          clearTimeout(authTimer);
          ws.userId = claims.sub;
          if (!this.byUser.has(claims.sub)) this.byUser.set(claims.sub, new Set());
          this.byUser.get(claims.sub)?.add(ws);
          ws.send(JSON.stringify({ type: 'ready', userId: claims.sub }));
        } catch {
          ws.close(4001, 'auth failed');
        }
      }
    });

    ws.on('close', () => {
      clearTimeout(authTimer);
      if (ws.userId) {
        const set = this.byUser.get(ws.userId);
        set?.delete(ws);
        if (set && set.size === 0) this.byUser.delete(ws.userId);
      }
    });
    ws.on('error', () => ws.terminate());
  }

  private send(userId: string, event: RealtimeEvent) {
    const set = this.byUser.get(userId);
    if (!set) return;
    const data = JSON.stringify(event);
    for (const ws of set) if (ws.readyState === WebSocket.OPEN) ws.send(data);
  }

  private heartbeat() {
    for (const ws of this.wss.clients as Set<ZenithSocket>) {
      if (!ws.alive) {
        ws.terminate();
        continue;
      }
      ws.alive = false;
      ws.ping();
    }
  }
}

/**
 * Rutas aceptadas: /ws y, si hay BASE_PATH, también /zenith-api/ws
 * (según el hosting, LiteSpeed entrega o no la subcarpeta).
 */
export const realtimePaths = (): string[] => {
  const base = (process.env.BASE_PATH || '').replace(/\/+$/, '');
  return base ? [`${base}/ws`, '/ws'] : ['/ws'];
};
