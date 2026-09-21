// ============================================================================
// ZÉNITH
// Module : Rides / Driver
// Layer  : Presentation / UI
// File   : DriverFlow.tsx
// ============================================================================

import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, serverTimestamp, setDoc, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Ride, RideStatus, User, DocumentStatus } from '../types';
import { NotificationService } from '../services/NotificationService';
import { WalletService } from '../services/WalletService';
import MapContainer from './MapContainer';
import Chat from './Chat';
import SOSButton from './SOSButton';
import ShareRide from './ShareRide';
import { MessageSquare } from 'lucide-react';
import DriverVehicleScreen from './driver/DriverVehicleScreen';
import DriverDocumentsScreen from './driver/DriverDocumentsScreen';
import DriverPermissionsScreen from './driver/DriverPermissionsScreen';
import DriverReviewScreen from './driver/DriverReviewScreen';
import DriverDashboard from './driver/DriverDashboard';
import DriverActiveTripHUD from './driver/DriverActiveTripHUD';
import TrackingMap from './maps/TrackingMap';
import { DriverTrackingService } from '../services/DriverTrackingService';
import { generateRideOtp } from '../utils/otpHelper';
import { 
  MapPin, 
  DollarSign, 
  Send, 
  Star, 
  ChevronRight, 
  User as UserIcon, 
  Radar, 
  Activity, 
  Check, 
  Navigation,
  TrendingUp,
  History,
  Wifi,
  WifiOff,
  Compass,
  CheckCircle,
  AlertTriangle,
  Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { locationService, GPSMode, GPSStatus } from '../services/LocationService';
import ZenithMotorizadoCockpit from './delivery/ZenithMotorizadoCockpit';
import ZenithCustodyPanel from './delivery/ZenithCustodyPanel';

interface DriverFlowProps {
  user: User;
}

export default function DriverFlow({ user }: DriverFlowProps) {
  const [rides, setRides] = useState<Ride[]>([]);
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(false);
  const [myAcceptedRide, setMyAcceptedRide] = useState<Ride | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);

  // Onboarding & Permissions States
  const [onboardingStep, setOnboardingStep] = useState<'vehicle' | 'documents' | 'permissions' | 'review' | 'dashboard'>('vehicle');
  const [permissionsGranted, setPermissionsGranted] = useState(false);

  // Auto check geolocation permission state on mount
  useEffect(() => {
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' as any }).then((result) => {
        if (result.state === 'granted') {
          setPermissionsGranted(true);
        }
      });
    }
  }, []);

  // Update step selection based on profile integrity
  useEffect(() => {
    if (!user.driverProfile || !user.driverProfile.vehicle || !user.driverProfile.vehicle.plate) {
      setOnboardingStep('vehicle');
    } else if (!user.driverProfile.documentation || !user.driverProfile.documentation.licenseNumber) {
      setOnboardingStep('documents');
    } else if (!permissionsGranted) {
      setOnboardingStep('permissions');
    } else if (user.driverProfile.status !== DocumentStatus.APPROVED) {
      setOnboardingStep('review');
    } else {
      setOnboardingStep('dashboard');
    }
  }, [user.driverProfile, permissionsGranted]);

  // Advanced GPS State Indicators
  const [gpsStatus, setGpsStatus] = useState<GPSStatus>({
    precision: 5.0,
    signalLoss: false,
    mode: locationService.getGPSMode()
  });

  // Business Performance Metrics
  const [completedRides, setCompletedRides] = useState<Ride[]>([]);

  // 1. Listen to real-time GPS operational status
  useEffect(() => {
    const unsubscribe = locationService.subscribeToStatus((status) => {
      setGpsStatus(status);
    });
    return () => unsubscribe();
  }, []);

  // 2. Listen for active rides assigned to this driver
  useEffect(() => {
    const q = query(
      collection(db, 'rides'),
      where('driverId', '==', user.uid),
      where('status', 'in', [RideStatus.DRIVER_ASSIGNED, RideStatus.DRIVER_ARRIVING, RideStatus.WAITING_FOR_OTP, RideStatus.IN_PROGRESS]),
      limit(1)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const active = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Ride));
      setMyAcceptedRide(active[0] || null);
    });
    return () => unsubscribe();
  }, [user.uid]);

  // 3. Listen for available unassigned rides in the area
  useEffect(() => {
    if (myAcceptedRide) return;
    const q = query(
      collection(db, 'rides'),
      where('status', 'in', [RideStatus.SEARCHING_DRIVER]),
      limit(20)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRides(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Ride)));
    });
    return () => unsubscribe();
  }, [myAcceptedRide]);

  // 4. Listen to completed rides for driver metrics & history
  useEffect(() => {
    const q = query(
      collection(db, 'rides'),
      where('driverId', '==', user.uid),
      where('status', 'in', [RideStatus.COMPLETED]),
      limit(50)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const history = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Ride));
      setCompletedRides(history);
    });
    return () => unsubscribe();
  }, [user.uid]);

  // 5. Deploy GPS tracking during active transit
  useEffect(() => {
    if (!myAcceptedRide) {
      DriverTrackingService.stopTracking();
      return;
    }

    console.log("[ZENITH-GPS] Deploying real-time decoupled GPS tracking...");
    DriverTrackingService.startTracking(
      myAcceptedRide.id,
      {
        driverId: user.uid,
        driverName: user.fullName,
        passengerId: myAcceptedRide.passengerId,
        passengerName: myAcceptedRide.passengerName,
        origin: myAcceptedRide.origin,
        destination: myAcceptedRide.destination
      }
    ).catch(err => {
      console.error("[ZENITH-GPS] Failed to start driver tracking:", err);
    });

    return () => {
      DriverTrackingService.stopTracking();
    };
  }, [myAcceptedRide?.id, user.uid]);

  const toggleGpsMode = () => {
    const nextMode = gpsStatus.mode === GPSMode.SIMULATION ? GPSMode.PRODUCTION : GPSMode.SIMULATION;
    locationService.setGPSMode(nextMode);
  };

  const acceptRideDirectly = async (ride: Ride) => {
    setLoading(true);
    try {
      await setDoc(doc(db, 'rides', ride.id), {
        status: RideStatus.DRIVER_ASSIGNED,
        driverId: user.uid,
        driverName: user.fullName,
        finalPrice: ride.protectedPrice,
        updatedAt: serverTimestamp()
      }, { merge: true });
      await NotificationService.notifyRideAccepted(ride.passengerId, user.uid, ride.passengerName, user.fullName, ride.protectedPrice);
      setSelectedRide(null);
    } catch (error) {
      console.error("[ZENITH-ERROR] Direct acceptance failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateRideStatus = async (status: RideStatus) => {
    if (!myAcceptedRide) return;
    setLoading(true);
    try {
      await setDoc(doc(db, 'rides', myAcceptedRide.id), {
        status,
        updatedAt: serverTimestamp()
      }, { merge: true });

      if (status === RideStatus.IN_PROGRESS) {
        await NotificationService.notifyRideStarted(myAcceptedRide.passengerId);
      } else if (status === RideStatus.COMPLETED) {
        const amount = myAcceptedRide.finalPrice || myAcceptedRide.suggestedPrice || 0;
        await WalletService.creditRideEarnings(user.uid, amount, myAcceptedRide.id, myAcceptedRide.passengerName);
        await NotificationService.notifyRideCompleted(myAcceptedRide.passengerId, user.uid, amount);
      }
    } catch (error) {
      console.error("[ZENITH-ERROR] Failed to update ride status:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate daily earnings from completed/rated rides
  const dailyEarnings = completedRides.reduce((total, ride) => {
    const price = ride.finalPrice || ride.protectedPrice || 0;
    return total + price;
  }, 0);

  if (myAcceptedRide) {
    return (
      <div className="space-y-6" id="driver_active_transit_view">
        {/* ZÉNITH MVP V1.1 MOTORIZADO TACTICAL COCKPIT */}
        <ZenithMotorizadoCockpit
          ride={myAcceptedRide}
          driverUser={user}
        />

        {/* Critical Signal Loss Warning Banner */}
        <AnimatePresence>
          {gpsStatus.signalLoss && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-red-500 text-white px-6 py-3.5 rounded-2xl flex items-center gap-3 shadow-glow-red font-mono text-xs uppercase font-black"
            >
              <AlertTriangle className="animate-pulse shrink-0 text-white" size={18} />
              <div className="flex-1">
                <span>SEÑAL GPS PERDIDA</span>
                <span className="opacity-70 ml-2">| RECONECTANDO AUTOMÁTICAMENTE...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Real-time Telemetry & Header */}
        <div className="bg-[#39FF14] text-black p-8 rounded-3xl shadow-glow relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
             <Activity size={120} />
          </div>
          <div className="flex items-center justify-between mb-6 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center text-[#39FF14]">
                <Star className="fill-[#39FF14]" size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-black uppercase italic tracking-tighter">Despacho Operativo</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex items-center gap-1 bg-black/10 px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase">
                    <Wifi size={10} />
                    <span>PRECISIÓN: {gpsStatus.precision.toFixed(1)}m</span>
                  </div>
                  <div className="text-[8px] font-mono bg-black/10 px-2 py-0.5 rounded font-bold uppercase">
                    MODO: {gpsStatus.mode}
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-black text-[#39FF14] px-4 py-1 rounded-full text-[10px] font-mono font-black uppercase tracking-widest animate-pulse">
              {myAcceptedRide.status === 'accepted' ? 'Ruta Asignada' : 'Tránsito en Curso'}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-8 relative z-10 border-b border-black/10 pb-4">
            <div className="space-y-1 text-left">
              <p className="text-[10px] font-mono uppercase font-black opacity-60">Personal Objetivo</p>
              <p className="text-2xl font-black italic">{myAcceptedRide.passengerName}</p>
            </div>
            <div className="text-right space-y-1">
              <p className="text-[10px] font-mono uppercase font-black opacity-60">Compensación Acordada</p>
              <p className="text-4xl font-black italic mono-data">${myAcceptedRide.finalPrice}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 relative z-10 text-xs font-mono text-black/70 text-left">
            <div>
              <p className="uppercase font-black opacity-60 text-[8px]">Distancia de Ruta</p>
              <p className="font-bold">{myAcceptedRide.distance ? `${myAcceptedRide.distance} KM` : 'N/D'}</p>
            </div>
            <div>
              <p className="uppercase font-black opacity-60 text-[9px]">Tiempo Estimado</p>
              <p className="font-bold">{myAcceptedRide.duration ? `${myAcceptedRide.duration} MIN` : 'N/D'}</p>
            </div>
            <div className="text-right">
              <p className="uppercase font-black opacity-60 text-[9px]">Sello de Tarifa</p>
              <p className="font-bold truncate max-w-[100px] ml-auto">{myAcceptedRide.pricingSeal || 'N/D'}</p>
            </div>
          </div>
        </div>

        {/* Navigation & Real-time Map */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest font-black">Consola de Navegación</span>
            <div className="flex items-center gap-1.5 text-[9px] font-mono text-[#39FF14]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#39FF14] animate-ping"></span>
              <span>GPS INTEGRADO ACTIVO</span>
            </div>
          </div>
          <TrackingMap
            passengerLoc={myAcceptedRide.origin}
            driverLoc={myAcceptedRide.driverLocation}
            originLoc={myAcceptedRide.origin}
            destinationLoc={myAcceptedRide.destination}
            height="350px"
          />
        </div>

        {/* Real-time Diagnostics HUD */}
        <DriverActiveTripHUD ride={myAcceptedRide} />

        {/* Node Directions Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="hud-card p-6 flex flex-col justify-center gap-2 bg-black/40">
            <div className="flex items-center gap-2 text-[#39FF14]">
               <MapPin size={16} />
               <p className="text-[10px] font-mono uppercase font-bold tracking-widest">Nodo de Origen</p>
            </div>
            <p className="text-lg font-bold uppercase italic leading-tight text-white text-left">{myAcceptedRide.origin.address}</p>
          </div>
          <div className="hud-card p-6 flex flex-col justify-center gap-2 border-l-[#39FF14]/30 border-l-2 bg-black/40">
            <div className="flex items-center gap-2 text-white/50">
               <Compass size={16} />
               <p className="text-[10px] font-mono uppercase font-bold tracking-widest">Objetivo de Destino</p>
            </div>
            <p className="text-lg font-bold uppercase italic leading-tight text-white text-left">{myAcceptedRide.destination.address}</p>
          </div>
        </div>

        {/* Transition trigger controls */}
        <div className="pt-2">
          {myAcceptedRide.status === RideStatus.DRIVER_ASSIGNED ? (
            <button
              disabled={loading}
              onClick={() => updateRideStatus(RideStatus.DRIVER_ARRIVING)}
              className="w-full bg-[#39FF14] text-black font-black uppercase italic tracking-tighter text-xl py-6 rounded-2xl flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-[0.99] transition-all shadow-glow disabled:opacity-50 cursor-pointer"
            >
              <Navigation className="animate-bounce" size={24} />
              Conductor en Camino
            </button>
          ) : myAcceptedRide.status === RideStatus.DRIVER_ARRIVING ? (
            <button
              disabled={loading}
              onClick={() => updateRideStatus(RideStatus.WAITING_FOR_OTP)}
              className="w-full bg-[#39FF14] text-black font-black uppercase italic tracking-tighter text-xl py-6 rounded-2xl flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-[0.99] transition-all shadow-glow disabled:opacity-50 cursor-pointer"
            >
              <MapPin className="animate-pulse" size={24} />
              Registrar Llegada (Llegué)
            </button>
          ) : myAcceptedRide.status === RideStatus.WAITING_FOR_OTP ? (
            <div className="bg-neutral-900 border border-white/5 rounded-3xl p-6 space-y-4 text-left">
              <div className="flex items-center gap-2 text-[#39FF14]">
                <Shield size={16} />
                <span className="text-[10px] font-mono uppercase font-black tracking-widest">Validación de Código de Seguridad</span>
              </div>
              <h4 className="text-sm font-bold uppercase text-white">Código de Abordaje (OTP)</h4>
              <p className="text-xs text-gray-400">
                Ingrese el código de 3 dígitos provisto por el pasajero para autorizar el viaje seguro y comenzar el recorrido:
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  maxLength={3}
                  placeholder="---"
                  value={otpInput}
                  onChange={(e) => {
                    setOtpInput(e.target.value.replace(/\D/g, ''));
                    setOtpError(null);
                  }}
                  className="bg-black border border-white/10 rounded-xl px-4 py-3 text-center text-xl font-black font-mono tracking-[0.5em] text-[#39FF14] w-full sm:w-36 focus:outline-none focus:border-[#39FF14] transition-all"
                />
                <button
                  disabled={loading || otpInput.length < 3}
                  onClick={() => {
                    const expected = generateRideOtp(myAcceptedRide.id);
                    if (otpInput === expected) {
                      setOtpError(null);
                      updateRideStatus(RideStatus.IN_PROGRESS);
                    } else {
                      setOtpError('Código de seguridad inválido. Verifique con el pasajero.');
                    }
                  }}
                  className="flex-1 bg-[#39FF14] text-black font-black uppercase text-xs tracking-widest rounded-xl hover:shadow-glow transition-all py-3 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check size={14} className="stroke-[3]" />
                  Validar OTP e Iniciar Viaje
                </button>
              </div>

              {otpError && (
                <p className="text-[10px] font-mono text-red-400 uppercase tracking-wider font-bold">
                  ⚠️ {otpError}
                </p>
              )}
            </div>
          ) : myAcceptedRide.status === RideStatus.IN_PROGRESS ? (
            <button
              disabled={loading}
              onClick={() => updateRideStatus(RideStatus.COMPLETED)}
              className="w-full bg-[#39FF14] text-black font-black uppercase italic tracking-tighter text-xl py-6 rounded-2xl flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-[0.99] transition-all shadow-glow disabled:opacity-50 cursor-pointer"
            >
              <Check size={24} className="stroke-[3]" />
              Completar y Finalizar Viaje
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8" id="driver_main_flow">
      {/* Dynamic onboarding step matching */}
      {onboardingStep === 'vehicle' && (
        <DriverVehicleScreen user={user} onSuccess={() => setOnboardingStep('documents')} />
      )}

      {onboardingStep === 'documents' && (
        <DriverDocumentsScreen user={user} onSuccess={() => setOnboardingStep('permissions')} />
      )}

      {onboardingStep === 'permissions' && (
        <DriverPermissionsScreen onSuccess={() => { setPermissionsGranted(true); setOnboardingStep('review'); }} />
      )}

      {onboardingStep === 'review' && (
        <DriverReviewScreen 
          user={user} 
          onBackToDocs={() => setOnboardingStep('documents')} 
          onRefresh={() => {
            console.log("[Onboarding Status Refresh Check] Checking updated operator profile...");
          }} 
        />
      )}

      {onboardingStep === 'dashboard' && (
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
            <div>
              <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white">Panel del Conductor</h2>
              <p className="text-gray-500 font-mono text-[10px] uppercase tracking-widest mt-1">
                Cabina operativa de Zénith Pro
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 bg-white/5 p-2 rounded-2xl border border-white/5">
              <div className="flex items-center gap-2 px-3">
                <span className="w-1.5 h-1.5 rounded-full bg-[#39FF14] animate-ping"></span>
                <span className="text-[10px] font-mono text-gray-400 font-bold uppercase">GPS: {gpsStatus.mode}</span>
              </div>
              <button
                onClick={toggleGpsMode}
                className="px-3 py-1.5 bg-black/40 hover:bg-black text-[#39FF14] text-[9px] font-mono uppercase font-black tracking-widest rounded-xl border border-[#39FF14]/30 hover:border-[#39FF14] transition-all"
              >
                Alternar GPS
              </button>
            </div>
          </div>

          <DriverDashboard 
            user={user} 
            onSelectRide={setSelectedRide} 
            myAcceptedRide={myAcceptedRide} 
          />

          {/* ZÉNITH MVP V1.1 CUSTODY MANAGEMENT PANEL */}
          <ZenithCustodyPanel driverUser={user} />

          {/* Historical Operational Logs */}
          <div className="space-y-4 pt-4">
            <h3 className="font-bold text-lg uppercase italic flex items-center gap-2 text-white">
              <History size={20} className="text-gray-400" />
              Historial de Operaciones del Conductor
            </h3>

            <div className="space-y-2">
              {completedRides.length === 0 ? (
                <div className="hud-card p-10 text-center text-gray-600 font-mono text-[10px] uppercase tracking-widest bg-black/40">
                  Ninguna operación registrada en la sesión actual
                </div>
              ) : (
                completedRides.map(ride => (
                  <div 
                    key={ride.id}
                    className="hud-card p-4 bg-white/5 border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left"
                  >
                    <div>
                      <p className="text-xs font-bold text-white uppercase italic">{ride.passengerName}</p>
                      <p className="text-[9px] font-mono text-gray-500 uppercase truncate max-w-sm">
                        {ride.origin.address} &rarr; {ride.destination.address}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <p className="text-[8px] font-mono text-gray-500 uppercase">Compensación</p>
                        <p className="text-sm font-black text-[#39FF14] mono-data italic">S/ {(ride.finalPrice || ride.protectedPrice || 0).toFixed(2)}</p>
                      </div>
                      <div className="bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/20 rounded-lg px-2.5 py-1 text-[8px] font-mono font-black uppercase">
                        COMPLETADO
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
