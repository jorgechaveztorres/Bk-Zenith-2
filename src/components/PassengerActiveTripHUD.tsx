// ============================================================================
// ZÉNITH
// Module : Tracking / Passenger Active Trip HUD
// Layer  : Presentation / UI Component
// File   : PassengerActiveTripHUD.tsx
// ============================================================================

import React from 'react';
import { Ride, RideStatus } from '../types';
import { Clock, Shield, AlertTriangle, Zap, CheckCircle2, Compass, Activity, MapPin, KeyRound } from 'lucide-react';
import { generateRideOtp } from '../utils/otpHelper';

interface PassengerActiveTripHUDProps {
  ride: Ride;
}

// Haversine distance helper
function computeDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3;
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function PassengerActiveTripHUD({ ride }: PassengerActiveTripHUDProps) {
  const stats = (ride as any).trackingStats;
  const gps = (ride as any).gpsState;
  const deviation = (ride as any).routeDeviation;

  // Compute transit progression
  const totalDistance = computeDistance(ride.origin.lat, ride.origin.lng, ride.destination.lat, ride.destination.lng);
  const remainingDistance = stats?.distanceMeters !== undefined 
    ? stats.distanceMeters 
    : ride.driverLocation 
      ? computeDistance(ride.driverLocation.lat, ride.driverLocation.lng, ride.destination.lat, ride.destination.lng)
      : totalDistance;

  const progressPercent = totalDistance > 0 
    ? Math.max(0, Math.min(100, Math.round(((totalDistance - remainingDistance) / totalDistance) * 100)))
    : 0;

  const isHalfway = progressPercent >= 50 && ride.status === RideStatus.IN_PROGRESS;
  const isNearDestination = remainingDistance <= 300 && ride.status === RideStatus.IN_PROGRESS;

  // Build the 10 tactical timeline steps
  const steps = [
    {
      id: 'searching',
      label: 'Buscando conductor',
      active: ride.status === RideStatus.SEARCHING_DRIVER || ride.status === RideStatus.REQUESTED,
      completed: ride.status !== RideStatus.SEARCHING_DRIVER && ride.status !== RideStatus.REQUESTED
    },
    {
      id: 'assigned',
      label: 'Conductor asignado',
      active: false, // Transition state
      completed: !!ride.driverId
    },
    {
      id: 'accepted',
      label: 'Conductor aceptó',
      active: ride.status === RideStatus.DRIVER_ASSIGNED,
      completed: ride.status !== RideStatus.SEARCHING_DRIVER && ride.status !== RideStatus.REQUESTED && ride.status !== RideStatus.DRIVER_ASSIGNED
    },
    {
      id: 'arriving',
      label: 'Conductor en camino',
      active: ride.status === RideStatus.DRIVER_ARRIVING,
      completed: ride.status === RideStatus.WAITING_FOR_OTP || ride.status === RideStatus.IN_PROGRESS || ride.status === RideStatus.COMPLETED
    },
    {
      id: 'arrived',
      label: 'Conductor llegó',
      active: ride.status === RideStatus.WAITING_FOR_OTP,
      completed: ride.status === RideStatus.IN_PROGRESS || ride.status === RideStatus.COMPLETED
    },
    {
      id: 'otp',
      label: 'Esperando OTP',
      active: ride.status === RideStatus.WAITING_FOR_OTP,
      completed: ride.status === RideStatus.IN_PROGRESS || ride.status === RideStatus.COMPLETED
    },
    {
      id: 'in_progress',
      label: 'Viaje iniciado',
      active: ride.status === RideStatus.IN_PROGRESS && !isHalfway && !isNearDestination,
      completed: isHalfway || isNearDestination || ride.status === RideStatus.COMPLETED
    },
    {
      id: 'halfway',
      label: 'Mitad de recorrido',
      active: isHalfway && !isNearDestination,
      completed: isNearDestination || ride.status === RideStatus.COMPLETED
    },
    {
      id: 'near',
      label: 'Destino próximo (<300m)',
      active: isNearDestination,
      completed: ride.status === RideStatus.COMPLETED
    },
    {
      id: 'completed',
      label: 'Viaje finalizado',
      active: ride.status === RideStatus.COMPLETED,
      completed: ride.status === RideStatus.COMPLETED
    }
  ];

  return (
    <div className="space-y-4" id="passenger_active_trip_hud">
      {/* 1. Real-time Telemetry Dashboard Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Estimated Arrival / Remaining Minutes */}
        <div className="hud-card p-4 border-white/5 bg-black/40 relative overflow-hidden flex flex-col justify-between">
          <p className="text-[8px] font-mono text-gray-500 uppercase tracking-wider">Tiempo Estimado</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black italic text-white font-mono">
              {stats?.etaMinutes !== undefined ? stats.etaMinutes : '---'}
            </span>
            <span className="text-[10px] font-mono text-gray-400 uppercase font-bold">MIN</span>
          </div>
          <p className="text-[8px] font-mono text-gray-500 uppercase tracking-widest mt-2 flex items-center gap-1">
            <Clock size={10} className="text-[#39FF14]" /> En ruta activa
          </p>
        </div>

        {/* Distance Remaining */}
        <div className="hud-card p-4 border-white/5 bg-black/40 relative overflow-hidden flex flex-col justify-between">
          <p className="text-[8px] font-mono text-gray-500 uppercase tracking-wider">Distancia Restante</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black italic text-white font-mono">
              {remainingDistance !== undefined ? (remainingDistance / 1000).toFixed(2) : '---'}
            </span>
            <span className="text-[10px] font-mono text-gray-400 uppercase font-bold">KM</span>
          </div>
          <p className="text-[8px] font-mono text-gray-400 uppercase tracking-widest mt-2 flex items-center gap-1 font-semibold">
            Progreso: {progressPercent}%
          </p>
        </div>

        {/* Velocity Indicator */}
        <div className="hud-card p-4 border-white/5 bg-black/40 relative overflow-hidden flex flex-col justify-between">
          <p className="text-[8px] font-mono text-gray-500 uppercase tracking-wider">Velocidad Actual</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black italic text-[#39FF14] font-mono animate-pulse">
              {stats?.currentSpeedKmh !== undefined ? stats.currentSpeedKmh.toFixed(0) : '0'}
            </span>
            <span className="text-[10px] font-mono text-[#39FF14] uppercase font-bold">KM/H</span>
          </div>
          <p className="text-[8px] font-mono text-gray-500 uppercase tracking-widest mt-2 flex items-center gap-1">
            Promedio: {stats?.avgSpeedKmh?.toFixed(1) || '0.0'} km/h
          </p>
        </div>

        {/* System & GPS Security Monitor */}
        <div className="hud-card p-4 border-white/5 bg-black/40 relative overflow-hidden flex flex-col justify-between">
          <p className="text-[8px] font-mono text-gray-500 uppercase tracking-wider">Estado del Sensor</p>
          <div className="mt-1 flex flex-col gap-0.5">
            {/* GPS Health */}
            <div className="flex items-center gap-1.5 text-[9px] font-mono">
              <div className={`w-1.5 h-1.5 rounded-full ${gps?.signalLoss ? 'bg-red-500 animate-ping' : 'bg-[#39FF14]'}`} />
              <span className={gps?.signalLoss ? 'text-red-400 font-bold' : 'text-gray-300'}>
                GPS: {gps?.signalLoss ? 'PERDIDO' : 'ESTABLE'}
              </span>
            </div>

            {/* Trajectory Deviation Status */}
            <div className="flex items-center gap-1.5 text-[9px] font-mono">
              <div className={`w-1.5 h-1.5 rounded-full ${
                deviation?.level === 'CRITICAL' ? 'bg-red-500 animate-ping' : deviation?.level === 'MEDIUM' ? 'bg-amber-400' : 'bg-[#39FF14]'
              }`} />
              <span className={deviation?.level === 'CRITICAL' ? 'text-red-400 font-bold' : deviation?.level === 'MEDIUM' ? 'text-amber-400 font-bold' : 'text-gray-300'}>
                RUTA: {deviation?.level || 'ESTABLE'}
              </span>
            </div>
          </div>
          
          {deviation?.level === 'CRITICAL' && (
            <div className="absolute inset-0 bg-red-950/25 border border-red-500/40 rounded-xl flex items-center justify-center backdrop-blur-[1px] p-2">
              <div className="flex items-center gap-1 text-red-400 font-mono text-[8px] font-bold uppercase tracking-wider">
                <AlertTriangle size={12} className="text-red-500 animate-bounce" /> Desvío Crítico
              </div>
            </div>
          )}
        </div>
      </div>

      {/* OTP Boarding Code Display (only shown when driver is arriving or waiting for OTP) */}
      {(ride.status === RideStatus.DRIVER_ARRIVING || ride.status === RideStatus.WAITING_FOR_OTP) && (
        <div className="bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[#39FF14]">
              <KeyRound size={16} />
              <span className="text-[10px] font-mono uppercase font-black tracking-wider">Código de Abordaje Seguro</span>
            </div>
            <h5 className="text-sm font-black text-white uppercase italic">Validación Obligatoria</h5>
            <p className="text-[11px] text-gray-400 leading-relaxed max-w-md">
              Proporcione este código de seguridad de 3 dígitos al operador para validar su identidad de pasajero antes de iniciar el trayecto.
            </p>
          </div>
          <div className="bg-black/80 border border-white/10 px-8 py-4 rounded-2xl flex flex-col items-center justify-center shadow-2xl shrink-0">
            <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest mb-1">CÓDIGO OTP</span>
            <span className="text-3xl font-black text-[#39FF14] tracking-[0.2em] font-mono pl-[0.2em]">
              {generateRideOtp(ride.id)}
            </span>
          </div>
        </div>
      )}

      {/* 2. Tactical Timeline Progress Bar */}
      <div className="hud-card p-5 border-white/5 bg-neutral-950/60 space-y-4">
        <h4 className="text-[9px] font-mono text-gray-500 uppercase tracking-widest font-bold flex items-center gap-1.5 border-b border-white/5 pb-2">
          <Activity size={12} className="text-[#39FF14]" /> Línea de Tiempo de Operaciones Seguras
        </h4>

        {/* Desktop/Tablet Horizontal Stepper, Adaptive Vertical list below */}
        <div className="relative pt-2 pb-1 hidden md:block">
          {/* Timeline Connector Line */}
          <div className="absolute top-[18px] left-3 right-3 h-[2px] bg-neutral-800 -z-10"></div>
          {/* Highlighted path of completed steps */}
          <div 
            className="absolute top-[18px] left-3 h-[2px] bg-[#39FF14] -z-10 transition-all duration-500"
            style={{ 
              width: `${Math.max(0, Math.min(100, (steps.filter(s => s.completed).length / (steps.length - 1)) * 100))}%` 
            }}
          ></div>

          <div className="flex justify-between items-start">
            {steps.map((step, idx) => (
              <div key={step.id} className="flex flex-col items-center text-center w-1/10 relative">
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all duration-300 relative bg-neutral-950 ${
                  step.active 
                    ? 'border-[#39FF14] text-[#39FF14] ring-2 ring-[#39FF14]/30' 
                    : step.completed 
                    ? 'border-[#39FF14] bg-[#39FF14] text-black' 
                    : 'border-neutral-800 text-neutral-600'
                }`}>
                  {step.completed ? (
                    <CheckCircle2 size={12} className="stroke-[3]" />
                  ) : (
                    <span className="text-[8px] font-bold">{idx + 1}</span>
                  )}
                </div>
                <span className={`text-[7px] font-mono uppercase tracking-tight mt-1.5 max-w-[70px] leading-tight ${
                  step.active 
                    ? 'text-[#39FF14] font-black' 
                    : step.completed 
                    ? 'text-gray-300' 
                    : 'text-neutral-600'
                }`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile Vertical List of active checkpoints */}
        <div className="md:hidden space-y-2">
          {steps.map((step, idx) => {
            if (!step.active && !step.completed && idx > steps.findIndex(s => s.active)) return null;
            return (
              <div 
                key={step.id} 
                className={`flex items-center gap-2.5 p-2 rounded-xl border font-mono text-[9px] uppercase transition-all duration-300 ${
                  step.active 
                    ? 'border-[#39FF14]/30 bg-[#39FF14]/5 text-[#39FF14] font-bold' 
                    : 'border-white/5 bg-transparent text-gray-500'
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] ${
                  step.completed ? 'bg-[#39FF14] text-black' : 'border border-gray-600 text-gray-400'
                }`}>
                  {step.completed ? '✓' : idx + 1}
                </div>
                <span>{step.label}</span>
                {step.active && <span className="ml-auto text-[7px] bg-[#39FF14]/20 px-1.5 py-0.5 rounded animate-pulse">ACTIVO</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
