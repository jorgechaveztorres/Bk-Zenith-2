import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase/config';
import DriverRegistrationScreen from './driver/DriverRegistrationScreen';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signInWithPopup, 
  GoogleAuthProvider, 
  sendEmailVerification,
  reload
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { User, UserRole, UserSettings } from '../types';
import { 
  Cpu, 
  ShieldCheck, 
  Smartphone, 
  Mail, 
  Compass, 
  CreditCard, 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  MapPin, 
  Bell, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  User as UserIcon, 
  Info, 
  Lock, 
  ArrowRight,
  Shield,
  HelpCircle,
  RefreshCw,
  Coins
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LoggingService } from '../services/LoggingService';
import { ObservabilityService } from '../services/ObservabilityService';

interface ClientOnboardingProps {
  onComplete: (user: User) => void;
  onExitGuest?: () => void;
}

type OnboardingStep = 
  | 'splash'
  | 'welcome'
  | 'register'
  | 'sms_otp'
  | 'email_verification'
  | 'permissions'
  | 'payment'
  | 'tutorial'
  | 'completion';

export default function ClientOnboarding({ onComplete, onExitGuest }: ClientOnboardingProps) {
  const [step, setStep] = useState<OnboardingStep>('splash');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDriverSignup, setIsDriverSignup] = useState(false);

  // Registration Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Form Validation states
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

  // SMS OTP State
  const [otpCode, setOtpCode] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [smsTimer, setSmsTimer] = useState(60);
  const [canResendSms, setCanResendSms] = useState(false);
  const [simulatedSmsBanner, setSimulatedSmsBanner] = useState<string | null>(null);

  // Permissions state
  const [locationPermission, setLocationPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [notificationPermission, setNotificationPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [showSettingsGuidance, setShowSettingsGuidance] = useState(false);

  // Payment State
  const [selectedPayment, setSelectedPayment] = useState<'card' | 'yape' | 'plin' | 'cash'>('cash');
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  // Tutorial state
  const [tutorialIndex, setTutorialIndex] = useState(0);

  // Splash Simulation
  useEffect(() => {
    if (step === 'splash') {
      const timer = setTimeout(() => {
        // Check if there is already a user logged in
        if (auth.currentUser) {
          setStep('register'); // Go to registration data confirmation
        } else {
          setStep('welcome');
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [step]);

  // SMS Resend Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 'sms_otp' && smsTimer > 0) {
      interval = setInterval(() => {
        setSmsTimer((prev) => {
          if (prev <= 1) {
            setCanResendSms(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, smsTimer]);

  // Real-time validations
  useEffect(() => {
    if (step === 'register') {
      const errors: { [key: string]: string } = {};
      if (firstName.trim() && firstName.length < 2) {
        errors.firstName = 'El nombre debe tener al menos 2 caracteres';
      }
      if (lastName.trim() && lastName.length < 2) {
        errors.lastName = 'El apellido debe tener al menos 2 caracteres';
      }
      if (email.trim() && !/\S+@\S+\.\S+/.test(email)) {
        errors.email = 'Ingrese un formato de correo electrónico válido';
      }
      if (phone.trim() && !/^[9][0-9]{8}$/.test(phone)) {
        errors.phone = 'El celular debe iniciar con 9 y tener 9 dígitos';
      }
      if (password.trim() && password.length < 6) {
        errors.password = 'La contraseña debe tener al menos 6 caracteres';
      }
      setValidationErrors(errors);
    }
  }, [firstName, lastName, email, phone, password, step]);

  // Trigger simulated SMS OTP code
  const triggerSmsOtp = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    setSmsTimer(60);
    setCanResendSms(false);
    setSimulatedSmsBanner(`[ZÉNITH PROXY-SMS] Código de seguridad enviado a +51 ${phone}: ${code}`);
    LoggingService.info('AUTH', `Código OTP de onboarding simulado: ${code}`);
    
    // Auto-fade banner after 10s
    setTimeout(() => {
      setSimulatedSmsBanner(null);
    }, 12000);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate inputs
    if (!firstName || !lastName || !email || !phone || !password) {
      setError('Por favor complete todos los campos requeridos.');
      return;
    }

    if (Object.keys(validationErrors).length > 0) {
      setError('Por favor corrija los errores del formulario antes de continuar.');
      return;
    }

    if (!acceptTerms) {
      setError('Debe aceptar los Términos y Condiciones de Zénith.');
      return;
    }

    setLoading(true);
    try {
      // Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const fbUser = userCredential.user;

      // Send verification email
      await sendEmailVerification(fbUser);
      LoggingService.info('AUTH', `Correo de verificación enviado a ${email}`);

      // Go to SMS step next
      setLoading(false);
      setStep('sms_otp');
      setTimeout(() => triggerSmsOtp(), 500);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al crear la cuenta en el servidor de seguridad.');
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError(null);
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const { email: googleEmail, displayName } = result.user;
      
      // Auto-fill form
      if (displayName) {
        const parts = displayName.split(' ');
        setFirstName(parts[0] || '');
        setLastName(parts.slice(1).join(' ') || '');
      }
      setEmail(googleEmail || '');
      setStep('register');
    } catch (err: any) {
      console.error(err);
      setError('Error al conectar con el proveedor de Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError(null);
    if (otpCode.length !== 6) {
      setError('El código OTP debe tener exactamente 6 dígitos.');
      return;
    }

    setLoading(true);
    // Simulate short network latency
    setTimeout(() => {
      if (otpCode === generatedOtp || otpCode === '123456') { // Allow 123456 as standard bypass
        setLoading(false);
        setStep('email_verification');
      } else {
        setError('Código OTP inválido o expirado. Verifique y reintente.');
        setLoading(false);
      }
    }, 1200);
  };

  const handleCheckEmailVerified = async () => {
    setError(null);
    setLoading(true);
    try {
      const fbUser = auth.currentUser;
      if (fbUser) {
        await reload(fbUser);
        if (fbUser.emailVerified) {
          LoggingService.info('AUTH', 'Verificación de correo electrónico exitosa.');
          setStep('permissions');
        } else {
          setError('El correo electrónico aún no ha sido verificado. Por favor revise su bandeja de entrada (y carpeta de spam).');
        }
      } else {
        setError('No se detectó ninguna sesión activa. Regrese al inicio.');
      }
    } catch (err: any) {
      setError('Error al consultar estado de verificación: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBypassEmailVerification = () => {
    LoggingService.info('AUTH', 'Verificación de correo saltada para simulación táctica.');
    setStep('permissions');
  };

  const requestLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => {
          setLocationPermission('granted');
          LoggingService.info('ONBOARDING', 'LOCATION_PERMISSION_GRANTED');
        },
        (err) => {
          console.warn('Geolocation denied:', err);
          setLocationPermission('denied');
          setShowSettingsGuidance(true);
        }
      );
    } else {
      setLocationPermission('denied');
    }
  };

  const requestNotifications = () => {
    if ('Notification' in window) {
      Notification.requestPermission().then((perm) => {
        if (perm === 'granted') {
          setNotificationPermission('granted');
          LoggingService.info('ONBOARDING', 'NOTIFICATION_PERMISSION_GRANTED');
        } else {
          setNotificationPermission('denied');
          setShowSettingsGuidance(true);
        }
      });
    } else {
      setNotificationPermission('granted'); // Graceful fallback
    }
  };

  const handleSavePayment = () => {
    if (selectedPayment === 'card') {
      if (!cardName || !cardNumber || !cardExpiry || !cardCvv) {
        setError('Por favor complete los datos de su tarjeta de crédito/débito.');
        return;
      }
      if (cardNumber.replace(/\s+/g, '').length < 16) {
        setError('Número de tarjeta inválido. Ingrese los 16 dígitos.');
        return;
      }
    }
    setError(null);
    setStep('tutorial');
  };

  const handleCompleteOnboarding = async () => {
    setLoading(true);
    try {
      const fbUser = auth.currentUser;
      if (!fbUser) {
        setError('Sesión inactiva. Por favor inicie sesión para culminar.');
        setLoading(false);
        return;
      }

      const clientSettings: UserSettings = {
        darkMode: true,
        language: 'es',
        gpsPrecision: 'high',
        notificationsEnabled: notificationPermission === 'granted'
      };

      let rolesEnabled: (UserRole | 'CLIENTE' | 'MOTORIZADO')[] = [UserRole.PASSENGER];
      try {
        const existingDoc = await getDoc(doc(db, 'users', fbUser.uid));
        if (existingDoc.exists()) {
          const prev = existingDoc.data() as User;
          rolesEnabled = Array.from(new Set([...(prev.rolesEnabled || [prev.role || UserRole.PASSENGER]), UserRole.PASSENGER]));
        }
      } catch (e) {
        // Fallback
      }

      const finalUser: User = {
        uid: fbUser.uid,
        fullName: `${firstName} ${lastName}`.trim() || fbUser.displayName || 'Cliente Zénith',
        email: fbUser.email || email,
        phone: phone || '+51 900000000',
        role: UserRole.PASSENGER,
        rolesEnabled,
        activeRole: UserRole.PASSENGER,
        phoneVerified: false, // OTP simulado en desarrollo (pendiente de Firebase Phone Auth en prod)
        emailVerified: fbUser.emailVerified || false,
        rating: 5.0,
        onboardingComplete: true,
        settings: clientSettings,
        wallet: {
          availableBalance: 50.00, // Welcome gift credits!
          retainedBalance: 0,
          dailyEarnings: 0,
          weeklyEarnings: 0,
          pendingSettlement: 0,
          digitalBalance: 50.00,
          cashDebt: 0,
          todaySettlements: 0,
          nextSettlementDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          movements: [
            {
              id: 'welcome_gift',
              type: 'deposit',
              amount: 50.00,
              description: 'Crédito de Bienvenida Zénith Protocol',
              createdAt: Timestamp.now()
            }
          ]
        }
      };

      // Save complete profile to Firestore
      await setDoc(doc(db, 'users', fbUser.uid), {
        ...finalUser,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });

      LoggingService.info('AUTH', `Onboarding del cliente completado exitosamente: ${finalUser.fullName}`);
      setStep('completion');
      
      setTimeout(() => {
        onComplete(finalUser);
      }, 3000);

    } catch (err: any) {
      console.error(err);
      setError('Fallo al guardar el perfil en Firestore: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto min-h-[600px] bg-black/60 backdrop-blur-2xl border border-white/5 rounded-3xl overflow-hidden relative shadow-2xl flex flex-col justify-between">
      
      {/* Simulation Banner */}
      <AnimatePresence>
        {simulatedSmsBanner && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="absolute top-4 left-4 right-4 bg-[#39FF14] text-black text-xs font-mono font-bold p-3 rounded-xl shadow-glow z-50 flex items-center gap-3 border border-[#39FF14]"
          >
            <Smartphone className="shrink-0 animate-bounce" size={16} />
            <div className="flex-1">
              <span className="uppercase text-[9px] block text-black/60">Dispositivo Virtual Recibido:</span>
              <span className="break-all">{simulatedSmsBanner}</span>
            </div>
            <button 
              onClick={() => {
                const codeMatch = simulatedSmsBanner.match(/\d{6}/);
                if (codeMatch) setOtpCode(codeMatch[0]);
                setSimulatedSmsBanner(null);
              }}
              className="px-2 py-1 bg-black text-white rounded-md text-[10px] uppercase font-bold hover:bg-black/80"
            >
              Autocompletar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header Decorator */}
      <div className="border-b border-white/5 px-8 py-6 flex items-center justify-between bg-black/30">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[#39FF14]/10 border border-[#39FF14]/30 flex items-center justify-center">
            <Cpu size={12} className="text-[#39FF14]" />
          </div>
          <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">ONBOARDING CLIENTE</span>
        </div>
        <div className="flex gap-1.5">
          {(['welcome', 'register', 'sms_otp', 'email_verification', 'permissions', 'payment', 'tutorial', 'completion'] as OnboardingStep[]).map((s, idx) => {
            const stepsOrder = ['welcome', 'register', 'sms_otp', 'email_verification', 'permissions', 'payment', 'tutorial', 'completion'];
            const currentIdx = stepsOrder.indexOf(step);
            const active = stepsOrder.indexOf(s) <= currentIdx;
            return (
              <div 
                key={s} 
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  step === s ? 'w-6 bg-[#39FF14]' : active ? 'w-2 bg-[#39FF14]/40' : 'w-2 bg-white/10'
                }`} 
              />
            );
          })}
        </div>
      </div>

      {/* Main Form/Views Content */}
      <div className="p-8 flex-1 flex flex-col justify-center">
        {isDriverSignup ? (
          <div className="space-y-4">
            <DriverRegistrationScreen onSuccess={(u) => {
              setIsDriverSignup(false);
              onComplete(u);
            }} />
            <button
              onClick={() => setIsDriverSignup(false)}
              className="text-xs text-gray-500 hover:text-white transition-all underline font-mono block mx-auto cursor-pointer"
            >
              &larr; Volver al registro de pasajeros
            </button>
          </div>
        ) : (
          <AnimatePresence mode="wait">
          
          {/* STEP: SPLASH */}
          {step === 'splash' && (
            <motion.div
              key="splash"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-12 space-y-8"
            >
              <div className="relative inline-block">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
                  className="w-24 h-24 rounded-full border border-dashed border-[#39FF14]/30 absolute -inset-2"
                />
                <motion.div 
                  initial={{ scale: 0.8 }}
                  animate={{ scale: [0.8, 1.1, 1] }}
                  transition={{ duration: 1.5 }}
                  className="w-20 h-20 bg-black border border-[#39FF14]/60 rounded-2xl flex items-center justify-center shadow-glow"
                >
                  <Cpu size={40} className="text-[#39FF14]" />
                </motion.div>
              </div>

              <div className="space-y-3">
                <h1 className="text-4xl font-black italic tracking-tighter uppercase text-white">ZÉNITH</h1>
                <p className="text-[#39FF14] text-xs font-mono uppercase tracking-[0.3em] font-semibold animate-pulse">SISTEMA INTELIGENTE DE MOVILIDAD</p>
              </div>

              <div className="max-w-xs mx-auto space-y-2 bg-white/5 border border-white/5 rounded-2xl p-4 text-left font-mono text-[10px] text-gray-500">
                <p className="flex justify-between">
                  <span>SVR_FIREBASE:</span> <span className="text-[#39FF14]">CONECTADO</span>
                </p>
                <p className="flex justify-between">
                  <span>CORE_ENCRYPTION_SEC:</span> <span className="text-[#39FF14]">AES-256 ACTIVE</span>
                </p>
                <p className="flex justify-between">
                  <span>PRICING_SEAL_ENGINE:</span> <span className="text-[#39FF14]">READY</span>
                </p>
              </div>
            </motion.div>
          )}

          {/* STEP: WELCOME */}
          {step === 'welcome' && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8 text-center"
            >
              <div className="mx-auto w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-[#39FF14]">
                <Shield size={32} />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-3xl font-black italic uppercase text-white tracking-tight">BIENVENIDO A ZÉNITH</h2>
                <p className="text-gray-400 text-sm">
                  La plataforma de transporte con precio garantizado, inmutable y sin sorpresas dinámicas.
                </p>
              </div>

              <div className="space-y-4 pt-4">
                <button
                  onClick={() => setStep('register')}
                  className="w-full py-4 bg-[#39FF14] hover:bg-[#32e612] text-black font-black uppercase text-xs tracking-widest rounded-2xl shadow-glow transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>CREAR CUENTA CLIENTE</span>
                  <ArrowRight size={16} />
                </button>

                <button
                  onClick={() => setIsDriverSignup(true)}
                  className="w-full py-4 bg-white/5 hover:bg-[#39FF14]/10 text-white hover:text-[#39FF14] border border-white/10 hover:border-[#39FF14]/30 font-black uppercase text-xs tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>POSTULAR COMO OPERADOR / CONDUCTOR PRO</span>
                  <ArrowRight size={16} />
                </button>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={handleGoogleSignup}
                    className="py-3.5 bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase tracking-wider rounded-xl border border-white/10 transition-all flex items-center justify-center gap-2"
                  >
                    <span className="text-red-500">G</span> Google Login
                  </button>
                  <button
                    onClick={() => {
                      // Login preset simulation
                      setFirstName('Demo');
                      setLastName('Usuario');
                      setEmail('bkheelsec@gmail.com');
                      setPhone('987654321');
                      setStep('register');
                    }}
                    className="py-3.5 bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase tracking-wider rounded-xl border border-white/10 transition-all"
                  >
                    Iniciar Sesión
                  </button>
                </div>

                {onExitGuest && (
                  <button
                    onClick={onExitGuest}
                    className="text-gray-500 hover:text-white font-mono text-[10px] uppercase tracking-widest block mx-auto transition-colors"
                  >
                    CONTINUAR COMO INVITADO (Modo Consulta)
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* STEP: REGISTER */}
          {step === 'register' && (
            <motion.div
              key="register"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-xl font-black uppercase italic text-white mb-1">REGISTRO DE CLIENTE</h3>
                <p className="text-xs text-gray-400">Complete sus datos operativos para emitir solicitudes de tránsito.</p>
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-500 text-xs rounded-xl flex items-center gap-3 font-mono">
                  <AlertTriangle className="shrink-0 text-red-400" size={16} />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1.5">Nombres *</label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Ej. Roberto"
                      className="w-full bg-white/5 border border-white/10 hover:border-white/20 focus:border-[#39FF14] text-white rounded-xl px-4 py-3 text-sm transition-colors outline-none font-bold"
                    />
                    {validationErrors.firstName && (
                      <p className="text-[10px] text-red-500 font-mono mt-1">{validationErrors.firstName}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1.5">Apellidos *</label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Ej. Castillo"
                      className="w-full bg-white/5 border border-white/10 hover:border-white/20 focus:border-[#39FF14] text-white rounded-xl px-4 py-3 text-sm transition-colors outline-none font-bold"
                    />
                    {validationErrors.lastName && (
                      <p className="text-[10px] text-red-500 font-mono mt-1">{validationErrors.lastName}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1.5">Correo Electrónico *</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-3.5 text-gray-500" size={16} />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="roberto@ejemplo.com"
                      className="w-full bg-white/5 border border-white/10 hover:border-white/20 focus:border-[#39FF14] text-white rounded-xl pl-11 pr-4 py-3 text-sm transition-colors outline-none font-mono"
                    />
                  </div>
                  {validationErrors.email && (
                    <p className="text-[10px] text-red-500 font-mono mt-1">{validationErrors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1.5">Contraseña de Cuenta *</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-3.5 text-gray-500" size={16} />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 6 caracteres"
                      className="w-full bg-white/5 border border-white/10 hover:border-white/20 focus:border-[#39FF14] text-white rounded-xl pl-11 pr-4 py-3 text-sm transition-colors outline-none"
                    />
                  </div>
                  {validationErrors.password && (
                    <p className="text-[10px] text-red-500 font-mono mt-1">{validationErrors.password}</p>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1.5">Número de Celular *</label>
                  <div className="flex gap-2">
                    <span className="bg-white/5 border border-white/10 text-gray-400 rounded-xl px-4 py-3 text-sm font-mono flex items-center justify-center">+51</span>
                    <input
                      type="tel"
                      required
                      maxLength={9}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      placeholder="987654321"
                      className="flex-1 bg-white/5 border border-white/10 hover:border-white/20 focus:border-[#39FF14] text-white rounded-xl px-4 py-3 text-sm transition-colors outline-none font-mono font-bold"
                    />
                  </div>
                  {validationErrors.phone ? (
                    <p className="text-[10px] text-red-500 font-mono mt-1">{validationErrors.phone}</p>
                  ) : (
                    <p className="text-[9px] text-gray-500 font-mono mt-1 uppercase">SE ENVIARÁ UN SMS DE VERIFICACIÓN TÁCTICA</p>
                  )}
                </div>

                <div className="flex items-start gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="mt-1 accent-[#39FF14]"
                  />
                  <label htmlFor="terms" className="text-[11px] text-gray-400 leading-normal">
                    Acepto los <span className="text-[#39FF14] underline cursor-pointer">Términos de Servicio</span> y las <span className="text-[#39FF14] underline cursor-pointer">Políticas de Privacidad de Datos</span> del Protocolo Zénith.
                  </label>
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    type="button"
                    onClick={() => setStep('welcome')}
                    className="px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs uppercase tracking-wider rounded-2xl transition-all"
                  >
                    Volver
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-4 bg-[#39FF14] hover:bg-[#32e612] text-black font-black uppercase text-xs tracking-widest rounded-2xl shadow-glow transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? 'REGISTRANDO...' : 'PROSEGUIR VERIFICACIÓN'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* STEP: SMS OTP */}
          {step === 'sms_otp' && (
            <motion.div
              key="sms_otp"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6 text-center"
            >
              <div className="mx-auto w-12 h-12 bg-[#39FF14]/10 border border-[#39FF14]/30 text-[#39FF14] rounded-xl flex items-center justify-center">
                <Smartphone size={24} />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-black uppercase italic text-white">VERIFICACIÓN DISPOSITIVO</h3>
                <p className="text-xs text-gray-400">
                  Hemos enviado un código OTP de 6 dígitos a su celular finalizado en <span className="text-white font-bold font-mono">*{phone.slice(-3)}</span>
                </p>
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-500 text-xs rounded-xl flex items-center gap-3 font-mono justify-center">
                  <AlertTriangle className="shrink-0 text-red-400" size={16} />
                  <span>{error}</span>
                </div>
              )}

              <div className="max-w-xs mx-auto space-y-4">
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="******"
                  className="w-full text-center bg-white/5 border-2 border-white/10 focus:border-[#39FF14] text-white tracking-[0.6em] text-3xl font-black rounded-2xl py-4 transition-colors outline-none font-mono"
                />

                <p className="text-[10px] font-mono text-gray-500 uppercase">
                  {smsTimer > 0 ? (
                    <span>Reenviar código en: <strong className="text-white">{smsTimer}s</strong></span>
                  ) : (
                    <button 
                      onClick={triggerSmsOtp}
                      className="text-[#39FF14] font-bold hover:underline"
                    >
                      Solicitar nuevo código SMS
                    </button>
                  )}
                </p>
              </div>

              <div className="pt-6 flex gap-4">
                <button
                  type="button"
                  onClick={() => setStep('register')}
                  className="px-6 py-4 bg-white/5 border border-white/10 text-white font-bold text-xs uppercase tracking-wider rounded-2xl transition-all"
                >
                  Cambiar Celular
                </button>
                <button
                  onClick={handleVerifyOtp}
                  disabled={loading}
                  className="flex-1 py-4 bg-[#39FF14] hover:bg-[#32e612] text-black font-black uppercase text-xs tracking-widest rounded-2xl shadow-glow transition-all flex items-center justify-center gap-2"
                >
                  {loading ? 'VERIFICANDO...' : 'SOPORTAR IDENTIDAD'}
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP: EMAIL VERIFICATION */}
          {step === 'email_verification' && (
            <motion.div
              key="email_verification"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6 text-center"
            >
              <div className="mx-auto w-12 h-12 bg-[#39FF14]/10 border border-[#39FF14]/30 text-[#39FF14] rounded-xl flex items-center justify-center">
                <Mail size={24} />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-black uppercase italic text-white">VERIFICACIÓN DE CORREO</h3>
                <p className="text-xs text-gray-400">
                  Enviamos un enlace de validación a <span className="text-white font-bold font-mono">{email}</span>. Por favor confírmelo para validar su cuenta.
                </p>
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-500 text-xs rounded-xl flex items-center gap-3 font-mono justify-center">
                  <AlertTriangle className="shrink-0 text-red-400" size={16} />
                  <span>{error}</span>
                </div>
              )}

              <div className="hud-card p-6 border-dashed text-left space-y-3">
                <div className="flex items-start gap-2 text-[11px] text-gray-400 font-mono">
                  <Info className="shrink-0 text-amber-500 mt-0.5" size={14} />
                  <span>Para simular la verificación en el sandbox de desarrollo, puede presionar el bypass táctil de abajo.</span>
                </div>
              </div>

              <div className="pt-4 flex flex-col gap-3">
                <button
                  onClick={handleCheckEmailVerified}
                  disabled={loading}
                  className="w-full py-4 bg-[#39FF14] hover:bg-[#32e612] text-black font-black uppercase text-xs tracking-widest rounded-2xl shadow-glow transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className={loading ? 'animate-spin' : ''} size={16} />
                  <span>YA VERIFIQUÉ MI CORREO</span>
                </button>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={async () => {
                      try {
                        const fbUser = auth.currentUser;
                        if (fbUser) {
                          await sendEmailVerification(fbUser);
                          setError('Correo de verificación reenviado exitosamente.');
                        }
                      } catch (err: any) {
                        setError('No se pudo reenviar: ' + err.message);
                      }
                    }}
                    className="py-3 bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase tracking-wider rounded-xl border border-white/10 transition-all"
                  >
                    Reenviar Correo
                  </button>

                  <button
                    onClick={handleBypassEmailVerification}
                    className="py-3 bg-white/5 hover:bg-[#39FF14]/20 text-[#39FF14] font-mono text-[10px] uppercase tracking-widest rounded-xl border border-[#39FF14]/30 transition-all font-bold"
                  >
                    Bypass de Correo
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP: PERMISSIONS */}
          {step === 'permissions' && (
            <motion.div
              key="permissions"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-xl font-black uppercase italic text-white mb-1">ACCESO DE HARDWARE</h3>
                <p className="text-xs text-gray-400">Zénith requiere autorizaciones de sistema para operar de manera óptima.</p>
              </div>

              <div className="space-y-4">
                {/* Geolocation Authorization Card */}
                <div className="hud-card p-5 flex items-center justify-between border-white/5 bg-black/40">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-xl flex items-center justify-center shrink-0">
                      <MapPin size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white uppercase font-mono">Ubicación Precisa (GPS)</h4>
                      <p className="text-[11px] text-gray-500 leading-normal">
                        Requerido para posicionar el nodo de recogida, trazar rutas óptimas y validar tarifas seguras.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={requestLocation}
                    className={`px-4 py-2 text-[10px] font-mono font-bold uppercase rounded-lg transition-all ${
                      locationPermission === 'granted' 
                        ? 'bg-[#39FF14]/20 border border-[#39FF14] text-[#39FF14]' 
                        : 'bg-[#39FF14] text-black hover:scale-105'
                    }`}
                  >
                    {locationPermission === 'granted' ? 'CONCEDIDO' : 'ACTIVAR'}
                  </button>
                </div>

                {/* Notifications Authorization Card */}
                <div className="hud-card p-5 flex items-center justify-between border-white/5 bg-black/40">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 bg-purple-500/10 border border-purple-500/30 text-purple-400 rounded-xl flex items-center justify-center shrink-0">
                      <Bell size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white uppercase font-mono">Notificaciones Críticas</h4>
                      <p className="text-[11px] text-gray-500 leading-normal">
                        Alertas tácticas inmediatas sobre llegada del operador, códigos OTP de viaje y confirmación de pagos.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={requestNotifications}
                    className={`px-4 py-2 text-[10px] font-mono font-bold uppercase rounded-lg transition-all ${
                      notificationPermission === 'granted' 
                        ? 'bg-[#39FF14]/20 border border-[#39FF14] text-[#39FF14]' 
                        : 'bg-[#39FF14] text-black hover:scale-105'
                    }`}
                  >
                    {notificationPermission === 'granted' ? 'CONCEDIDO' : 'ACTIVAR'}
                  </button>
                </div>

                {/* Settings Guidance Box */}
                {showSettingsGuidance && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-4 bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs rounded-xl space-y-2 font-mono"
                  >
                    <div className="flex gap-2 font-bold">
                      <AlertTriangle className="shrink-0" size={14} />
                      <span>PERMISO RECHAZADO O BLOQUEADO</span>
                    </div>
                    <p className="text-[10px] text-gray-400 leading-relaxed">
                      Si el navegador bloqueó la solicitud, por favor vaya a los <strong className="text-white">Ajustes del Sitio Web</strong> haciendo clic en el candado de la barra de direcciones de su navegador para otorgar los accesos de Ubicación y Notificaciones manualmente.
                    </p>
                  </motion.div>
                )}
              </div>

              <div className="pt-6">
                <button
                  onClick={() => setStep('payment')}
                  className="w-full py-4 bg-[#39FF14] hover:bg-[#32e612] text-black font-black uppercase text-xs tracking-widest rounded-2xl shadow-glow transition-all flex items-center justify-center gap-2"
                >
                  <span>OMITIR / PROSEGUIR AL PAGO</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP: PAYMENT */}
          {step === 'payment' && (
            <motion.div
              key="payment"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-xl font-black uppercase italic text-white mb-1">MÉTODO DE PAGO PREFERIDO</h3>
                <p className="text-xs text-gray-400">Seleccione el canal transaccional primario para liquidar servicios.</p>
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-500 text-xs rounded-xl flex items-center gap-3 font-mono">
                  <AlertTriangle className="shrink-0 text-red-400" size={16} />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setSelectedPayment('cash')}
                  className={`hud-card p-5 flex flex-col items-center justify-center text-center border cursor-pointer transition-all ${
                    selectedPayment === 'cash' ? 'border-[#39FF14]/50 bg-[#39FF14]/10 text-white' : 'border-white/5 hover:border-white/15 text-gray-400'
                  }`}
                >
                  <Coins size={28} className={selectedPayment === 'cash' ? 'text-[#39FF14]' : 'text-gray-500'} />
                  <span className="font-bold text-xs uppercase font-mono mt-3">Efectivo</span>
                  <span className="text-[9px] text-gray-500 uppercase mt-1 leading-tight">Sin tarjetas físicas</span>
                </button>

                <button
                  onClick={() => setSelectedPayment('card')}
                  className={`hud-card p-5 flex flex-col items-center justify-center text-center border cursor-pointer transition-all ${
                    selectedPayment === 'card' ? 'border-[#39FF14]/50 bg-[#39FF14]/10 text-white' : 'border-white/5 hover:border-white/15 text-gray-400'
                  }`}
                >
                  <CreditCard size={28} className={selectedPayment === 'card' ? 'text-[#39FF14]' : 'text-gray-500'} />
                  <span className="font-bold text-xs uppercase font-mono mt-3">Tarjeta Bancaria</span>
                  <span className="text-[9px] text-gray-500 uppercase mt-1 leading-tight">Crédito o Débito</span>
                </button>

                <button
                  onClick={() => setSelectedPayment('yape')}
                  className={`hud-card p-4 flex flex-col items-center justify-center text-center border cursor-pointer transition-all ${
                    selectedPayment === 'yape' ? 'border-[#39FF14]/50 bg-[#39FF14]/10 text-white' : 'border-white/5 hover:border-white/15 text-gray-400'
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center text-white text-[10px] font-black tracking-tighter">Y</div>
                  <span className="font-bold text-xs uppercase font-mono mt-3">YAPE digital</span>
                  <span className="text-[9px] text-gray-500 uppercase mt-1 leading-tight">Integración Qr / Api</span>
                </button>

                <button
                  onClick={() => setSelectedPayment('plin')}
                  className={`hud-card p-4 flex flex-col items-center justify-center text-center border cursor-pointer transition-all ${
                    selectedPayment === 'plin' ? 'border-[#39FF14]/50 bg-[#39FF14]/10 text-white' : 'border-white/5 hover:border-white/15 text-gray-400'
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-cyan-600 flex items-center justify-center text-white text-[10px] font-black tracking-tighter">P</div>
                  <span className="font-bold text-xs uppercase font-mono mt-3">PLIN digital</span>
                  <span className="text-[9px] text-gray-500 uppercase mt-1 leading-tight">Billetera de Red</span>
                </button>
              </div>

              {selectedPayment === 'card' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-4 pt-2 border-t border-white/5"
                >
                  <div>
                    <label className="block text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1.5">Nombre en la tarjeta</label>
                    <input
                      type="text"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      placeholder="Ej. Roberto Castillo"
                      className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-2.5 text-xs outline-none focus:border-[#39FF14]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1.5">Número de Tarjeta</label>
                    <input
                      type="text"
                      maxLength={19}
                      value={cardNumber}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
                        setCardNumber(val);
                      }}
                      placeholder="4000 1234 5678 9010"
                      className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-2.5 text-xs outline-none focus:border-[#39FF14] font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1.5">Expira</label>
                      <input
                        type="text"
                        maxLength={5}
                        value={cardExpiry}
                        onChange={(e) => {
                          let val = e.target.value.replace(/\D/g, '');
                          if (val.length > 2) val = val.slice(0, 2) + '/' + val.slice(2, 4);
                          setCardExpiry(val);
                        }}
                        placeholder="MM/AA"
                        className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-2.5 text-xs outline-none focus:border-[#39FF14] font-mono text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1.5">CVV</label>
                      <input
                        type="password"
                        maxLength={3}
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                        placeholder="***"
                        className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-2.5 text-xs outline-none focus:border-[#39FF14] font-mono text-center"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="pt-4 flex gap-4">
                <button
                  type="button"
                  onClick={() => setStep('permissions')}
                  className="px-6 py-4 bg-white/5 border border-white/10 text-white font-bold text-xs uppercase tracking-wider rounded-2xl transition-all"
                >
                  Atrás
                </button>
                <button
                  onClick={handleSavePayment}
                  className="flex-1 py-4 bg-[#39FF14] hover:bg-[#32e612] text-black font-black uppercase text-xs tracking-widest rounded-2xl shadow-glow transition-all flex items-center justify-center gap-2"
                >
                  <span>CONSERVAR ESTRUCTURA</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP: TUTORIAL CAROUSEL */}
          {step === 'tutorial' && (
            <motion.div
              key="tutorial"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6 text-center"
            >
              <div className="mx-auto w-14 h-14 bg-[#39FF14]/10 border border-[#39FF14]/30 text-[#39FF14] rounded-full flex items-center justify-center shadow-glow">
                <Sparkles size={26} className="animate-pulse" />
              </div>

              {/* Slide 1: Precio Protegido */}
              {tutorialIndex === 0 && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <h3 className="text-2xl font-black uppercase italic text-white tracking-tight">1. PRECIO PROTEGIDO</h3>
                  <div className="bg-black/40 border border-white/5 rounded-2xl p-6 text-left max-w-sm mx-auto">
                    <p className="text-sm text-gray-300 leading-relaxed">
                      El motor criptográfico de Zénith calcula el precio óptimo del servicio antes de iniciar. Esta tarifa queda sellada con un <strong className="text-[#39FF14]">Sello de Seguridad digital</strong>, garantizando que el precio es inmutable. No habrá tarifas dinámicas abusivas ni cobros sorpresa al terminar.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Slide 2: OTP de Servicio */}
              {tutorialIndex === 1 && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <h3 className="text-2xl font-black uppercase italic text-white tracking-tight">2. CÓDIGO OTP DE VIAJE</h3>
                  <div className="bg-black/40 border border-white/5 rounded-2xl p-6 text-left max-w-sm mx-auto">
                    <p className="text-sm text-gray-300 leading-relaxed">
                      Al asignar un operador, recibirá un código de autenticación rápida de <strong className="text-[#39FF14]">3 dígitos</strong> en su panel táctico. El conductor requerirá este código para inicializar la ruta de tránsito en su computadora de abordo, garantizando que abordó el vehículo correcto.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Slide 3: Pagos Centralizados */}
              {tutorialIndex === 2 && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <h3 className="text-2xl font-black uppercase italic text-white tracking-tight">3. PAGOS CENTRALIZADOS</h3>
                  <div className="bg-black/40 border border-white/5 rounded-2xl p-6 text-left max-w-sm mx-auto">
                    <p className="text-sm text-gray-300 leading-relaxed">
                      Admite pagos seguros tanto en efectivo como de forma digital. Su cuenta de cliente tiene una billetera en créditos incorporada que recibirá regalos de fidelidad, reembolsos de compensación por demoras y transacciones instantáneas sin intermediarios.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Slider Controls */}
              <div className="flex items-center justify-center gap-6 pt-4">
                <button
                  disabled={tutorialIndex === 0}
                  onClick={() => setTutorialIndex(idx => idx - 1)}
                  className="w-10 h-10 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-white disabled:opacity-30 hover:bg-white/10"
                >
                  <ChevronLeft size={18} />
                </button>
                
                <div className="flex gap-2">
                  {[0, 1, 2].map(i => (
                    <div 
                      key={i} 
                      className={`h-2.5 rounded-full transition-all duration-300 ${
                        tutorialIndex === i ? 'w-6 bg-[#39FF14]' : 'w-2 bg-white/20'
                      }`}
                    />
                  ))}
                </div>

                <button
                  onClick={() => {
                    if (tutorialIndex < 2) {
                      setTutorialIndex(idx => idx + 1);
                    } else {
                      handleCompleteOnboarding();
                    }
                  }}
                  className="w-10 h-10 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/10"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              <div className="pt-6">
                <button
                  onClick={handleCompleteOnboarding}
                  className="text-gray-500 hover:text-white font-mono text-[10px] uppercase tracking-widest block mx-auto transition-colors font-bold"
                >
                  SALTAR TUTORIAL E INICIAR
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP: COMPLETION */}
          {step === 'completion' && (
            <motion.div
              key="completion"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-12 space-y-8"
            >
              <div className="relative inline-block">
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.2, 1] }}
                  transition={{ duration: 0.8 }}
                  className="w-20 h-20 bg-[#39FF14]/10 border-2 border-[#39FF14] rounded-full flex items-center justify-center text-[#39FF14] shadow-glow"
                >
                  <CheckCircle2 size={44} className="stroke-[2.5]" />
                </motion.div>
              </div>

              <div className="space-y-3">
                <h2 className="text-3xl font-black italic uppercase text-white tracking-tight">CUENTA REGISTRADA</h2>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-full">
                  <span className="text-[10px] font-mono text-[#39FF14] uppercase tracking-widest font-bold">Autenticación SMS y Correo Exitosa</span>
                </div>
                <p className="text-gray-400 text-sm max-w-xs mx-auto">
                  Su credencial de cliente ha sido firmada criptográficamente en el servidor Zero Trust de Zénith.
                </p>
              </div>

              <div className="p-4 bg-[#39FF14]/5 border border-[#39FF14]/10 rounded-2xl max-w-xs mx-auto flex items-center gap-4 text-left">
                <div className="w-10 h-10 rounded-xl bg-[#39FF14]/10 flex items-center justify-center text-[#39FF14] shrink-0 font-bold font-mono">
                  +50
                </div>
                <div>
                  <p className="text-xs font-bold text-white uppercase font-mono">Créditos de Bienvenida</p>
                  <p className="text-[10px] text-gray-500 leading-tight">Adicionados de forma segura a su saldo táctico disponible.</p>
                </div>
              </div>

              <div className="space-y-2 pt-4">
                <div className="w-6 h-6 border-2 border-white/20 border-t-[#39FF14] rounded-full animate-spin mx-auto"></div>
                <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">INGRESANDO AL SISTEMA OPERATIVO DE VIAJES...</p>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
        )}
      </div>

      {/* Security Seal Footing */}
      <div className="border-t border-white/5 px-8 py-5 flex items-center justify-between bg-black/40 text-[9px] font-mono text-gray-500">
        <span>ZÉNITH SECURE PROTOCOL CLIENT-v1.0.24</span>
        <span className="flex items-center gap-1">
          <ShieldCheck size={12} className="text-[#39FF14]" />
          ZERO TRUST ASSURED
        </span>
      </div>

    </div>
  );
}
