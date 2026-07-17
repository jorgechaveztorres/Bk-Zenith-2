/// ============================================================================
/// ZENITH
/// Module : Pricing
/// Layer  : Domain
/// Type   : UseCase
/// File   : calculate_pricing_usecase.dart
/// ============================================================================

import '../entities/pricing_request.dart';
import '../entities/pricing_response.dart';
import '../repositories/pricing_repository.dart';

/// {@template calculate_pricing_usecase}
/// Caso de uso central para el cálculo y cotización de precios de viajes.
///
/// **Objetivo:** Orquestar el flujo de ejecución del dominio para la cotización de tarifas de ZÉNITH.
/// **Responsabilidad:** Servir como el único punto de entrada oficial para solicitar cálculos tarifarios.
/// **Dependencias:** [PricingRepository], [PricingRequest], [PricingResponse]
/// **Restricciones:** Totalmente desacoplado de la UI (Bloc) y de la infraestructura (Firebase/Mappers).
/// **Ejemplo de uso:**
/// ```dart
/// final useCase = CalculatePricingUseCase(repository);
/// final response = await useCase(request);
/// ```
/// {@endtemplate}
class CalculatePricingUseCase {
  /// {@macro calculate_pricing_usecase}
  const CalculatePricingUseCase(this._repository);

  final PricingRepository _repository;

  /// Ejecuta el caso de uso con la solicitud provista.
  Future<PricingResponse> call(PricingRequest request) {
    return _repository.calculatePricing(request);
  }
}
