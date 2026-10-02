import { db } from '../config/firebase';
import { FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';
import { verifyQuoteSignature } from './pricing.service';
import { resolveCityFromCoordinates } from './geo.service';
import { DispatchService } from './dispatch.service';

const OTP_SECRET = process.env.OTP_SECRET || 'ZENITH_SECURE_OTP_SALT_2026';

export const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  REQUESTED: ['SEARCHING_DRIVER', 'DRIVER_ASSIGNED', 'CANCELLED'],
  SEARCHING_DRIVER: ['DRIVER_ASSIGNED', 'CANCELLED'],
  DRIVER_ASSIGNED: ['DRIVER_ARRIVING', 'CANCELLED'],
  DRIVER_ARRIVING: ['WAITING_FOR_OTP', 'CANCELLED'],
  WAITING_FOR_OTP: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: []
};

export function hashOtp(rideId: string, otpCode: string): string {
  return crypto.createHmac('sha256', OTP_SECRET).update(`${rideId}:${otpCode}`).digest('hex');
}

export interface CreateRidePayload {
  quote: {
    quoteId: string;
    pricingVersion: string;
    totalFare: number;
    normalFare: number;
    multiplier: number;
    distance: number;
    duration?: number;
    origin: {
      address: string;
      lat: number;
      lng: number;
    };
    destination: {
      address: string;
      lat: number;
      lng: number;
    };
    currency: string;
    expiresAt: string;
    pricingSeal: string;
    marketZone?: any;
    pressure?: number;
    status?: string;
  };
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

export interface CreatedRideResult {
  id: string;
  _idempotent: boolean;
  [key: string]: any;
}

export class RideService {
  /**
   * GATEKEEPER SERVER-SIDE: Creación de viajes y órdenes de entrega.
   * Valida identidad contra JWT, verifica la firma criptográfica HMAC del quote,
   * controla idempotencia y persiste el documento en Firestore con Firebase Admin SDK.
   */
  static async requestRide(payload: CreateRidePayload, authenticatedUid: string): Promise<CreatedRideResult> {
    if (!db) {
      throw new Error('Servicio de base de datos Firestore no disponible en backend.');
    }

    if (!payload || !payload.quote) {
      throw new Error('El payload debe contener un objeto de cotización (quote) válido emitido por el servidor.');
    }

    // 1. Regla de Identidad Zero-Trust: auth.uid === passengerId
    if (payload.passengerId !== authenticatedUid) {
      const error: any = new Error('Violación de identidad Zero-Trust: passengerId no coincide con el token autenticado.');
      error.statusCode = 403;
      throw error;
    }

    const { quote } = payload;

    // 2. Validación criptográfica y temporal del Quote DPE V2
    const verification = verifyQuoteSignature(quote);
    if (!verification.valid) {
      const error: any = new Error(`Cotización rechazada por el Gatekeeper: ${verification.reason}`);
      error.statusCode = 400;
      throw error;
    }

    // 3. Verificación de congruencia de moneda
    if (quote.currency !== 'PEN') {
      const error: any = new Error('Moneda no autorizada para operación en Zénith (solo PEN).');
      error.statusCode = 400;
      throw error;
    }

    // 4. Mecanismo de Idempotencia y Hash de Carga Útil (Payload Hash)
    const idempotencyKey = payload.idempotencyKey?.trim() || quote.quoteId;

    const payloadHash = crypto.createHash('sha256')
      .update(JSON.stringify({
        passengerId: authenticatedUid,
        quoteId: quote.quoteId,
        origin: {
          address: (quote.origin?.address || '').trim(),
          lat: Number(quote.origin?.lat !== undefined ? Number(quote.origin.lat).toFixed(5) : 0),
          lng: Number(quote.origin?.lng !== undefined ? Number(quote.origin.lng).toFixed(5) : 0)
        },
        destination: {
          address: (quote.destination?.address || '').trim(),
          lat: Number(quote.destination?.lat !== undefined ? Number(quote.destination.lat).toFixed(5) : 0),
          lng: Number(quote.destination?.lng !== undefined ? Number(quote.destination.lng).toFixed(5) : 0)
        },
        totalFare: Number(quote.totalFare.toFixed(2)),
        currency: quote.currency || 'PEN',
        pricingVersion: quote.pricingVersion
      }))
      .digest('hex');

    const idempotencyRef = db.collection('idempotency_keys').doc(idempotencyKey);

    // 5. Creación Atómica bajo Transacción en Firestore (Anti-Race Conditions & Concurrent Idempotency)
    const createdRide = await db.runTransaction(async (transaction) => {
      const idempDoc = await transaction.get(idempotencyRef);

      if (idempDoc.exists) {
        const existingKeyData = idempDoc.data()!;

        // FASE G: Misma clave con diferente payload -> RECHAZAR CONFLICTO (HTTP 409)
        if (existingKeyData.payloadHash !== payloadHash) {
          const conflictErr: any = new Error(
            'Conflicto de Idempotencia: La clave ya fue utilizada para una solicitud con parámetros diferentes.'
          );
          conflictErr.statusCode = 409;
          throw conflictErr;
        }

        // Misma clave con mismo payload (Retry / Concurrencia) -> Devolver el viaje existente sin duplicación
        const existingRideRef = db.collection('rides').doc(existingKeyData.rideId);
        const existingRideDoc = await transaction.get(existingRideRef);

        if (existingRideDoc.exists) {
          console.log(`[RIDE_GATEKEEPER] Idempotencia atómica activada para key: ${idempotencyKey}. Retornando viaje existente ${existingKeyData.rideId}.`);
          return {
            id: existingKeyData.rideId,
            ...existingRideDoc.data(),
            _idempotent: true
          };
        }
      }

      // Si no existe, crear atómicamente el ride y el registro de idempotencia
      const newRideRef = db.collection('rides').doc();
      const rideId = newRideRef.id;

      // Generación Segura de OTP Criptográfico Server-Side (3 dígitos: 100-999)
      const otpCode = crypto.randomInt(100, 1000).toString();
      const otpHash = hashOtp(rideId, otpCode);

      const rideDocument: Record<string, any> = {
        id: rideId,
        idempotencyKey,
        passengerId: authenticatedUid,
        passengerName: payload.passengerName?.trim() || 'Pasajero Zénith',
        passengerPhone: payload.passengerPhone?.trim() || '',
        origin: {
          address: quote.origin.address,
          lat: quote.origin.lat,
          lng: quote.origin.lng
        },
        destination: {
          address: quote.destination.address,
          lat: quote.destination.lat,
          lng: quote.destination.lng
        },
        city: quote.marketZone?.city || (quote.origin ? resolveCityFromCoordinates(quote.origin.lat, quote.origin.lng, quote.origin.address).city : 'Perú'),
        marketZoneId: quote.marketZone?.id || null,
        gridKey: quote.marketZone?.gridKey || null,
        // AUTORIDAD TOTAL DEL BACKEND SOBRE PRECIOS
        protectedPrice: quote.totalFare,
        finalPrice: quote.totalFare,
        basePrice: quote.normalFare,
        multiplier: quote.multiplier,
        marketPressure: quote.pressure ?? 1.0,
        distance: quote.distance,
        duration: quote.duration ?? 0,
        currency: 'PEN',
        quoteId: quote.quoteId,
        pricingSeal: quote.pricingSeal,
        pricingVersion: quote.pricingVersion,
        paymentMethod: payload.paymentMethod || 'cash',
        paymentState: payload.paymentState || 'AUTHORIZED',
        paymentId: payload.paymentId || `tx_${Date.now()}`,
        status: 'SEARCHING_DRIVER',
        // Generación Segura de OTP Criptográfico Server-Side
        otpHash,
        otpAttempts: 0,
        otpMaxAttempts: 3,
        otpExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        otpVerified: false,
        passengerOtp: otpCode,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };

      // Campos operacionales si es entrega / paquetería
      if (payload.orderType === 'DELIVERY' || payload.packageInfo) {
        rideDocument.orderType = 'DELIVERY';
        if (payload.packageInfo) rideDocument.packageInfo = payload.packageInfo;
        if (payload.receptor) rideDocument.receptor = payload.receptor;
        if (payload.pagador) rideDocument.pagador = payload.pagador;
        if (payload.solicitante) rideDocument.solicitante = payload.solicitante;
        if (payload.evidenceLevel) rideDocument.evidenceLevel = payload.evidenceLevel;
        if (payload.returnContingency) rideDocument.returnContingency = payload.returnContingency;
      }

      transaction.set(newRideRef, rideDocument);
      transaction.set(idempotencyRef, {
        idempotencyKey,
        rideId,
        payloadHash,
        passengerId: authenticatedUid,
        createdAt: FieldValue.serverTimestamp()
      });

      console.log(`[RIDE_GATEKEEPER] Viaje ${rideId} creado atómicamente con tarifa inmutable S/ ${quote.totalFare.toFixed(2)}.`);
      return {
        id: rideId,
        ...rideDocument,
        _idempotent: false
      };
    });

    // Iniciar ciclo de despacho server-side de forma autónoma (sin depender del cliente)
    if (!createdRide._idempotent) {
      DispatchService.runDispatchCycle(createdRide.id).catch(err => {
        console.warn(`[SERVER_DISPATCH] Error iniciando ciclo de despacho para ${createdRide.id}:`, err);
      });
    }

    return createdRide;
  }

