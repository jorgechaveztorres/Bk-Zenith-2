/**
 * ZÉNITH — Panel admin: aprobar/rechazar motorizados (APP-002).
 * Reemplaza el UPDATE a mano por phpMyAdmin. Solo lo ve users.is_admin = 1.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Check, X, Phone, Wallet, ImageOff } from 'lucide-react';
import { AdminApi, DriverDocumentsApi } from '../../api/endpoints';
import { errorMessage, fetchProtectedImageUrl } from '../../api/http';
import type { ApiDriverApplication, DriverReviewStatus } from '../../api/types';
import { Card, PrimaryButton, GhostButton, ErrorText, Row } from './ui';
import AdminTopups from './AdminTopups';

/** Miniaturas de licencia/vehículo: solo pide las fotos si realmente existen. */
function DriverPhotoThumbs({ driverId, hasLicense, hasVehicle }: { driverId: string; hasLicense: boolean; hasVehicle: boolean }) {
  const [urls, setUrls] = useState<{ license?: string; vehicle?: string }>({});

  useEffect(() => {
    let license: string | undefined;
    let vehicle: string | undefined;
    (async () => {
      if (hasLicense) license = await fetchProtectedImageUrl(DriverDocumentsApi.documentPath(driverId, 'license')).catch(() => undefined);
      if (hasVehicle) vehicle = await fetchProtectedImageUrl(DriverDocumentsApi.documentPath(driverId, 'vehicle')).catch(() => undefined);
      setUrls({ license, vehicle });
    })();
    return () => {
      if (license) URL.revokeObjectURL(license);
      if (vehicle) URL.revokeObjectURL(vehicle);
    };
  }, [driverId, hasLicense, hasVehicle]);

  if (!hasLicense && !hasVehicle) {
    return <p className="text-xs text-gray-500 flex items-center gap-1.5"><ImageOff size={13} />Todavía no sube sus fotos.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {hasLicense && (
        <div>
          <p className="text-[10px] text-gray-500 font-mono uppercase mb-1">Licencia</p>
          {urls.license ? <img src={urls.license} alt="Licencia" className="w-full h-24 object-cover rounded-lg border border-white/10" /> : <div className="w-full h-24 rounded-lg border border-white/10 animate-pulse bg-white/5" />}
        </div>
      )}
      {hasVehicle && (
        <div>
          <p className="text-[10px] text-gray-500 font-mono uppercase mb-1">Vehículo</p>
          {urls.vehicle ? <img src={urls.vehicle} alt="Vehículo" className="w-full h-24 object-cover rounded-lg border border-white/10" /> : <div className="w-full h-24 rounded-lg border border-white/10 animate-pulse bg-white/5" />}
        </div>
      )}
    </div>
  );
}

const TABS: { key: DriverReviewStatus; label: string }[] = [
  { key: 'PENDING', label: 'Pendientes' },
  { key: 'UNDER_REVIEW', label: 'En revisión' },
  { key: 'APPROVED', label: 'Aprobados' },
  { key: 'REJECTED', label: 'Rechazados' },
  { key: 'SUSPENDED', label: 'Suspendidos' },
];

