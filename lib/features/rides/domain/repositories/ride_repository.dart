import '../entities/ride_entity.dart';

abstract class RideRepository {
  Stream<List<RideEntity>> watchPassengerActiveRides(String passengerId);
  Stream<List<RideEntity>> watchDriverActiveRides(String driverId);
  Stream<List<RideEntity>> watchAvailableRides();
  Future<String> createRide(RideEntity ride);
  Future<void> updateRideStatus(String rideId, String status);
  Future<void> cancelRide(String rideId);
}