  static async acceptRide(rideId: string, driverId: string, driverName?: string, driverLocation?: any) {
    if (!db) throw new Error('Base de datos no disponible.');

    const rideRef = db.collection('rides').doc(rideId);
    const driverPresenceRef = db.collection('drivers_online').doc(driverId);

    return await db.runTransaction(async (transaction) => {
      const rideDoc = await transaction.get(rideRef);
      if (!rideDoc.exists) {
        const err: any = new Error('Viaje no encontrado.');
        err.statusCode = 404;
        throw err;
      }

      const ride = rideDoc.data()!;

      // 1. Idempotencia: Si el viaje ya fue asignado al MISMO conductor (retry seguro)
      if (ride.status === 'DRIVER_ASSIGNED' && ride.driverId === driverId) {
        return {
          id: rideId,
          ...ride,
          _idempotent: true
        };
      }

      // 2. Conflicto: Si el viaje ya está asignado a otro conductor o cancelado -> HTTP 409
      if (ride.status !== 'SEARCHING_DRIVER' && ride.status !== 'REQUESTED') {
        const conflictErr: any = new Error('El viaje ya no está disponible para asignación (asignado a otro conductor o finalizado).');
        conflictErr.statusCode = 409;
        throw conflictErr;
      }

      // 3. Verificar estado del conductor en drivers_online
      const driverDoc = await transaction.get(driverPresenceRef);
      if (!driverDoc.exists) {
        const unavailErr: any = new Error('El conductor no se encuentra conectado a la red de despacho.');
        unavailErr.statusCode = 400;
        throw unavailErr;
      }

      const driverData = driverDoc.data()!;
      if (driverData.status !== 'AVAILABLE') {
        const busyErr: any = new Error(`El conductor no está disponible para aceptar viajes (estado actual: ${driverData.status}).`);
        busyErr.statusCode = 409;
        throw busyErr;
      }

      const resolvedDriverName = driverName?.trim() || driverData.driverName || 'Conductor Zénith';
      const resolvedLocation = driverLocation || (driverData.lat && driverData.lng ? { lat: driverData.lat, lng: driverData.lng } : null);

      const updateData = {
        status: 'DRIVER_ASSIGNED',
        driverId,
        driverName: resolvedDriverName,
        driverLocation: resolvedLocation,
        acceptedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };

      // A. Asignación atómica inmutable del viaje
      transaction.update(rideRef, updateData);

      // B. Conmutación atómica de disponibilidad del conductor: AVAILABLE -> BUSY
      transaction.update(driverPresenceRef, {
        status: 'BUSY',
        currentRideId: rideId,
        lastActive: FieldValue.serverTimestamp()
      });

      console.log(`[RIDE_LIFECYCLE] Viaje ${rideId} asignado exitosamente al conductor ${driverId}. Estado de conductor: BUSY.`);

      return {
        id: rideId,
        ...ride,
        ...updateData,
        _idempotent: false
      };
    });
  }

