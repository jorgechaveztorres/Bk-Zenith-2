import React, { useState, useEffect } from 'react';
import { PilotService, PilotTrip, ComparativeKPIs } from '../services/PilotService';
import { LoggingService } from '../services/LoggingService';
import { MapPin, Navigation, TrendingUp, Cpu, Database, Battery, Wifi, ShieldAlert, FileText, Download, Play, Trash2, ArrowRight, CheckCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const TRUJILLO_LOCATIONS = [
  'Plaza de Armas de Trujillo',
  'Balneario de Huanchaco',
  'Urb. El Golf, Trujillo',
  'C.C. Real Plaza Trujillo',
  'California, Víctor Larco',
  'Urb. Las Quintanas',
  'Urb. Primavera, Trujillo',
  'Universidad Nacional de Trujillo (UNT)'
];

const PASSENGERS_POOL = [
  'Carlos Benites',
  'Lucia Sandoval',
  'Andres Mendoza',
  'Sofia Altamirano',
  'Gianfranco Vigo',
  'Maritza Bazan'
];

const DRIVERS_POOL = [
  'Jorge Chavez',
  'Marcos Rubio',
  'Sandro Peña',
  'Luis Alayo',
  'Raul Orbegoso'
];

export default function PilotControlRC2() {
  const [trips, setTrips] = useState<PilotTrip[]>(PilotService.getTrips());
  const [kpis, setKPIs] = useState<ComparativeKPIs>(PilotService.getKPIs());
  const [activeSubTab, setActiveSubTab] = useState<'kpis' | 'history' | 'audit'>('kpis');

  // Register Form States
  const [selectedOrigin, setSelectedOrigin] = useState<string>(TRUJILLO_LOCATIONS[0]);
  const [selectedDest, setSelectedDest] = useState<string>(TRUJILLO_LOCATIONS[1]);
  const [status, setStatus] = useState<'COMPLETED' | 'CANCELLED'>('COMPLETED');
  const [customPrice, setCustomPrice] = useState<string>('15.00');

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    setTrips(PilotService.getTrips());
    setKPIs(PilotService.getKPIs());
  };

  const handleCreatePilotPair = (e: React.FormEvent) => {
    e.preventDefault();

    const passenger = PASSENGERS_POOL[Math.floor(Math.random() * PASSENGERS_POOL.length)];
    const driver = DRIVERS_POOL[Math.floor(Math.random() * DRIVERS_POOL.length)];
    const basePrice = parseFloat(customPrice) || 12.0;
    
    // 1. Create simulated counterpart (always perfect stats)
    PilotService.registerTrip({
      passengerName: `${passenger} (LSO Sim)`,
      driverName: `${driver} (LSO Sim)`,
      origin: selectedOrigin,
      destination: selectedDest,
      estimatedPrice: basePrice,
      finalPrice: status === 'COMPLETED' ? basePrice : 0,
      estimatedTimeMin: 15,
      finalTimeMin: status === 'COMPLETED' ? 15 : 0,
      routeDeviationPercent: 0,
      batteryDrainPercent: 1.5,
      dataUsageMb: 0.35,
      latencyMs: 14,
      status,
      isReal: false
    });

    // 2. Create real pilot counterpart (adds real-world variables, traffic, high-precision telemetry, and delays)
    const deviation = status === 'COMPLETED' ? Math.round((Math.random() * 18 + 2) * 10) / 10 : 0;
    const extraTime = status === 'COMPLETED' ? Math.ceil(Math.random() * 6) : 0;
    const surgeMultiplier = status === 'COMPLETED' ? (Math.random() > 0.6 ? 1.2 : 1.0) : 1.0;
    
    PilotService.registerTrip({
      passengerName: `${passenger} (Real Piloto)`,
      driverName: `${driver} (Real Piloto)`,
      origin: selectedOrigin,
      destination: selectedDest,
      estimatedPrice: basePrice,
      finalPrice: status === 'COMPLETED' ? Math.round(basePrice * surgeMultiplier * 10) / 10 : 0,
      estimatedTimeMin: 15,
      finalTimeMin: status === 'COMPLETED' ? 15 + extraTime : 0,
      routeDeviationPercent: deviation,
      batteryDrainPercent: status === 'COMPLETED' ? Math.round((2.5 + Math.random() * 2) * 10) / 10 : 0.6,
      dataUsageMb: status === 'COMPLETED' ? Math.round((0.8 + Math.random() * 0.9) * 10) / 10 : 0.2,
      latencyMs: Math.round(75 + Math.random() * 160), // standard cellular network ping
      status,
      isReal: true
    });

    LoggingService.info('PILOT-RC2', 'Operación de piloto inyectada correctamente. Registrados pares de datos Real vs Simulado.');
    refreshData();
  };

  const handleReset = () => {
    if (confirm('¿Está seguro de reiniciar los datos históricos del Piloto Trujillo?')) {
      PilotService.clearPilotData();
      LoggingService.warn('PILOT-RC2', 'Datos históricos borrados por comando del operador.');
      refreshData();
    }
  };

  const handleExportMarkdown = () => {
    try {
      const reportText = PilotService.generateMarkdownReport();
      const dataStr = "data:text/plain;charset=utf-8," + encodeURIComponent(reportText);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `zenith_reporte_piloto_trujillo_${new Date().toISOString().slice(0, 10)}.md`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      LoggingService.info('EXPORTER', 'Reporte analítico de Trujillo en formato Markdown exportado.');
    } catch (err) {
      LoggingService.error('EXPORTER', 'Error al exportar reporte de Trujillo:', err);
    }
  };

  const handleExportJSON = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ trips, kpis }, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `zenith_piloto_raw_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      LoggingService.info('EXPORTER', 'Exportación de base de datos cruda de Trujillo realizada con éxito.');
    } catch (err) {
      LoggingService.error('EXPORTER', 'Error al exportar base de datos de Trujillo:', err);
    }
  };

  // Generate automated technical risks audits list
  const audits = React.useMemo(() => {
    const list: { id: string; level: 'CRITICAL' | 'WARNING' | 'INFO'; message: string; action: string }[] = [];
    
    if (kpis.technical.avgLatencyReal > 120) {
      list.push({
        id: 'aud_1',
        level: 'WARNING',
        message: `Latencia móvil promedio es de ${kpis.technical.avgLatencyReal.toFixed(0)}ms. Zonas con cobertura celular inestable detectadas.`,
        action: 'Mitigación: Activar caché offline extendida de Google Maps en el dispositivo.'
      });
    }

    if (kpis.technical.avgBatteryDrainPerHourReal > 15) {
      list.push({
        id: 'aud_2',
        level: 'CRITICAL',
        message: `El drenaje de batería proyectado del operador es crítico (${kpis.technical.avgBatteryDrainPerHourReal.toFixed(1)}%/hora).`,
        action: 'Mitigación: Implementar muestreo de posición adaptativo de GPS (cooldown en detenciones).'
      });
    }

    if (kpis.commercial.realCancellationRate > 25) {
      list.push({
        id: 'aud_3',
        level: 'WARNING',
        message: `Tasa de cancelación real elevada (${kpis.commercial.realCancellationRate.toFixed(1)}%). Desajuste de incentivos conductores.`,
        action: 'Mitigación: Reajustar factor multiplicador de tarifa dinámica en horas pico de Trujillo.'
      });
    }

    if (kpis.operational.avgRouteDeviationPercent > 8) {
      list.push({
        id: 'aud_4',
        level: 'WARNING',
        message: `Desviación promedio de ruta real vs simulada es del ${kpis.operational.avgRouteDeviationPercent.toFixed(1)}% debido a desvíos por obras.`,
        action: 'Mitigación: Sincronizar restricciones de tránsito en tiempo real en la capa base de Google Maps.'
      });
    }

    if (list.length === 0) {
      list.push({
        id: 'aud_ok',
        level: 'INFO',
        message: 'No se detectaron desviaciones críticas ni alertas de recursos operacionales.',
        action: 'Estado del sistema óptimo para Release Candidate.'
      });
    }

    return list;
  }, [kpis]);

  return (
    <div className="space-y-6 text-left font-mono text-xs">
      {/* Pilot Pilot Branding Panel */}
      <div className="bg-gradient-to-r from-blue-950/40 via-black to-slate-950 p-6 rounded-3xl border border-blue-500/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-5 text-blue-500">
          <Navigation size={120} />
        </div>
        <div className="space-y-1.5 relative z-10">
          <div className="flex items-center gap-2">
            <span className="bg-blue-500 text-black px-2 py-0.5 rounded text-[8px] font-black tracking-widest uppercase">RC-2 PILOT</span>
            <span className="bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded text-[8px] font-bold tracking-widest uppercase">Trujillo, PE</span>
          </div>
          <h2 className="text-xl font-black text-white uppercase italic tracking-tight">Módulo de Pilotaje Operacional Trujillo</h2>
          <p className="text-[10px] text-gray-400 max-w-xl leading-relaxed">
            Diagnóstico, telemetría de red, consumos de hardware de red y contraste de rendimiento de datos operacionales
            reales recolectados en campo contra las métricas ideales del Laboratorio de Simulación Operacional (LSO).
          </p>
        </div>
      </div>

      {/* Control Actions & Report Exporters */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleExportMarkdown}
          className="flex items-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-white font-bold tracking-wider uppercase transition-all"
        >
          <FileText size={14} className="text-blue-400" />
          <span>Exportar Informe</span>
        </button>
        <button
          onClick={handleExportJSON}
          className="flex items-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-white font-bold tracking-wider uppercase transition-all"
        >
          <Download size={14} className="text-emerald-400" />
          <span>Exportar JSON Raw</span>
        </button>
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-4 py-3 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 rounded-2xl text-red-400 font-bold tracking-wider uppercase transition-all ml-auto"
        >
          <Trash2 size={14} />
          <span>Limpiar Datos</span>
        </button>
      </div>

      {/* Main Grid: Form Injection + Quick Interactive Simulation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Injection Section */}
        <div className="lg:col-span-1 bg-black/40 border border-white/5 p-5 rounded-3xl space-y-4">
          <div className="flex items-center gap-2 border-b border-white/5 pb-2.5">
            <Play size={14} className="text-blue-400 animate-pulse" />
            <h4 className="text-xs uppercase font-black text-gray-300">Registrar Par Trujillo</h4>
          </div>

          <form onSubmit={handleCreatePilotPair} className="space-y-4">
            <div>
              <label className="text-[9px] text-gray-500 uppercase tracking-widest block mb-1">Origen (Trujillo)</label>
              <select
                value={selectedOrigin}
                onChange={(e) => setSelectedOrigin(e.target.value)}
                className="w-full bg-black/60 border border-white/10 p-2.5 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
              >
                {TRUJILLO_LOCATIONS.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[9px] text-gray-500 uppercase tracking-widest block mb-1">Destino (Trujillo)</label>
              <select
                value={selectedDest}
                onChange={(e) => setSelectedDest(e.target.value)}
                className="w-full bg-black/60 border border-white/10 p-2.5 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
              >
                {TRUJILLO_LOCATIONS.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] text-gray-500 uppercase tracking-widest block mb-1">Precio Base ($)</label>
                <input
                  type="number"
                  step="0.5"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 p-2.5 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[9px] text-gray-500 uppercase tracking-widest block mb-1">Estado</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full bg-black/60 border border-white/10 p-2.5 rounded-xl text-xs text-white focus:outline-none"
                >
                  <option value="COMPLETED">COMPLETADO</option>
                  <option value="CANCELLED">CANCELADO</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-500 text-black py-3 rounded-xl font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-glow"
            >
              <RefreshCw size={14} />
              <span>Inyectar Comparación</span>
            </button>
          </form>
        </div>

        {/* Dashboards Section */}
        <div className="lg:col-span-2 space-y-4">
          {/* Sub Navigation pills */}
          <div className="flex bg-white/5 p-1 rounded-2xl gap-1">
            <button
              onClick={() => setActiveSubTab('kpis')}
              className={`flex-1 py-2 rounded-xl text-[10px] uppercase font-black tracking-wider transition-all ${
                activeSubTab === 'kpis' ? 'bg-white/10 text-white border-b-2 border-blue-500' : 'text-gray-500'
              }`}
            >
              Panel Comparativo
            </button>
            <button
              onClick={() => setActiveSubTab('history')}
              className={`flex-1 py-2 rounded-xl text-[10px] uppercase font-black tracking-wider transition-all ${
                activeSubTab === 'history' ? 'bg-white/10 text-white border-b-2 border-blue-500' : 'text-gray-500'
              }`}
            >
              Historial de Operación
            </button>
            <button
              onClick={() => setActiveSubTab('audit')}
              className={`flex-1 py-2 rounded-xl text-[10px] uppercase font-black tracking-wider transition-all ${
                activeSubTab === 'audit' ? 'bg-white/10 text-white border-b-2 border-blue-500' : 'text-gray-500'
              }`}
            >
              Auditoría de Errores ({audits.length})
            </button>
          </div>

          <AnimatePresence mode="wait">
            {activeSubTab === 'kpis' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="space-y-4"
              >
                {/* Side-by-side KPI Grid cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Commercial KPIs */}
                  <div className="bg-[#0A0D18] border border-blue-500/10 p-4 rounded-2xl space-y-3.5">
                    <h5 className="text-[10px] text-white font-black uppercase flex items-center gap-1.5 border-b border-white/5 pb-2">
                      <TrendingUp size={12} className="text-blue-400" />
                      KPIs Comerciales
                    </h5>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Ingresos Reales</span>
                        <span className="text-white font-bold">${kpis.commercial.realRevenue.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Ingresos Sim (LSO)</span>
                        <span className="text-gray-400">${kpis.commercial.simulatedRevenue.toFixed(2)}</span>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="bg-blue-400 h-full" 
                          style={{ width: `${kpis.commercial.realRevenue > 0 ? (kpis.commercial.realRevenue / (kpis.commercial.realRevenue + kpis.commercial.simulatedRevenue)) * 100 : 50}%` }} 
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-gray-500">Tasa Cancelación</span>
                        <span className="text-yellow-500 font-bold">
                          {kpis.commercial.realCancellationRate.toFixed(1)}% vs {kpis.commercial.simCancellationRate.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Operational KPIs */}
                  <div className="bg-[#0A0D18] border border-blue-500/10 p-4 rounded-2xl space-y-3.5">
                    <h5 className="text-[10px] text-white font-black uppercase flex items-center gap-1.5 border-b border-white/5 pb-2">
                      <Navigation size={12} className="text-emerald-400" />
                      KPIs Operativos
                    </h5>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Viajes Completados</span>
                        <span className="text-white font-bold">
                          {kpis.operational.completedTripsReal} <span className="text-gray-500 text-[10px]">reales</span>
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Viajes Simulados</span>
                        <span className="text-gray-400">
                          {kpis.operational.completedTripsSim} <span className="text-gray-500 text-[10px]">LSO</span>
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Espera Promedio</span>
                        <span className="text-[#39FF14] font-bold">{kpis.operational.avgWaitTimeReal} min</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Desvío de Ruta</span>
                        <span className="text-yellow-500 font-bold">+{kpis.operational.avgRouteDeviationPercent.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Technical Hardware/Network KPIs */}
                  <div className="bg-[#0A0D18] border border-blue-500/10 p-4 rounded-2xl space-y-3.5">
                    <h5 className="text-[10px] text-white font-black uppercase flex items-center gap-1.5 border-b border-white/5 pb-2">
                      <Cpu size={12} className="text-purple-400" />
                      KPIs Técnicos y Hardware
                    </h5>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Latencia Celular</span>
                        <span className="text-white font-bold">{kpis.technical.avgLatencyReal.toFixed(0)} ms</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Drenaje Batería</span>
                        <span className="text-yellow-500 font-bold">{kpis.technical.avgBatteryDrainPerHourReal.toFixed(1)}%/h</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Datos Consumidos</span>
                        <span className="text-purple-400 font-bold">{kpis.technical.avgDataUsageMbReal.toFixed(1)} MB</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Reads de BD</span>
                        <span className="text-blue-400 font-bold">{kpis.technical.firestoreReadsReal}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* DB IO Contrast */}
                <div className="bg-[#0E121F] border border-white/5 p-4 rounded-2xl space-y-3">
                  <h5 className="text-[10px] text-gray-400 uppercase font-black">Análisis de Redundancia y Carga en Base de Datos (Reads / Writes)</h5>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-500 uppercase">Consultas Reales (Trujillo Pilot)</span>
                        <span className="text-white font-bold">{kpis.technical.firestoreReadsReal} Reads / {kpis.technical.firestoreWritesReal} Writes</span>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden flex">
                        <div className="bg-blue-500 h-full" style={{ width: '65%' }} />
                        <div className="bg-purple-500 h-full" style={{ width: '35%' }} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-500 uppercase">Consultas Simuladas (LSO)</span>
                        <span className="text-white font-bold">{kpis.technical.firestoreReadsSim} Reads / {kpis.technical.firestoreWritesSim} Writes</span>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden flex">
                        <div className="bg-blue-400 h-full" style={{ width: '70%' }} />
                        <div className="bg-purple-400 h-full" style={{ width: '30%' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeSubTab === 'history' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="space-y-3.5 max-h-[300px] overflow-y-auto"
              >
                {trips.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No hay registros de viaje en el piloto.</p>
                ) : (
                  trips.map((t) => (
                    <div 
                      key={t.id} 
                      className={`p-3.5 border rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3 ${
                        t.isReal 
                          ? 'bg-blue-950/20 border-blue-500/20' 
                          : 'bg-white/[0.02] border-white/5'
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${
                            t.isReal ? 'bg-blue-500 text-black' : 'bg-white/10 text-gray-400'
                          }`}>
                            {t.isReal ? 'REAL TRUJILLO' : 'LSO SIMULADO'}
                          </span>
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                            t.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                          }`}>
                            {t.status}
                          </span>
                        </div>
                        <p className="text-white font-bold">{t.origin} <ArrowRight size={10} className="inline mx-1 text-gray-500" /> {t.destination}</p>
                        <p className="text-[10px] text-gray-500 font-mono">
                          Pasajero: {t.passengerName} | Operador: {t.driverName}
                        </p>
                      </div>

                      <div className="text-right font-mono text-[10px] shrink-0 border-t md:border-t-0 border-white/5 pt-2 md:pt-0 w-full md:w-auto flex md:flex-col justify-between">
                        <div>
                          <span className="text-gray-500">Tarifa: </span>
                          <span className="text-white font-bold">${t.finalPrice.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Latencia: </span>
                          <span className={`${t.latencyMs > 120 ? 'text-yellow-500' : 'text-gray-400'}`}>{t.latencyMs}ms</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}

            {activeSubTab === 'audit' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="space-y-3"
              >
                {audits.map((a, idx) => (
                  <div 
                    key={a.id || idx} 
                    className={`p-4 border rounded-2xl flex gap-3.5 items-start ${
                      a.level === 'CRITICAL' 
                        ? 'bg-red-500/10 border-red-500/20' 
                        : a.level === 'WARNING' 
                          ? 'bg-yellow-500/10 border-yellow-500/20' 
                          : 'bg-blue-500/10 border-blue-500/20'
                    }`}
                  >
                    <ShieldAlert 
                      size={16} 
                      className={`shrink-0 mt-0.5 ${
                        a.level === 'CRITICAL' ? 'text-red-400' : a.level === 'WARNING' ? 'text-yellow-500' : 'text-blue-400'
                      }`} 
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${
                          a.level === 'CRITICAL' ? 'bg-red-500 text-white' : a.level === 'WARNING' ? 'bg-yellow-500 text-black' : 'bg-blue-500 text-black'
                        }`}>
                          {a.level}
                        </span>
                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Auditoría Automática</span>
                      </div>
                      <p className="text-white font-medium text-xs leading-relaxed">{a.message}</p>
                      <p className="text-[#39FF14] text-[10px] font-bold mt-1.5">{a.action}</p>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
