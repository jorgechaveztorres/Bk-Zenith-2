/**
 * ZÉNITH — Avisos en tiempo real (WebSocket propio, reemplaza onSnapshot de Firestore).
 *
 * Protocolo (server/realtime/hub.ts): conectar a /ws, enviar {"type":"auth","token"} y
 * esperar {"type":"ready"}. Los avisos dicen QUÉ cambió; la pantalla vuelve a pedir los datos.
 * Si el WebSocket no conecta, las pantallas siguen funcionando con consulta periódica
 * (ver usePolling en hooks.ts): por eso `connected` se expone para bajar la frecuencia.
 */
import { getAccessToken, refreshAccessToken, wsUrl } from './http';
import type { RealtimeEvent } from './types';

type Listener = (ev: RealtimeEvent) => void;
type StateListener = (connected: boolean) => void;

const listeners = new Set<Listener>();
const stateListeners = new Set<StateListener>();

let socket: WebSocket | null = null;
let connected = false;
let wanted = false;
let retry = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

const setConnected = (v: boolean) => {
  if (connected === v) return;
  connected = v;
  for (const fn of stateListeners) fn(v);
};

const scheduleReconnect = () => {
  if (!wanted || retryTimer) return;
  // 1 s, 2 s, 4 s ... hasta 30 s
  const delay = Math.min(30_000, 1000 * 2 ** Math.min(retry, 5));
  retry += 1;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void open();
  }, delay);
};

const open = async () => {
  if (!wanted || socket) return;
  const token = await getAccessToken();
  if (!token || !wanted) return;

  let ws: WebSocket;
  try {
    ws = new WebSocket(wsUrl());
  } catch {
    scheduleReconnect();
    return;
  }
  socket = ws;

  ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token }));

  ws.onmessage = (msg) => {
    let data: { type?: string } & Record<string, unknown>;
    try {
      data = JSON.parse(String(msg.data));
    } catch {
      return;
    }
    if (data.type === 'ready') {
      retry = 0;
      setConnected(true);
      return;
    }
    for (const fn of listeners) {
      try {
        fn(data as unknown as RealtimeEvent);
      } catch (err) {
        console.error('[REALTIME] Error en un oyente:', err);
      }
    }
  };

  ws.onclose = (ev) => {
    if (socket === ws) socket = null;
    setConnected(false);
    if (ev.code === 4001) {
      // Token vencido o inválido: renovar y volver a intentar.
      void refreshAccessToken().then(() => scheduleReconnect());
      return;
    }
    scheduleReconnect();
  };

  ws.onerror = () => ws.close();
};

export const Realtime = {
  /** Llamar al iniciar sesión. */
  start() {
    wanted = true;
    void open();
  },
  /** Llamar al cerrar sesión. */
  stop() {
    wanted = false;
    retry = 0;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    socket?.close(1000, 'logout');
    socket = null;
    setConnected(false);
  },
  /** Reintento inmediato (p. ej. cuando la app vuelve al primer plano). */
  wake() {
    if (!wanted || socket) return;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    void open();
  },
  isConnected: () => connected,
  on(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  onState(fn: StateListener): () => void {
    stateListeners.add(fn);
    return () => stateListeners.delete(fn);
  },
};
