import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Ride, User, CustodyStatus, ProductType } from '../../types';
import { OperationalEngine } from '../../services/OperationalEngine';
import { Package, Clock, ShieldAlert, CheckCircle, AlertTriangle, ArrowRight, Trash2 } from 'lucide-react';

interface ZenithCustodyPanelProps {
  driverUser: User;
}

export default function ZenithCustodyPanel({ driverUser }: ZenithCustodyPanelProps) {
  const [custodyRides, setCustodyRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    // Listen to rides where driverId is current motorizado and custodyStatus is ACTIVE_CUSTODY
    const q = query(
      collection(db, 'rides'),
      where('driverId', '==', driverUser.uid),
      where('custodyStatus', '==', CustodyStatus.ACTIVE_CUSTODY)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rides: Ride[] = [];
      snapshot.forEach((d) => {
        rides.push({ id: d.id, ...d.data() } as Ride);
      });
      setCustodyRides(rides);
      setLoading(false);
    }, (err) => {
      console.error('[ZENITH-CUSTODY-PANEL-ERROR]', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [driverUser.uid]);

  const handleDisposeProduct = async (rideId: string, reason: string) => {
    const confirmDispose = window.confirm(
      '¿Desea registrar formalmente la disposición del producto tras la expiración del plazo de custodia Zénith?'
    );
    if (!confirmDispose) return;

    setActionLoading(rideId);
    try {
      await OperationalEngine.disposeCustodyProduct(
        rideId,
        {
          uid: driverUser.uid,
          name: driverUser.fullName || 'Motorizado Zénith',
          phone: driverUser.phone || '',
          plate: driverUser.driverProfile?.vehicle?.plate || 'MOTO-PRO',
          rating: 5
        },
        reason
      );
    } catch (err: unknown) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Error al registrar disposición.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="bg-[#0c0e10] border border-amber-500/30 rounded-3xl p-6 text-left space-y-4 shadow-xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <ShieldAlert size={16} />
          </div>
          <div>
            <h3 className="text-sm font-mono font-black uppercase text-white tracking-wide">
              Panel de Custodia Activa Zénith
            </h3>
            <p className="text-[9px] font-mono text-amber-400 uppercase tracking-widest">
              PRODUCTOS RETENIDOS TRAS ENTREGA NO REALIZADA
            </p>
          </div>
        </div>
        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
          {custodyRides.length} en custodia
        </span>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs font-mono text-gray-500 animate-pulse">
          Consultando registros de custodia...
        </div>
      ) : custodyRides.length === 0 ? (
        <div className="py-6 text-center text-xs font-mono text-gray-400 space-y-1">
          <CheckCircle size={24} className="mx-auto text-[#39FF14]/50 mb-2" />
          <p className="font-bold text-white uppercase">Sin Custodias Pendientes</p>
          <p className="text-[10px]">No mantiene paquetes retenidos bajo su responsabilidad física en este momento.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {custodyRides.map((ride) => {
            const isPerishable = ride.packageInfo?.type === ProductType.PERISHABLE;
            const expiresMs = ride.custodyExpiresAt ? new Date(ride.custodyExpiresAt).getTime() : 0;
            const now = Date.now();
            const isExpired = expiresMs > 0 && now >= expiresMs;
            const diffMinutes = Math.max(0, Math.floor((expiresMs - now) / (1000 * 60)));

            return (
              <div key={ride.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-mono font-bold text-white block">
                      {ride.packageInfo?.description || 'Paquete Operacional'}
                    </span>
                    <span className="text-[10px] font-mono text-gray-400">
                      ID: {ride.id?.substring(0, 8)} · Receptor: {ride.receptor?.name}
                    </span>
                  </div>

                  <span className={`text-[9px] font-mono px-2 py-0.5 rounded font-black uppercase ${
                    isExpired ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                    isPerishable ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                    'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  }`}>
                    {isExpired ? 'CUSTODIA EXPIRADA' : isPerishable ? 'PERECIBLE (60m)' : 'NO PERECIBLE (48h)'}
                  </span>
                </div>

                {/* Countdown & Status */}
                <div className="p-3 bg-black/40 rounded-xl flex items-center justify-between text-xs font-mono">
                  <span className="text-gray-400 flex items-center gap-1.5">
                    <Clock size={14} className={isExpired ? 'text-red-400' : 'text-amber-400'} />
                    {isExpired ? 'Plazo de guarda agotado' : 'Tiempo restante de guarda:'}
                  </span>
                  <span className="font-bold text-white">
                    {isExpired ? '0 min' : `${Math.floor(diffMinutes / 60)}h ${diffMinutes % 60}m`}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-2 pt-1">
                  {isExpired && (
                    <button
                      onClick={() => handleDisposeProduct(ride.id, 'Custodia expirada sin emisión de Pedido 2.')}
                      disabled={actionLoading === ride.id}
                      className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-mono font-bold uppercase flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 size={12} />
                      {actionLoading === ride.id ? 'Registrando...' : 'Disponer de Producto (Liberar Custodia)'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
