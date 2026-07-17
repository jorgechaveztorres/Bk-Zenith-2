import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../../../core/services/firestore_service.dart';
import '../../../../core/logging/app_logger.dart';
import '../../../../core/telemetry/telemetry_service.dart';
import '../../domain/repositories/ride_repository.dart';
import '../../domain/entities/ride_entity.dart';
import '../models/ride_model.dart';
import '../models/location_model.dart';

class FirestoreRideRepository implements RideRepository {
  final FirestoreService _firestoreService;
  final TelemetryService _telemetry;

  FirestoreRideRepository(this._firestoreService, this._telemetry);

  @override
  Stream<List<RideEntity>> watchPassengerActiveRides(String passengerId) {
    AppLogger.debug('watchPassengerActiveRides called for passengerId: $passengerId');
    return _firestoreService.watchCollection(
      'rides',
      filters: [
        QueryFilter('passengerId', '==', passengerId),
        QueryFilter('status', 'in', ['pending', 'negotiating', 'accepted', 'in_progress']),
      ],
    ).map((snapshot) {
      return snapshot.map((doc) {
        return RideModel.fromMap(doc.data(), doc.id);
      }).toList();
    }).handleError((e) {
      AppLogger.error('watchPassengerActiveRides stream error for passengerId: $passengerId', error: e);
      _telemetry.trackFirebaseError('watchPassengerActiveRides', e.toString(), e.toString());
    });
  }

  @override
  Stream<List<RideEntity>> watchDriverActiveRides(String driverId) {
    AppLogger.debug('watchDriverActiveRides called for driverId: $driverId');
    return _firestoreService.watchCollection(
      'rides',
      filters: [
        QueryFilter('driverId', '==', driverId),
        QueryFilter('status', 'in', ['accepted', 'in_progress']),
      ],
    ).map((snapshot) {
      return snapshot.map((doc) {
        return RideModel.fromMap(doc.data(), doc.id);
      }).toList();
    }).handleError((e) {
      AppLogger.error('watchDriverActiveRides stream error for driverId: $driverId', error: e);
      _telemetry.trackFirebaseError('watchDriverActiveRides', e.toString(), e.toString());
    });
  }

  @override
  Stream<List<RideEntity>> watchAvailableRides() {
    AppLogger.debug('watchAvailableRides stream requested');
    return _firestoreService.watchCollection(
      'rides',
      filters: [
        QueryFilter('status', 'in', ['pending', 'negotiating']),
      ],
    ).map((snapshot) {
      return snapshot.map((doc) {
        return RideModel.fromMap(doc.data(), doc.id);
      }).toList();
    }).handleError((e) {
      AppLogger.error('watchAvailableRides stream error', error: e);
      _telemetry.trackFirebaseError('watchAvailableRides', e.toString(), e.toString());
    });
  }

  @override
  Future<String> createRide(RideEntity ride) async {
    final startTime = DateTime.now();
    try {
      AppLogger.debug('createRide called by passengerId: ${ride.passengerId}');
      
      final model = RideModel(
        id: '',
        passengerId: ride.passengerId,
        passengerName: ride.passengerName,
        driverId: ride.driverId,
        driverName: ride.driverName,
        origin: LocationModel.fromDomain(ride.origin),
        destination: LocationModel.fromDomain(ride.destination),
        suggestedPrice: ride.suggestedPrice,
        finalPrice: ride.finalPrice,
        status: ride.status,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      );
      
      final ref = await _firestoreService.addDocument('rides', model.toMap());
      final latencyMs = DateTime.now().difference(startTime).inMilliseconds.toDouble();
      
      _telemetry.trackRideCreation(ref.id, ride.passengerId, ride.suggestedPrice);
      _telemetry.trackTransaction(ref.id, 'createRide', 'success', latencyMs);
      
      return ref.id;
    } catch (e) {
      AppLogger.error('createRide failed', error: e);
      _telemetry.trackFirebaseError('createRide', e.toString(), e.toString());
      rethrow;
    }
  }

  @override
  Future<void> updateRideStatus(String rideId, String status) async {
    final startTime = DateTime.now();
    try {
      AppLogger.debug('updateRideStatus to $status for rideId: $rideId');
      
      await _firestoreService.runTransaction((transaction) async {
        final FirebaseFirestore firestoreInstance = FirebaseFirestore.instance;
        final rideDocRef = firestoreInstance.collection('rides').doc(rideId);
        
        final rideSnap = await transaction.get(rideDocRef);
        if (!rideSnap.exists) {
          throw Exception('El viaje solicitado no existe.');
        }

        transaction.update(rideDocRef, {
          'status': status,
          'updatedAt': FieldValue.serverTimestamp(),
        });
      });
      
      final latencyMs = DateTime.now().difference(startTime).inMilliseconds.toDouble();
      _telemetry.trackTransaction(rideId, 'updateRideStatus_$status', 'success', latencyMs);
    } catch (e) {
      AppLogger.error('updateRideStatus to $status failed for rideId: $rideId', error: e);
      _telemetry.trackFirebaseError('updateRideStatus', e.toString(), e.toString());
      rethrow;
    }
  }

  @override
  Future<void> cancelRide(String rideId) async {
    final startTime = DateTime.now();
    try {
      AppLogger.debug('cancelRide called for rideId: $rideId');
      
      await _firestoreService.runTransaction((transaction) async {
        final FirebaseFirestore firestoreInstance = FirebaseFirestore.instance;
        final rideDocRef = firestoreInstance.collection('rides').doc(rideId);

        final rideSnap = await transaction.get(rideDocRef);
        if (!rideSnap.exists) {
          throw Exception('El viaje solicitado no existe.');
        }

        transaction.update(rideDocRef, {
          'status': 'cancelled',
          'updatedAt': FieldValue.serverTimestamp(),
        });
      });
      
      final latencyMs = DateTime.now().difference(startTime).inMilliseconds.toDouble();
      _telemetry.trackTransaction(rideId, 'cancelRide', 'success', latencyMs);
    } catch (e) {
      AppLogger.error('cancelRide failed for rideId: $rideId', error: e);
      _telemetry.trackFirebaseError('cancelRide', e.toString(), e.toString());
      rethrow;
    }
  }
}
