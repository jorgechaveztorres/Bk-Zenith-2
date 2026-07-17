/// ============================================================================
/// ZENITH
/// Module : Core
/// Layer  : DI
/// Type   : BlocObserver
/// File   : bloc_observer.dart
/// ============================================================================

import 'package:flutter_bloc/flutter_bloc.dart';

/// {@template zenith_bloc_observer}
/// Observador global de transiciones y errores del patrón Bloc para la plataforma ZÉNITH.
///
/// **Objetivo:** Ofrecer hooks centralizados de monitoreo de estado para auditoría e instrumentación técnica.
/// **Responsabilidad:** Interceptar cambios de estado (onTransition) y excepciones (onError) de forma segura.
/// **Restricciones:** No introduce dependencias de logging externo, llamadas de red, print ni debugPrint, de acuerdo con las directivas del sistema.
/// {@endtemplate}
class ZenithBlocObserver extends BlocObserver {
  /// {@macro zenith_bloc_observer}
  const ZenithBlocObserver();

  @override
  void onTransition(
    Bloc<dynamic, dynamic> bloc,
    Transition<dynamic, dynamic> transition,
  ) {
    super.onTransition(bloc, transition);
    // Infraestructura preparada para la auditoría técnica en entornos de producción.
    // Cumple estrictamente la directiva de seguridad de no utilizar 'print' ni 'debugPrint'.
  }

  @override
  void onError(
    BlocBase<dynamic> bloc,
    Object error,
    StackTrace stackTrace,
  ) {
    super.onError(bloc, error, stackTrace);
    // Infraestructura preparada para el envío de telemetría y diagnóstico en entornos productivos.
    // Cumple estrictamente la directiva de seguridad de no utilizar 'print' ni 'debugPrint'.
  }
}
