/// ============================================================================
/// ZENITH
/// Module : Pricing
/// Layer  : Presentation
/// Type   : Widget
/// File   : pricing_result_card.dart
/// ============================================================================

import 'package:flutter/material.dart';
import '../../domain/entities/pricing_response.dart';
import '../../domain/value_objects/confidence_level.dart';
import '../../domain/value_objects/risk_level.dart';

/// {@template pricing_result_card}
/// Tarjeta de resultados para la visualización del desglose de tarifas de ZÉNITH.
///
/// **Objetivo:** Mostrar con gran detalle estético y precisión el desglose matemático de la tarifa.
/// **Responsabilidad:** Renderizar la tarifa consolidada, multiplicadores, métricas de seguridad y el sello criptográfico.
/// **Dependencias:** [StatelessWidget], [PricingResponse]
/// **Restricciones:** Inmutable. No realiza cálculos matemáticos locales; consume datos de dominio ya procesados.
/// {@endtemplate}
class PricingResultCard extends StatelessWidget {
  /// {@macro pricing_result_card}
  const PricingResultCard({
    super.key,
    required this.response,
  });

  /// Entidad de dominio con los datos calculados e íntegros de la tarifa.
  final PricingResponse response;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    
    // Formateadores locales simples de visualización
    final currencyName = response.currency.name;
    final totalStr = '${response.protectedPrice.amount.toStringAsFixed(2)} $currencyName';
    final baseStr = '${response.basePrice.amount.toStringAsFixed(2)} $currencyName';
    final distStr = '${response.distancePrice.amount.toStringAsFixed(2)} $currencyName';
    final durStr = '${response.durationPrice.amount.toStringAsFixed(2)} $currencyName';

