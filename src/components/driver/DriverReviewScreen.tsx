import React, { useState } from 'react';
import { DriverService } from '../../services/DriverService';
import { motion } from 'motion/react';
import { ShieldCheck, Hourglass, ShieldX, RefreshCw, AlertTriangle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { User, DocumentStatus } from '../../types';

interface DriverReviewScreenProps {
  user: User;
  onBackToDocs: () => void;
  onRefresh: () => void;
}

export default function DriverReviewScreen({ user, onBackToDocs, onRefresh }: DriverReviewScreenProps) {
  const [loading, setLoading] = useState(false);
  const [adminMode, setAdminMode] = useState(false);

  const status = user.driverProfile?.status || DocumentStatus.PENDING;

  const handleAdminAction = async (targetStatus: DocumentStatus) => {
    setLoading(true);
    try {
      await DriverService.adminUpdateStatus(user.uid, targetStatus);
      onRefresh();
    } catch (err) {
      console.error("[Admin Simulation Failed]:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-black/40 border border-white/5 backdrop-blur-md rounded-3xl p-6 sm:p-8 max-w-md mx-auto shadow-2xl text-center space-y-6">
      
      {/* Dynamic Header & Icon based on status */}
      {status === DocumentStatus.UNDER_REVIEW && (
        <div className="space-y-4">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center mx-auto animate-pulse">
            <Hourglass className="text-amber-400" size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight uppercase italic text-amber-400">
              Evaluación en Progreso
            </h2>
            <p className="text-xs text-gray-400 font-mono mt-1 uppercase tracking-wider">
              ESTADO DOCUMENTAL: UNDER_REVIEW
            </p>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed px-4">
            El Centro de Control de Zénith está revisando su documentación (Licencia, SOAT, Tarjeta de propiedad y fotografías). Esto toma de 10 a 15 minutos en horario operativo.
          </p>
        </div>
      )}

      {status === DocumentStatus.PENDING && (
        <div className="space-y-4">
          <div className="w-16 h-16 bg-gray-500/10 border border-gray-500/30 rounded-full flex items-center justify-center mx-auto">
            <Hourglass className="text-gray-400" size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight uppercase italic text-gray-400">
              Registro Incompleto
            </h2>
            <p className="text-xs text-gray-400 font-mono mt-1 uppercase tracking-wider">
              ESTADO DOCUMENTAL: PENDING
            </p>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed px-4">
            Aún quedan pendientes algunos documentos para que podamos iniciar la revisión de su cuenta.
          </p>
          <button
            onClick={onBackToDocs}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-mono uppercase text-white hover:bg-white/10 transition-all flex items-center gap-2 mx-auto"
          >
            <ArrowLeft size={14} /> Completar Documentos
          </button>
        </div>
      )}

      {(status === DocumentStatus.REJECTED || status === DocumentStatus.SUSPENDED) && (
        <div className="space-y-4">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto">
            <ShieldX className="text-red-400" size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight uppercase italic text-red-400">
              {status === DocumentStatus.REJECTED ? 'Documentación Rechazada' : 'Cuenta Suspendida'}
            </h2>
            <p className="text-xs text-gray-400 font-mono mt-1 uppercase tracking-wider">
              ESTADO DOCUMENTAL: {status}
            </p>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed px-4">
            {status === DocumentStatus.REJECTED 
              ? 'Uno o más documentos cargados no cumplen con las regulaciones de Trujillo. Por favor, vuelva a cargar las imágenes en alta resolución.' 
              : 'Su cuenta ha sido temporalmente inhabilitada por infringir normas operativas.'}
          </p>
          {status === DocumentStatus.REJECTED && (
            <button
              onClick={onBackToDocs}
              className="px-4 py-2 bg-[#39FF14] text-black rounded-xl text-xs font-mono font-black uppercase hover:shadow-glow transition-all flex items-center gap-2 mx-auto"
            >
              <RefreshCw size={14} /> Re-cargar Documentos
            </button>
          )}
        </div>
      )}

      {/* Manual Refresh / check */}
      <button
        onClick={onRefresh}
        className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-mono uppercase tracking-wider text-white transition-all flex items-center justify-center gap-2 cursor-pointer"
      >
        <RefreshCw size={14} />
        Verificar Estado Actual
      </button>

      {/* Zero Trust Sandbox Admin Bypass Simulator */}
      <div className="border-t border-white/5 pt-6 mt-4">
        <button
          onClick={() => setAdminMode(!adminMode)}
          className="text-[10px] font-mono text-[#39FF14]/70 hover:text-[#39FF14] transition-colors uppercase tracking-widest flex items-center gap-1.5 justify-center mx-auto cursor-pointer"
        >
          <CheckCircle2 size={12} />
          {adminMode ? 'Ocultar Consola de Simulación' : 'Consola de Control del Sandbox'}
        </button>

        {adminMode && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-neutral-900 border border-[#39FF14]/20 rounded-2xl p-4 mt-3 space-y-3"
          >
            <div className="flex items-center gap-1.5 justify-center text-amber-500 font-mono text-[9px] uppercase tracking-wider animate-pulse">
              <AlertTriangle size={12} />
              <span>Entorno de Pruebas Zénith</span>
            </div>
            <p className="text-[10px] text-gray-400">
              Como administrador o auditor en Trujillo, puede modificar instantáneamente el estado documental de este operador:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={loading}
                onClick={() => handleAdminAction(DocumentStatus.APPROVED)}
                className="py-2 bg-[#39FF14]/10 border border-[#39FF14]/30 text-[#39FF14] text-[10px] font-mono rounded-xl font-bold uppercase tracking-wider hover:bg-[#39FF14]/20 transition-all cursor-pointer"
              >
                Aprobar Operador
              </button>
              <button
                disabled={loading}
                onClick={() => handleAdminAction(DocumentStatus.REJECTED)}
                className="py-2 bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] font-mono rounded-xl font-bold uppercase tracking-wider hover:bg-red-500/20 transition-all cursor-pointer"
              >
                Rechazar Operador
              </button>
            </div>
          </motion.div>
        )}
      </div>

    </div>
  );
}
