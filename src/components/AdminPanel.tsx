import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  getDocs, 
  doc, 
  updateDoc, 
  onSnapshot, 
  limit, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { User, Ride, UserRole, RideStatus } from '../types';
import { Users, ShieldAlert, Star, DollarSign, Activity, Search, Ban, CheckCircle, RefreshCw, Filter, Layers, PieChart, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TelemetryService } from '../services/TelemetryService';

export default function AdminPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'passenger' | 'driver'>('all');
  const [blockFilter, setBlockFilter] = useState<'all' | 'active' | 'blocked'>('all');

  // Load Admin Data
  const loadAdminData = async () => {
    setLoading(true);
    try {
      // Load users
      const usersSnap = await getDocs(collection(db, 'users'));
      const usersList = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as User));
      setUsers(usersList);

      // Load recent rides
      const ridesSnap = await getDocs(query(collection(db, 'rides'), orderBy('createdAt', 'desc'), limit(50)));
      const ridesList = ridesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Ride));
      setRides(ridesList);
    } catch (e) {
      console.error('[ZENITH-ADMIN-ERROR] Failed to load data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  // Block or unblock a user
  const handleToggleBlockUser = async (uid: string, currentBlocked: boolean) => {
    try {
      const nextBlocked = !currentBlocked;
      await updateDoc(doc(db, 'users', uid), {
        isBlocked: nextBlocked
      });
      // Update local state immediately
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, isBlocked: nextBlocked } : u));
      
      await TelemetryService.logEvent(nextBlocked ? 'ride_cancelled' : 'ride_accepted', uid, 'admin', {
        action: nextBlocked ? 'USER_SUSPENDED' : 'USER_REINSTATED'
      });
      
      alert(nextBlocked ? 'Usuario suspendido temporalmente.' : 'Usuario rehabilitado con éxito.');
    } catch (e) {
      console.error('[ZENITH-ADMIN-ERROR] Block toggle failed:', e);
    }
  };

  // General commercial/tactical metrics calculations
  const totalUsers = users.length;
  const driversCount = users.filter(u => u.role === UserRole.DRIVER).length;
  const passengersCount = users.filter(u => u.role === UserRole.PASSENGER).length;
  const totalRidesCount = rides.length;
  
  const completedRides = rides.filter(r => r.status === RideStatus.COMPLETED);
  const totalEarnings = completedRides.reduce((sum, r) => sum + (r.finalPrice || r.protectedPrice || 0), 0);
  
  const cancelledRides = rides.filter(r => r.status === RideStatus.CANCELLED);
  const cancellationRate = totalRidesCount > 0 ? (cancelledRides.length / totalRidesCount) * 100 : 0;

  // Filter users
  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.uid.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === 'all' ? true : u.role === roleFilter;

    let matchesBlock = true;
    if (blockFilter === 'blocked') matchesBlock = u.isBlocked === true;
    else if (blockFilter === 'active') matchesBlock = u.isBlocked !== true;

    return matchesSearch && matchesRole && matchesBlock;
  });

  return (
    <div className="space-y-6 font-mono text-xs text-left" id="admin_control_module">
      {/* Metrics Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="hud-card p-4 bg-gradient-to-br from-black to-white/5 border-white/5 flex flex-col justify-between h-28">
          <span className="text-[9px] text-gray-500 uppercase">Usuarios Registrados</span>
          <p className="text-3xl font-black italic text-white mono-data">{totalUsers}</p>
          <div className="text-[8px] text-gray-600 uppercase">Conductores: {driversCount} • Clientes: {passengersCount}</div>
        </div>

        <div className="hud-card p-4 bg-gradient-to-br from-black to-white/5 border-white/5 flex flex-col justify-between h-28">
          <span className="text-[9px] text-gray-500 uppercase">Viajes Recientes</span>
          <p className="text-3xl font-black italic text-white mono-data">{totalRidesCount}</p>
          <div className="text-[8px] text-gray-600 uppercase">Completados: {completedRides.length}</div>
        </div>

        <div className="hud-card p-4 bg-gradient-to-br from-black to-white/5 border-[#39FF14]/15 flex flex-col justify-between h-28">
          <span className="text-[9px] text-gray-500 uppercase">Volumen Transaccionado</span>
          <p className="text-3xl font-black italic text-[#39FF14] mono-data">${totalEarnings.toFixed(2)}</p>
          <div className="text-[8px] text-gray-600 uppercase">Corte acumulado reciente</div>
        </div>

        <div className="hud-card p-4 bg-gradient-to-br from-black to-white/5 border-white/5 flex flex-col justify-between h-28">
          <span className="text-[9px] text-gray-500 uppercase">Porcentaje de Cancelación</span>
          <p className="text-3xl font-black italic text-red-400 mono-data">{cancellationRate.toFixed(1)}%</p>
          <div className="text-[8px] text-gray-600 uppercase">Viajes cancelados: {cancelledRides.length}</div>
        </div>
      </div>

      {/* Operations Toolbar */}
      <div className="hud-card p-5 bg-black/40 border-white/5 space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
          <div className="flex items-center gap-2">
            <Layers size={14} className="text-[#39FF14]" />
            <h4 className="text-xs uppercase font-black text-gray-300">Consola Central de Operadores e Integrantes</h4>
          </div>

          <button 
            onClick={loadAdminData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 text-gray-400 hover:text-white transition-all cursor-pointer"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>Refrescar</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Query Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3.5 text-gray-500" size={14} />
            <input
              type="text"
              placeholder="Buscar por nombre, email o ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/60 border border-white/10 focus:border-[#39FF14]/50 focus:outline-none pl-9 pr-3 py-3 rounded-xl text-white"
            />
          </div>

          {/* Role Filter */}
          <div>
            <select
              value={roleFilter}
              onChange={(e: any) => setRoleFilter(e.target.value)}
              className="w-full bg-black/60 border border-white/10 p-3 rounded-xl text-white focus:outline-none"
            >
              <option value="all">TODOS LOS ROLES</option>
              <option value="driver">SOCIOCONDUCTORES</option>
              <option value="passenger">SOCIOPASAJEROS</option>
            </select>
          </div>

          {/* Block filter */}
          <div>
            <select
              value={blockFilter}
              onChange={(e: any) => setBlockFilter(e.target.value)}
              className="w-full bg-black/60 border border-white/10 p-3 rounded-xl text-white focus:outline-none"
            >
              <option value="all">TODOS LOS ESTADOS</option>
              <option value="active">HABILITADOS</option>
              <option value="blocked">SUSPENDIDOS / BLOQUEADOS</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Admin Control Center Board */}
      <div className="space-y-3">
        <h4 className="font-bold text-sm uppercase italic text-white flex items-center gap-2">
          <Users size={16} className="text-[#39FF14]" />
          Registros de Integrantes ({filteredUsers.length})
        </h4>

        <div className="space-y-2">
          {loading ? (
            <div className="p-12 text-center flex justify-center">
              <RefreshCw className="animate-spin text-[#39FF14]" size={24} />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="hud-card p-10 text-center text-gray-500 uppercase tracking-widest border-dashed">
              Ningún usuario coincide con los criterios de búsqueda.
            </div>
          ) : (
            filteredUsers.map((u) => {
              const isBlocked = u.isBlocked === true;
              return (
                <div 
                  key={u.uid}
                  className="hud-card p-4 bg-white/5 border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
                >
                  <div className="flex items-center gap-3 text-left">
                    <img 
                      src={u.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'} 
                      alt="" 
                      className="w-10 h-10 rounded-xl object-cover border border-white/10 shrink-0"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-white text-xs uppercase">{u.fullName}</p>
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                          u.role === UserRole.DRIVER 
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}>
                          {u.role}
                        </span>
                      </div>
                      <p className="text-[9px] text-gray-500 mt-0.5">{u.email}</p>
                      <p className="text-[8px] font-mono text-gray-600">ID: {u.uid}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-6 border-t border-white/5 md:border-none pt-3 md:pt-0">
                    <div className="text-left md:text-right font-mono">
                      <p className="text-[8px] text-gray-500 uppercase">Reputación</p>
                      <div className="flex items-center gap-1 mt-0.5 text-white">
                        <Star className="text-[#39FF14] fill-[#39FF14]" size={10} />
                        <span className="font-bold text-xs">{u.rating?.toFixed(1) || '5.0'}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleBlockUser(u.uid, isBlocked)}
                        className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer border ${
                          isBlocked 
                            ? 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/20' 
                            : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20'
                        }`}
                      >
                        {isBlocked ? (
                          <>
                            <CheckCircle size={12} />
                            <span>Habilitar</span>
                          </>
                        ) : (
                          <>
                            <Ban size={12} />
                            <span>Suspender</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
