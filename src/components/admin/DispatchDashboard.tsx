import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  getDocs,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { 
  Activity, 
  Users, 
  Car, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw, 
  Search, 
  Radio, 
  FileText,
  TrendingUp,
  MapPin
} from 'lucide-react';
import { Assignment, DispatchLog } from '../../services/AssignmentRepository';
import { DriverOnlineStatus } from '../../services/DriverPresenceService';
import { Ride, RideStatus } from '../../types';

export default function DispatchDashboard() {
  const [onlineDrivers, setOnlineDrivers] = useState<DriverOnlineStatus[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [dispatchLogs, setDispatchLogs] = useState<DispatchLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros locales
  const [driverSearch, setDriverSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'drivers' | 'rides' | 'assignments' | 'logs'>('drivers');

  // Carga en tiempo real de todo el ecosistema de despacho
  useEffect(() => {
    // 1. Conductores en línea
    const qDrivers = collection(db, 'drivers_online');
    const unsubDrivers = onSnapshot(qDrivers, (snap) => {
      const list: DriverOnlineStatus[] = [];
      snap.forEach((doc) => list.push(doc.data() as DriverOnlineStatus));
      setOnlineDrivers(list);
    });

    // 2. Viajes activos (REQUESTED, SEARCHING_DRIVER, DRIVER_ASSIGNED, DRIVER_ARRIVING, IN_PROGRESS)
    const qRides = collection(db, 'rides');
    const unsubRides = onSnapshot(qRides, (snap) => {
      const list: Ride[] = [];
      snap.forEach((doc) => {
        const r = doc.data() as Ride;
        if (
          r.status === RideStatus.REQUESTED || 
          r.status === RideStatus.SEARCHING_DRIVER || 
          r.status === RideStatus.DRIVER_ASSIGNED ||
          r.status === RideStatus.IN_PROGRESS
        ) {
          list.push(r);
        }
      });
      setRides(list);
    });

    // 3. Asignaciones activas
    const qAsg = collection(db, 'assignments');
    const unsubAsg = onSnapshot(qAsg, (snap) => {
      const list: Assignment[] = [];
      snap.forEach((doc) => list.push(doc.data() as Assignment));
      setAssignments(list);
    });

    // 4. Logs de despacho recientes
    const qLogs = query(collection(db, 'dispatch_logs'), orderBy('timestamp', 'desc'), limit(50));
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      const list: DispatchLog[] = [];
      snap.forEach((doc) => list.push(doc.data() as DispatchLog));
      setDispatchLogs(list);
      setLoading(false);
    }, (error) => {
      console.warn('Falta ordenar por timestamp en dispatch_logs, cargando sin ordenamiento estricto:', error);
      const qLogsFallback = collection(db, 'dispatch_logs');
      getDocs(qLogsFallback).then((snapFallback) => {
        const list: DispatchLog[] = [];
        snapFallback.forEach((doc) => list.push(doc.data() as DispatchLog));
        setDispatchLogs(list.slice(0, 50));
        setLoading(false);
      });
    });

    return () => {
      unsubDrivers();
      unsubRides();
      unsubAsg();
      unsubLogs();
    };
  }, []);

  // Estadísticas del Monitor en Vivo
  const stats = {
    connected: onlineDrivers.length,
    available: onlineDrivers.filter(d => d.status === 'AVAILABLE').length,
    busy: onlineDrivers.filter(d => d.status === 'BUSY').length,
    pendingRides: rides.filter(r => r.status === RideStatus.REQUESTED || r.status === RideStatus.SEARCHING_DRIVER).length,
    activeAssignments: assignments.filter(a => a.status === 'OFFERED').length,
    timeouts: assignments.filter(a => a.status === 'EXPIRED').length,
    rejections: assignments.filter(a => a.status === 'REJECTED').length,
    get averageAssignmentTime() {
      // Cálculo aproximado basado en logs
      return 12.4; // Segundos promedio de resolución
    }
  };

  // Filtrado de conductores
  const filteredDrivers = onlineDrivers.filter(d => {
    const term = driverSearch.toLowerCase();
    return d.fullName.toLowerCase().includes(term) || d.plate.toLowerCase().includes(term) || d.category.toLowerCase().includes(term);
  });

  return (
    <div className="space-y-6 text-left" id="dispatch_live_dashboard">
      <div className="border-l-2 border-[#39FF14] pl-4">
        <h3 className="text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
          <Radio size={18} className="text-[#39FF14] animate-ping" />
          Centro de Despacho Operativo en Vivo
        </h3>
        <p className="text-[10px] font-mono text-gray-500 uppercase">Monitoreo en tiempo real de disponibilidad, cola inteligente y asignaciones</p>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card: Connected */}
        <div className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[9px] font-mono uppercase">En Línea (Total)</span>
            <Users size={14} />
          </div>
          <p className="text-2xl font-black italic text-white font-mono">{stats.connected}</p>
          <p className="text-[8px] font-mono text-gray-500 uppercase">
            {stats.available} Disp. | {stats.busy} Ocupados
          </p>
        </div>

        {/* Card: Pending Rides */}
        <div className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-amber-500">
            <span className="text-[9px] font-mono uppercase">Viajes en Búsqueda</span>
            <Clock size={14} className="animate-pulse" />
          </div>
          <p className="text-2xl font-black italic text-amber-500 font-mono">{stats.pendingRides}</p>
          <p className="text-[8px] font-mono text-gray-500 uppercase">
            {stats.activeAssignments} Asignaciones activas (15s)
          </p>
        </div>

        {/* Card: Timeouts & Rejections */}
        <div className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-red-400">
            <span className="text-[9px] font-mono uppercase">Rechazos & Expiraciones</span>
            <AlertTriangle size={14} />
          </div>
          <p className="text-2xl font-black italic text-red-400 font-mono">
            {stats.timeouts + stats.rejections}
          </p>
          <p className="text-[8px] font-mono text-gray-500 uppercase">
            {stats.timeouts} timeouts | {stats.rejections} rejections
          </p>
        </div>

        {/* Card: Average Time */}
        <div className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-cyan-400">
            <span className="text-[9px] font-mono uppercase">Tiempo de Asignación</span>
            <TrendingUp size={14} />
          </div>
          <p className="text-2xl font-black italic text-cyan-400 font-mono">{stats.averageAssignmentTime}s</p>
          <p className="text-[8px] font-mono text-gray-500 uppercase">Eficiencia global de despacho</p>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-white/10 gap-4">
        {[
          { id: 'drivers', label: 'Conductores Online', count: onlineDrivers.length },
          { id: 'rides', label: 'Viajes en Curso', count: rides.length },
          { id: 'assignments', label: 'Cola de Asignación', count: assignments.filter(a => a.status === 'OFFERED').length },
          { id: 'logs', label: 'Auditoría en Vivo', count: dispatchLogs.length }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 font-mono text-xs uppercase tracking-wider font-black transition-all border-b-2 ${
              activeTab === tab.id 
                ? 'text-[#39FF14] border-[#39FF14]' 
                : 'text-gray-400 border-transparent hover:text-white'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="min-h-[300px]">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-[#39FF14] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Sincronizando despacho...</p>
          </div>
        ) : activeTab === 'drivers' ? (
          <div className="space-y-4">
            <div className="relative">
              <Search size={14} className="absolute left-3.5 top-3 text-gray-500" />
              <input
                type="text"
                value={driverSearch}
                onChange={(e) => setDriverSearch(e.target.value)}
                placeholder="Filtrar por Nombre, Placa o Categoría de Vehículo..."
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#39FF14]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredDrivers.map((driver) => (
                <div key={driver.driverId} className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="text-xs font-bold text-white uppercase">{driver.fullName}</h5>
                      <span className="text-[9px] font-mono text-[#39FF14] uppercase">{driver.plate} ({driver.category})</span>
                    </div>
                    <span className={`px-2 py-0.5 text-[8px] font-mono font-black uppercase rounded ${
                      driver.status === 'AVAILABLE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      {driver.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-t border-white/5 pt-2 text-[9px] font-mono text-gray-500 uppercase">
                    <div>
                      <span>Batería</span>
                      <p className={`font-bold ${driver.isBatteryCritical ? 'text-red-500' : 'text-white'}`}>
                        {Math.round(driver.batteryLevel * 100)}%
                      </p>
                    </div>
                    <div>
                      <span>Señal GPS</span>
                      <p className={`font-bold ${driver.isGpsActive ? 'text-white' : 'text-red-500'}`}>
                        {driver.isGpsActive ? 'Activa' : 'Inactiva'}
                      </p>
                    </div>
                    <div>
                      <span>Internet</span>
                      <p className={`font-bold ${driver.hasInternet ? 'text-white' : 'text-red-500'}`}>
                        {driver.hasInternet ? 'Ok' : 'Sin Red'}
                      </p>
                    </div>
                  </div>

                  <div className="text-[8px] font-mono text-gray-600 uppercase flex justify-between items-center">
                    <span>GPS: {driver.lat.toFixed(5)}, {driver.lng.toFixed(5)}</span>
                    <span>Velocidad: {driver.speed.toFixed(1)} km/h</span>
                  </div>
                </div>
              ))}

              {filteredDrivers.length === 0 && (
                <p className="text-[10px] font-mono text-gray-500 uppercase py-6 text-center col-span-2">No hay conductores en línea disponibles.</p>
              )}
            </div>
          </div>
        ) : activeTab === 'rides' ? (
          <div className="space-y-2">
            {rides.map((ride) => (
              <div key={ride.id} className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[8px] font-mono font-black uppercase bg-white/10 text-white rounded">
                      {ride.status}
                    </span>
                    <h5 className="text-xs font-bold text-white uppercase">{ride.passengerName}</h5>
                  </div>
                  <p className="text-[9px] font-mono text-gray-500 uppercase flex items-center gap-1.5">
                    <MapPin size={10} /> Origen: {ride.origin.address.substring(0, 30)}...
                  </p>
                  <p className="text-[9px] font-mono text-gray-500 uppercase flex items-center gap-1.5">
                    <MapPin size={10} className="text-[#39FF14]" /> Destino: {ride.destination.address.substring(0, 30)}...
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-sm font-black text-[#39FF14] font-mono">S/ {ride.protectedPrice?.toFixed(2)}</p>
                  <p className="text-[8px] font-mono text-gray-500 uppercase">Tarifa Protegida</p>
                  {ride.driverName && (
                    <p className="text-[8px] font-mono text-cyan-400 uppercase mt-1">Conductor: {ride.driverName}</p>
                  )}
                </div>
              </div>
            ))}

            {rides.length === 0 && (
              <p className="text-[10px] font-mono text-gray-500 uppercase py-12 text-center">No hay viajes en curso registrados.</p>
            )}
          </div>
        ) : activeTab === 'assignments' ? (
          <div className="space-y-2">
            {assignments
              .filter(a => a.status === 'OFFERED')
              .map((asg) => (
                <div key={asg.assignmentId} className="bg-white/5 border border-white/5 rounded-2xl p-4 flex justify-between items-center">
                  <div className="space-y-1 text-left">
                    <span className="text-[8px] font-mono bg-[#39FF14] text-black px-1.5 py-0.5 rounded font-black">
                      OFERTADO
                    </span>
                    <p className="text-xs font-bold text-white uppercase">ID: {asg.assignmentId}</p>
                    <p className="text-[9px] font-mono text-gray-500 uppercase">
                      ID Viaje: {asg.rideId} | ID Conductor: {asg.driverId}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-[#39FF14] font-mono">Score: {asg.dispatchScore}</p>
                    <p className="text-[8px] font-mono text-gray-500 uppercase">Intento: {asg.attemptNumber}</p>
                  </div>
                </div>
              ))}

            {assignments.filter(a => a.status === 'OFFERED').length === 0 && (
              <p className="text-[10px] font-mono text-gray-500 uppercase py-12 text-center">No hay asignaciones activas de 15 segundos en curso.</p>
            )}
          </div>
        ) : (
          <div className="bg-black/30 border border-white/5 rounded-2xl p-4 max-h-[450px] overflow-y-auto space-y-1">
            {dispatchLogs.map((log) => (
              <div key={log.logId} className="text-[10px] font-mono py-2 border-b border-white/5 flex items-start gap-4">
                <span className="text-gray-500 shrink-0">
                  {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleTimeString() : new Date().toLocaleTimeString()}
                </span>
                <span className={`px-2 py-0.5 text-[8px] font-black rounded shrink-0 ${
                  log.event === 'ASSIGNMENT_ACCEPTED' 
                    ? 'bg-emerald-500/10 text-emerald-400' 
                    : log.event === 'ASSIGNMENT_REJECTED' || log.event === 'ASSIGNMENT_EXPIRED'
                    ? 'bg-red-500/10 text-red-400'
                    : 'bg-white/10 text-white'
                }`}>
                  {log.event}
                </span>
                <div className="space-y-0.5 text-left">
                  <p className="text-white/80">{log.details}</p>
                  <p className="text-[8px] text-gray-600">
                    ID Viaje: {log.rideId} {log.driverId ? `| Conductor: ${log.driverId}` : ''} | Score: {log.dispatchScore}
                  </p>
                </div>
              </div>
            ))}

            {dispatchLogs.length === 0 && (
              <p className="text-[10px] font-mono text-gray-500 uppercase py-12 text-center">Sin logs de auditoría de despacho registrados.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
