import React, { useState } from 'react';
import { User, Car, FileText, CreditCard, ShieldCheck, Eye, ZoomIn, AlertCircle } from 'lucide-react';
import { DriverDocumentation, DriverVehicle } from '../../types';

interface DriverDocumentsViewerProps {
  documentation: DriverDocumentation;
  vehicle: DriverVehicle;
}

export default function DriverDocumentsViewer({ documentation, vehicle }: DriverDocumentsViewerProps) {
  const [activeImage, setActiveImage] = useState<{ url: string; label: string } | null>(null);

  const docsList = [
    {
      id: 'driverPhoto',
      label: 'Fotografía del Conductor',
      url: documentation.driverPhotoUrl,
      icon: User,
      description: 'Imagen de rostro frontal de alta definición, sin accesorios'
    },
    {
      id: 'vehiclePhoto',
      label: 'Fotografía del Vehículo',
      url: documentation.vehiclePhotoUrl,
      icon: Car,
      description: `Vista de placa y carrocería. Placa registrada: ${vehicle.plate || 'N/A'}`
    },
    {
      id: 'licensePhoto',
      label: 'Licencia de Conducir',
      url: documentation.licensePhotoUrl,
      icon: CreditCard,
      description: `Nro. Licencia: ${documentation.licenseNumber || 'N/A'} (Expira: ${documentation.licenseExpiry || 'N/A'})`
    },
    {
      id: 'propertyCardPhoto',
      label: 'Tarjeta de Propiedad',
      url: documentation.propertyCardPhotoUrl,
      icon: FileText,
      description: `Título de propiedad vehicular y SUNARP oficial`
    },
    {
      id: 'soatPhoto',
      label: 'SOAT Digital',
      url: documentation.soatPhotoUrl,
      icon: ShieldCheck,
      description: 'Seguro Obligatorio de Accidentes de Tránsito vigente'
    }
  ];

  return (
    <div className="space-y-6" id="driver_documents_viewer">
      <div className="border-l-2 border-[#39FF14] pl-4">
        <h4 className="text-sm font-black uppercase tracking-wider text-white">Centro de Revisión Documental</h4>
        <p className="text-[10px] font-mono text-gray-500 uppercase">Verificación visual de credenciales oficiales</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {docsList.map((doc) => (
          <div 
            key={doc.id} 
            className="bg-black/30 border border-white/5 rounded-2xl p-4 flex flex-col justify-between hover:border-white/10 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-400">
                <doc.icon size={20} className="text-[#39FF14]" />
              </div>
              <div className="space-y-0.5 text-left">
                <p className="text-xs font-bold text-white uppercase">{doc.label}</p>
                <p className="text-[10px] font-mono text-gray-500 max-w-[200px] leading-tight">
                  {doc.description}
                </p>
              </div>
            </div>

            <div className="mt-4">
              {doc.url ? (
                <div className="relative group rounded-xl overflow-hidden aspect-video bg-black border border-white/5">
                  <img 
                    src={doc.url} 
                    alt={doc.label} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => setActiveImage({ url: doc.url!, label: doc.label })}
                      className="p-2.5 bg-[#39FF14] text-black rounded-full hover:scale-110 active:scale-95 transition-transform"
                      title="Zoom Visual"
                    >
                      <ZoomIn size={16} />
                    </button>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"
                      title="Abrir en pestaña nueva"
                    >
                      <Eye size={16} />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="bg-red-500/5 border border-dashed border-red-500/20 rounded-xl p-6 flex flex-col items-center justify-center text-center gap-1.5">
                  <AlertCircle size={20} className="text-red-500 animate-pulse" />
                  <p className="text-[9px] font-mono text-red-400 uppercase tracking-wider">Documento Pendiente de Carga</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox Modal for HD Inspection */}
      {activeImage && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-6">
          <div className="absolute top-6 right-6">
            <button
              onClick={() => setActiveImage(null)}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-mono text-xs uppercase rounded-xl transition-colors"
            >
              Cerrar Vista
            </button>
          </div>
          <div className="max-w-4xl max-h-[80vh] w-full h-full flex items-center justify-center">
            <img 
              src={activeImage.url} 
              alt={activeImage.label} 
              className="max-w-full max-h-full object-contain rounded-xl border border-white/10 shadow-glow"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="mt-4 text-center">
            <h5 className="text-sm font-black uppercase text-white tracking-widest">{activeImage.label}</h5>
            <p className="text-[10px] font-mono text-gray-500 uppercase mt-1">Inspección de Seguridad Digital</p>
          </div>
        </div>
      )}
    </div>
  );
}
