// ============================================================================
// ZÉNITH
// Module : Communication / Phone Call Button
// File   : CallPhoneButton.tsx
// Description: Botón oficial de llamada directa telefónica nativa (tel:+51XXXXXXXXX)
//              para la red ZÉNITH sin fallos silenciosos.
// ============================================================================

import React from 'react';
import { Phone, PhoneOff } from 'lucide-react';

interface CallPhoneButtonProps {
  phone?: string | null;
  recipientLabel?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Normaliza y formatea un número a URI estándar tel:+51XXXXXXXXX
 */
export function formatTelUri(phone?: string | null): string | null {
  if (!phone) return null;
  const digitsOnly = phone.replace(/[^0-9]/g, '');
  if (!digitsOnly || digitsOnly.length < 7) return null;

  // Si ya tiene código de país Perú (51) al inicio
  if (phone.trim().startsWith('+51')) {
    const cleaned = phone.replace(/[^0-9+]/g, '');
    return `tel:${cleaned}`;
  }

  // Si son 9 dígitos peruanos típicos (ej: 948112233)
  if (digitsOnly.length === 9) {
    return `tel:+51${digitsOnly}`;
  }

  // Si ya incluye 51 seguido de 9 dígitos (11 dígitos en total)
  if (digitsOnly.length === 11 && digitsOnly.startsWith('51')) {
    return `tel:+${digitsOnly}`;
  }

  // Formato genérico seguro
  if (phone.includes('+')) {
    return `tel:${phone.replace(/[^0-9+]/g, '')}`;
  }

  return `tel:+51${digitsOnly}`;
}

export default function CallPhoneButton({
  phone,
  recipientLabel,
  className = '',
  size = 'md'
}: CallPhoneButtonProps) {
  const telUri = formatTelUri(phone);

  if (!telUri) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-mono text-[11px] font-bold ${className}`}
        role="status"
        aria-live="polite"
      >
        <PhoneOff size={13} className="shrink-0 text-red-400" />
        <span>Número telefónico no disponible</span>
      </div>
    );
  }

  const sizeClasses = size === 'sm'
    ? 'px-3 py-1.5 text-[11px]'
    : size === 'lg'
    ? 'px-5 py-3 text-sm'
    : 'px-4 py-2 text-xs';

  return (
    <a
      href={telUri}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#39FF14] hover:bg-[#32e012] text-black font-mono font-black uppercase tracking-wider shadow-glow transition-all cursor-pointer ${sizeClasses} ${className}`}
      title={recipientLabel ? `Llamar a ${recipientLabel} (${phone})` : `Llamar (${phone})`}
    >
      <span className="text-sm leading-none">📞</span>
      <span>LLAMAR</span>
    </a>
  );
}
