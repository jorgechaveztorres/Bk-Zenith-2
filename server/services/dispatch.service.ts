/**
 * ZÉNITH SERVER-SIDE DISPATCH SERVICE
 * 
 * Orquestador oficial y autoritativo de despacho en Backend.
 * Reemplaza de forma permanente la ejecución cliente en navegador.
 * 
 * Responsabilidades:
 * 1. Evalúa solicitudes en búsqueda de conductor (SEARCHING_DRIVER / REQUESTED).
 * 2. Consulta conductores disponibles y frescos en la misma zona geoacotada (city / gridKey).
 * 3. Selecciona el mejor candidato por proximidad vial/geodésica.
 * 4. Genera la asignación temporal (OFFERED) con expiración estricta de 15 segundos.
 * 5. Registra la auditoría en dispatch_logs con autoridad server-side.
 */

import { db } from '../config/firebase';
import { FieldValue } from 'firebase-admin/firestore';
import { getGeodesicDistance } from './pricing.service';

export interface DispatchCandidate {
  driverId: string;
  driverName?: string;
  lat: number;
  lng: number;
  distanceKm: number;
  rating?: number;
}

export interface DispatchCycleResult {
  dispatched: boolean;
  rideId: string;
  status: string;
  assignedDriverId?: string;
  attemptNumber?: number;
  reason?: string;
}

export class DispatchService {
  /**
   * Ejecuta el ciclo de despacho server-side para una orden específica.
   */
  static async runDispatchCycle(rideId: string): Promise<DispatchCycleResult> {
    if (!db) {
      throw new Error('Servicio de base de datos no disponible.');
    }

    const rideRef = db.collection('rides').doc(rideId);
    const rideSnap = await rideRef.get();

    if (!rideSnap.exists) {
      return { dispatched: false, rideId, status: 'NOT_FOUND', reason: 'Viaje no encontrado' };
    }

    const ride = rideSnap.data()!;

    // Solo despachamos si el viaje está en búsqueda de conductor
    if (ride.status !== 'SEARCHING_DRIVER' && ride.status !== 'REQUESTED') {
      return { dispatched: false, rideId, status: ride.status, reason: 'Viaje no está en estado de búsqueda' };
    }

    // 1. Obtener asignaciones previas para este viaje
    const assignmentsSnap = await db.collection('assignments')
      .where('rideId', '==', rideId)
      .get();

    const existingAssignments: any[] = [];
    assignmentsSnap.forEach(doc => {
      existingAssignments.push(doc.data());
    });

    // Detectar si hay una oferta activa (OFFERED) no expirada
    const now = Date.now();
    const activeAssignment = existingAssignments.find(a => a.status === 'OFFERED');
    if (activeAssignment) {
      const expiresAt = new Date(activeAssignment.expiresAt).getTime();
      if (now <= expiresAt) {
        // Oferta en curso de 15 segundos
        return {
          dispatched: true,
          rideId,
          status: 'OFFERED',
          assignedDriverId: activeAssignment.driverId,
          attemptNumber: activeAssignment.attemptNumber,
          reason: 'Oferta activa en progreso'
        };
      } else {
        // Expiró: marcarla como EXPIRED
        const asgDocRef = db.collection('assignments').doc(activeAssignment.assignmentId);
        await asgDocRef.update({
          status: 'EXPIRED',
          expiredAt: FieldValue.serverTimestamp()
        });
      }
    }

    // 2. Extraer conductores excluidos (rechazaron o expiraron este viaje)
    const excludedDriverIds = existingAssignments
      .filter(a => a.status === 'REJECTED' || a.status === 'EXPIRED' || a.status === 'CANCELLED')
      .map(a => a.driverId);

    // 3. Consultar conductores disponibles en la misma ciudad / cuadrícula
    const city = ride.city || 'Trujillo';
    let queryRef = db.collection('drivers_online')
      .where('status', '==', 'AVAILABLE')
      .where('city', '==', city);

    let onlineSnap = await queryRef.get();

    // Fallback: Si no hay en la ciudad o es zona regional sin ciudad fija, consultar por gridKey
    if (onlineSnap.empty && ride.gridKey) {
      onlineSnap = await db.collection('drivers_online')
        .where('status', '==', 'AVAILABLE')
        .where('gridKey', '==', ride.gridKey)
        .get();
    }

    const availableCandidates: DispatchCandidate[] = [];
    const originLat = ride.origin?.lat ?? 0;
    const originLng = ride.origin?.lng ?? 0;

    onlineSnap.forEach(doc => {
      const d = doc.data();
      if (!excludedDriverIds.includes(d.driverId)) {
        const dist = getGeodesicDistance(originLat, originLng, d.lat, d.lng);
        availableCandidates.push({
          driverId: d.driverId,
          driverName: d.driverName,
          lat: d.lat,
          lng: d.lng,
          distanceKm: dist,
          rating: d.rating || 5.0
        });
      }
    });

    if (availableCandidates.length === 0) {
      // Registrar evento de auditoría
      await db.collection('dispatch_logs').add({
        rideId,
        event: 'NO_DRIVERS_AVAILABLE',
        attemptNumber: existingAssignments.length + 1,
        details: 'No se encontraron conductores AVAILABLE aptos en la zona.',
        createdAt: FieldValue.serverTimestamp()
      });
      return {
        dispatched: false,
        rideId,
        status: 'NO_DRIVERS',
        attemptNumber: existingAssignments.length + 1,
        reason: 'Sin conductores disponibles'
      };
    }

    // 4. Seleccionar el mejor candidato (menor distancia a origen)
    availableCandidates.sort((a, b) => a.distanceKm - b.distanceKm);
    const bestCandidate = availableCandidates[0];

    // 5. Crear la asignación oficial OFFERED (15 segundos)
    const assignmentId = `ASG_${rideId}_${Date.now()}`;
    const expiresAtDate = new Date(now + 15 * 1000).toISOString();

    const assignmentData = {
      assignmentId,
      rideId,
      driverId: bestCandidate.driverId,
      driverName: bestCandidate.driverName || 'Conductor Zénith',
      distanceKm: bestCandidate.distanceKm,
      attemptNumber: existingAssignments.length + 1,
      status: 'OFFERED',
      assignedAt: FieldValue.serverTimestamp(),
      expiresAt: expiresAtDate
    };

    await db.collection('assignments').doc(assignmentId).set(assignmentData);

    // 6. Auditoría inmutable de despacho
    await db.collection('dispatch_logs').add({
      rideId,
      driverId: bestCandidate.driverId,
      assignmentId,
      event: 'ASSIGNMENT_OFFERED',
      attemptNumber: assignmentData.attemptNumber,
      distanceKm: bestCandidate.distanceKm,
      details: `Viaje ofrecido server-side a conductor a ${bestCandidate.distanceKm.toFixed(2)} km`,
      createdAt: FieldValue.serverTimestamp()
    });

    return {
      dispatched: true,
      rideId,
      status: 'OFFERED',
      assignedDriverId: bestCandidate.driverId,
      attemptNumber: assignmentData.attemptNumber
    };
  }
}
