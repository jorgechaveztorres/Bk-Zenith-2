import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Ride, User, UserRole, EmergencyEvent } from '../types';
import { ShieldAlert, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TelemetryService } from '../services/TelemetryService';

interface SOSButtonProps {
  ride: Ride;
  user: User;
}

export default function SOSButton({ ride, user }: SOSButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [triggered, setTriggered] = useState(false);

  const handleTriggerSOS = async () => {
    setSending(true);
    try {
      // Collect current coordinates if possible, else fallback to ride coordinates
      const currentLat = ride.driverLocation?.lat || ride.origin.lat;
      const currentLng = ride.driverLocation?.lng || ride.origin.lng;
      const currentAddress = ride.driverLocation?.address || ride.origin.address;

      const event: Omit<EmergencyEvent, 'id'> = {
        rideId: ride.id,
        timestamp: serverTimestamp(),
        userUid: user.uid,
        userRole: user.role,
        userName: user.fullName,
        driverId: ride.driverId,
        driverName: ride.driverName,
        passengerId: ride.passengerId,
        passengerName: ride.passengerName,
        lat: currentLat,
        lng: currentLng,
        address: currentAddress,
        comment: comment.trim() || 'Pánico inmediato presionado',
        resolved: false
      };

      // Add to Firestore collection: emergency_events
      await addDoc(collection(db, 'emergency_events'), event);

      // Log telemetry
      await TelemetryService.logEvent('ride_cancelled', user.uid, user.role, {
        reason: 'SOS_TRIGGERED',
        rideId: ride.id
      });

      setTriggered(true);
      setShowConfirm(false);
    } catch (e) {
      console.error('[ZENITH-SOS-ERROR] Failed to fire emergency alert:', e);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative font-mono text-xs">
      {/* Red Pulse SOS Button */}
      {!triggered ? (
        <button
          onClick={() => setShowConfirm(true)}
          className="w-full py-4 px-6 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl flex items-center justify-center gap-3 transition-all cursor-pointer shadow-lg hover:scale-[1.01] animate-pulse"
        >
          <ShieldAlert size={18} className="animate-spin" />
          <span className="uppercase tracking-widest text-xs">PANIC SOS ACTIVO</span>
        </button>
      ) : (
        <div className="w-full py-4 px-6 bg-red-950/40 border border-red-500/30 text-red-400 font-black rounded-2xl flex flex-col items-center justify-center gap-2 text-center">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" />
            <span className="uppercase tracking-widest text-xs">ALERTAS SOS DESPLEGADAS</span>
          </div>
          <p className="text-[9px] text-gray-400 uppercase">
            Fuerzas de seguridad y soporte Zénith han sido notificadas de su posición GPS.
          </p>
        </div>
      )}

      {/* Confirmation Modal overlay */}
      <AnimatePresence>
        {showConfirm && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#050505] border border-red-500/30 w-full max-w-md rounded-2xl p-6 relative space-y-6"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-2 text-red-500">
                  <ShieldAlert size={20} className="animate-bounce" />
                  <h3 className="text-lg font-black uppercase italic tracking-tight">Confirmar Alerta SOS</h3>
                </div>
                <button 
                  onClick={() => setShowConfirm(false)} 
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-left">
                <p className="text-gray-300 leading-relaxed uppercase text-[10px]">
                  Al confirmar, se transmitirá inmediatamente tu información operativa, ubicación en vivo y perfil a las autoridades de tránsito y centro de operaciones Zénith.
                </p>

                <div>
                  <label className="text-[9px] text-gray-500 uppercase tracking-widest mb-1 block">Añadir Comentario o Nota de Crisis (Opcional)</label>
                  <textarea
                    placeholder="Detalla el problema (Ej: desvío sospechoso, asistencia médica, etc.)"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    className="w-full bg-black border border-white/10 rounded-xl p-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl uppercase tracking-wider font-bold text-[10px] border border-white/5"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleTriggerSOS}
                    disabled={sending}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl uppercase tracking-wider font-black text-[10px] flex items-center justify-center gap-2"
                  >
                    {sending ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Check size={12} />
                    )}
                    <span>Enviar Alerta</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
