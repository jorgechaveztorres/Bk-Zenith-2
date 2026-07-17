/// ============================================================================
/// ZENITH
/// Module : Pricing
/// Layer  : Presentation
/// Type   : Widget
/// File   : pricing_error_widget.dart
/// ============================================================================

import 'package:flutter/material.dart';

/// {@template pricing_error_widget}
/// Widget de visualización de errores estilizado para el Zenith Pricing Engine™.
///
/// **Objetivo:** Informar fallos de comunicación con el motor de precios de forma clara y procesable.
/// **Responsabilidad:** Renderizar un panel descriptivo del error con un botón de acción rápida para reintentar.
/// **Dependencias:** [StatelessWidget]
/// **Restricciones:** Inmutable.
/// {@endtemplate}
class PricingErrorWidget extends StatelessWidget {
  /// {@macro pricing_error_widget}
  const PricingErrorWidget({
    super.key,
    required this.errorMessage,
    this.onRetry,
  });

  /// Mensaje o descripción técnica legible del error.
  final String errorMessage;

  /// Callback opcional ejecutado al pulsar el botón de reintento.
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24.0),
      decoration: BoxDecoration(
        color: theme.colorScheme.errorContainer.withOpacity(0.15),
        borderRadius: BorderRadius.circular(16.0),
        border: Border.all(
          color: theme.colorScheme.error.withOpacity(0.3),
          width: 1.5,
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.error_outline_rounded,
                color: theme.colorScheme.error,
                size: 28,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Error de Cotización',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: theme.colorScheme.error,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            errorMessage,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurface,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'El motor de auditoría matemática de ZÉNITH bloqueó la respuesta o detectó un error de red. Verifique sus parámetros de entrada e intente nuevamente.',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant.withOpacity(0.8),
            ),
          ),
          if (onRetry != null) ...[
            const SizedBox(height: 20),
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton.icon(
                onPressed: onRetry,
                style: FilledButton.styleFrom(
                  backgroundColor: theme.colorScheme.error,
                  foregroundColor: theme.colorScheme.onError,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                icon: const Icon(Icons.refresh_rounded, size: 18),
                label: const Text(
                  'Reintentar Cálculo',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