  static async cancelRide(rideId: string, userId: string) {
    if (!db) throw new Error('Base de datos no disponible.');

    const rideRef = db.collection('rides').doc(rideId);

    return await db.runTransaction(async (transaction) => {
      const rideDoc = await transaction.get(rideRef);
      if (!rideDoc.exists) {
        const err: any = new Error('Viaje no encontrado.');
        err.statusCode = 404;
        throw err;
      }

      const ride = rideDoc.data();

      // Zero-Trust: Solo pasajero o conductor asignado pueden cancelar
      if (ride?.passengerId !== userId && ride?.driverId !== userId) {
        const err: any = new Error('No tienes permiso para cancelar este viaje.');
        err.statusCode = 403;
        throw err;
      }

      if (['COMPLETED', 'CANCELLED'].includes(ride?.status)) {
        const err: any = new Error('El viaje ya ha finalizado.');
        err.statusCode = 400;
        throw err;
      }

      // Lecturas primero (Firestore Transaction Constraint)
      let driverSnap: any = null;
      let driverRef: any = null;
      if (ride?.driverId) {
        driverRef = db.collection('drivers_online').doc(ride.driverId);
        driverSnap = await transaction.get(driverRef);
      }

      // Escrituras después
      transaction.update(rideRef, {
        status: 'CANCELLED',
        cancelledBy: userId,
        updatedAt: FieldValue.serverTimestamp()
      });

      // Si el viaje tenía conductor asignado, liberarlo atómicamente: BUSY -> AVAILABLE
      if (driverRef && driverSnap && driverSnap.exists) {
        transaction.update(driverRef, {
          status: 'AVAILABLE',
          currentRideId: null,
          lastActive: FieldValue.serverTimestamp()
        });
      }
    });
  }

