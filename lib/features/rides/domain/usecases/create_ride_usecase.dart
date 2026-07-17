import '../entities/ride_entity.dart';
import '../repositories/ride_repository.dart';

/// {@template create_ride_usecase}
/// Caso de Uso que encapsula la publicación inicial de un viaje propuesto por el cliente.
///
/// **Objetivo:** Cumplir con la arquitectura limpia separando el disparador visual del guardado.
/// **Responsabilidad:** Invocar el método createRide del repositorio e informar el identificador autogenerado.
/// {@endtemplate}
class CreateRideUseCase {
  final RideRepository _repository;

  CreateRideUseCase(this._repository);

  Future<String> execute(RideEntity ride) async {
    return await _repository.createRide(ride);
  }
}
