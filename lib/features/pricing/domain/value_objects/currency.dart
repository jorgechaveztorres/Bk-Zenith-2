import '../exceptions/pricing_validation_exception.dart';

/// {@template currency}
/// Divisa financiera para las transacciones del Zenith Pricing Engine™.
///
/// **Objetivo:** Tipar fuertemente las unidades monetarias transaccionales.
/// **Responsabilidad:** Evitar mezclas de divisas en las operaciones matemáticas.
/// **Dependencias:** [PricingValidationException]
/// **Restricciones:** Soporta PEN (Soles) y USD (Dólares).
/// {@endtemplate}
enum Currency {
  /// Sol Peruano (Moneda oficial por defecto).
  PEN,

  /// Dólar estadounidense.
  USD;

  /// Obtiene un [Currency] desde una cadena de texto, de manera segura.
  static Currency fromString(String value) {
    return Currency.values.firstWhere(
      (e) => e.name == value.toUpperCase(),
      orElse: () => throw PricingValidationException(
        'Divisa no soportada: $value',
        property: 'currency',
      ),
    );
  }
}
