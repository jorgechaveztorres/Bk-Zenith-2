/**
 * ZÉNITH — AVISOS EN TIEMPO REAL (bus interno)
 *
 * Los servicios (pedidos, despacho, GPS) anuncian aquí "algo cambió" DESPUÉS de guardar
 * en la base. El hub de WebSocket (realtime/hub.ts) reparte esos avisos a los celulares.
 * Si el hub no está activo (pruebas, o el hosting bloquea WebSocket), los avisos se
 * descartan y la app sigue funcionando consultando cada pocos segundos.
 *
 * Patrón "aviso y consulta": el aviso dice QUÉ cambió; la app pide los datos a la API.
 * Excepción: la ubicación del motorizado viaja dentro del aviso porque cambia muy seguido.
 */
export type RealtimeEvent =
  | { type: 'offer'; rideId: string; assignmentId: string }          // motorizado: tienes una oferta nueva
  | { type: 'offer.closed'; assignmentId: string; reason: string }   // motorizado: esa oferta ya no está
  | { type: 'ride'; rideId: string; status: string }                 // cliente/motorizado: el pedido cambió
  | { type: 'ride.location'; rideId: string; lat: number; lng: number; heading: number | null };

export interface PendingNotice {
  userId: string;
  event: RealtimeEvent;
}

type Listener = (userId: string, event: RealtimeEvent) => void;
const listeners = new Set<Listener>();

export const onRealtime = (fn: Listener): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const notify = (notices: PendingNotice[]) => {
  for (const n of notices) {
    for (const fn of listeners) {
      try {
        fn(n.userId, n.event);
      } catch (err) {
        console.error('[REALTIME] Error al avisar:', (err as Error).message);
      }
    }
  }
};
