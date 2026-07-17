import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../../../core/services/firestore_service.dart';
import '../../../../core/logging/app_logger.dart';
import '../../../../core/telemetry/telemetry_service.dart';
import '../../domain/entities/offer_entity.dart';
import '../../domain/repositories/offer_repository.dart';
import '../models/offer_model.dart';

class FirestoreOfferRepository implements OfferRepository {
  final FirestoreService _firestoreService;
  final TelemetryService _telemetry;

  FirestoreOfferRepository(this._firestoreService, this._telemetry);

  @override
  Stream<List<OfferEntity>> watchRideOffers(String rideId) {
    AppLogger.debug('watchRideOffers active for rideId: $rideId');
    return _firestoreService.watchSubcollection('rides', rideId, 'offers')
        .map((snapshot) {
      return snapshot.map((doc) {
        return OfferModel.fromMap(doc.data(), doc.id);
      }).toList();
    }).handleError((e) {
      AppLogger.error('watchRideOffers stream error for rideId: $rideId', error: e);
      _telemetry.trackFirebaseError('watchRideOffers', e.toString(), e.toString());
    });
  }

  @override
  Future<void> submitOffer(OfferEntity offer) async {
    final startTime = DateTime.now();
    try {
      AppLogger.debug('submitOffer for rideId: ${offer.rideId} by driver: ${offer.driverId}');
      
      final batch = _firestoreService.batch();
      final FirebaseFirestore firestoreInstance = FirebaseFirestore.instance;

      final model = OfferModel(
        id: offer.id,
        rideId: offer.rideId,
        driverId: offer.driverId,
        driverName: offer.driverName,
        driverRating: offer.driverRating,
        price: offer.price,
        status: offer.status,
        createdAt: FieldValue.serverTimestamp(),
      );

      final offerDocRef = firestoreInstance
          .collection('rides')
          .doc(offer.rideId)
          .collection('offers')
          .doc(offer.id);

      final rideDocRef = firestoreInstance.collection('rides').doc(offer.rideId);

      batch.set(offerDocRef, model.toMap(), SetOptions(merge: true));
      batch.update(rideDocRef, {
        'status': 'negotiating',
        'updatedAt': FieldValue.serverTimestamp(),
      });

      await batch.commit();
      
      final latencyMs = DateTime.now().difference(startTime).inMilliseconds.toDouble();
      _telemetry.trackOfferSubmission(offer.id, offer.rideId, offer.driverId, offer.price);
      _telemetry.trackTransaction(offer.id, 'submitOffer', 'success', latencyMs);
    } catch (e) {
      AppLogger.error('submitOffer failed for rideId: ${offer.rideId}', error: e);
      _telemetry.trackFirebaseError('submitOffer', e.toString(), e.toString());
      rethrow;
    }
  }

  @override
  Future<void> acceptOffer(String rideId, OfferEntity offer) async {
    final startTime = DateTime.now();
    try {
      AppLogger.debug('acceptOffer for rideId: $rideId, offerId: ${offer.id}');
      
      await _firestoreService.runTransaction((transaction) async {
        final FirebaseFirestore firestoreInstance = FirebaseFirestore.instance;

        final rideDocRef = firestoreInstance.collection('rides').doc(rideId);
        final offerDocRef = firestoreInstance
            .collection('rides')
            .doc(rideId)
            .collection('offers')
            .doc(offer.id);

        final rideSnap = await transaction.get(rideDocRef);
        if (!rideSnap.exists) {
          throw Exception('El viaje solicitado no existe en la bitácora.');
        }

        final rideData = rideSnap.data()!;
        final currentStatus = rideData['status'];

        if (currentStatus != 'pending' && currentStatus != 'negotiating') {
          throw Exception('Este servicio ya ha sido tomado por otro operador.');
        }

        transaction.update(offerDocRef, {'status': 'accepted'});

        transaction.update(rideDocRef, {
          'status': 'accepted',
          'driverId': offer.driverId,
          'driverName': offer.driverName,
          'finalPrice': offer.price,
          'updatedAt': FieldValue.serverTimestamp(),
        });
      });
      
      final latencyMs = DateTime.now().difference(startTime).inMilliseconds.toDouble();
      _telemetry.trackOfferAcceptance(rideId, offer.id, offer.driverId, offer.price);
      _telemetry.trackTransaction(offer.id, 'acceptOffer', 'success', latencyMs);
    } catch (e) {
      AppLogger.error('acceptOffer failed for rideId: $rideId', error: e);
      _telemetry.trackFirebaseError('acceptOffer', e.toString(), e.toString());
      rethrow;
    }
  }
}
