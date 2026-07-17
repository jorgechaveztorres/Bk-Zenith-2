import '../repositories/ride_repository.dart';

/// {@template cancel_ride_usecase}
/// Caso de Uso que encapsula la cancelación unilateral o bilateral de un viaje en curso o pendiente.
/// {@endtemplate}
class CancelRideUseCase {
  final RideRepository _repository;

  CancelRideUseCase(this._repository);

  Future<void> execute(String rideId) async {
    await _repository.cancelRide(rideId);
  }
}
