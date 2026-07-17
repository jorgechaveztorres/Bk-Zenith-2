/// ============================================================================
/// ZENITH
/// Module : Core
/// Layer  : DI
/// Type   : PricingInjection
/// File   : pricing_injection.dart
/// ============================================================================

import 'package:cloud_functions/cloud_functions.dart';
import 'package:get_it/get_it.dart';
import '../../features/pricing/data/datasources/pricing_remote_datasource.dart';
import '../../features/pricing/data/datasources/pricing_remote_datasource_impl.dart';
import '../../features/pricing/data/repositories/pricing_repository_impl.dart';
import '../../features/pricing/domain/repositories/pricing_repository.dart';
import '../../features/pricing/domain/usecases/calculate_pricing_usecase.dart';
import '../../features/pricing/presentation/bloc/pricing_bloc.dart';

/// {@template pricing_injection}
/// Configuración de inyección de dependencias para el módulo de Pricing de ZÉNITH.
///
/// **Objetivo:** Registrar de forma limpia y desacoplada los componentes del Zenith Pricing Engine™.
/// **Responsabilidad:** Registrar el DataSource, Repository, UseCase y Bloc en el contenedor GetIt de forma determinista.
/// **Restricciones:** Cumple con la Inversión de Dependencias (Dependency Inversion). Las capas externas dependen de abstracciones de dominio.
/// **Ejemplo de uso:**
/// ```dart
/// await setupPricingInjection(sl);
/// ```
/// {@endtemplate}
Future<void> setupPricingInjection(GetIt sl) async {
  // ---- Firebase Services ----
  if (!sl.isRegistered<FirebaseFunctions>()) {
    sl.registerLazySingleton<FirebaseFunctions>(() => FirebaseFunctions.instance);
  }

  // ---- DataSources (Fuentes de Datos) ----
  sl.registerLazySingleton<PricingRemoteDataSource>(
    () => PricingRemoteDataSourceImpl(
      firebaseFunctions: sl<FirebaseFunctions>(),
    ),
  );

  // ---- Repositories (Repositorios) ----
  sl.registerLazySingleton<PricingRepository>(
    () => PricingRepositoryImpl(sl<PricingRemoteDataSource>()),
  );

  // ---- UseCases (Casos de Uso) ----
  sl.registerLazySingleton<CalculatePricingUseCase>(
    () => CalculatePricingUseCase(sl<PricingRepository>()),
  );

  // ---- Blocs (Manejadores de Estado) ----
  sl.registerFactory<PricingBloc>(
    () => PricingBloc(sl<CalculatePricingUseCase>()),
  );
}
