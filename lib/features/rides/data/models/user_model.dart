import '../../domain/entities/user_entity.dart';

class UserModel extends UserEntity {
  UserModel({
    required super.uid,
    required super.fullName,
    required super.email,
    required super.role,
    required super.rating,
  });

  factory UserModel.fromMap(Map<String, dynamic> map) {
    return UserModel(
      uid: map['uid'] as String? ?? '',
      fullName: map['fullName'] as String? ?? '',
      email: map['email'] as String? ?? '',
      role: map['role'] as String? ?? 'passenger',
      rating: (map['rating'] as num?)?.toDouble() ?? 5.0,
    );
  }

  factory UserModel.fromDomain(UserEntity domain) {
    if (domain is UserModel) return domain;
    return UserModel(
      uid: domain.uid,
      fullName: domain.fullName,
      email: domain.email,
      role: domain.role,
      rating: domain.rating,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'uid': uid,
      'fullName': fullName,
      'email': email,
      'role': role,
      'rating': rating,
    };
  }
}
