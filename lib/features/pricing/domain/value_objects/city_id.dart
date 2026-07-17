import '../exceptions/pricing_validation_exception.dart';

/// {@template city_id}
/// Identificador fuerte de las ciudades soportadas oficialmente por la red ZÉNITH.
/// Previene errores de consistencia en el direccionamiento de tarifas regionales.
///
/// **Objetivo:** Garantizar que solo ciudades configuradas y autorizadas puedan cotizar.
/// **Responsabilidad:** Validar y tipar la región geográfica de operación.
/// **Dependencias:** [PricingValidationException]
/// **Restricciones:** No nulo, valor debe coincidir con el catálogo activo.
/// **Riesgos:** Lanzará excepción si la cadena no coincide exactamente.
/// {@endtemplate}
enum CityId {
  /// Lima Metropolitana y Callao.
  PE_LIMA,

  /// Ciudad de Trujillo.
  PE_TRUJILLO,

  /// Ciudad de Piura.
  PE_PIURA,

  /// Ciudad de Chiclayo.
  PE_CHICLAYO,

  /// Ciudad de Arequipa.
  PE_AREQUIPA;

  /// Obtiene un [CityId] desde una cadena de texto, de manera segura.
  static CityId fromString(String value) {
    return CityId.values.firstWhere(
      (e) => e.name == value.toUpperCase(),
      orElse: () => throw PricingValidationException(
        'Ciudad no soportada en ZÉNITH: $value',
        property: 'cityId',
      ),
    );
  }
}
