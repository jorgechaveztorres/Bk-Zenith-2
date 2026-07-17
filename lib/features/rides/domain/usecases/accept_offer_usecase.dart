import '../entities/offer_entity.dart';
import '../repositories/offer_repository.dart';

/// {@template accept_offer_usecase}
/// Caso de Uso que encapsula la aceptación de una oferta específica y consolidación del trato.
/// {@endtemplate}
class AcceptOfferUseCase {
  final OfferRepository _repository;

  AcceptOfferUseCase(this._repository);

  Future<void> execute(String rideId, OfferEntity offer) async {
    await _repository.acceptOffer(rideId, offer);
  }
}

