import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { User, DocumentStatus } from '../../types';
import { 
  Users, 
  ShieldAlert, 
  UserCheck, 
  AlertOctagon, 
  Search, 
  Filter, 
  Clock, 
  TrendingUp, 
  FileCheck,
  ChevronRight,
  Eye,
  RefreshCw,
  FolderOpen,
  Radio
} from 'lucide-react';
import DriverReviewCard from './DriverReviewCard';
import DriverDocumentsViewer from './DriverDocumentsViewer';
import DriverAuditHistory from './DriverAuditHistory';
import DispatchDashboard from './DispatchDashboard';
import FinancialDashboard from './FinancialDashboard';
import TaxCenterDashboard from './TaxCenterDashboard';
import { Receipt } from 'lucide-react';

interface AdminDashboardProps {
  adminUser: User;
}

export default function AdminDashboard({ adminUser }: AdminDashboardProps) {
  const [drivers, setDrivers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState<User | null>(null);
  const [adminTab, setAdminTab] = useState<'verification' | 'dispatch' | 'financial' | 'tax'>('verification');

  // Filtros y búsquedas
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Cargar lista de conductores en tiempo real
  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'driver'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedDrivers: User[] = [];
      snapshot.forEach((doc) => {
        loadedDrivers.push(doc.data() as User);
      });
      setDrivers(loadedDrivers);
      setLoading(false);

      // Si tenemos un conductor seleccionado, actualizar su referencia con los nuevos datos
      if (selectedDriver) {
        const updated = loadedDrivers.find(d => d.uid === selectedDriver.uid);
        if (updated) {
          setSelectedDriver(updated);
        }
      }
    }, (error) => {
      console.error('[AdminDashboard] Error en snapshot de conductores:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedDriver?.uid]);

  // Filtrado y búsqueda local para velocidad extrema
  const filteredDrivers = drivers.filter(driver => {
    const status = driver.driverProfile?.status || DocumentStatus.PENDING;
    const matchesStatus = statusFilter === 'ALL' || status === statusFilter;

    const term = searchQuery.toLowerCase().trim();
    if (!term) return matchesStatus;

    const vehicle = driver.driverProfile?.vehicle;
    const doc = driver.driverProfile?.documentation;

    const matchesName = driver.fullName?.toLowerCase().includes(term);
    const matchesEmail = driver.email?.toLowerCase().includes(term);
    const matchesPhone = driver.phone?.toLowerCase().includes(term);
    const matchesPlate = vehicle?.plate?.toLowerCase().includes(term);
    const matchesLicense = doc?.licenseNumber?.toLowerCase().includes(term);
    const matchesBrand = vehicle?.brand?.toLowerCase().includes(term);

    return matchesStatus && (matchesName || matchesEmail || matchesPhone || matchesPlate || matchesLicense || matchesBrand);
  });

  // Estadísticas operacionales calculadas en caliente
  const stats = {
    total: drivers.length,
    pending: drivers.filter(d => (d.driverProfile?.status || DocumentStatus.PENDING) === DocumentStatus.PENDING).length,
    underReview: drivers.filter(d => d.driverProfile?.status === DocumentStatus.UNDER_REVIEW).length,
    approved: drivers.filter(d => d.driverProfile?.status === DocumentStatus.APPROVED).length,
    suspended: drivers.filter(d => d.driverProfile?.status === DocumentStatus.SUSPENDED).length,
    rejected: drivers.filter(d => d.driverProfile?.status === DocumentStatus.REJECTED).length,
    get approvalRate() {
      if (this.total === 0) return 0;
      return Math.round((this.approved / this.total) * 100);
    },
    avgReviewTime: 14 // Minutos promedio de auditoría en Trujillo
  };

  return (
    <div className="space-y-8 text-left" id="admin_dashboard">
      {/* Sub-Tabs de Control de Operaciones */}
      <div className="flex bg-white/5 border border-white/10 p-1.5 rounded-2xl gap-2 w-fit">
        <button
          onClick={() => setAdminTab('verification')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider font-mono transition-all ${
            adminTab === 'verification'
              ? 'bg-[#39FF14] text-black shadow-glow'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Auditoría de Expedientes
        </button>
        <button
          onClick={() => setAdminTab('dispatch')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider font-mono transition-all flex items-center gap-1.5 ${
            adminTab === 'dispatch'
              ? 'bg-[#39FF14] text-black shadow-glow'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Radio size={13} className={adminTab === 'dispatch' ? 'animate-pulse' : ''} />
          Despacho en Vivo
        </button>
        <button
          onClick={() => setAdminTab('financial')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider font-mono transition-all flex items-center gap-1.5 ${
            adminTab === 'financial'
              ? 'bg-[#39FF14] text-black shadow-glow'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Receipt size={13} />
          Consola Financiera
        </button>
        <button
          onClick={() => setAdminTab('tax')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider font-mono transition-all flex items-center gap-1.5 ${
            adminTab === 'tax'
              ? 'bg-[#39FF14] text-black shadow-glow'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Receipt size={13} />
          Tributación
        </button>
      </div>

      {adminTab === 'dispatch' ? (
        <DispatchDashboard />
      ) : adminTab === 'financial' ? (
        <FinancialDashboard />
      ) : adminTab === 'tax' ? (
        <TaxCenterDashboard />
      ) : (
        <>
          {/* KPI Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* KPI: Total */}
        <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[9px] font-mono uppercase tracking-wider">Total Conductores</span>
            <Users size={16} className="text-white/60" />
          </div>
          <p className="text-2xl font-black italic text-white mt-2 font-mono">{stats.total}</p>
        </div>

        {/* KPI: Pendientes */}
        <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-500">
            <span className="text-[9px] font-mono uppercase tracking-wider text-gray-500">En Cola de Revisión</span>
            <ShieldAlert size={16} className="animate-pulse" />
          </div>
          <p className="text-2xl font-black italic text-amber-500 mt-2 font-mono">
            {stats.pending + stats.underReview}
          </p>
        </div>

        {/* KPI: Aprobados */}
        <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#39FF14]">
            <span className="text-[9px] font-mono uppercase tracking-wider text-gray-500">Operadores Activos</span>
            <UserCheck size={16} />
          </div>
          <p className="text-2xl font-black italic text-[#39FF14] mt-2 font-mono">{stats.approved}</p>
        </div>

        {/* KPI: Tasa */}
        <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-cyan-400">
            <span className="text-[9px] font-mono uppercase tracking-wider text-gray-500">Tasa de Aprobación</span>
            <TrendingUp size={16} />
          </div>
          <p className="text-2xl font-black italic text-cyan-400 mt-2 font-mono">{stats.approvalRate}%</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-white/5 border border-white/10 rounded-2xl p-4">
        {/* Search input */}
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-4 top-3.5 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por Nombre, Correo, Celular, Placa o Licencia..."
            className="w-full bg-black/40 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#39FF14] transition-colors"
          />
        </div>

        {/* Status filters */}
        <div className="flex gap-1 overflow-x-auto w-full md:w-auto bg-black/40 p-1 rounded-xl border border-white/10">
          {[
            { value: 'ALL', label: 'Todos' },
            { value: DocumentStatus.PENDING, label: 'Pendientes' },
            { value: DocumentStatus.UNDER_REVIEW, label: 'En Revisión' },
            { value: DocumentStatus.APPROVED, label: 'Aprobados' },
            { value: DocumentStatus.SUSPENDED, label: 'Suspendidos' },
            { value: DocumentStatus.REJECTED, label: 'Rechazados' }
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => setStatusFilter(item.value)}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-mono uppercase font-black tracking-wider transition-all shrink-0 ${
                statusFilter === item.value
                  ? 'bg-white text-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Panel Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Drivers list (4 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <h3 className="font-bold text-sm uppercase italic flex items-center gap-2 text-white">
              <FolderOpen size={16} className="text-[#39FF14]" />
              Expedientes Filtrados ({filteredDrivers.length})
            </h3>
            <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">
              ZÉNITH PRO SECURE
            </span>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 bg-white/5 border border-white/5 rounded-3xl">
              <div className="w-8 h-8 border-2 border-[#39FF14] border-t-transparent rounded-full animate-spin"></div>
              <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Sincronizando expedientes...</p>
            </div>
          ) : filteredDrivers.length === 0 ? (
            <div className="py-20 text-center text-gray-500 font-mono text-[10px] uppercase tracking-widest bg-white/5 border border-white/5 rounded-3xl">
              Ningún conductor coincide con los filtros activos
            </div>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
              {filteredDrivers.map((driver) => {
                const isSelected = selectedDriver?.uid === driver.uid;
                const status = driver.driverProfile?.status || DocumentStatus.PENDING;
                
                return (
                  <div
                    key={driver.uid}
                    onClick={() => setSelectedDriver(driver)}
                    className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-[#39FF14]/10 border-[#39FF14]/40 shadow-glow' 
                        : 'bg-white/5 border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-white uppercase truncate max-w-[180px]">{driver.fullName}</h4>
                      <span className={`px-2 py-0.5 text-[8px] font-mono font-black uppercase rounded-md ${
                        status === DocumentStatus.APPROVED 
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : status === DocumentStatus.REJECTED
                          ? 'bg-red-500/10 text-red-400'
                          : status === DocumentStatus.SUSPENDED
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-cyan-500/10 text-cyan-400'
                      }`}>
                        {status}
                      </span>
                    </div>

                    <p className="text-[9px] font-mono text-gray-500 uppercase mt-1 truncate">
                      {driver.email} | Placa: {driver.driverProfile?.vehicle?.plate || 'N/D'}
                    </p>

                    <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[8px] font-mono text-gray-500 uppercase">
                      <span>Ciudad: Trujillo</span>
                      <span className="text-[#39FF14] flex items-center gap-1">
                        Ver Expediente <ChevronRight size={10} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Selected Driver Review (7 cols) */}
        <div className="lg:col-span-7">
          {selectedDriver ? (
            <div className="space-y-8">
              {/* 1. Admin action review card */}
              <DriverReviewCard 
                driver={selectedDriver} 
                adminUser={adminUser}
                onActionCompleted={() => {
                  // Se refresca el estado en base al onSnapshot automático
                }} 
              />

              {/* 2. Documents Viewer */}
              <DriverDocumentsViewer 
                documentation={selectedDriver.driverProfile!.documentation} 
                vehicle={selectedDriver.driverProfile!.vehicle} 
              />

              {/* 3. Immutable audit logs history for the operator */}
              <DriverAuditHistory driverId={selectedDriver.uid} />
            </div>
          ) : (
            <div className="bg-white/5 border border-dashed border-white/10 rounded-3xl p-24 text-center flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10">
                <FileCheck size={32} className="text-gray-400 animate-pulse" />
              </div>
              <div>
                <h4 className="text-lg font-black uppercase italic text-white">Consola de Decisión Zenith</h4>
                <p className="text-[10px] font-mono text-gray-500 uppercase mt-1 max-w-sm mx-auto leading-relaxed">
                  Seleccione un conductor del feed izquierdo para inspeccionar su fotografía, documentación oficial e historial completo.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      </>
      )}
    </div>
  );
}
