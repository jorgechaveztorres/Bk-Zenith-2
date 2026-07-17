import 'package:equatable/equatable.dart';
import '../../domain/entities/pricing_response.dart';

/// {@template pricing_state}
/// Clase base para todos los estados lógicos del flujo de cotización.
///
/// **Objetivo:** Representar la instantánea reactiva del estado del cálculo tarifario para la UI.
/// **Responsabilidad:** Fluir reactivamente hacia los Widgets del árbol de presentación.
/// **Dependencias:** [Equatable]
/// **Restricciones:** Inmutable.
/// {@endtemplate}
abstract class PricingState extends Equatable {
  /// {@macro pricing_state}
  const PricingState();

  @override
  List<Object?> get props => [];
}

/// {@template pricing_initial}
/// Estado inicial de reposo, listo para recibir solicitudes de cotización.
/// {@endtemplate}
class PricingInitial extends PricingState {
  /// {@macro pricing_initial}
  const PricingInitial();
}

/// {@template pricing_loading}
/// Estado transitorio activo que indica que la llamada al motor remoto está en curso.
/// {@endtemplate}
class PricingLoading extends PricingState {
  /// {@macro pricing_loading}
  const PricingLoading();
}

/// {@template pricing_success}
/// Estado de éxito que contiene la cotización firmada y verificada de forma segura por el backend.
/// {@endtemplate}
class PricingSuccess extends PricingState {
  /// {@macro pricing_success}
  const PricingSuccess(this.response);

  /// Respuesta de tarifa oficial firmada.
  final PricingResponse response;

  @override
  List<Object?> get props => [response];
}

/// {@template pricing_failure_state}
/// Estado de error que encapsula la descripción del fallo al cotizar el viaje.
/// {@endtemplate}
class PricingFailureState extends PricingState {
  /// {@macro pricing_failure_state}
  const PricingFailureState(this.errorMessage);

  /// Mensaje descriptivo legible del error.
  final String errorMessage;

  @override
  List<Object?> get props => [errorMessage];
}
