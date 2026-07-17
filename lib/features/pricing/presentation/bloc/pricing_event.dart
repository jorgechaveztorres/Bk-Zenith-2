import 'package:equatable/equatable.dart';
import '../../domain/entities/pricing_request.dart';

/// {@template pricing_event}
/// Clase base para todos los eventos del Bloc del Zenith Pricing Engine™.
///
/// **Objetivo:** Definir las señales de intención de usuario dirigidas al gestor de estados.
/// **Responsabilidad:** Servir como canal de eventos de UI.
/// **Dependencias:** [Equatable]
/// **Restricciones:** Estrictamente inmutable.
/// {@endtemplate}
abstract class PricingEvent extends Equatable {
  /// {@macro pricing_event}
  const PricingEvent();

  @override
  List<Object?> get props => [];
}

/// {@template calculate_pricing_event}
/// Evento gatillado para solicitar el cálculo y cotización formal de un viaje.
/// {@endtemplate}
class CalculatePricingEvent extends PricingEvent {
  /// {@macro calculate_pricing_event}
  const CalculatePricingEvent(this.request);

  /// Solicitud de cotización estructurada lista para enviar.
  final PricingRequest request;

  @override
  List<Object?> get props => [request];
}
