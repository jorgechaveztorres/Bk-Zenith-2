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

export type ZenithRole = 'CLIENTE' | 'MOTORIZADO' | 'passenger' | 'driver';

export interface User {
  uid: string;
  fullName: string;
  email: string;
  role: UserRole; // Mantenido para retrocompatibilidad
  rolesEnabled?: (UserRole | 'CLIENTE' | 'MOTORIZADO')[]; // Lista de roles autorizados para el usuario
  activeRole?: UserRole | 'CLIENTE' | 'MOTORIZADO'; // Rol activo en la sesión actual
  phoneVerified?: boolean;
  emailVerified?: boolean;
  rating: number;
  photoUrl?: string;
  favorites?: FavoriteDestination[];
  settings?: UserSettings;
  wallet?: Wallet;
  isAdmin?: boolean;
  isBlocked?: boolean;
  onboardingComplete?: boolean;
  phone?: string;
  pendingDebt?: number;
  pendingDebtReason?: string;
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
  dailyCancellationsCount?: number;
  lastCancellationDate?: string;
  suspendedUntil?: string; // ISO string if suspended
  dailyMechanicalBreakdownsCount?: number;
  lastMechanicalBreakdownDate?: string;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

// ==========================================
// ZÉNITH MVP V1.1 OPERATIONAL DOMAIN SPEC
// ==========================================

// 1. Los Cuatro Protagonistas
export interface Solicitante {
  uid: string;
  name: string;
  phone: string;
  email?: string;
}

export interface Pagador {
  uid: string;
  name: string;
  phone: string;
  acceptedEconomicTerms: boolean;
  paymentMethod: 'CASH' | 'WALLET' | 'YAPE_PLIN';
}

export interface Receptor {
  name: string;
  phone: string;
  address: string;
  reference?: string;
  lat: number;
  lng: number;
  deliveryNotes?: string;
}

export interface MotorizadoInfo {
  uid: string;
  name: string;
  phone: string;
  plate: string;
  vehicleModel?: string;
  rating?: number;
}

// 2. Las Cuatro Dimensiones de Estado Operativo
export enum SolicitudeStatus {
  REQUESTED = 'REQUESTED',
  ASSIGNED = 'ASSIGNED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  CLOSED = 'CLOSED'
}

export enum TransitStatus {
  IDLE = 'IDLE',
  TO_PICKUP = 'TO_PICKUP',
  AT_PICKUP = 'AT_PICKUP',
  IN_TRANSIT = 'IN_TRANSIT',
  AT_DESTINATION = 'AT_DESTINATION',
  RETURNING_TO_ORIGIN = 'RETURNING_TO_ORIGIN',
  RETURNED = 'RETURNED'
}

export enum DeliveryStatus {
  PENDING = 'PENDING',
  DELIVERED_OTP = 'DELIVERED_OTP',
  DELIVERY_FAILED = 'DELIVERY_FAILED',
  REJECTED = 'REJECTED'
}

export enum CustodyStatus {
  NONE = 'NONE',
  IN_TRANSIT_CUSTODY = 'IN_TRANSIT_CUSTODY',
  ACTIVE_CUSTODY = 'ACTIVE_CUSTODY',
  CUSTODY_TRANSFERRED = 'CUSTODY_TRANSFERRED',
  CUSTODY_EXPIRED = 'CUSTODY_EXPIRED',
  DISPOSED = 'DISPOSED'
}

// 3. Niveles de Evidencia Operacional
export enum EvidenceLevel {
  E1_SIMPLE = 'E1_SIMPLE',       // GPS + tiempo + eventos operacionales
  E2_CONFIRMED = 'E2_CONFIRMED', // E1 + OTP
  E3_SENSITIVE = 'E3_SENSITIVE', // E2 + Fotografías
  E4_SPECIAL = 'E4_SPECIAL'      // E3 + Autorizaciones adicionales
}

// 4. Tipo de Producto y Custodia
export enum ProductType {
  PERISHABLE = 'PERISHABLE',       // Ventana de 60 minutos
  NON_PERISHABLE = 'NON_PERISHABLE' // Máximo 48 horas
}

export interface PackageInfo {
  description: string;
  type: ProductType;
  declaredValue?: number;
  packageConditionNotes?: string;
  initialPhotos: string[]; // Evidencia inicial de custodia al recoger
}

// 5. Protocolo de Comunicación de 4 Niveles
export enum CommunicationChannel {
  LEVEL_1_CHAT = 'LEVEL_1_CHAT',
  LEVEL_2_ZENITH_CALL = 'LEVEL_2_ZENITH_CALL',
  LEVEL_3_WHATSAPP = 'LEVEL_3_WHATSAPP',
  LEVEL_4_DIRECT_CALL = 'LEVEL_4_DIRECT_CALL'
}

export interface CommunicationAttempt {
  id: string;
  timestamp: string;
  channel: CommunicationChannel;
  targetRole: 'RECEPTOR' | 'SOLICITANTE' | 'PAGADOR';
  result: 'ANSWERED' | 'NO_ANSWER' | 'BUSY' | 'MESSAGE_SENT';
  notes?: string;
}

// 6. Trazabilidad Inmutable (Event Sourcing)
export interface OperationalEvent {
  id: string;
  operationId: string;
  stopId?: string;
  timestamp: string;
  lat: number;
  lng: number;
  actorRole: 'SOLICITANTE' | 'PAGADOR' | 'RECEPTOR' | 'MOTORIZADO' | 'SYSTEM';
  actorId: string;
  actorName: string;
  action: string;
  result: string;
  metadata?: Record<string, unknown>;
}

// 7. Modificación Formal de Destino
export interface DestinationChangeRequest {
  id: string;
  newAddress: string;
  newLat: number;
  newLng: number;
  previousDistance: number;
  newDistance: number;
  previousPrice: number;
  newPrice: number;
  requestedBy: 'SOLICITANTE' | 'RECEPTOR';
  clientAccepted: boolean;
  motorizadoAccepted?: boolean;
  status: 'PENDING_CLIENT' | 'PENDING_MOTORIZADO' | 'ACCEPTED' | 'REJECTED';
  rejectionReason?: string;
  createdAt: string;
}

// 8. Contingencia de Devolución
export interface ReturnContingency {
  agreed: boolean;
  returnLocation: Location;
  returnFareAdditional: number;
}

// 9. Incidencias Operacionales
export interface OperationalIncident {
  id: string;
  type: 'MECHANICAL_BREAKDOWN' | 'ACCIDENT' | 'INACCESSIBLE_DESTINATION' | 'RECEPTOR_UNAVAILABLE' | 'PICKUP_UNAVAILABLE' | 'MERCHANT_REFUSED' | 'ORDER_MISMATCH';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  photos?: string[];
  productRecoverable?: boolean;
  backupMotorizadoId?: string;
  backupMotorizadoName?: string;
  status: 'REPORTED' | 'IN_PROGRESS' | 'RESOLVED' | 'UNRESOLVED';
  createdAt: string;
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
  otpValidationId?: string; // Identificador del OTP de validación
  status: RideStatus;
  distance?: number;
  duration?: number;
  driverLocation?: Location;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
  rating?: number;
  feedback?: string;

