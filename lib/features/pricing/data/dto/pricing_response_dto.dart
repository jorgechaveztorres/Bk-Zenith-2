/// ============================================================================
/// ZENITH
/// Module : Pricing
/// Layer  : Data
/// Type   : Dto
/// File   : pricing_response_dto.dart
/// ============================================================================

import 'package:equatable/equatable.dart';
import 'package:meta/meta.dart';
import '../../domain/entities/pricing_response.dart';
import '../../domain/value_objects/index.dart';

/// {@template pricing_response_dto}
/// Data Transfer Object (DTO) para recibir e interpretar las respuestas del motor de precios de ZÉNITH.
///
/// **Objetivo:** Deserializar de forma segura las payloads recibidas desde los servidores de cálculo de tarifas.
/// **Responsabilidad:** Actuar como capa intermedia de deserialización y aislar la entidad de dominio de cambios de red.
/// **Dependencias:** [Equatable]
/// **Restricciones:** Inmutable. Solo contiene primitivos básicos.
/// **Riesgos:** Errores de desajuste de tipos (type mismatch) si se modifican los nombres de los atributos de API sin actualizar este DTO.
/// **Ejemplo de uso:** `final dto = PricingResponseDto.fromJson(responseMap);`
/// {@endtemplate}
@immutable
class PricingResponseDto extends Equatable {
  /// {@macro pricing_response_dto}
  const PricingResponseDto({
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
    this.weatherFactor,
    this.trafficFactor,
    this.emergencyFactor,
    this.tollsCost,
  });

  /// Crea un DTO a partir de un mapa JSON serializado.
  factory PricingResponseDto.fromJson(Map<String, dynamic> json) {
    return PricingResponseDto(
      quoteId: json['quoteId'] as String,
      auditId: json['auditId'] as String,
      protectedPrice: (json['protectedPrice'] as num).toDouble(),
      basePrice: (json['basePrice'] as num).toDouble(),
      distancePrice: (json['distancePrice'] as num).toDouble(),
      durationPrice: (json['durationPrice'] as num).toDouble(),
      cityMultiplier: (json['cityMultiplier'] as num).toDouble(),
      timeProfileMultiplier: (json['timeProfileMultiplier'] as num).toDouble(),
      currency: json['currency'] as String,
      confidenceScore: (json['confidenceScore'] as num).toDouble(),
      confidenceLevel: json['confidenceLevel'] as String,
      riskLevel: json['riskLevel'] as String,
      fairnessIndex: (json['fairnessIndex'] as num).toDouble(),
      pricingSeal: json['pricingSeal'] as String,
      pricingEngineVersion: json['pricingEngineVersion'] as String,
      pipelineVersion: json['pipelineVersion'] as String,
      pricingFormulaVersion: json['pricingFormulaVersion'] as String,
      pricingConfigurationVersion: json['pricingConfigurationVersion'] as String,
      isProtected: json['isProtected'] as bool,
      expiresAt: json['expiresAt'] as String,
      generatedAt: json['generatedAt'] as String,
      weatherFactor: (json['weatherFactor'] as num?)?.toDouble(),
      trafficFactor: (json['trafficFactor'] as num?)?.toDouble(),
      emergencyFactor: (json['emergencyFactor'] as num?)?.toDouble(),
      tollsCost: (json['tollsCost'] as num?)?.toDouble(),
    );
  }

  /// Identificador único de la cotización asociada.
  final String quoteId;

  /// Identificador del registro en el libro mayor de auditorías (Pricing Audit Ledger ID).
  final String auditId;

  /// Tarifa final consolidada y garantizada por el servidor.
  final double protectedPrice;

  /// Tarifa base inicial asignada por apertura de viaje.
  final double basePrice;

  /// Costo acumulado asociado a la distancia estimada de la ruta.
  final double distancePrice;

  /// Costo acumulado asociado al tiempo estimado del trayecto.
  final double durationPrice;

  /// Coeficiente multiplicador de corrección de ciudad aplicada.
  final double cityMultiplier;

  /// Multiplicador dinámico por perfil temporal/horario.
  final double timeProfileMultiplier;

  /// Divisa o moneda de cálculo.
  final String currency;

  /// Score de confianza estadística en el cálculo tarifario.
  final double confidenceScore;

  /// Nivel categórico de confianza de telemetría (LOW, MEDIUM, HIGH).
  final String confidenceLevel;