    return Card(
      elevation: 4,
      shadowColor: theme.colorScheme.shadow.withOpacity(0.15),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20.0),
        side: Border.all(
          color: theme.colorScheme.primary.withOpacity(0.15),
          width: 1.5,
        ),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20.0),
        child: Column(
          children: [
            // Cabecera de la Tarjeta - Estado Protegido
            Container(
              width: double.infinity,
              color: theme.colorScheme.primaryContainer.withOpacity(0.4),
              padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 14.0),
              child: Row(
                children: [
                  Icon(
                    response.isProtected ? Icons.gpp_good_rounded : Icons.lock_open_rounded,
                    color: response.isProtected ? Colors.green : theme.colorScheme.error,
                    size: 22,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      response.isProtected
                          ? 'COTIZACIÓN INTEGRAL PROTEGIDA'
                          : 'COTIZACIÓN ABIERTA / NO FIRMADA',
                      style: theme.textTheme.labelMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.8,
                        color: response.isProtected
                            ? Colors.green.shade800
                            : theme.colorScheme.error,
                      ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.primary,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      'v${response.pricingEngineVersion}',
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: theme.colorScheme.onPrimary,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Cuerpo Principal de la Cotización
            Padding(
              padding: const EdgeInsets.all(20.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Precio Consolidado Gigante
                  Center(
                    child: Column(
                      children: [
                        Text(
                          'Tarifa Final Estimada',
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          totalStr,
                          style: theme.textTheme.displayMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: theme.colorScheme.primary,
                            letterSpacing: -1,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Divider(height: 32),

                  // Desglose de Precios Base
                  _buildSectionHeader(theme, 'DESGLOSE DE COSTOS BASE'),
                  const SizedBox(height: 8),
                  _buildRow(theme, 'Tarifa Base Inicial', baseStr),
                  _buildRow(theme, 'Componente Distancia', distStr),
                  _buildRow(theme, 'Componente Duración', durStr),
                  
                  const SizedBox(height: 16),
                  
                  // Multiplicadores Aplicados
                  _buildSectionHeader(theme, 'MULTIPLICADORES DINÁMICOS'),
                  const SizedBox(height: 8),
                  _buildRow(theme, 'Factor Regional (Ciudad)', '${response.cityMultiplier.value.toStringAsFixed(2)}x'),
                  _buildRow(theme, 'Ajuste de Perfil Horario', '${response.timeProfileMultiplier.value.toStringAsFixed(2)}x'),
                  if (response.extensions.weatherFactor != null)
                    _buildRow(theme, 'Clima Adicional (Ext)', '${response.extensions.weatherFactor!.toStringAsFixed(2)}x'),
                  if (response.extensions.trafficFactor != null)
                    _buildRow(theme, 'Congestión Vial (Ext)', '${response.extensions.trafficFactor!.toStringAsFixed(2)}x'),
                  if (response.extensions.tollsCost != null && response.extensions.tollsCost! > 0)
                    _buildRow(theme, 'Peajes en Ruta (Ext)', '${response.extensions.tollsCost!.toStringAsFixed(2)} $currencyName'),

                  const SizedBox(height: 16),

                  // Métricas de Confianza y Calidad
                  _buildSectionHeader(theme, 'MÉTRICAS DE SEGURIDAD Y EQUIDAD'),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: _buildMetricTile(
                          theme,
                          'Índice de Equidad',
                          response.fairnessIndex.toString(),
                          Colors.blue,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildMetricTile(
                          theme,
                          'Score Confianza',
                          response.confidenceScore.toString(),
                          _getConfidenceColor(response.confidenceLevel),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: _buildStatusBadgeTile(
                          theme,
                          'Nivel de Confianza',
                          response.confidenceLevel.name,
                          _getConfidenceColor(response.confidenceLevel),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildStatusBadgeTile(
                          theme,
                          'Riesgo Operativo',
                          response.riskLevel.name,
                          _getRiskColor(response.riskLevel),
                        ),
                      ),
                    ],
                  ),

                  const Divider(height: 36),

                  // ID de Auditoría y Validez Temporal
                  _buildMetadataRow(theme, 'Audit Ledger ID', response.auditId),
                  _buildMetadataRow(theme, 'Quote ID', response.quoteId),
                  _buildMetadataRow(theme, 'Pipeline Versión', response.pipelineVersion),
                  _buildMetadataRow(theme, 'Fórmula Versión', response.pricingFormulaVersion),
                  _buildMetadataRow(theme, 'Fecha Emisión', response.generatedAt.toLocal().toString().substring(0, 19)),
                  _buildMetadataRow(
                    theme,
                    'Vence At',
                    response.expiresAt.toLocal().toString().substring(0, 19),
                    isHighlight: true,
                  ),

                  const SizedBox(height: 16),

                  // Sello Criptográfico - Panel Brutalista Seguro
                  Container(
                    padding: const EdgeInsets.all(12.0),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.onSurface.withOpacity(0.04),
                      borderRadius: BorderRadius.circular(12.0),
                      border: Border.all(
                        color: theme.colorScheme.onSurface.withOpacity(0.08),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          children: [
                            Icon(
                              Icons.verified_user_rounded,
                              size: 16,
                              color: theme.colorScheme.primary,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              'Sello Digital del Servidor (HMAC-SHA256)',
                              style: theme.textTheme.labelMedium?.copyWith(
                                fontWeight: FontWeight.bold,
                                color: theme.colorScheme.onSurface,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          response.pricingSeal.signature,
                          style: theme.textTheme.labelSmall?.copyWith(
                            fontFamily: 'monospace',
                            fontSize: 10,
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader(ThemeData theme, String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6.0),
      child: Text(
        title,
        style: theme.textTheme.labelSmall?.copyWith(
          color: theme.colorScheme.primary,
          fontWeight: FontWeight.bold,
          letterSpacing: 1.0,
        ),
      ),
    );
  }

  Widget _buildRow(ThemeData theme, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          Text(
            value,
            style: theme.textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.bold,
              color: theme.colorScheme.onSurface,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricTile(ThemeData theme, String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.all(10.0),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(12.0),
        border: Border.all(color: color.withOpacity(0.15)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: theme.textTheme.labelSmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusBadgeTile(ThemeData theme, String label, String status, Color color) {
    return Container(
      padding: const EdgeInsets.all(10.0),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainer,
        borderRadius: BorderRadius.circular(12.0),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: theme.textTheme.labelSmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: color.withOpacity(0.15),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: color.withOpacity(0.3)),
            ),
            child: Text(
              status,
              style: theme.textTheme.labelSmall?.copyWith(
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetadataRow(ThemeData theme, String label, String value, {bool isHighlight = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2.0),
      child: Row(
        children: [
          Text(
            '$label: ',
            style: theme.textTheme.labelSmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant.withOpacity(0.6),
            ),
          ),
          Expanded(
            child: Text(
              value,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.right,
              style: theme.textTheme.labelSmall?.copyWith(
                fontWeight: isHighlight ? FontWeight.bold : FontWeight.normal,
                color: isHighlight
                    ? theme.colorScheme.error
                    : theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Color _getConfidenceColor(ConfidenceLevel level) {
    switch (level) {
      case ConfidenceLevel.HIGH:
        return Colors.green;
      case ConfidenceLevel.MEDIUM:
        return Colors.orange;
      case ConfidenceLevel.LOW:
        return Colors.red;
    }
  }

  Color _getRiskColor(RiskLevel level) {
    switch (level) {
      case RiskLevel.NONE:
        return Colors.green;
      case RiskLevel.LOW:
        return Colors.blue;
      case RiskLevel.MEDIUM:
        return Colors.orange;
      case RiskLevel.HIGH:
        return Colors.red;
      case RiskLevel.CRITICAL:
        return Colors.red.shade900;
    }
  }
}
