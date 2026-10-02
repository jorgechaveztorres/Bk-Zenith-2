import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { RideService } from '../services/ride.service';

export const requestRide = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.uid;
    // Soporta payload directo o anidado en rideData
    const payload = req.body.quote ? req.body : (req.body.rideData || req.body);
    
    // Inyectar o validar passengerId con el token autenticado
    if (!payload.passengerId) {
      payload.passengerId = userId;
    }

    if (payload.passengerId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Violación de identidad Zero-Trust: passengerId no coincide con el token de autenticación.'
      });
    }

    const ride = await RideService.requestRide(payload, userId);
    const statusCode = ride._idempotent ? 200 : 201;
    return res.status(statusCode).json({
      success: true,
      rideId: ride.id,
      ride
    });
  } catch (error: any) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Error interno al procesar solicitud de viaje.'
    });
  }
};

export const acceptRide = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const driverId = req.user!.uid;
    const { rideId } = req.params;
    const { driverLocation, driverName } = req.body;

    const ride = await RideService.acceptRide(rideId, driverId, driverName, driverLocation);
    const statusCode = ride._idempotent ? 200 : 200;
    return res.status(statusCode).json({ success: true, ride });
  } catch (error: any) {
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message || 'Error al aceptar viaje.' });
  }
};

export const cancelRide = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { rideId } = req.params;

    await RideService.cancelRide(rideId, userId);
    return res.status(200).json({ success: true, message: 'Viaje cancelado exitosamente.' });
  } catch (error: any) {
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message || 'Error al cancelar viaje.' });
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
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message || 'Error al actualizar estado.' });
  }
};

export const verifyOtp = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const driverId = req.user!.uid;
    const { rideId } = req.params;
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({ success: false, message: 'Debe proporcionar el código OTP de seguridad.' });
    }

    const result = await RideService.verifyOtp(rideId, driverId, otp);
    return res.status(200).json(result);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message || 'Error al validar código OTP.' });
  }
};

export const getPassengerOtp = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const passengerId = req.user!.uid;
    const { rideId } = req.params;

    const result = await RideService.getPassengerOtp(rideId, passengerId);
    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message || 'Error al consultar código OTP.' });
  }
};
