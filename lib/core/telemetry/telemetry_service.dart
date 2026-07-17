import '../logging/app_logger.dart';

class TelemetryService {
  final List<Map<String, dynamic>> _metricsLedger = [];

  void trackMetric({
    required String category,
    required String action,
    required Map<String, dynamic> metadata,
    double? value,
  }) {
    final timestamp = DateTime.now().toUtc();
    final metric = {
      'timestamp': timestamp.toIso8601String(),
      'category': category,
      'action': action,
      'value': value,
      'metadata': metadata,
    };
    
    _metricsLedger.add(metric);
    
    AppLogger.debug('Telemetry Recorded | Category: $category | Action: $action | Value: $value | Metadata: $metadata');
  }

  List<Map<String, dynamic>> getMetrics() => List.unmodifiable(_metricsLedger);

  void clearMetrics() => _metricsLedger.clear();

  void trackRideCreation(String rideId, String passengerId, double suggestedPrice) {
    trackMetric(
      category: 'Ride',
      action: 'Create',
      value: suggestedPrice,
      metadata: {'rideId': rideId, 'passengerId': passengerId},
    );
  }

  void trackOfferSubmission(String offerId, String rideId, String driverId, double price) {
    trackMetric(
      category: 'Offer',
      action: 'Submit',
      value: price,
      metadata: {'offerId': offerId, 'rideId': rideId, 'driverId': driverId},
    );
  }

  void trackOfferAcceptance(String rideId, String offerId, String driverId, double finalPrice) {
    trackMetric(
      category: 'Offer',
      action: 'Accept',
      value: finalPrice,
      metadata: {'rideId': rideId, 'offerId': offerId, 'driverId': driverId},
    );
  }

  void trackPricingCalculation({
    required String quoteId,
    required double basePrice,
    required double finalPrice,
    required double distance,
    required double duration,
    required double latencyMs,
  }) {
    trackMetric(
      category: 'Pricing',
      action: 'Calculate',
      value: finalPrice,
      metadata: {
        'quoteId': quoteId,
        'basePrice': basePrice,
        'distanceKm': distance,
        'durationMin': duration,
        'latencyMs': latencyMs,
      },
    );
  }

  void trackTransaction(String id, String type, String status, double latencyMs) {
    trackMetric(
      category: 'Transaction',
      action: type,
      value: latencyMs,
      metadata: {'transactionId': id, 'status': status},
    );
  }

  void trackFirebaseError(String operation, String code, String message) {
    trackMetric(
      category: 'Error',
      action: 'Firebase',
      metadata: {'operation': operation, 'code': code, 'message': message},
    );
  }
}
