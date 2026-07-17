import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle2, XCircle, AlertTriangle, UserCheck, RefreshCw, HelpCircle, HardDrive } from 'lucide-react';
import { AuditRepository, DriverAuditLog } from '../../services/AuditRepository';

interface DriverAuditHistoryProps {
  driverId: string;
}

export default function DriverAuditHistory({ driverId }: DriverAuditHistoryProps) {
  const [history, setHistory] = useState<DriverAuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHistory() {
      setLoading(true);
      try {
        const logs = await AuditRepository.getHistoryByDriver(driverId);
        setHistory(logs);
      } catch (err) {
        console.error('Error loading driver audit history:', err);
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, [driverId]);

  const getActionTheme = (action: DriverAuditLog['action']) => {
    switch (action) {
      case 'APPROVE':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
          icon: UserCheck
        };
      case 'REJECT':
        return {
          bg: 'bg-red-500/10 border-red-500/20 text-red-400',
          icon: XCircle
        };
      case 'SUSPEND':
        return {
          bg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
          icon: AlertTriangle
        };
      case 'REACTIVATE':
        return {
          bg: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
          icon: RefreshCw
        };
      case 'DOCUMENT_UPLOAD':
      case 'CORRECTION':
        return {
          bg: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
          icon: Clock
        };
      default:
        return {
          bg: 'bg-white/5 border-white/10 text-gray-400',
          icon: HelpCircle
        };
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Sincronizando...';
    try {
      // Si es un Timestamp de Firestore
      if (timestamp.toDate) {
        return timestamp.toDate().toLocaleString('es-PE', { timeZone: 'America/Lima' });
      }
      // Si es un string ISO o fecha cruda
      return new Date(timestamp).toLocaleString('es-PE');
    } catch (e) {
      return 'Fecha inválida';
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center gap-3">
        <div className="w-6 h-6 border-2 border-[#39FF14] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Leyendo Registro Inmutable...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="driver_audit_history">
      <div className="border-l-2 border-[#39FF14] pl-4">
        <h4 className="text-sm font-black uppercase tracking-wider text-white">Libro de Trazabilidad e Historial</h4>
        <p className="text-[10px] font-mono text-gray-500 uppercase">Toda alteración es registrada criptográficamente mediante AuditEngine</p>
      </div>

      {history.length === 0 ? (
        <div className="bg-black/20 border border-white/5 rounded-2xl p-10 text-center flex flex-col items-center gap-2">
          <HardDrive size={32} className="text-gray-600 animate-pulse" />
          <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">
            Sin acciones operacionales previas en este expediente
          </p>
        </div>
      ) : (
        <div className="relative border-l border-white/10 ml-3 pl-6 space-y-6">
          {history.map((log, index) => {
            const theme = getActionTheme(log.action);
            const Icon = theme.icon;

            return (
              <div key={log.auditId || index} className="relative group">
                {/* Timeline node */}
                <div className={`absolute -left-[31px] top-1 w-6 h-6 rounded-full border flex items-center justify-center bg-black ${theme.bg}`}>
                  <Icon size={12} />
                </div>

                <div className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-3 hover:border-white/10 transition-colors text-left">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-[9px] font-mono bg-white/10 text-white/90 px-2 py-0.5 rounded-md mr-2 uppercase tracking-wide font-black">
                        {log.action}
                      </span>
                      <span className="text-[9px] font-mono text-gray-500 uppercase">ID: {log.auditId}</span>
                    </div>
                    <span className="text-[9px] font-mono text-gray-500">{formatDate(log.timestamp)}</span>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-white/90 font-medium">
                      {log.comment || 'Sin comentario especificado'}
                    </p>
                    {log.technicalObservations && (
                      <p className="text-[10px] font-mono text-gray-400">
                        <span className="text-gray-500">OBS. TÉCNICA:</span> {log.technicalObservations}
                      </p>
                    )}
                  </div>

                  <div className="border-t border-white/5 pt-2 flex flex-wrap items-center justify-between gap-2 text-[9px] font-mono text-gray-500">
                    <div>
                      <span className="uppercase text-gray-600 mr-1">Admin:</span>
                      <span className="text-white font-medium">{log.adminEmail || 'Sistema'}</span>
                    </div>
                    <div>
                      <span className="uppercase text-gray-600 mr-1">IP:</span>
                      <span className="text-white font-medium">{log.ip || 'N/D'}</span>
                    </div>
                    <div>
                      <span className="uppercase text-gray-600 mr-1">Versión Motor:</span>
                      <span className="text-[#39FF14] font-bold">{log.engineVersion}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
