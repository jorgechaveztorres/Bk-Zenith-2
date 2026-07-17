import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { ScheduledRide, User, Location } from '../types';
import { Calendar, Clock, Plus, Trash2, Check, AlertCircle, Play, Loader2, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import PlacesAutocomplete from './PlacesAutocomplete';
import { calculatePricing } from '../utils/pricingEngine';
import { TelemetryService } from '../services/TelemetryService';

interface ScheduledRidesProps {
  user: User;
}

export default function ScheduledRides({ user }: ScheduledRidesProps) {
  const [scheduled, setScheduled] = useState<ScheduledRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Form State
  const [origin, setOrigin] = useState<Location | null>(null);
  const [destination, setDestination] = useState<Location | null>(null);
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [estimatedPrice, setEstimatedPrice] = useState<number>(0);

  // Load user's scheduled rides
  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'scheduled_rides'),
      where('passengerId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      } as ScheduledRide));
      setScheduled(fetched);
      setLoading(false);
    }, (error) => {
      console.error('[ZENITH-SCHEDULE-ERROR] Failed to load scheduled rides:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user.uid]);

  // Recalculate price estimate when endpoints change
  useEffect(() => {
    if (origin && destination) {
      const res = calculatePricing(
        origin.lat,
        origin.lng,
        destination.lat,
        destination.lng,
        origin.address,
        destination.address
      );
      setEstimatedPrice(Math.round(res.totalFare));
    } else {
      setEstimatedPrice(0);
    }
  }, [origin, destination]);

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin || !destination || !dateStr || !timeStr) return;

    setSyncing(true);
    try {
      const scheduledAt = new Date(`${dateStr}T${timeStr}`).toISOString();

      const newSchedule: Omit<ScheduledRide, 'id'> = {
        passengerId: user.uid,
        passengerName: user.fullName,
        origin,
        destination,
        price: estimatedPrice,
        scheduledAt,
        status: 'pending',
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'scheduled_rides'), newSchedule);
      await TelemetryService.logEvent('favorite_created', user.uid, user.role, {
        type: 'scheduled_ride',
        price: estimatedPrice
      });

      // Reset
      setOrigin(null);
      setDestination(null);
      setDateStr('');
      setTimeStr('');
      setShowAddForm(false);
    } catch (e) {
      console.error('[ZENITH-SCHEDULE-ERROR] Failed to save scheduled ride:', e);
    } finally {
      setSyncing(false);
    }
  };

  const handleCancelSchedule = async (id: string) => {
    if (!confirm('¿Desea cancelar esta reservación futura?')) return;
    try {
      await updateDoc(doc(db, 'scheduled_rides', id), {
        status: 'cancelled'
      });
    } catch (e) {
      console.error('[ZENITH-SCHEDULE-ERROR] Cancel failed:', e);
    }
  };

  // Simulated Instant Dispatcher of reservation
  const handleDeployScheduleNow = async (sched: ScheduledRide) => {
    try {
      // Create a live ride based on this reservation
      await addDoc(collection(db, 'rides'), {
        passengerId: sched.passengerId,
        passengerName: sched.passengerName,
        origin: sched.origin,
        destination: sched.destination,
        suggestedPrice: sched.price,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Update reservation status to active (dispatched)
      await updateDoc(doc(db, 'scheduled_rides', sched.id), {
        status: 'active'
      });

      await TelemetryService.logEvent('ride_created', user.uid, user.role, {
        fromScheduleId: sched.id
      });

      alert('¡Reservación desplegada en tiempo real! Regresa al panel de servicio para recibir ofertas.');
    } catch (e) {
      console.error('[ZENITH-SCHEDULE-ERROR] Deployment simulation failed:', e);
    }
  };

  return (
    <div className="space-y-6 font-mono text-xs text-left" id="scheduled_rides_section">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black uppercase italic text-white flex items-center gap-2">
          <Calendar size={16} className="text-[#39FF14]" />
          Reservas de Viajes Futuros
        </h3>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className={`px-4 py-2 border rounded-xl flex items-center gap-2 transition-all cursor-pointer font-black ${
            showAddForm 
              ? 'bg-red-500/10 border-red-500/30 text-red-400' 
              : 'bg-[#39FF14]/10 border-[#39FF14]/30 text-[#39FF14] hover:bg-[#39FF14]/15'
          }`}
        >
          {showAddForm ? 'Cerrar' : (
            <>
              <Plus size={14} className="stroke-[3]" />
              <span>Nueva Reserva</span>
            </>
          )}
        </button>
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleCreateSchedule}
            className="hud-card p-5 bg-black border-white/5 space-y-4 overflow-hidden"
          >
            <div className="space-y-3">
              <div>
                <label className="text-[9px] text-gray-500 uppercase tracking-widest mb-1 block">Punto de Partida</label>
                <PlacesAutocomplete 
                  onLocationSelect={(loc) => setOrigin(loc)} 
                  placeholder="¿De dónde partimos?" 
                  value={origin?.address || ''}
                  icon={<MapPin size={14} className="text-[#39FF14]" />}
                />
              </div>

              <div>
                <label className="text-[9px] text-gray-500 uppercase tracking-widest mb-1 block">Punto de Llegada</label>
                <PlacesAutocomplete 
                  onLocationSelect={(loc) => setDestination(loc)} 
                  placeholder="¿A dónde vamos?" 
                  value={destination?.address || ''}
                  icon={<MapPin size={14} className="text-white/60" />}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] text-gray-500 uppercase tracking-widest mb-1 block">Fecha de Salida</label>
                  <input
                    type="date"
                    required
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl p-3 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-[9px] text-gray-500 uppercase tracking-widest mb-1 block">Hora Estimada</label>
                  <input
                    type="time"
                    required
                    value={timeStr}
                    onChange={(e) => setTimeStr(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl p-3 text-xs text-white"
                  />
                </div>
              </div>
            </div>

            {estimatedPrice > 0 && (
              <div className="p-3 bg-[#39FF14]/10 border border-[#39FF14]/20 rounded-xl flex items-center justify-between">
                <span className="text-gray-400">Tarifa Estimada de Reserva:</span>
                <span className="text-lg font-black text-[#39FF14] italic">${estimatedPrice}.00</span>
              </div>
            )}

            <button
              type="submit"
              disabled={syncing || !origin || !destination || !dateStr || !timeStr}
              className="w-full py-4 bg-[#39FF14] text-black font-black uppercase tracking-wider rounded-xl hover:scale-[1.01] transition-all disabled:opacity-40"
            >
              {syncing ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Confirmar Reserva de Viaje'}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Scheduled Rides Feed */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-8 text-center flex justify-center">
            <Loader2 className="animate-spin text-[#39FF14]" size={20} />
          </div>
        ) : scheduled.length === 0 ? (
          <div className="hud-card p-10 text-center text-gray-500 uppercase tracking-widest border-dashed">
            No tienes reservaciones futuras activas.
          </div>
        ) : (
          scheduled.map((sched) => {
            const dateObj = new Date(sched.scheduledAt);
            const friendlyDate = dateObj.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' });
            const friendlyTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const isPending = sched.status === 'pending';

            return (
              <div 
                key={sched.id}
                className={`hud-card p-5 border-white/5 bg-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                  sched.status === 'cancelled' ? 'opacity-50' : ''
                }`}
              >
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[8px] font-mono font-bold px-2.5 py-0.5 rounded border uppercase tracking-wider ${
                      sched.status === 'pending' 
                        ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' 
                        : sched.status === 'active'
                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                      {sched.status}
                    </span>
                    <span className="text-[9px] font-mono text-[#39FF14] flex items-center gap-1 font-bold uppercase">
                      <Clock size={10} />
                      {friendlyDate} a las {friendlyTime}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-gray-300 truncate max-w-[400px]">
                      <span className="text-[9px] font-bold text-[#39FF14] uppercase mr-1">DE:</span>
                      {sched.origin.address}
                    </p>
                    <p className="text-xs text-white/80 truncate max-w-[400px]">
                      <span className="text-[9px] font-bold text-gray-500 uppercase mr-1">A:</span>
                      {sched.destination.address}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end md:gap-4 border-t border-white/5 md:border-none pt-3 md:pt-0">
                  <div className="text-left md:text-right">
                    <p className="text-[8px] text-gray-500 uppercase">Tarifa Fijada</p>
                    <p className="text-xl font-black italic text-[#39FF14] leading-none mt-1">${sched.price}</p>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    {isPending && (
                      <>
                        <button
                          onClick={() => handleDeployScheduleNow(sched)}
                          title="Desplegar Reserva Ahora para simulación"
                          className="p-2.5 bg-[#39FF14]/15 hover:bg-[#39FF14]/25 border border-[#39FF14]/30 text-[#39FF14] rounded-xl transition-all cursor-pointer"
                        >
                          <Play size={14} />
                        </button>

                        <button
                          onClick={() => handleCancelSchedule(sched.id)}
                          title="Cancelar"
                          className="p-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl transition-all cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
