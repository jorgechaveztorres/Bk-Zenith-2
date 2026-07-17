import '../entities/user_entity.dart';
import '../repositories/user_repository.dart';

/// {@template get_user_profile_usecase}
/// Caso de Uso que encapsula la recuperación del perfil de usuario (pasajero u operador).
/// {@endtemplate}
class GetUserProfileUseCase {
  final UserRepository _repository;

  GetUserProfileUseCase(this._repository);

  Future<UserEntity?> execute(String uid) async {
    return await _repository.getUserProfile(uid);
  }
}

