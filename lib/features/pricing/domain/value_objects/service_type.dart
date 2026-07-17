import '../exceptions/pricing_validation_exception.dart';

/// {@template service_type}
/// Tipo de servicio ofertable en la plataforma ZÉNITH.
/// Determina la fórmula específica, tarifas base y multiplicadores de confort.
///
/// **Objetivo:** Tipar fuertemente las categorías de servicio de movilidad.
/// **Responsabilidad:** Asegurar consistencia en la selección del tipo de servicio.
/// **Dependencias:** [PricingValidationException]
/// **Restricciones:** No nulo, debe coincidir con las categorías permitidas.
/// **Riesgos:** Una categoría inválida abortará la cotización.
/// {@endtemplate}
enum ServiceType {
  /// Servicio estándar accesible para movilidad del día a día.
  standard,

  /// Servicio intermedio con mayor confort y vehículos modernos.
  comfort,

  /// Servicio corporativo o de alta gama con máxima experiencia premium.
  premium,

  /// Servicio logístico de última milla para mensajería y paquetería.
  delivery;

  /// Obtiene un [ServiceType] desde una cadena de texto, de manera segura.
  static ServiceType fromString(String value) {
    return ServiceType.values.firstWhere(
      (e) => e.name == value.toLowerCase(),
      orElse: () => throw PricingValidationException(
        'Tipo de servicio inválido: $value',
        property: 'serviceType',
      ),
    );
  }
}
