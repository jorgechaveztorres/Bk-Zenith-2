import React, { useState } from 'react';
import { Ride } from '../types';
import { Share2, Copy, Check, MessageSquare, Twitter, Compass } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ShareRideProps {
  ride: Ride;
}

export default function ShareRide({ ride }: ShareRideProps) {
  const [copied, setCopied] = useState(false);

  // Generate secure public tracking link (simulated)
  const appBaseUrl = window.location.origin;
  const secureTrackUrl = `${appBaseUrl}/track/${ride.id}`;

  const etaMin = ride.duration ? Math.ceil(ride.duration) : 12;
  const shareMessage = `🔒 [ZÉNITH TRACKING SECURE]
Sigue mi viaje en tiempo real de forma segura.
📍 Origen: ${ride.origin.address}
🏁 Destino: ${ride.destination.address}
🚗 Operador: ${ride.driverName || 'Asignado por Red'}
⏱️ ETA estimado: ${etaMin} min
Estado: ${ride.status.toUpperCase()}
Sigue el enlace: ${secureTrackUrl}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('[ZENITH-SHARE-ERROR] Failed to copy text:', e);
    }
  };

  const getShareUrl = (channel: 'whatsapp' | 'telegram' | 'sms' | 'facebook') => {
    const encodedMsg = encodeURIComponent(shareMessage);
    switch (channel) {
      case 'whatsapp':
        return `https://api.whatsapp.com/send?text=${encodedMsg}`;
      case 'telegram':
        return `https://t.me/share/url?url=${encodeURIComponent(secureTrackUrl)}&text=${encodeURIComponent('Sigue mi viaje en tiempo real mediante el protocolo de seguridad Zénith.')}`;
      case 'facebook':
        return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(secureTrackUrl)}`;
      case 'sms':
        return `sms:?&body=${encodedMsg}`;
      default:
        return '';
    }
  };

  return (
    <div className="hud-card p-5 bg-black/40 border-white/5 space-y-4 font-mono text-xs text-left">
      <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
        <div className="flex items-center gap-2">
          <Share2 className="text-[#39FF14] animate-pulse" size={14} />
          <h4 className="text-xs uppercase font-black text-gray-300">Compartir Monitoreo de Viaje</h4>
        </div>
        <span className="text-[8px] font-bold bg-[#39FF14]/15 border border-[#39FF14]/30 text-[#39FF14] px-2 py-0.5 rounded uppercase">Protocolo Activo</span>
      </div>

      <p className="text-[10px] text-gray-400 leading-normal uppercase">
        Autoriza la transmisión de coordenadas GPS y telemetría de ruta a tus contactos de confianza.
      </p>

      {/* Share Actions Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <a
          href={getShareUrl('whatsapp')}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center p-3 rounded-xl border border-white/5 bg-white/5 hover:bg-green-600/10 hover:border-green-500/30 transition-all text-center gap-1.5"
        >
          <span className="text-[#39FF14] font-black text-xs">WhatsApp</span>
        </a>

        <a
          href={getShareUrl('telegram')}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center p-3 rounded-xl border border-white/5 bg-white/5 hover:bg-sky-600/10 hover:border-sky-500/30 transition-all text-center gap-1.5"
        >
          <span className="text-[#39FF14] font-black text-xs">Telegram</span>
        </a>

        <a
          href={getShareUrl('sms')}
          className="flex flex-col items-center justify-center p-3 rounded-xl border border-white/5 bg-white/5 hover:bg-purple-600/10 hover:border-purple-500/30 transition-all text-center gap-1.5"
        >
          <span className="text-[#39FF14] font-black text-xs">SMS Directo</span>
        </a>

        <button
          onClick={handleCopy}
          className="flex flex-col items-center justify-center p-3 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-all text-center gap-1.5 cursor-pointer"
        >
          {copied ? (
            <Check className="text-green-400" size={16} />
          ) : (
            <Copy className="text-[#39FF14]" size={16} />
          )}
          <span className="text-white font-black text-xs">{copied ? 'Copiado' : 'Copiar Reporte'}</span>
        </button>
      </div>

      {/* Copy-paste Box Preview */}
      <div className="bg-black/80 border border-white/5 p-3 rounded-xl max-h-24 overflow-y-auto text-[9px] text-gray-500 break-words leading-relaxed select-all">
        {shareMessage}
      </div>
    </div>
  );
}
