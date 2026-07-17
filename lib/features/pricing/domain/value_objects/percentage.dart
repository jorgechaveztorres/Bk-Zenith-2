import 'package:equatable/equatable.dart';
import 'package:meta/meta.dart';
import '../exceptions/pricing_validation_exception.dart';

/// {@template percentage}
/// Objeto de valor inmutable que representa una tasa, coeficiente de equidad o porcentaje.
///
/// **Objetivo:** Asegurar que los scores y mediciones de equidad o confiabilidad se mantengan en rangos válidos.
/// **Responsabilidad:** Encapsular y validar valores fraccionarios típicos de cálculos matemáticos.
/// **Dependencias:** [PricingValidationException], [Equatable]
/// **Restricciones:** El valor decimal debe encontrarse estrictamente entre 0.0 y 1.0 (ambos inclusive).
/// **Ejemplo de uso:** `final score = Percentage(0.95);`
/// {@endtemplate}
@immutable
class Percentage extends Equatable {
  /// {@macro percentage}
  Percentage(this.value) {
    if (value < 0.0 || value > 1.0) {
      throw PricingValidationException(
        'El porcentaje debe encontrarse estrictamente entre 0.0 y 1.0 ($value).',
        property: 'percentage',
      );
    }
  }

  /// Valor decimal equivalente del porcentaje.
  final double value;

  @override
  List<Object?> get props => [value];

  @override
  String toString() => '${(value * 100).toStringAsFixed(2)}%';
}
