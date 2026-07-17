import '../repositories/ride_repository.dart';

/// {@template update_ride_status_usecase}
/// Caso de Uso que encapsula las transiciones de estado de un viaje (en tránsito, completado, etc.).
/// {@endtemplate}
class UpdateRideStatusUseCase {
  final RideRepository _repository;

  UpdateRideStatusUseCase(this._repository);

  Future<void> execute(String rideId, String status) async {
    await _repository.updateRideStatus(rideId, status);
  }
}
