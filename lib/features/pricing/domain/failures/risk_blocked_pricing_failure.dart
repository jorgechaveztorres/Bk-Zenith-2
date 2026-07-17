/// ============================================================================
/// ZENITH
/// Module : Pricing
/// Layer  : Domain
/// Type   : Failure
/// File   : risk_blocked_pricing_failure.dart
/// ============================================================================

import 'pricing_failure.dart';

/// {@template risk_blocked_pricing_failure}
/// Falla de seguridad donde el motor de riesgos ha bloqueado o denegado la cotización (e.g., spoofing, fraude).
/// {@endtemplate}
class RiskBlockedPricingFailure extends PricingFailure {
  /// {@macro risk_blocked_pricing_failure}
  const RiskBlockedPricingFailure(super.message) : super();
}
