// ============================================================================
// ZÉNITH
// Module : Utilities / OTP Helper
// Layer  : Domain / Helpers
// File   : otpHelper.ts
// ============================================================================

/**
 * @deprecated EL OTP DETERMINISTA EN CLIENTE HA SIDO DESMANTELADO PERMANENTEMENTE (FASE 3.2).
 * La generación y verificación de OTP es ahora 100% criptográfica y server-side.
 * Esta función se mantiene únicamente por compatibilidad de tipos legados y no tiene validez operativa.
 */
export function generateRideOtp(_rideId: string): string {
  console.warn('[SECURITY_DEPRECATION] generateRideOtp está deprecado. El OTP es validado exclusivamente por el Backend Gatekeeper.');
  return '---';
}
