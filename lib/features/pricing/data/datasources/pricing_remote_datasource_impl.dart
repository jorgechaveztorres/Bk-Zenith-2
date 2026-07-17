/// ============================================================================
/// ZENITH
/// Module : Pricing
/// Layer  : Data
/// Type   : DataSource
/// File   : pricing_remote_datasource_impl.dart
/// ============================================================================

import 'package:cloud_functions/cloud_functions.dart';
import '../dto/pricing_request_dto.dart';
import '../dto/pricing_response_dto.dart';
import 'pricing_remote_datasource.dart';

/// {@template pricing_remote_datasource_impl}
/// Implementación oficial de la fuente de datos remota del Zenith Pricing Engine™.
///
/// **Objetivo:** Integrar el canal de red con los microservicios de cálculo de tarifas.
/// **Responsabilidad:** Consumir de forma segura la Firebase Cloud Function "calculatePricing".
/// **Dependencias:** [FirebaseFunctions], [PricingRemoteDataSource], [PricingRequestDto], [PricingResponseDto]
/// **Restricciones:** En cumplimiento estricto de la DIRECTIVA 9, consume exclusivamente la Cloud Function sin lógica de negocio local.
///
/// ### Arquitectura de Integración: Cloud Functions Callable v2
/// Esta clase está diseñada para interactuar bajo la especificación de Firebase Cloud Functions v2.
/// Es fundamental distinguir los dos entornos que componen este flujo:
///
/// 1. **Comportamiento del SDK Client-Side (Flutter):**
///    - **Serialización Automática:** El SDK codifica automáticamente los tipos primitivos, listas y mapas pasados como argumentos a JSON.
///    - **Contexto e Identidad:** Inyecta automáticamente metadatos en la cabecera HTTP, incluyendo el token de autenticación del usuario actual (Firebase Auth ID Token) y el token de integridad del dispositivo (Firebase App Check).
///    - **Desencapsulado (Unwrapping):** El SDK recibe la respuesta estructurada desde el servidor (que llega envuelta en un nodo `result`), la valida y extrae el payload interno de manera transparente para entregarlo en [HttpsCallableResult.data].
///    - **Manejo Estándar de Excepciones:** Si el backend responde con un código de error gRPC/HTTP estandarizado, el SDK lo traduce en una excepción tipada de tipo [FirebaseFunctionsException] para su captura controlada.
///
/// 2. **Comportamiento del Servidor-Side (Firebase Functions v2):**
///    - **Infraestructura Cloud Run:** A diferencia de v1, las funciones Callable v2 corren sobre Google Cloud Run, permitiendo configurar concurrencia avanzada, tiempos de ejecución optimizados, asignación directa de memoria y reducción de arranques en frío (cold starts).
///    - **CORS Integrado:** Las llamadas Callable v2 administran cabeceras CORS de manera nativa para solicitudes seguras desde navegadores.
///    - **Trigger onCall:** En la función declarada en el backend mediante el decorador `onCall`, los datos de entrada se reciben ya deserializados (en el objeto `request.data`) y se cuenta con el contexto del usuario autenticado en `request.auth` sin necesidad de decodificar tokens JWT manualmente.
/// {@endtemplate}
class PricingRemoteDataSourceImpl implements PricingRemoteDataSource {
  /// {@macro pricing_remote_datasource_impl}
  const PricingRemoteDataSourceImpl({
    required FirebaseFunctions firebaseFunctions,
  }) : _firebaseFunctions = firebaseFunctions;

  final FirebaseFunctions _firebaseFunctions;