export default function AdminHome() {
  const [section, setSection] = useState<'drivers' | 'topups'>('drivers');
  const [tab, setTab] = useState<DriverReviewStatus>('PENDING');
  const [drivers, setDrivers] = useState<ApiDriverApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async (status: DriverReviewStatus) => {
    setLoading(true);
    setError('');
    try {
      setDrivers(await AdminApi.drivers(status));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(tab); }, [tab, load]);

  const approve = (driverId: string) => {
    setBusyId(driverId);
    setError('');
    AdminApi.approveDriver(driverId)
      .then(() => load(tab))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setBusyId(null));
  };

  const confirmReject = (driverId: string) => {
    if (!reason.trim()) {
      setError('Escribe el motivo del rechazo.');
      return;
    }
    setBusyId(driverId);
    setError('');
    AdminApi.rejectDriver(driverId, reason.trim())
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
      <div className="flex items-center gap-2 text-[#39FF14]">
        <ShieldCheck size={22} />
        <h2 className="text-lg font-black uppercase italic">Panel admin</h2>
      </div>

      <div className="grid grid-cols-2 gap-1 text-[10px] font-mono uppercase font-bold">
        <button
          type="button"
          onClick={() => setSection('drivers')}
          className={`py-2 rounded-lg border ${section === 'drivers' ? 'border-[#39FF14] text-[#39FF14] bg-[#39FF14]/10' : 'border-white/10 text-gray-400'}`}
        >
          Motorizados
        </button>
        <button
          type="button"
          onClick={() => setSection('topups')}
          className={`py-2 rounded-lg border flex items-center justify-center gap-1.5 ${section === 'topups' ? 'border-[#39FF14] text-[#39FF14] bg-[#39FF14]/10' : 'border-white/10 text-gray-400'}`}
        >
          <Wallet size={12} />Recargas
        </button>
      </div>

      {section === 'topups' ? <AdminTopups /> : (
      <>
      <div className="grid grid-cols-5 gap-1 text-[9px] font-mono uppercase font-bold">
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
      ) : drivers.length === 0 ? (
        <Card><p className="text-sm text-gray-400 text-center">No hay motorizados en este estado.</p></Card>
      ) : (
        <div className="space-y-3">
          {drivers.map((d) => (
            <div key={d.userId}>
              <Card>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{d.fullName}</p>
                    {d.phone && (
                      <a href={`tel:${d.phone}`} className="text-xs text-gray-400 inline-flex items-center gap-1 hover:text-[#39FF14]">
                        <Phone size={11} />{d.phone}
                      </a>
                    )}
                  </div>
                  {d.isBlocked && <span className="text-[10px] font-mono uppercase text-red-400 border border-red-400/40 rounded-lg px-2 py-1 shrink-0">Bloqueado</span>}
                </div>

                {(d.vehicle.plate || d.vehicle.brand || d.vehicle.model) && (
                  <Row
                    label="Vehículo"
                    value={[d.vehicle.brand, d.vehicle.model, d.vehicle.color].filter(Boolean).join(' ') || '—'}
                  />
                )}
                {d.vehicle.plate && <Row label="Placa" value={d.vehicle.plate} />}
                {d.licenseNumber && <Row label="Licencia" value={`${d.licenseNumber}${d.licenseExpiry ? ` · vence ${new Date(d.licenseExpiry).toLocaleDateString('es-PE')}` : ''}`} />}
                {!d.vehicle.plate && !d.licenseNumber && (
                  <p className="text-xs text-gray-500">Sin datos de vehículo/licencia registrados todavía.</p>
                )}
                <Row label="Solicitó" value={new Date(d.createdAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })} />
                {(d.status === 'PENDING' || d.status === 'UNDER_REVIEW') && (
                  <DriverPhotoThumbs driverId={d.userId} hasLicense={d.hasLicensePhoto} hasVehicle={d.hasVehiclePhoto} />
                )}
                {d.status === 'REJECTED' && d.rejectionReason && (
                  <p className="text-xs text-red-400 font-mono">Motivo del rechazo: {d.rejectionReason}</p>
                )}

                {(d.status === 'PENDING' || d.status === 'UNDER_REVIEW') && (
                  rejecting === d.userId ? (
                    <div className="space-y-2">
                      <input
                        autoFocus
                        className="w-full bg-white/5 border border-red-400/40 focus:border-red-400 rounded-xl px-3 py-2.5 text-sm outline-none"
                        placeholder="Motivo del rechazo (ej. licencia vencida)"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        maxLength={255}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <GhostButton onClick={() => { setRejecting(null); setReason(''); }}>Cancelar</GhostButton>
                        <PrimaryButton busy={busyId === d.userId} className="!bg-red-500 hover:!bg-red-600" onClick={() => confirmReject(d.userId)}>
                          Confirmar rechazo
                        </PrimaryButton>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <GhostButton busy={busyId === d.userId} onClick={() => { setRejecting(d.userId); setReason(''); setError(''); }}>
                        <X size={14} />Rechazar
                      </GhostButton>
                      <PrimaryButton busy={busyId === d.userId} onClick={() => approve(d.userId)}>
                        <Check size={14} />Aprobar
                      </PrimaryButton>
                    </div>
                  )
                )}
              </Card>
            </div>
          ))}
        </div>
      )}
      </>
      )}
    </div>
  );
}
