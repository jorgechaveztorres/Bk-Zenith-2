/**
 * ZÉNITH — Datos de vehículo/licencia + fotos del motorizado (APP-002).
 * Al enviarlos, el estado pasa a UNDER_REVIEW para que el admin lo revise con evidencia.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Upload, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { DriverDocumentsApi } from '../../api/endpoints';
import { errorMessage, fetchProtectedImageUrl } from '../../api/http';
import type { ApiDriverProfile } from '../../api/types';
import { Card, PrimaryButton, ErrorText, Row } from './ui';

const STATUS_BADGE: Record<string, { text: string; icon: React.ReactNode; className: string }> = {
  PENDING: { text: 'Sin enviar', icon: <FileText size={13} />, className: 'text-gray-400 border-white/10' },
  UNDER_REVIEW: { text: 'En revisión', icon: <Clock size={13} />, className: 'text-yellow-400 border-yellow-400/40' },
  APPROVED: { text: 'Aprobado', icon: <CheckCircle2 size={13} />, className: 'text-[#39FF14] border-[#39FF14]/40' },
  REJECTED: { text: 'Rechazado', icon: <XCircle size={13} />, className: 'text-red-400 border-red-400/40' },
  SUSPENDED: { text: 'Suspendido', icon: <XCircle size={13} />, className: 'text-red-400 border-red-400/40' },
};

export default function MyDocuments() {
  const [profile, setProfile] = useState<ApiDriverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [licensePreview, setLicensePreview] = useState<string | null>(null);
  const [vehiclePreview, setVehiclePreview] = useState<string | null>(null);
  const licenseFile = useRef<File | null>(null);
  const vehicleFile = useRef<File | null>(null);

  const [form, setForm] = useState({
    vehicleCategory: 'moto', vehiclePlate: '', vehicleBrand: '', vehicleModel: '',
    vehicleYear: '', vehicleColor: '', licenseNumber: '', licenseExpiry: '', yapePlinPhone: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const p = await DriverDocumentsApi.myProfile();
      setProfile(p);
      setForm({
        vehicleCategory: p.vehicle.category || 'moto',
        vehiclePlate: p.vehicle.plate || '',
        vehicleBrand: p.vehicle.brand || '',
        vehicleModel: p.vehicle.model || '',
        vehicleYear: p.vehicle.year ? String(p.vehicle.year) : '',
        vehicleColor: p.vehicle.color || '',
        licenseNumber: p.licenseNumber || '',
        licenseExpiry: p.licenseExpiry ? p.licenseExpiry.slice(0, 10) : '',
        yapePlinPhone: p.yapePlinPhone || '',
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const onFile = (which: 'license' | 'vehicle') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    const ref = which === 'license' ? licenseFile : vehicleFile;
    const setPreview = which === 'license' ? setLicensePreview : setVehiclePreview;
    ref.current = f;
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const submit = () => {
    if (!form.vehiclePlate.trim()) return setError('Escribe la placa de tu vehículo.');
    if (!form.licenseNumber.trim()) return setError('Escribe el número de tu licencia/brevete.');
    if (!licenseFile.current && !profile?.hasLicensePhoto) return setError('Sube la foto de tu licencia/brevete.');
    if (!vehicleFile.current && !profile?.hasVehiclePhoto) return setError('Sube una foto de tu vehículo con la placa visible.');
    setBusy(true);
    setError('');
    DriverDocumentsApi.submit({ ...form, licensePhoto: licenseFile.current, vehiclePhoto: vehicleFile.current })
      .then((p) => {
        setProfile(p);
        licenseFile.current = null;
        vehicleFile.current = null;
        setLicensePreview(null);
        setVehiclePreview(null);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setBusy(false));
  };

  const [savedThumb, setSavedThumb] = useState<{ license?: string; vehicle?: string }>({});
  useEffect(() => {
    if (!profile) return;
    let licenseUrl: string | undefined;
    let vehicleUrl: string | undefined;
    (async () => {
      if (profile.hasLicensePhoto) licenseUrl = await fetchProtectedImageUrl(DriverDocumentsApi.documentPath(profile.userId, 'license')).catch(() => undefined);
      if (profile.hasVehiclePhoto) vehicleUrl = await fetchProtectedImageUrl(DriverDocumentsApi.documentPath(profile.userId, 'vehicle')).catch(() => undefined);
      setSavedThumb({ license: licenseUrl, vehicle: vehicleUrl });
    })();
    return () => {
      if (licenseUrl) URL.revokeObjectURL(licenseUrl);
      if (vehicleUrl) URL.revokeObjectURL(vehicleUrl);
    };
  }, [profile?.userId, profile?.hasLicensePhoto, profile?.hasVehiclePhoto]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <p className="text-sm text-gray-500 font-mono">Cargando…</p>;
  const badge = profile ? STATUS_BADGE[profile.status] : null;
  const canEdit = profile?.status !== 'APPROVED';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[#39FF14]">
          <FileText size={22} />
          <h2 className="text-lg font-black uppercase italic">Mis documentos</h2>
        </div>
        {badge && (
          <span className={`text-[10px] font-mono uppercase border rounded-lg px-2 py-1 flex items-center gap-1 ${badge.className}`}>
            {badge.icon}{badge.text}
          </span>
        )}
      </div>

      <ErrorText text={error} />

      {profile?.status === 'REJECTED' && profile.rejectionReason && (
        <Card className="border-red-500/40">
          <p className="text-xs text-red-400 font-mono">Motivo del rechazo: {profile.rejectionReason}</p>
          <p className="text-xs text-gray-400">Corrige lo que haga falta y vuelve a enviar.</p>
        </Card>
      )}

      {profile?.status === 'UNDER_REVIEW' && (
        <Card><p className="text-sm text-gray-400 text-center">Un admin está revisando tus documentos.</p></Card>
      )}

      <Card>
        <p className="text-sm font-bold">Vehículo</p>
        <div className="grid grid-cols-2 gap-2">
          <input disabled={!canEdit} className="col-span-2 bg-white/5 border border-white/10 focus:border-[#39FF14] rounded-xl px-3 py-2.5 text-sm outline-none disabled:opacity-60" placeholder="Placa" value={form.vehiclePlate} onChange={(e) => setForm((f) => ({ ...f, vehiclePlate: e.target.value.toUpperCase() }))} maxLength={15} />
          <input disabled={!canEdit} className="bg-white/5 border border-white/10 focus:border-[#39FF14] rounded-xl px-3 py-2.5 text-sm outline-none disabled:opacity-60" placeholder="Marca" value={form.vehicleBrand} onChange={(e) => setForm((f) => ({ ...f, vehicleBrand: e.target.value }))} maxLength={60} />
          <input disabled={!canEdit} className="bg-white/5 border border-white/10 focus:border-[#39FF14] rounded-xl px-3 py-2.5 text-sm outline-none disabled:opacity-60" placeholder="Modelo" value={form.vehicleModel} onChange={(e) => setForm((f) => ({ ...f, vehicleModel: e.target.value }))} maxLength={60} />
          <input disabled={!canEdit} className="bg-white/5 border border-white/10 focus:border-[#39FF14] rounded-xl px-3 py-2.5 text-sm outline-none disabled:opacity-60" placeholder="Año" inputMode="numeric" value={form.vehicleYear} onChange={(e) => setForm((f) => ({ ...f, vehicleYear: e.target.value }))} maxLength={4} />
          <input disabled={!canEdit} className="bg-white/5 border border-white/10 focus:border-[#39FF14] rounded-xl px-3 py-2.5 text-sm outline-none disabled:opacity-60" placeholder="Color" value={form.vehicleColor} onChange={(e) => setForm((f) => ({ ...f, vehicleColor: e.target.value }))} maxLength={30} />
        </div>

        <p className="text-xs text-gray-400">Foto del vehículo con la placa visible</p>
        {(vehiclePreview || savedThumb.vehicle) && (
          <img src={vehiclePreview || savedThumb.vehicle} alt="Foto del vehículo" className="w-full max-h-40 object-cover rounded-xl border border-white/10" />
        )}
        {canEdit && (
          <label className="flex items-center justify-center gap-2 border border-dashed border-white/20 rounded-xl py-3 text-xs text-gray-400 cursor-pointer hover:border-[#39FF14]/50">
            <Upload size={14} />{vehicleFile.current ? vehicleFile.current.name : 'Elegir foto'}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile('vehicle')} />
          </label>
        )}
      </Card>

      <Card>
        <p className="text-sm font-bold">Licencia / brevete</p>
        <input disabled={!canEdit} className="w-full bg-white/5 border border-white/10 focus:border-[#39FF14] rounded-xl px-3 py-2.5 text-sm outline-none disabled:opacity-60" placeholder="Número de licencia" value={form.licenseNumber} onChange={(e) => setForm((f) => ({ ...f, licenseNumber: e.target.value }))} maxLength={30} />
        <Row label="Vence" value={
          <input disabled={!canEdit} type="date" className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs outline-none disabled:opacity-60" value={form.licenseExpiry} onChange={(e) => setForm((f) => ({ ...f, licenseExpiry: e.target.value }))} />
        } />

        <p className="text-xs text-gray-400">Foto de la licencia/brevete</p>
        {(licensePreview || savedThumb.license) && (
          <img src={licensePreview || savedThumb.license} alt="Foto de la licencia" className="w-full max-h-40 object-cover rounded-xl border border-white/10" />
        )}
        {canEdit && (
          <label className="flex items-center justify-center gap-2 border border-dashed border-white/20 rounded-xl py-3 text-xs text-gray-400 cursor-pointer hover:border-[#39FF14]/50">
            <Upload size={14} />{licenseFile.current ? licenseFile.current.name : 'Elegir foto'}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile('license')} />
          </label>
        )}
      </Card>

      <Card>
        <p className="text-sm font-bold">Yape / Plin</p>
        <input disabled={!canEdit} className="w-full bg-white/5 border border-white/10 focus:border-[#39FF14] rounded-xl px-3 py-2.5 text-sm outline-none disabled:opacity-60" placeholder="Número de celular para recibir recargas" value={form.yapePlinPhone} onChange={(e) => setForm((f) => ({ ...f, yapePlinPhone: e.target.value }))} maxLength={20} />
      </Card>

      {canEdit && <PrimaryButton busy={busy} onClick={submit}>Enviar a revisión</PrimaryButton>}
    </div>
  );
}
