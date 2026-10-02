// ============================================================================
// ZÉNITH — IDENTITY CORE V1 / FASE 1
// Module : Operational Eligibility Engine
// Layer  : Domain / Eligibility Contracts
// File   : OperationalEligibilityEngine.ts
// ============================================================================

import { UserRole, ZenithRole, DocumentStatus, RideStatus, User, Wallet } from '../types';

/**
 * Snapshot de Identidad (IdentityContext)
 * Responde a: "¿Quién es este usuario y qué identidad/roles/estado tiene?"
 * Responsabilidad estricta de Identity Core.
 */
export interface IdentityContext {
  uid: string;
  activeRole: UserRole | ZenithRole;
  rolesEnabled?: (UserRole | ZenithRole)[];
  kycStatus: DocumentStatus | 'NOT_APPLICABLE' | 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  isBlocked: boolean;
  suspendedUntil?: string | null;
  phoneVerified?: boolean;
  emailVerified?: boolean;
}

/**
 * Snapshot Financiero (WalletContext)
 * Responde a: "¿Cuál es la situación financiera actual de este Motorizado?"
 * La fuente única de verdad es users/{uid}.wallet.
 * NO contiene lógica de comisiones ni límites heurísticos de deuda.
 */
export interface WalletContext {
  availableBalance: number;
  digitalBalance?: number;
  retainedBalance?: number;
  cashDebt?: number;
  pendingSettlement?: number;
}

/**
 * Snapshot Operativo (OperationalContext)
 * Responde a: "¿Existe un servicio incompatible en curso?"
 */
export interface OperationalContext {
  hasActiveOperation: boolean;
  currentTransitStatus?: RideStatus | null;
}

/**
 * Resultado de Elegibilidad (EligibilityResult)
 * Evaluación binaria de admisión (ALLOW / DENY) con código estandarizado y motivo descriptivo.
 */
export interface EligibilityResult {
  eligible: boolean;
  code?: 'ALLOW' | 'INVALID_ROLE' | 'KYC_NOT_APPROVED' | 'ACCOUNT_SUSPENDED' | 'INSUFFICIENT_FUNDS' | 'ACTIVE_OPERATION_EXISTS';
  reason?: string;
}

/**
 * Helper: Extrae IdentityContext desde la entidad canónica User.
 */
export function extractIdentityContext(user: Partial<User>): IdentityContext {
  const activeRole = user.activeRole || user.role || UserRole.PASSENGER;
  const kycStatus = user.driverProfile?.status || DocumentStatus.PENDING;
  const isBlocked = Boolean(user.isBlocked);
  const suspendedUntil = user.driverProfile?.suspendedUntil || null;

  return {
    uid: user.uid || '',
    activeRole,
    rolesEnabled: user.rolesEnabled,
    kycStatus,
    isBlocked,
    suspendedUntil,
    phoneVerified: user.phoneVerified,
    emailVerified: user.emailVerified
  };
}

/**
 * Helper: Extrae WalletContext desde users/{uid}.wallet.
 */
export function extractWalletContext(wallet?: Partial<Wallet> | null): WalletContext {
  return {
    availableBalance: wallet?.availableBalance ?? 0,
    digitalBalance: wallet?.digitalBalance ?? 0,
    retainedBalance: wallet?.retainedBalance ?? 0,
    cashDebt: wallet?.cashDebt ?? 0,
    pendingSettlement: wallet?.pendingSettlement ?? 0
  };
}

/**
 * Helper: Extrae OperationalContext a partir del estado de tránsito actual.
 */
export function extractOperationalContext(activeRide?: { status: RideStatus } | null): OperationalContext {
  if (!activeRide) {
    return { hasActiveOperation: false, currentTransitStatus: null };
  }

  const busyStatuses: RideStatus[] = [
    RideStatus.DRIVER_ASSIGNED,
    RideStatus.DRIVER_ARRIVING,
    RideStatus.WAITING_FOR_OTP,
    RideStatus.IN_PROGRESS
  ];

  return {
    hasActiveOperation: busyStatuses.includes(activeRide.status),
    currentTransitStatus: activeRide.status
  };
}

/**
 * Evaluación de Elegibilidad Operativa: canAcceptOrder()
 * 
 * Reglas Formales ZÉNITH:
 * 1. Identity: activeRole == MOTORIZADO, KYC APPROVED, cuenta no bloqueada/suspendida.
 * 2. Wallet: availableBalance > 0 (Regla vigente: permite aceptar UNA operación).
 *    - NO exigir cubrir el 13% anticipadamente.
 *    - NO usar cashDebt > 150.
 *    - Wallet sigue siendo la única autoridad sobre saldo, comisiones y deuda.
 * 3. Operational: No existe operación incompatible activa en curso.
 */
export function canAcceptOrder(
  identity: IdentityContext,
  wallet: WalletContext,
  operational: OperationalContext
): EligibilityResult {
  // 1. EVALUACIÓN DE IDENTIDAD Y ROL
  const isDriverRole = 
    identity.activeRole === UserRole.DRIVER || 
    identity.activeRole === 'MOTORIZADO';

  if (!isDriverRole) {
    return {
      eligible: false,
      code: 'INVALID_ROLE',
      reason: 'El operador debe encontrarse en rol activo MOTORIZADO.'
    };
  }

  // 2. EVALUACIÓN DE BLOQUEO Y SUSPENSIÓN
  if (identity.isBlocked) {
    return {
      eligible: false,
      code: 'ACCOUNT_SUSPENDED',
      reason: 'Cuenta bloqueada preventivamente por seguridad.'
    };
  }

  if (identity.suspendedUntil) {
    const suspendedDate = new Date(identity.suspendedUntil);
    if (!isNaN(suspendedDate.getTime()) && suspendedDate > new Date()) {
      return {
        eligible: false,
        code: 'ACCOUNT_SUSPENDED',
        reason: 'Cuenta temporalmente suspendida por disciplina operativa.'
      };
    }
  }

  // 3. EVALUACIÓN DE HOMOLOGACIÓN DOCUMENTAL (KYC)
  if (identity.kycStatus !== DocumentStatus.APPROVED) {
    return {
      eligible: false,
      code: 'KYC_NOT_APPROVED',
      reason: `Expediente documental KYC no homologado (Estado actual: ${identity.kycStatus}).`
    };
  }

  // 4. EVALUACIÓN FINANCIERA ESTRICTA (Única condición: availableBalance > 0)
  if (wallet.availableBalance <= 0) {
    return {
      eligible: false,
      code: 'INSUFFICIENT_FUNDS',
      reason: 'Requiere saldo disponible mayor a S/ 0.00 en su Wallet Zénith para aceptar operaciones.'
    };
  }

  // 5. EVALUACIÓN DE CONCURRENCIA OPERATIVA
  if (operational.hasActiveOperation) {
    return {
      eligible: false,
      code: 'ACTIVE_OPERATION_EXISTS',
      reason: 'El operador ya cuenta con un servicio o carrera activa en curso.'
    };
  }

  // ADMISIÓN CONCEDIDA
  return {
    eligible: true,
    code: 'ALLOW'
  };
}
