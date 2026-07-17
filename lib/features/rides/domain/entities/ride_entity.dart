import 'package:equatable/equatable.dart';
import 'location_entity.dart';

class RideEntity extends Equatable {
  final String id;
  final String passengerId;
  final String passengerName;
  final String? driverId;
  final String? driverName;
  final LocationEntity origin;
  final LocationEntity destination;
  final double suggestedPrice;
  final double? finalPrice;
  final String status; // 'pending', 'negotiating', 'accepted', 'in_progress', 'completed', 'cancelled'
  final dynamic createdAt;
  final dynamic updatedAt;

  const RideEntity({
    required this.id,
    required this.passengerId,
    required this.passengerName,
    this.driverId,
    this.driverName,
    required this.origin,
    required this.destination,
    required this.suggestedPrice,
    this.finalPrice,
    required this.status,
    this.createdAt,
    this.updatedAt,
  });

  @override
  List<Object?> get props => [
        id,
        passengerId,
        passengerName,
        driverId,
        driverName,
        origin,
        destination,
        suggestedPrice,
        finalPrice,
        status,
        createdAt,
        updatedAt,
      ];
}

