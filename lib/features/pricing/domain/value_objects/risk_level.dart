import '../exceptions/pricing_validation_exception.dart';

/// {@template risk_level}
/// Nivel de riesgo operativo o de seguridad de la solicitud.
///
/// **Objetivo:** Separar las métricas de riesgo operacional y de seguridad del índice de confianza matemática.
/// **Responsabilidad:** Clasificar la criticidad y peligro potencial del contexto de la solicitud.
/// **Dependencias:** [PricingValidationException]
/// **Restricciones:** Valores permitidos: NONE, LOW, MEDIUM, HIGH, CRITICAL.
/// {@endtemplate}
enum RiskLevel {
  /// Sin riesgo aparente o habitual de la red.
  NONE,

  /// Riesgo bajo.
  LOW,

  /// Riesgo medio con posibles anomalías de entorno.
  MEDIUM,

  /// Riesgo alto de fraude o spoofing de geolocalización.
  HIGH,

  /// Riesgo crítico: requiere suspensión inmediata de cotizaciones o bloqueo.
  CRITICAL;

  /// Obtiene un [RiskLevel] desde una cadena de texto de manera segura.
  static RiskLevel fromString(String value) {
    return RiskLevel.values.firstWhere(
      (e) => e.name == value.toUpperCase(),
      orElse: () => throw PricingValidationException(
        'Nivel de riesgo inválido: $value',
        property: 'riskLevel',
      ),
    );
  }
}
