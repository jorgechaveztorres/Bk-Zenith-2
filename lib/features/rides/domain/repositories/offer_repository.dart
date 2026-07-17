import '../entities/offer_entity.dart';

abstract class OfferRepository {
  Stream<List<OfferEntity>> watchRideOffers(String rideId);
  Future<void> submitOffer(OfferEntity offer);
  Future<void> acceptOffer(String rideId, OfferEntity offer);
}
