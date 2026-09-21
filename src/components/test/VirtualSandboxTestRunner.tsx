import React, { useState } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Play, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  User, 
  Car, 
  Repeat, 
  Activity,
  Terminal,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { isSandboxEmulatorActive } from '../../firebase/config';
import { 
  runVirtualSandboxLifecycle, 
  VirtualSandboxExecutionResult,
  VIRTUAL_SANDBOX_USERS 
} from '../../services/virtualSandboxService';

export const VirtualSandboxTestRunner: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<VirtualSandboxExecutionResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleExecute = async () => {
    setErrorMsg(null);
    setIsRunning(true);
    try {
      const res = await runVirtualSandboxLifecycle();
      setResult(res);
      if (!res.success && res.logs.length > 0) {
        const failedStep = res.logs.find(l => !l.success);
        if (failedStep) {
          setErrorMsg(failedStep.details || 'Fallo durante la ejecución de la prueba virtual.');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="bg-[#121418] border border-gray-800 rounded-xl p-6 text-white font-sans shadow-2xl space-y-6">
      {/* HEADER & SALVAGUARDA DE AISLAMIENTO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#39FF14] animate-pulse" />
            <h2 className="text-lg font-black tracking-wider uppercase text-white font-mono">
              ZÉNITH // Sandbox Virtual Suite
            </h2>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Laboratorio de prueba de ciclo de vida mínimo con identidades sintéticas y aceptación atómica.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isSandboxEmulatorActive ? (
            <div className="flex items-center gap-2 bg-emerald-950/60 border border-emerald-500/50 px-3 py-1.5 rounded-lg text-emerald-400 text-xs font-mono">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>EMULATOR ACTIVO (ISOLATED)</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-amber-950/40 border border-amber-500/40 px-3 py-1.5 rounded-lg text-amber-300 text-xs font-mono">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>MODO PRODUCCIÓN (BLOQUEADO)</span>
            </div>
          )}
        </div>
      </div>

      {/* ADVERTENCIA SI EL EMULADOR ESTÁ APAGADO */}
      {!isSandboxEmulatorActive && (
        <div className="bg-amber-950/30 border border-amber-500/40 rounded-lg p-4 flex items-start gap-3 text-amber-200 text-xs font-mono">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold uppercase tracking-wider text-amber-300">
              Salvaguarda de Protección Activa
            </p>
            <p className="text-gray-300">
              El flag <code className="text-[#39FF14] bg-black/40 px-1 py-0.5 rounded">VITE_USE_FIREBASE_EMULATOR</code> está inactivo (<code className="text-red-400">false</code>). 
              Cualquier intento de correr esta simulación será rechazado de inmediato por <code className="text-white bg-black/40 px-1 py-0.5 rounded">assertSandboxIsolated()</code> para proteger los registros de producción.
            </p>
          </div>
        </div>
      )}

      {/* ACTORES VIRTUALES INVOLUCRADOS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#1A1D24] border border-gray-800 rounded-lg p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <User className="w-3 h-3 text-blue-400" /> Cliente Virtual
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30">
              SINTÉTICO
            </span>
          </div>
          <p className="text-xs font-bold text-gray-200">{VIRTUAL_SANDBOX_USERS.CLIENT.fullName}</p>
          <p className="text-[10px] font-mono text-gray-400 truncate">{VIRTUAL_SANDBOX_USERS.CLIENT.uid}</p>
        </div>

        <div className="bg-[#1A1D24] border border-gray-800 rounded-lg p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Car className="w-3 h-3 text-[#39FF14]" /> Motorizado Virtual
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/30">
              SINTÉTICO
            </span>
          </div>
          <p className="text-xs font-bold text-gray-200">{VIRTUAL_SANDBOX_USERS.MOTORIZADO.fullName}</p>
          <p className="text-[10px] font-mono text-gray-400 truncate">{VIRTUAL_SANDBOX_USERS.MOTORIZADO.uid}</p>
        </div>

        <div className="bg-[#1A1D24] border border-gray-800 rounded-lg p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Repeat className="w-3 h-3 text-purple-400" /> Multirrol Virtual
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30">
              CLIENTE+MOTORIZADO
            </span>
          </div>
          <p className="text-xs font-bold text-gray-200">{VIRTUAL_SANDBOX_USERS.MULTIROLE_USER.fullName}</p>
          <p className="text-[10px] font-mono text-gray-400 truncate">{VIRTUAL_SANDBOX_USERS.MULTIROLE_USER.uid}</p>
        </div>
      </div>

      {/* BOTÓN DE DISPARO */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={handleExecute}
          disabled={isRunning}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-mono font-bold tracking-wider uppercase transition-all shadow-lg ${
            isRunning
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-[#39FF14] text-black hover:bg-[#32e012] active:scale-95'
          }`}
        >
          {isRunning ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>EJECUTANDO CICLO VIRTUAL...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>DISPARAR PRUEBA SANDBOX (1 CICLO)</span>
            </>
          )}
        </button>

        {result && (
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-gray-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> {result.totalDurationMs}ms
            </span>
            <span
              className={`px-2 py-0.5 rounded border font-bold ${
                result.success
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-red-500/20 text-red-400 border-red-500/40'
              }`}
            >
              {result.success ? 'CICLO VALIDADO' : 'CICLO RECHAZADO'}
            </span>
          </div>
        )}
      </div>

      {/* MENSAJE DE ERROR / SALVAGUARDA */}
      {errorMsg && (
        <div className="bg-red-950/40 border border-red-500/50 rounded-lg p-3 text-red-300 text-xs font-mono flex items-center gap-2">
          <XCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* LOG DE OPERACIONES */}
      {result && result.logs && (
        <div className="bg-black/60 border border-gray-800 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 border-b border-gray-800 pb-2">
            <span className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-[#39FF14]" />
              TRAZA DE EJECUCIÓN PASO A PASO
            </span>
            <span>ID ORDEN: {result.orderId || 'N/A'}</span>
          </div>

          <div className="space-y-1.5 pt-1">
            {result.logs.map((log, index) => (
              <div
                key={index}
                className="flex items-start justify-between text-[11px] font-mono gap-2 py-1 border-b border-gray-900 last:border-0"
              >
                <div className="flex items-start gap-2">
                  {log.success ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-bold text-gray-200">{log.step}:</span>{' '}
                    <span className="text-gray-400">{log.details}</span>
                  </div>
                </div>
                <span className="text-[9px] text-gray-500 whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
