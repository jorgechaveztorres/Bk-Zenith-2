import React, { useState, useEffect } from 'react';
import { 
  Ride, 
  User, 
  SolicitudeStatus, 
  TransitStatus, 
  DeliveryStatus, 
  CustodyStatus, 
  ProductType,
  EvidenceLevel,
  Location 
} from '../../types';
import { OperationalEngine } from '../../services/OperationalEngine';
import { 
  Package, 
  MapPin, 
  Clock, 
  ShieldCheck, 
  Key, 
  AlertTriangle, 
  CheckCircle, 
  User as UserIcon, 
  Phone, 
  Compass, 
  RotateCcw, 
  History,
  Check,
  X,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ZenithOperationTimeline from './ZenithOperationTimeline';

interface ZenithActiveOperationHUDProps {
  ride: Ride;
  user: User;
  onRefresh?: () => void;
}

export default function ZenithActiveOperationHUD({
  ride,
  user,
  onRefresh
}: ZenithActiveOperationHUDProps) {
  const [showTimeline, setShowTimeline] = useState(false);
  const [showChangeDestinationModal, setShowChangeDestinationModal] = useState(false);
  const [newDestinationAddress, setNewDestinationAddress] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Recovery Order State (Pedido 2)
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);

  // Wait time countdown at destination
  const [remainingWaitSeconds, setRemainingWaitSeconds] = useState<number | null>(null);

  // Custody expiration countdown
  const [remainingCustodyMinutes, setRemainingCustodyMinutes] = useState<number | null>(null);

  // Timer for included wait at destination (5 minutes)
  useEffect(() => {
    if (ride.destinationArrivedAt && ride.transitStatus === TransitStatus.AT_DESTINATION && ride.deliveryStatus === DeliveryStatus.PENDING) {
      const interval = setInterval(() => {
        const arrivedMs = new Date(ride.destinationArrivedAt!).getTime();
        const totalWaitMinutes = (ride.includedWaitMinutes || 5) + (ride.additionalWaitBlocksAccepted || 0) * 5;
        const totalWaitMs = totalWaitMinutes * 60 * 1000;
        const elapsedMs = Date.now() - arrivedMs;
        const diffSeconds = Math.max(0, Math.floor((totalWaitMs - elapsedMs) / 1000));
        setRemainingWaitSeconds(diffSeconds);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setRemainingWaitSeconds(null);
    }
  }, [ride.destinationArrivedAt, ride.transitStatus, ride.deliveryStatus, ride.includedWaitMinutes, ride.additionalWaitBlocksAccepted]);

  // Timer for custody expiration (60 min perishable / 48h non-perishable)
  useEffect(() => {
    if (ride.custodyStatus === CustodyStatus.ACTIVE_CUSTODY && ride.custodyExpiresAt) {
      const interval = setInterval(() => {
        const expiresMs = new Date(ride.custodyExpiresAt!).getTime();
        const diffMinutes = Math.max(0, Math.floor((expiresMs - Date.now()) / (1000 * 60)));
        setRemainingCustodyMinutes(diffMinutes);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setRemainingCustodyMinutes(null);
    }
  }, [ride.custodyStatus, ride.custodyExpiresAt]);

  // Estimate distance traveled by motorizado toward pickup for cancellation penalty preview
  const estimatedKmToPickup = ride.driverStartDistanceToPickup || 1.2;
  let penaltyPercentPreview = 0;
  if (estimatedKmToPickup < 1.0) penaltyPercentPreview = 0;
  else if (estimatedKmToPickup < 2.0) penaltyPercentPreview = 15;
  else penaltyPercentPreview = 30;

  const penaltyAmountPreview = Number((((ride.protectedPrice || 10) * penaltyPercentPreview) / 100).toFixed(2));

  // Handle client accepting additional 5-min wait block requested by driver
  const handleAcceptWaitBlock = async () => {
    setSubmittingAction(true);
    try {
      await OperationalEngine.acceptAdditionalWaitBlock(ride.id, user, 3.00);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setSubmittingAction(false);
    }
  };

  // Handle User Cancellation with distance penalty
  const handleConfirmCancelByUser = async () => {
    setSubmittingAction(true);
    setActionError(null);
    try {
      await OperationalEngine.cancelByUserWithDistancePenalty(ride.id, user, estimatedKmToPickup);
      setShowCancelModal(false);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Error al procesar la cancelación.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Handle Creating Recovery Pedido 2
  const handleCreateRecoveryPedido2 = async () => {
    setSubmittingAction(true);
    setActionError(null);
    try {
      if (!ride.solicitante || !ride.pagador || !ride.receptor) {
        throw new Error('Información incompleta de protagonistas para emitir Pedido 2.');
      }
      const newOrderId = await OperationalEngine.createRecoveryOrder(
        ride.id,
        ride.solicitante,
        ride.pagador,
        ride.receptor,
        ride.protectedPrice || 12.0
      );
      setShowRecoveryModal(false);
      if (onRefresh) onRefresh();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Error al solicitar Pedido 2 de recuperación.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Handle Formal Destination Change Request (Caso 10)
  const handleRequestDestinationChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDestinationAddress.trim()) return;
    setSubmittingAction(true);
    setActionError(null);
    try {
      // Recalculate price: base + additional S/ 4.00 for change
      const newDist = (ride.distance || 3) + 1.5;
      const newFare = Number(((ride.protectedPrice || 12) + 4.0).toFixed(2));

      await OperationalEngine.requestDestinationChange(
        ride.id,
        'SOLICITANTE',
        newDestinationAddress,
        -8.125, // Mock coordinates
        -79.020,
        newDist,
        newFare,
        ride.distance || 3,
        ride.protectedPrice || 12
      );
      setShowChangeDestinationModal(false);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Error al enviar solicitud formal de cambio.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const isPerishable = ride.packageInfo?.type === ProductType.PERISHABLE;

  return (
    <div className="space-y-4" id="zenith_active_operation_hud">
      {/* CARD PRINCIPAL DE OPERACIÓN ACTIVA */}
      <div className="bg-[#0e1012] border border-[#39FF14]/30 rounded-3xl p-6 shadow-2xl text-left space-y-6 relative overflow-hidden">
        
        {/* Top Operational Status Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#39FF14]/10 border border-[#39FF14]/30 flex items-center justify-center text-[#39FF14]">
              <Package size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-black text-white uppercase">
                  Operación {ride.id?.substring(0, 8)}
                </span>
                {ride.isRecoveryOrder && (
                  <span className="text-[9px] font-mono font-black px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    PEDIDO 2 · RECUPERACIÓN
                  </span>
                )}
              </div>
              <p className="text-[10px] font-mono text-[#39FF14] uppercase font-bold tracking-widest">
                {ride.packageInfo?.description || 'Paquete Operacional'} · {isPerishable ? 'Perecible (60m)' : 'No Perecible (48h)'}
              </p>
            </div>
          </div>

          {/* Evidence Level Badge */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300 font-bold uppercase">
              Evidencia: <strong className="text-[#39FF14]">{ride.evidenceLevel || EvidenceLevel.E2_CONFIRMED}</strong>
            </span>
            <button
              onClick={() => setShowTimeline(true)}
              className="p-2 rounded-xl bg-white/5 hover:bg-[#39FF14]/15 text-gray-400 hover:text-[#39FF14] transition-all cursor-pointer"
              title="Ver Bitácora de Eventos"
            >
              <History size={16} />
            </button>
          </div>
        </div>

        {/* 4 OPERATIONAL STATE DIMENSIONS DISPLAY */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-white/5 border border-white/5 rounded-2xl p-3 space-y-0.5">
            <span className="text-[8px] font-mono text-gray-500 uppercase font-bold">1. Solicitud</span>
            <p className="text-xs font-mono font-bold text-white uppercase">
              {ride.solicitudeStatus || SolicitudeStatus.ACTIVE}
            </p>
          </div>

          <div className="bg-white/5 border border-white/5 rounded-2xl p-3 space-y-0.5">
            <span className="text-[8px] font-mono text-gray-500 uppercase font-bold">2. Traslado</span>
            <p className={`text-xs font-mono font-bold uppercase ${
              ride.transitStatus === TransitStatus.AT_DESTINATION ? 'text-[#39FF14]' : 'text-blue-400'
            }`}>
              {ride.transitStatus || TransitStatus.TO_PICKUP}
            </p>
          </div>

          <div className="bg-white/5 border border-white/5 rounded-2xl p-3 space-y-0.5">
            <span className="text-[8px] font-mono text-gray-500 uppercase font-bold">3. Entrega</span>
            <p className={`text-xs font-mono font-bold uppercase ${
              ride.deliveryStatus === DeliveryStatus.DELIVERED_OTP ? 'text-[#39FF14]' :
              ride.deliveryStatus === DeliveryStatus.DELIVERY_FAILED ? 'text-red-400' : 'text-amber-400'
            }`}>
              {ride.deliveryStatus || DeliveryStatus.PENDING}
            </p>
          </div>

          <div className="bg-white/5 border border-white/5 rounded-2xl p-3 space-y-0.5">
            <span className="text-[8px] font-mono text-gray-500 uppercase font-bold">4. Custodia</span>
            <p className={`text-xs font-mono font-bold uppercase ${
              ride.custodyStatus === CustodyStatus.ACTIVE_CUSTODY ? 'text-amber-400 animate-pulse' :
              ride.custodyStatus === CustodyStatus.IN_TRANSIT_CUSTODY ? 'text-emerald-400' : 'text-gray-400'
            }`}>
              {ride.custodyStatus || CustodyStatus.NONE}
            </p>
          </div>
        </div>

        {/* MOTORIZADO ASIGNADO */}
        {ride.motorizado || ride.driverName ? (
          <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#39FF14]/15 border border-[#39FF14]/30 flex items-center justify-center text-[#39FF14]">
                <UserIcon size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-white uppercase">
                  {ride.motorizado?.name || ride.driverName}
                </p>
                <p className="text-[10px] font-mono text-gray-400 uppercase">
                  Placa: <strong className="text-white">{ride.motorizado?.plate || 'MOTO-PRO'}</strong> · Calificación: 5.0★
                </p>
              </div>
            </div>
            {ride.motorizado?.phone && (
              <a
                href={`tel:${ride.motorizado.phone}`}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-[#39FF14]/20 text-white hover:text-[#39FF14] text-xs font-mono font-bold flex items-center gap-1.5 transition-all"
              >
                <Phone size={12} />
                Llamar
              </a>
            )}
          </div>
        ) : (
          <div className="p-3.5 bg-white/5 border border-dashed border-white/10 rounded-2xl flex items-center gap-3 text-gray-400 text-xs font-mono">
            <div className="w-3 h-3 rounded-full bg-[#39FF14] animate-ping" />
            <span>Despacho inteligente buscando motorizado certificado...</span>
          </div>
        )}

        {/* CRITICAL DESTINATION ARRIVAL & RECEPTOR OTP DISPLAY (Sección 6) */}
        {ride.transitStatus === TransitStatus.AT_DESTINATION && ride.deliveryStatus === DeliveryStatus.PENDING && (
          <div className="p-5 rounded-2xl bg-[#39FF14]/10 border-2 border-[#39FF14]/40 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#39FF14] font-black text-xs uppercase font-mono">
                <ShieldCheck size={18} />
                <span>Motorizado en Destino · Protocolo de Entrega</span>
              </div>
              {remainingWaitSeconds !== null && (
                <span className="text-xs font-mono font-bold text-white bg-black/60 px-2.5 py-1 rounded-full border border-white/10">
                  Espera: {Math.floor(remainingWaitSeconds / 60)}:{(remainingWaitSeconds % 60).toString().padStart(2, '0')}
                </span>
              )}
            </div>

            <div className="bg-black/60 p-4 rounded-xl border border-white/10 text-center space-y-2">
              <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest block font-bold">
                CÓDIGO OTP EXCLUSIVO DE ENTREGA
              </span>
              <p className="text-4xl font-mono font-black text-[#39FF14] tracking-widest">
                {ride.deliveryOtp || '8492'}
              </p>
              <p className="text-[10px] text-gray-300 font-mono">
                El receptor debe proporcionar este código de un solo uso al motorizado para validar y liberar la custodia del producto.
              </p>
            </div>

            {/* Additional wait block approval if requested by motorizado */}
            {(ride.additionalWaitBlocksRequested || 0) > (ride.additionalWaitBlocksAccepted || 0) && (
              <div className="p-3.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-mono space-y-2">
                <div className="flex items-center gap-2 font-bold uppercase">
                  <Clock size={16} />
                  <span>El motorizado solicita 5 minutos adicionales de espera</span>
                </div>
                <p className="text-[11px] text-gray-300">
                  Costo adicional estipulado: S/ 3.00. Si no se aprueba, la entrega terminará como "No realizada" y el motorizado pasará a ser custodio.
                </p>
                <button
                  onClick={handleAcceptWaitBlock}
                  disabled={submittingAction}
                  className="w-full py-2.5 rounded-xl bg-[#39FF14] text-black font-black uppercase text-xs font-mono hover:bg-[#32e012] cursor-pointer"
                >
                  {submittingAction ? 'Procesando...' : 'Aceptar 5 Minutos Adicionales (+S/ 3.00)'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* CASO 02: RECEPTOR NO DISPONIBLE & CUSTODIA ACTIVA -> RECUPERACIÓN PEDIDO 2 (Sección 11) */}
        {ride.custodyStatus === CustodyStatus.ACTIVE_CUSTODY && (
          <div className="p-5 rounded-2xl bg-amber-500/15 border-2 border-amber-500/40 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400 font-black text-xs uppercase font-mono">
                <AlertTriangle size={18} />
                <span>Producto en Custodia del Motorizado</span>
              </div>
              {remainingCustodyMinutes !== null && (
                <span className="text-xs font-mono font-bold text-amber-300 bg-black/60 px-2.5 py-1 rounded-full">
                  Expira en: {Math.floor(remainingCustodyMinutes / 60)}h {remainingCustodyMinutes % 60}m
                </span>
              )}
            </div>

            <p className="text-xs text-gray-300">
              La entrega original finalizó como <strong>Entrega No Realizada</strong>. El motorizado custodia el producto en las mismas condiciones. Puede solicitar una nueva operación para recuperar y entregar el paquete.
            </p>

            <button
              onClick={() => setShowRecoveryModal(true)}
              className="w-full py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-black font-mono text-xs uppercase font-black tracking-wider flex items-center justify-center gap-2 shadow-glow cursor-pointer"
            >
              <RotateCcw size={16} />
              Solicitar Recuperación — Pedido 2
            </button>
          </div>
        )}

        {/* CASO 10: SOLICITUD DE CAMBIO FORMAL DE DESTINO PENDIENTE */}
        {ride.destinationChangeRequest?.status === 'PENDING_MOTORIZADO' && (
          <div className="p-4 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-mono space-y-1">
            <span className="font-bold uppercase flex items-center gap-1.5">
              <Compass size={14} />
              Propuesta de Cambio de Destino en Revisión
            </span>
            <p className="text-[11px] text-gray-300">
              Nuevo destino propuesto: "{ride.destinationChangeRequest.newAddress}". Tarifa calculada: S/ {ride.destinationChangeRequest.newPrice.toFixed(2)}. El motorizado está evaluando la nueva condición del servicio.
            </p>
          </div>
        )}

        {/* BOTONES SECUNDARIOS: CAMBIO DE DESTINO Y CANCELACIÓN CON PENALIDAD */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
          {ride.transitStatus === TransitStatus.IN_TRANSIT && !ride.destinationChangeRequest && (
            <button
              onClick={() => setShowChangeDestinationModal(true)}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-mono text-xs uppercase font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Compass size={14} />
              Solicitar Nuevo Destino
            </button>
          )}

          {ride.deliveryStatus === DeliveryStatus.PENDING && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-mono text-xs uppercase font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <X size={14} />
              Cancelar Operación
            </button>
          )}
        </div>

      </div>

      {/* MODAL DE CAMBIO FORMAL DE DESTINO (Caso 10) */}
      <AnimatePresence>
        {showChangeDestinationModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0c0d0e] border border-white/15 p-6 rounded-3xl max-w-md w-full space-y-4 text-left shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-sm font-mono font-black uppercase text-white flex items-center gap-2">
                  <Compass size={16} className="text-[#39FF14]" />
                  Modificación Formal de Destino
                </h3>
                <button onClick={() => setShowChangeDestinationModal(false)} className="text-gray-400 hover:text-white">
                  <X size={16} />
                </button>
              </div>

              <p className="text-[11px] text-gray-300 font-mono">
                Regla Caso 10: El destino original es inmutable de forma informal. El sistema recalcula la tarifa y la propuesta debe ser aceptada formalmente por el motorizado.
              </p>

              <form onSubmit={handleRequestDestinationChange} className="space-y-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 space-y-1">
                  <span className="text-[9px] font-mono text-gray-500 uppercase font-bold">Nuevo Destino</span>
                  <input
                    type="text"
                    value={newDestinationAddress}
                    onChange={(e) => setNewDestinationAddress(e.target.value)}
                    placeholder="Ej: Av. América Sur 1200, Trujillo"
                    className="w-full bg-transparent text-xs text-white focus:outline-none"
                    required
                  />
                </div>

                <div className="p-3 bg-white/5 rounded-xl text-[10px] font-mono text-gray-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Tarifa Actual:</span>
                    <span className="text-white font-bold">S/ {(ride.protectedPrice || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[#39FF14]">
                    <span>Nueva Tarifa Estimada:</span>
                    <span className="font-bold">S/ {((ride.protectedPrice || 0) + 4.0).toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowChangeDestinationModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-white/5 text-gray-400 text-xs font-mono font-bold"
                  >
                    Cerrar
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAction}
                    className="flex-1 py-2.5 rounded-xl bg-[#39FF14] text-black text-xs font-mono font-black uppercase shadow-glow"
                  >
                    {submittingAction ? 'Enviando...' : 'Aceptar y Proponer'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE CANCELACIÓN CON PENALIDAD POR DISTANCIA (Casos 06 & 07) */}
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
                  Confirmar Cancelación de Operación
                </h3>
                <button onClick={() => setShowCancelModal(false)} className="text-gray-400 hover:text-white">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3 text-xs font-mono">
                <p className="text-gray-300">
                  Regla de Cancelación Zénith: Al cancelar tras el desplazamiento del motorizado hacia el recojo, aplica la escala congelada de penalidad:
                </p>

                <div className="p-3 bg-white/5 rounded-2xl border border-white/5 space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Desplazamiento Verificado:</span>
                    <span className="text-white font-bold">{estimatedKmToPickup.toFixed(1)} km</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Escala Aplicable:</span>
                    <span className="text-amber-400 font-bold">{penaltyPercentPreview}% de la solicitud</span>
                  </div>
                  <div className="flex justify-between border-t border-white/5 pt-1 text-red-400 font-bold">
                    <span>Importe / Deuda a Imputar:</span>
                    <span>S/ {penaltyAmountPreview.toFixed(2)}</span>
                  </div>
                </div>

                <p className="text-[10px] text-gray-400">
                  El importe de la penalidad se acreditará en el saldo Zénith del motorizado afectado y quedará registrado como deuda pendiente en su cuenta hasta su cancelación.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 text-gray-400 text-xs font-mono font-bold"
                >
                  Volver al Viaje
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCancelByUser}
                  disabled={submittingAction}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-mono font-black uppercase shadow-glow-red"
                >
                  {submittingAction ? 'Cancelando...' : 'Confirmar Cancelación'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE RECUPERACIÓN — PEDIDO 2 (Secciones 11 y 12) */}
      <AnimatePresence>
        {showRecoveryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0c0d0e] border border-amber-500/40 p-6 rounded-3xl max-w-md w-full space-y-4 text-left shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-sm font-mono font-black uppercase text-amber-400 flex items-center gap-2">
                  <RotateCcw size={16} />
                  Emitir Recuperación — Pedido 2
                </h3>
                <button onClick={() => setShowRecoveryModal(false)} className="text-gray-400 hover:text-white">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3 text-xs font-mono text-gray-300">
                <p>
                  Regla de Recuperación: El Pedido 2 es una <strong>operación nueva e independiente</strong> que asigna automáticamente con <strong>Prioridad 1</strong> al custodio que tiene el producto físicamente en su poder.
                </p>

                <div className="p-3 bg-white/5 rounded-2xl border border-white/5 space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Custodio Asignado:</span>
                    <span className="text-white font-bold">{ride.motorizado?.name || ride.driverName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Producto:</span>
                    <span className="text-white font-bold">{ride.packageInfo?.description}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Receptor:</span>
                    <span className="text-white font-bold">{ride.receptor?.name}</span>
                  </div>
                  <div className="flex justify-between text-amber-400 font-bold border-t border-white/5 pt-1">
                    <span>Nueva Tarifa:</span>
                    <span>S/ {(ride.protectedPrice || 12).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRecoveryModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 text-gray-400 text-xs font-mono font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreateRecoveryPedido2}
                  disabled={submittingAction}
                  className="flex-1 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-mono font-black uppercase shadow-glow"
                >
                  {submittingAction ? 'Creando...' : 'Confirmar Pedido 2'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE BITÁCORA DE AUDITORÍA OPERACIONAL */}
      {showTimeline && (
        <ZenithOperationTimeline
          operationId={ride.id}
          onClose={() => setShowTimeline(false)}
        />
      )}

    </div>
  );
}
