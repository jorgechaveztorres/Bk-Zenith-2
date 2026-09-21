import React from 'react';
import { Check, Clock, Radio, ArrowRight } from 'lucide-react';
import { OperationStatus, OPERATION_STATUS_FLOW } from '../../services/operationalOrdersService';

interface OperationStatusStepperProps {
  currentStatus: OperationStatus;
  className?: string;
}

const STATUS_METADATA: Record<OperationStatus, { label: string; description: string }> = {
  CREADO: {
    label: 'Creado',
    description: 'Ruta y coordenadas calculadas'
  },
  PUBLICADO: {
    label: 'Publicado',
    description: 'En bolsa disponible para motorizados'
  },
  ASIGNADO: {
    label: 'Asignado',
    description: 'Tomado por un operador'
  },
  ACEPTADO: {
    label: 'Aceptado',
    description: 'Confirmado por el motorizado'
  },
  ACTIVO: {
    label: 'Activo',
    description: 'En curso / desplazamiento'
  }
};

export const OperationStatusStepper: React.FC<OperationStatusStepperProps> = ({
  currentStatus,
  className = ''
}) => {
  const currentIndex = OPERATION_STATUS_FLOW.indexOf(currentStatus);

  return (
    <div className={`w-full bg-black/60 border border-white/10 p-4 rounded-2xl ${className}`}>
      <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
        <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400">
          Máquina de Estados de la Operación
        </span>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded font-black bg-[#39FF14]/15 text-[#39FF14] border border-[#39FF14]/30">
          ESTADO ACTUAL: {currentStatus}
        </span>
      </div>

      {/* Stepper horizontal responsivo */}
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {OPERATION_STATUS_FLOW.map((status, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isPending = index > currentIndex;
          const meta = STATUS_METADATA[status];

          return (
            <div
              key={status}
              className={`relative flex flex-col items-center text-center p-2 rounded-xl transition-all ${
                isCurrent
                  ? 'bg-[#39FF14]/15 border border-[#39FF14]/60 shadow-glow'
                  : isCompleted
                  ? 'bg-white/5 border border-[#39FF14]/30 opacity-90'
                  : 'bg-white/[0.02] border border-white/5 opacity-40'
              }`}
            >
              {/* Indicador circular de paso */}
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-black mb-1.5 transition-all ${
                  isCurrent
                    ? 'bg-[#39FF14] text-black ring-2 ring-[#39FF14]/50 animate-pulse'
                    : isCompleted
                    ? 'bg-[#39FF14]/30 text-[#39FF14] border border-[#39FF14]/60'
                    : 'bg-white/10 text-gray-400'
                }`}
              >
                {isCompleted ? (
                  <Check size={12} className="stroke-[3]" />
                ) : isCurrent ? (
                  <Radio size={12} className="animate-spin" />
                ) : (
                  index + 1
                )}
              </div>

              {/* Nombre del estado */}
              <span
                className={`text-[10px] sm:text-[11px] font-mono font-bold tracking-tight uppercase leading-tight truncate w-full ${
                  isCurrent
                    ? 'text-[#39FF14]'
                    : isCompleted
                    ? 'text-gray-200'
                    : 'text-gray-500'
                }`}
              >
                {meta.label}
              </span>

              {/* Descripción breve */}
              <span className="hidden sm:block text-[8px] font-mono text-gray-400 leading-tight mt-0.5 truncate w-full">
                {meta.description}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
