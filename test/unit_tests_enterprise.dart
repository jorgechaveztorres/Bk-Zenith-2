import 'package:equatable/equatable.dart';
import '../lib/core/telemetry/telemetry_service.dart';
import '../lib/features/rides/domain/entities/ride_entity.dart';
import '../lib/features/rides/domain/entities/location_entity.dart';
import '../lib/features/rides/domain/entities/offer_entity.dart';
import '../lib/features/rides/domain/repositories/ride_repository.dart';
import '../lib/features/rides/domain/repositories/offer_repository.dart';
import '../lib/features/rides/domain/usecases/create_ride_usecase.dart';
import '../lib/features/rides/domain/usecases/accept_offer_usecase.dart';
import '../lib/features/pricing/domain/repositories/pricing_repository.dart';
import '../lib/features/pricing/domain/usecases/calculate_pricing_usecase.dart';
import '../lib/features/pricing/domain/entities/pricing_request.dart';
import '../lib/features/pricing/domain/entities/pricing_response.dart';
import '../lib/features/pricing/domain/value_objects/index.dart';

// -----------------------------------------------------------------------------
// MOCK IMPLEMENTATIONS FOR CLEAN ENTERPRISE TESTING
// -----------------------------------------------------------------------------

class MockRideRepository implements RideRepository {
  final List<RideEntity> savedRides = [];
  bool shouldThrowError = false;

  @override
  Future<String> createRide(RideEntity ride) async {
    if (shouldThrowError) {
      throw Exception('Firebase Database is unavailable.');
    }
    savedRides.add(ride);
    return 'ride_test_123';
  }

  @override
  Stream<List<RideEntity>> watchPassengerActiveRides(String passengerId) => Stream.value([]);

  @override
  Stream<List<RideEntity>> watchDriverActiveRides(String driverId) => Stream.value([]);

  @override
  Stream<List<RideEntity>> watchAvailableRides() => Stream.value([]);

  @override
  Future<void> updateRideStatus(String rideId, String status) async {}

  @override
  Future<void> cancelRide(String rideId) async {}
}

class MockOfferRepository implements OfferRepository {
  final List<OfferEntity> submittedOffers = [];
  bool offerAccepted = false;
  bool shouldThrowError = false;

  @override
  Future<void> submitOffer(OfferEntity offer) async {
    submittedOffers.add(offer);
  }

  @override
  Future<void> acceptOffer(String rideId, OfferEntity offer) async {
    if (shouldThrowError) {
      throw Exception('Precondition failed: Already accepted.');
    }
    offerAccepted = true;
  }

  @override
  Stream<List<OfferEntity>> watchRideOffers(String rideId) => Stream.value([]);
}

class MockPricingRepository implements PricingRepository {
  bool shouldThrowError = false;

  @override
  Future<PricingResponse> calculatePricing(PricingRequest request) async {
    if (shouldThrowError) {
      throw Exception('Pricing Engine timeout.');
    }
    return PricingResponse(
      quoteId: request.quoteId,
      auditId: 'AUDIT_999',
      protectedPrice: Money(18.5),
      basePrice: Money(5.0),
      distancePrice: Money(8.0),
      durationPrice: Money(3.0),
      cityMultiplier: Multiplier(1.1),
      timeProfileMultiplier: Multiplier(1.0),
      currency: Currency.USD,
      confidenceScore: Percentage(0.98),
      confidenceLevel: ConfidenceLevel.high,
      riskLevel: RiskLevel.low,
      fairnessIndex: Percentage(1.0),
      pricingSeal: PricingSeal('MOCK_SIGNATURE'),
      pricingEngineVersion: 'v2.1',
      pipelineVersion: 'PL_3',
      pricingFormulaVersion: 'F_12',
      pricingConfigurationVersion: 'C_5',
      isProtected: true,
      expiresAt: DateTime.now().add(const Duration(minutes: 15)),
      generatedAt: DateTime.now(),
      extensions: PricingExtensions.empty(),
    );
  }
}

// -----------------------------------------------------------------------------
// MAIN TEST HARNESS EXECUTION
// -----------------------------------------------------------------------------

void main() async {
  print('\x1B[35m====================================================================\x1B[0m');
  print('\x1B[35m  ZÉNITH MASTER SPRINT 004 - ENTERPRISE TEST SUITE EXECUTION\x1B[0m');
  print('\x1B[35m====================================================================\x1B[0m');

  await testCreateRideUseCaseSuccess();
  await testCreateRideUseCaseFirebaseError();
  await testAcceptOfferUseCaseSuccess();
  await testAcceptOfferUseCasePreconditionError();
  await testCalculatePricingUseCaseSuccess();
  await testCalculatePricingUseCaseTimeout();

  print('\x1B[32m\n====================================================================\x1B[0m');
  print('\x1B[32m  ALL ENTERPRISE UNIT TESTS COMPLETED SUCCESSFULLY [PASS]\x1B[0m');
  print('\x1B[32m====================================================================\x1B[0m');
}

