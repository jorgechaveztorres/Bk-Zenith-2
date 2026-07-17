import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, Ride, RideStatus } from './types';
import Auth from './components/Auth';
import ClientOnboarding from './components/ClientOnboarding';
import PassengerFlow from './components/PassengerFlow';
import DriverFlow from './components/DriverFlow';
import ControlCenter from './components/ControlCenter';
import PromptHelper from './components/PromptHelper';
import SimulationLab from './lso/components/SimulationLab';
import DevObservabilityHUD from './components/DevObservabilityHUD';
import AdminDashboard from './components/admin/AdminDashboard';
import { LoggingService } from './services/LoggingService';
import { ObservabilityService } from './services/ObservabilityService';
import { LogOut, User as UserIcon, Car, Menu, Settings, Bell, Compass, Activity, ShieldAlert, FlaskConical, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from './firebase/config';
import { doc, getDoc, setDoc, collection, query, where, onSnapshot, limit, orderBy } from 'firebase/firestore';
import { APIProvider } from '@vis.gl/react-google-maps';
import { API_KEY } from './components/MapContainer';

interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'alert';
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [activeModule, setActiveModule] = useState<'service' | 'control_center' | 'lso' | 'admin'>('service');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Performance render tracker
  const renderStartTimeRef = useRef<number>(Date.now());
  renderStartTimeRef.current = Date.now();

  useEffect(() => {
    const duration = Date.now() - renderStartTimeRef.current;
    ObservabilityService.trackRenderTime(Math.max(1, duration));
  });

  const handleModuleChange = (module: 'service' | 'control_center' | 'lso' | 'admin') => {
    ObservabilityService.startNavigation();
    LoggingService.info('NAVIGATION', `Navegación de módulo: ${activeModule.toUpperCase()} -> ${module.toUpperCase()}`);
    setActiveModule(module);
    setTimeout(() => {
      ObservabilityService.completeNavigation();
    }, 120);
  };

  // Refs to avoid duplicate notifications on load
  const lastActiveRideStatus = useRef<string | null>(null);
  const lastActiveRideId = useRef<string | null>(null);
  const seenRadarRideIds = useRef<Set<string>>(new Set());

  const toggleRole = async () => {
    if (!currentUser) return;
    const newRole = currentUser.role === UserRole.DRIVER ? UserRole.PASSENGER : UserRole.DRIVER;
    try {
      await setDoc(doc(db, 'users', currentUser.uid), { role: newRole }, { merge: true });
      setCurrentUser({
        ...currentUser,
        role: newRole
      });
    } catch (err) {
      console.error("Failed to switch role:", err);
    }
  };

  // Listen to Auth State and User Profile Changes in real-time
  useEffect(() => {
    let unsubscribeUser = () => {};
    const unsubscribeAuth = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        unsubscribeUser();
        // Set real-time listener on the user's profile document
        unsubscribeUser = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
          ObservabilityService.trackFirestoreRead(1);
          if (docSnap.exists()) {
            setCurrentUser(docSnap.data() as User);
          }
        });
      } else {
        unsubscribeUser();
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeUser();
    };
  }, []);

  // Real-time In-App Notification engine based on Firestore transitions
  useEffect(() => {
    if (!currentUser) return;

    const triggerInAppAlert = (title: string, msg: string, type: 'info' | 'success' | 'alert' = 'info') => {
      // Respect notification config
      if (currentUser.settings?.notificationsEnabled === false) return;
      
      const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      setNotifications(prev => [...prev, { id, title, message: msg, type }]);
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, 5500);
    };

    // Tracker 1: Active ride status changes
    const ridesQuery = query(
      collection(db, 'rides'),
      where(currentUser.role === UserRole.PASSENGER ? 'passengerId' : 'driverId', '==', currentUser.uid),
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
      ]),
      orderBy('updatedAt', 'desc'),
      limit(1)
    );

    const unsubscribeRides = onSnapshot(ridesQuery, (snapshot) => {
      ObservabilityService.trackFirestoreRead(snapshot.docs.length || 1);
      if (snapshot.empty) {
        lastActiveRideStatus.current = null;
        lastActiveRideId.current = null;
        return;
      }
      const ride = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Ride;
      
      // Notify only on true status transitions
      if (lastActiveRideId.current === ride.id && lastActiveRideStatus.current !== ride.status) {
        if (currentUser.role === UserRole.PASSENGER) {
          switch (ride.status) {
            case RideStatus.SEARCHING_DRIVER:
              triggerInAppAlert('BÚSQUEDA ACTIVA', 'Buscando un operador certificado para su tarifa protegida...', 'info');
              break;
            case RideStatus.DRIVER_ASSIGNED:
              triggerInAppAlert('OPERADOR ASIGNADO', `El operador ${ride.driverName || 'Zénith Pro'} ha confirmado el servicio.`, 'success');
              break;
            case RideStatus.DRIVER_ARRIVING:
              triggerInAppAlert('OPERADOR EN CAMINO', `El operador se está dirigiendo al punto de origen.`, 'info');
              break;
            case RideStatus.WAITING_FOR_OTP:
              triggerInAppAlert('CÓDIGO DE VALIDACIÓN', `Proporcione el OTP de 3 dígitos al operador para iniciar el viaje.`, 'info');
              break;
            case RideStatus.IN_PROGRESS:
              triggerInAppAlert('VIAJE INICIADO', 'Protocolo de tránsito activo. Transmitiendo coordenadas GPS.', 'info');
              break;
            case RideStatus.COMPLETED:
              triggerInAppAlert('VIAJE FINALIZADO', 'Ha llegado a su destino. Proceda a calificar al operador.', 'success');
              break;
            case RideStatus.CANCELLED:
              triggerInAppAlert('VIAJE CANCELADO', 'Su solicitud operativa ha sido desestimada o cancelada.', 'alert');
              break;
          }
        } else {
          // Driver role
          if (ride.status === RideStatus.DRIVER_ASSIGNED) {
            triggerInAppAlert('SOCIOPASAJERO ENCONTRADO', `El cliente ${ride.passengerName} le ha asignado el viaje. Inicie la ruta.`, 'success');
          } else if (ride.status === RideStatus.CANCELLED) {
            triggerInAppAlert('ORDEN CANCELADA', `El cliente ha cancelado la solicitud operativa del viaje.`, 'alert');
          }
        }
      }
      lastActiveRideStatus.current = ride.status;
      lastActiveRideId.current = ride.id;
    }, (error) => {
      console.error("[ZENITH-ERROR] Failed to stream notifications:", error);
    });

    // Tracker 2: Radar checks (for active drivers looking for unassigned rides)
    let unsubscribeRadar = () => {};
    if (currentUser.role === UserRole.DRIVER) {
      const radarQuery = query(
        collection(db, 'rides'),
        where('status', '==', RideStatus.SEARCHING_DRIVER),
        orderBy('createdAt', 'desc'),
        limit(5)
      );

      unsubscribeRadar = onSnapshot(radarQuery, (snapshot) => {
        ObservabilityService.trackFirestoreRead(snapshot.docs.length || 1);
        snapshot.docs.forEach(docSnap => {
          const rId = docSnap.id;
          const rData = docSnap.data() as Ride;
          if (!seenRadarRideIds.current.has(rId)) {
            seenRadarRideIds.current.add(rId);
            const createdAtObj = rData.createdAt as { seconds?: number };
            const createdMs = createdAtObj?.seconds ? createdAtObj.seconds * 1000 : Date.now();
            if (Date.now() - createdMs < 120000) { // last 2 minutes
              triggerInAppAlert('ALERTA RADAR', `Nuevo viaje disponible en Trujillo. Tarifa protegida: $${rData.protectedPrice}.`, 'alert');
            }
          }
        });
      }, (error) => {
        console.error("[ZENITH-ERROR] Radar snapshot failed:", error);
      });
    }

    return () => {
      unsubscribeRides();
      unsubscribeRadar();
    };
  }, [currentUser?.uid, currentUser?.role]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-[#39FF14] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const currentLang = currentUser?.settings?.language || 'es';

  return (
    <APIProvider apiKey={API_KEY}>
      <div className="min-h-screen bg-[#050505] text-white font-sans overflow-x-hidden">
        {/* Real-time floating Notification queue display */}
        <div className="fixed top-24 right-6 z-50 w-full max-w-sm space-y-3 pointer-events-none">
          <AnimatePresence>
            {notifications.map((n) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, x: 100, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 100, scale: 0.9 }}
                className={`p-4 rounded-xl border pointer-events-auto shadow-2xl flex items-start gap-3 backdrop-blur-xl ${
                  n.type === 'success' 
                    ? 'bg-[#39FF14]/10 border-[#39FF14]/30 text-[#39FF14]'
                    : n.type === 'alert'
                    ? 'bg-red-500/10 border-red-500/30 text-red-400'
                    : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                }`}
              >
                {n.type === 'success' ? (
                  <Activity size={18} className="shrink-0 animate-pulse mt-0.5" />
                ) : n.type === 'alert' ? (
                  <ShieldAlert size={18} className="shrink-0 animate-bounce mt-0.5" />
                ) : (
                  <Bell size={18} className="shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="font-mono text-[10px] uppercase font-black tracking-widest opacity-80">{n.title}</h4>
                  <p className="text-xs font-medium text-white/90 mt-0.5">{n.message}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Background HUD Decor */}
        <div className="fixed inset-0 pointer-events-none opacity-20 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#39FF14] to-transparent"></div>
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#39FF14] to-transparent"></div>
          <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-[#39FF14]/50 to-transparent"></div>
          <div className="absolute top-0 right-1/4 w-px h-full bg-gradient-to-b from-transparent via-[#39FF14]/50 to-transparent"></div>
        </div>
  
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5">
          <div className="max-w-4xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#39FF14] rounded-sm flex items-center justify-center shadow-glow">
                <Car size={24} className="text-black" />
              </div>
              <div className="flex flex-col -space-y-1">
                <span className="font-black text-2xl tracking-[0.2em] uppercase italic">Zénith</span>
                <span className="text-[10px] font-mono text-[#39FF14] tracking-widest uppercase opacity-70">Protocolo Operativo</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {!currentUser && (
                <button 
                  onClick={() => setShowConfig(!showConfig)}
                  className={`p-3 rounded-xl transition-all border ${showConfig ? 'bg-[#39FF14]/20 border-[#39FF14] text-[#39FF14]' : 'bg-white/5 border-white/10 text-gray-400'}`}
                  title="Sincronización Manual"
                >
                  <Settings size={18} />
                </button>
              )}
              {currentUser && (
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-end">
                  <span className="text-[9px] font-mono text-[#39FF14] uppercase tracking-widest leading-none mb-1">
                    {currentUser.role === UserRole.DRIVER 
                      ? (currentLang === 'es' ? 'OPERADOR' : 'OPERATOR') 
                      : (currentLang === 'es' ? 'CLIENTE' : 'CLIENT')}
                  </span>
                  <span className="text-sm font-bold uppercase tracking-tight">{currentUser.fullName}</span>
                </div>
                <button
                  onClick={toggleRole}
                  className="px-3 py-2 bg-white/5 hover:bg-[#39FF14]/10 hover:text-[#39FF14] text-[10px] font-mono border border-white/10 hover:border-[#39FF14]/50 rounded-xl transition-all uppercase tracking-wider font-black"
                  title="Cambiar de Rol"
                >
                  {currentLang === 'es' ? 'Alternar Rol' : 'Toggle Role'}
                </button>
                <button 
                  onClick={() => auth.signOut()}
                  className="p-3 bg-white/5 hover:bg-red-500/20 hover:text-red-500 rounded-xl transition-all border border-white/10"
                  title="Desactivar Sesión"
                >
                  <LogOut size={18} />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
  
        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-6 pt-28 pb-20 relative z-10">
          <AnimatePresence mode="wait">
            {!currentUser ? (
              <motion.div
                key="onboarding-setup"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="py-12"
              >
                {showConfig && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                  >
                    <PromptHelper />
                  </motion.div>
                )}
                <ClientOnboarding onComplete={(user) => setCurrentUser(user)} />
              </motion.div>
            ) : currentUser.role === UserRole.PASSENGER && !currentUser.onboardingComplete ? (
              <motion.div
                key="onboarding-incomplete"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="py-12"
              >
                <ClientOnboarding onComplete={(user) => setCurrentUser(user)} />
              </motion.div>
            ) : (
              <motion.div
                key="content"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full space-y-6"
              >
                {/* Visual Module Switcher Tab Bar */}
                <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1 gap-1 flex-wrap">
                  <button
                    onClick={() => handleModuleChange('service')}
                    className={`flex-1 min-w-[120px] py-3 text-xs font-mono uppercase font-black rounded-xl transition-all tracking-wider ${
                      activeModule === 'service'
                        ? 'bg-[#39FF14] text-black shadow-glow'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {currentLang === 'es' ? 'Panel de Servicio' : 'Service Panel'}
                  </button>
                  <button
                    onClick={() => handleModuleChange('control_center')}
                    className={`flex-1 min-w-[120px] py-3 text-xs font-mono uppercase font-black rounded-xl transition-all tracking-wider flex items-center justify-center gap-2 ${
                      activeModule === 'control_center'
                        ? 'bg-[#39FF14] text-black shadow-glow'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Settings size={14} />
                    {currentLang === 'es' ? 'Diagnóstico y Control' : 'Diagnostic & Control'}
                  </button>
                  <button
                    onClick={() => handleModuleChange('lso')}
                    className={`flex-1 min-w-[120px] py-3 text-xs font-mono uppercase font-black rounded-xl transition-all tracking-wider flex items-center justify-center gap-2 ${
                      activeModule === 'lso'
                        ? 'bg-[#39FF14] text-black shadow-glow'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <FlaskConical size={14} />
                    {currentLang === 'es' ? 'Simulador LSO' : 'LSO Simulator'}
                  </button>
                  {/* Tab de Administración de Conductores */}
                  {(currentUser.isAdmin || currentUser.email === 'bkheelsec@gmail.com' || currentUser.role === 'admin') && (
                    <button
                      onClick={() => handleModuleChange('admin')}
                      className={`flex-1 min-w-[120px] py-3 text-xs font-mono uppercase font-black rounded-xl transition-all tracking-wider flex items-center justify-center gap-2 ${
                        activeModule === 'admin'
                          ? 'bg-[#39FF14] text-black shadow-glow'
                          : 'text-[#39FF14] hover:bg-[#39FF14]/10 hover:text-[#39FF14] border border-[#39FF14]/20'
                      }`}
                    >
                      <Shield size={14} />
                      {currentLang === 'es' ? 'Admin Zenith' : 'Zenith Admin'}
                    </button>
                  )}
                </div>

                {activeModule === 'service' ? (
                  <>
                    <div className="mb-10 flex items-end justify-between border-b border-white/5 pb-8">
                      <div>
                        <h1 className="text-4xl font-black tracking-tight uppercase italic mb-2">
                          {currentLang === 'es' ? 'Sistema Activo' : 'Active System'}
                        </h1>
                        <p className="text-gray-400 font-mono text-xs uppercase tracking-widest">
                          {currentUser.role === UserRole.PASSENGER 
                            ? (currentLang === 'es' 
                                ? "Esperando despliegue de solicitud operativa" 
                                : "Waiting for operational request deployment")
                            : (currentLang === 'es' 
                                ? "Escaneando sector en busca de nodos de tránsito activos" 
                                : "Scanning sector for active transit nodes")}
                        </p>
                      </div>
                      <div className="hidden sm:flex items-center gap-4">
                         <div className="text-right">
                           <p className="text-[10px] font-mono text-gray-500 uppercase">
                             {currentLang === 'es' ? 'Estado Operativo' : 'Operational Status'}
                           </p>
                           <p className="text-[#39FF14] font-bold text-sm">
                             {currentLang === 'es' ? 'LISTO' : 'READY'}
                           </p>
                         </div>
                         <div className="w-14 h-14 rounded-2xl bg-[#39FF14]/10 border border-[#39FF14]/30 flex items-center justify-center">
                           {currentUser.role === UserRole.PASSENGER ? <UserIcon className="text-[#39FF14]" /> : <Car className="text-[#39FF14]" />}
                         </div>
                      </div>
                    </div>
      
                    {currentUser.role === UserRole.PASSENGER ? (
                      <PassengerFlow user={currentUser} />
                    ) : (
                      <DriverFlow user={currentUser} />
                    )}
                  </>
                ) : activeModule === 'control_center' ? (
                  <ControlCenter user={currentUser} onUserUpdate={(updated) => setCurrentUser(updated)} />
                ) : activeModule === 'admin' ? (
                  <AdminDashboard adminUser={currentUser} />
                ) : (
                  <SimulationLab />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
  
        {/* Footer */}
        <footer className="py-10 text-center relative z-10">
          <div className="max-w-xs mx-auto mb-4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
          <p className="text-[10px] font-mono text-gray-500 uppercase tracking-[0.5em] font-medium mb-1">
            PROTOCOLO ZÉNITH v1.0.42
          </p>
          <p className="text-[8px] font-mono text-gray-600 uppercase tracking-widest">
            {currentLang === 'es' ? 'Inteligencia Operativa Extremo a Extremo' : 'End-to-End Operational Intelligence'}
          </p>
        </footer>

        {/* Floating Developer & Observability Cockpit HUD */}
        <DevObservabilityHUD />
      </div>
    </APIProvider>
  );
}
