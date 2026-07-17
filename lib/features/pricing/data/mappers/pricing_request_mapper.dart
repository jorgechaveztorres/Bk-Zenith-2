/// ============================================================================
/// ZENITH
/// Module : Pricing
/// Layer  : Data
/// Type   : Mapper
/// File   : pricing_request_mapper.dart
/// ============================================================================

import '../../domain/entities/pricing_request.dart';
import '../dto/pricing_request_dto.dart';

/// {@template pricing_request_mapper}
/// Mapper inmutable y puro encargado de transformar la solicitud de precios desde el Dominio al DTO.
///
/// **Objetivo:** Aislar la capa de Dominio de los detalles de red e infraestructura.
/// **Responsabilidad:** Mapear de forma de un solo sentido de [PricingRequest] a [PricingRequestDto].
/// **Dependencias:** [PricingRequest], [PricingRequestDto]
/// **Restricciones:** Estrictamente estático, sin estado interno ni mutabilidad. Única responsabilidad: Domain -> DTO.
/// **Ejemplo de uso:**
/// ```dart
/// final rawDto = PricingRequestMapper.toDto(entity);
/// ```
/// {@endtemplate}
class PricingRequestMapper {
  PricingRequestMapper._();

  /// Convierte una entidad de dominio puro [PricingRequest] a un [PricingRequestDto].
  static PricingRequestDto toDto(PricingRequest entity) {
    return PricingRequestDto(
      quoteId: entity.quoteId,
      originLatitude: entity.originLocation.latitude,
      originLongitude: entity.originLocation.longitude,
      destinationLatitude: entity.destinationLocation.latitude,
      destinationLongitude: entity.destinationLocation.longitude,
      distanceKm: entity.distance.value,
      durationMinutes: entity.duration.value,
      cityId: entity.cityId.name,
      serviceType: entity.serviceType.name,
      requestedAt: entity.requestedAt.toIso8601String(),
      userId: entity.userId,
      weatherFactor: entity.extensions.weatherFactor,
      trafficFactor: entity.extensions.trafficFactor,
      emergencyFactor: entity.extensions.emergencyFactor,
      tollsCost: entity.extensions.tollsCost,
    );
  }
}
