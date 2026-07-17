import 'package:equatable/equatable.dart';
import 'package:meta/meta.dart';

/// {@template pricing_extensions}
/// Contenedor estructurado fuertemente tipado para las extensiones futuras del motor.
///
/// **Objetivo:** Prevenir la dispersión y manipulación insegura de mapas dinámicos sueltos (e.g. Map<String, dynamic>).
/// **Responsabilidad:** Alojar variables opcionales del entorno como clima, congestión vial o peajes de forma controlada.
/// **Dependencias:** [Equatable]
/// **Restricciones:** Totalmente inmutable.
/// **Ejemplo de uso:** `final ext = PricingExtensions(weatherFactor: 1.10);`
/// {@endtemplate}
@immutable
class PricingExtensions extends Equatable {
  /// {@macro pricing_extensions}
  const PricingExtensions({
    this.weatherFactor,
    this.trafficFactor,
    this.emergencyFactor,
    this.tollsCost,
  });

  /// Crea una instancia vacía o por defecto de [PricingExtensions].
  factory PricingExtensions.empty() => const PricingExtensions();

  /// Factor multiplicador climatológico opcional (e.g., lluvias torrenciales).
  final double? weatherFactor;

  /// Factor multiplicador de congestión por tráfico en ruta opcional.
  final double? trafficFactor;

  /// Factor multiplicador de recargo de emergencia opcional.
  final double? emergencyFactor;

  /// Costo bruto acumulado por peajes en ruta opcional.
  final double? tollsCost;

  @override
  List<Object?> get props => [
        weatherFactor,
        trafficFactor,
        emergencyFactor,
        tollsCost,
      ];

  @override
  String toString() =>
      'PricingExtensions(weather: $weatherFactor, traffic: $trafficFactor, emergency: $emergencyFactor, tolls: $tollsCost)';
}
