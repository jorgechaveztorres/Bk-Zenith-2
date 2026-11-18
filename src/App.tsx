/**
 * ZÉNITH — Raíz de la app (versión MySQL/cPanel, sin Firebase).
 * Sesión propia (celular + clave) -> pantalla de cliente o de motorizado según el rol.
 */
import React, { useEffect, useState } from 'react';
import { LogOut, Car, User as UserIcon, Store, ShieldCheck, Wallet, FileText, History } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AuthApi } from './api/endpoints';
import { ApiError, getSessionUser, hasSession, onSessionChange } from './api/http';
import { Realtime } from './api/realtime';
import type { ApiUser } from './api/types';
import PhoneAuth from './components/auth/PhoneAuth';
import PassengerHome from './components/app/PassengerHome';
import DriverHome from './components/app/DriverHome';
import RestaurantHome from './components/app/RestaurantHome';
import AdminHome from './components/app/AdminHome';
import WalletHome from './components/app/WalletHome';
import MyDocuments from './components/app/MyDocuments';
import OrderHistory from './components/app/OrderHistory';
import { enablePushNotifications, disablePushNotifications } from './push';

type View = 'home' | 'restaurant' | 'admin' | 'wallet' | 'documents' | 'history';

export default function App() {
  const [user, setUser] = useState<ApiUser | null>(getSessionUser());
  const [checking, setChecking] = useState(hasSession());
  const [view, setView] = useState<View>('home');

  // Mantener la vista al día con la sesión (login, renovación fallida, logout).
  useEffect(() => onSessionChange((u) => {
    setUser(u);
    if (!u) setView('home');
  }), []);

  // Al abrir la app con sesión guardada: confirmar con el servidor que sigue vigente.
  useEffect(() => {
    if (!hasSession()) return;
    AuthApi.me()
      .catch((err: unknown) => {
        // Sin internet se queda con la sesión guardada; si el servidor la rechazó, al login.
        if (err instanceof ApiError && (err.status === 401 || err.status === 404)) void AuthApi.logout();
      })
      .finally(() => setChecking(false));
  }, []);

  // Avisos push: solo con sesión iniciada; mejor esfuerzo, nunca bloquea la app.
  useEffect(() => {
    if (user) void enablePushNotifications();
    else void disablePushNotifications();
  }, [user]);

  // WebSocket solo con sesión iniciada.
  useEffect(() => {
    if (!user) {
      Realtime.stop();
      return;
    }
    Realtime.start();
    const wake = () => {
      if (document.visibilityState === 'visible') Realtime.wake();
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);
    return () => {
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
    };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (checking) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-[#39FF14] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isDriver = user?.role === 'driver';

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans overflow-x-hidden">
      <header className="fixed top-0 left-0 right-0 z-[1000] bg-[#050505]/85 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#39FF14] rounded-sm flex items-center justify-center">
              <Car size={20} className="text-black" />
            </div>
            <span className="font-black text-xl tracking-[0.2em] uppercase italic">Zénith</span>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <div className="text-right leading-tight">
                <p className="text-[9px] font-mono text-[#39FF14] uppercase tracking-widest flex items-center justify-end gap-1">
                  {isDriver ? <Car size={10} /> : <UserIcon size={10} />}
                  {isDriver ? 'Motorizado' : 'Cliente'}
                </p>
                <p className="text-sm font-bold truncate max-w-[140px]">{user.fullName}</p>
              </div>
              <button
                onClick={() => setView((v) => (v === 'history' ? 'home' : 'history'))}
                className={`p-2.5 rounded-xl border ${view === 'history' ? 'bg-[#39FF14]/10 border-[#39FF14] text-[#39FF14]' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
                aria-label="Historial de pedidos"
                title="Historial de pedidos"
              >
                <History size={16} />
              </button>
              <button
                onClick={() => setView((v) => (v === 'restaurant' ? 'home' : 'restaurant'))}
                className={`p-2.5 rounded-xl border ${view === 'restaurant' ? 'bg-[#39FF14]/10 border-[#39FF14] text-[#39FF14]' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
                aria-label="Mi restaurante"
                title="Mi restaurante"
              >
                <Store size={16} />
              </button>
              {isDriver && (
                <button
                  onClick={() => setView((v) => (v === 'documents' ? 'home' : 'documents'))}
                  className={`p-2.5 rounded-xl border ${view === 'documents' ? 'bg-[#39FF14]/10 border-[#39FF14] text-[#39FF14]' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
                  aria-label="Mis documentos"
                  title="Mis documentos"
                >
                  <FileText size={16} />
                </button>
              )}
              {isDriver && (
                <button
                  onClick={() => setView((v) => (v === 'wallet' ? 'home' : 'wallet'))}
                  className={`p-2.5 rounded-xl border ${view === 'wallet' ? 'bg-[#39FF14]/10 border-[#39FF14] text-[#39FF14]' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
                  aria-label="Mi billetera"
                  title="Mi billetera"
                >
                  <Wallet size={16} />
                </button>
              )}
              {user.isAdmin && (
                <button
                  onClick={() => setView((v) => (v === 'admin' ? 'home' : 'admin'))}
                  className={`p-2.5 rounded-xl border ${view === 'admin' ? 'bg-[#39FF14]/10 border-[#39FF14] text-[#39FF14]' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
                  aria-label="Panel admin"
                  title="Panel admin"
                >
                  <ShieldCheck size={16} />
                </button>
              )}
              <button
                onClick={() => {
                  if (window.confirm('¿Cerrar sesión?')) void AuthApi.logout();
                }}
                className="p-2.5 bg-white/5 hover:bg-red-500/20 hover:text-red-500 rounded-xl border border-white/10"
                aria-label="Cerrar sesión"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-xl mx-auto px-5 pt-24 pb-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={user ? `${user.id}-${user.role}-${view}` : 'auth'}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {!user ? (
              <PhoneAuth onSignedIn={setUser} />
            ) : view === 'history' ? (
              <OrderHistory isDriver={isDriver} />
            ) : view === 'restaurant' ? (
              <RestaurantHome />
            ) : view === 'admin' && user.isAdmin ? (
              <AdminHome />
            ) : view === 'wallet' && isDriver ? (
              <WalletHome />
            ) : view === 'documents' && isDriver ? (
              <MyDocuments />
            ) : isDriver ? (
              <DriverHome user={user} />
            ) : (
              <PassengerHome user={user} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