  static async updateRideStatus(rideId: string, driverId: string, status: string) {
    if (!db) throw new Error('Base de datos no disponible.');

    const rideRef = db.collection('rides').doc(rideId);

    return await db.runTransaction(async (transaction) => {
      // 1. TODAS LAS LECTURAS PRIMERO (Regla estricta de Firestore Transactions)
      const rideDoc = await transaction.get(rideRef);
      if (!rideDoc.exists) {
        const err: any = new Error('Viaje no encontrado.');
        err.statusCode = 404;
        throw err;
      }

      const ride = rideDoc.data()!;

      if (ride.driverId !== driverId) {
        const err: any = new Error('No tienes permiso para actualizar este viaje.');
        err.statusCode = 403;
        throw err;
      }

      // Validación estricta de Máquina de Estados (FSM)
      const currentStatus = ride.status;
      const allowedNext = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];

      if (!allowedNext.includes(status)) {
        const err: any = new Error(`Transición ilegal de '${currentStatus}' a '${status}'.`);
        err.statusCode = 400;
        throw err;
      }

      // El estado IN_PROGRESS no puede ser forzado directamente mediante status; exige validar OTP
      if (status === 'IN_PROGRESS') {
        const err: any = new Error('El estado IN_PROGRESS solo puede alcanzarse validando el código OTP mediante /api/rides/:rideId/verify-otp.');
        err.statusCode = 400;
        throw err;
      }

      let driverSnap: any = null;
      let driverRef: any = null;
      if (status === 'COMPLETED') {
        driverRef = db.collection('drivers_online').doc(driverId);
        driverSnap = await transaction.get(driverRef);
      }

      // 2. TODAS LAS ESCRITURAS DESPUÉS
      const updatePayload: Record<string, any> = {
        status,
        updatedAt: FieldValue.serverTimestamp()
      };

      if (status === 'COMPLETED') {
        updatePayload.completedAt = FieldValue.serverTimestamp();
      }

      transaction.update(rideRef, updatePayload);

      // Si el viaje se completa, liberar al conductor: BUSY -> AVAILABLE
      if (status === 'COMPLETED' && driverRef && driverSnap && driverSnap.exists) {
        transaction.update(driverRef, {
          status: 'AVAILABLE',
          currentRideId: null,
          lastActive: FieldValue.serverTimestamp()
        });
      }

      return { success: true, message: `Estado actualizado a ${status}.`, status };
    });
  }

