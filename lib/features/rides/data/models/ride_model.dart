import '../../domain/entities/ride_entity.dart';
import 'location_model.dart';

class RideModel extends RideEntity {
  RideModel({
    required super.id,
    required super.passengerId,
    required super.passengerName,
    super.driverId,
    super.driverName,
    required LocationModel super.origin,
    required LocationModel super.destination,
    required super.suggestedPrice,
    super.finalPrice,
    required super.status,
    super.createdAt,
    super.updatedAt,
  });

  factory RideModel.fromMap(Map<String, dynamic> map, String id) {
    return RideModel(
      id: id,
      passengerId: map['passengerId'] as String? ?? '',
      passengerName: map['passengerName'] as String? ?? '',
      driverId: map['driverId'] as String?,
      driverName: map['driverName'] as String?,
      origin: LocationModel.fromMap(Map<String, dynamic>.from(map['origin'] ?? {})),
      destination: LocationModel.fromMap(Map<String, dynamic>.from(map['destination'] ?? {})),
      suggestedPrice: (map['suggestedPrice'] as num?)?.toDouble() ?? 0.0,
      finalPrice: (map['finalPrice'] as num?)?.toDouble(),
      status: map['status'] as String? ?? 'pending',
      createdAt: map['createdAt'],
      updatedAt: map['updatedAt'],
    );
  }

  factory RideModel.fromDomain(RideEntity domain) {
    if (domain is RideModel) return domain;
    return RideModel(
      id: domain.id,
      passengerId: domain.passengerId,
      passengerName: domain.passengerName,
      driverId: domain.driverId,
      driverName: domain.driverName,
      origin: LocationModel.fromDomain(domain.origin),
      destination: LocationModel.fromDomain(domain.destination),
      suggestedPrice: domain.suggestedPrice,
      finalPrice: domain.finalPrice,
      status: domain.status,
      createdAt: domain.createdAt,
      updatedAt: domain.updatedAt,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'passengerId': passengerId,
      'passengerName': passengerName,
      if (driverId != null) 'driverId': driverId,
      if (driverName != null) 'driverName': driverName,
      'origin': (origin as LocationModel).toMap(),
      'destination': (destination as LocationModel).toMap(),
      'suggestedPrice': suggestedPrice,
      if (finalPrice != null) 'finalPrice': finalPrice,
      'status': status,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }
}
