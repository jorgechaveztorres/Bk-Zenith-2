import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, query, where, onSnapshot, doc, serverTimestamp, setDoc, limit, getDoc } from 'firebase/firestore';
import { DriverService } from '../../services/DriverService';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Car, 
  DollarSign, 
  Star, 
  Wifi, 
  WifiOff, 
  Compass, 
  Navigation, 
  AlertTriangle, 
  Check, 
  TrendingUp, 
  Send,
  Battery,
  MapPin,
  ShieldAlert,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  Lock,
  RefreshCw
} from 'lucide-react';
import { User, Ride, RideStatus } from '../../types';
import { NotificationService } from '../../services/NotificationService';
import { DriverPresenceService } from '../../services/DriverPresenceService';
import { Assignment } from '../../services/AssignmentRepository';
import RideAssignmentCard from './RideAssignmentCard';
import { WalletService } from '../../services/WalletService';
import { SettlementEngine } from '../../services/SettlementEngine';

interface DriverDashboardProps {
  user: User;
  onSelectRide: (ride: Ride) => void;
  myAcceptedRide: Ride | null;
}

export default function DriverDashboard({ user, onSelectRide, myAcceptedRide }: DriverDashboardProps) {
  const [online, setOnline] = useState(user.driverProfile?.availability || false);
  const [loading, setLoading] = useState(false);
  const [radarRides, setRadarRides] = useState<Ride[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Financial Wallet V2 states
  const [driverWallet, setDriverWallet] = useState<any>(null);
  const [showWalletDetails, setShowWalletDetails] = useState(false);
  const [bankAccount, setBankAccount] = useState('');
  const [settlementSuccessMsg, setSettlementSuccessMsg] = useState<string | null>(null);
  const [settlementErrorMsg, setSettlementErrorMsg] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);

  // Load Wallet
  const loadWallet = async () => {
    try {
      const w = await WalletService.getOrCreateWallet(user.uid);
      setDriverWallet(w);
    } catch (e) {
      console.error("[ZENITH-DASHBOARD] Error loading wallet:", e);
    }
  };

  useEffect(() => {
    loadWallet();
  }, [user.uid]);

  // Simulación de Hardware del Operador (Hardware Control Cockpit para pruebas)
  const [simulatedBattery, setSimulatedBattery] = useState(85); // 85%
  const [simulatedGpsActive, setSimulatedGpsActive] = useState(true);
  const [simulatedInternet, setSimulatedInternet] = useState(true);

  // Asignaciones directas en vivo para este conductor
  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(null);
  const [activeAssignmentRide, setActiveAssignmentRide] = useState<Ride | null>(null);

  // 1. Escuchar asignaciones activas (OFFERED) dirigidas a este conductor
  useEffect(() => {
    if (!online) {
      setActiveAssignment(null);
      setActiveAssignmentRide(null);
      return;
    }

    const q = query(
      collection(db, 'assignments'),
      where('driverId', '==', user.uid),
      where('status', '==', 'OFFERED')
    );

    const unsubscribe = onSnapshot(q, async (snap) => {
      if (snap.empty) {
        setActiveAssignment(null);
        setActiveAssignmentRide(null);
        return;
      }

      const asg = snap.docs[0].data() as Assignment;
      setActiveAssignment(asg);

      // Cargar información del viaje asociado de forma reactiva
      const rideRef = doc(db, 'rides', asg.rideId);
      const rideSnap = await getDoc(rideRef);
      if (rideSnap.exists()) {
        setActiveAssignmentRide(rideSnap.data() as Ride);
      }
    });

    return () => unsubscribe();
  }, [online, user.uid]);

  // 2. Escuchar viajes disponibles de radar (Zénith Radar de Trujillo)
  useEffect(() => {
    if (!online || myAcceptedRide) {
      setRadarRides([]);
      return;
    }
    const q = query(
      collection(db, 'rides'),
      where('status', '==', RideStatus.SEARCHING_DRIVER),
      limit(10)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRadarRides(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Ride)));
    });
    return () => unsubscribe();
  }, [online, myAcceptedRide]);

  // Actualización periódica simulada de GPS en segundo plano cuando está en línea
  useEffect(() => {
    if (!online) return;

    const interval = setInterval(async () => {
      // Coordenadas simuladas en Trujillo (Centro histórico)
      const randomOffsetLat = (Math.random() - 0.5) * 0.001;
      const randomOffsetLng = (Math.random() - 0.5) * 0.001;
      const lat = -8.1118 + randomOffsetLat;
      const lng = -79.0287 + randomOffsetLng;

      await DriverPresenceService.updateLocation(user.uid, {
        lat,
        lng,
        speed: Math.round(Math.random() * 40),
        heading: Math.round(Math.random() * 360),
        batteryLevel: simulatedBattery / 100,
        hasInternet: simulatedInternet,
        isGpsActive: simulatedGpsActive
      });
    }, 10000); // Cada 10s

    return () => clearInterval(interval);
  }, [online, user.uid, simulatedBattery, simulatedGpsActive, simulatedInternet]);

  const toggleOnlineState = async () => {
    setLoading(true);
    setErrorMessage(null);
    const nextState = !online;

    try {
      if (nextState) {
        // Validación Zero-Trust del motor al ponerse en línea
        const result = await DriverPresenceService.goOnline(user, {
          lat: -8.1118,
          lng: -79.0287,
          speed: 0,
          heading: 0,
          gpsPrecision: 'high',
          batteryLevel: simulatedBattery / 100,
          hasInternet: simulatedInternet,
          isGpsActive: simulatedGpsActive
        });

        if (result.allowed) {
          setOnline(true);
        } else {
          setErrorMessage(result.reason || 'No se pudo conectar.');
        }
      } else {
        await DriverPresenceService.goOffline(user.uid);
        setOnline(false);
      }
    } catch (err: any) {
      console.error("[Dashboard] Failed to change state:", err);
      setErrorMessage('Error de conexión con el nodo de despacho.');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRide = async (ride: Ride) => {
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
    } catch (error) {
      console.error("[Dashboard] Error accepting ride:", error);
    } finally {
      setLoading(false);
    }
  };

  const balance = user.wallet?.availableBalance || 0;
  const rating = user.driverProfile?.rating || 5.0;
  const vehicle = user.driverProfile?.vehicle;

  return (
    <div className="space-y-6">
      
      {/* Hardware Simulation Cockpit & Zero-Trust Checks */}
      <div className="bg-neutral-900/50 border border-white/5 rounded-3xl p-5 space-y-4 text-left">
        <div className="flex items-center gap-1.5 text-cyan-400 font-mono text-[9px] font-black uppercase tracking-widest">
          <Battery size={14} className="animate-pulse" /> Panel de Simulación Física del Terminal (Pruebas)
        </div>
        <p className="text-[10px] text-gray-500 uppercase leading-relaxed">
          Use estos controles para simular fallos de hardware en el dispositivo del operador. El Smart Dispatch Engine requiere batería &gt;= 15%, GPS activo, e Internet funcional para autorizar operaciones.
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          {/* Battery Slider */}
          <div className="bg-black/30 border border-white/5 p-3 rounded-xl space-y-2">
            <div className="flex justify-between items-center text-[9px] font-mono text-gray-400 uppercase">
              <span>Batería: {simulatedBattery}%</span>
              <span className={simulatedBattery < 15 ? 'text-red-500 font-bold animate-pulse' : 'text-emerald-400'}>
                {simulatedBattery < 15 ? 'CRÍTICO' : 'NORMAL'}
              </span>
            </div>
            <input 
              type="range" 
              min="5" 
              max="100" 
              value={simulatedBattery}
              onChange={(e) => setSimulatedBattery(Number(e.target.value))}
              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#39FF14]"
            />
          </div>

          {/* GPS Toggle */}
          <label className="bg-black/30 border border-white/5 p-3 rounded-xl flex items-center justify-between cursor-pointer select-none">
            <span className="text-[9px] font-mono text-gray-400 uppercase">Señal GPS Activa</span>
            <input 
              type="checkbox" 
              checked={simulatedGpsActive}
              onChange={(e) => setSimulatedGpsActive(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-350 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#39FF14] relative after:transition-all"></div>
          </label>

          {/* Internet Toggle */}
          <label className="bg-black/30 border border-white/5 p-3 rounded-xl flex items-center justify-between cursor-pointer select-none">
            <span className="text-[9px] font-mono text-gray-400 uppercase">Internet Estable</span>
            <input 
              type="checkbox" 
              checked={simulatedInternet}
              onChange={(e) => setSimulatedInternet(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-350 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#39FF14] relative after:transition-all"></div>
          </label>
        </div>
      </div>

      {/* Error Alert Message */}
      {errorMessage && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-left flex items-start gap-3">
          <ShieldAlert className="text-red-400 shrink-0 mt-0.5 animate-bounce" size={16} />
          <div className="space-y-0.5">
            <p className="text-[10px] font-mono text-red-400 font-bold uppercase tracking-wider">ERROR DE ADMISIÓN OPERATIVA</p>
            <p className="text-xs text-white/90">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Prominent Active Assignment Card (15-second Offer) */}
      {activeAssignment && activeAssignmentRide && (
        <div className="py-2">
          <RideAssignmentCard 
            assignment={activeAssignment}
            ride={activeAssignmentRide}
            onProcessed={() => {
              setActiveAssignment(null);
              setActiveAssignmentRide(null);
            }}
          />
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Wallet Balance Card - Interactive */}
        <button 
          onClick={() => setShowWalletDetails(!showWalletDetails)}
          className="bg-neutral-900 border border-white/5 rounded-2xl p-4 flex items-center justify-between hover:border-[#39FF14]/30 hover:bg-neutral-900/80 transition-all text-left w-full cursor-pointer focus:outline-none"
        >
          <div>
            <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest block flex items-center gap-1">
              <Wallet size={10} className="text-[#39FF14]" />
              Billetera Zénith
            </span>
            <span className="text-2xl font-black text-[#39FF14] mt-1 block">
              S/ {(driverWallet?.availableBalance !== undefined ? driverWallet.availableBalance : balance).toFixed(2)}
            </span>
            <span className="text-[9px] font-mono text-gray-400 underline decoration-dotted">Ver centro financiero</span>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${showWalletDetails ? 'bg-[#39FF14] text-black' : 'bg-[#39FF14]/10 text-[#39FF14]'}`}>
            <DollarSign size={20} />
          </div>
        </button>

        {/* Rating Card */}
        <div className="bg-neutral-900 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest block">Reputación</span>
            <span className="text-2xl font-black text-white mt-1 block flex items-center gap-1">
              {rating.toFixed(1)} <Star className="text-[#39FF14] fill-[#39FF14]" size={18} />
            </span>
            <span className="text-[9px] font-mono text-gray-400">Operador Certificado</span>
          </div>
          <div className="w-10 h-10 bg-[#39FF14]/10 rounded-xl flex items-center justify-center">
            <Star className="text-[#39FF14]" size={20} />
          </div>
        </div>

        {/* Vehicle Card */}
        <div className="bg-neutral-900 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest block">Unidad de Tránsito</span>
            <span className="text-sm font-black text-white mt-2 block uppercase truncate max-w-[150px]">
              {vehicle?.brand} {vehicle?.model}
            </span>
            <span className="text-[10px] font-mono text-[#39FF14] uppercase tracking-wider">{vehicle?.plate}</span>
          </div>
          <div className="w-10 h-10 bg-[#39FF14]/10 rounded-xl flex items-center justify-center">
            <Car className="text-[#39FF14]" size={20} />
          </div>
        </div>
      </div>

      {/* DRIVER FINANCIAL WALLET CENTER V2 */}
      <AnimatePresence>
        {showWalletDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden space-y-4"
          >
            <div className="bg-black/60 border border-[#39FF14]/20 rounded-3xl p-6 text-left space-y-6">
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                <div>
                  <h4 className="text-md font-bold uppercase tracking-tight flex items-center gap-2 text-[#39FF14]">
                    <Wallet size={18} /> Centro Financiero del Operador V2
                  </h4>
                  <p className="text-[10px] font-mono text-gray-400 mt-1 uppercase">
                    Administración de ingresos, comisiones aplicadas y solicitudes de liquidación bancaria directa.
                  </p>
                </div>
                <button 
                  onClick={loadWallet}
                  className="px-3 py-1.5 bg-white/5 border border-white/10 hover:border-white/20 text-white rounded-lg font-mono text-[9px] uppercase tracking-widest flex items-center gap-1 cursor-pointer transition-all shrink-0"
                >
                  <RefreshCw size={10} className="animate-spin" /> Actualizar balances
                </button>
              </div>

              {/* Grid of Balances */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                
                {/* Available Balance */}
                <div className="bg-neutral-900/60 border border-white/5 p-4 rounded-2xl">
                  <span className="text-[8px] font-mono text-gray-500 uppercase tracking-widest">Saldo disponible</span>
                  <p className="text-lg font-black text-[#39FF14] mt-1 font-mono">
                    S/ {(driverWallet?.availableBalance || 0).toFixed(2)}
                  </p>
                  <span className="text-[8px] font-mono text-gray-400 block mt-1">Saldos para liquidar inmediatamente</span>
                </div>

                {/* Retained Balance */}
                <div className="bg-neutral-900/60 border border-white/5 p-4 rounded-2xl">
                  <span className="text-[8px] font-mono text-gray-500 uppercase tracking-widest">Saldo retenido</span>
                  <p className="text-lg font-black text-gray-400 mt-1 font-mono">
                    S/ {(driverWallet?.retainedBalance || 0).toFixed(2)}
                  </p>
                  <span className="text-[8px] font-mono text-yellow-500/80 block mt-1">Garantía por devoluciones</span>
                </div>

                {/* Cash Debt / Credit Limit */}
                <div className="bg-neutral-900/60 border border-white/5 p-4 rounded-2xl">
                  <span className="text-[8px] font-mono text-gray-500 uppercase tracking-widest">Deuda por efectivo</span>
                  <p className={`text-lg font-black mt-1 font-mono ${(driverWallet?.cashDebt || 0) > 40 ? 'text-red-400' : 'text-white'}`}>
                    S/ {(driverWallet?.cashDebt || 0).toFixed(2)}
                  </p>
                  <span className="text-[8px] font-mono text-gray-400 block mt-1">Por comisión en viajes efectivo</span>
                </div>

                {/* Platform Commission Accrued */}
                <div className="bg-neutral-900/60 border border-white/5 p-4 rounded-2xl">
                  <span className="text-[8px] font-mono text-gray-500 uppercase tracking-widest">Comisiones acumuladas</span>
                  <p className="text-lg font-black text-white mt-1 font-mono">
                    S/ {(driverWallet?.accumulatedCommission || 0).toFixed(2)}
                  </p>
                  <span className="text-[8px] font-mono text-[#39FF14] block mt-1">Comisión del 15% recolectada</span>
                </div>

              </div>

              {/* Earnings breakdown row */}
              <div className="grid grid-cols-3 gap-3 border-t border-white/5 pt-4">
                <div className="text-center bg-black/40 p-2.5 rounded-xl border border-white/5">
                  <span className="text-[8px] font-mono text-gray-500 uppercase tracking-widest">Hoy</span>
                  <p className="text-sm font-black text-white mt-0.5 font-mono">S/ {(driverWallet?.dailyEarnings || 0).toFixed(2)}</p>
                </div>
                <div className="text-center bg-black/40 p-2.5 rounded-xl border border-white/5">
                  <span className="text-[8px] font-mono text-gray-500 uppercase tracking-widest">Esta semana</span>
                  <p className="text-sm font-black text-white mt-0.5 font-mono">S/ {(driverWallet?.weeklyEarnings || 0).toFixed(2)}</p>
                </div>
                <div className="text-center bg-black/40 p-2.5 rounded-xl border border-white/5">
                  <span className="text-[8px] font-mono text-gray-500 uppercase tracking-widest">Este mes</span>
                  <p className="text-sm font-black text-[#39FF14] mt-0.5 font-mono">S/ {(driverWallet?.monthlyEarnings || (driverWallet?.weeklyEarnings * 4) || 0).toFixed(2)}</p>
                </div>
              </div>

              {/* Settlement Payout Console */}
              <div className="bg-neutral-950/80 border border-white/5 rounded-2xl p-5 space-y-4">
                <h5 className="text-[10px] font-mono font-black text-[#39FF14] uppercase tracking-wider flex items-center gap-1.5">
                  <Lock size={12} /> Consola de Transferencia Bancaria y Liquidaciones
                </h5>
                <p className="text-[11px] text-gray-400">
                  Transfiera sus fondos disponibles directamente a su cuenta bancaria en tiempo real (mínimo S/. 10.00). La conciliación de firmas de viaje se ejecuta de forma asíncrona para Zero-Trust.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <input 
                      type="text"
                      placeholder="Ingrese número de cuenta (CCI, BCP, BBVA)"
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-xs font-mono text-[#39FF14] focus:outline-none focus:border-[#39FF14] transition-all"
                    />
                  </div>
                  <button
                    disabled={settling || !bankAccount || (driverWallet?.availableBalance || 0) < 10}
                    onClick={async () => {
                      setSettling(true);
                      setSettlementErrorMsg(null);
                      setSettlementSuccessMsg(null);
                      try {
                        const result = await SettlementEngine.executeAutomaticSettlement(user.uid, bankAccount);
                        if (result.success) {
                          setSettlementSuccessMsg(result.message);
                          setBankAccount('');
                          await loadWallet();
                        } else {
                          setSettlementErrorMsg(result.message);
                        }
                      } catch (err: any) {
                        setSettlementErrorMsg(err.message || 'Error al procesar la liquidación.');
                      } finally {
                        setSettling(false);
                      }
                    }}
                    className="bg-[#39FF14] text-black font-black uppercase text-[10px] tracking-widest rounded-xl px-6 py-3 cursor-pointer hover:shadow-glow hover:scale-[1.01] transition-all disabled:opacity-40 disabled:cursor-not-allowed text-center"
                  >
                    {settling ? 'Procesando...' : 'Solicitar Liquidación Instantánea'}
                  </button>
                </div>

                {settlementSuccessMsg && (
                  <p className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider font-bold">
                    ✓ {settlementSuccessMsg}
                  </p>
                )}
                {settlementErrorMsg && (
                  <p className="text-[10px] font-mono text-red-400 uppercase tracking-wider font-bold">
                    ⚠️ {settlementErrorMsg}
                  </p>
                )}
              </div>

              {/* Transactions Ledger History */}
              <div className="space-y-3">
                <h5 className="text-[10px] font-mono text-gray-500 uppercase tracking-widest font-black border-b border-white/5 pb-2">
                  Historial del Ledger y Compensaciones
                </h5>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                  {(!driverWallet?.movements || driverWallet.movements.length === 0) ? (
                    <p className="text-xs font-mono text-gray-600 uppercase py-4 text-center">No se registran movimientos financieros activos.</p>
                  ) : (
                    driverWallet.movements.map((mov: any, idx: number) => (
                      <div key={mov.id || idx} className="bg-black/30 border border-white/5 p-3 rounded-xl flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg ${
                            mov.type === 'deposit' || mov.type === 'ride_earning' || mov.type === 'cash_compensation'
                              ? 'bg-emerald-500/10 text-emerald-400' 
                              : 'bg-red-500/10 text-red-400'
                          }`}>
                            {mov.type === 'deposit' || mov.type === 'ride_earning' || mov.type === 'cash_compensation' ? (
                              <ArrowDownLeft size={14} />
                            ) : (
                              <ArrowUpRight size={14} />
                            )}
                          </div>
                          <div>
                            <p className="text-white font-bold">{mov.description}</p>
                            <p className="text-[9px] font-mono text-gray-500 mt-0.5 flex items-center gap-1">
                              <Clock size={8} /> 
                              {mov.createdAt?.seconds 
                                ? new Date(mov.createdAt.seconds * 1000).toLocaleString('es-ES')
                                : new Date().toLocaleString('es-ES')
                              }
                            </p>
                          </div>
                        </div>
                        <span className={`font-mono font-bold ${
                          mov.type === 'deposit' || mov.type === 'ride_earning' || mov.type === 'cash_compensation'
                            ? 'text-[#39FF14]' 
                            : 'text-red-400'
                        }`}>
                          {mov.type === 'deposit' || mov.type === 'ride_earning' || mov.type === 'cash_compensation' ? '+' : '-'} S/ {Math.abs(mov.amount).toFixed(2)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Online Toggle Cockpit */}
      <div className="bg-[#0c0c0c] border border-white/10 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold uppercase tracking-tight flex items-center gap-2">
            {online ? (
              <>
                <Wifi className="text-[#39FF14] animate-pulse" size={18} />
                <span>ESTADO: EN LÍNEA</span>
              </>
            ) : (
              <>
                <WifiOff className="text-gray-500" size={18} />
                <span>ESTADO: FUERA DE LÍNEA</span>
              </>
            )}
          </h3>
          <p className="text-xs text-gray-400 font-mono mt-1 uppercase">
            {online ? 'Escaneando coordenadas de Trujillo para solicitudes activas.' : 'Inactivo. Presione para quedar disponible para recibir pasajeros.'}
          </p>
        </div>

        <button
          disabled={loading}
          onClick={toggleOnlineState}
          className={`px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer hover:shadow-glow ${
            online 
              ? 'bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20' 
              : 'bg-[#39FF14] text-black shadow-glow'
          }`}
        >
          {online ? 'Desconectarse' : 'Entrar en línea'}
        </button>
      </div>

      {/* Live Radar Display */}
      {online && (
        <div className="space-y-3">
          <h4 className="text-xs font-mono uppercase tracking-wider text-[#39FF14] flex items-center gap-2">
            <Compass size={14} className="animate-spin" />
            <span>RADAR TÁCTICO DE TRUJILLO</span>
          </h4>
          
          <AnimatePresence>
            {radarRides.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-neutral-950 border border-white/5 rounded-2xl p-8 text-center"
              >
                <Navigation className="text-gray-600 mx-auto mb-2 animate-bounce" size={24} />
                <span className="text-xs font-mono text-gray-500 uppercase">Sin solicitudes entrantes en su cuadrante...</span>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {radarRides.map((ride) => (
                  <motion.div
                    key={ride.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-neutral-900 border border-white/5 rounded-2xl p-4 flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-gray-500">TARIFA PROTEGIDA</span>
                        <span className="text-[#39FF14] font-black text-sm">S/ {ride.protectedPrice.toFixed(2)}</span>
                      </div>
                      <div className="mt-2 space-y-1 text-xs">
                        <p className="text-gray-300 truncate"><strong className="text-gray-500 font-mono text-[9px] mr-1">DE:</strong> {ride.origin.address}</p>
                        <p className="text-gray-300 truncate"><strong className="text-gray-500 font-mono text-[9px] mr-1">A:</strong> {ride.destination.address}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAcceptRide(ride)}
                      className="w-full py-2 bg-[#39FF14] text-black font-black text-[10px] uppercase tracking-wider rounded-xl hover:shadow-glow transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Send size={12} /> Aceptar Viaje
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

    </div>
  );
}
