import '../../domain/entities/location_entity.dart';

class LocationModel extends LocationEntity {
  LocationModel({
    required super.address,
    required super.lat,
    required super.lng,
    super.placeId,
    super.formattedAddress,
  });

  factory LocationModel.fromMap(Map<String, dynamic> map) {
    return LocationModel(
      address: map['address'] as String? ?? '',
      lat: (map['lat'] as num?)?.toDouble() ?? 0.0,
      lng: (map['lng'] as num?)?.toDouble() ?? 0.0,
      placeId: map['placeId'] as String?,
      formattedAddress: map['formattedAddress'] as String?,
    );
  }

  factory LocationModel.fromDomain(LocationEntity domain) {
    if (domain is LocationModel) return domain;
    return LocationModel(
      address: domain.address,
      lat: domain.lat,
      lng: domain.lng,
      placeId: domain.placeId,
      formattedAddress: domain.formattedAddress,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'address': address,
      'lat': lat,
      'lng': lng,
      if (placeId != null) 'placeId': placeId,
      if (formattedAddress != null) 'formattedAddress': formattedAddress,
    };
  }
}
