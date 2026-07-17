/// ============================================================================
/// ZENITH
/// Module : Pricing
/// Layer  : Domain
/// Type   : Failure
/// File   : validation_pricing_failure.dart
/// ============================================================================

import 'pricing_failure.dart';

/// {@template validation_pricing_failure}
/// Error ocurrido debido a una violación de contrato o precondición lógica de negocio.
/// {@endtemplate}
class ValidationPricingFailure extends PricingFailure {
  /// {@macro validation_pricing_failure}
  const ValidationPricingFailure(super.message, {this.property});

  /// Propiedad que causó la violación.
  final String? property;

  @override
  List<Object?> get props => [message, property];
}
