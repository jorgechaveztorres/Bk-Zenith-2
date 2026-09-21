// ============================================================================
// ZÉNITH
// Module : Rides / Passenger
// Layer  : Presentation / UI
// File   : PassengerFlow.tsx
// ============================================================================

import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Ride, RideStatus, User, Location } from '../types';
import { NotificationService } from '../services/NotificationService';
import MapContainer from './MapContainer';
import TrackingMap from './maps/TrackingMap';
import PassengerActiveTripHUD from './PassengerActiveTripHUD';
import PlacesAutocomplete from './PlacesAutocomplete';
import { calculatePricing, PricingResult } from '../utils/pricingEngine';
import Chat from './Chat';
import ShareRide from './ShareRide';
import SOSButton from './SOSButton';
import ScheduledRides from './ScheduledRides';
import { MessageSquare, RefreshCw, Radio, Compass } from 'lucide-react';
import { 
  MapPin, 
  DollarSign, 
  Clock, 
  Check, 
  X, 
  Navigation, 
  Radar, 
  User as UserIcon, 
  Star, 
  Shield, 
  Lock, 
  Cpu, 
  ArrowRight,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DispatchEngine } from '../services/DispatchEngine';
import { WalletService } from '../services/WalletService';
import { PaymentEngine, PaymentMethodDetails } from '../services/PaymentEngine';
import { TransactionEngine } from '../services/TransactionEngine';
import { 
  CreditCard, 
  QrCode, 
  History, 
  FileText, 
  PlusCircle, 
  Download, 
  CheckCircle, 
  AlertTriangle,
  Package
} from 'lucide-react';
import ZenithOrderCreationModal from './delivery/ZenithOrderCreationModal';
import ZenithActiveOperationHUD from './delivery/ZenithActiveOperationHUD';
import {
  getLastKnownLocation,
  requestCurrentBrowserPosition,
  reverseGeocodeLocation,
  PERU_NEUTRAL_CENTER
} from '../services/geoContextService';

interface PassengerFlowProps {
  user: User;
}

type PipelineStep = 'idle' | 'calculating' | 'voucher' | 'confirming_payment' | 'creating_ride';

