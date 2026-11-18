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

export type OrderType = 'DELIVERY' | 'FOOD';

export interface FoodOrderItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface FoodOrderDetails {
  restaurantId: string;
  restaurantName: string;
  items: FoodOrderItem[];
  subtotal: number;
  notes?: string;
}

export interface ApiRestaurant {
  id: string;
  ownerUserId: string;
  name: string;
  phone: string | null;
  address: string;
  lat: number;
  lng: number;
  city: string | null;
  photoUrl: string | null;
  isOpen: boolean;
  isActive: boolean;
  createdAt: string;
}

export type DriverReviewStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export interface ApiDriverApplication {
  userId: string;
  fullName: string;
  phone: string | null;
  status: DriverReviewStatus;
  isBlocked: boolean;
  vehicle: {
    category: string | null;
    plate: string | null;
    brand: string | null;
    model: string | null;
    year: number | null;
    color: string | null;
  };
  licenseNumber: string | null;
  licenseExpiry: string | null;
  rejectionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  hasLicensePhoto: boolean;
  hasVehiclePhoto: boolean;
  documentsSubmittedAt: string | null;
  rating: number;
}

export interface ApiDriverProfile {
  userId: string;
  status: DriverReviewStatus;
  vehicle: {
    category: string | null;
    plate: string | null;
    brand: string | null;
    model: string | null;
    year: number | null;
    color: string | null;
  };
  licenseNumber: string | null;
  licenseExpiry: string | null;
  yapePlinPhone: string | null;
  hasLicensePhoto: boolean;
  hasVehiclePhoto: boolean;
  documentsSubmittedAt: string | null;
  rejectionReason: string | null;
}

export interface ApiMenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  photoUrl: string | null;
  isAvailable: boolean;
  sortOrder: number;
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
  orderType: OrderType;
  food: FoodOrderDetails | null;
  restaurantId: string | null;
  createdAt: string;
  acceptedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  rating: number | null;
  feedback: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  /** Solo para el cliente, mientras el código de recojo sirve. */
  otpCode?: string;
}

export interface ApiRideHistoryPage {
  items: ApiRide[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
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

export interface ApiWallet {
  driverId: string;
  cashDebt: number;
  accumulatedCommission: number;
  debtLimit: number;
  blocked: boolean;
  freeUntil: string | null;
  isInFreePeriod: boolean;
}

export interface ApiWalletMovement {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string | null;
  rideId: string | null;
  topupId: string | null;
  createdAt: string;
}

export type TopupStatus = 'RECEIPT_SUBMITTED' | 'REJECTED' | 'CREDITED';

export interface ApiTopup {
  id: string;
  driverId: string;
  driverName: string | null;
  driverPhone: string | null;
  requestedAmount: number;
  operationNumber: string | null;
  paymentMethod: 'YAPE_MANUAL' | 'CULQI';
  grossAmount: number | null;
  feeAmount: number | null;
  status: TopupStatus;
  rejectionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  creditedAt: string | null;
  createdAt: string;
}

export type RealtimeEvent =
  | { type: 'offer'; rideId: string; assignmentId: string }
  | { type: 'offer.closed'; assignmentId: string; reason: string }
  | { type: 'ride'; rideId: string; status: string }
  | { type: 'ride.location'; rideId: string; lat: number; lng: number; heading: number | null };
