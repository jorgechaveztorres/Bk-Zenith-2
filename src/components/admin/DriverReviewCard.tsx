import React, { useState } from 'react';
import { User as UserIcon, CheckCircle, XCircle, AlertTriangle, ShieldCheck, Trash2, RefreshCw, ClipboardList, Send } from 'lucide-react';
import { User, DocumentStatus } from '../../types';
import { DriverApprovalService } from '../../services/DriverApprovalService';

interface DriverReviewCardProps {
  driver: User;
  adminUser: User;
  onActionCompleted: () => void;
}

type AdminActionType = 'APPROVE' | 'REJECT' | 'REQUEST_DOCS' | 'SUSPEND' | 'REACTIVATE' | 'DELETE_RECORD' | null;

export default function DriverReviewCard({ driver, adminUser, onActionCompleted }: DriverReviewCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<AdminActionType>(null);
  const [comment, setComment] = useState('');
  const [technicalObservations, setTechnicalObservations] = useState('');

  const currentStatus = driver.driverProfile?.status || DocumentStatus.PENDING;

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAction) return;

    // Aprobación es la única que no exige comentario obligatorio en la UI (pero le ponemos uno por defecto en el servicio)
    if (activeAction !== 'APPROVE' && !comment.trim()) {
      setError('El Comentario/Motivo es obligatorio para esta acción.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        driverId: driver.uid,
        adminUid: adminUser.uid,
        adminEmail: adminUser.email,
        comment: comment.trim(),
        technicalObservations: technicalObservations.trim()
      };

      switch (activeAction) {
        case 'APPROVE':
          await DriverApprovalService.approveDriver(payload, currentStatus);
          break;
        case 'REJECT':
          await DriverApprovalService.rejectDriver(payload, currentStatus);
          break;
        case 'REQUEST_DOCS':
          await DriverApprovalService.requestDocuments(payload, currentStatus);
          break;
        case 'SUSPEND':
          await DriverApprovalService.suspendDriver(payload, currentStatus);
          break;
        case 'REACTIVATE':
          await DriverApprovalService.reactivateDriver(payload, currentStatus);
          break;
        case 'DELETE_RECORD':
          await DriverApprovalService.deleteDriverRecord(payload, currentStatus);
          break;
        default:
          break;
      }

      // Reset form states
      setComment('');
      setTechnicalObservations('');
      setActiveAction(null);
      onActionCompleted();
    } catch (err: any) {
      console.error('[DriverReviewCard] Error ejecutando acción:', err);
      setError(err.message || 'Error al procesar la acción administrativa.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: DocumentStatus) => {
    switch (status) {
      case DocumentStatus.APPROVED:
        return <span className="px-2.5 py-1 text-[8px] font-mono font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md">APROBADO</span>;
      case DocumentStatus.REJECTED:
        return <span className="px-2.5 py-1 text-[8px] font-mono font-black uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20 rounded-md">RECHAZADO</span>;
      case DocumentStatus.SUSPENDED:
        return <span className="px-2.5 py-1 text-[8px] font-mono font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md">SUSPENDIDO</span>;
      case DocumentStatus.UNDER_REVIEW:
        return <span className="px-2.5 py-1 text-[8px] font-mono font-black uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-md animate-pulse">EN REVISIÓN</span>;
      default:
        return <span className="px-2.5 py-1 text-[8px] font-mono font-black uppercase tracking-wider bg-white/5 text-gray-400 border border-white/5 rounded-md">PENDIENTE</span>;
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 text-left space-y-6" id="driver_review_card">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-[#39FF14]/10 rounded-2xl flex items-center justify-center border border-[#39FF14]/20">
            <UserIcon className="text-[#39FF14]" size={28} />
          </div>
          <div>
            <h4 className="text-xl font-black uppercase italic tracking-tight text-white">{driver.fullName}</h4>
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">{driver.email} | {driver.phone || 'Nro. Celular N/D'}</p>
          </div>
        </div>
        <div>
          {getStatusBadge(currentStatus)}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-black/30 p-4 rounded-2xl border border-white/5">
        <div className="space-y-1">
          <p className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">Vehículo Oficial</p>
          <p className="text-sm font-bold text-white uppercase italic">
            {driver.driverProfile?.vehicle?.brand || 'S/M'} {driver.driverProfile?.vehicle?.model || ''}
          </p>
          <p className="text-[10px] font-mono text-gray-400 uppercase">
            Placa: <span className="text-[#39FF14] font-black">{driver.driverProfile?.vehicle?.plate || 'N/D'}</span>
          </p>
        </div>

        <div className="space-y-1 border-t sm:border-t-0 sm:border-l border-white/5 pt-3 sm:pt-0 sm:pl-4">
          <p className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">Categoría de Flota</p>
          <p className="text-xs font-bold text-white uppercase italic">
            Zénith {driver.driverProfile?.vehicle?.category || 'PRO'}
          </p>
          <p className="text-[10px] font-mono text-gray-400 uppercase">
            Color: {driver.driverProfile?.vehicle?.color || 'N/D'} | Año: {driver.driverProfile?.vehicle?.year || 'N/D'}
          </p>
        </div>
      </div>

      {/* Admin Quick Action Panel */}
      <div className="space-y-3">
        <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Controles de Validación Administrativa</p>
        
        <div className="flex flex-wrap gap-2">
          {currentStatus !== DocumentStatus.APPROVED && (
            <button
              onClick={() => { setActiveAction('APPROVE'); setError(null); }}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-mono text-[10px] font-black uppercase tracking-wider rounded-xl transition-colors flex items-center gap-1.5"
            >
              <CheckCircle size={14} /> Aprobar Operador
            </button>
          )}

          {currentStatus !== DocumentStatus.REJECTED && (
            <button
              onClick={() => { setActiveAction('REJECT'); setError(null); }}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40 font-mono text-[10px] font-black uppercase tracking-wider rounded-xl transition-colors flex items-center gap-1.5"
            >
              <XCircle size={14} /> Rechazar
            </button>
          )}

          <button
            onClick={() => { setActiveAction('REQUEST_DOCS'); setError(null); }}
            className="px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 hover:border-cyan-500/40 font-mono text-[10px] font-black uppercase tracking-wider rounded-xl transition-colors flex items-center gap-1.5"
          >
            <ClipboardList size={14} /> Solicitar Documentos
          </button>

          {currentStatus === DocumentStatus.APPROVED && (
            <button
              onClick={() => { setActiveAction('SUSPEND'); setError(null); }}
              className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 hover:border-amber-500/40 font-mono text-[10px] font-black uppercase tracking-wider rounded-xl transition-colors flex items-center gap-1.5"
            >
              <AlertTriangle size={14} /> Suspender
            </button>
          )}

          {currentStatus === DocumentStatus.SUSPENDED && (
            <button
              onClick={() => { setActiveAction('REACTIVATE'); setError(null); }}
              className="px-4 py-2 bg-[#39FF14]/10 hover:bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/20 hover:border-[#39FF14]/40 font-mono text-[10px] font-black uppercase tracking-wider rounded-xl transition-colors flex items-center gap-1.5"
            >
              <RefreshCw size={14} /> Reactivar Cuenta
            </button>
          )}

          <button
            onClick={() => { setActiveAction('DELETE_RECORD'); setError(null); }}
            className="px-4 py-2 bg-rose-950/20 hover:bg-rose-950/40 text-rose-400 border border-rose-900/30 hover:border-rose-900/60 font-mono text-[10px] font-black uppercase tracking-wider rounded-xl transition-colors flex items-center gap-1.5 ml-auto"
          >
            <Trash2 size={14} /> Eliminar Registro
          </button>
        </div>
      </div>

      {/* Detailed Form Overlay depending on the action selected */}
      {activeAction && (
        <form onSubmit={handleActionSubmit} className="border border-[#39FF14]/20 bg-black/40 p-6 rounded-2xl space-y-4 animate-fade-in text-left">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <h5 className="font-mono text-xs font-black uppercase tracking-wider text-white">
              Confirmación de acción: <span className="text-[#39FF14]">{activeAction}</span>
            </h5>
            <button
              type="button"
              onClick={() => setActiveAction(null)}
              className="text-gray-500 hover:text-white font-mono text-[9px] uppercase tracking-widest"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px] font-mono text-gray-500">
            <div>
              <span className="uppercase text-gray-600">Administrador Responsable:</span>
              <p className="text-white font-bold">{adminUser.email}</p>
            </div>
            <div>
              <span className="uppercase text-gray-600">Fecha de Validación:</span>
              <p className="text-white font-bold">{new Date().toLocaleString('es-PE')}</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block font-mono text-[10px] uppercase tracking-wider text-gray-400">
              Comentario / Motivo de Acción {activeAction !== 'APPROVE' && <span className="text-red-500">*</span>}
            </label>
            <textarea
              required={activeAction !== 'APPROVE'}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={activeAction === 'APPROVE' ? 'Observaciones generales del expediente (opcional)...' : 'Especifique el motivo claro, detallado y obligatorio...'}
              className="w-full h-20 bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#39FF14] transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="block font-mono text-[10px] uppercase tracking-wider text-gray-400">Observaciones Técnicas (Opcional)</label>
            <input
              type="text"
              value={technicalObservations}
              onChange={(e) => setTechnicalObservations(e.target.value)}
              placeholder="Ej. Sello SOAT verificado contra la base de datos de APESEG..."
              className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#39FF14] transition-colors"
            />
          </div>

          {error && (
            <p className="text-[10px] font-mono text-red-500 uppercase font-black tracking-wider animate-pulse">
              FALLA: {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#39FF14] hover:bg-[#34e512] disabled:opacity-50 text-black font-mono text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <Send size={12} /> Confirmar Acción y Registrar en AuditEngine
          </button>
        </form>
      )}
    </div>
  );
}
