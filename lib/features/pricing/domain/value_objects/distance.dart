import 'package:equatable/equatable.dart';
import 'package:meta/meta.dart';
import '../exceptions/pricing_validation_exception.dart';

/// {@template distance}
/// Objeto de valor inmutable que representa la distancia del viaje expresada en kilómetros.
///
/// **Objetivo:** Evitar el uso de flotantes primitivos propensos a valores inválidos o negativos.
/// **Responsabilidad:** Encapsular y validar la magnitud física de la ruta.
/// **Dependencias:** [PricingValidationException], [Equatable]
/// **Restricciones:** El valor numérico debe ser mayor o igual a cero.
/// **Ejemplo de uso:** `final d = Distance(12.5);`
/// {@endtemplate}
@immutable
class Distance extends Equatable {
  /// {@macro distance}
  Distance(this.value) {
    if (value < 0.0) {
      throw const PricingValidationException(
        'La distancia de viaje no puede ser negativa.',
        property: 'distanceKm',
      );
    }
  }

  /// Valor neto de la distancia en kilómetros.
  final double value;

  @override
  List<Object?> get props => [value];

  @override
  String toString() => '$value km';
}
