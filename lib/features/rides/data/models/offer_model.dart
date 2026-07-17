import '../../domain/entities/offer_entity.dart';

class OfferModel extends OfferEntity {
  OfferModel({
    required super.id,
    required super.rideId,
    required super.driverId,
    required super.driverName,
    required super.driverRating,
    required super.price,
    required super.status,
    super.createdAt,
  });

  factory OfferModel.fromMap(Map<String, dynamic> map, String id) {
    return OfferModel(
      id: id,
      rideId: map['rideId'] as String? ?? '',
      driverId: map['driverId'] as String? ?? '',
      driverName: map['driverName'] as String? ?? '',
      driverRating: (map['driverRating'] as num?)?.toDouble() ?? 5.0,
      price: (map['price'] as num?)?.toDouble() ?? 0.0,
      status: map['status'] as String? ?? 'pending',
      createdAt: map['createdAt'],
    );
  }

  factory OfferModel.fromDomain(OfferEntity domain) {
    if (domain is OfferModel) return domain;
    return OfferModel(
      id: domain.id,
      rideId: domain.rideId,
      driverId: domain.driverId,
      driverName: domain.driverName,
      driverRating: domain.driverRating,
      price: domain.price,
      status: domain.status,
      createdAt: domain.createdAt,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'rideId': rideId,
      'driverId': driverId,
      'driverName': driverName,
      'driverRating': driverRating,
      'price': price,
      'status': status,
      'createdAt': createdAt,
    };
  }
}
