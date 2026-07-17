// ============================================================================
// ZÉNITH
// Module : Tracking / Driver Active Trip HUD
// Layer  : Presentation / UI Component
// File   : DriverActiveTripHUD.tsx
// ============================================================================

import React from 'react';
import { Ride } from '../../types';
import { Shield, Compass, Activity, Battery, Wifi, AlertTriangle } from 'lucide-react';

interface DriverActiveTripHUDProps {
  ride: Ride;
}

export default function DriverActiveTripHUD({ ride }: DriverActiveTripHUDProps) {
  const stats = (ride as any).trackingStats;
  const gps = (ride as any).gpsState;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-left" id="driver_active_trip_hud">
      {/* Velocity Cockpit */}
      <div className="bg-black/40 border border-white/5 p-4 rounded-2xl flex flex-col justify-between">
        <p className="text-[8px] font-mono text-gray-500 uppercase tracking-wider">Velocímetro Digital</p>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-2xl font-black text-[#39FF14] font-mono">
            {stats?.currentSpeedKmh !== undefined ? stats.currentSpeedKmh.toFixed(0) : '0'}
          </span>
          <span className="text-[10px] font-mono text-[#39FF14] uppercase font-bold">KM/H</span>
        </div>
        <p className="text-[8px] font-mono text-gray-400 mt-2">
          Vel. Promedio: {stats?.avgSpeedKmh?.toFixed(1) || '0.0'} km/h
        </p>
      </div>

      {/* Distance Traveled */}
      <div className="bg-black/40 border border-white/5 p-4 rounded-2xl flex flex-col justify-between">
        <p className="text-[8px] font-mono text-gray-500 uppercase tracking-wider">Odómetro de Tránsito</p>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-2xl font-black text-white font-mono">
            {stats?.distanceMeters !== undefined ? (stats.distanceMeters / 1000).toFixed(2) : '0.00'}
          </span>
          <span className="text-[10px] font-mono text-gray-400 uppercase font-bold">KM</span>
        </div>
        <p className="text-[8px] font-mono text-gray-400 mt-2">
          Tiempo Transcurrido: {stats?.elapsedSeconds !== undefined ? `${Math.floor(stats.elapsedSeconds / 60)}m ${stats.elapsedSeconds % 60}s` : '0s'}
        </p>
      </div>

      {/* Battery Diagnostic */}
      <div className="bg-black/40 border border-white/5 p-4 rounded-2xl flex flex-col justify-between">
        <p className="text-[8px] font-mono text-gray-500 uppercase tracking-wider">Terminal Batería</p>
        <div className="flex items-baseline gap-1 mt-1">
          <span className={`text-2xl font-black font-mono ${gps?.batteryLevel < 15 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
            {gps?.batteryLevel !== undefined ? gps.batteryLevel : '85'}%
          </span>
        </div>
        <p className="text-[8px] font-mono text-gray-400 mt-2 flex items-center gap-1">
          <Battery size={10} className={gps?.batteryLevel < 15 ? 'text-red-500' : 'text-emerald-400'} />
          Estado: {gps?.batteryLevel < 15 ? 'Crítico (Recargar)' : 'Saludable'}
        </p>
      </div>

      {/* GPS Integrity */}
      <div className="bg-black/40 border border-white/5 p-4 rounded-2xl flex flex-col justify-between">
        <p className="text-[8px] font-mono text-gray-500 uppercase tracking-wider">Estado de Red y GPS</p>
        <div className="mt-1 space-y-0.5">
          <div className="flex items-center gap-1.5 text-[9px] font-mono">
            <div className={`w-1.5 h-1.5 rounded-full ${gps?.signalLoss ? 'bg-red-500 animate-ping' : 'bg-[#39FF14]'}`} />
            <span className={gps?.signalLoss ? 'text-red-400 font-bold' : 'text-gray-300'}>
              Señal: {gps?.signalLoss ? 'Degradada' : 'Excelente'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] font-mono">
            <div className={`w-1.5 h-1.5 rounded-full ${gps?.frozen ? 'bg-red-500' : 'bg-[#39FF14]'}`} />
            <span className={gps?.frozen ? 'text-red-400 font-bold' : 'text-gray-300'}>
              Sensor: {gps?.frozen ? 'GPS Congelado' : 'Nominal'}
            </span>
          </div>
        </div>
        <p className="text-[8px] font-mono text-gray-400 mt-1 flex items-center gap-1">
          <Wifi size={10} className="text-[#39FF14]" /> Precisión: {gps?.precision !== undefined ? gps.precision.toFixed(1) : '5.0'}m
        </p>
      </div>
    </div>
  );
}
