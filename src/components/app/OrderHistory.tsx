/**
 * ZÉNITH — Historial de pedidos (delivery y comida), entregados/cancelados/vencidos.
 * Sirve igual para el cliente (sus pedidos) que para el motorizado (sus viajes).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { History, Package, UtensilsCrossed, X, Clock, Star } from 'lucide-react';
import { RidesApi } from '../../api/endpoints';
import { errorMessage } from '../../api/http';
import type { ApiRide } from '../../api/types';
import { Card, ErrorText, GhostButton, PrimaryButton, PAYMENT_LABEL, soles } from './ui';

/** El cliente elige estrellas (1 a 5) y, si quiere, un comentario, y envía la calificación. */
function RateRide({ rideId, onRated }: { rideId: string; onRated: (ride: ApiRide) => void }) {
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = () => {
    if (stars < 1) {
      setError('Elige de 1 a 5 estrellas.');
      return;
    }
    setBusy(true);
    setError('');
    RidesApi.rate(rideId, stars, feedback.trim() || undefined)
      .then(onRated)
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setBusy(false));
  };

  return (
    <div className="pt-1 space-y-2">
      <p className="text-xs text-gray-400">¿Cómo te fue con el motorizado?</p>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setStars(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            aria-label={`${n} estrella${n === 1 ? '' : 's'}`}
            className="p-0.5"
          >
            <Star size={22} className={(hover || stars) >= n ? 'text-[#39FF14] fill-[#39FF14]' : 'text-gray-600'} />
          </button>
        ))}
      </div>
      <input
        className="w-full bg-white/5 border border-white/10 focus:border-[#39FF14] rounded-xl px-3 py-2 text-xs outline-none"
        placeholder="Comentario (opcional)"
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        maxLength={500}
      />
      <ErrorText text={error} />
      <PrimaryButton busy={busy} onClick={submit} className="!py-2.5 !text-xs">Enviar calificación</PrimaryButton>
    </div>
  );
}

const STATUS_BADGE: Record<string, { text: string; className: string }> = {
  COMPLETED: { text: 'Entregado', className: 'text-[#39FF14] border-[#39FF14]/40' },
  CANCELLED: { text: 'Cancelado', className: 'text-red-400 border-red-400/40' },
  EXPIRED: { text: 'Sin motorizado', className: 'text-yellow-400 border-yellow-400/40' },
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function OrderHistory({ isDriver }: { isDriver: boolean }) {
  const [items, setItems] = useState<ApiRide[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback((p: number, append: boolean) => {
    (append ? setLoadingMore : setLoading)(true);
    setError('');
    RidesApi.history(p, 20)
      .then((r) => {
        setItems((prev) => (append ? [...prev, ...r.items] : r.items));
        setPage(r.page);
        setHasMore(r.hasMore);
        setTotal(r.total);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => (append ? setLoadingMore(false) : setLoading(false)));
  }, []);

  useEffect(() => { load(1, false); }, [load]);

  if (loading) return <p className="text-sm text-gray-500 font-mono">Cargando…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[#39FF14]">
        <History size={22} />
        <h2 className="text-lg font-black uppercase italic">Historial</h2>
      </div>

      <ErrorText text={error} />

      {items.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-400 text-center py-4">Todavía no tienes pedidos terminados.</p>
        </Card>
      ) : (
        <>
          <p className="text-[10px] text-gray-500 font-mono uppercase">{total} pedido{total === 1 ? '' : 's'} en total</p>
          <div className="space-y-2.5">
            {items.map((r) => {
              const badge = STATUS_BADGE[r.status] || { text: r.status, className: 'text-gray-400 border-white/10' };
              const isOpen = expanded === r.id;
              return (
                <React.Fragment key={r.id}>
                <Card className="!space-y-2">
                  <button
                    onClick={() => setExpanded((cur) => (cur === r.id ? null : r.id))}
                    className="w-full flex items-center justify-between gap-3 text-left"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {r.orderType === 'FOOD' ? (
                        <UtensilsCrossed size={16} className="text-[#39FF14] shrink-0" />
                      ) : (
                        <Package size={16} className="text-[#39FF14] shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate">
                          {r.orderType === 'FOOD' && r.food ? r.food.restaurantName : r.destination.address}
                        </p>
                        <p className="text-[10px] text-gray-500 font-mono flex items-center gap-1">
                          <Clock size={10} /> {fmtDate(r.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono text-sm font-bold">{soles(r.price)}</p>
                      <span className={`text-[9px] font-mono uppercase border rounded-lg px-1.5 py-0.5 ${badge.className}`}>
                        {badge.text}
                      </span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="pt-2 border-t border-white/5 space-y-1.5 text-xs">
                      {r.orderType === 'FOOD' && r.food ? (
                        <>
                          <p className="text-gray-400">{r.food.restaurantName}</p>
                          {r.food.items.map((it, i) => (
                            <p key={i} className="flex justify-between text-gray-300">
                              <span>{it.quantity}× {it.name}</span>
                              <span className="font-mono">{soles(it.price * it.quantity)}</span>
                            </p>
                          ))}
                        </>
                      ) : (
                        <>
                          <p className="text-gray-400">Desde: {r.origin.address}</p>
                          <p className="text-gray-400">Hasta: {r.destination.address}</p>
                        </>
                      )}
                      <p className="flex justify-between text-gray-500">
                        <span>Pago</span>
                        <span className="font-mono">{PAYMENT_LABEL[r.paymentMethod] || r.paymentMethod}</span>
                      </p>
                      {isDriver && r.passengerName && (
                        <p className="flex justify-between text-gray-500">
                          <span>Cliente</span>
                          <span>{r.passengerName}</span>
                        </p>
                      )}
                      {!isDriver && r.driverName && (
                        <p className="flex justify-between text-gray-500">
                          <span>Motorizado</span>
                          <span>{r.driverName}</span>
                        </p>
                      )}
                      {r.status === 'CANCELLED' && r.cancelReason && (
                        <p className="flex items-center gap-1 text-red-400">
                          <X size={11} /> {r.cancelReason}
                        </p>
                      )}
                      {r.rating !== null && (
                        <p className="flex justify-between text-gray-500">
                          <span>Calificación</span>
                          <span>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                        </p>
                      )}
                      {!isDriver && r.status === 'COMPLETED' && r.rating === null && (
                        <RateRide
                          rideId={r.id}
                          onRated={(updated) => setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)))}
                        />
                      )}
                    </div>
                  )}
                </Card>
                </React.Fragment>
              );
            })}
          </div>

          {hasMore && (
            <GhostButton onClick={() => load(page + 1, true)} disabled={loadingMore}>
              {loadingMore ? 'Cargando…' : 'Ver más'}
            </GhostButton>
          )}
        </>
      )}
    </div>
  );
}
