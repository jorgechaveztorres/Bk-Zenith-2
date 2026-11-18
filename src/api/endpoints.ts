/**
 * ZÉNITH — Llamadas a la API, agrupadas por tema.
 * Rutas del servidor: server/routes/auth.routes.ts, ride.routes.ts, pricing.routes.ts.
 */
import { api, saveSession, clearSession, getRefreshToken, updateSessionUser } from './http';
import type { ApiSession, ApiUser, AppRole, ApiRide, ApiQuote, ApiOffer, DeliveryDetails, Place } from './types';

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
  get: async (rideId: string) => (await api<{ ride: ApiRide }>('GET', `/rides/${encodeURIComponent(rideId)}`)).ride,
  cancel: async (rideId: string, reason?: string) =>
    (await api<{ ride: ApiRide }>('POST', `/rides/${encodeURIComponent(rideId)}/cancel`, { reason })).ride,
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
