import 'package:equatable/equatable.dart';

class UserEntity extends Equatable {
  final String uid;
  final String fullName;
  final String email;
  final String role; // 'passenger' or 'driver'
  final double rating;

  const UserEntity({
    required this.uid,
    required this.fullName,
    required this.email,
    required this.role,
    required this.rating,
  });

  @override
  List<Object?> get props => [uid, fullName, email, role, rating];
}

