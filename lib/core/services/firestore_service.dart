import 'package:cloud_firestore/cloud_firestore.dart';

class QueryFilter {
  final String field;
  final String operator; // '==', '<', '<=', '>', '>=', 'arrayContains', 'arrayContainsAny', 'in'
  final dynamic value;

  QueryFilter(this.field, this.operator, this.value);
}

class QueryOrder {
  final String field;
  final bool descending;

  QueryOrder(this.field, {this.descending = false});
}

class FirestoreEnterpriseException implements Exception {
  final String code;
  final String message;
  final String originalError;
  final String? path;

  FirestoreEnterpriseException({
    required this.code,
    required this.message,
    required this.originalError,
    this.path,
  });

  @override
  String toString() {
    return 'FirestoreEnterpriseException(code: $code, message: $message, path: $path, originalError: $originalError)';
  }
}

class FirestoreService {
  final FirebaseFirestore _firestore;

  FirestoreService({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance {
    // Prioridad 8: Preparar soporte para persistencia offline.
    // En Flutter, la persistencia offline está habilitada por defecto en plataformas móviles.
    // Para entornos web u otros ajustes, podemos configurarla si es necesario.
  }

  // Helper to map and classify Firestore Errors safely as per Prioridad 7
  void _handleException(Object error, {String? path}) {
    if (error is FirebaseException) {
      final code = error.code;
      String friendlyMessage = 'Ocurrió un error inesperado en la base de datos.';

      switch (code) {
        case 'permission-denied':
          friendlyMessage = 'Acceso denegado. No tienes permisos suficientes para realizar esta acción.';
          break;
        case 'aborted':
          friendlyMessage = 'La transacción fue abortada. Por favor, reintente de nuevo.';
          break;
        case 'unavailable':
          friendlyMessage = 'El servicio de base de datos no está disponible actualmente. Conexión inestable.';
          break;
        case 'deadline-exceeded':
          friendlyMessage = 'Tiempo de espera agotado al conectar con el servidor.';
          break;
        case 'not-found':
          friendlyMessage = 'El documento solicitado no fue encontrado.';
          break;
        case 'already-exists':
          friendlyMessage = 'El documento que intentas crear ya existe en el sistema.';
          break;
        case 'failed-precondition':
          friendlyMessage = 'Precondición fallida. La operación requiere que el sistema esté en un estado específico.';
          break;
      }

      throw FirestoreEnterpriseException(
        code: code,
        message: friendlyMessage,
        originalError: error.toString(),
        path: path,
      );
    }

    throw FirestoreEnterpriseException(
      code: 'unknown',
      message: 'Error inesperado: ${error.toString()}',
      originalError: error.toString(),
      path: path,
    );
  }

  // Watch collection with dynamic filters, orderBy, and limit (Prioridad 6)
  Stream<List<QueryDocumentSnapshot<Map<String, dynamic>>>> watchCollection(
    String collectionPath, {
    List<QueryFilter>? filters,
    List<QueryOrder>? orders,
    int? limit,
    DocumentSnapshot? startAfter,
    DocumentSnapshot? endBefore,
  }) {
    try {
      Query<Map<String, dynamic>> query = _firestore.collection(collectionPath);
      query = _applyQueryModifiers(query, filters, orders, limit, startAfter, endBefore);
      return query.snapshots().map((event) => event.docs);
    } catch (e) {
      _handleException(e, path: collectionPath);
      rethrow;
    }
  }

  // Watch collectionGroup with dynamic filters (Prioridad 6)
  Stream<List<QueryDocumentSnapshot<Map<String, dynamic>>>> watchCollectionGroup(
    String collectionId, {
    List<QueryFilter>? filters,
    List<QueryOrder>? orders,
    int? limit,
    DocumentSnapshot? startAfter,
    DocumentSnapshot? endBefore,
  }) {
    try {
      Query<Map<String, dynamic>> query = _firestore.collectionGroup(collectionId);
      query = _applyQueryModifiers(query, filters, orders, limit, startAfter, endBefore);
      return query.snapshots().map((event) => event.docs);
    } catch (e) {
      _handleException(e, path: 'collectionGroup: $collectionId');
      rethrow;
    }
  }

  // Watch subcollection with dynamic filters
  Stream<List<QueryDocumentSnapshot<Map<String, dynamic>>>> watchSubcollection(
    String parentCollection,
    String parentId,
    String subcollection,
  ) {
    final path = '$parentCollection/$parentId/$subcollection';
    try {
      return _firestore
          .collection(parentCollection)
          .doc(parentId)
          .collection(subcollection)
          .snapshots()
          .map((event) => event.docs);
    } catch (e) {
      _handleException(e, path: path);
      rethrow;
    }
  }

  // Get a single document
  Future<DocumentSnapshot<Map<String, dynamic>>> getDocument(
    String collectionPath,
    String docId,
  ) async {
    final path = '$collectionPath/$docId';
    try {
      return await _firestore.collection(collectionPath).doc(docId).get();
    } catch (e) {
      _handleException(e, path: path);
      rethrow;
    }
  }

  // Watch a single document
  Stream<DocumentSnapshot<Map<String, dynamic>>> watchDocument(
    String collectionPath,
    String docId,
  ) {
    final path = '$collectionPath/$docId';
    try {
      return _firestore.collection(collectionPath).doc(docId).snapshots();
    } catch (e) {
      _handleException(e, path: path);
      rethrow;
    }
  }

  // Add document (returns auto-generated ID reference)
  Future<DocumentReference<Map<String, dynamic>>> addDocument(
    String collectionPath,
    Map<String, dynamic> data,
  ) async {
    try {
      return await _firestore.collection(collectionPath).add(data);
    } catch (e) {
      _handleException(e, path: collectionPath);
      rethrow;
    }
  }

  // Set document with merge options
  Future<void> setDocument(
    String collectionPath,
    String docId,
    Map<String, dynamic> data, {
    bool merge = true,
  }) async {
    final path = '$collectionPath/$docId';
    try {
      await _firestore
          .collection(collectionPath)
          .doc(docId)
          .set(data, SetOptions(merge: merge));
    } catch (e) {
      _handleException(e, path: path);
      rethrow;
    }
  }

  // Update document
  Future<void> updateDocument(
    String collectionPath,
    String docId,
    Map<String, dynamic> data,
  ) async {
    final path = '$collectionPath/$docId';
    try {
      await _firestore.collection(collectionPath).doc(docId).update(data);
    } catch (e) {
      _handleException(e, path: path);
      rethrow;
    }
  }

  // Delete document
  Future<void> deleteDocument(String collectionPath, String docId) async {
    final path = '$collectionPath/$docId';
    try {
      await _firestore.collection(collectionPath).doc(docId).delete();
    } catch (e) {
      _handleException(e, path: path);
      rethrow;
    }
  }

  // Prioridad 2: Transacciones atómicas
  Future<T> runTransaction<T>(Future<T> Function(Transaction transaction) transactionHandler) async {
    try {
      return await _firestore.runTransaction(transactionHandler);
    } catch (e) {
      _handleException(e, path: 'transaction');
      rethrow;
    }
  }

  // Prioridad 3: Write Batch
  WriteBatch batch() {
    return _firestore.batch();
  }

  // Helper to apply filters, orders, and pagination
  Query<Map<String, dynamic>> _applyQueryModifiers(
    Query<Map<String, dynamic>> query,
    List<QueryFilter>? filters,
    List<QueryOrder>? orders,
    int? limitVal,
    DocumentSnapshot? startAfter,
    DocumentSnapshot? endBefore,
  ) {
    var modifiedQuery = query;

    if (filters != null) {
      for (final filter in filters) {
        switch (filter.operator) {
          case '==':
            modifiedQuery = modifiedQuery.where(filter.field, isEqualTo: filter.value);
            break;
          case '<':
            modifiedQuery = modifiedQuery.where(filter.field, isLessThan: filter.value);
            break;
          case '<=':
            modifiedQuery = modifiedQuery.where(filter.field, isLessThanOrEqualTo: filter.value);
            break;
          case '>':
            modifiedQuery = modifiedQuery.where(filter.field, isGreaterThan: filter.value);
            break;
          case '>=':
            modifiedQuery = modifiedQuery.where(filter.field, isGreaterThanOrEqualTo: filter.value);
            break;
          case 'arrayContains':
          case 'array-contains':
            modifiedQuery = modifiedQuery.where(filter.field, arrayContains: filter.value);
            break;
          case 'arrayContainsAny':
          case 'array-contains-any':
            modifiedQuery = modifiedQuery.where(filter.field, arrayContainsAny: filter.value as List<dynamic>);
            break;
          case 'in':
            modifiedQuery = modifiedQuery.where(filter.field, whereIn: filter.value as List<dynamic>);
            break;
        }
      }
    }

    if (orders != null) {
      for (final order in orders) {
        modifiedQuery = modifiedQuery.orderBy(order.field, descending: order.descending);
      }
    }

    if (startAfter != null) {
      modifiedQuery = modifiedQuery.startAfterDocument(startAfter);
    }

    if (endBefore != null) {
      modifiedQuery = modifiedQuery.endBeforeDocument(endBefore);
    }

    if (limitVal != null) {
      modifiedQuery = modifiedQuery.limit(limitVal);
    }

    return modifiedQuery;
  }
}
