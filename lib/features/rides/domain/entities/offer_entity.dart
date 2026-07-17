import 'package:equatable/equatable.dart';

class OfferEntity extends Equatable {
  final String id;
  final String rideId;
  final String driverId;
  final String driverName;
  final double driverRating;
  final double price;
  final String status; // 'pending', 'accepted', 'rejected'
  final dynamic createdAt;

  const OfferEntity({
    required this.id,
    required this.rideId,
    required this.driverId,
    required this.driverName,
    required this.driverRating,
    required this.price,
    required this.status,
    this.createdAt,
  });

  @override
  List<Object?> get props => [
        id,
        rideId,
        driverId,
        driverName,
        driverRating,
        price,
        status,
        createdAt,
      ];
}