  /// Realiza el cálculo de tarifas consumiendo la Cloud Function Callable v2 "calculatePricing".
  ///
  /// **Timeout Configurable (Estructura Preparada):**
  /// Para configurar un timeout personalizado en el futuro, se puede instanciar [HttpsCallableOptions]
  /// pasándole un parámetro de duración, por ejemplo:
  /// ```dart
  /// final options = HttpsCallableOptions(timeout: const Duration(seconds: 30));
  /// final callable = _firebaseFunctions.httpsCallable('calculatePricing', options: options);
  /// ```
  /// Actualmente no se ha implementado un timeout explícito, permitiendo que herede el por defecto.
  @override
  Future<PricingResponseDto> calculatePricing(PricingRequestDto request) async {
    try {
      // Consumir exclusivamente la Cloud Function Callable v2 llamada 'calculatePricing'
      final HttpsCallable callable = _firebaseFunctions.httpsCallable('calculatePricing');
      
      // Serializar JSON
      final Map<String, dynamic> requestJson = request.toJson();
      
      // Llamar a la Cloud Function
      final HttpsCallableResult result = await callable.call(requestJson);
      
      // Recibir JSON y validar que no sea nulo
      final dynamic data = result.data;
      if (data == null) {
        throw FirebaseFunctionsException(
          message: 'La función "calculatePricing" retornó datos vacíos (null).',
          code: 'empty-response',
          details: null,
        );
      }
      
      // Validar que realmente sea un Map
      if (data is! Map) {
        throw FirebaseFunctionsException(
          message: 'La función "calculatePricing" retornó un formato de datos inválido. Se esperaba un Map.',
          code: 'invalid-response-type',
          details: data,
        );
      }
      
      // Convertir de forma profunda y segura a Map<String, dynamic> para mitigar
      // riesgos de conversión (cast inválido, Map<Object?, Object?>, Map<dynamic, dynamic>, etc.)
      final Map<String, dynamic> jsonMap;
      try {
        jsonMap = _safeConvertMap(data);
      } on Object catch (conversionError) {
        // Justificación: Capturamos cualquier error de estructura o clave durante la conversión de tipo
        // y lo convertimos a una FirebaseFunctionsException explícita con detalles técnicos.
        throw FirebaseFunctionsException(
          message: 'Los datos retornados por "calculatePricing" no cumplen con un formato Map<String, dynamic> válido.',
          code: 'invalid-format',
          details: conversionError,
        );
      }
      
      return PricingResponseDto.fromJson(jsonMap);
    } on FirebaseFunctionsException {
      // Justificación: Propagamos las excepciones específicas de Firebase Cloud Functions
      // de forma transparente para permitir su correcto mapeo o consumo en capas superiores.
      rethrow;
    } on Object catch (unexpectedError) {
      // Justificación: Capturar 'Object' en lugar de 'e' o 'Exception' garantiza atrapar absolutamente
      // cualquier fallo (como errores de red, violaciones de aserciones o problemas de runtime del motor)
      // de la forma más robusta posible dentro de la plataforma Dart.
      throw FirebaseFunctionsException(
        message: 'Error inesperado durante la ejecución de calculatePricing: $unexpectedError',
        code: 'unexpected-error',
        details: unexpectedError,
      );
    }
  }

  /// Realiza una conversión profunda y segura de un objeto Map dinámico a [Map<String, dynamic>],
  /// previniendo el riesgo de excepciones por conversión de tipos inválidos en estructuras anidadas.
  Map<String, dynamic> _safeConvertMap(Map<dynamic, dynamic> source) {
    final Map<String, dynamic> target = <String, dynamic>{};
    for (final MapEntry<dynamic, dynamic> entry in source.entries) {
      final dynamic key = entry.key;
      if (key is! String) {
        throw FirebaseFunctionsException(
          message: 'La respuesta de la Cloud Function contiene una clave que no es de tipo String: $key (${key.runtimeType})',
          code: 'invalid-key-type',
          details: source,
        );
      }
      target[key] = _safeConvertValue(entry.value);
    }
    return target;
  }

  /// Convierte de forma recursiva valores dentro de las estructuras para asegurar que cualquier
  /// estructura de mapa anidada sea debidamente convertida a [Map<String, dynamic>].
  dynamic _safeConvertValue(dynamic value) {
    if (value is Map) {
      return _safeConvertMap(value);
    } else if (value is List) {
      return value.map(_safeConvertValue).toList();
    }
    return value;
  }
}