Future<void> testCreateRideUseCaseSuccess() async {
  final repository = MockRideRepository();
  final usecase = CreateRideUseCase(repository);

  final ride = RideEntity(
    id: '',
    passengerId: 'user_01',
    passengerName: 'Jane Doe',
    origin: const LocationEntity(address: 'A', lat: 10.0, lng: 20.0),
    destination: const LocationEntity(address: 'B', lat: 10.1, lng: 20.1),
    suggestedPrice: 15.0,
    status: 'pending',
  );

  final resultId = await usecase.execute(ride);

  if (resultId == 'ride_test_123' && repository.savedRides.length == 1) {
    print('\x1B[32m[PASS] CreateRideUseCase - Success path verified.\x1B[0m');
  } else {
    throw Exception('CreateRideUseCase failed: incorrect ID or ride not saved.');
  }
}

Future<void> testCreateRideUseCaseFirebaseError() async {
  final repository = MockRideRepository()..shouldThrowError = true;
  final usecase = CreateRideUseCase(repository);

  final ride = RideEntity(
    id: '',
    passengerId: 'user_01',
    passengerName: 'Jane Doe',
    origin: const LocationEntity(address: 'A', lat: 10.0, lng: 20.0),
    destination: const LocationEntity(address: 'B', lat: 10.1, lng: 20.1),
    suggestedPrice: 15.0,
    status: 'pending',
  );

  try {
    await usecase.execute(ride);
    throw Exception('Expected error was not thrown.');
  } catch (e) {
    if (e.toString().contains('Firebase Database is unavailable.')) {
      print('\x1B[32m[PASS] CreateRideUseCase - Error path verified.\x1B[0m');
    } else {
      rethrow;
    }
  }
}

Future<void> testAcceptOfferUseCaseSuccess() async {
  final repository = MockOfferRepository();
  final usecase = AcceptOfferUseCase(repository);

  const offer = OfferEntity(
    id: 'offer_99',
    rideId: 'ride_111',
    driverId: 'driver_01',
    driverName: 'Sandro',
    driverRating: 4.9,
    price: 18.0,
    status: 'pending',
  );

  await usecase.execute('ride_111', offer);

  if (repository.offerAccepted) {
    print('\x1B[32m[PASS] AcceptOfferUseCase - Success path verified.\x1B[0m');
  } else {
    throw Exception('AcceptOfferUseCase failed: offer not marked as accepted.');
  }
}

Future<void> testAcceptOfferUseCasePreconditionError() async {
  final repository = MockOfferRepository()..shouldThrowError = true;
  final usecase = AcceptOfferUseCase(repository);

  const offer = OfferEntity(
    id: 'offer_99',
    rideId: 'ride_111',
    driverId: 'driver_01',
    driverName: 'Sandro',
    driverRating: 4.9,
    price: 18.0,
    status: 'pending',
  );

  try {
    await usecase.execute('ride_111', offer);
    throw Exception('Expected error was not thrown.');
  } catch (e) {
    if (e.toString().contains('Precondition failed: Already accepted.')) {
      print('\x1B[32m[PASS] AcceptOfferUseCase - Error path verified.\x1B[0m');
    } else {
      rethrow;
    }
  }
}

Future<void> testCalculatePricingUseCaseSuccess() async {
  final repository = MockPricingRepository();
  final usecase = CalculatePricingUseCase(repository);

  final request = PricingRequest(
    quoteId: 'Q_999',
    originLocation: PricingLocation(latitude: -8.111, longitude: -79.028),
    destinationLocation: PricingLocation(latitude: -8.121, longitude: -79.018),
    distance: Distance(5.0),
    duration: Duration(12.0),
    cityId: CityId.PE_TRUJILLO,
    serviceType: ServiceType.standard,
    requestedAt: DateTime.now(),
    extensions: PricingExtensions.empty(),
  );

  final response = await usecase(request);

  if (response.quoteId == 'Q_999' && response.protectedPrice.amount == 18.5) {
    print('\x1B[32m[PASS] CalculatePricingUseCase - Success path verified.\x1B[0m');
  } else {
    throw Exception('CalculatePricingUseCase failed: incorrect pricing results.');
  }
}

Future<void> testCalculatePricingUseCaseTimeout() async {
  final repository = MockPricingRepository()..shouldThrowError = true;
  final usecase = CalculatePricingUseCase(repository);

  final request = PricingRequest(
    quoteId: 'Q_999',
    originLocation: PricingLocation(latitude: -8.111, longitude: -79.028),
    destinationLocation: PricingLocation(latitude: -8.121, longitude: -79.018),
    distance: Distance(5.0),
    duration: Duration(12.0),
    cityId: CityId.PE_TRUJILLO,
    serviceType: ServiceType.standard,
    requestedAt: DateTime.now(),
    extensions: PricingExtensions.empty(),
  );

  try {
    await usecase(request);
    throw Exception('Expected error was not thrown.');
  } catch (e) {
    if (e.toString().contains('Pricing Engine timeout.')) {
      print('\x1B[32m[PASS] CalculatePricingUseCase - Error path (timeout) verified.\x1B[0m');
    } else {
      rethrow;
    }
  }
}
