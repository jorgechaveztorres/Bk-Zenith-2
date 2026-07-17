import '../../../../core/services/firestore_service.dart';
import '../../../../core/logging/app_logger.dart';
import '../../../../core/telemetry/telemetry_service.dart';
import '../../domain/entities/user_entity.dart';
import '../../domain/repositories/user_repository.dart';
import '../models/user_model.dart';

class FirestoreUserRepository implements UserRepository {
  final FirestoreService _firestoreService;
  final TelemetryService _telemetry;

  FirestoreUserRepository(this._firestoreService, this._telemetry);

  @override
  Future<UserEntity?> getUserProfile(String uid) async {
    final startTime = DateTime.now();
    try {
      AppLogger.debug('getUserProfile called for uid: $uid');
      final doc = await _firestoreService.getDocument('users', uid);
      final latencyMs = DateTime.now().difference(startTime).inMilliseconds.toDouble();
      
      _telemetry.trackTransaction(uid, 'getUserProfile', 'success', latencyMs);

      if (!doc.exists || doc.data() == null) {
        AppLogger.warning('getUserProfile profile not found for uid: $uid');
        return null;
      }
      return UserModel.fromMap(doc.data()!);
    } catch (e) {
      AppLogger.error('getUserProfile failed for uid: $uid', error: e);
      _telemetry.trackFirebaseError('getUserProfile', e.toString(), e.toString());
      rethrow;
    }
  }

  @override
  Future<void> createUserProfile(UserEntity user) async {
    final startTime = DateTime.now();
    try {
      AppLogger.debug('createUserProfile called for uid: ${user.uid}');
      final model = UserModel.fromDomain(user);
      await _firestoreService.setDocument('users', user.uid, model.toMap());
      final latencyMs = DateTime.now().difference(startTime).inMilliseconds.toDouble();
      
      _telemetry.trackTransaction(user.uid, 'createUserProfile', 'success', latencyMs);
    } catch (e) {
      AppLogger.error('createUserProfile failed for uid: ${user.uid}', error: e);
      _telemetry.trackFirebaseError('createUserProfile', e.toString(), e.toString());
      rethrow;
    }
  }
}
