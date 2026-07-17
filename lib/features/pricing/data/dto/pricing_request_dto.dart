/// ============================================================================
/// ZENITH
/// Module : Pricing
/// Layer  : Data
/// Type   : Dto
/// File   : pricing_request_dto.dart
/// ============================================================================

import 'package:equatable/equatable.dart';
import 'package:meta/meta.dart';
import '../../domain/entities/pricing_request.dart';

/// {@template pricing_request_dto}
/// Data Transfer Object (DTO) para la serialización y transmisión de solicitudes del motor de precios.
///
/// **Objetivo:** Encapsular los datos primitivos requeridos por los endpoints externos (e.g. Firebase Cloud Functions).
/// **Responsabilidad:** Serializar y deserializar llamadas JSON aislando la capa de dominio de tipos externos.
/// **Dependencias:** [Equatable]
/// **Restricciones:** Estrictamente inmutable. Solo contiene tipos nativos/primitivos de Dart.
/// **Riesgos:** Errores de tipado dinámico si el mapa JSON recibido contiene valores nulos inesperados.
/// **Ejemplo de uso:** `final dto = PricingRequestDto.fromJson(jsonMap);`
/// {@endtemplate}
@immutable
class PricingRequestDto extends Equatable {
  /// {@macro pricing_request_dto}
  const PricingRequestDto({
    required this.quoteId,
    required this.originLatitude,
    required this.originLongitude,
    required this.destinationLatitude,
    required this.destinationLongitude,
    required this.distanceKm,
    required this.durationMinutes,
    required this.cityId,
    required this.serviceType,
    required this.requestedAt,
    this.userId,
    this.weatherFactor,
    this.trafficFactor,
    this.emergencyFactor,
    this.tollsCost,
  });

  /// Crea un DTO desde un mapa JSON serializado.
  factory PricingRequestDto.fromJson(Map<String, dynamic> json) {
    return PricingRequestDto(
      quoteId: json['quoteId'] as String,
      originLatitude: (json['originLatitude'] as num).toDouble(),
      originLongitude: (json['originLongitude'] as num).toDouble(),
      destinationLatitude: (json['destinationLatitude'] as num).toDouble(),
      destinationLongitude: (json['destinationLongitude'] as num).toDouble(),
      distanceKm: (json['distanceKm'] as num).toDouble(),
      durationMinutes: (json['durationMinutes'] as num).toDouble(),
      cityId: json['cityId'] as String,
      serviceType: json['serviceType'] as String,
      requestedAt: json['requestedAt'] as String,
      userId: json['userId'] as String?,
      weatherFactor: (json['weatherFactor'] as num?)?.toDouble(),
      trafficFactor: (json['trafficFactor'] as num?)?.toDouble(),
      emergencyFactor: (json['emergencyFactor'] as num?)?.toDouble(),
      tollsCost: (json['tollsCost'] as num?)?.toDouble(),
    );
  }

  /// Crea un DTO a partir de una entidad de dominio [PricingRequest].
  factory PricingRequestDto.fromDomain(PricingRequest domain) {
    return PricingRequestDto(
      quoteId: domain.quoteId,
      originLatitude: domain.originLocation.latitude,
      originLongitude: domain.originLocation.longitude,
      destinationLatitude: domain.destinationLocation.latitude,
      destinationLongitude: domain.destinationLocation.longitude,
      distanceKm: domain.distance.value,
      durationMinutes: domain.duration.value,
      cityId: domain.cityId.name,
      serviceType: domain.serviceType.name,
      requestedAt: domain.requestedAt.toIso8601String(),
      userId: domain.userId,
      weatherFactor: domain.extensions.weatherFactor,
      trafficFactor: domain.extensions.trafficFactor,
      emergencyFactor: domain.extensions.emergencyFactor,
      tollsCost: domain.extensions.tollsCost,
    );
  }

  /// Identificador único de la cotización.
  final String quoteId;

  /// Coordenada Y (Latitud) de origen.
  final double originLatitude;

  /// Coordenada X (Longitud) de origen.
  final double originLongitude;

  /// Coordenada Y (Latitud) de destino.
  final double destinationLatitude;

  /// Coordenada X (Longitud) de destino.
  final double destinationLongitude;

  /// Distancia estimada en kilómetros.
  final double distanceKm;

  /// Duración estimada en minutos.
  final double durationMinutes;

  /// Identificador de la ciudad de operación.
  final String cityId;

  /// Categoría del servicio de movilidad.
  final String serviceType;

  /// Sello de tiempo ISO-8601 del pedido.
  final String requestedAt;

  /// Identificador único de usuario (opcional).
  final String? userId;

  /// Extensión opcional: Factor de clima.
  final double? weatherFactor;

  /// Extensión opcional: Factor de tráfico.
  final double? trafficFactor;

  /// Extensión opcional: Factor de demergencia.
  final double? emergencyFactor;

  /// Extensión opcional: Costo bruto de peajes.
  final double? tollsCost;

  /// Convierte este DTO en un mapa JSON listo para transmisión de red.
  Map<String, dynamic> toJson() {
    return {
      'quoteId': quoteId,
      'originLatitude': originLatitude,
      'originLongitude': originLongitude,
      'destinationLatitude': destinationLatitude,
      'destinationLongitude': destinationLongitude,
      'distanceKm': distanceKm,
      'durationMinutes': durationMinutes,
      'cityId': cityId,
      'serviceType': serviceType,
      'requestedAt': requestedAt,
      if (userId != null) 'userId': userId,
      if (weatherFactor != null) 'weatherFactor': weatherFactor,
      if (trafficFactor != null) 'trafficFactor': trafficFactor,
      if (emergencyFactor != null) 'emergencyFactor': emergencyFactor,
      if (tollsCost != null) 'tollsCost': tollsCost,
    };
  }

  @override
  List<Object?> get props => [
        quoteId,
        originLatitude,
        originLongitude,
        destinationLatitude,
        destinationLongitude,
        distanceKm,
        durationMinutes,
        cityId,
        serviceType,
        requestedAt,
        userId,
        weatherFactor,
        trafficFactor,
        emergencyFactor,
        tollsCost,
      ];
}
