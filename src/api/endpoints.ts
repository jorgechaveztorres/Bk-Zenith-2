/**
 * ZÉNITH — Llamadas a la API, agrupadas por tema.
 * Rutas del servidor: server/routes/auth.routes.ts, ride.routes.ts, pricing.routes.ts.
 */
import { api, apiUpload, saveSession, clearSession, getRefreshToken, updateSessionUser } from './http';
import type {
  ApiSession, ApiUser, AppRole, ApiRide, ApiQuote, ApiOffer, DeliveryDetails, Place,
  ApiRestaurant, ApiMenuItem, ApiDriverApplication, DriverReviewStatus,
  ApiWallet, ApiWalletMovement, ApiTopup, TopupStatus, ApiDriverProfile, ApiRideHistoryPage,
} from './types';

export const MIN_PASSWORD = 6;

// ---------------------------------------------------------------- Cuenta
export const AuthApi = {
  /** Paso 1 del registro: manda el SMS. */
  startRegistration: (phone: string) =>
    api<{ message: string }>('POST', '/auth/register/start', { phone }, { auth: false }),

  /** Paso 2: código + datos -> crea la cuenta y deja la sesión iniciada. */
  async completeRegistration(input: { phone: string; code: string; password: string; fullName: string; role: AppRole }) {
    const s = await api<ApiSession>('POST', '/auth/register/verify', input, { auth: false });
    saveSession(s);
    return s.user;
  },

  async login(phone: string, password: string) {
    const s = await api<ApiSession>('POST', '/auth/login', { phone, password }, { auth: false });
    saveSession(s);
    return s.user;
  },

  startPasswordReset: (phone: string) =>
    api<{ message: string }>('POST', '/auth/password/forgot', { phone }, { auth: false }),

  async completePasswordReset(phone: string, code: string, newPassword: string) {
    const s = await api<ApiSession>('POST', '/auth/password/reset', { phone, code, newPassword }, { auth: false });
    saveSession(s);
    return s.user;
  },

  async me() {
    const r = await api<{ user: ApiUser }>('GET', '/auth/me');
    updateSessionUser(r.user);
    return r.user;
  },

  async logout() {
    const refreshToken = getRefreshToken();
    clearSession();
    if (refreshToken) {
      // Si falla (sin internet), la sesión del teléfono ya quedó cerrada igual.
      await api('POST', '/auth/logout', { refreshToken }, { auth: false }).catch(() => undefined);
    }
  },
};

// ---------------------------------------------------------------- Precio
export const PricingApi = {
  quote: async (origin: Place, destination: Place) => {
    const r = await api<{ quote: ApiQuote }>('POST', '/pricing/quote', {
      originLat: origin.lat, originLng: origin.lng, originAddress: origin.address,
      destLat: destination.lat, destLng: destination.lng, destAddress: destination.address,
    });
    return r.quote;
  },
};

// ---------------------------------------------------------------- Pedidos (cliente y ambos)
const newIdempotencyKey = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const RidesApi = {
  request: async (quote: ApiQuote, paymentMethod: string, delivery?: DeliveryDetails, idempotencyKey = newIdempotencyKey()) => {
    const r = await api<{ ride: ApiRide; otpCode: string }>('POST', '/rides/request', {
      quote, paymentMethod, delivery, idempotencyKey,
    });
    return { ...r.ride, otpCode: r.otpCode };
  },
  active: async () => (await api<{ ride: ApiRide | null }>('GET', '/rides/active')).ride,
  /** Historial de pedidos terminados (entregados, cancelados o vencidos), paginado. */
  history: (page = 1, pageSize = 20) =>
    api<ApiRideHistoryPage>('GET', `/rides/history?page=${page}&pageSize=${pageSize}`),
  get: async (rideId: string) => (await api<{ ride: ApiRide }>('GET', `/rides/${encodeURIComponent(rideId)}`)).ride,
  cancel: async (rideId: string, reason?: string) =>
    (await api<{ ride: ApiRide }>('POST', `/rides/${encodeURIComponent(rideId)}/cancel`, { reason })).ride,
  /** El cliente califica al motorizado (1 a 5) tras un pedido entregado. */
  rate: async (rideId: string, rating: number, feedback?: string) =>
    (await api<{ ride: ApiRide }>('POST', `/rides/${encodeURIComponent(rideId)}/rate`, { rating, feedback })).ride,
};

