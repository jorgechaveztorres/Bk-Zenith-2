import React, { useState, useEffect } from 'react';
import { 
  Ride, 
  User, 
  TransitStatus, 
  DeliveryStatus, 
  CustodyStatus, 
  ProductType,
  CommunicationChannel,
  MotorizadoInfo,
  EvidenceLevel 
} from '../../types';
import { OperationalEngine } from '../../services/OperationalEngine';
import { 
  Package, 
  MapPin, 
  Clock, 
  ShieldCheck, 
  Phone, 
  MessageSquare, 
  AlertTriangle, 
  CheckCircle, 
  X, 
  Camera, 
  Check, 
  RotateCcw, 
  Navigation,
  Key,
  Flame,
  User as UserIcon,
  Compass,
  AlertOctagon,
  Wrench,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ZenithOperationTimeline from './ZenithOperationTimeline';

interface ZenithMotorizadoCockpitProps {
  ride: Ride;
  driverUser: User;
  onRideUpdated?: () => void;
}

export default function ZenithMotorizadoCockpit({
  ride,
  driverUser,
  onRideUpdated
}: ZenithMotorizadoCockpitProps) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modals
  const [showTimeline, setShowTimeline] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [breakdownDescription, setBreakdownDescription] = useState('');
  const [showAccidentModal, setShowAccidentModal] = useState(false);
  const [accidentDescription, setAccidentDescription] = useState('');
  const [productRecoverable, setProductRecoverable] = useState(true);

  // OTP Verification
  const [enteredOtp, setEnteredOtp] = useState('');

  // Initial Custody Photo simulation
  const [initialPhotos, setInitialPhotos] = useState<string[]>([
    'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&auto=format&fit=crop&q=80'
  ]);

  // Timers
  const [pickupElapsedSeconds, setPickupElapsedSeconds] = useState<number>(0);
  const [destinationRemainingSeconds, setDestinationRemainingSeconds] = useState<number | null>(null);

  // Motorizado Info object
  const motorizadoInfo: MotorizadoInfo = {
    uid: driverUser.uid,
    name: driverUser.fullName || 'Motorizado Zénith',
    phone: driverUser.phone || '987654321',
    plate: driverUser.driverProfile?.vehicle?.plate || 'MOTO-777',
    rating: driverUser.driverProfile?.rating || 5.0
  };

  // Timer 1: Mandatory 5 minutes wait at pickup (Caso 03)
  useEffect(() => {
    if (ride.pickupArrivedAt && ride.transitStatus === TransitStatus.AT_PICKUP) {
      const interval = setInterval(() => {
        const arrivedMs = new Date(ride.pickupArrivedAt!).getTime();
        const elapsed = Math.floor((Date.now() - arrivedMs) / 1000);
        setPickupElapsedSeconds(elapsed);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setPickupElapsedSeconds(0);
    }
  }, [ride.pickupArrivedAt, ride.transitStatus]);

  // Timer 2: Destination wait countdown (5 min included + accepted extra blocks)
  useEffect(() => {
    if (ride.destinationArrivedAt && ride.transitStatus === TransitStatus.AT_DESTINATION && ride.deliveryStatus === DeliveryStatus.PENDING) {
      const interval = setInterval(() => {
        const arrivedMs = new Date(ride.destinationArrivedAt!).getTime();
        const totalMinutes = (ride.includedWaitMinutes || 5) + (ride.additionalWaitBlocksAccepted || 0) * 5;
        const totalMs = totalMinutes * 60 * 1000;
        const elapsed = Date.now() - arrivedMs;
        const remaining = Math.max(0, Math.floor((totalMs - elapsed) / 1000));
        setDestinationRemainingSeconds(remaining);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setDestinationRemainingSeconds(null);
    }
  }, [ride.destinationArrivedAt, ride.transitStatus, ride.deliveryStatus, ride.includedWaitMinutes, ride.additionalWaitBlocksAccepted]);

  // ACTION: Arrive at pickup
  const handleArriveAtPickup = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await OperationalEngine.arriveAtPickup(ride.id, motorizadoInfo, -8.1116, -79.0287);
      if (onRideUpdated) onRideUpdated();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al registrar llegada a recojo.');
    } finally {
      setSubmitting(false);
    }
  };

  // ACTION: Cancel pickup unavailable after 5 minutes (Caso 03)
  const handleCancelPickupUnavailable = async () => {
    if (!ride.pickupArrivedAt) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await OperationalEngine.cancelPickupUnavailable(ride.id, motorizadoInfo, ride.pickupArrivedAt);
      if (!res.success) {
        setErrorMessage(res.message);
      } else {
        setSuccessMessage(res.message);
        if (onRideUpdated) onRideUpdated();
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al cancelar por recojo no disponible.');
    } finally {
      setSubmitting(false);
    }
  };

  // ACTION: Reject mismatched or incomplete order (Caso 04)
  const handleRejectMismatched = async () => {
    const reason = window.prompt('Indique el motivo del rechazo del pedido (diferente o incompleto):', 'Pedido incompleto no coincide con solicitud.');
    if (!reason) return;
    setSubmitting(true);
    try {
      await OperationalEngine.rejectMismatchedOrder(ride.id, motorizadoInfo, reason);
      if (onRideUpdated) onRideUpdated();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al rechazar pedido.');
    } finally {
      setSubmitting(false);
    }
  };

  // ACTION: Reject merchant refusal (Caso 05)
  const handleRejectMerchantRefusal = async () => {
    const reason = window.prompt('Indique el motivo de la negativa del establecimiento:', 'Establecimiento se niega a entregar el pedido.');
    if (!reason) return;
    setSubmitting(true);
    try {
      await OperationalEngine.rejectMerchantRefusal(ride.id, motorizadoInfo, reason);
      if (onRideUpdated) onRideUpdated();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al reportar negativa del establecimiento.');
    } finally {
      setSubmitting(false);
    }
  };

  // ACTION: Acquire Custody & Start Transit
  const handleAcquireCustody = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const pkgInfo = ride.packageInfo || {
        description: 'Paquete Operacional',
        type: ProductType.NON_PERISHABLE,
        initialPhotos: []
      };
      pkgInfo.initialPhotos = initialPhotos;

      await OperationalEngine.acquireCustodyAndStartTransit(
        ride.id,
        motorizadoInfo,
        pkgInfo,
        -8.1116,
        -79.0287
      );
      setSuccessMessage('Custodia asumida exitosamente. Iniciando tránsito hacia destino.');
      if (onRideUpdated) onRideUpdated();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al asumir custodia.');
    } finally {
      setSubmitting(false);
    }
  };

  // ACTION: Arrive at destination
  const handleArriveAtDestination = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await OperationalEngine.arriveAtDestination(ride.id, motorizadoInfo, -8.1218, -79.0187);
      if (onRideUpdated) onRideUpdated();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al registrar llegada a destino.');
    } finally {
      setSubmitting(false);
    }
  };

  // ACTION: 4-Level Communication Protocol Attempts (Sección 5)
  const handleCommAttempt = async (
    channel: CommunicationChannel,
    channelName: string,
    actionType: 'OPEN_CHAT' | 'CALL_ZENITH' | 'WHATSAPP' | 'DIRECT_PHONE'
  ) => {
    const phone = ride.receptor?.phone || '999888777';
    if (actionType === 'WHATSAPP') {
      window.open(`https://wa.me/51${phone}?text=${encodeURIComponent(`Hola ${ride.receptor?.name || 'Cliente'}, soy el motorizado de Zénith con su entrega. Me encuentro en la puerta del destino.`)}`, '_blank');
    } else if (actionType === 'DIRECT_PHONE') {
      window.location.href = `tel:${phone}`;
    }

    try {
      await OperationalEngine.logCommunicationAttempt(
        ride.id,
        motorizadoInfo,
        channel,
        'RECEPTOR',
        'MESSAGE_SENT',
        `Intento de comunicación vía ${channelName}.`
      );
      setSuccessMessage(`Evento registrado: Contacto vía ${channelName}.`);
      if (onRideUpdated) onRideUpdated();
    } catch (err: unknown) {
      console.error(err);
    }
  };

  // ACTION: Request additional 5-min wait block (Sección 8)
  const handleRequestAdditionalWait = async () => {
    setSubmitting(true);
    try {
      await OperationalEngine.requestAdditionalWaitBlock(ride.id, motorizadoInfo);
      setSuccessMessage('Bloque adicional de 5 minutos solicitado al cliente.');
      if (onRideUpdated) onRideUpdated();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al solicitar bloque adicional.');
    } finally {
      setSubmitting(false);
    }
  };

  // ACTION: Verify OTP to confirm delivery (Sección 6)
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enteredOtp.trim()) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await OperationalEngine.verifyDeliveryOtp(
        ride.id,
        enteredOtp,
        motorizadoInfo,
        -8.1218,
        -79.0187
      );
      if (!res.success) {
        setErrorMessage(res.message);
      } else {
        setSuccessMessage('¡Entrega confirmada con éxito! Custodia finalizada.');
        if (onRideUpdated) onRideUpdated();
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al verificar código OTP.');
    } finally {
      setSubmitting(false);
    }
  };

  // ACTION: Finalize as Receptor Unavailable -> Motorizado becomes Custodian (Caso 02)
  const handleFinalizeReceptorUnavailable = async () => {
    const confirmFinalize = window.confirm(
      '¿Desea cerrar el protocolo de espera y pasar a ser CUSTODIO del producto? La carrera se cerrará como Entrega No Realizada.'
    );
    if (!confirmFinalize) return;

    setSubmitting(true);
    setErrorMessage(null);
    try {
      const pType = ride.packageInfo?.type || ProductType.NON_PERISHABLE;
      await OperationalEngine.finalizeReceptorUnavailable(
        ride.id,
        motorizadoInfo,
        pType,
        -8.1218,
        -79.0187
      );
      setSuccessMessage('Operación cerrada como Entrega No Realizada. Usted es ahora CUSTODIO formal del producto.');
      if (onRideUpdated) onRideUpdated();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al finalizar como receptor no disponible.');
    } finally {
      setSubmitting(false);
    }
  };

  // ACTION: Cancel by motorizado with daily cancellation policy (Caso 08)
  const cancellationEval = OperationalEngine.evaluateMotorizadoCancellation(
    driverUser.driverProfile || {
      status: 'APPROVED' as any,
      availability: true,
      rating: 5,
      vehicle: { category: 'MOTO', plate: 'MOTO-777', brand: '', model: '', year: 2023, color: '' },
      documentation: { licenseNumber: '', licenseExpiry: '' },
      appVersion: '1.1.0',
      createdAt: null as any,
      updatedAt: null as any
    }
  );

  const handleConfirmMotorizadoCancel = async () => {
    if (!cancelReason.trim()) {
      setErrorMessage('Debe ingresar el motivo de cancelación.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await OperationalEngine.cancelByMotorizado(
        ride.id,
        motorizadoInfo,
        driverUser,
        cancelReason
      );
      setShowCancelModal(false);
      if (res.suspended) {
        alert(`Atención: Se ha aplicado una suspensión preventiva de ${res.suspensionMinutes} minutos.`);
      }
      if (onRideUpdated) onRideUpdated();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al procesar la cancelación.');
    } finally {
      setSubmitting(false);
    }
  };

  // ACTION: Report mechanical breakdown (Caso 09)
  const handleConfirmBreakdown = async () => {
    if (!breakdownDescription.trim()) return;
    setSubmitting(true);
    try {
      const res = await OperationalEngine.reportMechanicalBreakdown(
        ride.id,
        motorizadoInfo,
        driverUser,
        breakdownDescription
      );
      setShowBreakdownModal(false);
      if (res.isSecondBreakdown) {
        alert('Segunda avería mecánica del día: Para proteger su seguridad y la operación, se ha activado un descanso preventivo de 24 horas.');
      }
      if (onRideUpdated) onRideUpdated();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al reportar avería mecánica.');
    } finally {
      setSubmitting(false);
    }
  };

  // ACTION: Report accident emergency (Caso 09)
  const handleConfirmAccident = async () => {
    setSubmitting(true);
    try {
      await OperationalEngine.reportAccident(
        ride.id,
        motorizadoInfo,
        driverUser,
        accidentDescription || 'Emergencia por accidente en ruta',
        productRecoverable
      );
      setShowAccidentModal(false);
      alert('Protocolo de emergencia activado. Prioridad absoluta: Las personas. Su cuenta queda en revisión de seguridad preventiva.');
      if (onRideUpdated) onRideUpdated();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al reportar accidente.');
    } finally {
      setSubmitting(false);
    }
  };

  // ACTION: Respond to formal destination change proposal (Caso 10)
  const handleRespondDestinationChange = async (accepted: boolean) => {
    setSubmitting(true);
    try {
      const reason = !accepted ? window.prompt('Motivo del rechazo de cambio de destino:', 'Zona considerada de alto riesgo / Desvío excesivo') || '' : '';
      await OperationalEngine.respondDestinationChange(ride.id, motorizadoInfo, accepted, reason);
      if (onRideUpdated) onRideUpdated();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al responder a propuesta de nuevo destino.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" id="zenith_motorizado_cockpit">
      
      {/* COCKPIT HEADER */}
      <div className="bg-[#0c0e10] border border-[#39FF14]/40 rounded-3xl p-6 shadow-2xl text-left space-y-5 relative overflow-hidden">
        
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#39FF14] text-black flex items-center justify-center font-black shadow-glow">
              <Navigation size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black uppercase italic tracking-tight text-white">
                  Cockpit Operacional Motorizado
                </h2>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/30 font-bold">
                  MVP V1.1
                </span>
              </div>
              <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">
                ID: {ride.id?.substring(0, 8)} · TARIFA ACORDADA: <strong className="text-[#39FF14]">S/ {(ride.protectedPrice || 12).toFixed(2)}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowTimeline(true)}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-[#39FF14]/20 border border-white/10 text-xs font-mono font-bold text-gray-300 hover:text-[#39FF14] flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Activity size={14} />
            Trazabilidad
          </button>
        </div>

        {/* FEEDBACK MESSAGES */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-mono">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
            {successMessage}
          </div>
        )}

        {/* 4 OPERATIONAL STATE DIMENSIONS BADGES */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-left">
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 space-y-0.5">
            <span className="text-[8px] font-mono text-gray-500 uppercase font-bold">Solicitud</span>
            <p className="text-xs font-mono font-bold text-white uppercase">{ride.solicitudeStatus || 'ACTIVE'}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 space-y-0.5">
            <span className="text-[8px] font-mono text-gray-500 uppercase font-bold">Traslado</span>
            <p className="text-xs font-mono font-bold text-[#39FF14] uppercase">{ride.transitStatus || 'TO_PICKUP'}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 space-y-0.5">
            <span className="text-[8px] font-mono text-gray-500 uppercase font-bold">Entrega</span>
            <p className="text-xs font-mono font-bold text-white uppercase">{ride.deliveryStatus || 'PENDING'}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 space-y-0.5">
            <span className="text-[8px] font-mono text-gray-500 uppercase font-bold">Custodia</span>
            <p className={`text-xs font-mono font-bold uppercase ${
              ride.custodyStatus === CustodyStatus.IN_TRANSIT_CUSTODY ? 'text-[#39FF14]' :
              ride.custodyStatus === CustodyStatus.ACTIVE_CUSTODY ? 'text-amber-400' : 'text-gray-400'
            }`}>
              {ride.custodyStatus || 'NONE'}
            </p>
          </div>
        </div>

        {/* PRODUCT AND RECEPTOR SPECS */}
        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="space-y-1">
            <span className="text-[9px] text-gray-400 uppercase font-bold">Detalle del Producto</span>
            <p className="text-white font-bold">{ride.packageInfo?.description || 'Paquete Operacional'}</p>
            <p className="text-[10px] text-gray-400">
              Tipo: <strong className={ride.packageInfo?.type === ProductType.PERISHABLE ? 'text-amber-400' : 'text-emerald-400'}>
                {ride.packageInfo?.type === ProductType.PERISHABLE ? 'Perecible (60m ventana)' : 'No Perecible (48h máx)'}
              </strong> · Evidencia: {ride.evidenceLevel || EvidenceLevel.E2_CONFIRMED}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-[9px] text-gray-400 uppercase font-bold">Receptor Designado</span>
            <p className="text-white font-bold">{ride.receptor?.name || 'Receptor'}</p>
            <p className="text-[10px] text-gray-400">
              Destino: {ride.destination.address}
            </p>
          </div>
        </div>

        {/* ================================================================ */}
        {/* FASE 1: DESPLAZAMIENTO HACIA RECOJO Y LLEGADA AL PUNTO DE ORIGEN */}
        {/* ================================================================ */}
        {(ride.transitStatus === TransitStatus.TO_PICKUP || !ride.transitStatus || ride.transitStatus === TransitStatus.IDLE) && (
          <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-black text-white uppercase flex items-center gap-2">
                <MapPin size={16} className="text-[#39FF14]" />
                En ruta hacia punto de recojo
              </span>
              <span className="text-[10px] font-mono text-gray-400">
                {ride.origin.address}
              </span>
            </div>

            <button
              onClick={handleArriveAtPickup}
              disabled={submitting}
              className="w-full py-4 rounded-2xl bg-[#39FF14] hover:bg-[#32e012] text-black font-mono text-sm uppercase font-black tracking-wider shadow-glow cursor-pointer"
            >
              {submitting ? 'Registrando...' : 'Confirmar Llegada a Punto de Recojo'}
            </button>
          </div>
        )}

        {/* ================================================================ */}
        {/* FASE 2: EN PUNTO DE RECOJO (Casos 03, 04, 05 & Adquisición de Custodia) */}
        {/* ================================================================ */}
        {ride.transitStatus === TransitStatus.AT_PICKUP && (
          <div className="p-5 rounded-2xl bg-white/5 border-2 border-[#39FF14]/30 space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-black text-[#39FF14] uppercase flex items-center gap-2">
                <Clock size={16} />
                En Punto de Recojo · Control de Tiempos
              </span>
              <span className="text-xs font-mono font-bold bg-black/60 px-3 py-1 rounded-full text-white border border-white/10">
                Tiempo de Espera: {Math.floor(pickupElapsedSeconds / 60)}:{(pickupElapsedSeconds % 60).toString().padStart(2, '0')} min
              </span>
            </div>

            {/* Caso 03 Notification: Wait 5 min before free cancel */}
            <div className="p-3 bg-black/40 rounded-xl border border-white/5 text-[11px] font-mono text-gray-300">
              Regla Caso 03: Espera obligatoria de <strong>5 minutos</strong> si el pedido no está listo. Transcurridos los 5 minutos podrá cancelar sin penalidad.
            </div>

            {/* Botón Principal: Recoger y Asumir Custodia */}
            <div className="space-y-2">
              <div className="p-3 bg-white/5 rounded-xl flex items-center justify-between text-xs font-mono">
                <span className="text-gray-300 flex items-center gap-2">
                  <Camera size={16} className="text-[#39FF14]" />
                  Evidencia Inicial de Custodia (Foto)
                </span>
                <span className="text-[10px] text-[#39FF14] font-bold">1 Foto Verificada</span>
              </div>

              <button
                onClick={handleAcquireCustody}
                disabled={submitting}
                className="w-full py-4 rounded-2xl bg-[#39FF14] hover:bg-[#32e012] text-black font-mono text-sm uppercase font-black tracking-wider shadow-glow cursor-pointer"
              >
                {submitting ? 'Asumiendo custodia...' : 'Recoger Producto y Asumir Custodia'}
              </button>
            </div>

            {/* Botones de Rechazo y Cancelación por Casos 03, 04, 05 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-white/10">
              <button
                onClick={handleCancelPickupUnavailable}
                disabled={pickupElapsedSeconds < 300 || submitting}
                className="py-2.5 px-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-mono uppercase font-bold border border-red-500/20 disabled:opacity-40 cursor-pointer"
                title={pickupElapsedSeconds < 300 ? 'Disponible tras 5 minutos de espera' : ''}
              >
                {pickupElapsedSeconds < 300 ? `Espera (${300 - pickupElapsedSeconds}s)` : 'Cancelar Recojo No Disponible (Sin Penalidad)'}
              </button>

              <button
                onClick={handleRejectMismatched}
                disabled={submitting}
                className="py-2.5 px-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-[10px] font-mono uppercase font-bold border border-amber-500/20 cursor-pointer"
              >
                Rechazar Pedido Incorrecto/Incompleto (Caso 04)
              </button>

              <button
                onClick={handleRejectMerchantRefusal}
                disabled={submitting}
                className="py-2.5 px-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-[10px] font-mono uppercase font-bold border border-white/10 cursor-pointer"
              >
                Rechazar Negativa de Establecimiento (Caso 05)
              </button>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* FASE 3: EN TRÁNSITO HACIA DESTINO (Custodia Activa de Traslado) */}
        {/* ================================================================ */}
        {ride.transitStatus === TransitStatus.IN_TRANSIT && (
          <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-black text-[#39FF14] uppercase flex items-center gap-2">
                <Navigation size={16} />
                En Tránsito hacia Destino (Custodia Asumida)
              </span>
              <span className="text-[10px] font-mono text-gray-400">
                {ride.destination.address}
              </span>
            </div>

            {/* CASO 10: ALERTA DE PROPUESTA FORMAL DE CAMBIO DE DESTINO */}
            {ride.destinationChangeRequest?.status === 'PENDING_MOTORIZADO' && (
              <div className="p-4 rounded-2xl bg-blue-500/20 border-2 border-blue-500/50 space-y-3">
                <div className="flex items-center gap-2 text-blue-300 font-mono font-bold text-xs uppercase">
                  <Compass size={16} />
                  <span>Propuesta Formal de Modificación de Destino</span>
                </div>
                <div className="text-[11px] font-mono text-gray-300 space-y-1">
                  <p>Nuevo destino: <strong className="text-white">{ride.destinationChangeRequest.newAddress}</strong></p>
                  <p>Nueva tarifa calculada: <strong className="text-[#39FF14]">S/ {ride.destinationChangeRequest.newPrice.toFixed(2)}</strong></p>
                  <p className="text-[10px] text-gray-400">
                    Regla Caso 10: Puede aceptar la nueva condición económica o rechazar si la considera sospechosa o riesgosa.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRespondDestinationChange(false)}
                    className="flex-1 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-mono uppercase font-bold"
                  >
                    Rechazar Propuesta
                  </button>
                  <button
                    onClick={() => handleRespondDestinationChange(true)}
                    className="flex-1 py-2 rounded-xl bg-[#39FF14] hover:bg-[#32e012] text-black text-xs font-mono uppercase font-black"
                  >
                    Aceptar Nuevo Destino
                  </button>
                </div>
              </div>
            )}

            {/* Botón Principal: Llegada a Destino */}
            <button
              onClick={handleArriveAtDestination}
              disabled={submitting}
              className="w-full py-4 rounded-2xl bg-[#39FF14] hover:bg-[#32e012] text-black font-mono text-sm uppercase font-black tracking-wider shadow-glow cursor-pointer"
            >
              {submitting ? 'Registrando...' : 'Confirmar Llegada a Destino de Entrega'}
            </button>

            {/* Botones de Incidencia en Ruta (Caso 09) */}
            <div className="flex gap-2 pt-2 border-t border-white/10">
              <button
                onClick={() => setShowBreakdownModal(true)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-amber-400 text-xs font-mono uppercase font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Wrench size={14} />
                Reportar Avería Mecánica
              </button>
              <button
                onClick={() => setShowAccidentModal(true)}
                className="flex-1 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-mono uppercase font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <AlertOctagon size={14} />
                Emergencia Accidente
              </button>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* FASE 4: EN DESTINO (Espera 5m, Protocolo 4 Niveles & OTP de Entrega) */}
        {/* ================================================================ */}
        {ride.transitStatus === TransitStatus.AT_DESTINATION && ride.deliveryStatus === DeliveryStatus.PENDING && (
          <div className="p-5 rounded-2xl bg-white/5 border-2 border-[#39FF14]/40 space-y-5">
            
            {/* Countdown Banner */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-white uppercase">
                <Clock size={16} className="text-[#39FF14]" />
                <span>Protocolo de Espera en Destino</span>
              </div>
              {destinationRemainingSeconds !== null && (
                <span className={`text-xs font-mono font-black px-3 py-1 rounded-full border ${
                  destinationRemainingSeconds > 60 ? 'bg-[#39FF14]/15 border-[#39FF14]/30 text-[#39FF14]' : 'bg-red-500/20 border-red-500 text-red-400 animate-pulse'
                }`}>
                  {Math.floor(destinationRemainingSeconds / 60)}:{(destinationRemainingSeconds % 60).toString().padStart(2, '0')} min restantes
                </span>
              )}
            </div>

            {/* PROTOCOLO DE COMUNICACIÓN EN 4 NIVELES (Sección 5) */}
            <div className="space-y-2">
              <span className="text-[9px] font-mono text-gray-400 uppercase font-bold block">
                Protocolo Obligatorio de Contacto (Orden Congelado):
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => handleCommAttempt(CommunicationChannel.LEVEL_1_CHAT, 'Chat Interno', 'OPEN_CHAT')}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-[#39FF14]/20 border border-white/10 text-left cursor-pointer"
                >
                  <span className="text-[8px] font-mono text-gray-500 uppercase block font-bold">Nivel 1</span>
                  <span className="text-xs font-mono font-bold text-white flex items-center gap-1">
                    <MessageSquare size={12} className="text-[#39FF14]" /> Chat Zénith
                  </span>
                </button>

                <button
                  onClick={() => handleCommAttempt(CommunicationChannel.LEVEL_2_ZENITH_CALL, 'Llamada Zénith', 'CALL_ZENITH')}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-[#39FF14]/20 border border-white/10 text-left cursor-pointer"
                >
                  <span className="text-[8px] font-mono text-gray-500 uppercase block font-bold">Nivel 2</span>
                  <span className="text-xs font-mono font-bold text-white flex items-center gap-1">
                    <Phone size={12} className="text-[#39FF14]" /> Llamada Zénith
                  </span>
                </button>

                <button
                  onClick={() => handleCommAttempt(CommunicationChannel.LEVEL_3_WHATSAPP, 'WhatsApp', 'WHATSAPP')}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-emerald-500/20 border border-white/10 text-left cursor-pointer"
                >
                  <span className="text-[8px] font-mono text-gray-500 uppercase block font-bold">Nivel 3</span>
                  <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1">
                    <MessageSquare size={12} /> WhatsApp
                  </span>
                </button>

                <button
                  onClick={() => handleCommAttempt(CommunicationChannel.LEVEL_4_DIRECT_CALL, 'Llamada Directa', 'DIRECT_PHONE')}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-blue-500/20 border border-white/10 text-left cursor-pointer"
                >
                  <span className="text-[8px] font-mono text-gray-500 uppercase block font-bold">Nivel 4</span>
                  <span className="text-xs font-mono font-bold text-blue-400 flex items-center gap-1">
                    <Phone size={12} /> Llamada GSM
                  </span>
                </button>
              </div>
            </div>

            {/* CONFIRMACIÓN CON OTP DE ENTREGA (Sección 6) */}
            <form onSubmit={handleVerifyOtp} className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-3">
              <span className="text-[10px] font-mono text-gray-400 uppercase font-bold tracking-widest block">
                VALIDACIÓN DE ENTREGA MEDIANTE OTP
              </span>

              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={6}
                  value={enteredOtp}
                  onChange={(e) => setEnteredOtp(e.target.value)}
                  placeholder="Ingrese OTP del receptor..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center text-lg font-mono font-black text-[#39FF14] tracking-widest focus:outline-none"
                  required
                />
                <button
                  type="submit"
                  disabled={submitting || !enteredOtp.trim()}
                  className="px-6 py-3 rounded-xl bg-[#39FF14] hover:bg-[#32e012] text-black font-mono text-xs font-black uppercase tracking-wider shadow-glow cursor-pointer disabled:opacity-50"
                >
                  Confirmar
                </button>
              </div>
            </form>

            {/* BOTONES DE RESOLUCIÓN ALTERNATIVA (Sección 8 y Caso 02) */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={handleRequestAdditionalWait}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-mono text-xs uppercase font-bold border border-white/10 cursor-pointer"
              >
                Solicitar 5 Minutos Adicionales
              </button>

              <button
                type="button"
                onClick={handleFinalizeReceptorUnavailable}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 font-mono text-xs uppercase font-black border border-amber-500/30 cursor-pointer"
              >
                Receptor Ausente · Pasar a Custodio (Caso 02)
              </button>
            </div>

          </div>
        )}

        {/* CANCEL BUTTON FOR MOTORIZADO (Caso 08) */}
        {ride.deliveryStatus === DeliveryStatus.PENDING && (
          <div className="pt-2 border-t border-white/5 flex justify-end">
            <button
              onClick={() => setShowCancelModal(true)}
              className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-mono text-xs uppercase font-bold cursor-pointer"
            >
              Cancelar Operación
            </button>
          </div>
        )}

      </div>

      {/* MODAL CANCELACIÓN DEL MOTORIZADO (Caso 08) */}
      <AnimatePresence>
        {showCancelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0c0d0e] border border-red-500/40 p-6 rounded-3xl max-w-md w-full space-y-4 text-left shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-sm font-mono font-black uppercase text-red-400 flex items-center gap-2">
                  <AlertTriangle size={16} />
                  Advertencia de Cancelación Zénith
                </h3>
                <button onClick={() => setShowCancelModal(false)} className="text-gray-400 hover:text-white">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3 text-xs font-mono">
                <div className="p-3 bg-white/5 rounded-2xl space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Cancelaciones hoy:</span>
                    <span className="text-white font-bold">{cancellationEval.nextCount - 1} / 3 permitidas</span>
                  </div>
                  <div className="flex justify-between text-amber-400 font-bold border-t border-white/5 pt-1">
                    <span>Consecuencia:</span>
                    <span>{cancellationEval.warningMessage}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-gray-400 uppercase font-bold">Motivo Obligatorio:</span>
                  <input
                    type="text"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Ej: Inconveniente de fuerza mayor..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 text-gray-400 text-xs font-mono font-bold"
                >
                  Volver
                </button>
                <button
                  type="button"
                  onClick={handleConfirmMotorizadoCancel}
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-mono font-black uppercase"
                >
                  {submitting ? 'Cancelando...' : 'Confirmar Cancelación'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL AVERÍA MECÁNICA (Caso 09) */}
      <AnimatePresence>
        {showBreakdownModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0c0d0e] border border-amber-500/40 p-6 rounded-3xl max-w-md w-full space-y-4 text-left shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-sm font-mono font-black uppercase text-amber-400 flex items-center gap-2">
                  <Wrench size={16} />
                  Reporte de Incidencia Mecánica
                </h3>
                <button onClick={() => setShowBreakdownModal(false)} className="text-gray-400 hover:text-white">
                  <X size={16} />
                </button>
              </div>

              <p className="text-[11px] text-gray-300 font-mono">
                Regla Caso 09: La avería no genera penalidad automática. El producto permanece bajo su custodia hasta realizar una entrega formal. Una segunda avería en el mismo día activará 24 horas de descanso preventivo.
              </p>

              <textarea
                value={breakdownDescription}
                onChange={(e) => setBreakdownDescription(e.target.value)}
                placeholder="Describa la avería mecánica sufrida..."
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none h-20"
                required
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowBreakdownModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 text-gray-400 text-xs font-mono font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBreakdown}
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-amber-400 text-black text-xs font-mono font-black uppercase"
                >
                  {submitting ? 'Enviando...' : 'Reportar Avería'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL ACCIDENTE (Caso 09) */}
      <AnimatePresence>
        {showAccidentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0c0d0e] border border-red-500 p-6 rounded-3xl max-w-md w-full space-y-4 text-left shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-sm font-mono font-black uppercase text-red-500 flex items-center gap-2">
                  <AlertOctagon size={16} />
                  Protocolo de Emergencia por Accidente
                </h3>
                <button onClick={() => setShowAccidentModal(false)} className="text-gray-400 hover:text-white">
                  <X size={16} />
                </button>
              </div>

              <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-[11px] font-mono text-red-200">
                <strong>PRIORIDAD ABSOLUTA: LA VIDA E INTEGRIDAD DE LAS PERSONAS.</strong> No se aplicará penalidad por no poder completar la operación.
              </div>

              <div className="space-y-3 text-xs font-mono">
                <textarea
                  value={accidentDescription}
                  onChange={(e) => setAccidentDescription(e.target.value)}
                  placeholder="Detalles de la emergencia..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none h-20"
                />

                <label className="flex items-center gap-2 cursor-pointer text-gray-300">
                  <input
                    type="checkbox"
                    checked={productRecoverable}
                    onChange={(e) => setProductRecoverable(e.target.checked)}
                    className="accent-[#39FF14]"
                  />
                  <span>El producto físico se encuentra RECUPERABLE para transferencia formal a otro motorizado.</span>
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAccidentModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 text-gray-400 text-xs font-mono font-bold"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAccident}
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-mono font-black uppercase shadow-glow-red"
                >
                  {submitting ? 'Activando...' : 'Activar Emergencia'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE AUDITORÍA OPERACIONAL */}
      {showTimeline && (
        <ZenithOperationTimeline
          operationId={ride.id}
          onClose={() => setShowTimeline(false)}
        />
      )}

    </div>
  );
}