  /**
   * Validador oficial y autoritativo de código de abordaje (OTP).
   * Exclusivo para el conductor asignado cuando el viaje está en WAITING_FOR_OTP.
   */
  static async verifyOtp(rideId: string, driverId: string, inputOtp: string) {
    if (!db) throw new Error('Base de datos no disponible.');

    const rideRef = db.collection('rides').doc(rideId);

    return await db.runTransaction(async (transaction) => {
      const rideDoc = await transaction.get(rideRef);
      if (!rideDoc.exists) {
        const err: any = new Error('Viaje no encontrado.');
        err.statusCode = 404;
        throw err;
      }

      const ride = rideDoc.data()!;

      // 1. Autorización: Solo el conductor asignado puede validar el código
      if (ride.driverId !== driverId) {
        const err: any = new Error('No tienes permiso para validar el código de este viaje.');
        err.statusCode = 403;
        throw err;
      }

      // 2. Estado: El viaje debe estar en WAITING_FOR_OTP
      if (ride.status !== 'WAITING_FOR_OTP') {
        const err: any = new Error(`El viaje no se encuentra esperando código OTP (estado actual: ${ride.status}).`);
        err.statusCode = 400;
        throw err;
      }

      // 3. Verificación de consumo previo (Anti-Replay)
      if (ride.otpVerified) {
        const err: any = new Error('El código OTP ya fue consumido.');
        err.statusCode = 400;
        throw err;
      }

      // 4. Límite estricto de intentos (Anti-Bruteforce)
      const currentAttempts = ride.otpAttempts || 0;
      const maxAttempts = ride.otpMaxAttempts || 3;
      if (currentAttempts >= maxAttempts) {
        const err: any = new Error('Límite de intentos de OTP excedido. Por seguridad el abordaje está bloqueado.');
        err.statusCode = 400;
        throw err;
      }

      // 5. Verificación de expiración
      if (ride.otpExpiresAt && new Date() > new Date(ride.otpExpiresAt)) {
        const err: any = new Error('El código OTP ha expirado.');
        err.statusCode = 400;
        throw err;
      }

      // 6. Validación de hash criptográfico
      const inputHash = hashOtp(rideId, (inputOtp || '').trim());
      if (inputHash !== ride.otpHash) {
        const nextAttempts = currentAttempts + 1;
        await rideRef.update({
          otpAttempts: nextAttempts,
          updatedAt: FieldValue.serverTimestamp()
        });
        const remaining = Math.max(0, maxAttempts - nextAttempts);
        const err: any = new Error(`Código OTP incorrecto. Intentos restantes: ${remaining}.`);
        err.statusCode = 400;
        throw err;
      }

      // 7. Éxito: Transición atómica WAITING_FOR_OTP -> IN_PROGRESS
      transaction.update(rideRef, {
        status: 'IN_PROGRESS',
        otpVerified: true,
        startedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });

      console.log(`[RIDE_OTP] Viaje ${rideId} inició su curso exitosamente (OTP verificado por conductor ${driverId}).`);

      return {
        success: true,
        message: 'Código de seguridad verificado exitosamente. Viaje iniciado.',
        status: 'IN_PROGRESS'
      };
    });
  }

  /**
   * Consulta segura del código OTP de abordaje exclusivamente por el pasajero propietario.
   */
  static async getPassengerOtp(rideId: string, passengerId: string) {
    if (!db) throw new Error('Base de datos no disponible.');

    const rideSnap = await db.collection('rides').doc(rideId).get();
    if (!rideSnap.exists) {
      const err: any = new Error('Viaje no encontrado.');
      err.statusCode = 404;
      throw err;
    }

    const ride = rideSnap.data()!;
    if (ride.passengerId !== passengerId) {
      const err: any = new Error('No tienes permiso para consultar el código de este viaje.');
      err.statusCode = 403;
      throw err;
    }

    return {
      otpCode: ride.passengerOtp,
      expiresAt: ride.otpExpiresAt,
      attemptsRemaining: Math.max(0, (ride.otpMaxAttempts || 3) - (ride.otpAttempts || 0))
    };
  }
}
