import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LoggingService, LogEntry, LogLevel } from '../services/LoggingService';
import { ObservabilityService, ObservabilityMetrics } from '../services/ObservabilityService';
import { Terminal, Activity, ShieldAlert, Cpu, Database, Wifi, Clock, Trash2, Download, Eye, EyeOff, Sliders, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function DevObservabilityHUD() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isDevMode, setIsDevMode] = useState<boolean>(LoggingService.getDevMode());
  const [metrics, setMetrics] = useState<ObservabilityMetrics>(ObservabilityService.getMetrics());
  const [logs, setLogs] = useState<LogEntry[]>(LoggingService.getLogs());
  const [filterLevel, setFilterLevel] = useState<LogLevel | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'metrics' | 'logs'>('metrics');

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Sync metrics & logs in real-time
  useEffect(() => {
    const unsubMetrics = ObservabilityService.subscribe((updated) => {
      setMetrics(updated);
    });

    const unsubLogs = LoggingService.subscribe(() => {
      setLogs(LoggingService.getLogs());
    });

    return () => {
      unsubMetrics();
      unsubLogs();
    };
  }, []);

  // Global Error & Console Interception
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Intercept unhandled exceptions
    const handleError = (event: ErrorEvent) => {
      ObservabilityService.trackCriticalError();
      LoggingService.critical('GLOBAL-ERROR', event.message || 'Error no controlado detectado en runtime.', {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
      });
    };

    // Intercept unhandled promise rejections
    const handleRejection = (event: PromiseRejectionEvent) => {
      ObservabilityService.trackCriticalError();
      LoggingService.critical('PROMISE-REJECTION', 'Promesa rechazada no controlada.', {
        reason: event.reason
      });
    };

    // Backup and wrap original console methods to feed our logs & counters
    const originalWarn = console.warn;
    const originalError = console.error;

    console.warn = (...args: any[]) => {
      originalWarn.apply(console, args);
      ObservabilityService.trackRecoverableError();
      LoggingService.warn('CONSOLE-WARN', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
    };

    console.error = (...args: any[]) => {
      originalError.apply(console, args);
      ObservabilityService.trackCriticalError();
      LoggingService.error('CONSOLE-ERROR', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, []);

  // Auto scroll logs
  useEffect(() => {
    if (activeTab === 'logs' && isOpen) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, activeTab, isOpen]);

  const handleDevModeToggle = (val: boolean) => {
    setIsDevMode(val);
    LoggingService.setDevMode(val);
  };

  const handleExportLogs = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(LoggingService.exportLogsAsJSON());
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `zenith_logs_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      LoggingService.info('EXPORTER', 'Archivo JSON de logs descargado por el desarrollador.');
    } catch (err) {
      LoggingService.error('EXPORTER', 'Error al exportar logs a JSON', err);
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesLevel = filterLevel === 'ALL' || log.level === filterLevel;
      const matchesSearch = log.message.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            log.module.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesLevel && matchesSearch;
    });
  }, [logs, filterLevel, searchQuery]);

  return (
    <>
      {/* Floating Toggle Trigger Button */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2">
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`flex items-center gap-2 px-4 py-3 rounded-2xl border font-mono text-[11px] font-black tracking-widest uppercase transition-all shadow-glow ${
            isOpen 
              ? 'bg-red-500/10 border-red-500/30 text-red-400' 
              : 'bg-[#39FF14]/10 border-[#39FF14]/30 text-[#39FF14]'
          }`}
          id="dev_hud_toggle"
        >
          {isOpen ? <X size={14} className="animate-spin-once" /> : <Terminal size={14} className="animate-pulse" />}
          <span>{isOpen ? 'Cerrar HUD' : 'COCKPIT DEV'}</span>
        </motion.button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            className="fixed inset-x-6 bottom-24 top-24 md:left-auto md:right-6 md:w-[480px] bg-[#090C15] border border-white/10 rounded-3xl shadow-2xl z-50 flex flex-col overflow-hidden backdrop-blur-2xl"
            id="dev_hud_panel"
          >
            {/* Header */}
            <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-2.5">
                <Activity className="text-[#39FF14] animate-pulse" size={18} />
                <div>
                  <h3 className="font-mono text-xs font-black uppercase tracking-widest text-white">Observabilidad Zénith RC-1</h3>
                  <p className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">Diagnóstico Operativo en Tiempo Real</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDevModeToggle(!isDevMode)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border font-mono text-[9px] font-bold tracking-wider uppercase transition-all ${
                    isDevMode 
                      ? 'bg-[#39FF14]/10 border-[#39FF14]/30 text-[#39FF14]' 
                      : 'bg-white/5 border-white/10 text-gray-500'
                  }`}
                  title={isDevMode ? 'Desactivar Logs de Consola' : 'Activar Logs de Consola'}
                >
                  {isDevMode ? <Eye size={10} /> : <EyeOff size={10} />}
                  <span>{isDevMode ? 'DEV MODE' : 'SILENT'}</span>
                </button>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-4 border-b border-white/5 divide-x divide-white/5 bg-[#0C0F1B]/60 text-center py-3.5 font-mono text-[10px]">
              <div>
                <span className="text-gray-500 block text-[8px] uppercase tracking-wider mb-0.5">FPS</span>
                <span className={`font-black ${metrics.fps >= 55 ? 'text-[#39FF14]' : metrics.fps >= 40 ? 'text-yellow-500' : 'text-red-500'}`}>
                  {metrics.fps}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block text-[8px] uppercase tracking-wider mb-0.5">Memoria</span>
                <span className="text-white font-black">{metrics.memoryMb.toFixed(1)} MB</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[8px] uppercase tracking-wider mb-0.5">Firestore Reads</span>
                <span className="text-blue-400 font-black">{metrics.firestoreReads}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[8px] uppercase tracking-wider mb-0.5">Errores</span>
                <span className={`font-black ${metrics.criticalErrors > 0 ? 'text-red-500 animate-pulse font-black' : metrics.recoverableErrors > 0 ? 'text-yellow-500' : 'text-green-400'}`}>
                  {metrics.criticalErrors + metrics.recoverableErrors}
                </span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex bg-white/[0.01] border-b border-white/5 p-1 gap-1">
              <button
                onClick={() => setActiveTab('metrics')}
                className={`flex-1 py-2 text-[10px] font-mono uppercase font-black tracking-widest rounded-xl transition-all ${
                  activeTab === 'metrics'
                    ? 'bg-white/10 text-white border-b border-[#39FF14]'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Métricas del Sistema
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={`flex-1 py-2 text-[10px] font-mono uppercase font-black tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'logs'
                    ? 'bg-white/10 text-white border-b border-[#39FF14]'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Consola de Eventos
                {filteredLogs.length > 0 && (
                  <span className="bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                    {filteredLogs.length}
                  </span>
                )}
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-5">
              {activeTab === 'metrics' ? (
                <div className="space-y-5">
                  {/* CPU / RAM Usage */}
                  <div className="space-y-3.5 bg-[#0E121F] border border-white/5 p-4 rounded-2xl">
                    <h4 className="font-mono text-[10px] text-white uppercase font-black tracking-wider flex items-center gap-1.5">
                      <Cpu size={12} className="text-blue-400" />
                      Recursos de Cómputo Local
                    </h4>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-mono text-gray-400">
                        <span>Consumo de CPU Virtualizado</span>
                        <span className="text-white font-bold">{metrics.cpuPercentage.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="bg-blue-400 h-full transition-all duration-500" 
                          style={{ width: `${Math.min(100, metrics.cpuPercentage * 1.2)}%` }} 
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-mono text-gray-400">
                        <span>Asignación de Memoria (RAM)</span>
                        <span className="text-white font-bold">{metrics.memoryMb.toFixed(1)} MB / 512 MB</span>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="bg-[#39FF14] h-full transition-all duration-500" 
                          style={{ width: `${Math.min(100, (metrics.memoryMb / 512) * 100)}%` }} 
                        />
                      </div>
                    </div>
                  </div>

                  {/* Firestore Observability */}
                  <div className="space-y-3.5 bg-[#0E121F] border border-white/5 p-4 rounded-2xl">
                    <h4 className="font-mono text-[10px] text-white uppercase font-black tracking-wider flex items-center gap-1.5">
                      <Database size={12} className="text-purple-400" />
                      IO Base de Datos & Costos
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[#121727] p-3 rounded-xl border border-white/5 text-center font-mono">
                        <span className="text-gray-500 text-[8px] uppercase block tracking-wider mb-1">Reads Totales</span>
                        <span className="text-white font-black text-lg">{metrics.firestoreReads}</span>
                      </div>
                      <div className="bg-[#121727] p-3 rounded-xl border border-white/5 text-center font-mono">
                        <span className="text-gray-500 text-[8px] uppercase block tracking-wider mb-1">Writes Totales</span>
                        <span className="text-white font-black text-lg">{metrics.firestoreWrites}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono border-t border-white/5 pt-3">
                      <span className="text-gray-400">Costo Operativo Estimado (Firebase USD)</span>
                      <span className="text-yellow-500 font-black">
                        ${((metrics.firestoreReads * 0.00000006) + (metrics.firestoreWrites * 0.00000018)).toFixed(6)}
                      </span>
                    </div>
                  </div>

                  {/* Network / Execution Latency */}
                  <div className="space-y-3.5 bg-[#0E121F] border border-white/5 p-4 rounded-2xl">
                    <h4 className="font-mono text-[10px] text-white uppercase font-black tracking-wider flex items-center gap-1.5">
                      <Wifi size={12} className="text-green-400" />
                      Rendimiento de Red & Tiempos
                    </h4>

                    <div className="space-y-3 font-mono text-[10px]">
                      <div className="flex justify-between items-center border-b border-white/5 pb-2">
                        <span className="text-gray-400">Latencia de Red Promedio</span>
                        <span className="text-[#39FF14] font-bold">{metrics.latencyMs}ms</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-white/5 pb-2">
                        <span className="text-gray-400">Tiempo de Carga de la App</span>
                        <span className="text-white font-bold">{metrics.loadTimeMs}ms</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-white/5 pb-2">
                        <span className="text-gray-400">Duración del Último Render</span>
                        <span className="text-white font-bold">{metrics.renderTimeMs}ms</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Tiempo de Tránsito / Navegación</span>
                        <span className="text-white font-bold">{metrics.navigationTimeMs}ms</span>
                      </div>
                    </div>
                  </div>

                  {/* Error Metrics */}
                  <div className="space-y-3.5 bg-[#0E121F] border border-white/5 p-4 rounded-2xl">
                    <h4 className="font-mono text-[10px] text-white uppercase font-black tracking-wider flex items-center gap-1.5">
                      <ShieldAlert size={12} className="text-red-400" />
                      Salud & Tolerancia a Fallos
                    </h4>

                    <div className="grid grid-cols-2 gap-4 text-center font-mono">
                      <div className="bg-[#121727] p-3 rounded-xl border border-white/5">
                        <span className="text-gray-500 text-[8px] uppercase block tracking-wider mb-1">Recuperables</span>
                        <span className="text-yellow-500 font-black text-lg">{metrics.recoverableErrors}</span>
                      </div>
                      <div className="bg-[#121727] p-3 rounded-xl border border-white/5">
                        <span className="text-gray-500 text-[8px] uppercase block tracking-wider mb-1">Críticos (Crashes)</span>
                        <span className="text-red-500 font-black text-lg">{metrics.criticalErrors}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col space-y-4">
                  {/* Console Search and filters */}
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Buscar log..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#39FF14]/50"
                      />
                      <button
                        onClick={() => LoggingService.clearLogs()}
                        className="p-2.5 bg-white/5 hover:bg-red-500/10 text-gray-400 hover:text-red-400 border border-white/10 rounded-xl transition-all"
                        title="Limpiar Consola"
                      >
                        <Trash2 size={14} />
                      </button>
                      <button
                        onClick={handleExportLogs}
                        className="p-2.5 bg-[#39FF14]/5 hover:bg-[#39FF14]/15 text-[#39FF14] border border-[#39FF14]/20 rounded-xl transition-all"
                        title="Exportar logs a JSON"
                      >
                        <Download size={14} />
                      </button>
                    </div>

                    {/* Level Selector pills */}
                    <div className="flex flex-wrap gap-1">
                      {(['ALL', 'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'] as const).map((lvl) => {
                        const active = filterLevel === lvl;
                        return (
                          <button
                            key={lvl}
                            onClick={() => setFilterLevel(lvl)}
                            className={`px-2 py-1 rounded-lg text-[9px] font-mono tracking-wider transition-all border ${
                              active
                                ? 'bg-white/15 text-white border-white/20'
                                : 'bg-white/5 text-gray-500 border-transparent hover:text-gray-300'
                            }`}
                          >
                            {lvl}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Logs list console terminal */}
                  <div className="flex-1 bg-black/40 border border-white/10 rounded-2xl p-4 overflow-y-auto h-[320px] font-mono text-[10px] space-y-2">
                    {filteredLogs.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-gray-600">
                        No hay logs que coincidan con la búsqueda.
                      </div>
                    ) : (
                      filteredLogs.map((log) => {
                        let textStyle = 'text-gray-400';
                        if (log.level === 'INFO') textStyle = 'text-blue-400';
                        if (log.level === 'WARNING') textStyle = 'text-yellow-500';
                        if (log.level === 'ERROR') textStyle = 'text-red-400';
                        if (log.level === 'CRITICAL') textStyle = 'text-pink-500 font-bold';

                        return (
                          <div key={log.id} className="border-b border-white/5 pb-1.5 leading-relaxed">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-[8px] text-gray-600">[{log.timestamp.slice(11, 19)}]</span>
                              <span className={`font-black uppercase tracking-wider text-[8px] px-1 py-0.5 rounded bg-white/5 ${textStyle}`}>
                                {log.level}
                              </span>
                              <span className="text-[9px] text-gray-500 font-bold">({log.module})</span>
                            </div>
                            <p className="text-white/90 font-medium pl-0.5">{log.message}</p>
                            {log.metadata && (
                              <pre className="mt-1 bg-white/[0.02] p-1.5 rounded text-[8px] text-gray-500 overflow-x-auto">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            )}
                          </div>
                        );
                      })
                    )}
                    <div ref={logsEndRef} />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