export default function PassengerFlow({ user }: PassengerFlowProps) {
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  
  // Geolocation & Route selection states (Multiciudad Perú dinámico)
  const [origin, setOrigin] = useState<Location>(() => {
    const last = getLastKnownLocation();
    if (last) {
      return { address: 'Ubicación actual', lat: last.lat, lng: last.lng };
    }
    return { address: 'Perú', lat: PERU_NEUTRAL_CENTER.lat, lng: PERU_NEUTRAL_CENTER.lng };
  });
  const [destination, setDestination] = useState<Location>({ address: '', lat: 0, lng: 0 });
  const [showChat, setShowChat] = useState(false);

  // Detección inicial de GPS para centrar y orientar el origen del pasajero en cualquier ciudad del Perú
  useEffect(() => {
    let isMounted = true;
    requestCurrentBrowserPosition()
      .then(async (coords) => {
        if (!isMounted) return;
        try {
          const geo = await reverseGeocodeLocation(coords.lat, coords.lng);
          if (isMounted) {
            setOrigin({
              address: geo.formattedAddress,
              lat: coords.lat,
              lng: coords.lng
            });
          }
        } catch {
          if (isMounted) {
            setOrigin({
              address: 'Mi ubicación GPS',
              lat: coords.lat,
              lng: coords.lng
            });
          }
        }
      })
      .catch((err) => {
        console.warn('[ZENITH-PASSENGER] GPS pasivo no disponible:', err?.message || err);
      });
    return () => {
      isMounted = false;
    };
  }, []);
  
  // Pipeline state machine
  const [pipelineStep, setPipelineStep] = useState<PipelineStep>('idle');
  const [pricing, setPricing] = useState<PricingResult | null>(null);
  
  // Post-trip feedback states
  const [ratingRide, setRatingRide] = useState<Ride | null>(null);
  const [passengerRating, setPassengerRating] = useState<number>(5);
  const [passengerFeedback, setPassengerFeedback] = useState<string>('');

  // Passenger Payment Center V2 states
  const [selectedMethod, setSelectedMethod] = useState<'card' | 'yape' | 'plin' | 'cash'>('cash');
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [reloadAmount, setReloadAmount] = useState<number>(30);
  const [reloadingWallet, setReloadingWallet] = useState(false);
  const [showPaymentCenter, setShowPaymentCenter] = useState(false);
  const [paymentCenterTab, setPaymentCenterTab] = useState<'history' | 'billing'>('history');
  const [pastRides, setPastRides] = useState<Ride[]>([]);
  const [showOrderCreationModal, setShowOrderCreationModal] = useState(false);
  const [clearingDebt, setClearingDebt] = useState(false);

  const handleClearDebt = async () => {
    if (!user.pendingDebt || user.pendingDebt <= 0) return;
    setClearingDebt(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        pendingDebt: 0,
        pendingDebtReason: null,
        updatedAt: serverTimestamp()
      });
      alert('Deuda regularizada exitosamente en el sistema Zénith.');
    } catch (e: any) {
      console.error(e);
      alert('Error al regularizar deuda: ' + e.message);
    } finally {
      setClearingDebt(false);
    }
  };

  // Initialize real GPS position for passenger on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setOrigin({
            address: `Mi Ubicación Actual (${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)})`,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.warn("[ZENITH-GPS] No se pudo obtener la ubicación del pasajero:", error.message);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  }, []);

  // Load historical rides
  const loadPassengerFinancials = async () => {
    try {
      // Load last 5 rides for invoice center
      const q = query(
        collection(db, 'rides'),
        where('passengerId', '==', user.uid),
        limit(5)
      );
      const snap = onSnapshot(q, (snapshot) => {
        const rides = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Ride));
        setPastRides(rides);
      });
    } catch (e) {
      console.error("[ZENITH-FINANCIAL] Error loading passenger financials:", e);
    }
  };

  useEffect(() => {
    loadPassengerFinancials();
  }, [user.uid]);

  // Sincronizador en background del motor de despacho (Simulador de Backend Serverless)
  useEffect(() => {
    if (!activeRide) return;
    if (activeRide.status !== RideStatus.SEARCHING_DRIVER && activeRide.status !== RideStatus.REQUESTED) return;

    // Ejecución inicial reactiva del motor de asignación inteligente
    DispatchEngine.runDispatchCycle(activeRide.id).catch(err => {
      console.warn('Error en ciclo inicial de despacho:', err);
    });

    // Tasa periódica de 4 segundos para validar timeouts de 15s y gatillar reasignación autónoma
    const interval = setInterval(() => {
      DispatchEngine.runDispatchCycle(activeRide.id).catch(err => {
        console.warn('Error en ciclo periódico de reasignación:', err);
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [activeRide?.id, activeRide?.status]);

  // 1. Listen for active rides (including 'completed' to capture trip finalization)
  useEffect(() => {
    const q = query(
      collection(db, 'rides'),
      where('passengerId', '==', user.uid),
      where('status', 'in', [
        RideStatus.REQUESTED,
        RideStatus.SEARCHING_DRIVER,
        RideStatus.DRIVER_ASSIGNED,
        RideStatus.DRIVER_ARRIVING,
        RideStatus.WAITING_FOR_OTP,
        RideStatus.IN_PROGRESS,
        RideStatus.COMPLETED,
        RideStatus.CANCELLED,
        RideStatus.EXPIRED
      ])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rides = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Ride));
      if (rides.length > 0) {
        const active = rides[0];
        console.log(`[ZENITH-TRACE] [${new Date().toLocaleTimeString()}] PassengerFlow | Active Ride Status: ${active.status}`);
        
        if (active.status === RideStatus.COMPLETED) {
          // Transition to rating screen
          setRatingRide(active);
          setActiveRide(null);
          setPipelineStep('idle');
          setPricing(null);
        } else {
          setActiveRide(active);
        }
      } else {
        setActiveRide(null);
      }
    });

    return () => unsubscribe();
  }, [user.uid]);

  // 2. Listen for offers is obsolete in Zenith protected pricing
    useEffect(() => {
      // Bidding removed programmatically
    }, [activeRide?.id]);

  // 3. Automated Single-Action Pipeline
  const executeSingleActionPipeline = async () => {
    if (!destination.address) return;

    try {
      setPipelineStep('calculating');
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const calculated = calculatePricing(
        origin.lat,
        origin.lng,
        destination.lat,
        destination.lng,
        origin.address,
        destination.address
      );
      setPricing(calculated);
      setPaymentError(null);
      setPaymentSuccess(null);

      // Transition to interactive voucher selection instead of instant checkout
      setPipelineStep('voucher');
    } catch (error) {
      console.error("[ZENITH-ERROR] Pipeline aborted:", error);
      setPipelineStep('idle');
      setPricing(null);
    }
  };

  // Secure checkout process utilizing PaymentEngine and TransactionEngine
  const confirmPaymentAndPublishRide = async () => {
    if (!pricing) return;
    
    setPipelineStep('confirming_payment');
    setPaymentError(null);
    setPaymentSuccess(null);

    const discountAmount = appliedPromo ? (appliedPromo.type === 'percent' ? pricing.totalFare * (appliedPromo.value / 100) : appliedPromo.value) : 0;
    const finalPrice = Math.max(0, Number((pricing.totalFare - discountAmount).toFixed(2)));

    try {
      // 2. Initialize payment record in state machine using PaymentEngine
      const tempRide: any = {
        id: `ride_temp_${Date.now()}`,
        passengerId: user.uid,
        passengerName: user.fullName,
        origin,
        destination,
        protectedPrice: pricing.totalFare,
        finalPrice: finalPrice,
        status: RideStatus.SEARCHING_DRIVER
      };

      const paymentDetails: PaymentMethodDetails = {
        method: selectedMethod as any,
        amount: finalPrice,
        phone: (selectedMethod === 'yape' || selectedMethod === 'plin') ? '999888777' : undefined,
        cardNumber: selectedMethod === 'card' ? '1234567812345678' : undefined
      };

      const paymentResult = await PaymentEngine.processPayment(tempRide, paymentDetails);

      if (!paymentResult.success) {
        throw new Error(paymentResult.message || 'Transacción denegada por el motor antifraude.');
      }

      setPipelineStep('creating_ride');
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 3. Create the ride document with real payment information
      const newRideDoc = await addDoc(collection(db, 'rides'), {
        passengerId: user.uid,
        passengerName: user.fullName,
        origin,
        destination,
        protectedPrice: pricing.totalFare,
        finalPrice: finalPrice,
        distance: pricing.distance,
        duration: pricing.duration,
        pricingSeal: pricing.seal,
        paymentMethod: selectedMethod,
        paymentState: paymentResult.status,
        paymentId: paymentResult.transactionId || `tx_${Date.now()}`,
        status: RideStatus.SEARCHING_DRIVER,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Update the transaction engine ride association
      await updateDoc(doc(db, 'rides', newRideDoc.id), {
        id: newRideDoc.id
      });

      setPaymentSuccess(`¡Pago autorizado con éxito por S/ ${finalPrice.toFixed(2)}! Buscando conductor...`);
      await loadPassengerFinancials(); // Refresh wallet balance
      
      // Keep state clear and let onSnapshot handle ride navigation
      setPipelineStep('idle');
      setPricing(null);
      setAppliedPromo(null);
      setPromoCode('');

    } catch (err: any) {
      console.error("[ZENITH-CHECKOUT-ERROR]", err);
      setPaymentError(err.message || 'Error al autorizar el pago. Verifique sus credenciales.');
      setPipelineStep('voucher');
    }
  };

  // Bidding and acceptBid is deprecated in Zenith

  // RATING SCREEN
  if (ratingRide) {
    return (
      <div className="space-y-6 max-w-lg mx-auto py-6" id="passenger_rating_screen">
        <div className="hud-card p-8 border-[#39FF14]/30 space-y-6 bg-black/40 backdrop-blur-xl">
          <div className="w-16 h-16 bg-[#39FF14]/10 rounded-full flex items-center justify-center mx-auto text-[#39FF14] border border-[#39FF14]/30">
            <Check size={32} className="stroke-[2.5]" />
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-black uppercase italic tracking-tighter">Viaje Finalizado</h2>
            <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mt-1">
              OPERACIÓN COMPLETADA CON ÉXITO
            </p>
          </div>

          <div className="bg-white/5 p-5 rounded-2xl border border-white/5 space-y-3">
            <div className="flex justify-between items-start border-b border-white/5 pb-3">
              <div>
                <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Socio Conductor</p>
                <p className="text-lg font-black uppercase italic text-white">{ratingRide.driverName}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Tarifa Acordada</p>
                <p className="text-2xl font-black text-[#39FF14] mono-data italic">${ratingRide.finalPrice || ratingRide.suggestedPrice}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-left">
              <div>
                <p className="text-[9px] font-mono text-gray-500 uppercase">Distancia</p>
                <p className="text-xs font-bold text-white uppercase">{ratingRide.distance ? `${ratingRide.distance} KM` : 'N/D'}</p>
              </div>
              <div>
                <p className="text-[9px] font-mono text-gray-500 uppercase">Tiempo Estimado</p>
                <p className="text-xs font-bold text-white uppercase">{ratingRide.duration ? `${ratingRide.duration} MIN` : 'N/D'}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3 text-center">
            <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest font-black">
              Califica la experiencia del servicio
            </p>
            <div className="flex justify-center gap-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setPassengerRating(star)}
                  className="p-1 hover:scale-125 transition-transform"
                  type="button"
                >
                  <Star
                    size={36}
                    className={`stroke-2 transition-colors ${
                      star <= passengerRating ? 'fill-[#39FF14] text-[#39FF14]' : 'text-gray-600'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-mono text-gray-500 uppercase tracking-widest font-bold pl-1">
              Comentarios adicionales
            </label>
            <textarea
              value={passengerFeedback}
              onChange={(e) => setPassengerFeedback(e.target.value)}
              placeholder="Escribe aquí tu feedback operativo sobre la conducción..."
              className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm focus:ring-1 focus:ring-[#39FF14]/50 focus:border-[#39FF14]/50 transition-all text-white placeholder-gray-600 outline-none"
              rows={3}
            />
          </div>

          <button
            onClick={async () => {
              if (ratingRide) {
                try {
                  await updateDoc(doc(db, 'rides', ratingRide.id), {
                    status: RideStatus.COMPLETED,
                    passengerRating,
                    passengerFeedback,
                    updatedAt: serverTimestamp()
                  });
                  if (ratingRide.driverId) {
                    await NotificationService.notifyRatingReceived(ratingRide.driverId, passengerRating, 'passenger');
                  }
                } catch (error) {
                  console.error("[ZENITH-ERROR] Error saving rating:", error);
                }
              }
              setRatingRide(null);
              setPassengerRating(5);
              setPassengerFeedback('');
            }}
            className="w-full btn-tactical uppercase italic tracking-tighter text-md py-4 font-black"
          >
            Enviar Calificación y Volver
          </button>
        </div>
      </div>
    );
  }

  // ACTIVE TRIP SCREEN
  if (activeRide) {
    const isMatched = activeRide.status === RideStatus.DRIVER_ASSIGNED || 
                      activeRide.status === RideStatus.DRIVER_ARRIVING || 
                      activeRide.status === RideStatus.WAITING_FOR_OTP || 
                      activeRide.status === RideStatus.IN_PROGRESS;

    return (
      <div className="space-y-6" id="passenger_active_trip_screen">
        {/* ZÉNITH MVP V1.1 ACTIVE OPERATION HUD */}
        <ZenithActiveOperationHUD ride={activeRide} user={user} />

        <div className="hud-card p-6 flex items-center justify-between border-l-4 border-l-[#39FF14]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Radar size={16} className="text-[#39FF14] animate-pulse" />
              <h2 className="text-xl font-black uppercase italic tracking-tight">
                {isMatched ? 'Tránsito Operativo' : 'Escaneando Operadores'}
              </h2>
            </div>
            <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest truncate max-w-sm md:max-w-md">
              {activeRide.origin.address} &rarr; {activeRide.destination.address}
            </p>
          </div>
          <button 
            onClick={async () => await updateDoc(doc(db, 'rides', activeRide.id), { status: RideStatus.CANCELLED })} 
            className="flex items-center gap-1.5 px-3 py-2 border border-red-500/30 text-red-500 hover:bg-red-500/10 text-[10px] font-mono uppercase tracking-widest rounded-xl transition-all font-black shrink-0"
            title="Cancelar solicitud y resetear estado"
          >
            <X size={14} className="stroke-[3]" />
            Abortar
          </button>
        </div>

        {/* Real-time map displaying origin, destination, and live simulated operator GPS if in progress */}
        {isMatched ? (
          <TrackingMap
            passengerLoc={activeRide.origin}
            driverLoc={activeRide.driverLocation}
            originLoc={activeRide.origin}
            destinationLoc={activeRide.destination}
            height="320px"
          />
        ) : (
          <MapContainer 
            height="320px" 
            center={activeRide.origin}
            markers={[
              { id: 'origin', position: activeRide.origin, color: '#39FF14', title: 'Origen' },
              { id: 'dest', position: activeRide.destination, color: '#FFFFFF', title: 'Destino' }
            ]} 
          />
        )}

        {isMatched && (
          <PassengerActiveTripHUD ride={activeRide} />
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg uppercase italic flex items-center gap-2">
              <Clock size={20} className="text-[#39FF14]" />
              {isMatched ? 'Operador Asignado' : 'Ofertas Operativas'}
            </h3>
            {!isMatched && (
              <span className="text-[10px] font-mono bg-[#39FF14]/10 text-[#39FF14] px-2 py-1 rounded border border-[#39FF14]/20 animate-pulse font-bold">
                FEED EN VIVO
              </span>
            )}
          </div>

          <AnimatePresence mode="popLayout">
            {isMatched ? (
              <div className="space-y-4">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-[#39FF14] text-black p-6 rounded-2xl flex items-center justify-between shadow-glow border border-white/10"
                >
                  <div>
                    <p className="text-[10px] font-mono uppercase font-black opacity-60 mb-1">Identidad del Operador</p>
                    <h4 className="text-2xl font-black uppercase italic tracking-tight">{activeRide.driverName}</h4>
                    <div className="flex items-center gap-1.5 mt-1 opacity-70">
                      <Shield size={14} className="fill-black" />
                      <span className="text-[10px] font-mono font-bold uppercase">Socio Verificado ZÉNITH PRO</span>
                    </div>
                    {activeRide.status === RideStatus.IN_PROGRESS && (
                      <div className="flex items-center gap-2 mt-3 bg-black/10 px-3 py-1 rounded-lg w-fit">
                        <Activity size={12} className="animate-pulse text-black" />
                        <span className="text-[9px] font-mono uppercase font-black">Transmitiendo GPS en Vivo</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-mono uppercase font-black opacity-60">Créditos Acordados</p>
                    <p className="text-3xl font-black italic mono-data">${activeRide.finalPrice}</p>
                    {activeRide.pricingSeal && (
                      <p className="text-[8px] font-mono uppercase font-black opacity-40 mt-1 truncate max-w-[120px]">{activeRide.pricingSeal}</p>
                    )}
                  </div>
                </motion.div>

                {/* Collapsible Real-time Communication Channel */}
                <div className="hud-card p-4 border-white/5 space-y-3">
                  <button
                    onClick={() => setShowChat(!showChat)}
                    className="w-full py-3 px-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl flex items-center justify-between transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquare size={16} className="text-[#39FF14]" />
                      <span className="uppercase text-[10px]">Coordinación de Operador en Vivo</span>
                    </div>
                    <span className="text-[#39FF14] text-[10px] font-black uppercase">
                      {showChat ? 'Ocultar Chat' : 'Abrir Chat'}
                    </span>
                  </button>
                  {showChat && (
                    <div className="pt-2">
                      <Chat rideId={activeRide.id} user={user} />
                    </div>
                  )}
                </div>

                {/* Secure Ride Sharing Component */}
                <ShareRide ride={activeRide} />

                {/* SOS Emergency Operations Button */}
                <SOSButton ride={activeRide} user={user} />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="hud-card p-6 border-white/5 bg-black/40 text-left space-y-6">
                  {/* Radar Scanning animation block */}
                  <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                    <div className="relative w-12 h-12 flex items-center justify-center rounded-full bg-[#39FF14]/10 shrink-0">
                      <Compass size={24} className="text-[#39FF14] animate-spin" style={{ animationDuration: '3s' }} />
                      <div className="absolute inset-0 rounded-full border border-[#39FF14]/30 animate-ping"></div>
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white uppercase italic tracking-tight">Escaner de Operadores Activo</h4>
                      <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest leading-none mt-1">
                        Sello Tarifa: {activeRide.pricingSeal?.substring(0, 10)}
                      </p>
                    </div>
                  </div>

                  {/* Operational Status Checklist (Zénith Zero-Trust Dispatch Pipeline) */}
                  <div className="space-y-3 font-mono text-[10px] uppercase">
                    {/* Step 1: Buscando Conductor */}
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          activeRide.status === RideStatus.SEARCHING_DRIVER 
                            ? 'bg-emerald-400 animate-ping' 
                            : 'bg-emerald-500'
                        }`} />
                        <span className={activeRide.status === RideStatus.SEARCHING_DRIVER ? 'text-white font-bold' : 'text-gray-500'}>
                          1. Buscando Conductor Cercano...
                        </span>
                      </div>
                      <span className="text-emerald-400 font-bold">ACTIVO</span>
                    </div>

                    {/* Step 2: Analizando Disponibilidad */}
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          activeRide.status === RideStatus.SEARCHING_DRIVER 
                            ? 'bg-emerald-400 animate-ping' 
                            : 'bg-emerald-500'
                        }`} />
                        <span className={activeRide.status === RideStatus.SEARCHING_DRIVER ? 'text-white font-bold' : 'text-gray-500'}>
                          2. Analizando Disponibilidad de Red...
                        </span>
                      </div>
                      <span className="text-emerald-400 font-bold">SINKING</span>
                    </div>

                    {/* Step 3: Asignando Conductor */}
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          activeRide.driverId && activeRide.status === RideStatus.SEARCHING_DRIVER
                            ? 'bg-amber-400 animate-ping'
                            : activeRide.status === RideStatus.DRIVER_ASSIGNED
                            ? 'bg-emerald-500'
                            : 'bg-gray-700'
                        }`} />
                        <span className={activeRide.driverId ? 'text-white font-bold' : 'text-gray-500'}>
                          3. Asignando conductor óptimo...
                        </span>
                      </div>
                      <span className={`font-bold ${
                        activeRide.driverId && activeRide.status === RideStatus.SEARCHING_DRIVER
                          ? 'text-amber-400 animate-pulse'
                          : activeRide.status === RideStatus.DRIVER_ASSIGNED
                          ? 'text-emerald-400'
                          : 'text-gray-600'
                      }`}>
                        {activeRide.driverId && activeRide.status === RideStatus.SEARCHING_DRIVER ? 'OFERTANDO (15S)' : activeRide.status === RideStatus.DRIVER_ASSIGNED ? 'COMPLETADO' : 'PENDIENTE'}
                      </span>
                    </div>

                    {/* Step 4: Conductor Encontrado */}
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          activeRide.status === RideStatus.DRIVER_ASSIGNED ? 'bg-emerald-400 animate-ping' : 'bg-gray-700'
                        }`} />
                        <span className={activeRide.status === RideStatus.DRIVER_ASSIGNED ? 'text-white font-bold' : 'text-gray-500'}>
                          4. Conductor Encontrado...
                        </span>
                      </div>
                      <span className={activeRide.status === RideStatus.DRIVER_ASSIGNED ? 'text-emerald-400 font-bold' : 'text-gray-600'}>
                        {activeRide.status === RideStatus.DRIVER_ASSIGNED ? 'SÍ (PRO)' : 'ESPERANDO'}
                      </span>
                    </div>

                    {/* Step 5: Conductor Aceptó */}
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          activeRide.status === RideStatus.DRIVER_ASSIGNED ? 'bg-emerald-400' : 'bg-gray-700'
                        }`} />
                        <span className={activeRide.status === RideStatus.DRIVER_ASSIGNED ? 'text-white font-bold' : 'text-gray-500'}>
                          5. Conductor Aceptó Tarifa...
                        </span>
                      </div>
                      <span className={activeRide.status === RideStatus.DRIVER_ASSIGNED ? 'text-emerald-400 font-bold' : 'text-gray-600'}>
                        {activeRide.status === RideStatus.DRIVER_ASSIGNED ? 'OK' : 'ESPERANDO'}
                      </span>
                    </div>

                    {/* Step 6: Operador en Camino */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-gray-700" />
                        <span className="text-gray-500">6. Operador en Camino...</span>
                      </div>
                      <span className="text-gray-600">PENDIENTE</span>
                    </div>
                  </div>

                  {/* Pricing Seal display */}
                  <div className="bg-[#39FF14]/5 border border-[#39FF14]/20 p-4 rounded-2xl flex justify-between items-center text-xs">
                    <div>
                      <p className="text-[8px] font-mono text-gray-500 uppercase leading-none">Tarifa Protegida Unificada</p>
                      <p className="text-xl font-black text-[#39FF14] font-mono mt-1">S/ {activeRide.protectedPrice?.toFixed(2)}</p>
                    </div>
                    <span className="px-2 py-0.5 text-[8px] font-mono bg-white/10 text-white rounded font-black uppercase tracking-wider">
                      Zero-Trust Secure
                    </span>
                  </div>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // MAIN SELECTION / PIPELINE FLOW
  return (
    <div className="space-y-8" id="passenger_creation_flow">
      {pipelineStep === 'idle' ? (
        <>
          {/* DEUDA PENDIENTE REGULARIZATION BANNER */}
          {user.pendingDebt && user.pendingDebt > 0 && (
            <div className="hud-card p-5 bg-red-500/15 border-2 border-red-500/40 rounded-3xl text-left space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-red-400 font-mono font-bold text-xs uppercase">
                  <AlertTriangle size={18} />
                  <span>Deuda Pendiente de Regularización</span>
                </div>
                <span className="text-sm font-mono font-black text-white bg-red-500/20 px-3 py-1 rounded-full border border-red-500/30">
                  S/ {user.pendingDebt.toFixed(2)}
                </span>
              </div>
              <p className="text-[11px] font-mono text-gray-300">
                Causa registrada: <strong className="text-white">{user.pendingDebtReason || 'Penalidad de cancelación previa'}</strong>. La regla de Zénith exige regularizar el saldo antes de emitir nuevas solicitudes.
              </p>
              <button
                onClick={handleClearDebt}
                disabled={clearingDebt}
                className="w-full py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-mono text-xs uppercase font-black tracking-wider transition-all shadow-glow-red cursor-pointer"
              >
                {clearingDebt ? 'Regularizando...' : 'Regularizar Saldo de Deuda Ahora'}
              </button>
            </div>
          )}

          {/* QUICK CTA: NUEVA OPERACIÓN MOTORIZADO ZÉNITH MVP V1.1 */}
          <div className="hud-card p-6 bg-gradient-to-r from-black/80 to-[#39FF14]/10 border border-[#39FF14]/30 rounded-3xl text-left flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#39FF14]/20 text-[#39FF14] font-black uppercase tracking-widest">
                MVP V1.1 OPERATIVO
              </span>
              <h3 className="text-lg font-black uppercase italic tracking-tight text-white">
                Nueva Operación de Entrega en Moto
              </h3>
              <p className="text-xs text-gray-400 font-mono">
                Control de 4 protagonistas, cláusula de contingencia, niveles de evidencia y custodia estipulada.
              </p>
            </div>
            <button
              onClick={() => setShowOrderCreationModal(true)}
              className="py-3 px-6 rounded-2xl bg-[#39FF14] hover:bg-[#32e012] text-black font-mono text-xs font-black uppercase tracking-wider shadow-glow flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <Package size={16} />
              Crear Operación
            </button>
          </div>

          <div className="hud-card p-8 space-y-6 bg-black/40 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <Navigation size={24} className="text-[#39FF14]" />
              <h2 className="text-3xl font-black uppercase italic tracking-tighter">Planificar Ruta</h2>
            </div>
            
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PlacesAutocomplete
                  placeholder="PUNTO DE ORIGEN"
                  value={origin.address}
                  onLocationSelect={(loc) => setOrigin(loc)}
                  icon={<MapPin size={18} className="text-[#39FF14]" />}
                />

                <PlacesAutocomplete
                  placeholder="DESTINO OBJETIVO"
                  value={destination.address}
                  onLocationSelect={(loc) => setDestination(loc)}
                  icon={<Navigation size={18} className="text-white/60" />}
                />
              </div>

              {user.favorites && user.favorites.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Favoritos:</span>
                  {user.favorites.map((fav) => (
                    <button
                      key={fav.id}
                      onClick={() => setDestination({ address: fav.address, lat: fav.lat, lng: fav.lng })}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-[#39FF14]/15 hover:text-[#39FF14] border border-white/10 hover:border-[#39FF14]/30 rounded-lg text-xs font-mono uppercase tracking-tight transition-all"
                    >
                      <MapPin size={10} className="text-[#39FF14]" />
                      <span>{fav.name}</span>
                    </button>
                  ))}
                </div>
              )}

              <button 
                onClick={executeSingleActionPipeline}
                disabled={!destination.address}
                className="w-full btn-tactical shadow-glow uppercase italic tracking-tighter text-lg py-5"
              >
                PAGAR Y PUBLICAR
              </button>
            </div>
          </div>

          {/* Scheduled Future Rides Panel */}
          <ScheduledRides user={user} />

          {/* PASSENGER PAYMENT CENTER V2 */}
          <div className="hud-card p-6 bg-black/50 border border-[#39FF14]/10 rounded-3xl space-y-4 text-left">
            <button
              onClick={() => setShowPaymentCenter(!showPaymentCenter)}
              className="w-full flex items-center justify-between font-bold text-sm uppercase tracking-wider text-white focus:outline-none cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <CreditCard size={18} className="text-[#39FF14]" />
                Centro de Pagos y Facturación Zénith
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-bold">{showPaymentCenter ? '▼' : '▲'}</span>
              </div>
            </button>

            <AnimatePresence>
              {showPaymentCenter && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 pt-4 border-t border-white/5 overflow-hidden"
                >
                  {/* Tabs */}
                  <div className="flex border-b border-white/5 pb-2 gap-2 text-xs">
                    <button
                      onClick={() => setPaymentCenterTab('history')}
                      className={`px-3 py-1.5 font-mono uppercase rounded-lg cursor-pointer ${paymentCenterTab === 'history' ? 'bg-[#39FF14]/20 text-[#39FF14]' : 'text-gray-400 hover:text-white'}`}
                    >
                      Historial
                    </button>
                    <button
                      onClick={() => setPaymentCenterTab('billing')}
                      className={`px-3 py-1.5 font-mono uppercase rounded-lg cursor-pointer ${paymentCenterTab === 'billing' ? 'bg-[#39FF14]/20 text-[#39FF14]' : 'text-gray-400 hover:text-white'}`}
                    >
                      Facturación
                    </button>
                  </div>

                  {/* Tab Content: History */}
                  {paymentCenterTab === 'history' && (
                    <div className="space-y-2">
                      <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest block border-b border-white/5 pb-1">Ledger De Viajes Realizados</span>
                      <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                        {pastRides.length === 0 ? (
                          <p className="text-xs font-mono text-gray-600 uppercase text-center py-4">No se registran viajes finalizados.</p>
                        ) : (
                          pastRides.map((r) => (
                            <div key={r.id} className="bg-neutral-900/60 border border-white/5 p-3 rounded-xl flex items-center justify-between text-xs">
                              <div>
                                <p className="text-white font-bold truncate max-w-[180px]">A: {r.destination.address}</p>
                                <p className="text-[9px] font-mono text-gray-500 uppercase mt-0.5">
                                  Método: {r.paymentMethod || 'Wallet'} · Estado: {r.paymentState || 'Settle'}
                                </p>
                              </div>
                              <span className="font-mono text-[#39FF14] font-black">
                                S/ {(r.finalPrice || r.protectedPrice || 0).toFixed(2)}
                              </span>
                            </div>
                          ))
                        )}
                        </div>
                        </div>
                  )}

                  {/* Tab Content: Billing */}
                  {paymentCenterTab === 'billing' && (
                    <div className="space-y-3">
                      <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest block border-b border-white/5 pb-1">Centro De Emisión De Comprobantes Electrónicos</span>
                      <p className="text-[10px] text-gray-400 uppercase">
                        Seleccione un viaje para emitir su Boleta de Venta o Factura Electrónica en tiempo real de acuerdo a la normativa fiscal.
                      </p>

                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {pastRides.length === 0 ? (
                          <p className="text-xs font-mono text-gray-600 uppercase text-center py-2">No hay viajes para facturar.</p>
                        ) : (
                          pastRides.map((r) => (
                            <div key={r.id} className="bg-neutral-900/40 border border-white/5 p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                              <div>
                                <p className="text-white font-bold truncate max-w-[150px]">Destino: {r.destination.address}</p>
                                <p className="text-[9px] font-mono text-gray-500 uppercase mt-0.5">
                                  ID: {r.id?.substring(0,8)} · Tarifa: S/ {(r.finalPrice || r.protectedPrice || 0).toFixed(2)}
                                </p>
                              </div>

                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    const rawText = `=========================================
EMPRESA OPERADORA ZÉNITH S.A.C.
R.U.C. 20601234567
BOLETA DE VENTA ELECTRÓNICA
=========================================
NÚMERO DE COMPROBANTE: B001-${Math.floor(Math.random() * 900000 + 100000)}
FECHA DE EMISIÓN: ${new Date().toLocaleDateString('es-PE')}
CLIENTE: ${user.fullName.toUpperCase()}
MÉTODO DE PAGO: ${(r.paymentMethod || 'wallet').toUpperCase()}
=========================================
DETALLE:
Servicio de transporte urbano - ZÉNITH Perú
De: ${r.origin.address}
A: ${r.destination.address}

-----------------------------------------
SUBTOTAL: S/ ${((r.finalPrice || r.protectedPrice || 0) / 1.18).toFixed(2)}
I.G.V. (18%): S/ ${((r.finalPrice || r.protectedPrice || 0) - ((r.finalPrice || r.protectedPrice || 0) / 1.18)).toFixed(2)}
TOTAL NETO: S/ ${(r.finalPrice || r.protectedPrice || 0).toFixed(2)}
=========================================
SELLO DIGITAL TÁCTICO:
${r.pricingSeal || 'ZÉNITH-TRUST-SEAL-VALIDATED'}
=========================================
¡Gracias por confiar en la Red Táctica Zénith!`;
                                    
                                    const blob = new Blob([rawText], { type: 'text/plain' });
                                    const link = document.createElement('a');
                                    link.href = URL.createObjectURL(blob);
                                    link.download = `Boleta_Zenith_${r.id?.substring(0,8)}.txt`;
                                    link.click();
                                  }}
                                  className="bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 px-2.5 py-1 rounded font-mono text-[9px] uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all"
                                >
                                  <Download size={10} /> Boleta
                                </button>

                                <button
                                  onClick={() => {
                                    const rawText = `=========================================
EMPRESA OPERADORA ZÉNITH S.A.C.
R.U.C. 20601234567
FACTURA ELECTRÓNICA
=========================================
NÚMERO DE COMPROBANTE: F001-${Math.floor(Math.random() * 900000 + 100000)}
FECHA DE EMISIÓN: ${new Date().toLocaleDateString('es-PE')}
RAZÓN SOCIAL: CORPORACIÓN TRUJILLO S.A.
R.U.C. CLIENTE: 20456123987
MÉTODO DE PAGO: ${(r.paymentMethod || 'wallet').toUpperCase()}
=========================================
DETALLE:
Servicio corporativo de transporte Zénith
De: ${r.origin.address}
A: ${r.destination.address}

-----------------------------------------
SUBTOTAL: S/ ${((r.finalPrice || r.protectedPrice || 0) / 1.18).toFixed(2)}
I.G.V. (18%): S/ ${((r.finalPrice || r.protectedPrice || 0) - ((r.finalPrice || r.protectedPrice || 0) / 1.18)).toFixed(2)}
TOTAL NETO: S/ ${(r.finalPrice || r.protectedPrice || 0).toFixed(2)}
=========================================
SELLO DIGITAL TÁCTICO FACTURADOR:
${r.pricingSeal || 'ZÉNITH-TRUST-SEAL-VALIDATED'}
=========================================
Representación impresa de la Factura Electrónica.
Consulte su comprobante en la web oficial.`;
                                    
                                    const blob = new Blob([rawText], { type: 'text/plain' });
                                    const link = document.createElement('a');
                                    link.href = URL.createObjectURL(blob);
                                    link.download = `Factura_Zenith_${r.id?.substring(0,8)}.txt`;
                                    link.click();
                                  }}
                                  className="bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 hover:border-blue-500/40 text-blue-400 px-2.5 py-1 rounded font-mono text-[9px] uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all"
                                >
                                  <Download size={10} /> Factura
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                        </div>
                        </div>
                  )}

                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      ) : (
        /* SINGLE INTEGRATED VOUCHER SCREEN */
        <div className="hud-card p-8 border-[#39FF14]/40 bg-black/40 backdrop-blur-xl space-y-6 relative overflow-hidden" id="single_voucher_view">
          {/* Subtle neon glowing scanning bar during calculations */}
          {pipelineStep === 'calculating' && (
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#39FF14] to-transparent animate-pulse"></div>
          )}

          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div className="flex items-center gap-3">
              <Shield className="text-[#39FF14] animate-pulse" size={24} />
              <div>
                <h3 className="text-xl font-black uppercase italic tracking-tight text-white">VOUCHER DE DESPLIEGUE OFICIAL</h3>
                <p className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">ZÉNITH OPERATIONAL PROTOCOL</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-mono bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/30 px-3 py-1 rounded-full font-black uppercase tracking-widest">
                {pipelineStep === 'calculating' && 'ESTIMANDO...'}
                {pipelineStep === 'voucher' && 'VALIDADO'}
                {pipelineStep === 'confirming_payment' && 'PROCESANDO PAGO'}
                {pipelineStep === 'creating_ride' && 'PUBLICANDO VIAJE'}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {/* Route summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                <p className="text-[9px] font-mono text-gray-500 uppercase">Origen de Tránsito</p>
                <p className="text-sm font-black uppercase italic text-white truncate">{origin.address}</p>
              </div>
              <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                <p className="text-[9px] font-mono text-gray-500 uppercase">Destino Objetivo</p>
                <p className="text-sm font-black uppercase italic text-white truncate">{destination.address}</p>
              </div>
            </div>

            {/* Calculations & Pricing Panel */}
            <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-4 relative">
              <div className="absolute top-3 right-3 opacity-10">
                <Cpu size={72} className="text-[#39FF14]" />
              </div>

              {pipelineStep === 'calculating' ? (
                <div className="py-10 flex flex-col items-center justify-center space-y-4">
                  <div className="w-10 h-10 border-2 border-[#39FF14] border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs font-mono text-[#39FF14] uppercase tracking-widest animate-pulse font-black">
                    Sincronizando con el Pricing Engine...
                  </p>
                </div>
              ) : pricing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-left">
                    <div>
                      <p className="text-[9px] font-mono text-gray-500 uppercase">Distancia de Ruta</p>
                      <p className="text-xl font-black text-white italic mono-data">{pricing.distance} KM</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-mono text-gray-500 uppercase">Tiempo Estimado</p>
                      <p className="text-xl font-black text-white italic mono-data">{pricing.duration} MIN</p>
                    </div>
                  </div>

                  {/* PAYMENT METHOD CHOICES */}
                  <div className="border-t border-white/5 pt-4 text-left">
                    <p className="text-[9px] font-mono text-gray-500 uppercase font-black tracking-widest mb-2">Seleccione Método de Pago (Directo al Conductor)</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        onClick={() => setSelectedMethod('yape')}
                        className={`py-2 px-3 border rounded-xl flex flex-col items-center gap-1 cursor-pointer transition-all ${selectedMethod === 'yape' ? 'bg-purple-600/10 border-purple-500 text-purple-400' : 'bg-black/30 border-white/10 text-white hover:border-white/20'}`}
                      >
                        <QrCode size={14} />
                        <span className="text-[9px] font-mono font-bold uppercase">Yape</span>
                      </button>
                      <button
                        onClick={() => setSelectedMethod('plin')}
                        className={`py-2 px-3 border rounded-xl flex flex-col items-center gap-1 cursor-pointer transition-all ${selectedMethod === 'plin' ? 'bg-cyan-600/10 border-cyan-500 text-cyan-400' : 'bg-black/30 border-white/10 text-white hover:border-white/20'}`}
                      >
                        <QrCode size={14} />
                        <span className="text-[9px] font-mono font-bold uppercase">Plin</span>
                      </button>
                      <button
                        onClick={() => setSelectedMethod('card')}
                        className={`py-2 px-3 border rounded-xl flex flex-col items-center gap-1 cursor-pointer transition-all ${selectedMethod === 'card' ? 'bg-blue-600/10 border-blue-500 text-blue-400' : 'bg-black/30 border-white/10 text-white hover:border-white/20'}`}
                      >
                        <CreditCard size={14} />
                        <span className="text-[9px] font-mono font-bold uppercase">Tarjeta</span>
                      </button>
                      <button
                        onClick={() => setSelectedMethod('cash')}
                        className={`py-2 px-3 border rounded-xl flex flex-col items-center gap-1 cursor-pointer transition-all ${selectedMethod === 'cash' ? 'bg-emerald-600/10 border-emerald-500 text-emerald-400' : 'bg-black/30 border-white/10 text-white hover:border-white/20'}`}
                      >
                        <DollarSign size={14} />
                        <span className="text-[9px] font-mono font-bold uppercase">Efectivo</span>
                      </button>
                    </div>
                  </div>

                  {/* PROMO CODE BOX */}
                  <div className="border-t border-white/5 pt-4 text-left">
                    <p className="text-[9px] font-mono text-gray-500 uppercase font-black tracking-widest mb-2">Cupón / Código Promocional</p>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        placeholder="Escriba código (ej: TRUJILLO5, ZENITHPROMO)"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                        className="bg-black border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-[#39FF14] uppercase focus:outline-none focus:border-[#39FF14]"
                      />
                      <button
                        onClick={() => {
                          if (promoCode === 'TRUJILLO5') {
                            setAppliedPromo({ code: 'TRUJILLO5', value: 5.00, type: 'flat' });
                          } else if (promoCode === 'ZENITHPROMO') {
                            setAppliedPromo({ code: 'ZENITHPROMO', value: 10.00, type: 'flat' });
                          } else {
                            alert('Código promocional inválido.');
                          }
                        }}
                        className="bg-[#39FF14]/10 hover:bg-[#39FF14]/20 border border-[#39FF14]/30 px-4 rounded-xl font-mono text-[9px] text-[#39FF14] uppercase tracking-widest cursor-pointer"
                      >
                        Aplicar
                      </button>
                    </div>
                    {appliedPromo && (
                      <p className="text-[9px] font-mono text-emerald-400 mt-1.5 font-bold">
                        ✓ Cupón aplicado: {appliedPromo.code} (-S/ {appliedPromo.value.toFixed(2)})
                      </p>
                    )}
                  </div>

                  <div className="flex justify-between items-center border-t border-white/5 pt-4">
                    <div>
                      <p className="text-[9px] font-mono text-gray-500 uppercase">Sello de Tarifa Protegido</p>
                      <div className="flex items-center gap-1.5 text-gray-400 mt-1">
                        <Lock size={12} className="text-[#39FF14]" />
                        <span className="text-xs font-mono font-black text-[#39FF14]">{pricing.seal}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-mono text-gray-500 uppercase font-black">Tarifa Oficial Zénith</p>
                      <p className="text-4xl font-black text-[#39FF14] italic mono-data">
                        S/ {Math.max(0, Number((pricing.totalFare - (appliedPromo ? appliedPromo.value : 0)).toFixed(2)))}
                      </p>
                      {appliedPromo && (
                        <p className="text-[9px] font-mono text-gray-500 line-through">Antes: S/ {pricing.totalFare.toFixed(2)}</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Error messaging inside Checkout */}
            {paymentError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-left flex items-start gap-3">
                <AlertTriangle className="text-red-400 shrink-0 mt-0.5 animate-bounce" size={16} />
                <p className="text-xs text-red-300 font-mono font-bold uppercase">{paymentError}</p>
              </div>
            )}

            {/* Live Pipeline Step Indicator logs */}
            <div className="bg-black/30 p-4 rounded-xl border border-white/5 text-[10px] font-mono text-gray-400 space-y-2">
              <div className="flex items-center justify-between">
                <span>1. CÁLCULO DE TARIFA OFICIAL</span>
                <span className="text-green-500 flex items-center gap-1"><Check size={10} /> COMPLETADO</span>
              </div>
              <div className="flex items-center justify-between">
                <span>2. EMISIÓN DE VOUCHER PROTEGIDO</span>
                <span className="text-green-500 flex items-center gap-1"><Check size={10} /> COMPLETADO</span>
              </div>
              <div className="flex items-center justify-between">
                <span>3. AUTORIZACIÓN DE PAGO DE CRÉDITOS</span>
                {pipelineStep === 'confirming_payment' ? (
                  <span className="text-[#39FF14] animate-pulse font-black">CONFIRMANDO CARGO...</span>
                ) : pipelineStep === 'creating_ride' ? (
                  <span className="text-green-500 flex items-center gap-1"><Check size={10} /> COMPLETADO</span>
                ) : (
                  <span className="text-gray-600">PENDIENTE DE SELECCIÓN</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span>4. PUBLICACIÓN EN COLA FIRESTORE</span>
                {pipelineStep === 'creating_ride' ? (
                  <span className="text-[#39FF14] animate-pulse font-black">CREANDO DOCUMENTO EN /RIDES...</span>
                ) : (
                  <span className="text-gray-600">PENDIENTE</span>
                )}
              </div>
            </div>

            {/* Checkout control actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setPipelineStep('idle');
                  setPricing(null);
                  setAppliedPromo(null);
                  setPromoCode('');
                  setPaymentError(null);
                }}
                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-2xl px-6 py-5 text-sm font-black uppercase tracking-widest cursor-pointer transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmPaymentAndPublishRide}
                disabled={pipelineStep === 'confirming_payment' || pipelineStep === 'creating_ride'}
                className="flex-1 bg-[#39FF14] hover:bg-[#39FF14]/90 text-black font-black uppercase italic tracking-tighter text-lg py-5 rounded-2xl shadow-glow cursor-pointer hover:scale-[1.01] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Lock size={18} /> Confirmar Pago y Publicar Viaje
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Map displaying the selected markers */}
      <MapContainer 
        height="350px" 
        center={{ lat: origin.lat, lng: origin.lng }}
        markers={[
          { id: 'origin', position: origin, color: '#39FF14', title: 'Origen' },
          ...(destination.address ? [{ id: 'dest', position: destination, color: '#FFFFFF', title: 'Destino' }] : [])
        ]}
        onMapClick={(e) => {
          if (e.latLng && pipelineStep === 'idle') {
            const clickedLat = e.latLng.lat();
            const clickedLng = e.latLng.lng();
            const addr = `${clickedLat.toFixed(4)}, ${clickedLng.toFixed(4)}`;
            setDestination({ address: addr, lat: clickedLat, lng: clickedLng });
          }
        }}
      />
      {/* ZÉNITH MVP V1.1 ORDER CREATION MODAL */}
      {showOrderCreationModal && (
        <ZenithOrderCreationModal
          user={user}
          initialOrigin={origin}
          onClose={() => setShowOrderCreationModal(false)}
          onOrderCreated={(orderId) => {
            setShowOrderCreationModal(false);
            console.log('[ZENITH-ORDER-CREATED]', orderId);
          }}
        />
      )}
    </div>
  );
}
