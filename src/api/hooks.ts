import { useEffect, useRef, useState } from 'react';
import { Realtime } from './realtime';
import type { RealtimeEvent } from './types';

export const useRealtimeConnected = (): boolean => {
  const [on, setOn] = useState(Realtime.isConnected());
  useEffect(() => Realtime.onState(setOn), []);
  return on;
};

/** Escucha avisos del WebSocket mientras el componente está en pantalla. */
export const useRealtime = (fn: (ev: RealtimeEvent) => void) => {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => Realtime.on((ev) => ref.current(ev)), []);
};

/**
 * Repite `fn` cada cierto tiempo: rápido si el WebSocket está caído, lento si está vivo
 * (el WebSocket ya avisa los cambios; la consulta lenta solo es red de seguridad).
 * `enabled=false` lo detiene.
 */
export const usePolling = (fn: () => void | Promise<void>, enabled: boolean, fastMs = 4000, slowMs = 20000) => {
  const live = useRealtimeConnected();
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => void ref.current(), live ? slowMs : fastMs);
    return () => clearInterval(id);
  }, [enabled, live, fastMs, slowMs]);
};
