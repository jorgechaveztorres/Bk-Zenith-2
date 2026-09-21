import React, { useState } from 'react';
import { auth, db } from '../firebase/config';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { UserRole, User } from '../types';
import { ShieldCheck, User as UserIcon, Car, Cpu } from 'lucide-react';
import { motion } from 'motion/react';

interface AuthProps {
  onUserChange: (user: User | null) => void;
}

export default function Auth({ onUserChange }: AuthProps) {
  const [loading, setLoading] = useState(false);

  const handleLogin = async (role: UserRole) => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const { uid, displayName, email } = result.user;

      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        const newUser: User = {
          uid,
          fullName: displayName || 'Anonymous',
          email: email || '',
          role,
          activeRole: role,
          rolesEnabled: [role],
          rating: 5.0
        };
        await setDoc(userRef, {
          ...newUser,
          createdAt: serverTimestamp()
        });
        onUserChange(newUser);
      } else {
        const userData = userSnap.data() as User;
        const currentRoles = userData.rolesEnabled || [userData.role || role];
        const updatedRoles = Array.from(new Set([...currentRoles, role]));

        await setDoc(userRef, {
          role,
          activeRole: role,
          rolesEnabled: updatedRoles
        }, { merge: true });

        userData.role = role;
        userData.activeRole = role;
        userData.rolesEnabled = updatedRoles;
        onUserChange(userData);
      }
    } catch (error) {
      console.error("Authentication override failed", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-12">
      <div className="text-center relative">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-3 py-1 bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-full mb-6"
        >
          <Cpu size={12} className="text-[#39FF14] animate-pulse" />
          <span className="text-[10px] font-mono text-[#39FF14] uppercase tracking-widest font-bold">Pasarela de Acceso Seguro</span>
        </motion.div>
        
        <h1 className="text-6xl font-black tracking-tighter text-white mb-4 italic uppercase">
          Zénith
        </h1>
        <p className="text-gray-500 font-mono text-xs uppercase tracking-[0.3em]">Verificación de Identidad Operativa</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleLogin(UserRole.PASSENGER)}
          disabled={loading}
          className="hud-card group p-10 flex flex-col items-center justify-center border border-white/5 hover:border-[#39FF14]/50 transition-all cursor-pointer text-center"
        >
          <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-[#39FF14]/20 group-hover:text-[#39FF14] transition-all">
            <UserIcon size={32} />
          </div>
          <h3 className="text-xl font-black uppercase tracking-tight mb-2 italic">Cliente</h3>
          <p className="text-gray-500 text-xs font-mono uppercase tracking-widest leading-relaxed">
            Despliega solicitudes logísticas y rastrea activos en tiempo real
          </p>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleLogin(UserRole.DRIVER)}
          disabled={loading}
          className="hud-card group p-10 flex flex-col items-center justify-center border border-white/5 hover:border-[#39FF14]/50 transition-all cursor-pointer text-center"
        >
          <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-[#39FF14]/20 group-hover:text-[#39FF14] transition-all">
            <Car size={32} />
          </div>
          <h3 className="text-xl font-black uppercase tracking-tight mb-2 italic">Operador</h3>
          <p className="text-gray-500 text-xs font-mono uppercase tracking-widest leading-relaxed">
            Acepta operaciones y optimiza nodos de tránsito urbano
          </p>
        </motion.button>
      </div>

      <div className="flex items-center gap-2 text-gray-600 font-mono text-[10px] uppercase tracking-widest">
        <ShieldCheck size={14} className="text-[#39FF14]/50" />
        Sesión Operativa Encriptada
      </div>
    </div>
  );
}
