import 'package:equatable/equatable.dart';
import 'package:meta/meta.dart';
import '../exceptions/pricing_validation_exception.dart';

/// {@template duration}
/// Objeto de valor inmutable que representa el tiempo estimado de viaje expresado en minutos.
///
/// **Objetivo:** Evitar el uso de enteros o flotantes primitivos sin reglas de dominio.
/// **Responsabilidad:** Encapsular y validar la magnitud temporal del trayecto.
/// **Dependencias:** [PricingValidationException], [Equatable]
/// **Restricciones:** El valor numérico debe ser mayor o igual a cero.
/// **Ejemplo de uso:** `final d = Duration(22.0);`
/// {@endtemplate}
@immutable
class Duration extends Equatable {
  /// {@macro duration}
  Duration(this.value) {
    if (value < 0.0) {
      throw const PricingValidationException(
        'La duración de viaje no puede ser negativa.',
        property: 'durationMinutes',
      );
    }
  }

  /// Valor neto de la duración en minutos.
  final double value;

  @override
  List<Object?> get props => [value];

  @override
  String toString() => '$value min';
}
