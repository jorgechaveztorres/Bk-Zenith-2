/// ============================================================================
/// ZENITH
/// Module : Pricing
/// Layer  : Domain
/// Type   : Failure
/// File   : server_pricing_failure.dart
/// ============================================================================

import 'pricing_failure.dart';

/// {@template server_pricing_failure}
/// Error originado por caídas de red, fallas en Cloud Functions o timeouts.
/// {@endtemplate}
class ServerPricingFailure extends PricingFailure {
  /// {@macro server_pricing_failure}
  const ServerPricingFailure(super.message, {this.code});

  /// Código de error HTTP, Firestore o gRPC (opcional).
  final String? code;

  @override
  List<Object?> get props => [message, code];
}
