import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { OperationalEvent } from '../../types';
import { Shield, Clock, MapPin, Activity, Check, X } from 'lucide-react';
import { motion } from 'motion/react';

interface ZenithOperationTimelineProps {
  operationId: string;
  onClose: () => void;
}

export default function ZenithOperationTimeline({ operationId, onClose }: ZenithOperationTimelineProps) {
  const [events, setEvents] = useState<OperationalEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'rides', operationId, 'events'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: OperationalEvent[] = [];
      snapshot.forEach((docSnap) => {
        fetched.push({ id: docSnap.id, ...docSnap.data() } as OperationalEvent);
      });
      setEvents(fetched);
      setLoading(false);
    }, (err) => {
      console.error('[ZENITH-TIMELINE-ERROR]', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [operationId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#0c0d0e] border border-[#39FF14]/30 rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl text-left max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#39FF14]/15 border border-[#39FF14]/40 flex items-center justify-center text-[#39FF14]">
              <Shield size={16} />
            </div>
            <div>
              <h3 className="text-sm font-mono font-black uppercase text-white tracking-wide">
                Trazabilidad Operacional Inmutable
              </h3>
              <p className="text-[9px] font-mono text-[#39FF14] uppercase tracking-widest">
                EVENT SOURCING AUDIT · OPERACIÓN {operationId.substring(0, 8)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Timeline Body */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {loading ? (
            <div className="py-12 text-center text-xs font-mono text-gray-500 animate-pulse">
              Cargando bitácora criptográfica de eventos...
            </div>
          ) : events.length === 0 ? (
            <div className="py-12 text-center text-xs font-mono text-gray-500">
              No se registran eventos operacionales previos.
            </div>
          ) : (
            <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10">
              {events.map((ev, idx) => (
                <div key={ev.id || idx} className="relative space-y-1">
                  {/* Marker Dot */}
                  <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-[#39FF14] shadow-glow" />

                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="font-bold text-[#39FF14] uppercase">
                      {ev.action}
                    </span>
                    <span className="text-gray-500">
                      {new Date(ev.timestamp).toLocaleTimeString('es-PE')}
                    </span>
                  </div>

                  <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-xs font-mono space-y-1">
                    <div className="flex items-center justify-between text-[9px] text-gray-400">
                      <span>Actor: <strong className="text-white">{ev.actorName}</strong> ({ev.actorRole})</span>
                      <span>GPS: {ev.lat?.toFixed(3)}, {ev.lng?.toFixed(3)}</span>
                    </div>
                    <p className="text-gray-200 text-[11px] leading-relaxed">
                      {ev.result}
                    </p>
                    {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                      <div className="text-[8px] text-gray-500 bg-black/30 p-1.5 rounded font-mono truncate">
                        {JSON.stringify(ev.metadata)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[9px] font-mono text-gray-500">
          <span>PRINCIPIO: "EL PEDIDO ESTÁ CONTROLADO DE PRINCIPIO A FIN"</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </motion.div>
    </div>
  );
}
