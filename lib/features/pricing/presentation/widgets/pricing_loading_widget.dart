/// ============================================================================
/// ZENITH
/// Module : Pricing
/// Layer  : Presentation
/// Type   : Widget
/// File   : pricing_loading_widget.dart
/// ============================================================================

import 'package:flutter/material.dart';

/// {@template pricing_loading_widget}
/// Indicador de carga altamente estilizado y adaptado a la línea visual de ZÉNITH.
///
/// **Objetivo:** Informar al usuario que el cálculo tarifario seguro en la Cloud Function está en progreso.
/// **Responsabilidad:** Renderizar una interfaz fluida con micro-animaciones o spinners de Material 3.
/// **Dependencias:** [StatelessWidget], [CircularProgressIndicator]
/// **Restricciones:** Inmutable, sin lógica de estado.
/// {@endtemplate}
class PricingLoadingWidget extends StatelessWidget {
  /// {@macro pricing_loading_widget}
  const PricingLoadingWidget({
    super.key,
    this.message = 'Consultando tarifas seguras con el motor ZÉNITH...',
  });

  /// Mensaje descriptivo a mostrar bajo el indicador de progreso.
  final String message;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    
    return Center(
      child: Container(
        padding: const EdgeInsets.all(24.0),
        decoration: BoxDecoration(
          color: theme.colorScheme.surfaceContainerHighest.withOpacity(0.3),
          borderRadius: BorderRadius.circular(16.0),
          border: Border.all(
            color: theme.colorScheme.outlineVariant.withOpacity(0.5),
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            const SizedBox(
              width: 48,
              height: 48,
              child: CircularProgressIndicator(
                strokeWidth: 4.0,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              message,
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w500,
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Firmando criptográficamente en Cloud Functions v2',
              textAlign: TextAlign.center,
              style: theme.textTheme.labelSmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant.withOpacity(0.6),
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
