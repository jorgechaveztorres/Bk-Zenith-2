import React from 'react';
import { Loader2 } from 'lucide-react';
import type { ApiRideStatus } from '../../api/types';

export const soles = (n: number) => `S/ ${n.toFixed(2)}`;

export const STATUS_LABEL: Record<ApiRideStatus, string> = {
  SEARCHING_DRIVER: 'Buscando motorizado',
  DRIVER_ASSIGNED: 'Motorizado asignado',
  DRIVER_ARRIVING: 'Motorizado en camino al recojo',
  WAITING_FOR_OTP: 'Motorizado en el punto de recojo',
  IN_PROGRESS: 'Pedido en camino',
  COMPLETED: 'Entregado',
  CANCELLED: 'Cancelado',
  EXPIRED: 'Sin motorizado disponible',
};

export const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Efectivo',
  yape: 'Yape',
  plin: 'Plin',
};

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`hud-card p-5 border border-white/10 rounded-2xl space-y-4 ${className}`}>{children}</div>;
}

export function PrimaryButton({
  children, busy, className = '', ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <button
      {...props}
      disabled={busy || props.disabled}
      className={`w-full bg-[#39FF14] hover:bg-[#32e012] disabled:opacity-50 text-black py-3.5 rounded-xl font-mono text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 ${className}`}
    >
      {busy && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

export function GhostButton({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`w-full bg-white/5 hover:bg-white/10 disabled:opacity-50 border border-white/10 text-gray-200 py-3 rounded-xl font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${className}`}
    >
      {children}
    </button>
  );
}

export function ErrorText({ text }: { text: string }) {
  return text ? <p className="text-xs text-red-400 font-mono">{text}</p> : null;
}

export function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-gray-500 font-mono text-xs uppercase">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function PlaceLine({ tag, address }: { tag: string; address: string }) {
  return (
    <div className="flex gap-3 items-start">
      <span className="text-[10px] font-mono font-black uppercase text-[#39FF14] w-14 shrink-0 pt-0.5">{tag}</span>
      <span className="text-sm">{address}</span>
    </div>
  );
}
