import '../entities/ride_entity.dart';
import '../repositories/ride_repository.dart';

/// {@template watch_available_rides_usecase}
/// Caso de Uso que transmite un flujo reactivo (Stream) con todas las solicitudes de viaje pendientes de despacho.
/// {@endtemplate}
class WatchAvailableRidesUseCase {
  final RideRepository _repository;

  WatchAvailableRidesUseCase(this._repository);

  Stream<List<RideEntity>> execute() {
    return _repository.watchAvailableRides();
  }
}
