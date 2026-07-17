/// ============================================================================
/// ZENITH
/// Module : Pricing
/// Layer  : Domain
/// Type   : Repository
/// File   : pricing_repository.dart
/// ============================================================================

import '../entities/pricing_request.dart';
import '../entities/pricing_response.dart';

/// {@template pricing_repository}
/// Interfaz y contrato formal del repositorio para el Zenith Pricing Engine™.
///
/// **Objetivo:** Definir el canal oficial para la obtención de cotizaciones firmadas sin conocer la infraestructura de transporte.
/// **Responsabilidad:** Abstraer las llamadas de red, Firestore o Cloud Functions del dominio puro.
/// **Dependencias:** [PricingRequest], [PricingResponse]
/// **Restricciones:** No contiene lógica de implementación.
/// **Ejemplo de uso:** `final response = await repository.calculatePricing(request);`
/// {@endtemplate}
abstract class PricingRepository {
  /// Solicita el cálculo y firma de la tarifa en base a la información del [request].
  Future<PricingResponse> calculatePricing(PricingRequest request);
}
