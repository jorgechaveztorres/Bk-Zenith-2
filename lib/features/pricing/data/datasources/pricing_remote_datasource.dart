/// ============================================================================
/// ZENITH
/// Module : Pricing
/// Layer  : Data
/// Type   : DataSource
/// File   : pricing_remote_datasource.dart
/// ============================================================================

import '../dto/pricing_request_dto.dart';
import '../dto/pricing_response_dto.dart';

/// {@template pricing_remote_datasource}
/// Interfaz para la fuente de datos remota del Zenith Pricing Engine™.
///
/// **Objetivo:** Definir el contrato para interactuar con los servidores de cálculo de tarifas.
/// **Responsabilidad:** Abstraer las llamadas de red y deserialización a nivel DTO.
/// **Dependencias:** [PricingRequestDto], [PricingResponseDto]
/// **Restricciones:** Estrictamente DTOs; no maneja entidades de dominio.
/// **Ejemplo de uso:** `final responseDto = await datasource.calculatePricing(requestDto);`
/// {@endtemplate}
abstract class PricingRemoteDataSource {
  /// Invoca el microservicio remoto (e.g. Firebase Cloud Function) con los datos del [request].
  ///
  /// Lanza excepciones de infraestructura (e.g., de red o de Firebase) si falla el contacto.
  Future<PricingResponseDto> calculatePricing(PricingRequestDto request);
}
