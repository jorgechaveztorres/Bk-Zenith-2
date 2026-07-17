/// {@template pricing_validation_exception}
/// Excepción lanzada cuando se violan las reglas de negocio o precondiciones matemáticas
/// del Zenith Pricing Engine™.
/// {@endtemplate}
class PricingValidationException implements Exception {
  /// {@macro pricing_validation_exception}
  const PricingValidationException(this.message, {this.property});

  /// Mensaje descriptivo de la falla de validación.
  final String message;

  /// Propiedad o campo que originó el fallo de validación (opcional).
  final String? property;

  @override
  String toString() {
    if (property != null) {
      return 'PricingValidationException: [$property] $message';
    }
    return 'PricingValidationException: $message';
  }
}
