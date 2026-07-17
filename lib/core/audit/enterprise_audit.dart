import 'package:get_it/get_it.dart';
import '../logging/app_logger.dart';
import '../telemetry/telemetry_service.dart';
import '../../features/pricing/domain/repositories/pricing_repository.dart';
import '../../features/rides/domain/repositories/ride_repository.dart';
import '../../features/rides/domain/repositories/user_repository.dart';
import '../../features/rides/domain/repositories/offer_repository.dart';
import '../../features/rides/domain/repositories/location_repository.dart';

class EnterpriseAuditReport {
  final bool isHealthy;
  final List<String> issues;
  final Map<String, dynamic> metadata;

  EnterpriseAuditReport({
    required this.isHealthy,
    required this.issues,
    required this.metadata,
  });

  @override
  String toString() {
    return 'EnterpriseAuditReport(isHealthy: $isHealthy, issuesCount: ${issues.length}, metadata: $metadata)';
  }
}

class EnterpriseAudit {
  final GetIt _locator;

  EnterpriseAudit({GetIt? locator}) : _locator = locator ?? GetIt.instance;

  Future<EnterpriseAuditReport> runFullSystemAudit() async {
    AppLogger.info('Starting full system Enterprise Audit...');
    final List<String> issues = [];
    final Map<String, dynamic> auditMeta = {};

    // 1. Verify DI Registrations
    final diStatus = _verifyDependencyInjections(issues);
    auditMeta['di_status'] = diStatus;

    // 2. Verify Pricing Engine Integrity & Seals
    final pricingIntegrity = _verifyPricingEngineIntegrity(issues);
    auditMeta['pricing_integrity'] = pricingIntegrity;

    // 3. Inspect Telemetry & Metrics
    final telemetryMetrics = _verifyTelemetryAndMetrics(issues);
    auditMeta['telemetry_summary'] = telemetryMetrics;

    final isHealthy = issues.isEmpty;
    AppLogger.info('Enterprise Audit Completed. System Health: ${isHealthy ? "PASS" : "FAIL"}. Issues found: ${issues.length}');
    if (!isHealthy) {
      for (final issue in issues) {
        AppLogger.warning('[AUDIT-ISSUE] $issue');
      }
    }

    return EnterpriseAuditReport(
      isHealthy: isHealthy,
      issues: issues,
      metadata: {
        'timestamp': DateTime.now().toUtc().toIso8601String(),
        'di_registrations': diStatus,
        'pricing': pricingIntegrity,
        'telemetry': telemetryMetrics,
      },
    );
  }

  Map<String, bool> _verifyDependencyInjections(List<String> issues) {
    final Map<String, bool> status = {};

    final requiredRegistrations = {
      'TelemetryService': TelemetryService,
      'PricingRepository': PricingRepository,
      'RideRepository': RideRepository,
      'UserRepository': UserRepository,
      'OfferRepository': OfferRepository,
      'LocationRepository': LocationRepository,
    };

    requiredRegistrations.forEach((name, type) {
      try {
        final registered = _locator.isRegistered(type: type);
        status[name] = registered;
        if (!registered) {
          issues.add('Service Locator: $name is not registered in GetIt container.');
        }
      } catch (e) {
        status[name] = false;
        issues.add('Service Locator: Error checking registration for $name: $e');
      }
    });

    return status;
  }

  Map<String, dynamic> _verifyPricingEngineIntegrity(List<String> issues) {
    final Map<String, dynamic> summary = {};
    try {
      final hasRepo = _locator.isRegistered<PricingRepository>();
      summary['pricing_repository_registered'] = hasRepo;
      
      if (hasRepo) {
        final repo = _locator<PricingRepository>();
        summary['pricing_repository_type'] = repo.runtimeType.toString();
      } else {
        issues.add('Pricing: PricingRepository contract missing in DI.');
      }
    } catch (e) {
      summary['error'] = e.toString();
      issues.add('Pricing Integrity Check Failed: $e');
    }
    return summary;
  }

  Map<String, dynamic> _verifyTelemetryAndMetrics(List<String> issues) {
    final Map<String, dynamic> summary = {};
    try {
      final hasTelemetry = _locator.isRegistered<TelemetryService>();
      summary['telemetry_service_registered'] = hasTelemetry;
      
      if (hasTelemetry) {
        final telemetry = _locator<TelemetryService>();
        final metrics = telemetry.getMetrics();
        summary['total_recorded_metrics'] = metrics.length;
        summary['categories_count'] = metrics.map((m) => m['category']).toSet().length;
        
        final slowTransactions = metrics.where((m) => m['category'] == 'Transaction' && (m['value'] ?? 0.0) > 3000.0).toList();
        if (slowTransactions.isNotEmpty) {
          issues.add('Performance: Found ${slowTransactions.length} transaction(s) exceeding 3000ms SLA.');
        }
      } else {
        issues.add('Telemetry: TelemetryService missing from Service Locator.');
      }
    } catch (e) {
      summary['error'] = e.toString();
      issues.add('Telemetry Audit Failed: $e');
    }
    return summary;
  }
}
