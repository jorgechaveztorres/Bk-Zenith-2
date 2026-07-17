/// ============================================================================
/// ZENITH
/// Module : Pricing
/// Layer  : Domain
/// Type   : Failure
/// File   : pricing_failure.dart
/// ============================================================================

import 'package:equatable/equatable.dart';

export 'validation_pricing_failure.dart';
export 'server_pricing_failure.dart';
export 'risk_blocked_pricing_failure.dart';

/// {@template pricing_failure}
/// Clase base para representar fallas y errores de negocio en el motor de precios de ZÉNITH.
///
/// **Objetivo:** Unificar la gestión de errores del motor y desacoplar de excepciones de infraestructura.
/// **Responsabilidad:** Proveer objetos de error listos para consumo por capas de presentación (Bloc).
/// **Dependencias:** [Equatable]
/// **Restricciones:** Inmutable.
/// **Ejemplo de uso:** `return Left(PricingFailure.validation('Distancia no válida'));`
/// {@endtemplate}
abstract class PricingFailure extends Equatable {
  /// {@macro pricing_failure}
  const PricingFailure(this.message);

  /// Mensaje descriptivo para depuración o visualización limpia.
  final String message;

  @override
  List<Object?> get props => [message];
}
