import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, DollarSign, Clock, Check, X, ShieldCheck } from 'lucide-react';
import { Ride } from '../../types';
import { Assignment } from '../../services/AssignmentRepository';
import { DispatchEngine } from '../../services/DispatchEngine';
import { AssignmentRepository } from '../../services/AssignmentRepository';

interface RideAssignmentCardProps {
  assignment: Assignment;
  ride: Ride;
  onProcessed: () => void;
}

export default function RideAssignmentCard({ assignment, ride, onProcessed }: RideAssignmentCardProps) {
  const [timeLeft, setTimeLeft] = useState(15);
  const [processing, setProcessing] = useState(false);

  // Temporizador visual estricto de 15 segundos
  useEffect(() => {
    // Calcular segundos restantes basados en expiresAt para precisión absoluta sincronizada
    const expiresAt = new Date(assignment.expiresAt).getTime();
    
    const updateTimer = () => {
      const now = new Date().getTime();
      const diff = Math.max(0, Math.round((expiresAt - now) / 1000));
      setTimeLeft(diff);

      if (diff <= 0) {
        clearInterval(interval);
        handleTimeout();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [assignment]);

  const handleTimeout = async () => {
    if (processing) return;
    setProcessing(true);
    try {
      await DispatchEngine.handleAssignmentTimeoutOrReject(assignment.assignmentId, 'EXPIRE');
      onProcessed();
    } catch (err) {
      console.error('Error al expirar asignación:', err);
    } finally {
      setProcessing(false);
    }
  };

  const handleAccept = async () => {
    if (processing) return;
    setProcessing(true);
    try {
      await AssignmentRepository.acceptAssignment(assignment.assignmentId);
      onProcessed();
    } catch (err) {
      console.error('Error al aceptar asignación:', err);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (processing) return;
    setProcessing(true);
    try {
      await DispatchEngine.handleAssignmentTimeoutOrReject(assignment.assignmentId, 'REJECT');
      onProcessed();
    } catch (err) {
      console.error('Error al rechazar asignación:', err);
    } finally {
      setProcessing(false);
    }
  };

  // Calcular porcentaje restante para el círculo o barra de progreso
  const progressPercent = (timeLeft / 15) * 100;

  return (
    <div 
      className="bg-black border border-[#39FF14]/30 rounded-3xl p-6 text-left space-y-6 shadow-glow relative overflow-hidden max-w-md mx-auto" 
      id={`ride_assignment_card_${assignment.assignmentId}`}
    >
      {/* Decorative neon top line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-[#39FF14] animate-pulse"></div>

      {/* Header Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[#39FF14] font-mono text-[10px] font-black uppercase tracking-wider">
          <ShieldCheck size={14} /> Oferta de Viaje Zenith
        </div>
        <div className="text-[10px] font-mono text-gray-500">
          INTENTO #{assignment.attemptNumber}
        </div>
      </div>

      {/* Visual Timer Countdown */}
      <div className="flex items-center gap-4 bg-white/5 border border-white/5 rounded-2xl p-4">
        <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
          {/* Circular Countdown Progress */}
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="28"
              cy="28"
              r="24"
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth="4"
              fill="transparent"
            />
            <circle
              cx="28"
              cy="28"
              r="24"
              stroke="#39FF14"
              strokeWidth="4"
              fill="transparent"
              strokeDasharray={150.7}
              strokeDashoffset={150.7 - (150.7 * progressPercent) / 100}
              className="transition-all duration-1000 ease-linear"
            />
          </svg>
          <span className="absolute text-sm font-black font-mono text-white">{timeLeft}s</span>
        </div>
        
        <div className="space-y-0.5 text-left">
          <p className="text-xs font-bold text-white uppercase">Decisión Requerida</p>
          <p className="text-[9px] font-mono text-gray-500 uppercase leading-tight">
            El sistema reasignará automáticamente al expirar el tiempo de respuesta.
          </p>
        </div>
      </div>

      {/* Fixed protected pricing badge */}
      <div className="bg-[#39FF14]/5 border border-[#39FF14]/20 rounded-2xl p-5 flex items-center justify-between">
        <div>
          <p className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">Tarifa Protegida Unificada</p>
          <p className="text-3xl font-black text-[#39FF14] tracking-tight font-mono">S/ {ride.protectedPrice?.toFixed(2)}</p>
        </div>
        <div className="text-right">
          <span className="px-2 py-0.5 text-[8px] font-mono bg-[#39FF14] text-black rounded font-black tracking-widest uppercase">
            SECURE-PRICE
          </span>
          <p className="text-[8px] font-mono text-gray-500 uppercase mt-1 leading-none">Sello: {ride.pricingSeal?.substring(0, 8)}</p>
        </div>
      </div>

      {/* Trajectory Locations */}
      <div className="space-y-4">
        {/* Origin */}
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
            <MapPin size={12} />
          </div>
          <div className="space-y-0.5 text-left">
            <p className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">Punto de Recojo (Origen)</p>
            <p className="text-xs text-white/95 font-bold uppercase truncate max-w-[280px]">
              {ride.origin.address}
            </p>
          </div>
        </div>

        {/* Destination */}
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0 mt-0.5">
            <Navigation size={12} className="rotate-45" />
          </div>
          <div className="space-y-0.5 text-left">
            <p className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">Destino Final</p>
            <p className="text-xs text-white/95 font-bold uppercase truncate max-w-[280px]">
              {ride.destination.address}
            </p>
          </div>
        </div>
      </div>

      {/* Route estimation metadata */}
      <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4 text-[10px] font-mono text-gray-500 uppercase">
        <div>
          <span>Distancia Ruta:</span>
          <p className="text-white font-bold">{ride.distance ? `${ride.distance.toFixed(1)} Km` : 'N/D'}</p>
        </div>
        <div className="border-l border-white/5 pl-4">
          <span>Tiempo Estimado:</span>
          <p className="text-white font-bold">{ride.duration ? `${Math.round(ride.duration)} Min` : 'N/D'}</p>
        </div>
      </div>

      {/* Action Decision Buttons */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <button
          onClick={handleReject}
          disabled={processing || timeLeft <= 0}
          className="py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 font-mono text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5"
        >
          <X size={14} /> Rechazar
        </button>

        <button
          onClick={handleAccept}
          disabled={processing || timeLeft <= 0}
          className="py-3 bg-[#39FF14] hover:bg-[#32e311] active:scale-95 text-black font-mono text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-glow"
        >
          <Check size={14} /> Aceptar Oferta
        </button>
      </div>
    </div>
  );
}
