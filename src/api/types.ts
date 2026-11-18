/**
 * ZÉNITH — Tipos que devuelve la API MySQL (espejo de server/services/*).
 * Si cambia el servidor, cambiar aquí también.
 */

export type AppRole = 'passenger' | 'driver';

export interface ApiUser {
  id: string;
  fullName: string;
  phone: string;
  role: AppRole;
  isAdmin: boolean;
  kycStatus: string;
}

export interface ApiSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: ApiUser;
}

export type ApiRideStatus =
  | 'SEARCHING_DRIVER'
  | 'DRIVER_ASSIGNED'
  | 'DRIVER_ARRIVING'
  | 'WAITING_FOR_OTP'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED';

export const ACTIVE_RIDE_STATUSES: ApiRideStatus[] = [
  'SEARCHING_DRIVER', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'WAITING_FOR_OTP', 'IN_PROGRESS',
];

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Place extends GeoPoint {
  address: string;
}

export interface DeliveryDetails {
  description?: string;
  receptorName?: string;
  receptorPhone?: string;
  notes?: string;
}

export interface ApiRide {
  id: string;
  status: ApiRideStatus;
  passengerId: string;
  passengerName: string | null;
  driverId: string | null;
  driverName: string | null;
  driverPhone: string | null;
  origin: Place;
  destination: Place;
  driverLocation: GeoPoint | null;
  price: number;
  distanceKm: number | null;
  paymentMethod: string;
  delivery: DeliveryDetails | null;
  createdAt: string;
  acceptedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  /** Solo para el cliente, mientras el código de recojo sirve. */
  otpCode?: string;
}

export interface ApiQuote {
  quoteId: string;
  origin: Place;
  destination: Place;
  distance: number;
  duration: number;
  normalFare: number;
  pressure: number;
  multiplier: number;
  totalFare: number;
  currency: 'PEN';
  pricingVersion: string;
  expiresAt: string;
  pricingSeal: string;
  marketZone: string;
  status: string;
}

export interface ApiOffer {
  assignmentId: string;
  rideId: string;
  expiresInSeconds: number;
  distanceToPickupKm: number;
  price: number;
  origin: Place;
  destination: Place;
  tripDistanceKm: number | null;
  paymentMethod: string;
}

export type RealtimeEvent =
  | { type: 'offer'; rideId: string; assignmentId: string }
  | { type: 'offer.closed'; assignmentId: string; reason: string }
  | { type: 'ride'; rideId: string; status: string }
  | { type: 'ride.location'; rideId: string; lat: number; lng: number; heading: number | null };
