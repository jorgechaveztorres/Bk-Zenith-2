/// ============================================================================
/// ZENITH
/// Module : Pricing
/// Layer  : Domain
/// Type   : Entity
/// File   : pricing_response.dart
/// ============================================================================

import 'package:equatable/equatable.dart';
import 'package:meta/meta.dart';
import '../value_objects/index.dart';

/// {@template pricing_response}
/// Entidad pura de Dominio que representa el resultado de cotización definitivo, firmado y protegido.
///
/// **Objetivo:** Modelar la respuesta final e inalterable del motor de precios de ZÉNITH.
/// **Responsabilidad:** Encapsular precios, desgloses, multiplicadores, métricas de confianza/riesgo y sellos criptográficos.
/// **Dependencias:** [Money], [Multiplier], [Currency], [Percentage], [ConfidenceLevel], [RiskLevel], [PricingSeal], [PricingExtensions], [Equatable]
/// **Restricciones:** Es de dominio puro, inmutable, no conoce formatos de transporte ni serialización.
/// **Riesgos:** Ninguno en dominio. Todo el control de consistencia se delega a los objetos de valor internos.
/// **Extensiones futuras:** Integrar más desgloses específicos de impuestos locales o peajes avanzados.
/// {@endtemplate}
@immutable
class PricingResponse extends Equatable {
  /// {@macro pricing_response}
  const PricingResponse({
    required this.quoteId,
    required this.auditId,
    required this.protectedPrice,
    required this.basePrice,
    required this.distancePrice,
    required this.durationPrice,
    required this.cityMultiplier,
    required this.timeProfileMultiplier,
    required this.currency,
    required this.confidenceScore,
    required this.confidenceLevel,
    required this.riskLevel,
    required this.fairnessIndex,
    required this.pricingSeal,
    required this.pricingEngineVersion,
    required this.pipelineVersion,
    required this.pricingFormulaVersion,
    required this.pricingConfigurationVersion,
    required this.isProtected,
    required this.expiresAt,
    required this.generatedAt,
    required this.extensions,
  });

  /// Identificador único de la cotización original.
  final String quoteId;

  /// Identificador único del registro de auditoría en la Bitácora Matemática (Pricing Audit Ledger ID).
  final String auditId;

  /// Tarifa total consolidada y protegida mostrada al usuario final.
  final Money protectedPrice;

  /// Tarifa base por arranque regional asignada.
  final Money basePrice;

  /// Porción de la tarifa calculada en función de la distancia de ruta.
  final Money distancePrice;

  /// Porción de la tarifa calculada en función del tiempo de viaje estimado.
  final Money durationPrice;

  /// Multiplicador de escala por corrección regional de la ciudad.
  final Multiplier cityMultiplier;

  /// Multiplicador dinámico de ajuste por perfil horario.
  final Multiplier timeProfileMultiplier;

  /// Divisa o unidad monetaria de la cotización.
  final Currency currency;

  /// Score estadístico de confianza de los sensores y telemetría (0.0 a 1.0).
  final Percentage confidenceScore;

  /// Nivel categórico de confianza del cálculo tarifario en un momento dado.
  final ConfidenceLevel confidenceLevel;

  /// Nivel de riesgo de seguridad u operativo de la solicitud.
  final RiskLevel riskLevel;

  /// Métrica de equidad que certifica que el cálculo es justo e imparcial (0.0 a 1.0).
  final Percentage fairnessIndex;

  /// Sello digital criptográfico que certifica la autoría original de backend.
  final PricingSeal pricingSeal;

  /// Versión lógica del motor de precios de ZÉNITH.
  final String pricingEngineVersion;

  /// Versión de la tubería secuencial del cálculo.
  final String pipelineVersion;

  /// Versión de la fórmula matemática aplicada.
  final String pricingFormulaVersion;

  /// Versión de los coeficientes de negocio activos aplicados.
  final String pricingConfigurationVersion;

  /// Estado de protección contra manipulación en local.
  final bool isProtected;

  /// Sello de expiración temporal del precio cotizado.
  final DateTime expiresAt;

  /// Sello temporal de la generación del cálculo en el backend.
  final DateTime generatedAt;

  /// Contenedor estructurado de extensiones de datos del motor.
  final PricingExtensions extensions;

  @override
  bool get stringify => true;

  @override
  List<Object?> get props => [
        quoteId,
        auditId,
        protectedPrice,
        basePrice,
        distancePrice,
        durationPrice,
        cityMultiplier,
        timeProfileMultiplier,
        currency,
        confidenceScore,
        confidenceLevel,
        riskLevel,
        fairnessIndex,
        pricingSeal,
        pricingEngineVersion,
        pipelineVersion,
        pricingFormulaVersion,
        pricingConfigurationVersion,
        isProtected,
        expiresAt,
        generatedAt,
        extensions,
      ];

  /// Crea una copia de esta entidad con algunos campos modificados.
  PricingResponse copyWith({
    String? quoteId,
    String? auditId,
    Money? protectedPrice,
    Money? basePrice,
    Money? distancePrice,
    Money? durationPrice,
    Multiplier? cityMultiplier,
    Multiplier? timeProfileMultiplier,
    Currency? currency,
    Percentage? confidenceScore,
    ConfidenceLevel? confidenceLevel,
    RiskLevel? riskLevel,
    Percentage? fairnessIndex,
    PricingSeal? pricingSeal,
    String? pricingEngineVersion,
    String? pipelineVersion,
    String? pricingFormulaVersion,
    String? pricingConfigurationVersion,
    bool? isProtected,
    DateTime? expiresAt,
    DateTime? generatedAt,
    PricingExtensions? extensions,
  }) {
    return PricingResponse(
      quoteId: quoteId ?? this.quoteId,
      auditId: auditId ?? this.auditId,
      protectedPrice: protectedPrice ?? this.protectedPrice,
      basePrice: basePrice ?? this.basePrice,
      distancePrice: distancePrice ?? this.distancePrice,
      durationPrice: durationPrice ?? this.durationPrice,
      cityMultiplier: cityMultiplier ?? this.cityMultiplier,
      timeProfileMultiplier: timeProfileMultiplier ?? this.timeProfileMultiplier,
      currency: currency ?? this.currency,
      confidenceScore: confidenceScore ?? this.confidenceScore,
      confidenceLevel: confidenceLevel ?? this.confidenceLevel,
      riskLevel: riskLevel ?? this.riskLevel,
      fairnessIndex: fairnessIndex ?? this.fairnessIndex,
      pricingSeal: pricingSeal ?? this.pricingSeal,
      pricingEngineVersion: pricingEngineVersion ?? this.pricingEngineVersion,
      pipelineVersion: pipelineVersion ?? this.pipelineVersion,
      pricingFormulaVersion: pricingFormulaVersion ?? this.pricingFormulaVersion,
      pricingConfigurationVersion: pricingConfigurationVersion ?? this.pricingConfigurationVersion,
      isProtected: isProtected ?? this.isProtected,
      expiresAt: expiresAt ?? this.expiresAt,
      generatedAt: generatedAt ?? this.generatedAt,
      extensions: extensions ?? this.extensions,
    );
  }

  @override
  String toString() {
    return 'PricingResponse(quoteId: $quoteId, protectedPrice: $protectedPrice, level: $confidenceLevel, risk: $riskLevel, seal: $pricingSeal)';
  }
}
