// ============================================================================
// ZÉNITH
// Module : Utilities / OTP Helper
// Layer  : Domain / Helpers
// File   : otpHelper.ts
// ============================================================================

/**
 * Generates a deterministic 3-digit OTP code based on a unique ride ID.
 * This guarantees both passenger and driver can verify the security code
 * offline/zero-latency in perfect sync, without database read/write costs.
 */
export function generateRideOtp(rideId: string): string {
  if (!rideId) return '000';
  let num = 0;
  for (let i = 0; i < rideId.length; i++) {
    num += rideId.charCodeAt(i);
  }
  return ((num % 900) + 100).toString(); // Always a 3-digit number between 100 and 999
}
