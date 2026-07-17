import 'package:equatable/equatable.dart';
import 'package:meta/meta.dart';
import '../exceptions/pricing_validation_exception.dart';

/// {@template pricing_location}
/// Objeto de valor inmutable que representa una coordenada de alta precisión geográfica.
///
/// **Objetivo:** Asegurar la inmutabilidad de la telemetría e impedir ubicaciones corruptas fuera del globo terrestre.
/// **Responsabilidad:** Validar las coordenadas geográficas de origen y destino de los viajes.
/// **Dependencias:** [PricingValidationException], [Equatable]
/// **Restricciones:** Latitud entre -90.0 y 90.0. Longitud entre -180.0 y 180.0.
/// **Ejemplo de uso:** `final loc = PricingLocation(latitude: -12.0463, longitude: -77.0427);`
/// {@endtemplate}
@immutable
class PricingLocation extends Equatable {
  /// {@macro pricing_location}
  PricingLocation({
    required this.latitude,
    required this.longitude,
  }) {
    if (latitude < -90.0 || latitude > 90.0) {
      throw PricingValidationException(
        'Latitud fuera de límites geográficos válidos [-90, 90]: $latitude',
        property: 'latitude',
      );
    }
    if (longitude < -180.0 || longitude > 180.0) {
      throw PricingValidationException(
        'Longitud fuera de límites geográficos válidos [-180, 180]: $longitude',
        property: 'longitude',
      );
    }
  }

  /// Latitud geográfica.
  final double latitude;

  /// Longitud geográfica.
  final double longitude;

  @override
  List<Object?> get props => [latitude, longitude];

  @override
  String toString() => '($latitude, $longitude)';
}
