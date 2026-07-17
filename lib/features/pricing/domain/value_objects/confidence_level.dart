import '../exceptions/pricing_validation_exception.dart';

/// {@template confidence_level}
/// Nivel categórico de confianza del cálculo tarifario en un momento dado.
///
/// **Objetivo:** Cuantificar la estabilidad estadística y fiabilidad de la telemetría geográfica.
/// **Responsabilidad:** Categorizar la precisión del cálculo según la densidad de datos.
/// **Dependencias:** [PricingValidationException]
/// **Restricciones:** Valores permitidos: LOW, MEDIUM, HIGH.
/// {@endtemplate}
enum ConfidenceLevel {
  /// Confianza baja: Datos escasos, alta volatilidad o anomalías ligeras de GPS.
  LOW,

  /// Confianza media: Condiciones de red estables, datos históricos disponibles con variación típica.
  MEDIUM,

  /// Confianza alta: Consistencia total en telemetría, tráfico y datos históricos de alta densidad.
  HIGH;

  /// Obtiene un [ConfidenceLevel] desde una cadena de texto de manera segura.
  static ConfidenceLevel fromString(String value) {
    return ConfidenceLevel.values.firstWhere(
      (e) => e.name == value.toUpperCase(),
      orElse: () => throw PricingValidationException(
        'Nivel de confianza inválido: $value',
        property: 'confidenceLevel',
      ),
    );
  }
}