  // ZÉNITH MVP V1.1 Extended Fields
  solicitante?: Solicitante;
  pagador?: Pagador;
  receptor?: Receptor;
  motorizado?: MotorizadoInfo;
  solicitudeStatus?: SolicitudeStatus;
  transitStatus?: TransitStatus;
  deliveryStatus?: DeliveryStatus;
  custodyStatus?: CustodyStatus;
  evidenceLevel?: EvidenceLevel;
  packageInfo?: PackageInfo;
  deliveryOtp?: string; // OTP de 4 dígitos exclusivamente para confirmación de entrega
  deliveryOtpVerified?: boolean;
  communicationAttempts?: CommunicationAttempt[];
  pickupArrivedAt?: string; // ISO
  destinationArrivedAt?: string; // ISO
  includedWaitMinutes?: number; // 5 min incluidos
  waitStartedAt?: string; // ISO
  additionalWaitBlocksRequested?: number;
  additionalWaitBlocksAccepted?: number;
  additionalWaitCost?: number;
  destinationChangeRequest?: DestinationChangeRequest;
  returnContingency?: ReturnContingency;
  incidents?: OperationalIncident[];
  isRecoveryOrder?: boolean; // Pedido 2 / Recuperación
  originalOperationId?: string; // Vínculo a operación original
  custodyExpiresAt?: string; // 60 min perecible o 48h no perecible
  custodyDisposedAt?: string;
  driverStartedTripAt?: string;
  driverStartDistanceToPickup?: number; // km
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
