import { db } from '../config/firebase';
import { FieldValue } from 'firebase-admin/firestore';
import { PricingEngine } from './pricing.service';

export class RideService {
  static async requestRide(rideData: any) {
    if (!db) throw new Error("Base de datos no disponible.");

    // Validate price on backend securely
    const backendPrice = await PricingEngine.calculateProtectedPrice({
      distanceKm: rideData.distance,
      estimatedMinutes: rideData.duration,
      isHighRiskZone: rideData.isHighRiskZone,
      isPeakHour: rideData.isPeakHour
    });

    const newRideRef = db.collection('rides').doc();
    
    const finalRideData = {
      ...rideData,
      id: newRideRef.id,
      status: 'SEARCHING',
      price: backendPrice.finalPrice,
      priceBreakdown: backendPrice,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    await newRideRef.set(finalRideData);
    return finalRideData;
  }

  static async acceptRide(rideId: string, driverId: string, driverName: string, driverLocation: any) {
    if (!db) throw new Error("Base de datos no disponible.");

    const rideRef = db.collection('rides').doc(rideId);
    
    return await db.runTransaction(async (transaction) => {
      const rideDoc = await transaction.get(rideRef);
      if (!rideDoc.exists) throw new Error("Viaje no encontrado.");
      
      const ride = rideDoc.data();
      if (ride?.status !== 'SEARCHING') {
        throw new Error("El viaje ya no está disponible.");
      }

      const updateData = {
        status: 'ACCEPTED',
        driverId,
        driverName,
        driverLocation,
        updatedAt: FieldValue.serverTimestamp()
      };

      transaction.update(rideRef, updateData);
      
      return { ...ride, ...updateData };
    });
  }

  static async cancelRide(rideId: string, userId: string) {
    if (!db) throw new Error("Base de datos no disponible.");

    const rideRef = db.collection('rides').doc(rideId);
    
    return await db.runTransaction(async (transaction) => {
      const rideDoc = await transaction.get(rideRef);
      if (!rideDoc.exists) throw new Error("Viaje no encontrado.");
      
      const ride = rideDoc.data();
      
      // Zero-Trust: Only passenger or driver can cancel
      if (ride?.passengerId !== userId && ride?.driverId !== userId) {
        throw new Error("No tienes permiso para cancelar este viaje.");
      }

      if (['COMPLETED', 'CANCELLED'].includes(ride?.status)) {
        throw new Error("El viaje ya ha finalizado.");
      }

      transaction.update(rideRef, {
        status: 'CANCELLED',
        cancelledBy: userId,
        updatedAt: FieldValue.serverTimestamp()
      });
    });
  }

  static async updateRideStatus(rideId: string, driverId: string, status: string) {
    if (!db) throw new Error("Base de datos no disponible.");

    const validStatuses = ['ARRIVED', 'IN_PROGRESS', 'COMPLETED'];
    if (!validStatuses.includes(status)) {
      throw new Error("Estado inválido.");
    }

    const rideRef = db.collection('rides').doc(rideId);
    
    return await db.runTransaction(async (transaction) => {
      const rideDoc = await transaction.get(rideRef);
      if (!rideDoc.exists) throw new Error("Viaje no encontrado.");
      
      const ride = rideDoc.data();
      
      // Zero-Trust: Only the assigned driver can update status
      if (ride?.driverId !== driverId) {
        throw new Error("No tienes permiso para actualizar este viaje.");
      }

      transaction.update(rideRef, {
        status,
        updatedAt: FieldValue.serverTimestamp()
      });
    });
  }
}