// ---------------------------------------------------------------- Marketplace de comida
export interface MenuItemInput {
  name: string;
  description?: string;
  price: number;
  photoUrl?: string;
  isAvailable?: boolean;
  sortOrder?: number;
}

export const FoodApi = {
  /** Restaurantes abiertos para pedir comida. */
  listOpen: async (city?: string) =>
    (await api<{ restaurants: ApiRestaurant[] }>('GET', `/restaurants${city ? `?city=${encodeURIComponent(city)}` : ''}`)).restaurants,

  menu: async (restaurantId: string) =>
    (await api<{ menu: ApiMenuItem[] }>('GET', `/restaurants/${encodeURIComponent(restaurantId)}/menu`)).menu,

  /** Crea el pedido de comida: la cotización es la misma de /pricing/quote (origin=restaurante, destination=cliente). */
  order: async (
    restaurantId: string,
    quote: ApiQuote,
    items: Array<{ menuItemId: string; quantity: number }>,
    paymentMethod: string,
    notes?: string,
    idempotencyKey = newIdempotencyKey(),
  ) => {
    const r = await api<{ ride: ApiRide; otpCode: string; subtotal: number }>(
      'POST', `/restaurants/${encodeURIComponent(restaurantId)}/orders`,
      { quote, items, paymentMethod, notes, idempotencyKey }
    );
    return { ride: { ...r.ride, otpCode: r.otpCode }, subtotal: r.subtotal };
  },

  // ---- Dueño del restaurante ----
  mine: async () => (await api<{ restaurant: ApiRestaurant | null }>('GET', '/restaurants/mine')).restaurant,

  create: async (input: { name: string; address: string; lat: number; lng: number; city?: string; phone?: string; photoUrl?: string }) =>
    (await api<{ restaurant: ApiRestaurant }>('POST', '/restaurants/mine', input)).restaurant,

  setOpen: async (restaurantId: string, isOpen: boolean) =>
    (await api<{ restaurant: ApiRestaurant }>('PATCH', `/restaurants/${encodeURIComponent(restaurantId)}/open`, { isOpen })).restaurant,

  myMenu: async (restaurantId: string) =>
    (await api<{ menu: ApiMenuItem[] }>('GET', `/restaurants/${encodeURIComponent(restaurantId)}/menu/mine`)).menu,

  addMenuItem: async (restaurantId: string, input: MenuItemInput) =>
    (await api<{ item: ApiMenuItem }>('POST', `/restaurants/${encodeURIComponent(restaurantId)}/menu`, input)).item,

  updateMenuItem: async (restaurantId: string, itemId: string, input: Partial<MenuItemInput>) =>
    (await api<{ item: ApiMenuItem }>('PATCH', `/restaurants/${encodeURIComponent(restaurantId)}/menu/${encodeURIComponent(itemId)}`, input)).item,
};

// ---------------------------------------------------------------- Panel admin (solo users.is_admin)
export const AdminApi = {
  drivers: async (status?: DriverReviewStatus) =>
    (await api<{ drivers: ApiDriverApplication[] }>('GET', `/admin/drivers${status ? `?status=${status}` : ''}`)).drivers,

  approveDriver: async (driverId: string) =>
    (await api<{ driver: ApiDriverApplication }>('POST', `/admin/drivers/${encodeURIComponent(driverId)}/approve`)).driver,

  rejectDriver: async (driverId: string, reason: string) =>
    (await api<{ driver: ApiDriverApplication }>('POST', `/admin/drivers/${encodeURIComponent(driverId)}/reject`, { reason })).driver,

  topups: async (status?: TopupStatus) =>
    (await api<{ topups: ApiTopup[] }>('GET', `/topups${status ? `?status=${status}` : ''}`)).topups,

  creditTopup: async (topupId: string) =>
    (await api<{ topup: ApiTopup }>('POST', `/topups/${encodeURIComponent(topupId)}/credit`)).topup,

  rejectTopup: async (topupId: string, reason: string) =>
    (await api<{ topup: ApiTopup }>('POST', `/topups/${encodeURIComponent(topupId)}/reject`, { reason })).topup,
};

