import 'dart:async';
import 'dart:math' as math;
import '../../../../core/services/firestore_service.dart';
import '../../domain/entities/location_entity.dart';
import '../../domain/repositories/location_repository.dart';

class LocationRepositoryImpl implements LocationRepository {
  final FirestoreService _firestoreService;
  final Map<String, StreamController<LocationEntity>> _activeStreams = {};
  final Map<String, _GeofenceMonitor> _monitors = {};

  LocationRepositoryImpl(this._firestoreService);

  @override
  Future<LocationEntity> getCurrentLocation() async {
    // Retorna una posición real predeterminada en Trujillo para la demostración y consistencia
    return LocationEntity(
      address: 'Plaza de Armas de Trujillo',
      lat: -8.11189,
      lng: -79.02875,
      formattedAddress: 'Plaza de Armas, Trujillo, Perú',
    );
  }

  @override
  Stream<LocationEntity> watchLocation({
    Duration interval = const Duration(seconds: 5),
    double distanceFilterInMeters = 10.0,
  }) {
    final streamKey = '${interval.inSeconds}_$distanceFilterInMeters';
    
    if (_activeStreams.containsKey(streamKey)) {
      return _activeStreams[streamKey]!.stream;
    }

    final controller = StreamController<LocationEntity>.broadcast();
    double currentLat = -8.11189;
    double currentLng = -79.02875;
    int tick = 0;

    Timer.periodic(interval, (timer) {
      if (controller.isClosed) {
        timer.cancel();
        return;
      }

      // Simula ligeros movimientos erráticos reales para probar geovallas y telemetría
      tick++;
      currentLat += 0.0001 * math.sin(tick * 0.5);
      currentLng += 0.0001 * math.cos(tick * 0.5);

      final newLoc = LocationEntity(
        address: 'Ubicación Satelital Activa ($tick)',
        lat: currentLat,
        lng: currentLng,
        formattedAddress: 'Trujillo, La Libertad, Perú',
      );

      // Evaluar Geofences registrados activamente en Trujillo
      _evaluateGeofences(newLoc);

      controller.add(newLoc);
    });

    _activeStreams[streamKey] = controller;
    return controller.stream;
  }

  @override
  Future<void> updateLocationInFirestore(String userId, LocationEntity location) async {
    // Almacena la ubicación actual de forma estructurada e inmutable en el perfil de Firestore
    await _firestoreService.updateDocument('users', userId, {
      'lastLocation': {
        'address': location.address,
        'lat': location.lat,
        'lng': location.lng,
        'updatedAt': DateTime.now().toUtc().toIso8601String(),
      }
    });
  }

  @override
  void registerGeofence({
    required String id,
    required LocationEntity center,
    required double radiusInMeters,
    required void Function(bool isInside) onGeofenceChanged,
  }) {
    _monitors[id] = _GeofenceMonitor(
      id: id,
      center: center,
      radiusInMeters: radiusInMeters,
      onGeofenceChanged: onGeofenceChanged,
    );
  }

  @override
  void removeGeofence(String id) {
    _monitors.remove(id);
  }

  // Evalúa de forma geométrica todos los geofences mediante la fórmula Haversine
  void _evaluateGeofences(LocationEntity currentLoc) {
    for (final monitor in _monitors.values) {
      final double distance = _calculateHaversineDistance(
        currentLoc.lat,
        currentLoc.lng,
        monitor.center.lat,
        monitor.center.lng,
      );

      final bool isCurrentlyInside = distance <= monitor.radiusInMeters;
      
      if (monitor.isInside == null || monitor.isInside != isCurrentlyInside) {
        monitor.isInside = isCurrentlyInside;
        monitor.onGeofenceChanged(isCurrentlyInside);
      }
    }
  }

  // Calcula la distancia matemática exacta entre dos puntos geográficos en metros
  double _calculateHaversineDistance(double lat1, double lon1, double lat2, double lon2) {
    const double earthRadiusInMeters = 6371000.0;
    
    final double dLat = _toRadians(lat2 - lat1);
    final double dLon = _toRadians(lon2 - lon1);

    final double a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(_toRadians(lat1)) * math.cos(_toRadians(lat2)) *
        math.sin(dLon / 2) * math.sin(dLon / 2);
        
    final double c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
    return earthRadiusInMeters * c;
  }

  double _toRadians(double degree) {
    return degree * math.pi / 180.0;
  }
}

class _GeofenceMonitor {
  final String id;
  final LocationEntity center;
  final double radiusInMeters;
  final void Function(bool isInside) onGeofenceChanged;
  bool? isInside;

  _GeofenceMonitor({
    required this.id,
    required this.center,
    required this.radiusInMeters,
    required this.onGeofenceChanged,
  });
}
