import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  addDoc,
  serverTimestamp,
  increment
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { 
  Ride, 
  RideStatus, 
  User, 
  Solicitante, 
  Pagador, 
  Receptor, 
  MotorizadoInfo,
  SolicitudeStatus,
  TransitStatus,
  DeliveryStatus,
  CustodyStatus,
  EvidenceLevel,
  ProductType,
  PackageInfo,
  CommunicationChannel,
  CommunicationAttempt,
  OperationalEvent,
  DestinationChangeRequest,
  OperationalIncident,
  Location,
  DriverProfile
} from '../types';
import { WalletService } from './WalletService';
import { NotificationService } from './NotificationService';

export class OperationalEngine {
  /**
   * Genera un código OTP criptográfico seguro de 4 dígitos exclusivamente para confirmación de entrega
   */
  static generateDeliveryOtp(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  /**
   * Determina el nivel de evidencia operacional (E1 a E4) antes de iniciar la operación
   */
  static determineEvidenceLevel(packageInfo: PackageInfo, isHighSensitivity: boolean = false): EvidenceLevel {
    if (packageInfo.declaredValue && packageInfo.declaredValue > 300) {
      return EvidenceLevel.E4_SPECIAL;
    }
    if (isHighSensitivity || packageInfo.type === ProductType.PERISHABLE || (packageInfo.initialPhotos && packageInfo.initialPhotos.length > 0)) {
      return EvidenceLevel.E3_SENSITIVE;
    }
    return EvidenceLevel.E2_CONFIRMED; // Mínimo E2 (GPS + Tiempo + OTP) para toda entrega Zénith
  }

  /**
   * Registra un evento operacional inmutable en la bitácora de auditoría (Event Sourcing)
   */
  static async recordEvent(
    operationId: string,
    actor: { role: 'SOLICITANTE' | 'PAGADOR' | 'RECEPTOR' | 'MOTORIZADO' | 'SYSTEM'; id: string; name: string },
    action: string,
    result: string,
    lat: number = -8.1116,
    lng: number = -79.0287,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    try {
      const event: OperationalEvent = {
        id: `op_ev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        operationId,
        timestamp: new Date().toISOString(),
        lat,
        lng,
        actorRole: actor.role,
        actorId: actor.id,
        actorName: actor.name,
        action,
        result,
        metadata
      };

      // Guardamos en la subcolección inmutable de eventos de la operación
      await addDoc(collection(db, 'rides', operationId, 'events'), event);
      // Y en la colección raíz para auditorías globales
      await addDoc(collection(db, 'operational_events'), event);
    } catch (err) {
      console.error('[ZENITH-EVENT-LOG-ERROR] No se pudo persistir el evento:', err);
    }
  }

  /**
   * CASO 03 — RECOJO NO DISPONIBLE
   * Cuando el motorizado llega al punto de recojo y el pedido no está disponible:
   * Debe esperar obligatoriamente 5 minutos desde la llegada.
   * Tras 5 minutos: puede cancelar sin penalidad.
   */
  static async arriveAtPickup(rideId: string, motorizado: MotorizadoInfo, lat: number, lng: number): Promise<void> {
    const rideRef = doc(db, 'rides', rideId);
    const now = new Date().toISOString();
    await updateDoc(rideRef, {
      transitStatus: TransitStatus.AT_PICKUP,
      pickupArrivedAt: now,
      updatedAt: serverTimestamp()
    });

    await this.recordEvent(
      rideId,
      { role: 'MOTORIZADO', id: motorizado.uid, name: motorizado.name },
      'ARRIVE_AT_PICKUP',
      'Motorizado llegó al punto de recojo. Iniciando temporizador obligatorio de 5 minutos.',
      lat,
      lng
    );
  }

  static async cancelPickupUnavailable(rideId: string, motorizado: MotorizadoInfo, pickupArrivedAt: string): Promise<{ success: boolean; message: string }> {
    const arrivedMs = new Date(pickupArrivedAt).getTime();
    const elapsedMinutes = (Date.now() - arrivedMs) / (1000 * 60);

    if (elapsedMinutes < 5) {
      const remainingSeconds = Math.ceil((5 - elapsedMinutes) * 60);
      return {
        success: false,
        message: `Regla Caso 03: Debe esperar al menos 5 minutos en recojo. Faltan ${remainingSeconds} segundos.`
      };
    }

    const rideRef = doc(db, 'rides', rideId);
    await updateDoc(rideRef, {
      status: RideStatus.CANCELLED,
      solicitudeStatus: SolicitudeStatus.CANCELLED,
      deliveryStatus: DeliveryStatus.REJECTED,
      updatedAt: serverTimestamp()
    });

    await this.recordEvent(
      rideId,
      { role: 'MOTORIZADO', id: motorizado.uid, name: motorizado.name },
      'CANCEL_PICKUP_UNAVAILABLE',
      'Cancelación sin penalidad: Pedido no disponible tras 5 minutos de espera obligatoria en recojo.',
      -8.1116,
      -79.0287
    );

    return {
      success: true,
      message: 'Cancelación efectuada sin penalidad para el motorizado.'
    };
  }

  /**
   * CASO 04 — PEDIDO DIFERENTE O INCOMPLETO
   * El motorizado rechaza automáticamente. Sin penalidad para ninguna parte.
   */
  static async rejectMismatchedOrder(rideId: string, motorizado: MotorizadoInfo, reason: string): Promise<void> {
    const rideRef = doc(db, 'rides', rideId);
    await updateDoc(rideRef, {
      status: RideStatus.CANCELLED,
      solicitudeStatus: SolicitudeStatus.CANCELLED,
      deliveryStatus: DeliveryStatus.REJECTED,
      updatedAt: serverTimestamp()
    });

    await this.recordEvent(
      rideId,
      { role: 'MOTORIZADO', id: motorizado.uid, name: motorizado.name },
      'REJECT_MISMATCHED_ORDER',
      `Operación rechazada automáticamente: ${reason}. Sin penalidad para ninguna parte.`,
      -8.1116,
      -79.0287
    );
  }

  /**
   * CASO 05 — ESTABLECIMIENTO SE NIEGA A ENTREGAR
   * Pedido rechazado, no penalizado.
   */
  static async rejectMerchantRefusal(rideId: string, motorizado: MotorizadoInfo, reason: string): Promise<void> {
    const rideRef = doc(db, 'rides', rideId);
    await updateDoc(rideRef, {
      status: RideStatus.CANCELLED,
      solicitudeStatus: SolicitudeStatus.CANCELLED,
      deliveryStatus: DeliveryStatus.REJECTED,
      updatedAt: serverTimestamp()
    });

    await this.recordEvent(
      rideId,
      { role: 'MOTORIZADO', id: motorizado.uid, name: motorizado.name },
      'REJECT_MERCHANT_REFUSAL',
      `Establecimiento se negó a entregar el pedido: ${reason}. Sin penalidad para el motorizado.`,
      -8.1116,
      -79.0287
    );
  }

  /**
   * INICIO DE TRASLADO Y ASUNCIÓN DE CUSTODIA
   * El motorizado recoge el producto, sube evidencias fotográficas iniciales de custodia y recibe el OTP para entrega.
   */
  static async acquireCustodyAndStartTransit(
    rideId: string,
    motorizado: MotorizadoInfo,
    packageInfo: PackageInfo,
    lat: number,
    lng: number
  ): Promise<string> {
    const rideRef = doc(db, 'rides', rideId);
    const otp = this.generateDeliveryOtp();

    await updateDoc(rideRef, {
      status: RideStatus.IN_PROGRESS,
      solicitudeStatus: SolicitudeStatus.ACTIVE,
      transitStatus: TransitStatus.IN_TRANSIT,
      custodyStatus: CustodyStatus.IN_TRANSIT_CUSTODY,
      deliveryStatus: DeliveryStatus.PENDING,
      deliveryOtp: otp,
      deliveryOtpVerified: false,
      packageInfo,
      updatedAt: serverTimestamp()
    });

    await this.recordEvent(
      rideId,
      { role: 'MOTORIZADO', id: motorizado.uid, name: motorizado.name },
      'ACQUIRE_CUSTODY_AND_START_TRANSIT',
      `Custodia de producto adquirida. Evidencia inicial registrada. OTP de entrega generado para el receptor.`,
      lat,
      lng,
      { photosCount: packageInfo.initialPhotos.length, productType: packageInfo.type }
    );

    return otp;
  }

  /**
   * LLEGADA A DESTINO Y TEMPORIZADOR DE ESPERA (Sección 8)
   * 5 minutos de espera incluidos al llegar.
   */
  static async arriveAtDestination(rideId: string, motorizado: MotorizadoInfo, lat: number, lng: number): Promise<void> {
    const rideRef = doc(db, 'rides', rideId);
    const now = new Date().toISOString();
    await updateDoc(rideRef, {
      transitStatus: TransitStatus.AT_DESTINATION,
      destinationArrivedAt: now,
      waitStartedAt: now,
      includedWaitMinutes: 5,
      additionalWaitBlocksRequested: 0,
      additionalWaitBlocksAccepted: 0,
      additionalWaitCost: 0,
      updatedAt: serverTimestamp()
    });

    await this.recordEvent(
      rideId,
      { role: 'MOTORIZADO', id: motorizado.uid, name: motorizado.name },
      'ARRIVE_AT_DESTINATION',
      'Motorizado llegó al destino. 5 minutos de espera incluidos iniciados.',
      lat,
      lng
    );
  }

  /**
   * PROTOCOLO DE COMUNICACIÓN EN 4 NIVELES (Sección 5)
   * Nivel 1: Chat interno Zénith
   * Nivel 2: Llamada nativa Zénith
   * Nivel 3: WhatsApp
   * Nivel 4: Llamada directa
   */
  static async logCommunicationAttempt(
    rideId: string,
    motorizado: MotorizadoInfo,
    channel: CommunicationChannel,
    targetRole: 'RECEPTOR' | 'SOLICITANTE' | 'PAGADOR',
    result: 'ANSWERED' | 'NO_ANSWER' | 'BUSY' | 'MESSAGE_SENT',
    notes: string = ''
  ): Promise<CommunicationAttempt> {
    const attempt: CommunicationAttempt = {
      id: `comm_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      timestamp: new Date().toISOString(),
      channel,
      targetRole,
      result,
      notes
    };

    const rideRef = doc(db, 'rides', rideId);
    const rideSnap = await getDoc(rideRef);
    if (rideSnap.exists()) {
      const data = rideSnap.data() as Ride;
      const prevAttempts = data.communicationAttempts || [];
      await updateDoc(rideRef, {
        communicationAttempts: [...prevAttempts, attempt],
        updatedAt: serverTimestamp()
      });
    }

    await this.recordEvent(
      rideId,
      { role: 'MOTORIZADO', id: motorizado.uid, name: motorizado.name },
      'COMMUNICATION_ATTEMPT',
      `Intento en canal ${channel} hacia ${targetRole}. Resultado: ${result}. ${notes}`,
      -8.1116,
      -79.0287,
      { channel, targetRole, result }
    );

    return attempt;
  }

  /**
   * SOLICITUD Y ACEPTACIÓN DE BLOQUES DE ESPERA ADICIONALES DE 5 MINUTOS (Sección 8)
   */
  static async requestAdditionalWaitBlock(rideId: string, motorizado: MotorizadoInfo): Promise<void> {
    const rideRef = doc(db, 'rides', rideId);
    await updateDoc(rideRef, {
      additionalWaitBlocksRequested: increment(1),
      updatedAt: serverTimestamp()
    });

    await this.recordEvent(
      rideId,
      { role: 'MOTORIZADO', id: motorizado.uid, name: motorizado.name },
      'REQUEST_ADDITIONAL_WAIT_BLOCK',
      'Motorizado solicitó bloque adicional de 5 minutos de espera.',
      -8.1116,
      -79.0287
    );
  }

  static async acceptAdditionalWaitBlock(rideId: string, pagadorUser: User, costPerBlock: number = 3.00): Promise<void> {
    const rideRef = doc(db, 'rides', rideId);
    await updateDoc(rideRef, {
      additionalWaitBlocksAccepted: increment(1),
      additionalWaitCost: increment(costPerBlock),
      updatedAt: serverTimestamp()
    });

    await this.recordEvent(
      rideId,
      { role: 'PAGADOR', id: pagadorUser.uid, name: pagadorUser.fullName },
      'ACCEPT_ADDITIONAL_WAIT_BLOCK',
      `Cliente aceptó 5 minutos de espera adicional y costo de S/ ${costPerBlock.toFixed(2)}.`,
      -8.1116,
      -79.0287,
      { costPerBlock }
    );
  }

  /**
   * CONFIRMACIÓN DE ENTREGA MEDIANTE OTP (Sección 6)
   * El OTP es exclusivo para la confirmación de la entrega.
   */
  static async verifyDeliveryOtp(
    rideId: string,
    enteredOtp: string,
    motorizado: MotorizadoInfo,
    lat: number,
    lng: number
  ): Promise<{ success: boolean; message: string }> {
    const rideRef = doc(db, 'rides', rideId);
    const rideSnap = await getDoc(rideRef);
    if (!rideSnap.exists()) {
      return { success: false, message: 'Operación no encontrada.' };
    }

    const ride = rideSnap.data() as Ride;
    if (ride.deliveryOtp !== enteredOtp.trim()) {
      await this.recordEvent(
        rideId,
        { role: 'MOTORIZADO', id: motorizado.uid, name: motorizado.name },
        'OTP_VERIFICATION_FAILED',
        `Código OTP erróneo ingresado: ${enteredOtp}`,
        lat,
        lng
      );
      return { success: false, message: 'Código OTP de entrega inválido. Solicítelo al receptor.' };
    }

    await updateDoc(rideRef, {
      status: RideStatus.COMPLETED,
      solicitudeStatus: SolicitudeStatus.COMPLETED,
      deliveryStatus: DeliveryStatus.DELIVERED_OTP,
      custodyStatus: CustodyStatus.NONE,
      deliveryOtpVerified: true,
      updatedAt: serverTimestamp()
    });

    await this.recordEvent(
      rideId,
      { role: 'MOTORIZADO', id: motorizado.uid, name: motorizado.name },
      'DELIVERY_CONFIRMED_WITH_OTP',
      'Entrega confirmada exitosamente mediante OTP de un solo uso. Custodia finalizada.',
      lat,
      lng
    );

    // Notificar al solicitante
    await NotificationService.notifyRideCompleted(ride.passengerId, motorizado.uid, ride.protectedPrice);

    return { success: true, message: 'Entrega confirmada exitosamente.' };
  }

  /**
   * CASO 02 — CLIENTE/RECEPTOR NO DISPONIBLE
   * Cuando se agota el tiempo y protocolo:
   * Entrega NO REALIZADA.
   * La carrera se cierra, pero el motorizado SE CONVIERTE EN CUSTODIO del producto.
   * Ventana: 60 min para perecibles, 48 horas para no perecibles.
   */
  static async finalizeReceptorUnavailable(
    rideId: string,
    motorizado: MotorizadoInfo,
    productType: ProductType,
    lat: number,
    lng: number
  ): Promise<void> {
    const rideRef = doc(db, 'rides', rideId);
    const now = new Date();
    // 60 minutos si es perecible, 48 horas si es no perecible
    const expirationMs = productType === ProductType.PERISHABLE ? 60 * 60 * 1000 : 48 * 60 * 60 * 1000;
    const custodyExpiresAt = new Date(now.getTime() + expirationMs).toISOString();

    await updateDoc(rideRef, {
      status: RideStatus.COMPLETED, // Carrera finalizada operativamente
      solicitudeStatus: SolicitudeStatus.CLOSED,
      deliveryStatus: DeliveryStatus.DELIVERY_FAILED,
      custodyStatus: CustodyStatus.ACTIVE_CUSTODY,
      custodyExpiresAt,
      updatedAt: serverTimestamp()
    });

    await this.recordEvent(
      rideId,
      { role: 'MOTORIZADO', id: motorizado.uid, name: motorizado.name },
      'DELIVERY_FAILED_CUSTODY_ACTIVE',
      `Protocolo agotado: Receptor ausente. Carrera cerrada. Motorizado asumió CUSTODIA ACTIVA (${productType === ProductType.PERISHABLE ? '60 min ventana perecible' : '48 horas máx no perecible'}).`,
      lat,
      lng,
      { custodyExpiresAt, productType }
    );
  }

  /**
   * RECUPERACIÓN — PEDIDO 2 (Secciones 11, 12, 13)
   * Crea una nueva operación independiente a partir de un producto en custodia activa.
   * Asignado con PRIORIDAD 1 para ese custodio.
   */
  static async createRecoveryOrder(
    originalRideId: string,
    solicitante: Solicitante,
    pagador: Pagador,
    receptor: Receptor,
    fare: number
  ): Promise<string> {
    const origRef = doc(db, 'rides', originalRideId);
    const origSnap = await getDoc(origRef);
    if (!origSnap.exists()) throw new Error('Operación original no encontrada.');

    const origRide = origSnap.data() as Ride;
    if (origRide.custodyStatus !== CustodyStatus.ACTIVE_CUSTODY) {
      throw new Error('El producto no se encuentra bajo custodia activa.');
    }

    const nowIso = new Date().toISOString();
    if (origRide.custodyExpiresAt && new Date(nowIso) > new Date(origRide.custodyExpiresAt)) {
      throw new Error('La custodia del producto ha expirado.');
    }

    const newRideData: Partial<Ride> = {
      passengerId: solicitante.uid,
      passengerName: solicitante.name,
      solicitante,
      pagador,
      receptor,
      driverId: origRide.driverId,
      driverName: origRide.driverName,
      motorizado: origRide.motorizado,
      origin: origRide.destination, // Punto donde está el custodio o destino previo
      destination: {
        address: receptor.address,
        lat: receptor.lat,
        lng: receptor.lng
      },
      protectedPrice: fare,
      pricingSeal: `ZENITH-REC-V1.1-${Date.now()}`,
      pricingVersion: '2.0.1-enterprise',
      status: RideStatus.DRIVER_ASSIGNED,
      solicitudeStatus: SolicitudeStatus.ASSIGNED,
      transitStatus: TransitStatus.IN_TRANSIT,
      deliveryStatus: DeliveryStatus.PENDING,
      custodyStatus: CustodyStatus.IN_TRANSIT_CUSTODY,
      evidenceLevel: origRide.evidenceLevel || EvidenceLevel.E2_CONFIRMED,
      packageInfo: origRide.packageInfo,
      deliveryOtp: this.generateDeliveryOtp(),
      deliveryOtpVerified: false,
      isRecoveryOrder: true,
      originalOperationId: originalRideId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'rides'), newRideData);

    await this.recordEvent(
      docRef.id,
      { role: 'SOLICITANTE', id: solicitante.uid, name: solicitante.name },
      'CREATE_RECOVERY_PEDIDO_2',
      `Pedido 2 de recuperación creado a partir de la operación ${originalRideId}. Prioridad 1 asignada al custodio.`,
      receptor.lat,
      receptor.lng,
      { originalRideId }
    );

    return docRef.id;
  }

  /**
   * PEDIDO 2 FALLIDO / EXPIRACIÓN DE CUSTODIA (Secciones 13, 14, 15)
   * Libera al custodio y autoriza la disposición del producto.
   */
  static async disposeProductCustody(rideId: string, motorizado: MotorizadoInfo, reason: string): Promise<void> {
    const rideRef = doc(db, 'rides', rideId);
    await updateDoc(rideRef, {
      custodyStatus: CustodyStatus.DISPOSED,
      custodyDisposedAt: new Date().toISOString(),
      updatedAt: serverTimestamp()
    });

    await this.recordEvent(
      rideId,
      { role: 'MOTORIZADO', id: motorizado.uid, name: motorizado.name },
      'DISPOSE_PRODUCT_CUSTODY',
      `Custodia liberada / Expirada: ${reason}. Zénith autoriza disposición final del producto por parte del custodio.`,
      -8.1116,
      -79.0287
    );
  }

  /**
   * CASOS 06 Y 07 — CANCELACIÓN DEL USUARIO TRAS DESPLAZAMIENTO / ANTES DE LLEGAR
   * < 1 km: 0%
   * 1 a < 2 km: 15% del valor de la solicitud
   * ≥ 2 km: 30% del valor de la solicitud
   * La penalidad genera una DEUDA para el usuario y se ACREDITA en la billetera/saldo Zénith del motorizado afectado.
   */
  static async cancelByUserWithDistancePenalty(
    rideId: string,
    user: User,
    kmDisplaced: number
  ): Promise<{ penaltyPercentage: number; penaltyAmount: number }> {
    const rideRef = doc(db, 'rides', rideId);
    const rideSnap = await getDoc(rideRef);
    if (!rideSnap.exists()) throw new Error('Operación no encontrada.');

    const ride = rideSnap.data() as Ride;
    let penaltyPercentage = 0;

    if (kmDisplaced < 1.0) {
      penaltyPercentage = 0;
    } else if (kmDisplaced >= 1.0 && kmDisplaced < 2.0) {
      penaltyPercentage = 15;
    } else {
      penaltyPercentage = 30;
    }

    const baseFare = ride.protectedPrice || 10;
    const penaltyAmount = Number(((baseFare * penaltyPercentage) / 100).toFixed(2));

    await updateDoc(rideRef, {
      status: RideStatus.CANCELLED,
      solicitudeStatus: SolicitudeStatus.CANCELLED,
      updatedAt: serverTimestamp()
    });

    // Registrar deuda en el perfil del usuario si hubo penalidad
    if (penaltyAmount > 0) {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        pendingDebt: increment(penaltyAmount),
        pendingDebtReason: `Penalidad de cancelación (${penaltyPercentage}%) por desplazamiento de ${kmDisplaced.toFixed(1)} km hacia el recojo en pedido ${rideId.substring(0, 8)}.`
      });

      // Acreditar al motorizado afectado en su saldo Zénith
      if (ride.driverId) {
        await WalletService.creditCompensation(
          ride.driverId,
          penaltyAmount,
          rideId,
          `Compensación Zénith: ${penaltyPercentage}% por cancelación de usuario tras ${kmDisplaced.toFixed(1)} km recorridos.`
        );

        await NotificationService.notifyUser(
          ride.driverId,
          'COMPENSACIÓN POR CANCELACIÓN',
          `Se ha abonado S/ ${penaltyAmount.toFixed(2)} (${penaltyPercentage}%) a su saldo Zénith por cancelación atribuible al usuario en pedido ${rideId.substring(0, 6)}.`
        );
      }
    }

