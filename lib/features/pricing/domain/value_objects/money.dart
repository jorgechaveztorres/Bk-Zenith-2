import 'package:equatable/equatable.dart';
import 'package:meta/meta.dart';
import '../exceptions/pricing_validation_exception.dart';
import 'currency.dart';

/// {@template money}
/// Objeto de valor inmutable que representa importes monetarios de forma inmutable y segura.
///
/// **Objetivo:** Prevenir problemas de precisión financiera y acoplamiento con tipos primitivos.
/// **Responsabilidad:** Encapsular la combinación del importe numérico y su divisa correspondiente.
/// **Dependencias:** [Currency], [PricingValidationException], [Equatable]
/// **Restricciones:** El importe numérico debe ser mayor o igual a cero.
/// **Ejemplo de uso:** `final price = Money(15.50, Currency.PEN);`
/// {@endtemplate}
@immutable
class Money extends Equatable {
  /// {@macro money}
  Money(this.amount, this.currency) {
    if (amount < 0.0) {
      throw PricingValidationException(
        'El importe monetario no puede ser negativo ($amount).',
        property: 'amount',
      );
    }
  }

  /// Importe monetario neto.
  final double amount;

  /// Divisa del importe monetario.
  final Currency currency;

  @override
  List<Object?> get props => [amount, currency];

  @override
  String toString() => '$amount ${currency.name}';
}
