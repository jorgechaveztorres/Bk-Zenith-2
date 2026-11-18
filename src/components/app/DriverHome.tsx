/**
 * ZÉNITH — Pantalla del motorizado sobre la API MySQL.
 * Conectarse (GPS) -> recibir oferta (15 s) -> aceptar -> en camino -> llegué ->
 * código de recojo del cliente -> entregado.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Power, Navigation, MapPin, Clock, CheckCircle2, X, Wifi, WifiOff } from 'lucide-react';
import { DriverApi, RidesApi } from '../../api/endpoints';
import { errorMessage } from '../../api/http';
import { useRealtime, useRealtimeConnected, usePolling } from '../../api/hooks';
import { currentFix, watchFix, navUrl, Fix } from '../../api/gps';
import { ACTIVE_RIDE_STATUSES, ApiOffer, ApiRide, ApiUser } from '../../api/types';
import { Card, PrimaryButton, GhostButton, ErrorText, Row, PlaceLine, soles, STATUS_LABEL, PAYMENT_LABEL } from './ui';

const PRESENCE_EVERY_MS = 15_000;

export default function DriverHome({ user }: { user: ApiUser }) {
  const live = useRealtimeConnected();
  const [online, setOnline] = useState(false);
  const [offer, setOffer] = useState<ApiOffer | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [ride, setRide] = useState<ApiRide | null>(null);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<ApiRide | null>(null);

  const lastFix = useRef<Fix | null>(null);
  const lastSent = useRef(0);
  const stopWatch = useRef<(() => void) | null>(null);

  // ------------------------------------------------------------ Carga inicial
  const loadRide = useCallback(async () => {
    try {
      const r = await RidesApi.active();
      setRide(r && r.driverId === user.id ? r : null);
      if (r && r.driverId === user.id) setOnline(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [user.id]);

  useEffect(() => {
    void loadRide();
  }, [loadRide]);

  const loadOffer = useCallback(async () => {
    try {
      const o = await DriverApi.offer();
      setOffer(o);
      if (o) setSecondsLeft(o.expiresInSeconds);
    } catch {
      // se reintenta en la siguiente vuelta
    }
  }, []);

  // ------------------------------------------------------------ Presencia (GPS)
  const sendPresence = useCallback(async (fix: Fix, wantOnline: boolean) => {
    lastSent.current = Date.now();
    await DriverApi.presence({ lat: fix.lat, lng: fix.lng, online: wantOnline, heading: fix.heading, speedKmh: fix.speedKmh });
  }, []);

  const goOnline = async () => {
    setBusy(true);
    setError('');
    try {
      const fix = await currentFix();
      lastFix.current = fix;
      await sendPresence(fix, true);
      setOnline(true);
      void loadOffer();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const goOffline = async () => {
    setBusy(true);
    setError('');
    try {
      const fix = lastFix.current ?? (await currentFix());
      await sendPresence(fix, false);
      setOnline(false);
      setOffer(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const hasRide = ride !== null;

  // Mientras está conectado: seguir el GPS y avisar al servidor (máx. cada 15 s, o antes si se movió).
  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    void watchFix(
      (fix) => {
        lastFix.current = fix;
        const due = Date.now() - lastSent.current > (hasRide ? 5000 : PRESENCE_EVERY_MS);
        if (due) void sendPresence(fix, true).catch((err: unknown) => setError(errorMessage(err)));
      },
      (msg) => setError(msg)
    ).then((stop) => {
      if (cancelled) stop();
      else stopWatch.current = stop;
    }).catch((err: unknown) => setError(errorMessage(err)));

    // Latido aunque no se mueva (el servidor descarta motorizados sin señal > 120 s).
    const beat = setInterval(() => {
      if (lastFix.current && Date.now() - lastSent.current > PRESENCE_EVERY_MS) {
        void sendPresence(lastFix.current, true).catch(() => undefined);
      }
    }, PRESENCE_EVERY_MS);

    return () => {
      cancelled = true;
      clearInterval(beat);
      stopWatch.current?.();
      stopWatch.current = null;
    };
  }, [online, hasRide, sendPresence]);

  // ------------------------------------------------------------ Avisos
  useRealtime((ev) => {
    if (ev.type === 'offer' && online && !ride) void loadOffer();
    if (ev.type === 'offer.closed' && offer?.assignmentId === ev.assignmentId) setOffer(null);
    if (ev.type === 'ride' && ride && ev.rideId === ride.id) {
      void RidesApi.get(ride.id).then((r) => {
        if (ACTIVE_RIDE_STATUSES.includes(r.status)) setRide(r);
        else {
          setRide(null);
          if (r.status === 'CANCELLED') setError('El cliente canceló el pedido.');
        }
      }).catch(() => undefined);
    }
  });

  // Red de seguridad si el WebSocket está caído.
  usePolling(loadOffer, online && !ride && !offer, 4000, 30000);
  usePolling(loadRide, !!ride, 5000, 30000);

  // Cuenta regresiva de la oferta.
  useEffect(() => {
    if (!offer) return;
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setOffer(null);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [offer]);

  // ------------------------------------------------------------ Acciones
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

  const accept = () => offer && act(async () => {
    const r = await DriverApi.accept(offer.assignmentId);
    setOffer(null);
    setRide(r);
  });

  const reject = () => offer && act(async () => {
    await DriverApi.reject(offer.assignmentId);
    setOffer(null);
  });

  const step = (status: 'DRIVER_ARRIVING' | 'WAITING_FOR_OTP' | 'COMPLETED') => ride && act(async () => {
    const r = await DriverApi.setStatus(ride.id, status);
    if (r.status === 'COMPLETED') {
      setRide(null);
      setDone(r);
    } else setRide(r);
  });

  const verify = () => ride && act(async () => {
    if (otp.length !== 4) throw new Error('El código tiene 4 dígitos.');
    setRide(await DriverApi.verifyOtp(ride.id, otp));
    setOtp('');
  });

  const cancel = () => ride && act(async () => {
    if (!window.confirm('¿Cancelar este pedido? Puede contar como penalidad.')) return;
    await RidesApi.cancel(ride.id, 'Cancelado por el motorizado');
    setRide(null);
  });

  // ------------------------------------------------------------ Vista
  const conn = (
    <div className="flex items-center gap-2 text-[10px] font-mono uppercase text-gray-500">
      {live ? <Wifi size={12} className="text-[#39FF14]" /> : <WifiOff size={12} className="text-yellow-500" />}
      {live ? 'Avisos al instante' : 'Avisos por consulta'}
    </div>
  );

  if (done) {
    return (
      <Card>
        <div className="flex items-center gap-3 text-[#39FF14]">
          <CheckCircle2 size={28} />
          <h2 className="text-xl font-black uppercase italic">Pedido entregado</h2>
        </div>
        <Row label="Cobro" value={`${soles(done.price)} · ${PAYMENT_LABEL[done.paymentMethod] || done.paymentMethod}`} />
        <PrimaryButton onClick={() => setDone(null)}>Seguir recibiendo pedidos</PrimaryButton>
      </Card>
    );
  }

  if (ride) {
    const target = ride.status === 'IN_PROGRESS' ? ride.destination : ride.origin;
    return (
      <div className="space-y-4">
        {conn}
        <Card>
          <p className="text-[10px] font-mono uppercase text-[#39FF14] tracking-widest">{STATUS_LABEL[ride.status]}</p>
          <PlaceLine tag="Recojo" address={ride.origin.address} />
          <PlaceLine tag="Entrega" address={ride.destination.address} />
          <Row label="Cobrar" value={`${soles(ride.price)} · ${PAYMENT_LABEL[ride.paymentMethod] || ride.paymentMethod}`} />
          {ride.passengerName && <Row label="Cliente" value={ride.passengerName} />}
          {ride.delivery?.description && <Row label="Paquete" value={ride.delivery.description} />}
          {ride.delivery?.receptorName && (
            <Row
              label="Recibe"
              value={ride.delivery.receptorPhone
                ? <a className="text-[#39FF14] underline" href={`tel:${ride.delivery.receptorPhone}`}>{ride.delivery.receptorName}</a>
                : ride.delivery.receptorName}
            />
          )}
          {ride.delivery?.notes && <Row label="Nota" value={ride.delivery.notes} />}

          <div className="grid grid-cols-2 gap-3">
            <a href={navUrl(target.lat, target.lng, 'google')} target="_blank" rel="noreferrer">
              <GhostButton type="button"><Navigation size={14} /> Google Maps</GhostButton>
            </a>
            <a href={navUrl(target.lat, target.lng, 'waze')} target="_blank" rel="noreferrer">
              <GhostButton type="button"><Navigation size={14} /> Waze</GhostButton>
            </a>
          </div>

          {ride.status === 'DRIVER_ASSIGNED' && <PrimaryButton busy={busy} onClick={() => step('DRIVER_ARRIVING')}>Voy en camino al recojo</PrimaryButton>}
          {ride.status === 'DRIVER_ARRIVING' && <PrimaryButton busy={busy} onClick={() => step('WAITING_FOR_OTP')}>Llegué al recojo</PrimaryButton>}
          {ride.status === 'WAITING_FOR_OTP' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">Pide al cliente su código de 4 dígitos para iniciar.</p>
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                inputMode="numeric"
                placeholder="• • • •"
                className="w-full text-center text-3xl tracking-[0.6em] bg-white/5 border border-white/10 rounded-xl py-3 outline-none focus:border-[#39FF14]/60"
              />
              <PrimaryButton busy={busy} onClick={verify}>Validar código e iniciar</PrimaryButton>
            </div>
          )}
          {ride.status === 'IN_PROGRESS' && <PrimaryButton busy={busy} onClick={() => step('COMPLETED')}>Pedido entregado</PrimaryButton>}
          {ride.status !== 'IN_PROGRESS' && <GhostButton disabled={busy} onClick={cancel}>Cancelar pedido</GhostButton>}
          <ErrorText text={error} />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {conn}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase text-gray-500">Estado</p>
            <p className={`text-lg font-black uppercase ${online ? 'text-[#39FF14]' : 'text-gray-400'}`}>
              {online ? 'Conectado' : 'Desconectado'}
            </p>
          </div>
          <Power size={28} className={online ? 'text-[#39FF14]' : 'text-gray-600'} />
        </div>
        {online
          ? <GhostButton disabled={busy} onClick={goOffline}>Desconectarme</GhostButton>
          : <PrimaryButton busy={busy} onClick={goOnline}>Conectarme y recibir pedidos</PrimaryButton>}
        {online && !offer && <p className="text-xs text-gray-500 font-mono">Esperando pedidos cerca de ti…</p>}
        <ErrorText text={error} />
      </Card>

      {offer && (
        <Card className="border-[#39FF14]/50">
          <div className="flex items-center justify-between">
            <p className="text-2xl font-black text-[#39FF14]">{soles(offer.price)}</p>
            <span className="flex items-center gap-1 text-sm font-mono text-yellow-400"><Clock size={14} /> {secondsLeft}s</span>
          </div>
          <Row label="Al recojo" value={`${offer.distanceToPickupKm.toFixed(1)} km`} />
          {offer.tripDistanceKm !== null && <Row label="Recorrido" value={`${offer.tripDistanceKm.toFixed(1)} km`} />}
          <Row label="Pago" value={PAYMENT_LABEL[offer.paymentMethod] || offer.paymentMethod} />
          <PlaceLine tag="Recojo" address={offer.origin.address} />
          <PlaceLine tag="Entrega" address={offer.destination.address} />
          <div className="grid grid-cols-2 gap-3">
            <GhostButton disabled={busy} onClick={reject}><X size={14} /> Rechazar</GhostButton>
            <PrimaryButton busy={busy} onClick={accept}><MapPin size={14} /> Aceptar</PrimaryButton>
          </div>
        </Card>
      )}
    </div>
  );
}
