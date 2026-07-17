import 'package:equatable/equatable.dart';
import 'package:meta/meta.dart';
import '../exceptions/pricing_validation_exception.dart';

/// {@template multiplier}
/// Objeto de valor inmutable que representa un factor multiplicador de escala tarifaria.
///
/// **Objetivo:** Tipar de forma robusta los factores dinámicos regionales u horarios.
/// **Responsabilidad:** Asegurar la consistencia de los multiplicadores y evitar factores negativos.
/// **Dependencias:** [PricingValidationException], [Equatable]
/// **Restricciones:** El multiplicador debe ser estrictamente mayor o igual a cero.
/// **Ejemplo de uso:** `final mult = Multiplier(1.5);`
/// {@endtemplate}
@immutable
class Multiplier extends Equatable {
  /// {@macro multiplier}
  Multiplier(this.value) {
    if (value < 0.0) {
      throw PricingValidationException(
        'Un multiplicador de tarifas no puede ser menor a cero ($value).',
        property: 'multiplier',
      );
    }
  }

  /// Valor numérico neto del factor multiplicador.
  final double value;

  @override
  List<Object?> get props => [value];

  @override
  String toString() => '${value}x';
}
