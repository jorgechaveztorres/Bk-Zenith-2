/**
 * ZÉNITH — Panel admin: revisar recargas Yape de los motorizados.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { AdminApi } from '../../api/endpoints';
import { errorMessage } from '../../api/http';
import type { ApiTopup, TopupStatus } from '../../api/types';
import { Card, PrimaryButton, GhostButton, ErrorText, Row, soles } from './ui';

const TABS: { key: TopupStatus; label: string }[] = [
  { key: 'RECEIPT_SUBMITTED', label: 'Pendientes' },
  { key: 'CREDITED', label: 'Acreditadas' },
  { key: 'REJECTED', label: 'Rechazadas' },
];

export default function AdminTopups() {
  const [tab, setTab] = useState<TopupStatus>('RECEIPT_SUBMITTED');
  const [topups, setTopups] = useState<ApiTopup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async (status: TopupStatus) => {
    setLoading(true);
    setError('');
    try {
      setTopups(await AdminApi.topups(status));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(tab); }, [tab, load]);

  const credit = (topupId: string) => {
    setBusyId(topupId);
    setError('');
    AdminApi.creditTopup(topupId)
      .then(() => load(tab))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setBusyId(null));
  };

  const confirmReject = (topupId: string) => {
    if (!reason.trim()) {
      setError('Escribe el motivo del rechazo.');
      return;
    }
    setBusyId(topupId);
    setError('');
    AdminApi.rejectTopup(topupId, reason.trim())
      .then(() => {
        setRejecting(null);
        setReason('');
        return load(tab);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setBusyId(null));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-1 text-[9px] font-mono uppercase font-bold">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`py-2 rounded-lg border ${tab === t.key ? 'border-[#39FF14] text-[#39FF14] bg-[#39FF14]/10' : 'border-white/10 text-gray-400'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ErrorText text={error} />

      {loading ? (
        <p className="text-sm text-gray-500 font-mono">Cargando…</p>
      ) : topups.length === 0 ? (
        <Card><p className="text-sm text-gray-400 text-center">No hay recargas en este estado.</p></Card>
      ) : (
        <div className="space-y-3">
          {topups.map((t) => (
            <div key={t.id}>
              <Card>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{t.driverName}</p>
                    {t.driverPhone && <p className="text-xs text-gray-400">{t.driverPhone}</p>}
                  </div>
                  <p className="font-black text-lg text-[#39FF14] shrink-0">{soles(t.requestedAmount)}</p>
                </div>
                {t.operationNumber && <Row label="Nº de operación" value={t.operationNumber} />}
                <Row label="Pedida" value={new Date(t.createdAt).toLocaleString('es-PE')} />
                {t.status === 'REJECTED' && t.rejectionReason && (
                  <p className="text-xs text-red-400 font-mono">Motivo: {t.rejectionReason}</p>
                )}

                {t.status === 'RECEIPT_SUBMITTED' && (
                  rejecting === t.id ? (
                    <div className="space-y-2">
                      <input
                        autoFocus
                        className="w-full bg-white/5 border border-red-400/40 focus:border-red-400 rounded-xl px-3 py-2.5 text-sm outline-none"
                        placeholder="Motivo del rechazo (ej. no se ve el Yape)"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        maxLength={255}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <GhostButton onClick={() => { setRejecting(null); setReason(''); }}>Cancelar</GhostButton>
                        <PrimaryButton busy={busyId === t.id} className="!bg-red-500 hover:!bg-red-600" onClick={() => confirmReject(t.id)}>
                          Confirmar rechazo
                        </PrimaryButton>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <GhostButton busy={busyId === t.id} onClick={() => { setRejecting(t.id); setReason(''); setError(''); }}>
                        <X size={14} />Rechazar
                      </GhostButton>
                      <PrimaryButton busy={busyId === t.id} onClick={() => credit(t.id)}>
                        <Check size={14} />Acreditar
                      </PrimaryButton>
                    </div>
                  )
                )}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
