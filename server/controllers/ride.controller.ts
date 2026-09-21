import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { RideService } from '../services/ride.service';

export const requestRide = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { rideData } = req.body;
    
    // The passenger must be the one authenticated
    if (rideData.passengerId !== userId) {
      return res.status(403).json({ success: false, message: 'ID de pasajero no coincide con la autenticación.' });
    }

    const ride = await RideService.requestRide(rideData);
    return res.status(201).json({ success: true, ride });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const acceptRide = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const driverId = req.user!.uid;
    const { rideId } = req.params;
    const { driverLocation, driverName } = req.body;

    const ride = await RideService.acceptRide(rideId, driverId, driverName, driverLocation);
    return res.status(200).json({ success: true, ride });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const cancelRide = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { rideId } = req.params;

    await RideService.cancelRide(rideId, userId);
    return res.status(200).json({ success: true, message: 'Viaje cancelado exitosamente.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateRideStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const driverId = req.user!.uid;
    const { rideId } = req.params;
    const { status } = req.body;

    await RideService.updateRideStatus(rideId, driverId, status);
    return res.status(200).json({ success: true, message: 'Estado actualizado.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
