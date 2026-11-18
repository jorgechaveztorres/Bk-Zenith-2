/**
 * ZÉNITH — Pantalla del cliente sobre la API MySQL.
 * Recojo + entrega -> precio firmado por el servidor -> pedir -> seguir al motorizado.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Wifi, WifiOff, Phone, CheckCircle2, XCircle } from 'lucide-react';
import { RidesApi, PricingApi, GeoApi } from '../../api/endpoints';
import { errorMessage } from '../../api/http';
import { useRealtime, useRealtimeConnected, usePolling } from '../../api/hooks';
import { ACTIVE_RIDE_STATUSES, ApiQuote, ApiRide, ApiUser, GeoPoint, Place } from '../../api/types';
import AddressPicker from './AddressPicker';
import ZenithMap from './ZenithMap';
import { Card, PrimaryButton, GhostButton, ErrorText, Row, PlaceLine, soles, STATUS_LABEL, PAYMENT_LABEL } from './ui';

type Payment = 'cash' | 'yape' | 'plin';

const smallInput = 'w-full bg-white/5 border border-white/10 focus:border-[#39FF14]/60 rounded-xl px-3 py-2.5 text-sm outline-none';

export default function PassengerHome({ user }: { user: ApiUser }) {
  const live = useRealtimeConnected();
  const [loading, setLoading] = useState(true);
  const [ride, setRide] = useState<ApiRide | null>(null);
  const [finished, setFinished] = useState<ApiRide | null>(null);

  // Formulario
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [tapTarget, setTapTarget] = useState<'origin' | 'destination'>('origin');
  const [description, setDescription] = useState('');
  const [receptorName, setReceptorName] = useState('');
  const [receptorPhone, setReceptorPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [payment, setPayment] = useState<Payment>('cash');
  const [quote, setQuote] = useState<ApiQuote | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  // ------------------------------------------------------------ Pedido activo
  const refresh = useCallback(async (rideId?: string) => {
    try {
      const r = rideId ? await RidesApi.get(rideId) : await RidesApi.active();
      if (!r) {
        setRide(null);
        return;
      }
      if (ACTIVE_RIDE_STATUSES.includes(r.status)) {
        // El código de recojo solo viene en GET /rides/:id; se conserva si la respuesta no lo trae.
        setRide((prev) => ({ ...r, otpCode: r.otpCode ?? (prev?.id === r.id ? prev.otpCode : undefined) }));
      } else {
        setRide(null);
        setFinished(r);
      }
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const active = await RidesApi.active();
        // /rides/active no trae el código: pedir el detalle.
        if (active && active.passengerId === user.id) await refresh(active.id);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh, user.id]);

  useRealtime((ev) => {
    if (!ride) return;
    if (ev.type === 'ride' && ev.rideId === ride.id) void refresh(ride.id);
    if (ev.type === 'ride.location' && ev.rideId === ride.id) {
      setRide((r) => (r && r.id === ev.rideId ? { ...r, driverLocation: { lat: ev.lat, lng: ev.lng } } : r));
    }
  });

  usePolling(() => (ride ? refresh(ride.id) : undefined), !!ride, 4000, 20000);

  // Cualquier cambio en el formulario invalida el precio.
  useEffect(() => setQuote(null), [origin, destination]);

  // ------------------------------------------------------------ Acciones
  const pickOnMap = (p: GeoPoint) => act(async () => {
    const place = await GeoApi.reverse(p.lat, p.lng);
    if (tapTarget === 'origin') {
      setOrigin(place);
      if (!destination) setTapTarget('destination');
    } else setDestination(place);
  });

  const getQuote = () => act(async () => {
    if (!origin || !destination) throw new Error('Elige el recojo y la entrega.');
    setQuote(await PricingApi.quote(origin, destination));
  });

  const order = () => act(async () => {
    if (!quote) return;
    if (new Date(quote.expiresAt).getTime() < Date.now()) {
      setQuote(null);
      throw new Error('El precio venció. Vuelve a calcularlo.');
    }
    if (receptorPhone && !/^9\d{8}$/.test(receptorPhone)) throw new Error('El celular de quien recibe debe tener 9 dígitos.');
    const r = await RidesApi.request(quote, payment, {
      description: description.trim() || undefined,
      receptorName: receptorName.trim() || undefined,
      receptorPhone: receptorPhone || undefined,
      notes: notes.trim() || undefined,
    });
    setRide(r);
    setQuote(null);
  });

  const cancel = () => ride && act(async () => {
    if (!window.confirm('¿Cancelar el pedido?')) return;
    const r = await RidesApi.cancel(ride.id, 'Cancelado por el cliente');
    setRide(null);
    setFinished(r);
  });

  const newOrder = () => {
    setFinished(null);
    setDestination(null);
    setDescription('');
    setReceptorName('');
    setReceptorPhone('');
    setNotes('');
    setTapTarget('destination');
  };

  // ------------------------------------------------------------ Vista
  const conn = (
    <div className="flex items-center gap-2 text-[10px] font-mono uppercase text-gray-500">
      {live ? <Wifi size={12} className="text-[#39FF14]" /> : <WifiOff size={12} className="text-yellow-500" />}
      {live ? 'Avisos al instante' : 'Avisos por consulta'}
    </div>
  );

  if (loading) return <p className="text-sm text-gray-500 font-mono">Cargando…</p>;

  if (finished) {
    const ok = finished.status === 'COMPLETED';
    return (
      <Card>
        <div className={`flex items-center gap-3 ${ok ? 'text-[#39FF14]' : 'text-red-400'}`}>
          {ok ? <CheckCircle2 size={28} /> : <XCircle size={28} />}
          <h2 className="text-xl font-black uppercase italic">{STATUS_LABEL[finished.status]}</h2>
        </div>
        <PlaceLine tag="Entrega" address={finished.destination.address} />
        {ok && <Row label="Total" value={`${soles(finished.price)} · ${PAYMENT_LABEL[finished.paymentMethod] || finished.paymentMethod}`} />}
        <PrimaryButton onClick={newOrder}>Hacer otro pedido</PrimaryButton>
      </Card>
    );
  }

  if (ride) {
    const showOtp = ride.otpCode && ['DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'WAITING_FOR_OTP'].includes(ride.status);
    return (
      <div className="space-y-4">
        {conn}
        <ZenithMap origin={ride.origin} destination={ride.destination} driver={ride.driverLocation} />
        <Card>
          <p className="text-[10px] font-mono uppercase text-[#39FF14] tracking-widest">{STATUS_LABEL[ride.status]}</p>
          {ride.status === 'SEARCHING_DRIVER' && <p className="text-xs text-gray-400">Estamos avisando al motorizado más cercano…</p>}
          {showOtp && (
            <div className="text-center bg-[#39FF14]/10 border border-[#39FF14]/40 rounded-xl py-3">
              <p className="text-[10px] font-mono uppercase text-gray-400">Código de recojo (dáselo al motorizado)</p>
              <p className="text-4xl font-black tracking-[0.4em] text-[#39FF14]">{ride.otpCode}</p>
            </div>
          )}
          {ride.driverName && (
            <Row
              label="Motorizado"
              value={ride.driverPhone
                ? <a href={`tel:${ride.driverPhone}`} className="inline-flex items-center gap-1 text-[#39FF14] underline"><Phone size={12} />{ride.driverName}</a>
                : ride.driverName}
            />
          )}
          <PlaceLine tag="Recojo" address={ride.origin.address} />
          <PlaceLine tag="Entrega" address={ride.destination.address} />
          <Row label="Total" value={`${soles(ride.price)} · ${PAYMENT_LABEL[ride.paymentMethod] || ride.paymentMethod}`} />
          {ride.status !== 'IN_PROGRESS' && <GhostButton disabled={busy} onClick={cancel}>Cancelar pedido</GhostButton>}
          <ErrorText text={error} />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {conn}
      <ZenithMap origin={origin} destination={destination} onPick={pickOnMap} />
      <div className="flex gap-2 text-[10px] font-mono uppercase">
        <span className="text-gray-500 self-center">Tocar el mapa para:</span>
        {(['origin', 'destination'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTapTarget(t)}
            className={`px-3 py-1.5 rounded-lg border ${tapTarget === t ? 'border-[#39FF14] text-[#39FF14] bg-[#39FF14]/10' : 'border-white/10 text-gray-400'}`}
          >
            {t === 'origin' ? 'Recojo' : 'Entrega'}
          </button>
        ))}
      </div>

      <Card>
        <AddressPicker label="Recojo" value={origin} onChange={setOrigin} allowGps />
        <AddressPicker label="Entrega" value={destination} onChange={setDestination} />

        <div className="space-y-2">
          <p className="text-[10px] font-mono uppercase text-gray-500 tracking-widest">Datos del envío (opcional)</p>
          <input className={smallInput} placeholder="¿Qué envías? (ej. 1 caja de zapatos)" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} />
          <div className="grid grid-cols-2 gap-2">
            <input className={smallInput} placeholder="Quién recibe" value={receptorName} onChange={(e) => setReceptorName(e.target.value)} maxLength={100} />
            <input className={smallInput} placeholder="Su celular" inputMode="numeric" value={receptorPhone} onChange={(e) => setReceptorPhone(e.target.value.replace(/\D/g, '').slice(0, 9))} />
          </div>
          <input className={smallInput} placeholder="Nota para el motorizado" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} />
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(['cash', 'yape', 'plin'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPayment(p)}
              className={`py-2.5 rounded-xl border text-xs font-mono uppercase font-bold ${payment === p ? 'border-[#39FF14] text-[#39FF14] bg-[#39FF14]/10' : 'border-white/10 text-gray-400'}`}
            >
              {PAYMENT_LABEL[p]}
            </button>
          ))}
        </div>

        {quote ? (
          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] font-mono uppercase text-gray-500">Precio</p>
                <p className="text-3xl font-black text-[#39FF14]">{soles(quote.totalFare)}</p>
              </div>
              <p className="text-xs text-gray-400 font-mono text-right">{quote.distance.toFixed(1)} km · ~{Math.round(quote.duration)} min</p>
            </div>
            <PrimaryButton busy={busy} onClick={order}>Pedir motorizado</PrimaryButton>
          </div>
        ) : (
          <PrimaryButton busy={busy} disabled={!origin || !destination} onClick={getQuote}>Ver precio</PrimaryButton>
        )}
        <ErrorText text={error} />
      </Card>
    </div>
  );
}
