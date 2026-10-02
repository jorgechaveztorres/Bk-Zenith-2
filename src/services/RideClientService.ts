import { auth } from '../firebase/config';

export interface RequestRidePayload {
  quote: any;
  passengerId: string;
  passengerName?: string;
  passengerPhone?: string;
  paymentMethod?: string;
  paymentState?: string;
  paymentId?: string;
  idempotencyKey?: string;
  orderType?: 'RIDE' | 'DELIVERY';
  packageInfo?: any;
  receptor?: any;
  pagador?: any;
  solicitante?: any;
  evidenceLevel?: any;
  returnContingency?: any;
}

export interface RequestRideResponse {
  success: boolean;
  rideId: string;
  ride: any;
}

export class RideClientService {
  /**
   * Invoca el Gatekeeper de Backend para crear un viaje u orden de entrega.
   * La tarifa es validada mediante la firma criptográfica HMAC del quote antes de asentarse en Firestore.
   */
  static async requestRide(payload: RequestRidePayload): Promise<RequestRideResponse> {
    const currentUser = auth.currentUser;
    const token = currentUser ? await currentUser.getIdToken() : '';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch('/api/rides/request', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Error al solicitar viaje (${response.status})`);
    }

    return await response.json();
  }

  /**
   * Conductor acepta un viaje de forma atómica a través del Gatekeeper de Backend.
   * Conmuta el estado a DRIVER_ASSIGNED y la disponibilidad del conductor a BUSY.
   */
  static async acceptRide(rideId: string, driverLocation?: any): Promise<any> {
    const currentUser = auth.currentUser;
    const token = currentUser ? await currentUser.getIdToken() : '';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`/api/rides/${rideId}/accept`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ driverLocation })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const error: any = new Error(err.message || `Error al aceptar viaje (${response.status})`);
      error.statusCode = response.status;
      throw error;
    }

    return await response.json();
  }

  /**
   * Actualiza el estado del viaje mediante la FSM estricta del Backend.
   */
  static async updateRideStatus(rideId: string, status: string): Promise<any> {
    const currentUser = auth.currentUser;
    const token = currentUser ? await currentUser.getIdToken() : '';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`/api/rides/${rideId}/status`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ status })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const error: any = new Error(err.message || `Error al actualizar estado (${response.status})`);
      error.statusCode = response.status;
      throw error;
    }

    return await response.json();
  }

  /**
   * Conductor valida el código OTP de 3 dígitos de abordaje en el servidor (Zero-Trust).
   * Al verificarse exitosamente, el backend conmuta el estado a IN_PROGRESS.
   */
  static async verifyOtp(rideId: string, otp: string): Promise<any> {
    const currentUser = auth.currentUser;
    const token = currentUser ? await currentUser.getIdToken() : '';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`/api/rides/${rideId}/verify-otp`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ otp })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const error: any = new Error(err.message || `Error al validar OTP (${response.status})`);
      error.statusCode = response.status;
      throw error;
    }

    return await response.json();
  }

  /**
   * Pasajero consulta el código OTP de abordaje emitido por el backend.
   */
  static async getPassengerOtp(rideId: string): Promise<any> {
    const currentUser = auth.currentUser;
    const token = currentUser ? await currentUser.getIdToken() : '';

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`/api/rides/${rideId}/otp`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const error: any = new Error(err.message || `Error al obtener OTP (${response.status})`);
      error.statusCode = response.status;
      throw error;
    }

    return await response.json();
  }
}
