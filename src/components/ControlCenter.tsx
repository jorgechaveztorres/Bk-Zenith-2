// ============================================================================
// ZÉNITH
// Module : Control Center (Wallet, History, Notifications, Favorites & Settings)
// Layer  : Presentation / UI
// File   : ControlCenter.tsx
// ============================================================================

import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc, 
  onSnapshot, 
  limit, 
  orderBy,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { 
  User, 
  Ride, 
  RideStatus, 
  UserRole, 
  FavoriteDestination, 
  UserSettings, 
  AppNotification, 
  WalletMovement 
} from '../types';
import { 
  History as HistoryIcon, 
  User as UserIcon, 
  Settings as SettingsIcon, 
  Search, 
  Filter, 
  Home, 
  Briefcase, 
  MapPin, 
  Star, 
  Trash2, 
  Plus, 
  Check, 
  Globe, 
  Sun, 
  Moon, 
  Compass, 
  DollarSign, 
  Activity, 
  Shield, 
  Clock, 
  ArrowRight,
  ChevronRight,
  Bell,
  Wallet as WalletIcon,
  Download,
  Upload,
  Layers,
  Sparkles,
  Calendar,
  Eye,
  AlertCircle,
  GraduationCap,
  Users,
  Building,
  Heart,
  Plane
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import PlacesAutocomplete from './PlacesAutocomplete';
import { WalletService } from '../services/WalletService';
import PilotControlRC2 from './PilotControlRC2';

// Predefined categories for advanced favorites
const FAVORITE_CATEGORIES = [
  { id: 'casa', name: 'Casa', icon: Home },
  { id: 'trabajo', name: 'Trabajo', icon: Briefcase },
  { id: 'universidad', name: 'Universidad', icon: GraduationCap },
  { id: 'cliente_frecuente', name: 'Cliente Frecuente', icon: Users },
  { id: 'empresa', name: 'Empresa', icon: Building },
  { id: 'hospital', name: 'Hospital', icon: Heart },
  { id: 'aeropuerto', name: 'Aeropuerto', icon: Plane },
  { id: 'otros', name: 'Otros', icon: MapPin }
] as const;

// Translations
const TRANSLATIONS = {
  es: {
    title: 'Centro de Control',
    subtitle: 'Módulo de Diagnóstico, Wallet, Notificaciones y Configuración',
    historyTab: 'Historial',
    profileTab: 'Perfil',
    settingsTab: 'Ajustes',
    walletTab: 'Wallet',
    notificationsTab: 'Notificaciones',
    pilotTab: 'Piloto RC-2',
    all: 'Todos',
    completed: 'Completados',
    cancelled: 'Cancelados',
    searchPlaceholder: 'Buscar dirección o persona...',
    noTrips: 'No se encontraron registros de viajes.',
    tripDetails: 'Detalle del Viaje',
    route: 'Ruta Operativa',
    fare: 'Tarifa Acordada',
    status: 'Estado',
    driver: 'Operador',
    passenger: 'Cliente',
    date: 'Fecha de Despliegue',
    seal: 'Sello de Seguridad',
    rating: 'Calificación',
    feedback: 'Comentarios',
    km: 'Kilómetros Recorridos',
    earnings: 'Créditos Totales',
    reputation: 'Reputación de Red',
    totalTrips: 'Servicios Finalizados',
    favTitle: 'Ubicaciones Frecuentes',
    addFavBtn: 'Añadir Favorito',
    noFavs: 'No hay direcciones frecuentes guardadas aún.',
    saveBtn: 'Guardar Ajustes',
    savedMsg: 'Datos sincronizados con la red central.',
    editProfile: 'Editar Datos de Perfil',
    enterName: 'Nombre Completo',
    updating: 'Sincronizando...',
    themeToggle: 'Modo Visual de Interfaz',
    langToggle: 'Idioma del Sistema',
    gpsToggle: 'Precisión GPS',
    notifToggle: 'Alertas en tiempo real',
    highPrecision: 'Alta Precisión',
    optimized: 'Optimizado',
    avatarSelector: 'Seleccionar Avatar Táctico'
  },
  en: {
    title: 'Control Center',
    subtitle: 'Diagnostic, Wallet, Notifications & Settings Module',
    historyTab: 'History',
    profileTab: 'Profile',
    settingsTab: 'Settings',
    walletTab: 'Wallet',
    notificationsTab: 'Notifications',
    pilotTab: 'Pilot RC-2',
    all: 'All',
    completed: 'Completed',
    cancelled: 'Cancelled',
    searchPlaceholder: 'Search address or person...',
    noTrips: 'No ride records found.',
    tripDetails: 'Trip Details',
    route: 'Operational Route',
    fare: 'Agreed Fare',
    status: 'Status',
    driver: 'Driver',
    passenger: 'Passenger',
    date: 'Deployment Date',
    seal: 'Security Seal',
    rating: 'Rating',
    feedback: 'Comments',
    km: 'Kilometers Traveled',
    earnings: 'Total Earnings',
    reputation: 'Network Reputation',
    totalTrips: 'Finished Services',
    favTitle: 'Frequent Locations',
    addFavBtn: 'Add Favorite',
    noFavs: 'No frequent addresses saved yet.',
    saveBtn: 'Save Settings',
    savedMsg: 'Data synchronized with core network.',
    editProfile: 'Edit Profile Info',
    enterName: 'Full Name',
    updating: 'Syncing...',
    themeToggle: 'Visual Interface Mode',
    langToggle: 'System Language',
    gpsToggle: 'GPS Precision',
    notifToggle: 'Real-time Alerts',
    highPrecision: 'High Precision',
    optimized: 'Optimized',
    avatarSelector: 'Select Tactical Avatar'
  }
};

const CYBER_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200'
];

interface ControlCenterProps {
  user: User;
  onUserUpdate: (updated: User) => void;
}

type TabType = 'wallet' | 'history' | 'notifications' | 'profile' | 'settings' | 'pilot_rc2';

