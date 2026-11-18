/**
 * ZÉNITH — Entrar con celular + clave (reemplaza el login de Google/Firebase).
 * SMS solo para registrarse y para recuperar la clave.
 */
import React, { useState } from 'react';
import { Phone, Lock, User as UserIcon, Car, KeyRound, ArrowLeft, Loader2 } from 'lucide-react';
import { AuthApi, MIN_PASSWORD } from '../../api/endpoints';
import { errorMessage } from '../../api/http';
import type { ApiUser, AppRole } from '../../api/types';

type Mode = 'login' | 'register' | 'register-code' | 'forgot' | 'forgot-code';

interface Props {
  onSignedIn: (user: ApiUser) => void;
}

const onlyDigits = (v: string, max: number) => v.replace(/\D/g, '').slice(0, max);
const validPhone = (p: string) => /^9\d{8}$/.test(p);

const inputCls =
  'w-full bg-white/5 border border-white/10 focus:border-[#39FF14]/60 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-gray-500 outline-none transition-colors';

function Field({ icon, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ReactNode }) {
  return (
    <label className="relative block">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">{icon}</span>
      <input {...props} className={inputCls} />
    </label>
  );
}

export default function PhoneAuth({ onSignedIn }: Props) {
  const [mode, setMode] = useState<Mode>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<AppRole>('passenger');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const go = (m: Mode) => {
    setMode(m);
    setError('');
    setInfo('');
    setCode('');
    setPassword('');
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!validPhone(phone)) {
      setError('El celular debe tener 9 dígitos y empezar con 9.');
      return;
    }
    const needsPassword = mode === 'login' || mode === 'register-code' || mode === 'forgot-code';
    if (needsPassword && mode !== 'login' && password.length < MIN_PASSWORD) {
      setError(`La clave debe tener al menos ${MIN_PASSWORD} caracteres.`);
      return;
    }
    if ((mode === 'register-code' || mode === 'forgot-code') && code.length < 4) {
      setError('Escribe el código que llegó por SMS.');
      return;
    }

    switch (mode) {
      case 'login':
        return run(async () => onSignedIn(await AuthApi.login(phone, password)));
      case 'register':
        return run(async () => {
          const r = await AuthApi.startRegistration(phone);
          setMode('register-code');
          setInfo(r.message);
        });
      case 'register-code':
        if (fullName.trim().length < 3) {
          setError('Escribe tu nombre completo.');
          return;
        }
        return run(async () => onSignedIn(await AuthApi.completeRegistration({ phone, code, password, fullName: fullName.trim(), role })));
      case 'forgot':
        return run(async () => {
          const r = await AuthApi.startPasswordReset(phone);
          setMode('forgot-code');
          setInfo(r.message);
        });
      case 'forgot-code':
        return run(async () => onSignedIn(await AuthApi.completePasswordReset(phone, code, password)));
    }
  };

  const title: Record<Mode, string> = {
    login: 'Entrar',
    register: 'Crear cuenta',
    'register-code': 'Crear cuenta',
    forgot: 'Recuperar clave',
    'forgot-code': 'Nueva clave',
  };
  const cta: Record<Mode, string> = {
    login: 'Entrar',
    register: 'Enviarme el código por SMS',
    'register-code': 'Crear mi cuenta',
    forgot: 'Enviarme el código por SMS',
    'forgot-code': 'Guardar clave y entrar',
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-5xl font-black tracking-tighter italic uppercase">Zénith</h1>
        <p className="text-gray-500 font-mono text-[11px] uppercase tracking-[0.3em] mt-2">Delivery en Trujillo</p>
      </div>

      <form onSubmit={submit} className="hud-card p-6 sm:p-8 space-y-4 border border-white/10 rounded-2xl">
        <div className="flex items-center gap-3 mb-2">
          {mode !== 'login' && (
            <button type="button" onClick={() => go('login')} className="p-2 -ml-2 text-gray-400 hover:text-white" aria-label="Volver">
              <ArrowLeft size={18} />
            </button>
          )}
          <h2 className="text-xl font-black uppercase italic">{title[mode]}</h2>
        </div>

        <Field
          icon={<Phone size={18} />}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="Celular (9 dígitos)"
          value={phone}
          disabled={mode === 'register-code' || mode === 'forgot-code'}
          onChange={(e) => setPhone(onlyDigits(e.target.value, 9))}
        />

        {(mode === 'register-code' || mode === 'forgot-code') && (
          <Field
            icon={<KeyRound size={18} />}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Código del SMS"
            value={code}
            onChange={(e) => setCode(onlyDigits(e.target.value, 6))}
          />
        )}

        {mode === 'register-code' && (
          <>
            <Field
              icon={<UserIcon size={18} />}
              type="text"
              autoComplete="name"
              placeholder="Nombre completo"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              {([
                ['passenger', 'Cliente', <UserIcon key="p" size={20} />],
                ['driver', 'Motorizado', <Car key="d" size={20} />],
              ] as const).map(([value, label, icon]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRole(value)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-mono uppercase font-bold transition-all ${
                    role === value ? 'bg-[#39FF14]/15 border-[#39FF14] text-[#39FF14]' : 'bg-white/5 border-white/10 text-gray-400'
                  }`}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        {(mode === 'login' || mode === 'register-code' || mode === 'forgot-code') && (
          <Field
            icon={<Lock size={18} />}
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder={mode === 'login' ? 'Clave' : `Clave nueva (mínimo ${MIN_PASSWORD})`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}

        {info && <p className="text-xs text-[#39FF14] font-mono">{info}</p>}
        {error && <p className="text-xs text-red-400 font-mono">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-[#39FF14] hover:bg-[#32e012] disabled:opacity-60 text-black py-3.5 rounded-xl font-mono text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2"
        >
          {busy && <Loader2 size={16} className="animate-spin" />}
          {cta[mode]}
        </button>

        {mode === 'login' && (
          <div className="flex justify-between pt-2 text-xs font-mono">
            <button type="button" onClick={() => go('forgot')} className="text-gray-400 hover:text-white">Olvidé mi clave</button>
            <button type="button" onClick={() => go('register')} className="text-[#39FF14] hover:underline">Crear cuenta</button>
          </div>
        )}
        {(mode === 'register-code' || mode === 'forgot-code') && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(async () => {
              const r = mode === 'register-code' ? await AuthApi.startRegistration(phone) : await AuthApi.startPasswordReset(phone);
              setInfo(r.message);
            })}
            className="w-full text-xs font-mono text-gray-400 hover:text-white pt-1"
          >
            Reenviar código
          </button>
        )}
      </form>
    </div>
  );
}
