import 'package:bloc/bloc.dart';
import '../../domain/usecases/calculate_pricing_usecase.dart';
import 'pricing_event.dart';
import 'pricing_state.dart';

/// {@template pricing_bloc}
/// Gestor oficial de estados para el flujo de cotizaciones del Zenith Pricing Engine™.
///
/// **Objetivo:** Conectar las intenciones de la UI con los casos de uso lógicos del dominio.
/// **Responsabilidad:** Recibir eventos, iniciar transiciones, invocar el caso de uso y despachar los estados lógicos del precio.
/// **Dependencias:** [CalculatePricingUseCase], [PricingEvent], [PricingState]
/// **Restricciones:** No contiene código de widgets ni acoplamiento de infraestructura. Respeta la separación arquitectónica.
/// **Riesgos:** Errores concurrentes si se emiten eventos en ráfagas. Se mitiga mediante el manejo interno de estados en Bloc.
/// **Ejemplo de uso:**
/// ```dart
/// final pricingBloc = PricingBloc(calculatePricingUseCase);
/// pricingBloc.add(CalculatePricingEvent(request));
/// ```
/// {@endtemplate}
class PricingBloc extends Bloc<PricingEvent, PricingState> {
  /// {@macro pricing_bloc}
  PricingBloc(this._calculatePricingUseCase) : super(const PricingInitial()) {
    on<CalculatePricingEvent>(_onCalculatePricing);
  }

  final CalculatePricingUseCase _calculatePricingUseCase;

  Future<void> _onCalculatePricing(
    CalculatePricingEvent event,
    Emitter<PricingState> emit,
  ) async {
    emit(const PricingLoading());
    try {
      // Invocar al caso de uso de dominio puro
      final response = await _calculatePricingUseCase(event.request);
      emit(PricingSuccess(response));
    } catch (e) {
      // Emitir estado de error encapsulado
      emit(PricingFailureState(e.toString()));
    }
  }
}