export default function ControlCenter({ user, onUserUpdate }: ControlCenterProps) {
  const [activeTab, setActiveTab] = useState<TabType>('history');
  
  // Settings & Localization
  const currentLang = user.settings?.language || 'es';
  const t = TRANSLATIONS[currentLang];
  
  // Profile edit state
  const [fullName, setFullName] = useState(user.fullName);
  const [photoUrl, setPhotoUrl] = useState(user.photoUrl || CYBER_AVATARS[0]);
  const [syncing, setSyncing] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Trips History state
  const [historyRides, setHistoryRides] = useState<Ride[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Advanced Filters for History Commercial Dashboard
  const [filterMinAmount, setFilterMinAmount] = useState<number>(0);
  const [filterMaxAmount, setFilterMaxAmount] = useState<number>(1000);
  const [filterDatePreset, setFilterDatePreset] = useState<'all' | 'today' | 'week' | 'month'>('all');

  // Favorites state
  const [favName, setFavName] = useState('');
  const [favCategory, setFavCategory] = useState<typeof FAVORITE_CATEGORIES[number]['id']>('casa');
  const [favLocation, setFavLocation] = useState<{ address: string; lat: number; lng: number } | null>(null);
  const [addingFav, setAddingFav] = useState(false);

  // Notifications Feed state
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(true);
  const [notifTypeFilter, setNotifTypeFilter] = useState<'all' | 'info' | 'success' | 'alert' | 'promo'>('all');

  // Wallet operations state
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [walletAmount, setWalletAmount] = useState<number>(50);
  const [withdrawalBank, setWithdrawalBank] = useState('Banco de Crédito (BCP)');
  const [withdrawalAccount, setWithdrawalAccount] = useState('');
  const [depositMethod, setDepositMethod] = useState('Yape / Plin');

  // Default User Settings
  const defaultSettings: UserSettings = {
    darkMode: user.settings?.darkMode !== false,
    language: user.settings?.language || 'es',
    gpsPrecision: user.settings?.gpsPrecision || 'high',
    notificationsEnabled: user.settings?.notificationsEnabled !== false
  };

  // Helper to trigger toast
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
  };

  // Initialize wallet if it doesn't exist for drivers
  useEffect(() => {
    if (user.role === UserRole.DRIVER && !user.wallet) {
      WalletService.getOrCreateWallet(user.uid).then(w => {
        onUserUpdate({ ...user, wallet: w });
      });
    }
  }, [user.uid, user.role, user.wallet]);

  // Listen to User rides history
  useEffect(() => {
    setLoadingHistory(true);
    const q = query(
      collection(db, 'rides'),
      where(user.role === UserRole.DRIVER ? 'driverId' : 'passengerId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ride));
      setHistoryRides(fetched);
      setLoadingHistory(false);
    }, (error) => {
      console.error("[ZENITH-ERROR] Failed to stream ride history:", error);
      setLoadingHistory(false);
    });

    return () => unsubscribe();
  }, [user.uid, user.role]);

  // Listen to Notifications feed in real-time
  useEffect(() => {
    setLoadingNotifs(true);
    const q = query(
      collection(db, 'users', user.uid, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification)));
      setLoadingNotifs(false);
    }, (error) => {
      console.error("[ZENITH-ERROR] Failed to stream notifications:", error);
      setLoadingNotifs(false);
    });
    return () => unsubscribe();
  }, [user.uid]);

  // Handle saving profile changes & settings
  const handleSaveSettings = async (updatedSettings: Partial<UserSettings>) => {
    setSyncing(true);
    const finalSettings = { ...defaultSettings, ...updatedSettings };
    const finalUser = {
      ...user,
      fullName,
      photoUrl,
      settings: finalSettings
    };

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        fullName,
        photoUrl,
        settings: finalSettings
      });
      onUserUpdate(finalUser);
      triggerToast(t.savedMsg);
    } catch (err) {
      console.error("[ZENITH-ERROR] Error syncing settings:", err);
    } finally {
      setSyncing(false);
    }
  };

  // Add a Favorite Destination
  const handleAddFavorite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!favName || !favLocation) return;

    const newFav: FavoriteDestination = {
      id: `fav_${Date.now()}`,
      name: favName,
      category: favCategory,
      address: favLocation.address,
      lat: favLocation.lat,
      lng: favLocation.lng
    };

    const updatedFavorites = [...(user.favorites || []), newFav];
    const updatedUser = { ...user, favorites: updatedFavorites };

    setSyncing(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        favorites: updatedFavorites
      });
      onUserUpdate(updatedUser);
      setFavName('');
      setFavLocation(null);
      setAddingFav(false);
      triggerToast('Ubicación agregada con éxito.');
    } catch (err) {
      console.error("[ZENITH-ERROR] Failed to save favorite:", err);
    } finally {
      setSyncing(false);
    }
  };

  // Delete a Favorite Destination
  const handleDeleteFavorite = async (favId: string) => {
    const updatedFavorites = (user.favorites || []).filter(f => f.id !== favId);
    const updatedUser = { ...user, favorites: updatedFavorites };

    setSyncing(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        favorites: updatedFavorites
      });
      onUserUpdate(updatedUser);
      triggerToast('Ubicación eliminada.');
    } catch (err) {
      console.error("[ZENITH-ERROR] Failed to delete favorite:", err);
    } finally {
      setSyncing(false);
    }
  };

  // Mark all notifications as read
  const handleMarkAllNotifsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.read);
      const promises = unread.map(n => 
        updateDoc(doc(db, 'users', user.uid, 'notifications', n.id), { read: true })
      );
      await Promise.all(promises);
      triggerToast('Todas las alertas marcadas como leídas.');
    } catch (err) {
      console.error("[ZENITH-ERROR] Error marking notifications as read:", err);
    }
  };

  // Clear notifications history
  const handleClearNotifsHistory = async () => {
    try {
      const promises = notifications.map(n => 
        deleteDoc(doc(db, 'users', user.uid, 'notifications', n.id))
      );
      await Promise.all(promises);
      triggerToast('Historial de alertas vaciado.');
    } catch (err) {
      console.error("[ZENITH-ERROR] Error clearing notifications:", err);
    }
  };

  // Deposit funds
  const handleDeposit = async () => {
    if (walletAmount <= 0) return;
    setSyncing(true);
    try {
      const updatedWallet = await WalletService.depositFunds(user.uid, walletAmount, depositMethod);
      onUserUpdate({ ...user, wallet: updatedWallet });
      setShowDepositModal(false);
      triggerToast(`Depósito de $${walletAmount} procesado con éxito.`);
    } catch (err) {
      console.error("[ZENITH-ERROR] Deposit failed:", err);
    } finally {
      setSyncing(false);
    }
  };

  // Withdraw funds
  const handleWithdrawal = async () => {
    if (walletAmount <= 0 || !withdrawalAccount) return;
    if ((user.wallet?.availableBalance || 0) < walletAmount) {
      alert('Saldo insuficiente');
      return;
    }
    setSyncing(true);
    try {
      const details = `${withdrawalBank} - Cuenta: ${withdrawalAccount}`;
      const updatedWallet = await WalletService.withdrawFunds(user.uid, walletAmount, details);
      onUserUpdate({ ...user, wallet: updatedWallet });
      setShowWithdrawalModal(false);
      setWithdrawalAccount('');
      triggerToast(`Retiro de $${walletAmount} enviado a procesamiento.`);
    } catch (err) {
      console.error("[ZENITH-ERROR] Withdrawal failed:", err);
    } finally {
      setSyncing(false);
    }
  };

  // Commercial Dashboard Analytics & Recaps
  const completedRidesList = historyRides.filter(r => r.status === RideStatus.COMPLETED);
  const cancelledRidesList = historyRides.filter(r => r.status === RideStatus.CANCELLED);
  
  const totalTripsCount = completedRidesList.length;
  const totalKm = completedRidesList.reduce((sum, r) => sum + (r.distance || 0), 0);
  const totalEarnings = completedRidesList.reduce((sum, r) => sum + (r.finalPrice || r.protectedPrice || 0), 0);
  const averageFare = totalTripsCount > 0 ? totalEarnings / totalTripsCount : 0;
  
  // Cancellation Rate
  const totalAttempted = historyRides.length;
  const cancellationRate = totalAttempted > 0 ? (cancelledRidesList.length / totalAttempted) * 100 : 0;

  // Average Rating
  const ratedRides = completedRidesList.filter(r => r.rating !== undefined);
  const averageRating = ratedRides.length > 0 ? ratedRides.reduce((sum, r) => sum + (r.rating || 0), 0) / ratedRides.length : user.rating;

  // Average duration
  const totalDuration = completedRidesList.reduce((sum, r) => sum + (r.duration || 0), 0);
  const averageDuration = totalTripsCount > 0 ? totalDuration / totalTripsCount : 0;

  // Filter and Search Logic
  const filteredHistory = historyRides.filter(ride => {
    // 1. Base query search
    const matchesSearch = 
      ride.origin.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ride.destination.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ride.driverName && ride.driverName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (ride.passengerName && ride.passengerName.toLowerCase().includes(searchQuery.toLowerCase()));

    // 2. Status filter
    let matchesStatus = true;
    if (filterStatus === 'completed') {
      matchesStatus = (ride.status === RideStatus.COMPLETED);
    } else if (filterStatus === 'cancelled') {
      matchesStatus = ride.status === RideStatus.CANCELLED;
    }

    // 3. Price range filter
    const price = ride.finalPrice || ride.protectedPrice || 0;
    const matchesPrice = price >= filterMinAmount && price <= filterMaxAmount;

    // 4. Date preset filter
    let matchesDate = true;
    if (ride.createdAt) {
      const rideDate = new Date(ride.createdAt.seconds * 1000);
      const now = new Date();
      if (filterDatePreset === 'today') {
        matchesDate = rideDate.toDateString() === now.toDateString();
      } else if (filterDatePreset === 'week') {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(now.getDate() - 7);
        matchesDate = rideDate >= oneWeekAgo;
      } else if (filterDatePreset === 'month') {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(now.getMonth() - 1);
        matchesDate = rideDate >= oneMonthAgo;
      }
    }

    return matchesSearch && matchesStatus && matchesPrice && matchesDate;
  });

  // Filtered Notifications
  const filteredNotifications = notifications.filter(n => {
    if (notifTypeFilter === 'all') return true;
    return n.type === notifTypeFilter;
  });

  // Unread badge count
  const unreadNotifCount = notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-6" id="control_center_module">
      {/* Toast Notification */}
      <AnimatePresence>
        {showNotification && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-[#39FF14] text-black px-6 py-3 rounded-full shadow-glow font-mono text-xs uppercase font-black flex items-center gap-2 border border-white/20"
          >
            <Check size={14} className="stroke-[3]" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs Navigation Bar */}
      <div className="grid grid-cols-3 md:flex bg-black/60 backdrop-blur-xl border border-white/5 rounded-2xl p-1.5 gap-1.5">
        <button
          onClick={() => setActiveTab('history')}
          className={`py-3 px-4 text-[10px] md:text-xs uppercase tracking-wider font-mono font-black rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeTab === 'history' 
              ? 'bg-[#39FF14]/15 border border-[#39FF14]/30 text-[#39FF14]' 
              : 'text-gray-400 hover:text-white border border-transparent'
          }`}
        >
          <HistoryIcon size={14} />
          <span>{t.historyTab}</span>
        </button>

        {user.role === UserRole.DRIVER && (
          <button
            onClick={() => setActiveTab('wallet')}
            className={`py-3 px-4 text-[10px] md:text-xs uppercase tracking-wider font-mono font-black rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'wallet' 
                ? 'bg-[#39FF14]/15 border border-[#39FF14]/30 text-[#39FF14]' 
                : 'text-gray-400 hover:text-white border border-transparent'
            }`}
          >
            <WalletIcon size={14} />
            <span>{t.walletTab}</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('notifications')}
          className={`py-3 px-4 text-[10px] md:text-xs uppercase tracking-wider font-mono font-black rounded-xl transition-all flex items-center justify-center gap-2 relative ${
            activeTab === 'notifications' 
              ? 'bg-[#39FF14]/15 border border-[#39FF14]/30 text-[#39FF14]' 
              : 'text-gray-400 hover:text-white border border-transparent'
          }`}
        >
          <Bell size={14} />
          <span>{t.notificationsTab}</span>
          {unreadNotifCount > 0 && (
            <span className="absolute top-2 right-2 bg-red-500 text-white w-4 h-4 rounded-full text-[8px] font-mono flex items-center justify-center font-black animate-pulse">
              {unreadNotifCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`py-3 px-4 text-[10px] md:text-xs uppercase tracking-wider font-mono font-black rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeTab === 'profile' 
              ? 'bg-[#39FF14]/15 border border-[#39FF14]/30 text-[#39FF14]' 
              : 'text-gray-400 hover:text-white border border-transparent'
          }`}
        >
          <UserIcon size={14} />
          <span>{t.profileTab}</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`py-3 px-4 text-[10px] md:text-xs uppercase tracking-wider font-mono font-black rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeTab === 'settings' 
              ? 'bg-[#39FF14]/15 border border-[#39FF14]/30 text-[#39FF14]' 
              : 'text-gray-400 hover:text-white border border-transparent'
          }`}
        >
          <SettingsIcon size={14} />
          <span>{t.settingsTab}</span>
        </button>

        <button
          onClick={() => setActiveTab('pilot_rc2')}
          className={`py-3 px-4 text-[10px] md:text-xs uppercase tracking-wider font-mono font-black rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeTab === 'pilot_rc2' 
              ? 'bg-[#39FF14]/15 border border-[#39FF14]/30 text-[#39FF14]' 
              : 'text-gray-400 hover:text-white border border-transparent'
          }`}
        >
          <Compass size={14} />
          <span>{t.pilotTab}</span>
        </button>
      </div>

      {/* TAB CONTENT: PILOT RC-2 */}
      {activeTab === 'pilot_rc2' && (
        <PilotControlRC2 />
      )}

      {/* TAB CONTENT: WALLET */}
      {activeTab === 'wallet' && user.role === UserRole.DRIVER && (
        <div className="space-y-6">
          {/* Tactical Wallet Showcase & Balances */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Holographic Digital Credit Card */}
            <div className="lg:col-span-1 bg-gradient-to-br from-neutral-900 to-black p-6 rounded-3xl border border-[#39FF14]/30 shadow-glow flex flex-col justify-between h-56 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 text-[#39FF14] group-hover:scale-110 transition-transform">
                <WalletIcon size={180} />
              </div>
              <div className="flex justify-between items-start z-10">
                <div className="space-y-0.5 text-left">
                  <p className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">TACTICAL NETWORK</p>
                  <p className="text-lg font-black uppercase italic tracking-tighter text-[#39FF14]">ZÉNITH PRO CARD</p>
                </div>
                <div className="w-10 h-7 bg-white/10 rounded-md border border-white/10 flex items-center justify-center">
                  <div className="w-6 h-4 bg-yellow-600/30 rounded border border-yellow-600/40"></div>
                </div>
              </div>

              <div className="z-10 text-left">
                <p className="text-md font-mono text-gray-400 tracking-[0.2em]">•••• •••• •••• {user.uid.substring(0, 4).toUpperCase()}</p>
              </div>

              <div className="flex justify-between items-end z-10">
                <div className="text-left">
                  <p className="text-[8px] font-mono text-gray-500 uppercase">OPERADOR</p>
                  <p className="text-xs font-bold font-mono text-white truncate max-w-[150px] uppercase">{fullName}</p>
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-mono text-gray-500 uppercase">RED INTEGRADA</p>
                  <p className="text-[10px] font-mono text-[#39FF14] font-bold">V1.0 BETA</p>
                </div>
              </div>
            </div>

            {/* Financial Dashboard Widgets */}
            <div className="lg:col-span-2 grid grid-cols-2 gap-4">
              <div className="hud-card p-5 bg-black/40 border-white/5 text-left space-y-1">
                <p className="text-[9px] font-mono text-gray-500 uppercase">Saldo Disponible</p>
                <p className="text-4xl font-black text-[#39FF14] mono-data italic">${user.wallet?.availableBalance.toFixed(2) ?? '0.00'}</p>
                <p className="text-[9px] font-mono text-gray-600 uppercase">Fondos liberados para retiro</p>
              </div>

              <div className="hud-card p-5 bg-black/40 border-white/5 text-left space-y-1">
                <p className="text-[9px] font-mono text-gray-500 uppercase">Saldo Retenido / Garantía</p>
                <p className="text-4xl font-black text-gray-400 mono-data italic">${user.wallet?.retainedBalance.toFixed(2) ?? '0.00'}</p>
                <p className="text-[9px] font-mono text-gray-600 uppercase">Depósito mínimo de seguridad</p>
              </div>

              <div className="hud-card p-5 bg-black/40 border-white/5 text-left space-y-1">
                <p className="text-[9px] font-mono text-gray-500 uppercase">Ganancias de Hoy</p>
                <p className="text-3xl font-black text-white mono-data italic">${user.wallet?.dailyEarnings.toFixed(2) ?? '0.00'}</p>
                <p className="text-[9px] font-mono text-gray-600 uppercase">Corte de ciclo: Medianoche</p>
              </div>

              <div className="hud-card p-5 bg-black/40 border-white/5 text-left space-y-1">
                <p className="text-[9px] font-mono text-gray-500 uppercase">Ganancias de la Semana</p>
                <p className="text-3xl font-black text-white mono-data italic">${user.wallet?.weeklyEarnings.toFixed(2) ?? '0.00'}</p>
                <p className="text-[9px] font-mono text-gray-600 uppercase">Ciclo de facturación activo</p>
              </div>
            </div>
          </div>

          {/* Wallet Action Controls */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => {
                setWalletAmount(50);
                setShowDepositModal(true);
              }}
              className="py-4 bg-[#39FF14]/10 hover:bg-[#39FF14]/20 border border-[#39FF14]/30 text-[#39FF14] rounded-2xl font-mono text-xs uppercase font-black transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <Download size={16} />
              <span>Cargar Fondos (Depósito)</span>
            </button>

            <button
              onClick={() => {
                setWalletAmount(50);
                setShowWithdrawalModal(true);
              }}
              className="py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-2xl font-mono text-xs uppercase font-black transition-all flex items-center justify-center gap-2"
            >
              <Upload size={16} />
              <span>Retirar Fondos</span>
            </button>
          </div>

          {/* DEPOSIT MODAL */}
          <AnimatePresence>
            {showDepositModal && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-[#050505] border border-white/10 w-full max-w-md rounded-2xl p-6 relative space-y-6"
                >
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <h3 className="text-lg font-black uppercase italic tracking-tight flex items-center gap-2">
                      <Download className="text-[#39FF14]" size={18} />
                      Cargar Depósito Táctico
                    </h3>
                    <button onClick={() => setShowDepositModal(false)} className="text-gray-400 hover:text-white">✕</button>
                  </div>

                  <div className="space-y-4 text-left font-mono text-xs">
                    <div>
                      <label className="text-[9px] text-gray-500 uppercase tracking-widest mb-1 block">Monto a Depositar ($)</label>
                      <input 
                        type="number" 
                        value={walletAmount}
                        onChange={(e) => setWalletAmount(Number(e.target.value))}
                        className="w-full bg-black border border-white/10 p-3 rounded-xl text-xl font-bold italic text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] text-gray-500 uppercase tracking-widest mb-1 block">Método de Transferencia</label>
                      <select 
                        value={depositMethod}
                        onChange={(e) => setDepositMethod(e.target.value)}
                        className="w-full bg-black border border-white/10 p-3 rounded-xl text-xs text-white"
                      >
                        <option value="Yape / Plin">Yape / Plin</option>
                        <option value="Tarjeta de Crédito/Débito">Tarjeta de Crédito / Débito</option>
                        <option value="Transferencia Interbancaria (CCI)">Transferencia Interbancaria (CCI)</option>
                      </select>
                    </div>

                    <button 
                      onClick={handleDeposit}
                      disabled={syncing || walletAmount <= 0}
                      className="w-full bg-[#39FF14] text-black py-4 rounded-xl font-black uppercase tracking-tight text-xs hover:scale-[1.01] transition-all"
                    >
                      Confirmar Carga
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* WITHDRAWAL MODAL */}
          <AnimatePresence>
            {showWithdrawalModal && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-[#050505] border border-white/10 w-full max-w-md rounded-2xl p-6 relative space-y-6"
                >
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <h3 className="text-lg font-black uppercase italic tracking-tight flex items-center gap-2">
                      <Upload className="text-white" size={18} />
                      Solicitar Retiro de Fondos
                    </h3>
                    <button onClick={() => setShowWithdrawalModal(false)} className="text-gray-400 hover:text-white">✕</button>
                  </div>

                  <div className="space-y-4 text-left font-mono text-xs">
                    <div>
                      <label className="text-[9px] text-gray-500 uppercase tracking-widest mb-1 block">Monto a Retirar ($)</label>
                      <input 
                        type="number" 
                        value={walletAmount}
                        onChange={(e) => setWalletAmount(Number(e.target.value))}
                        className="w-full bg-black border border-white/10 p-3 rounded-xl text-xl font-bold italic text-white"
                      />
                      <p className="text-[9px] text-gray-600 mt-1 uppercase">Saldo Máximo Disponible: ${user.wallet?.availableBalance.toFixed(2)}</p>
                    </div>

                    <div>
                      <label className="text-[9px] text-gray-500 uppercase tracking-widest mb-1 block">Entidad Bancaria</label>
                      <select 
                        value={withdrawalBank}
                        onChange={(e) => setWithdrawalBank(e.target.value)}
                        className="w-full bg-black border border-white/10 p-3 rounded-xl text-xs text-white"
                      >
                        <option value="Banco de Crédito (BCP)">Banco de Crédito (BCP)</option>
                        <option value="Interbank">Interbank</option>
                        <option value="BBVA Continental">BBVA Continental</option>
                        <option value="Yape / Plin">Yape / Plin (Celular)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[9px] text-gray-500 uppercase tracking-widest mb-1 block">Número de Cuenta o Celular</label>
                      <input 
                        type="text" 
                        required
                        placeholder="Ingresa cuenta CCI o teléfono"
                        value={withdrawalAccount}
                        onChange={(e) => setWithdrawalAccount(e.target.value)}
                        className="w-full bg-black border border-white/10 p-3 rounded-xl text-xs text-white"
                      />
                    </div>

                    <button 
                      onClick={handleWithdrawal}
                      disabled={syncing || walletAmount <= 0 || !withdrawalAccount || walletAmount > (user.wallet?.availableBalance || 0)}
                      className="w-full bg-[#39FF14] text-black py-4 rounded-xl font-black uppercase tracking-tight text-xs hover:scale-[1.01] transition-all disabled:opacity-50"
                    >
                      Confirmar Retiro
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Movements History */}
          <div className="space-y-4">
            <h4 className="font-bold text-md uppercase italic text-white flex items-center gap-2 text-left">
              <Activity size={16} />
              Registro de Movimientos Financieros
            </h4>

            <div className="space-y-2">
              {(!user.wallet?.movements || user.wallet.movements.length === 0) ? (
                <div className="hud-card p-10 text-center font-mono text-[10px] text-gray-600 uppercase tracking-widest bg-black/40">
                  Ningún movimiento registrado en esta cuenta
                </div>
              ) : (
                user.wallet.movements.map((mov) => {
                  const isEarning = mov.type === 'ride_earning' || mov.type === 'deposit';
                  return (
                    <div 
                      key={mov.id}
                      className="hud-card p-4 bg-white/5 border-white/5 flex items-center justify-between gap-4 text-left font-mono"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white uppercase truncate">{mov.description}</p>
                        <p className="text-[8px] text-gray-500 uppercase mt-0.5">
                          {new Date(
                            typeof mov.createdAt === 'string' 
                              ? mov.createdAt 
                              : ((mov.createdAt as { seconds?: number })?.seconds ? (mov.createdAt as { seconds: number }).seconds * 1000 : Date.now())
                          ).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-black italic mono-data ${isEarning ? 'text-[#39FF14]' : 'text-red-400'}`}>
                          {isEarning ? '+' : '-'}${mov.amount.toFixed(2)}
                        </p>
                        <span className="text-[8px] text-gray-600 uppercase font-bold">{mov.type}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: HISTORY & COMMERCIAL DASHBOARD */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Commercial Analytical Widgets Dashboard */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="hud-card p-4 bg-gradient-to-br from-black/50 to-white/5 border-white/5 flex flex-col justify-between text-left h-28">
              <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">{t.totalTrips}</span>
              <p className="text-3xl font-black italic text-white mono-data">{totalTripsCount}</p>
              <div className="flex items-center gap-1 text-[8px] font-mono text-green-400 uppercase">
                <Check size={10} />
                <span>Rendimiento Óptimo</span>
              </div>
            </div>

            <div className="hud-card p-4 bg-gradient-to-br from-black/50 to-white/5 border-[#39FF14]/10 flex flex-col justify-between text-left h-28">
              <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">
                {user.role === UserRole.DRIVER ? t.earnings : 'Total Gastado'}
              </span>
              <p className="text-3xl font-black italic text-[#39FF14] mono-data">${totalEarnings.toFixed(2)}</p>
              <div className="text-[8px] font-mono text-gray-600 uppercase">Tarifa Promedio: ${averageFare.toFixed(1)}</div>
            </div>

            <div className="hud-card p-4 bg-gradient-to-br from-black/50 to-white/5 border-white/5 flex flex-col justify-between text-left h-28">
              <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">Metraje Recorrido</span>
              <p className="text-3xl font-black italic text-white mono-data">{(totalKm || 5.4).toFixed(1)} km</p>
              <div className="text-[8px] font-mono text-gray-600 uppercase">Promedio: {totalTripsCount > 0 ? (totalKm / totalTripsCount).toFixed(1) : '0'} km/viaje</div>
            </div>

            <div className="hud-card p-4 bg-gradient-to-br from-black/50 to-white/5 border-white/5 flex flex-col justify-between text-left h-28">
              <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">Calificación Promedio</span>
              <div className="flex items-center gap-2">
                <Star className="text-[#39FF14] fill-[#39FF14]" size={20} />
                <p className="text-3xl font-black italic text-white mono-data">{averageRating.toFixed(1)}</p>
              </div>
              <div className="text-[8px] font-mono text-gray-600 uppercase">Ratio Cancelación: {cancellationRate.toFixed(1)}%</div>
            </div>
          </div>

          {/* Advanced Search & Filtering Controls */}
          <div className="hud-card p-5 bg-black/40 border-white/5 space-y-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2.5">
              <Filter size={14} className="text-[#39FF14]" />
              <h4 className="text-xs uppercase font-mono font-black text-gray-300">Consola de Filtros Avanzados</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Query Search */}
              <div className="relative">
                <Search className="absolute left-3 top-3.5 text-gray-500" size={14} />
                <input
                  type="text"
                  placeholder={t.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 focus:border-[#39FF14]/50 focus:outline-none pl-9 pr-3 py-3 rounded-xl font-mono text-xs text-white"
                />
              </div>

              {/* Status presets */}
              <div className="flex gap-2">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`flex-1 py-3 text-[10px] uppercase font-mono font-bold rounded-xl border transition-all ${
                    filterStatus === 'all' 
                      ? 'bg-[#39FF14] text-black border-[#39FF14] shadow-glow' 
                      : 'bg-white/5 text-gray-400 border-white/5 hover:border-white/20'
                  }`}
                >
                  {t.all}
                </button>
                <button
                  onClick={() => setFilterStatus('completed')}
                  className={`flex-1 py-3 text-[10px] uppercase font-mono font-bold rounded-xl border transition-all ${
                    filterStatus === 'completed' 
                      ? 'bg-[#39FF14] text-black border-[#39FF14] shadow-glow' 
                      : 'bg-white/5 text-gray-400 border-white/5 hover:border-white/20'
                  }`}
                >
                  {t.completed}
                </button>
                <button
                  onClick={() => setFilterStatus('cancelled')}
                  className={`flex-1 py-3 text-[10px] uppercase font-mono font-bold rounded-xl border transition-all ${
                    filterStatus === 'cancelled' 
                      ? 'bg-[#39FF14] text-black border-[#39FF14] shadow-glow' 
                      : 'bg-white/5 text-gray-400 border-white/5 hover:border-white/20'
                  }`}
                >
                  {t.cancelled}
                </button>
              </div>

              {/* Date Presets */}
              <div className="grid grid-cols-4 bg-black/60 border border-white/10 p-1 rounded-xl">
                {(['all', 'today', 'week', 'month'] as const).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setFilterDatePreset(preset)}
                    className={`rounded-lg text-[8px] font-mono uppercase font-bold transition-all py-2 ${
                      filterDatePreset === preset
                        ? 'bg-[#39FF14]/20 text-[#39FF14]'
                        : 'text-gray-500 hover:text-white'
                    }`}
                  >
                    {preset === 'all' ? 'Todo' : preset === 'today' ? 'Hoy' : preset === 'week' ? 'Sem' : 'Mes'}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Range Filter Slider Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-white/5">
              <div className="space-y-1.5 text-left font-mono">
                <span className="text-[9px] text-gray-500 uppercase font-black">Tarifa Mínima: ${filterMinAmount}</span>
                <input 
                  type="range" 
                  min="0" 
                  max="500" 
                  value={filterMinAmount}
                  onChange={(e) => setFilterMinAmount(Number(e.target.value))}
                  className="w-full accent-[#39FF14] h-1 bg-white/5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="space-y-1.5 text-left font-mono">
                <span className="text-[9px] text-gray-500 uppercase font-black">Tarifa Máxima: ${filterMaxAmount === 1000 ? 'Sin Límite' : `$${filterMaxAmount}`}</span>
                <input 
                  type="range" 
                  min="0" 
                  max="1000" 
                  value={filterMaxAmount}
                  onChange={(e) => setFilterMaxAmount(Number(e.target.value))}
                  className="w-full accent-[#39FF14] h-1 bg-white/5 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* List of filterable historical rides */}
          <div className="space-y-3 text-left">
            {loadingHistory ? (
              <div className="hud-card p-12 text-center flex justify-center items-center">
                <div className="w-6 h-6 border-2 border-[#39FF14] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="hud-card p-12 text-center text-gray-500 font-mono text-xs uppercase tracking-widest border-dashed">
                {t.noTrips}
              </div>
            ) : (
              filteredHistory.map((ride) => {
                const isCompleted = ride.status === RideStatus.COMPLETED;
                const formattedDate = ride.createdAt?.seconds 
                  ? new Date(ride.createdAt.seconds * 1000).toLocaleDateString() 
                  : new Date().toLocaleDateString();

                return (
                  <div 
                    key={ride.id}
                    onClick={() => setSelectedRide(ride)}
                    className="hud-card p-5 border-white/5 hover:border-[#39FF14]/30 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[8px] font-mono font-bold px-2.5 py-0.5 rounded border uppercase tracking-wider ${
                          isCompleted 
                            ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                          {ride.status}
                        </span>
                        <span className="text-[9px] font-mono text-gray-500">{formattedDate}</span>
                        {ride.distance && (
                          <span className="text-[9px] font-mono text-gray-500">• {ride.distance} KM</span>
                        )}
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 bg-[#39FF14] rounded-full shrink-0"></div>
                          <p className="text-xs text-gray-300 font-medium truncate max-w-[320px] sm:max-w-[450px]">
                            {ride.origin.address}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 bg-white rounded-full shrink-0"></div>
                          <p className="text-xs text-white/80 font-medium truncate max-w-[320px] sm:max-w-[450px]">
                            {ride.destination.address}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end sm:gap-6 border-t border-white/5 sm:border-none pt-3 sm:pt-0">
                      <div className="text-left sm:text-right">
                        <p className="text-[8px] font-mono text-gray-500 uppercase">{t.fare}</p>
                        <p className="text-xl font-black italic text-[#39FF14] mono-data leading-none mt-1">
                          ${ride.finalPrice || ride.suggestedPrice}
                        </p>
                      </div>
                      <ChevronRight className="text-gray-600 hidden sm:block" size={18} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TRIP DETAIL DIALOG (SHARED) */}
      <AnimatePresence>
        {selectedRide && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#050505] border border-white/10 w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl p-6 relative space-y-6"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  <Activity size={18} className="text-[#39FF14]" />
                  <h3 className="text-xl font-black uppercase italic tracking-tight">{t.tripDetails}</h3>
                </div>
                <button 
                  onClick={() => setSelectedRide(null)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 font-mono text-xs text-gray-400 text-left">
                {/* Visual Route */}
                <div className="bg-white/5 border border-white/5 rounded-xl p-4 space-y-3">
                  <p className="text-[9px] font-black text-[#39FF14] uppercase tracking-wider mb-2">{t.route}</p>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <div className="flex flex-col items-center">
                        <div className="w-2.5 h-2.5 bg-[#39FF14] rounded-full"></div>
                        <div className="w-0.5 h-6 bg-white/20"></div>
                      </div>
                      <p className="text-white font-medium">{selectedRide.origin.address}</p>
                    </div>
                    <div className="flex gap-2">
                      <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
                      <p className="text-white/80 font-medium">{selectedRide.destination.address}</p>
                    </div>
                  </div>
                </div>

                {/* Grid stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 border border-white/5 rounded-xl p-3">
                    <span className="text-[8px] text-gray-500 uppercase">{t.status}</span>
                    <p className="text-white font-bold uppercase text-sm mt-1">{selectedRide.status}</p>
                  </div>
                  <div className="bg-white/5 border border-white/5 rounded-xl p-3">
                    <span className="text-[8px] text-gray-500 uppercase">{t.fare}</span>
                    <p className="text-[#39FF14] font-black text-lg mt-0.5">${selectedRide.finalPrice || selectedRide.suggestedPrice}</p>
                  </div>
                  <div className="bg-white/5 border border-white/5 rounded-xl p-3">
                    <span className="text-[8px] text-gray-500 uppercase">{user.role === UserRole.PASSENGER ? t.driver : t.passenger}</span>
                    <p className="text-white font-bold text-sm mt-1">
                      {user.role === UserRole.PASSENGER 
                        ? (selectedRide.driverName || 'No asignado') 
                        : selectedRide.passengerName}
                    </p>
                  </div>
                  <div className="bg-white/5 border border-white/5 rounded-xl p-3">
                    <span className="text-[8px] text-gray-500 uppercase">{t.date}</span>
                    <p className="text-white font-bold text-xs mt-1">
                      {selectedRide.createdAt?.seconds 
                        ? new Date(selectedRide.createdAt.seconds * 1000).toLocaleString() 
                        : 'S/D'}
                    </p>
                  </div>
                </div>

                {/* Star Rating feedback if rated */}
                {selectedRide.passengerRating && (
                  <div className="bg-white/5 border border-white/5 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] text-gray-500 uppercase">{t.rating}</span>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star 
                            key={s} 
                            size={12} 
                            className={`${s <= (selectedRide.passengerRating || 0) ? 'text-[#39FF14] fill-[#39FF14]' : 'text-gray-600'}`} 
                          />
                        ))}
                      </div>
                    </div>
                    {selectedRide.passengerFeedback && (
                      <p className="text-xs text-white bg-black/40 p-3 rounded-lg border border-white/5 italic">
                        "{selectedRide.passengerFeedback}"
                      </p>
                    )}
                  </div>
                )}

                {/* Security pricing seal */}
                {selectedRide.pricingSeal && (
                  <div className="bg-black/80 border border-white/5 rounded-xl p-3 text-center">
                    <span className="text-[8px] text-gray-500 uppercase tracking-widest">{t.seal}</span>
                    <p className="text-[9px] text-gray-400 select-all font-mono tracking-tighter overflow-x-auto whitespace-nowrap scrollbar-none mt-1">
                      {selectedRide.pricingSeal}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TAB CONTENT: NOTIFICATIONS */}
      {activeTab === 'notifications' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div className="text-left">
              <h4 className="font-bold text-lg uppercase italic text-white flex items-center gap-2">
                <Bell size={18} className="text-[#39FF14]" />
                Centro de Notificaciones Tácticas
              </h4>
              <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mt-1">Sincronizado en tiempo real con Firestore</p>
            </div>

            <div className="flex gap-2 shrink-0">
              <button
                onClick={handleMarkAllNotifsRead}
                disabled={notifications.filter(n => !n.read).length === 0}
                className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg text-[9px] font-mono uppercase font-bold transition-all disabled:opacity-40"
              >
                Marcar leídos
              </button>
              <button
                onClick={handleClearNotifsHistory}
                disabled={notifications.length === 0}
                className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg text-[9px] font-mono uppercase font-bold transition-all disabled:opacity-40"
              >
                Limpiar historial
              </button>
            </div>
          </div>

          {/* Type Filters for Notifications */}
          <div className="flex flex-wrap gap-2 text-xs font-mono font-bold">
            {(['all', 'info', 'success', 'alert', 'promo'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setNotifTypeFilter(type)}
                className={`px-3 py-1.5 rounded-lg border uppercase text-[9px] tracking-wider transition-all ${
                  notifTypeFilter === type
                    ? 'bg-[#39FF14]/20 border-[#39FF14]/40 text-[#39FF14]'
                    : 'bg-white/5 border-white/5 text-gray-400 hover:border-white/10'
                }`}
              >
                {type === 'all' ? 'Ver todas' : type === 'info' ? 'Soportes' : type === 'success' ? 'Éxitos' : type === 'alert' ? 'Alertas' : 'Promos'}
              </button>
            ))}
          </div>

          {/* List of Notifications */}
          <div className="space-y-3 text-left">
            {loadingNotifs ? (
              <div className="hud-card p-12 text-center flex justify-center items-center">
                <div className="w-6 h-6 border-2 border-[#39FF14] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="hud-card p-16 text-center text-gray-500 font-mono text-xs uppercase tracking-widest border-dashed">
                Bandeja de notificaciones vacía
              </div>
            ) : (
              filteredNotifications.map((n) => {
                const formattedTime = n.createdAt?.seconds 
                  ? new Date(n.createdAt.seconds * 1000).toLocaleString() 
                  : new Date().toLocaleString();

                return (
                  <div 
                    key={n.id}
                    className={`hud-card p-4 flex gap-4 items-start relative transition-all border-l-4 ${
                      n.read ? 'border-white/5 bg-black/40 opacity-70' : 'border-[#39FF14] bg-white/5 shadow-sm'
                    } ${
                      n.type === 'alert' ? 'border-l-red-500' : n.type === 'success' ? 'border-l-green-500' : n.type === 'promo' ? 'border-l-yellow-400' : 'border-l-[#39FF14]'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-white/5 border border-white/10">
                      {n.type === 'alert' ? (
                        <AlertCircle size={14} className="text-red-400" />
                      ) : n.type === 'success' ? (
                        <Check size={14} className="text-green-400" />
                      ) : n.type === 'promo' ? (
                        <Sparkles size={14} className="text-yellow-400" />
                      ) : (
                        <Bell size={14} className="text-[#39FF14]" />
                      )}
                    </div>

                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex items-center justify-between gap-4">
                        <h5 className="font-bold text-sm text-white uppercase">{n.title}</h5>
                        <span className="text-[8px] font-mono text-gray-500 shrink-0">{formattedTime}</span>
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed font-mono">{n.message}</p>
                    </div>

                    {!n.read && (
                      <button
                        onClick={async () => {
                          await updateDoc(doc(db, 'users', user.uid, 'notifications', n.id), { read: true });
                        }}
                        className="p-1 bg-[#39FF14]/10 border border-[#39FF14]/20 rounded text-[#39FF14] hover:bg-[#39FF14]/20 transition-all text-[8px] font-mono uppercase font-black"
                        title="Marcar como leído"
                      >
                        Leído
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: PROFILE */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {/* Profile overview */}
          <div className="hud-card p-6 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden bg-black/40">
            <div className="absolute top-4 right-4 bg-[#39FF14]/10 border border-[#39FF14]/20 rounded-lg px-2.5 py-1 flex items-center gap-1">
              <Star size={12} className="text-[#39FF14] fill-[#39FF14]" />
              <span className="text-xs font-mono font-bold text-[#39FF14]">{averageRating.toFixed(1)}</span>
            </div>

            {/* Profile Avatar */}
            <div className="relative shrink-0 group">
              <img 
                src={photoUrl} 
                alt={fullName} 
                className="w-24 h-24 rounded-2xl object-cover border-2 border-white/10 group-hover:border-[#39FF14] transition-all"
              />
              <div className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                <span className="text-[8px] font-mono text-[#39FF14] uppercase font-black tracking-widest text-center px-1">
                  Cambiar
                </span>
              </div>
            </div>

            <div className="flex-1 space-y-4 w-full text-left">
              <div className="space-y-1.5 text-center md:text-left">
                <h3 className="text-2xl font-black uppercase italic tracking-tight">{fullName}</h3>
                <p className="text-xs text-gray-500 font-mono">{user.email}</p>
                <span className="inline-block text-[9px] font-mono bg-[#39FF14]/15 border border-[#39FF14]/30 text-[#39FF14] px-2.5 py-0.5 rounded-full uppercase tracking-wider font-black">
                  {user.role === UserRole.DRIVER ? 'OPERADOR DE TRÁNSITO' : 'SOCIOPASAJERO VERIFICADO'}
                </span>
              </div>
            </div>
          </div>

          {/* Cyber Avatar Picker */}
          <div className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-4 text-left">
            <h4 className="text-xs uppercase font-mono font-black text-gray-300 tracking-wider">
              {t.avatarSelector}
            </h4>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {CYBER_AVATARS.map((avatar, idx) => (
                <button
                  key={idx}
                  onClick={() => setPhotoUrl(avatar)}
                  className={`w-14 h-14 rounded-xl overflow-hidden shrink-0 transition-all border-2 ${
                    photoUrl === avatar ? 'border-[#39FF14] scale-105' : 'border-transparent'
                  }`}
                >
                  <img src={avatar} alt="Cyber Avatar" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Edit Profile Info */}
          <div className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-4 text-left">
            <h4 className="text-xs uppercase font-mono font-black text-gray-300 tracking-wider">
              {t.editProfile}
            </h4>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1.5 block">
                  {t.enterName}
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 focus:border-[#39FF14]/50 focus:outline-none px-4 py-3 rounded-xl font-mono text-xs text-white"
                />
              </div>

              <button
                onClick={() => handleSaveSettings({})}
                disabled={syncing || !fullName}
                className="w-full bg-[#39FF14] text-black py-3.5 rounded-xl font-mono text-xs uppercase font-black hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-glow"
              >
                {syncing ? t.updating : t.saveBtn}
              </button>
            </div>
          </div>

          {/* FAVORITES (FREQUENT LOCATIONS) */}
          <div className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-4 text-left">
            <div className="flex items-center justify-between">
              <h4 className="text-xs uppercase font-mono font-black text-gray-300 tracking-wider">
                {t.favTitle} (Categorías Avanzadas)
              </h4>
              <button
                onClick={() => setAddingFav(!addingFav)}
                className={`p-1.5 rounded-lg border transition-all flex items-center justify-center ${
                  addingFav 
                    ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                    : 'bg-[#39FF14]/10 border-[#39FF14]/20 text-[#39FF14]'
                }`}
              >
                {addingFav ? '✕' : <Plus size={14} />}
              </button>
            </div>

            {addingFav && (
              <motion.form 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={handleAddFavorite}
                className="bg-black/40 border border-white/5 rounded-xl p-4 space-y-4"
              >
                <div>
                  <label className="text-[9px] font-mono text-gray-500 uppercase tracking-widest mb-1 block">
                    Nombre Personalizado (ej: Mi Casa, Mi Oficina)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Mi Oficina"
                    value={favName}
                    onChange={(e) => setFavName(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 focus:border-[#39FF14]/50 focus:outline-none px-3 py-2 rounded-lg font-mono text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-mono text-gray-500 uppercase tracking-widest mb-1 block">
                    Categoría Táctica
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {FAVORITE_CATEGORIES.map((cat) => {
                      const IconComp = cat.icon;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setFavCategory(cat.id)}
                          className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-center ${
                            favCategory === cat.id
                              ? 'bg-[#39FF14]/10 border-[#39FF14]/40 text-[#39FF14]'
                              : 'bg-white/5 border-white/5 text-gray-400 hover:border-white/10'
                          }`}
                        >
                          <IconComp size={14} />
                          <span className="text-[8px] font-mono uppercase font-black tracking-tight">{cat.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-mono text-gray-500 uppercase tracking-widest mb-1 block">
                    Dirección Satelital
                  </label>
                  <PlacesAutocomplete
                    placeholder="Buscar dirección..."
                    value={favLocation?.address || ''}
                    onLocationSelect={(loc) => setFavLocation(loc)}
                    icon={<MapPin size={18} className="text-[#39FF14]" />}
                  />
                </div>

                <button
                  type="submit"
                  disabled={!favName || !favLocation}
                  className="w-full bg-[#39FF14] text-black py-2.5 rounded-lg font-mono text-xs uppercase font-black transition-all"
                >
                  {t.addFavBtn}
                </button>
              </motion.form>
            )}

            <div className="space-y-2">
              {(!user.favorites || user.favorites.length === 0) ? (
                <p className="text-[10px] font-mono text-gray-600 uppercase italic tracking-wider">
                  {t.noFavs}
                </p>
              ) : (
                user.favorites.map((fav) => {
                  const catObj = FAVORITE_CATEGORIES.find(c => c.id === fav.category) || FAVORITE_CATEGORIES[FAVORITE_CATEGORIES.length - 1];
                  const IconComp = catObj.icon;

                  return (
                    <div 
                      key={fav.id}
                      className="flex items-center justify-between bg-black/40 border border-white/5 p-3 rounded-xl gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[#39FF14]/5 flex items-center justify-center shrink-0 border border-[#39FF14]/20 text-[#39FF14]">
                          <IconComp size={14} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold uppercase tracking-tight text-white">{fav.name}</p>
                            <span className="text-[8px] font-mono bg-white/5 border border-white/10 rounded-full px-2 text-gray-500 uppercase font-bold">
                              {catObj.name}
                            </span>
                          </div>
                          <p className="text-[9px] font-mono text-gray-500 truncate max-w-[200px] sm:max-w-[350px]">
                            {fav.address}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteFavorite(fav.id)}
                        className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all shrink-0"
                        title="Eliminar Favorito"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: SETTINGS */}
      {activeTab === 'settings' && (
        <div className="hud-card p-6 space-y-6">
          <div className="flex items-center gap-2 border-b border-white/5 pb-3">
            <SettingsIcon size={16} className="text-[#39FF14]" />
            <h4 className="text-xs uppercase font-mono font-black text-gray-300 tracking-wider">
              Ajustes de Interfaz y Dispositivo
            </h4>
          </div>

          <div className="space-y-5">
            {/* Theme Mode Toggle */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="text-left">
                <p className="text-xs font-bold text-white">{t.themeToggle}</p>
                <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mt-0.5">Alternar modos visuales</p>
              </div>
              <button
                onClick={() => handleSaveSettings({ darkMode: !defaultSettings.darkMode })}
                className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-xs font-mono uppercase text-gray-300 hover:text-[#39FF14] hover:border-[#39FF14]/50 transition-all"
              >
                {defaultSettings.darkMode ? (
                  <>
                    <Moon size={14} className="text-[#39FF14]" />
                    <span>Cyber Dark</span>
                  </>
                ) : (
                  <>
                    <Sun size={14} className="text-yellow-400" />
                    <span>Pure Light</span>
                  </>
                )}
              </button>
            </div>

            {/* Language Selector */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="text-left">
                <p className="text-xs font-bold text-white">{t.langToggle}</p>
                <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mt-0.5">Español vs English</p>
              </div>
              <button
                onClick={() => handleSaveSettings({ language: defaultSettings.language === 'es' ? 'en' : 'es' })}
                className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-xs font-mono uppercase text-gray-300 hover:text-[#39FF14] hover:border-[#39FF14]/50 transition-all"
              >
                <Globe size={14} className="text-[#39FF14]" />
                <span>{defaultSettings.language === 'es' ? 'ESPAÑOL' : 'ENGLISH'}</span>
              </button>
            </div>

            {/* GPS Precision */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-4 gap-3">
              <div className="text-left">
                <p className="text-xs font-bold text-white">{t.gpsToggle}</p>
                <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mt-0.5">Optimizar frecuencia del satélite GPS</p>
              </div>
              
              <div className="flex bg-black/60 border border-white/10 p-1 rounded-xl">
                <button
                  onClick={() => handleSaveSettings({ gpsPrecision: 'high' })}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-mono uppercase font-black transition-all ${
                    defaultSettings.gpsPrecision === 'high'
                      ? 'bg-[#39FF14]/20 border border-[#39FF14]/30 text-[#39FF14]'
                      : 'text-gray-500 hover:text-white'
                  }`}
                >
                  {t.highPrecision}
                </button>
                <button
                  onClick={() => handleSaveSettings({ gpsPrecision: 'optimized' })}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-mono uppercase font-black transition-all ${
                    defaultSettings.gpsPrecision === 'optimized'
                      ? 'bg-white/5 text-gray-500 hover:text-white'
                      : 'text-gray-500 hover:text-white'
                  }`}
                >
                  {t.optimized}
                </button>
              </div>
            </div>

            {/* Notifications Toggle */}
            <div className="flex items-center justify-between pb-2">
              <div className="text-left">
                <p className="text-xs font-bold text-white">{t.notifToggle}</p>
                <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mt-0.5">Alertas acústicas y visuales de tránsito</p>
              </div>
              <button
                onClick={() => handleSaveSettings({ notificationsEnabled: !defaultSettings.notificationsEnabled })}
                className={`w-12 h-6 rounded-full transition-all flex items-center p-0.5 ${
                  defaultSettings.notificationsEnabled ? 'bg-[#39FF14]' : 'bg-gray-800'
                }`}
              >
                <div className={`w-5 h-5 bg-black rounded-full transition-all ${
                  defaultSettings.notificationsEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}></div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