// ---------------------------------------------------------------- Documentos del motorizado
export interface DriverDocumentsInput {
  vehicleCategory?: string;
  vehiclePlate: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleYear?: string;
  vehicleColor?: string;
  licenseNumber: string;
  licenseExpiry?: string;
  yapePlinPhone?: string;
  licensePhoto?: File | null;
  vehiclePhoto?: File | null;
}

export const DriverDocumentsApi = {
  myProfile: async () => (await api<{ profile: ApiDriverProfile }>('GET', '/driver/profile')).profile,

  submit: async (input: DriverDocumentsInput) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(input)) {
      if (k === 'licensePhoto' || k === 'vehiclePhoto') continue;
      if (v !== undefined && v !== null) form.set(k, String(v));
    }
    if (input.licensePhoto) form.set('licensePhoto', input.licensePhoto);
    if (input.vehiclePhoto) form.set('vehiclePhoto', input.vehiclePhoto);
    return (await apiUpload<{ profile: ApiDriverProfile }>('/driver/profile', form)).profile;
  },

  documentPath: (driverId: string, kind: 'license' | 'vehicle') =>
    `/driver/documents/${encodeURIComponent(driverId)}/${kind}`,
};

// ---------------------------------------------------------------- Billetera del motorizado
export const WalletApi = {
  me: async () => (await api<{ wallet: ApiWallet }>('GET', '/wallet/me')).wallet,
  movements: async () => (await api<{ movements: ApiWalletMovement[] }>('GET', '/wallet/movements')).movements,
  requestTopup: async (amount: number, operationNumber: string) =>
    (await api<{ topup: ApiTopup }>('POST', '/topups', { amount, operationNumber })).topup,
  myTopups: async () => (await api<{ topups: ApiTopup[] }>('GET', '/topups/mine')).topups,
};

// ---------------------------------------------------------------- Motorizado
export type DriverStatusStep = 'DRIVER_ARRIVING' | 'WAITING_FOR_OTP' | 'COMPLETED';

export const DriverApi = {
  presence: (p: { lat: number; lng: number; online: boolean; heading?: number | null; speedKmh?: number | null }) =>
    api<{ status: string }>('POST', '/rides/driver/presence', p),
  offer: async () => (await api<{ offer: ApiOffer | null }>('GET', '/rides/driver/offer')).offer,
  accept: async (assignmentId: string) =>
    (await api<{ ride: ApiRide }>('POST', `/rides/driver/offers/${encodeURIComponent(assignmentId)}/accept`)).ride,
  reject: (assignmentId: string) =>
    api<Record<string, never>>('POST', `/rides/driver/offers/${encodeURIComponent(assignmentId)}/reject`),
  setStatus: async (rideId: string, status: DriverStatusStep) =>
    (await api<{ ride: ApiRide }>('POST', `/rides/${encodeURIComponent(rideId)}/status`, { status })).ride,
  verifyOtp: async (rideId: string, code: string) =>
    (await api<{ ride: ApiRide }>('POST', `/rides/${encodeURIComponent(rideId)}/verify-otp`, { code })).ride,
};

// ---------------------------------------------------------------- Direcciones (OpenStreetMap vía servidor)
export const GeoApi = {
  search: async (q: string) => (await api<{ results: Place[] }>('GET', `/geo/search?q=${encodeURIComponent(q)}`)).results,
  reverse: async (lat: number, lng: number) =>
    (await api<{ place: Place }>('GET', `/geo/reverse?lat=${lat}&lng=${lng}`)).place,
};
