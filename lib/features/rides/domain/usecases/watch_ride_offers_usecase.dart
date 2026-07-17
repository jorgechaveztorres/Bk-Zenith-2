import '../entities/offer_entity.dart';
import '../repositories/offer_repository.dart';

/// {@template watch_ride_offers_usecase}
/// Caso de Uso que transmite un flujo reactivo (Stream) con las ofertas entrantes para un viaje específico.
/// {@endtemplate}
class WatchRideOffersUseCase {
  final OfferRepository _repository;

  WatchRideOffersUseCase(this._repository);

  Stream<List<OfferEntity>> execute(String rideId) {
    return _repository.watchRideOffers(rideId);
  }
}