  /// Nivel categórico de riesgo de seguridad (NONE, LOW, MEDIUM, HIGH, CRITICAL).
  final String riskLevel;

  /// Índice o coeficiente de equidad social e individual.
  final double fairnessIndex;

  /// Firma digital o sello criptográfico generado por el backend oficial.
  final String pricingSeal;

  /// Versión de la arquitectura lógica del motor de precios.
  final String pricingEngineVersion;

  /// Versión de la tubería de cálculo.
  final String pipelineVersion;

  /// Versión de la fórmula matemática aplicada.
  final String pricingFormulaVersion;

  /// Versión de la configuración de coeficientes.
  final String pricingConfigurationVersion;

  /// Estado de protección contra manipulación de tarifas del lado cliente.
  final bool isProtected;

  /// Tiempo de expiración de oferta (Formato ISO-8601).
  final String expiresAt;

  /// Marca de tiempo de cálculo (Formato ISO-8601).
  final String generatedAt;

  /// Extensión opcional: Factor climatológico.
  final double? weatherFactor;

  /// Extensión opcional: Factor de congestión.
  final double? trafficFactor;

  /// Extensión opcional: Recargo de emergencia.
  final double? emergencyFactor;

  /// Extensión opcional: Costo bruto de peajes en ruta.
  final double? tollsCost;

  /// Convierte este DTO en una entidad de dominio puro [PricingResponse].
  PricingResponse toDomain() {
    final currencyEnum = Currency.fromString(currency);
    return PricingResponse(
      quoteId: quoteId,
      auditId: auditId,
      protectedPrice: Money(protectedPrice, currencyEnum),
      basePrice: Money(basePrice, currencyEnum),
      distancePrice: Money(distancePrice, currencyEnum),
      durationPrice: Money(durationPrice, currencyEnum),
      cityMultiplier: Multiplier(cityMultiplier),
      timeProfileMultiplier: Multiplier(timeProfileMultiplier),
      currency: currencyEnum,
      confidenceScore: Percentage(confidenceScore),
      confidenceLevel: ConfidenceLevel.fromString(confidenceLevel),
      riskLevel: RiskLevel.fromString(riskLevel),
      fairnessIndex: Percentage(fairnessIndex),
      pricingSeal: PricingSeal(pricingSeal),
      pricingEngineVersion: pricingEngineVersion,
      pipelineVersion: pipelineVersion,
      pricingFormulaVersion: pricingFormulaVersion,
      pricingConfigurationVersion: pricingConfigurationVersion,
      isProtected: isProtected,
      expiresAt: DateTime.parse(expiresAt),
      generatedAt: DateTime.parse(generatedAt),
      extensions: PricingExtensions(
        weatherFactor: weatherFactor,
        trafficFactor: trafficFactor,
        emergencyFactor: emergencyFactor,
        tollsCost: tollsCost,
      ),
    );
  }

  /// Convierte este DTO en un mapa JSON listo para transmisión o almacenamiento local.
  Map<String, dynamic> toJson() {
    return {
      'quoteId': quoteId,
      'auditId': auditId,
      'protectedPrice': protectedPrice,
      'basePrice': basePrice,
      'distancePrice': distancePrice,
      'durationPrice': durationPrice,
      'cityMultiplier': cityMultiplier,
      'timeProfileMultiplier': timeProfileMultiplier,
      'currency': currency,
      'confidenceScore': confidenceScore,
      'confidenceLevel': confidenceLevel,
      'riskLevel': riskLevel,
      'fairnessIndex': fairnessIndex,
      'pricingSeal': pricingSeal,
      'pricingEngineVersion': pricingEngineVersion,
      'pipelineVersion': pipelineVersion,
      'pricingFormulaVersion': pricingFormulaVersion,
      'pricingConfigurationVersion': pricingConfigurationVersion,
      'isProtected': isProtected,
      'expiresAt': expiresAt,
      'generatedAt': generatedAt,
      if (weatherFactor != null) 'weatherFactor': weatherFactor,
      if (trafficFactor != null) 'trafficFactor': trafficFactor,
      if (emergencyFactor != null) 'emergencyFactor': emergencyFactor,
      if (tollsCost != null) 'tollsCost': tollsCost,
    };
  }

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
        weatherFactor,
        trafficFactor,
        emergencyFactor,
        tollsCost,
      ];
}