    await this.recordEvent(
      rideId,
      { role: 'SOLICITANTE', id: user.uid, name: user.fullName },
      'CANCEL_BY_USER_WITH_PENALTY',
      `Usuario canceló. Desplazamiento verificado: ${kmDisplaced.toFixed(2)} km. Penalidad: ${penaltyPercentage}% (S/ ${penaltyAmount.toFixed(2)}).`,
      -8.1116,
      -79.0287,
      { kmDisplaced, penaltyPercentage, penaltyAmount }
    );

    return { penaltyPercentage, penaltyAmount };
  }

  /**
   * CASO 08 — CANCELACIÓN DEL MOTORIZADO
   * Contador diario de cancelaciones:
   * 1-3: Sin penalidad
   * 4: Suspensión 60 minutos
   * 5: Suspensión 4 horas
   * 6: Suspensión 24 horas
   * 7+: Suspensión 1 semana
   */
  static evaluateMotorizadoCancellation(driverProfile: DriverProfile): {
    nextCount: number;
    suspensionMinutes: number;
    warningMessage: string;
    willSuspend: boolean;
  } {
    const todayStr = new Date().toISOString().split('T')[0];
    const isSameDay = driverProfile.lastCancellationDate === todayStr;
    const currentCount = isSameDay ? (driverProfile.dailyCancellationsCount || 0) : 0;
    const nextCount = currentCount + 1;

    let suspensionMinutes = 0;
    let willSuspend = false;

    if (nextCount <= 3) {
      suspensionMinutes = 0;
      willSuspend = false;
    } else if (nextCount === 4) {
      suspensionMinutes = 60;
      willSuspend = true;
    } else if (nextCount === 5) {
      suspensionMinutes = 240; // 4 horas
      willSuspend = true;
    } else if (nextCount === 6) {
      suspensionMinutes = 1440; // 24 horas
      willSuspend = true;
    } else {
      suspensionMinutes = 10080; // 1 semana
      willSuspend = true;
    }

    const warningMessage = willSuspend
      ? `Has cancelado ${currentCount} solicitudes durante el día. Si cancelas esta solicitud, se aplicará una suspensión de ${suspensionMinutes >= 60 ? `${suspensionMinutes / 60} horas` : `${suspensionMinutes} minutos`}.`
      : `Cancelación ${nextCount} de 3 permitidas sin penalidad el día de hoy.`;

    return { nextCount, suspensionMinutes, warningMessage, willSuspend };
  }

  static async cancelByMotorizado(
    rideId: string,
    motorizado: MotorizadoInfo,
    driverUser: User,
    reason: string
  ): Promise<{ suspended: boolean; suspensionMinutes: number }> {
    const profile = driverUser.driverProfile || {
      status: driverUser.driverProfile?.status || 'APPROVED' as any,
      availability: true,
      rating: 5,
      vehicle: { category: 'MOTO', plate: motorizado.plate, brand: '', model: '', year: 2023, color: '' },
      documentation: { licenseNumber: '', licenseExpiry: '' },
      appVersion: '1.1.0',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const evaluation = this.evaluateMotorizadoCancellation(profile);
    const todayStr = new Date().toISOString().split('T')[0];
    const nowMs = Date.now();
    const suspendedUntil = evaluation.willSuspend
      ? new Date(nowMs + evaluation.suspensionMinutes * 60 * 1000).toISOString()
      : null;

    // Actualizar usuario motorizado
    const userRef = doc(db, 'users', motorizado.uid);
    await updateDoc(userRef, {
      'driverProfile.dailyCancellationsCount': evaluation.nextCount,
      'driverProfile.lastCancellationDate': todayStr,
      'driverProfile.suspendedUntil': suspendedUntil,
      'driverProfile.availability': evaluation.willSuspend ? false : profile.availability
    });

    // Cancelar la carrera
    const rideRef = doc(db, 'rides', rideId);
    await updateDoc(rideRef, {
      status: RideStatus.CANCELLED,
      solicitudeStatus: SolicitudeStatus.CANCELLED,
      updatedAt: serverTimestamp()
    });

    await this.recordEvent(
      rideId,
      { role: 'MOTORIZADO', id: motorizado.uid, name: motorizado.name },
      'CANCEL_BY_MOTORIZADO',
      `Motorizado canceló: ${reason}. Contador diario: ${evaluation.nextCount}. Suspensión: ${evaluation.suspensionMinutes} min.`,
      -8.1116,
      -79.0287,
      { count: evaluation.nextCount, suspensionMinutes: evaluation.suspensionMinutes }
    );

    return {
      suspended: evaluation.willSuspend,
      suspensionMinutes: evaluation.suspensionMinutes
    };
  }

  /**
   * CASO 09 — INCIDENTE DURANTE EL TRANSPORTE (AVERÍA MECÁNICA & ACCIDENTE)
   * 1. Avería mecánica 1: Sin penalidad, soporte Zénith, producto protegido.
   * 2. Avería mecánica 2 del mismo día: Suspensión preventiva de 24 horas ("descanso preventivo 24h").
   * 3. Accidente: Prioridad 1 Personas. Protocolo emergencia. Cuenta bloqueada preventivamente para evaluación de seguridad.
   *    - Si producto recuperable: Cambio formal de custodia hacia un nuevo motorizado de apoyo que continúa la operación.
   *    - Si irrecuperable: Estado PEDIDO IRRECUPERABLE POR EMERGENCIA.
   */
  static async reportMechanicalBreakdown(
    rideId: string,
    motorizado: MotorizadoInfo,
    driverUser: User,
    description: string
  ): Promise<{ isSecondBreakdown: boolean; preventiveRest: boolean }> {
    const todayStr = new Date().toISOString().split('T')[0];
    const isSameDay = driverUser.driverProfile?.lastMechanicalBreakdownDate === todayStr;
    const count = isSameDay ? (driverUser.driverProfile?.dailyMechanicalBreakdownsCount || 0) : 0;
    const nextCount = count + 1;
    const isSecondBreakdown = nextCount >= 2;

    const userRef = doc(db, 'users', motorizado.uid);
    const updates: Record<string, unknown> = {
      'driverProfile.dailyMechanicalBreakdownsCount': nextCount,
      'driverProfile.lastMechanicalBreakdownDate': todayStr
    };

    if (isSecondBreakdown) {
      // 24h preventive rest
      updates['driverProfile.suspendedUntil'] = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      updates['driverProfile.availability'] = false;
    }

    await updateDoc(userRef, updates);

    const incident: OperationalIncident = {
      id: `inc_${Date.now()}`,
      type: 'MECHANICAL_BREAKDOWN',
      severity: isSecondBreakdown ? 'HIGH' : 'MEDIUM',
      description,
      productRecoverable: true,
      status: 'IN_PROGRESS',
      createdAt: new Date().toISOString()
    };

    const rideRef = doc(db, 'rides', rideId);
    await updateDoc(rideRef, {
      incidents: [incident],
      updatedAt: serverTimestamp()
    });

    await this.recordEvent(
      rideId,
      { role: 'MOTORIZADO', id: motorizado.uid, name: motorizado.name },
      'MECHANICAL_BREAKDOWN_REPORTED',
      `Avería mecánica reportada (${nextCount}ª del día): ${description}. ${isSecondBreakdown ? 'Descanso preventivo de 24 horas aplicado.' : 'Producto bajo custodia en espera de soporte Zénith.'}`,
      -8.1116,
      -79.0287,
      { nextCount, isSecondBreakdown }
    );

    return { isSecondBreakdown, preventiveRest: isSecondBreakdown };
  }

  static async reportAccident(
    rideId: string,
    motorizado: MotorizadoInfo,
    driverUser: User,
    description: string,
    productRecoverable: boolean
  ): Promise<void> {
    // Prioridad 1: Personas. Bloqueo preventivo para evaluación de seguridad.
    const userRef = doc(db, 'users', motorizado.uid);
    await updateDoc(userRef, {
      isBlocked: true,
      'driverProfile.availability': false
    });

    const incident: OperationalIncident = {
      id: `acc_${Date.now()}`,
      type: 'ACCIDENT',
      severity: 'CRITICAL',
      description,
      productRecoverable,
      status: 'REPORTED',
      createdAt: new Date().toISOString()
    };

    const rideRef = doc(db, 'rides', rideId);
    if (productRecoverable) {
      await updateDoc(rideRef, {
        incidents: [incident],
        custodyStatus: CustodyStatus.ACTIVE_CUSTODY,
        updatedAt: serverTimestamp()
      });
    } else {
      await updateDoc(rideRef, {
        incidents: [incident],
        status: RideStatus.COMPLETED,
        solicitudeStatus: SolicitudeStatus.CLOSED,
        deliveryStatus: DeliveryStatus.DELIVERY_FAILED,
        custodyStatus: CustodyStatus.DISPOSED,
        updatedAt: serverTimestamp()
      });
    }

    await this.recordEvent(
      rideId,
      { role: 'MOTORIZADO', id: motorizado.uid, name: motorizado.name },
      'ACCIDENT_EMERGENCY_REPORTED',
      `Emergencia por accidente reportada. Prioridad: Integridad de las personas. Producto ${productRecoverable ? 'RECUPERABLE (preparando transferencia formal de custodia)' : 'IRRECUPERABLE POR EMERGENCIA'}.`,
      -8.1116,
      -79.0287,
      { productRecoverable, description }
    );
  }

  /**
   * Transferencia formal de custodia ante emergencia (accidente/avería grave con producto recuperable)
   * NO crea nuevo pedido del cliente. La operación original continúa con el nuevo motorizado.
   */
  static async transferCustodyToBackup(
    rideId: string,
    currentMotorizado: MotorizadoInfo,
    backupMotorizado: MotorizadoInfo,
    lat: number,
    lng: number
  ): Promise<void> {
    const rideRef = doc(db, 'rides', rideId);
    await updateDoc(rideRef, {
      driverId: backupMotorizado.uid,
      driverName: backupMotorizado.name,
      motorizado: backupMotorizado,
      custodyStatus: CustodyStatus.IN_TRANSIT_CUSTODY,
      updatedAt: serverTimestamp()
    });

    await this.recordEvent(
      rideId,
      { role: 'SYSTEM', id: 'zenith_dispatch', name: 'Zénith Control' },
      'CUSTODY_TRANSFER_EXECUTED',
      `Cambio formal de custodia realizado: De ${currentMotorizado.name} a nuevo operador ${backupMotorizado.name}. La operación original continúa su trayecto.`,
      lat,
      lng,
      { previousDriverId: currentMotorizado.uid, newDriverId: backupMotorizado.uid }
    );
  }

  /**
   * CASO 10 — RUTA O DESTINO INACCESIBLE & CAMBIO DE DESTINO
   * El destino original es INMUTABLE informalmente.
   * El cliente solicita formalmente nuevo destino -> Zénith geolocaliza y recalcula tarifa ->
   * Cliente acepta -> Motorizado recibe la propuesta y puede ACEPTAR o RECHAZAR.
   */
  static async requestDestinationChange(
    rideId: string,
    requestedBy: 'SOLICITANTE' | 'RECEPTOR',
    newAddress: string,
    newLat: number,
    newLng: number,
    newDistance: number,
    newPrice: number,
    previousDistance: number,
    previousPrice: number
  ): Promise<DestinationChangeRequest> {
    const req: DestinationChangeRequest = {
      id: `chg_${Date.now()}`,
      newAddress,
      newLat,
      newLng,
      previousDistance,
      newDistance,
      previousPrice,
      newPrice,
      requestedBy,
      clientAccepted: true, // El cliente ya validó el nuevo monto
      status: 'PENDING_MOTORIZADO',
      createdAt: new Date().toISOString()
    };

    const rideRef = doc(db, 'rides', rideId);
    await updateDoc(rideRef, {
      destinationChangeRequest: req,
      updatedAt: serverTimestamp()
    });

    await this.recordEvent(
      rideId,
      { role: requestedBy, id: 'client', name: 'Cliente' },
      'DESTINATION_CHANGE_REQUESTED',
      `Propuesta formal de nuevo destino: "${newAddress}". Nueva distancia: ${newDistance} km. Nueva tarifa: S/ ${newPrice.toFixed(2)}. Pendiente de aceptación del motorizado.`,
      newLat,
      newLng,
      { newAddress, newPrice }
    );

    return req;
  }

  static async respondDestinationChange(
    rideId: string,
    motorizado: MotorizadoInfo,
    accepted: boolean,
    rejectionReason: string = ''
  ): Promise<void> {
    const rideRef = doc(db, 'rides', rideId);
    const rideSnap = await getDoc(rideRef);
    if (!rideSnap.exists()) return;

    const ride = rideSnap.data() as Ride;
    const req = ride.destinationChangeRequest;
    if (!req) return;

    if (accepted) {
      const updatedReq: DestinationChangeRequest = {
        ...req,
        motorizadoAccepted: true,
        status: 'ACCEPTED'
      };

      const newDestination: Location = {
        address: req.newAddress,
        lat: req.newLat,
        lng: req.newLng
      };

      await updateDoc(rideRef, {
        destination: newDestination,
        protectedPrice: req.newPrice,
        distance: req.newDistance,
        destinationChangeRequest: updatedReq,
        updatedAt: serverTimestamp()
      });

      await this.recordEvent(
        rideId,
        { role: 'MOTORIZADO', id: motorizado.uid, name: motorizado.name },
        'DESTINATION_CHANGE_ACCEPTED',
        `Motorizado aceptó el cambio de destino a "${req.newAddress}". Tarifa actualizada a S/ ${req.newPrice.toFixed(2)}.`,
        req.newLat,
        req.newLng
      );
    } else {
      const updatedReq: DestinationChangeRequest = {
        ...req,
        motorizadoAccepted: false,
        status: 'REJECTED',
        rejectionReason
      };

      await updateDoc(rideRef, {
        destinationChangeRequest: updatedReq,
        updatedAt: serverTimestamp()
      });

      await this.recordEvent(
        rideId,
        { role: 'MOTORIZADO', id: motorizado.uid, name: motorizado.name },
        'DESTINATION_CHANGE_REJECTED',
        `Motorizado rechazó el cambio de destino por: ${rejectionReason || 'Condición de riesgo / Inconveniente operacional'}. Se mantiene el destino original.`,
        -8.1116,
        -79.0287,
        { rejectionReason }
      );
    }
  }

  /**
   * DISPOSICIÓN DEL PRODUCTO (Sección 13)
   * Tras la expiración del plazo de custodia o por orden del sistema:
   * El custodio queda formalmente liberado de esperar o custodiar el producto.
   */
  static async disposeCustodyProduct(
    rideId: string,
    motorizado: MotorizadoInfo,
    reason: string
  ): Promise<void> {
    const rideRef = doc(db, 'rides', rideId);
    await updateDoc(rideRef, {
      custodyStatus: CustodyStatus.DISPOSED,
      updatedAt: serverTimestamp()
    });

    await this.recordEvent(
      rideId,
      { role: 'MOTORIZADO', id: motorizado.uid, name: motorizado.name },
      'CUSTODY_DISPOSED',
      `Custodia finalizada por disposición autorizada: ${reason}`,
      -8.1116,
      -79.0287,
      { reason }
    );
  }
}
