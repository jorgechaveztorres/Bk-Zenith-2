import 'package:equatable/equatable.dart';
import 'package:meta/meta.dart';
import '../exceptions/pricing_validation_exception.dart';

/// {@template pricing_seal}
/// Objeto de valor inmutable que representa el Sello Criptográfico de integridad de ZÉNITH.
///
/// **Objetivo:** Certificar mediante firma digital del backend que una cotización es legítima y no ha sido alterada localmente.
/// **Responsabilidad:** Garantizar la no-repudiación y la consistencia criptográfica del cálculo.
/// **Dependencias:** [PricingValidationException], [Equatable]
/// **Restricciones:** No nulo, no vacío. Representa la firma lógica, no un token de autenticación.
/// **Ejemplo de uso:** `final seal = PricingSeal('sha256-abc123xyz...');`
/// {@endtemplate}
@immutable
class PricingSeal extends Equatable {
  /// {@macro pricing_seal}
  PricingSeal(this.signature) {
    if (signature.isEmpty) {
      throw const PricingValidationException(
        'El sello criptográfico del precio no puede estar vacío.',
        property: 'pricingSeal',
      );
    }
  }

  /// Firma lógica o hash criptográfico generado por el backend oficial de ZÉNITH.
  final String signature;

  @override
  List<Object?> get props => [signature];

  @override
  String toString() => signature;
}
