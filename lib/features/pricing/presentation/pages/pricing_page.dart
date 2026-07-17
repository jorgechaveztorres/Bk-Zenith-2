/// ============================================================================
/// ZENITH
/// Module : Pricing
/// Layer  : Presentation
/// Type   : Page
/// File   : pricing_page.dart
/// ============================================================================

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/di/service_locator.dart';
import '../bloc/pricing_bloc.dart';
import '../widgets/pricing_view.dart';

/// {@template pricing_page}
/// Pantalla principal del módulo de Pricing para el Zenith Pricing Engine™.
///
/// **Objetivo:** Servir como contenedor primario y punto de entrada visual para el cálculo tarifario.
/// **Responsabilidad:** Inyectar una instancia fresca de [PricingBloc] mediante [BlocProvider] utilizando [GetIt] (sl), y hospedar la [PricingView].
/// **Dependencias:** [StatelessWidget], [BlocProvider], [PricingBloc], [PricingView], [GetIt]
/// **Restricciones:** No contiene lógica de negocio ni variables de estado locales.
/// {@endtemplate}
class PricingPage extends StatelessWidget {
  /// {@macro pricing_page}
  const PricingPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'ZÉNITH PRICING ENGINE',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            letterSpacing: 1.2,
            fontSize: 18,
          ),
        ),
        centerTitle: true,
        elevation: 0,
        backgroundColor: Colors.transparent,
      ),
      body: SafeArea(
        child: BlocProvider<PricingBloc>(
          create: (BuildContext context) => sl<PricingBloc>(),
          child: const PricingView(),
        ),
      ),
    );
  }
}
