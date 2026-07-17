import React, { useState, useEffect } from 'react';
import { DriverService } from '../../services/DriverService';
import { motion } from 'motion/react';
import { Mail, Lock, User as UserIcon, Phone, MapPin, ArrowRight, RefreshCw, KeyRound, ShieldAlert } from 'lucide-react';
import { auth, db } from '../../firebase/config';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { User } from '../../types';

interface DriverRegistrationScreenProps {
  onSuccess: (user: User) => void;
}

export default function DriverRegistrationScreen({ onSuccess }: DriverRegistrationScreenProps) {
  const [isLogin, setIsLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [city, setCity] = useState('Trujillo');
  const [showPasswordRecovery, setShowPasswordRecovery] = useState(false);

  // Client Validation Errors
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const errors: Record<string, string> = {};
    if (!isLogin) {
      if (firstName.trim() && firstName.length < 2) errors.firstName = 'El nombre debe tener al menos 2 caracteres';
      if (lastName.trim() && lastName.length < 2) errors.lastName = 'El apellido debe tener al menos 2 caracteres';
      if (phone.trim() && !/^[9][0-9]{8}$/.test(phone)) errors.phone = 'El celular debe iniciar con 9 y tener 9 dígitos';
    }
    if (email.trim() && !/\S+@\S+\.\S+/.test(email)) errors.email = 'Ingrese un formato de correo electrónico válido';
    if (password.trim() && password.length < 6) errors.password = 'La contraseña debe tener al menos 6 caracteres';
    setValidationErrors(errors);
  }, [firstName, lastName, email, phone, password, isLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Object.keys(validationErrors).length > 0) return;

    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        // Sign In
        const cred = await signInWithEmailAndPassword(auth, email, password);
        const docSnap = await getDoc(doc(db, 'users', cred.user.uid));
        if (docSnap.exists()) {
          onSuccess(docSnap.data() as User);
        } else {
          setError("El perfil de usuario no se pudo encontrar en el sistema.");
        }
      } else {
        // Sign Up Driver
        const fullName = `${firstName.trim()} ${lastName.trim()}`;
        const userDoc = await DriverService.registerDriver(
          email, 
          password, 
          fullName, 
          phone, 
          city
        );
        onSuccess(userDoc);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('auth/email-already-in-use')) {
        setError('Este correo ya está registrado en la red Zénith.');
      } else if (msg.includes('auth/wrong-password') || msg.includes('auth/user-not-found')) {
        setError('Credenciales incorrectas. Verifique e intente nuevamente.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordRecovery = async () => {
    if (!email) {
      setError('Por favor, ingrese su correo electrónico para enviar el enlace de recuperación.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await DriverService.recoverPassword(email);
      setError('Enlace de recuperación enviado. Por favor, revise su correo.');
      setShowPasswordRecovery(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-black/40 border border-white/5 backdrop-blur-md rounded-3xl p-6 sm:p-8 max-w-md mx-auto shadow-2xl">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-black tracking-tight uppercase italic text-[#39FF14]">
          {isLogin ? 'Ingresar a la Red' : 'Registro de Operador'}
        </h2>
        <p className="text-xs text-gray-400 font-mono mt-1 uppercase tracking-wider">
          {isLogin ? 'Acceso al sistema táctico Zénith' : 'Primer registro de conductor profesional'}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl flex items-center gap-2">
          <ShieldAlert size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {showPasswordRecovery ? (
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1">Correo Electrónico</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:border-[#39FF14]/50 outline-none transition-all"
                placeholder="operador@zenith.com"
              />
            </div>
          </div>
          <button
            onClick={handlePasswordRecovery}
            disabled={loading}
            className="w-full py-3 bg-[#39FF14] text-black font-black text-xs uppercase tracking-wider rounded-xl hover:shadow-glow transition-all flex items-center justify-center gap-2"
          >
            {loading ? <RefreshCw className="animate-spin" size={16} /> : <KeyRound size={16} />}
            Enviar Enlace de Recuperación
          </button>
          <button 
            onClick={() => setShowPasswordRecovery(false)}
            className="w-full text-center text-xs text-gray-500 hover:text-white transition-all underline font-mono"
          >
            Volver
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1">Nombres</label>
                <input 
                  type="text" 
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={`w-full bg-white/5 border ${validationErrors.firstName ? 'border-red-500/50' : 'border-white/10'} rounded-xl py-3 px-4 text-sm focus:border-[#39FF14]/50 outline-none transition-all`}
                  placeholder="Juan"
                  required
                />
                {validationErrors.firstName && <span className="text-[9px] text-red-400 font-mono mt-1 block">{validationErrors.firstName}</span>}
              </div>
              <div>
                <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1">Apellidos</label>
                <input 
                  type="text" 
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={`w-full bg-white/5 border ${validationErrors.lastName ? 'border-red-500/50' : 'border-white/10'} rounded-xl py-3 px-4 text-sm focus:border-[#39FF14]/50 outline-none transition-all`}
                  placeholder="Pérez"
                  required
                />
                {validationErrors.lastName && <span className="text-[9px] text-red-400 font-mono mt-1 block">{validationErrors.lastName}</span>}
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1">Correo Electrónico</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full bg-white/5 border ${validationErrors.email ? 'border-red-500/50' : 'border-white/10'} rounded-xl py-3 pl-10 pr-4 text-sm focus:border-[#39FF14]/50 outline-none transition-all`}
                placeholder="operador@zenith.com"
                required
              />
            </div>
            {validationErrors.email && <span className="text-[9px] text-red-400 font-mono mt-1 block">{validationErrors.email}</span>}
          </div>

          {!isLogin && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1">Celular</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input 
                    type="tel" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={`w-full bg-white/5 border ${validationErrors.phone ? 'border-red-500/50' : 'border-white/10'} rounded-xl py-3 pl-10 pr-4 text-sm focus:border-[#39FF14]/50 outline-none transition-all`}
                    placeholder="912345678"
                    required
                  />
                </div>
                {validationErrors.phone && <span className="text-[9px] text-red-400 font-mono mt-1 block">{validationErrors.phone}</span>}
              </div>
              <div>
                <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1">Ciudad</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <select 
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-neutral-900 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:border-[#39FF14]/50 outline-none transition-all appearance-none"
                  >
                    <option value="Trujillo">Trujillo</option>
                    <option value="Lima">Lima</option>
                    <option value="Arequipa">Arequipa</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full bg-white/5 border ${validationErrors.password ? 'border-red-500/50' : 'border-white/10'} rounded-xl py-3 pl-10 pr-4 text-sm focus:border-[#39FF14]/50 outline-none transition-all`}
                placeholder="******"
                required
              />
            </div>
            {validationErrors.password && <span className="text-[9px] text-red-400 font-mono mt-1 block">{validationErrors.password}</span>}
          </div>

          <button
            type="submit"
            disabled={loading || Object.keys(validationErrors).length > 0}
            className="w-full mt-4 py-3 bg-[#39FF14] text-black font-black text-xs uppercase tracking-wider rounded-xl hover:shadow-glow transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? <RefreshCw className="animate-spin" size={16} /> : <ArrowRight size={16} />}
            {isLogin ? 'Ingresar Ahora' : 'Registrar y Continuar'}
          </button>

          <div className="flex flex-col gap-2 pt-2 text-center">
            {isLogin && (
              <button 
                type="button"
                onClick={() => setShowPasswordRecovery(true)}
                className="text-xs text-gray-500 hover:text-white transition-all font-mono"
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-xs text-[#39FF14] hover:underline font-mono"
            >
              {isLogin ? '¿No tienes cuenta? Regístrate aquí' : '¿Ya tienes una cuenta? Inicia sesión'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
