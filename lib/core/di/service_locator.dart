import 'package:get_it/get_it.dart';
import '../services/firestore_service.dart';
import '../telemetry/telemetry_service.dart';
import '../audit/enterprise_audit.dart';
import '../../features/pricing/domain/repositories/pricing_repository.dart';
import '../../features/rides/domain/repositories/ride_repository.dart';
import '../../features/rides/domain/repositories/user_repository.dart';
import '../../features/rides/domain/repositories/offer_repository.dart';
import '../../features/rides/domain/repositories/location_repository.dart';
import '../../features/rides/data/repositories/firestore_ride_repository.dart';
import '../../features/rides/data/repositories/firestore_user_repository.dart';
import '../../features/rides/data/repositories/firestore_offer_repository.dart';
import '../../features/rides/data/repositories/location_repository_impl.dart';
import '../../features/rides/domain/usecases/create_ride_usecase.dart';
import '../../features/rides/domain/usecases/cancel_ride_usecase.dart';
import '../../features/rides/domain/usecases/accept_offer_usecase.dart';
import '../../features/rides/domain/usecases/watch_ride_offers_usecase.dart';
import '../../features/rides/domain/usecases/get_user_profile_usecase.dart';
import '../../features/rides/domain/usecases/submit_offer_usecase.dart';
import '../../features/rides/domain/usecases/update_ride_status_usecase.dart';
import '../../features/rides/domain/usecases/watch_available_rides_usecase.dart';
import 'pricing_injection.dart';

final GetIt sl = GetIt.instance;

Future<void> setupServiceLocator() async {
  // ---- Core & Infrastructure Services ----
  if (!sl.isRegistered<TelemetryService>()) {
    sl.registerLazySingleton<TelemetryService>(() => TelemetryService());
  }

  if (!sl.isRegistered<FirestoreService>()) {
    sl.registerLazySingleton<FirestoreService>(() => FirestoreService());
  }

  // ---- Repositories (Desacoplados y de Alta Cohesión) ----
  if (!sl.isRegistered<UserRepository>()) {
    sl.registerLazySingleton<UserRepository>(
      () => FirestoreUserRepository(sl<FirestoreService>(), sl<TelemetryService>()),
    );
  }

  if (!sl.isRegistered<RideRepository>()) {
    sl.registerLazySingleton<RideRepository>(
      () => FirestoreRideRepository(sl<FirestoreService>(), sl<TelemetryService>()),
    );
  }

  if (!sl.isRegistered<OfferRepository>()) {
    sl.registerLazySingleton<OfferRepository>(
      () => FirestoreOfferRepository(sl<FirestoreService>(), sl<TelemetryService>()),
    );
  }

  if (!sl.isRegistered<LocationRepository>()) {
    sl.registerLazySingleton<LocationRepository>(
      () => LocationRepositoryImpl(sl<FirestoreService>()),
    );
  }

  // ---- Casos de Uso (Dominios Específicos) ----
  if (!sl.isRegistered<CreateRideUseCase>()) {
    sl.registerLazySingleton<CreateRideUseCase>(() => CreateRideUseCase(sl<RideRepository>()));
  }

  if (!sl.isRegistered<CancelRideUseCase>()) {
    sl.registerLazySingleton<CancelRideUseCase>(() => CancelRideUseCase(sl<RideRepository>()));
  }

  if (!sl.isRegistered<AcceptOfferUseCase>()) {
    sl.registerLazySingleton<AcceptOfferUseCase>(() => AcceptOfferUseCase(sl<OfferRepository>()));
  }

  if (!sl.isRegistered<WatchRideOffersUseCase>()) {
    sl.registerLazySingleton<WatchRideOffersUseCase>(() => WatchRideOffersUseCase(sl<OfferRepository>()));
  }

  if (!sl.isRegistered<GetUserProfileUseCase>()) {
    sl.registerLazySingleton<GetUserProfileUseCase>(() => GetUserProfileUseCase(sl<UserRepository>()));
  }

  if (!sl.isRegistered<SubmitOfferUseCase>()) {
    sl.registerLazySingleton<SubmitOfferUseCase>(() => SubmitOfferUseCase(sl<OfferRepository>()));
  }

  if (!sl.isRegistered<UpdateRideStatusUseCase>()) {
    sl.registerLazySingleton<UpdateRideStatusUseCase>(() => UpdateRideStatusUseCase(sl<RideRepository>()));
  }

  if (!sl.isRegistered<WatchAvailableRidesUseCase>()) {
    sl.registerLazySingleton<WatchAvailableRidesUseCase>(() => WatchAvailableRidesUseCase(sl<RideRepository>()));
  }

  // ---- Auditoría & Diagnósticos de Producción ----
  if (!sl.isRegistered<EnterpriseAudit>()) {
    sl.registerFactory<EnterpriseAudit>(() => EnterpriseAudit(locator: sl));
  }

  // ---- Pricing Engine Integration ----
  await setupPricingInjection(sl);
}
