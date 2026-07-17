import { Timestamp, FieldValue } from 'firebase/firestore';

export enum UserRole {
  PASSENGER = 'passenger',
  DRIVER = 'driver'
}

export enum RideStatus {
  REQUESTED = 'REQUESTED',
  SEARCHING_DRIVER = 'SEARCHING_DRIVER',
  DRIVER_ASSIGNED = 'DRIVER_ASSIGNED',
  DRIVER_ARRIVING = 'DRIVER_ARRIVING',
  WAITING_FOR_OTP = 'WAITING_FOR_OTP',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED'
}

export type FirestoreTimestamp = Timestamp | FieldValue;

export interface WalletMovement {
  id: string;
  type: 'deposit' | 'withdrawal' | 'ride_earning' | 'fee' | 'cash_compensation';
  amount: number;
  description: string;
  createdAt: FirestoreTimestamp;
}

export enum PaymentState {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  AUTHORIZED = 'AUTHORIZED',
  CAPTURED = 'CAPTURED',
  SETTLED = 'SETTLED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED'
}

export interface Wallet {
  availableBalance: number;
  retainedBalance: number;
  dailyEarnings: number;
  weeklyEarnings: number;
  movements: WalletMovement[];
  pendingSettlement: number;
  digitalBalance: number;
  cashDebt: number;
  todaySettlements: number;
  nextSettlementDate: string; // ISO date string
  pendingBalance?: number;
  promotionalBalance?: number;
  compensationBalance?: number;
  accumulatedCommission?: number;
  monthlyEarnings?: number;
  dailyBalanceHist?: Record<string, number>;
  weeklyBalanceHist?: Record<string, number>;
  monthlyBalanceHist?: Record<string, number>;
}

export interface FavoriteDestination {
  id: string;
  name: string;
  category: 'casa' | 'trabajo' | 'universidad' | 'cliente_frecuente' | 'empresa' | 'hospital' | 'aeropuerto' | 'otros';
  address: string;
  lat: number;
  lng: number;
}

export interface UserSettings {
  darkMode: boolean;
  language: 'es' | 'en';
  gpsPrecision: 'high' | 'optimized';
  notificationsEnabled: boolean;
}

export interface User {
  uid: string;
  fullName: string;
  email: string;
  role: UserRole;
  rating: number;
  photoUrl?: string;
  favorites?: FavoriteDestination[];
  settings?: UserSettings;
  wallet?: Wallet;
  isAdmin?: boolean;
  isBlocked?: boolean;
  onboardingComplete?: boolean;
  phone?: string;
  driverProfile?: DriverProfile;
}

export enum DocumentStatus {
  PENDING = 'PENDING',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED'
}

export interface DriverVehicle {
  category: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  color: string;
}

export interface DriverDocumentation {
  licenseNumber: string;
  licenseExpiry: string;
  driverPhotoUrl?: string;
  vehiclePhotoUrl?: string;
  licensePhotoUrl?: string;
  propertyCardPhotoUrl?: string;
  soatPhotoUrl?: string;
}

export interface DriverProfile {
  status: DocumentStatus;
  availability: boolean;
  rating: number;
  vehicle: DriverVehicle;
  documentation: DriverDocumentation;
  gps?: {
    lat: number;
    lng: number;
    updatedAt: string;
  };
  lastConnection?: string;
  appVersion: string;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

export interface Location {
  address: string;
  lat: number;
  lng: number;
  placeId?: string;
  formattedAddress?: string;
}

export interface Ride {
  id: string;
  passengerId: string;
  passengerName: string;
  driverId?: string;
  driverName?: string;
  origin: Location;
  destination: Location;
  protectedPrice: number; // Precio único protegido calculado por el PricingEngine de Zénith
  pricingSeal: string; // Sello de seguridad criptográfico para validar la inmutabilidad de la tarifa
  pricingVersion: string; // Identificador de la versión del Pricing Engine de Zénith
  assignmentEngineVersion?: string; // Versión del motor de asignación del conductor
  financialEngineVersion?: string; // Versión del motor de liquidación financiera
  rideAuditId?: string; // Identificador único de trazabilidad para auditorías completas
  otpValidationId?: string; // Identificador del OTP de validación de inicio seguro
  status: RideStatus;
  distance?: number;
  duration?: number;
  driverLocation?: Location;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
  rating?: number;
  feedback?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'alert' | 'promo';
  read: boolean;
  createdAt: FirestoreTimestamp;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  message: string;
  read: boolean;
  createdAt: FirestoreTimestamp;
}

export interface ScheduledRide {
  id: string;
  passengerId: string;
  passengerName: string;
  origin: Location;
  destination: Location;
  price: number;
  scheduledAt: string; // ISO String
  status: 'pending' | 'active' | 'cancelled';
  createdAt: FirestoreTimestamp;
}

export interface EmergencyEvent {
  id: string;
  rideId: string;
  timestamp: FirestoreTimestamp;
  userUid: string;
  userRole: UserRole;
  userName: string;
  driverId?: string;
  driverName?: string;
  passengerId?: string;
  passengerName?: string;
  lat: number;
  lng: number;
  address: string;
  comment?: string;
  resolved: boolean;
}
