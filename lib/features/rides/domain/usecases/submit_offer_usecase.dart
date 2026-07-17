import '../entities/offer_entity.dart';
import '../repositories/offer_repository.dart';

/// {@template submit_offer_usecase}
/// Caso de Uso que encapsula el envío de una contraoferta económica por parte del operador.
/// {@endtemplate}
class SubmitOfferUseCase {
  final OfferRepository _repository;

  SubmitOfferUseCase(this._repository);

  Future<void> execute(OfferEntity offer) async {
    await _repository.submitOffer(offer);
  }
}

