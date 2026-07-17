/// ============================================================================
/// ZENITH
/// Module : Pricing
/// Layer  : Domain
/// Type   : Entity
/// File   : pricing_request.dart
/// ============================================================================

import 'package:equatable/equatable.dart';
import 'package:meta/meta.dart';
import '../value_objects/index.dart';

/// {@template pricing_request}
/// Entidad pura de Dominio que representa una solicitud formal de cotización de viaje.
///
/// **Objetivo:** Modelar los parámetros de entrada del motor de precios de manera segura.
/// **Responsabilidad:** Agrupar las ubicaciones de origen, destino, magnitudes calculadas y datos contextuales.
/// **Dependencias:** [CityId], [ServiceType], [PricingLocation], [Distance], [Duration], [PricingExtensions], [Equatable]
/// **Restricciones:** Es de dominio puro, completamente inmutable, sin métodos de persistencia ni JSON.
/// **Riesgos:** Ninguno en dominio. La validación recae en los objetos de valor que lo componen.
/// **Extensiones futuras:** Adición de perfiles de usuario o políticas corporativas especiales.
/// {@endtemplate}
@immutable
class PricingRequest extends Equatable {
  /// {@macro pricing_request}
  const PricingRequest({
    required this.quoteId,
    required this.originLocation,
    required this.destinationLocation,
    required this.distance,
    required this.duration,
    required this.cityId,
    required this.serviceType,
    required this.requestedAt,
    this.userId,
    required this.extensions,
  });

  /// Identificador único universal de la cotización de viaje.
  final String quoteId;

  /// Coordenadas de origen del viaje (Punto A).
  final PricingLocation originLocation;

  /// Coordenadas de destino del viaje (Punto B).
  final PricingLocation destinationLocation;

  /// Distancia estimada de la ruta.
  final Distance distance;

  /// Tiempo estimado de viaje.
  final Duration duration;

  /// Identificador de la ciudad regional donde se solicita el servicio.
  final CityId cityId;

  /// Categoría del servicio de movilidad seleccionado.
  final ServiceType serviceType;

  /// Marca de tiempo de la solicitud física.
  final DateTime requestedAt;

  /// Identificador único del usuario solicitante (opcional).
  final String? userId;

  /// Contenedor estructurado para extensiones funcionales del motor.
  final PricingExtensions extensions;

  @override
  bool get stringify => true;

  @override
  List<Object?> get props => [
        quoteId,
        originLocation,
        destinationLocation,
        distance,
        duration,
        cityId,
        serviceType,
        requestedAt,
        userId,
        extensions,
      ];

  /// Crea una copia de esta entidad con algunos campos modificados.
  PricingRequest copyWith({
    String? quoteId,
    PricingLocation? originLocation,
    PricingLocation? destinationLocation,
    Distance? distance,
    Duration? duration,
    CityId? cityId,
    ServiceType? serviceType,
    DateTime? requestedAt,
    String? userId,
    PricingExtensions? extensions,
  }) {
    return PricingRequest(
      quoteId: quoteId ?? this.quoteId,
      originLocation: originLocation ?? this.originLocation,
      destinationLocation: destinationLocation ?? this.destinationLocation,
      distance: distance ?? this.distance,
      duration: duration ?? this.duration,
      cityId: cityId ?? this.cityId,
      serviceType: serviceType ?? this.serviceType,
      requestedAt: requestedAt ?? this.requestedAt,
      userId: userId ?? this.userId,
      extensions: extensions ?? this.extensions,
    );
  }

  @override
  String toString() {
    return 'PricingRequest(quoteId: $quoteId, cityId: $cityId, serviceType: $serviceType, distance: $distance)';
  }
}
