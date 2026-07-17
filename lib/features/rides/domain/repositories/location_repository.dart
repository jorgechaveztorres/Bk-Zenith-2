import 'dart:async';
import '../entities/location_entity.dart';

/// {@template location_repository}
/// Puerto de dominio que rige las operaciones geográficas y de rastreo GPS de ZÉNITH.
///
/// **Objetivo:** Desacoplar por completo el hardware GPS y los servicios de geolocalización.
/// **Responsabilidad:** Definir contratos para captura de ubicación, tracking y geofencing.
/// **Dependencias:** [LocationEntity]
/// {@endtemplate}
abstract class LocationRepository {
  /// Obtiene de forma instantánea la posición actual del dispositivo vía GPS.
  Future<LocationEntity> getCurrentLocation();

  /// Abre un flujo continuo de coordenadas espaciales con frecuencia y precisión controladas.
  Stream<LocationEntity> watchLocation({
    Duration interval = const Duration(seconds: 5),
    double distanceFilterInMeters = 10.0,
  });

  /// Persiste la ubicación física actual de un operador o pasajero en Firestore para rastreo en mapa.
  Future<void> updateLocationInFirestore(String userId, LocationEntity location);

  /// Registra una geovalla para emitir alarmas de entrada o salida.
  void registerGeofence({
    required String id,
    required LocationEntity center,
    required double radiusInMeters,
    required void Function(bool isInside) onGeofenceChanged,
  });

  /// Elimina una geovalla registrada del rastreo en memoria.
  void removeGeofence(String id);
}
