import React, { useState } from 'react';
import { DriverService } from '../../services/DriverService';
import { motion } from 'motion/react';
import { FileText, Camera, UploadCloud, Check, AlertTriangle, RefreshCw, Calendar, ClipboardList } from 'lucide-react';
import { User } from '../../types';

interface DriverDocumentsScreenProps {
  user: User;
  onSuccess: () => void;
}

export default function DriverDocumentsScreen({ user, onSuccess }: DriverDocumentsScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [licenseNumber, setLicenseNumber] = useState(user.driverProfile?.documentation?.licenseNumber || '');
  const [licenseExpiry, setLicenseExpiry] = useState(user.driverProfile?.documentation?.licenseExpiry || '');

  // File Upload states / previews
  const [driverPhoto, setDriverPhoto] = useState<File | null>(null);
  const [driverPhotoPreview, setDriverPhotoPreview] = useState(user.driverProfile?.documentation?.driverPhotoUrl || '');

  const [vehiclePhoto, setVehiclePhoto] = useState<File | null>(null);
  const [vehiclePhotoPreview, setVehiclePhotoPreview] = useState(user.driverProfile?.documentation?.vehiclePhotoUrl || '');

  const [licensePhoto, setLicensePhoto] = useState<File | null>(null);
  const [licensePhotoPreview, setLicensePhotoPreview] = useState(user.driverProfile?.documentation?.licensePhotoUrl || '');

  const [propertyCardPhoto, setPropertyCardPhoto] = useState<File | null>(null);
  const [propertyCardPreview, setPropertyCardPreview] = useState(user.driverProfile?.documentation?.propertyCardPhotoUrl || '');

  const [soatPhoto, setSoatPhoto] = useState<File | null>(null);
  const [soatPreview, setSoatPreview] = useState(user.driverProfile?.documentation?.soatPhotoUrl || '');

  const [uploadProgress, setUploadProgress] = useState<Record<string, string>>({});

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: (file: File) => void,
    setPreview: (url: string) => void
  ) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseNumber || !licenseExpiry) {
      setError('Por favor, ingrese el número de licencia y su fecha de vencimiento.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const urls: Record<string, string> = {
        driverPhotoUrl: driverPhotoPreview,
        vehiclePhotoUrl: vehiclePhotoPreview,
        licensePhotoUrl: licensePhotoPreview,
        propertyCardPhotoUrl: propertyCardPreview,
        soatPhotoUrl: soatPreview,
      };

      // Upload files that have been selected
      const uploads = [
        { key: 'driverPhotoUrl', file: driverPhoto, name: 'driver_photo.jpg' },
        { key: 'vehiclePhotoUrl', file: vehiclePhoto, name: 'vehicle_photo.jpg' },
        { key: 'licensePhotoUrl', file: licensePhoto, name: 'license_photo.jpg' },
        { key: 'propertyCardPhotoUrl', file: propertyCardPhoto, name: 'property_card_photo.jpg' },
        { key: 'soatPhotoUrl', file: soatPhoto, name: 'soat_photo.jpg' },
      ];

      for (const item of uploads) {
        if (item.file) {
          setUploadProgress(prev => ({ ...prev, [item.key]: 'Subiendo...' }));
          const downloadUrl = await DriverService.uploadDocumentImage(user.uid, item.name, item.file);
          urls[item.key] = downloadUrl;
          setUploadProgress(prev => ({ ...prev, [item.key]: 'Listo' }));
        }
      }

      await DriverService.updateDriverDocumentation(user.uid, {
        licenseNumber,
        licenseExpiry,
        driverPhotoUrl: urls.driverPhotoUrl,
        vehiclePhotoUrl: urls.vehiclePhotoUrl,
        licensePhotoUrl: urls.licensePhotoUrl,
        propertyCardPhotoUrl: urls.propertyCardPhotoUrl,
        soatPhotoUrl: urls.soatPhotoUrl,
      });

      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const uploadFields = [
    { label: 'Fotografía del Conductor', key: 'driverPhotoUrl', preview: driverPhotoPreview, setter: setDriverPhoto, previewSetter: setDriverPhotoPreview },
    { label: 'Fotografía del Vehículo', key: 'vehiclePhotoUrl', preview: vehiclePhotoPreview, setter: setVehiclePhoto, previewSetter: setVehiclePhotoPreview },
    { label: 'Fotografía de Licencia', key: 'licensePhotoUrl', preview: licensePhotoPreview, setter: setLicensePhoto, previewSetter: setLicensePhotoPreview },
    { label: 'Tarjeta de Propiedad', key: 'propertyCardPhotoUrl', preview: propertyCardPreview, setter: setPropertyCardPhoto, previewSetter: setPropertyCardPreview },
    { label: 'Certificado SOAT', key: 'soatPhotoUrl', preview: soatPreview, setter: setSoatPhoto, previewSetter: setSoatPreview },
  ];

  return (
    <div className="bg-black/40 border border-white/5 backdrop-blur-md rounded-3xl p-6 sm:p-8 max-w-lg mx-auto shadow-2xl">
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <ClipboardList className="text-[#39FF14]" size={24} />
        </div>
        <h2 className="text-2xl font-black tracking-tight uppercase italic text-[#39FF14]">
          Centro Documental
        </h2>
        <p className="text-xs text-gray-400 font-mono mt-1 uppercase tracking-wider">
          Suba imágenes legibles de sus credenciales operativas obligatorias
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl">
          {error}
        </div>
      )}

      <form onSubmit={uploadAndSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1">Número de Licencia</label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              <input
                type="text"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:border-[#39FF14]/50 outline-none transition-all placeholder-gray-600 uppercase"
                placeholder="Q12345678"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1">Fecha de Vencimiento</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              <input
                type="date"
                value={licenseExpiry}
                onChange={(e) => setLicenseExpiry(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:border-[#39FF14]/50 outline-none transition-all text-white"
                required
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-[10px] font-mono text-gray-400 uppercase tracking-wider">Carga de Documentación Requerida</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {uploadFields.map((field) => (
              <div key={field.key} className="bg-white/5 border border-white/5 rounded-2xl p-3 flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gray-200">{field.label}</span>
                  {uploadProgress[field.key] === 'Listo' || field.preview ? (
                    <span className="text-[9px] font-mono text-[#39FF14] bg-[#39FF14]/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                      <Check size={10} /> CARGADO
                    </span>
                  ) : uploadProgress[field.key] ? (
                    <span className="text-[9px] font-mono text-blue-400 animate-pulse">{uploadProgress[field.key]}</span>
                  ) : (
                    <span className="text-[9px] font-mono text-amber-500 flex items-center gap-1">
                      <AlertTriangle size={10} /> PENDIENTE
                    </span>
                  )}
                </div>

                <div className="relative h-28 bg-black/40 rounded-xl border border-dashed border-white/10 flex items-center justify-center overflow-hidden group">
                  {field.preview ? (
                    <img src={field.preview} alt={field.label} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-3">
                      <UploadCloud className="text-gray-500 mx-auto mb-1 group-hover:text-white transition-colors" size={24} />
                      <span className="text-[10px] text-gray-500 font-mono">Seleccionar archivo</span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, field.setter, field.previewSetter)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-[#39FF14] text-black font-black text-xs uppercase tracking-wider rounded-xl hover:shadow-glow transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {loading ? <RefreshCw className="animate-spin" size={16} /> : <Check size={16} />}
          Finalizar Carga y Enviar Revisión
        </button>
      </form>
    </div>
  );
}
