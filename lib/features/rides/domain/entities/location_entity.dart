import 'package:equatable/equatable.dart';

class LocationEntity extends Equatable {
  final String address;
  final double lat;
  final double lng;
  final String? placeId;
  final String? formattedAddress;

  const LocationEntity({
    required this.address,
    required this.lat,
    required this.lng,
    this.placeId,
    this.formattedAddress,
  });

  @override
  List<Object?> get props => [address, lat, lng, placeId, formattedAddress];
}

