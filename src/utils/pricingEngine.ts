// ============================================================================
// ZÉNITH
// Module : Pricing
// Layer  : Domain / Utils
// File   : pricingEngine.ts
// ============================================================================

export interface PricingResult {
  distance: number; // in km
  duration: number; // in minutes
  basePrice: number;
  distancePrice: number;
  durationPrice: number;
  multiplier: number;
  totalFare: number;
  seal: string;
  expiresAt: Date;
}

/**
 * Calculates geodesic distance between two coordinates using the Haversine formula.
 */
export function getGeodesicDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(1));
}

/**
 * Generates a tactical cryptographic-like seal for the pricing response.
 */
export function generatePricingSeal(origin: string, dest: string, price: number): string {
  const input = `${origin}_${dest}_${price}_${Date.now()}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  const hex = Math.abs(hash).toString(16).toUpperCase();
  return `ZNTH-SEAL-${hex.substring(0, 4)}-${Math.floor(1000 + Math.random() * 9000)}`;
}

/**
 * Executes pricing rules based on distance and duration.
 */
export function calculatePricing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  originAddress: string,
  destAddress: string
): PricingResult {
  // 1. Calculate distance
  const distance = getGeodesicDistance(lat1, lon1, lat2, lon2);

  // 2. Estimate duration based on average urban speed (40 km/h) + fixed buffer
  const duration = Math.max(2, Math.round((distance / 40) * 60 + 3));

  // 3. Define pricing coefficients
  const basePrice = 5.00;
  const distancePrice = parseFloat((distance * 1.50).toFixed(2));
  const durationPrice = parseFloat((duration * 0.50).toFixed(2));
  const multiplier = 1.15; // Standard high-priority Zenith surge

  // 4. Calculate total official fare
  const rawTotal = (basePrice + distancePrice + durationPrice) * multiplier;
  const totalFare = parseFloat(rawTotal.toFixed(2));

  // 5. Generate secure pricing seal
  const seal = generatePricingSeal(originAddress, destAddress, totalFare);

  // 6. Set expiration (10 minutes)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  return {
    distance,
    duration,
    basePrice,
    distancePrice,
    durationPrice,
    multiplier,
    totalFare,
    seal,
    expiresAt,
  };
}
