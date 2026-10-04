import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { Camera as CapacitorCamera } from '@capacitor/camera';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Compass, Bell, Camera, Image, ArrowRight, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';

interface DriverPermissionsScreenProps {
  onSuccess: () => void;
}

export default function DriverPermissionsScreen({ onSuccess }: DriverPermissionsScreenProps) {
  const [gpsState, setGpsState] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [notifState, setNotifState] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [cameraState, setCameraState] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [galleryState, setGalleryState] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [error, setError] = useState<string | null>(null);

  const requestGPS = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const permission = await Geolocation.requestPermissions();
        const granted = permission.location === 'granted' || permission.coarseLocation === 'granted';
        if (!granted) throw new Error('Permiso GPS denegado en el dispositivo.');
        await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
        setGpsState('granted');
        setError(null);
        return;
      }
      if (!navigator.geolocation) throw new Error('La geolocalización no es compatible.');
      navigator.geolocation.getCurrentPosition(() => setGpsState('granted'), err => {
        setGpsState('denied');
        setError('Error de GPS: ' + err.message);
      }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    } catch (err) {
      setGpsState('denied');
      setError(err instanceof Error ? err.message : 'No se pudo habilitar el GPS.');
    }
  };

  const requestNotifications = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const permission = await LocalNotifications.requestPermissions();
        const granted = permission.display === 'granted';
        setNotifState(granted ? 'granted' : 'denied');
        if (!granted) setError('Permiso de notificaciones denegado en el dispositivo.');
        return;
      }
      if (!('Notification' in window)) { setNotifState('denied'); return; }
      const permission = await Notification.requestPermission();
      setNotifState(permission === 'granted' ? 'granted' : 'denied');
    } catch { setNotifState('denied'); }
  };

  const requestCamera = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const permission = await CapacitorCamera.requestPermissions({ permissions: ['camera', 'photos'] });
        const granted = permission.camera === 'granted' || permission.photos === 'granted';
        if (!granted) throw new Error('Permiso de cámara/galería denegado en el dispositivo.');
        setCameraState('granted');
        setGalleryState('granted');
        setError(null);
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Cámara no disponible.');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      setCameraState('granted');
    } catch (err) {
      setCameraState('denied');
      setError(err instanceof Error ? err.message : 'La cámara fue rechazada o no está disponible.');
    }
  };

  const requestGallery = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const permission = await CapacitorCamera.requestPermissions({ permissions: ['photos'] });
        if (permission.photos !== 'granted' && permission.photos !== 'limited') throw new Error('Permiso de galería denegado.');
      }
      setGalleryState('granted');
      setError(null);
    } catch (err) {
      setGalleryState('denied');
      setError(err instanceof Error ? err.message : 'No se pudo habilitar la galería.');
    }
  };

  const handleFinish = () => {
    if (gpsState !== 'granted') {
      setError('Se requiere el permiso de geolocalización (GPS) para continuar con el onboarding.');
      return;
    }
    onSuccess();
  };

  return (
    <div className="bg-black/40 border border-white/5 backdrop-blur-md rounded-3xl p-6 sm:p-8 max-w-md mx-auto shadow-2xl">
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <Compass className="text-[#39FF14]" size={24} />
        </div>
        <h2 className="text-2xl font-black tracking-tight uppercase italic text-[#39FF14]">
          Permisos de Operación
        </h2>
        <p className="text-xs text-gray-400 font-mono mt-1 uppercase tracking-wider">
          Habilite el acceso para desplegar el mapa táctico y recibir notificaciones
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-3">
        {/* GPS */}
        <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Compass size={20} className={gpsState === 'granted' ? 'text-[#39FF14]' : 'text-gray-400'} />
            <div>
              <h4 className="text-xs font-bold text-white uppercase">Geolocalización GPS</h4>
              <p className="text-[10px] text-gray-500 leading-tight">Obligatorio para rastrear tarifas de viaje en Trujillo</p>
            </div>
          </div>
          <button
            onClick={requestGPS}
            className={`px-3 py-1.5 rounded-xl font-mono text-[10px] font-black uppercase transition-all ${
              gpsState === 'granted'
                ? 'bg-[#39FF14]/10 border border-[#39FF14]/30 text-[#39FF14]'
                : gpsState === 'denied'
                ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                : 'bg-white/5 border border-white/10 text-white'
            }`}
          >
            {gpsState === 'granted' ? 'HABILITADO' : gpsState === 'denied' ? 'DENEGADO' : 'PERMITIR'}
          </button>
        </div>

        {/* Notifications */}
        <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Bell size={20} className={notifState === 'granted' ? 'text-[#39FF14]' : 'text-gray-400'} />
            <div>
              <h4 className="text-xs font-bold text-white uppercase">Notificaciones Push</h4>
              <p className="text-[10px] text-gray-500 leading-tight">Alertas de radar en tiempo real para nuevos viajes</p>
            </div>
          </div>
          <button
            onClick={requestNotifications}
            className={`px-3 py-1.5 rounded-xl font-mono text-[10px] font-black uppercase transition-all ${
              notifState === 'granted'
                ? 'bg-[#39FF14]/10 border border-[#39FF14]/30 text-[#39FF14]'
                : notifState === 'denied'
                ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                : 'bg-white/5 border border-white/10 text-white'
            }`}
          >
            {notifState === 'granted' ? 'HABILITADO' : notifState === 'denied' ? 'DENEGADO' : 'PERMITIR'}
          </button>
        </div>

        {/* Camera */}
        <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Camera size={20} className={cameraState === 'granted' ? 'text-[#39FF14]' : 'text-gray-400'} />
            <div>
              <h4 className="text-xs font-bold text-white uppercase">Acceso a la Cámara</h4>
              <p className="text-[10px] text-gray-500 leading-tight">Necesario para capturar fotos de licencias en vivo</p>
            </div>
          </div>
          <button
            onClick={requestCamera}
            className={`px-3 py-1.5 rounded-xl font-mono text-[10px] font-black uppercase transition-all ${
              cameraState === 'granted'
                ? 'bg-[#39FF14]/10 border border-[#39FF14]/30 text-[#39FF14]'
                : cameraState === 'denied'
                ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                : 'bg-white/5 border border-white/10 text-white'
            }`}
          >
            {cameraState === 'granted' ? 'HABILITADO' : cameraState === 'denied' ? 'DENEGADO' : 'PERMITIR'}
          </button>
        </div>

        {/* Gallery */}
        <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image size={20} className={galleryState === 'granted' ? 'text-[#39FF14]' : 'text-gray-400'} />
            <div>
              <h4 className="text-xs font-bold text-white uppercase">Galería de Fotos</h4>
              <p className="text-[10px] text-gray-500 leading-tight">Carga rápida de archivos JPG guardados previamente</p>
            </div>
          </div>
          <button
            onClick={requestGallery}
            className={`px-3 py-1.5 rounded-xl font-mono text-[10px] font-black uppercase transition-all ${
              galleryState === 'granted'
                ? 'bg-[#39FF14]/10 border border-[#39FF14]/30 text-[#39FF14]'
                : 'bg-white/5 border border-white/10 text-white'
            }`}
          >
            {galleryState === 'granted' ? 'HABILITADO' : 'PERMITIR'}
          </button>
        </div>
      </div>

      <button
        onClick={handleFinish}
        className="w-full mt-6 py-3 bg-[#39FF14] text-black font-black text-xs uppercase tracking-wider rounded-xl hover:shadow-glow transition-all flex items-center justify-center gap-2 cursor-pointer"
      >
        <span>Confirmar y Avanzar</span>
        <ArrowRight size={16} />
      </button>
    </div>
  );
}
