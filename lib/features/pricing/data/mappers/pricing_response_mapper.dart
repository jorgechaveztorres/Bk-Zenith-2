/// ============================================================================
/// ZENITH
/// Module : Pricing
/// Layer  : Data
/// Type   : Mapper
/// File   : pricing_response_mapper.dart
/// ============================================================================

import '../../domain/entities/pricing_response.dart';
import '../../domain/value_objects/index.dart';
import '../dto/pricing_response_dto.dart';

/// {@template pricing_response_mapper}
/// Mapper inmutable y puro encargado de transformar la respuesta del motor de precios desde el DTO al Dominio.
///
/// **Objetivo:** Aislar la capa de Dominio de los detalles de serialización y formatos de red.
/// **Responsabilidad:** Mapear de forma determinista de [PricingResponseDto] a [PricingResponse].
/// **Dependencias:** [PricingResponse], [PricingResponseDto]
/// **Restricciones:** Estrictamente estático, sin estado interno ni mutabilidad. Única responsabilidad: DTO -> Domain.
/// **Ejemplo de uso:**
/// ```dart
/// final entity = PricingResponseMapper.toDomain(dto);
/// ```
/// {@endtemplate}
class PricingResponseMapper {
  PricingResponseMapper._();

  /// Convierte un [PricingResponseDto] a una entidad de dominio puro [PricingResponse].
  static PricingResponse toDomain(PricingResponseDto dto) {
    final currencyEnum = Currency.fromString(dto.currency);
    return PricingResponse(
      quoteId: dto.quoteId,
      auditId: dto.auditId,
      protectedPrice: Money(dto.protectedPrice, currencyEnum),
      basePrice: Money(dto.basePrice, currencyEnum),
      distancePrice: Money(dto.distancePrice, currencyEnum),
      durationPrice: Money(dto.durationPrice, currencyEnum),
      cityMultiplier: Multiplier(dto.cityMultiplier),
      timeProfileMultiplier: Multiplier(dto.timeProfileMultiplier),
      currency: currencyEnum,
      confidenceScore: Percentage(dto.confidenceScore),
      confidenceLevel: ConfidenceLevel.fromString(dto.confidenceLevel),
      riskLevel: RiskLevel.fromString(dto.riskLevel),
      fairnessIndex: Percentage(dto.fairnessIndex),
      pricingSeal: PricingSeal(dto.pricingSeal),
      pricingEngineVersion: dto.pricingEngineVersion,
      pipelineVersion: dto.pipelineVersion,
      pricingFormulaVersion: dto.pricingFormulaVersion,
      pricingConfigurationVersion: dto.pricingConfigurationVersion,
      isProtected: dto.isProtected,
      expiresAt: DateTime.parse(dto.expiresAt),
      generatedAt: DateTime.parse(dto.generatedAt),
      extensions: PricingExtensions(
        weatherFactor: dto.weatherFactor,
        trafficFactor: dto.trafficFactor,
        emergencyFactor: dto.emergencyFactor,
        tollsCost: dto.tollsCost,
      ),
    );
  }
}
