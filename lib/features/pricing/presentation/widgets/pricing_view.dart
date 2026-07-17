/// ============================================================================
/// ZENITH
/// Module : Pricing
/// Layer  : Presentation
/// Type   : Widget
/// File   : pricing_view.dart
/// ============================================================================

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/entities/pricing_request.dart';
import '../../domain/value_objects/index.dart';
import '../bloc/pricing_bloc.dart';
import '../bloc/pricing_event.dart';
import '../bloc/pricing_state.dart';
import 'pricing_error_widget.dart';
import 'pricing_loading_widget.dart';
import 'pricing_result_card.dart';

/// {@template pricing_view}
/// Vista desacoplada que contiene el formulario y la sección de resultados para la cotización de viajes.
///
/// **Objetivo:** Recopilar los parámetros de entrada del usuario y reflejar los estados reactivos del Bloc.
/// **Responsabilidad:** Administrar controladores locales del formulario de entrada, realizar validaciones estructurales de UI y despachar [CalculatePricingEvent].
/// **Dependencias:** [PricingBloc], [PricingState], [PricingRequest], [PricingLocation], [Distance], [Duration]
/// **Restricciones:** No contiene lógica de cálculo ni negocio. Es una clase de presentación Material 3.
/// {@endtemplate}
class PricingView extends StatefulWidget {
  /// {@macro pricing_view}
  const PricingView({super.key});

  @override
  State<PricingView> createState() => _PricingViewState();
}

class _PricingViewState extends State<PricingView> {
  final _formKey = GlobalKey<FormState>();

  // Controladores de Texto y Estados Locales con valores por defecto óptimos (Ruta Lima)
  CityId _selectedCity = CityId.PE_LIMA;
  ServiceType _selectedServiceType = ServiceType.standard;

  late final TextEditingController _originLatController;
  late final TextEditingController _originLngController;
  late final TextEditingController _destLatController;
  late final TextEditingController _destLngController;
  late final TextEditingController _distanceController;
  late final TextEditingController _durationController;
  late final TextEditingController _userIdController;

  // Extensiones Opcionales
  late final TextEditingController _weatherController;
  late final TextEditingController _trafficController;
  late final TextEditingController _emergencyController;
  late final TextEditingController _tollsController;

  @override
  void initState() {
    super.initState();
    // Coordenadas de origen: Plaza Mayor de Lima
    _originLatController = TextEditingController(text: '-12.0463');
    _originLngController = TextEditingController(text: '-77.0427');

    // Coordenadas de destino: Parque Kennedy, Miraflores
    _destLatController = TextEditingController(text: '-12.1211');
    _destLngController = TextEditingController(text: '-77.0297');

    // Distancia aproximada de 10.5 Km y duración de 25 minutos
    _distanceController = TextEditingController(text: '10.5');
    _durationController = TextEditingController(text: '25.0');
    _userIdController = TextEditingController(text: 'usr_zenith_enterprise_01');

    // Multiplicadores base opcionales (1.0 = neutral)
    _weatherController = TextEditingController(text: '1.0');
    _trafficController = TextEditingController(text: '1.0');
    _emergencyController = TextEditingController(text: '1.0');
    _tollsController = TextEditingController(text: '0.0');
  }

  @override
  void dispose() {
    _originLatController.dispose();
    _originLngController.dispose();
    _destLatController.dispose();
    _destLngController.dispose();
    _distanceController.dispose();
    _durationController.dispose();
    _userIdController.dispose();
    _weatherController.dispose();
    _trafficController.dispose();
    _emergencyController.dispose();
    _tollsController.dispose();
    super.dispose();
  }

  /// Despacha el evento de cálculo construyendo de forma segura los objetos de valor de dominio
  void _submitCalculation() {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    try {
      final double originLat = double.parse(_originLatController.text);
      final double originLng = double.parse(_originLngController.text);
      final double destLat = double.parse(_destLatController.text);
      final double destLng = double.parse(_destLngController.text);
      final double distanceValue = double.parse(_distanceController.text);
      final double durationValue = double.parse(_durationController.text);

      final double? weather = double.tryParse(_weatherController.text);
      final double? traffic = double.tryParse(_trafficController.text);
      final double? emergency = double.tryParse(_emergencyController.text);
      final double? tolls = double.tryParse(_tollsController.text);

      // 1. Instanciar los Objetos de Valor de Dominio Puro
      // Se validan internamente al ser instanciados lanzando excepciones controladas si no cumplen
      final PricingLocation origin = PricingLocation(latitude: originLat, longitude: originLng);
      final PricingLocation destination = PricingLocation(latitude: destLat, longitude: destLng);
      final Distance distance = Distance(distanceValue);
      final Duration duration = Duration(durationValue);
      
      final PricingExtensions extensions = PricingExtensions(
        weatherFactor: weather == 1.0 ? null : weather,
        trafficFactor: traffic == 1.0 ? null : traffic,
        emergencyFactor: emergency == 1.0 ? null : emergency,
        tollsCost: tolls == 0.0 ? null : tolls,
      );

      final String quoteId = 'QT-${DateTime.now().millisecondsSinceEpoch}';

      final request = PricingRequest(
        quoteId: quoteId,
        originLocation: origin,
        destinationLocation: destination,
        distance: distance,
        duration: duration,
        cityId: _selectedCity,
        serviceType: _selectedServiceType,
        requestedAt: DateTime.now(),
        userId: _userIdController.text.trim().isEmpty ? null : _userIdController.text.trim(),
        extensions: extensions,
      );

      // 2. Despachar Evento al Bloc
      context.read<PricingBloc>().add(CalculatePricingEvent(request));
    } catch (e) {
      // Manejar cualquier fallo de validación local y reportarlo en la UI mediante SnackBar
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error de validación: ${e.toString()}'),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.all(20.0),
        children: [
          Text(
            'Zenith Pricing Engine™',
            style: theme.textTheme.headlineMedium?.copyWith(
              fontWeight: FontWeight.bold,
              color: theme.colorScheme.primary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Calcule cotizaciones oficiales con respaldo matemático e integridad firmada digitalmente.',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 24),

          // Diseño Adaptivo / Bento de dos paneles
          LayoutBuilder(
            builder: (context, constraints) {
              if (constraints.maxWidth > 800) {
                // Vista Web o Tablets de pantalla ancha
                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      flex: 4,
                      child: _buildFormPanel(theme),
                    ),
                    const SizedBox(width: 24),
                    Expanded(
                      flex: 3,
                      child: _buildResultPanel(theme),
                    ),
                  ],
                );
              } else {
                // Móvil o pantalla angosta
                return Column(
                  children: [
                    _buildFormPanel(theme),
                    const SizedBox(height: 24),
                    _buildResultPanel(theme),
                  ],
                );
              }
            },
          ),
        ],
      ),
    );
  }

  Widget _buildFormPanel(ThemeData theme) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Panel 1: Parámetros del viaje
        _buildSectionCard(
          theme: theme,
          title: 'PARÁMETROS DEL TRAYECTO',
          icon: Icons.map_rounded,
          children: [
            Row(
              children: [
                Expanded(
                  child: _buildDropdown<CityId>(
                    label: 'Ciudad / Región',
                    value: _selectedCity,
                    items: CityId.values,
                    onChanged: (val) => setState(() => _selectedCity = val!),
                    itemLabel: (city) => city.name.replaceAll('PE_', ''),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: _buildDropdown<ServiceType>(
                    label: 'Tipo de Servicio',
                    value: _selectedServiceType,
                    items: ServiceType.values,
                    onChanged: (val) => setState(() => _selectedServiceType = val!),
                    itemLabel: (type) => type.name.toUpperCase(),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _buildTextField(
                    controller: _originLatController,
                    label: 'Latitud Origen',
                    validator: _validateCoordinate,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: _buildTextField(
                    controller: _originLngController,
                    label: 'Longitud Origen',
                    validator: _validateCoordinate,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _buildTextField(
                    controller: _destLatController,
                    label: 'Latitud Destino',
                    validator: _validateCoordinate,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: _buildTextField(
                    controller: _destLngController,
                    label: 'Longitud Destino',
                    validator: _validateCoordinate,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _buildTextField(
                    controller: _distanceController,
                    label: 'Distancia (Km)',
                    validator: _validatePositiveDouble,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: _buildTextField(
                    controller: _durationController,
                    label: 'Duración (Minutos)',
                    validator: _validatePositiveDouble,
                  ),
                ),
              ],
            ),
          ],
        ),

        const SizedBox(height: 16),

        // Panel 2: Variables del Entorno / Factores de Negocio
        _buildSectionCard(
          theme: theme,
          title: 'FACTORES DINÁMICOS Y EXTRAS (OPCIONALES)',
          icon: Icons.speed_rounded,
          children: [
            Row(
              children: [
                Expanded(
                  child: _buildTextField(
                    controller: _weatherController,
                    label: 'Factor Clima',
                    validator: _validatePositiveDouble,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: _buildTextField(
                    controller: _trafficController,
                    label: 'Factor Tráfico',
                    validator: _validatePositiveDouble,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _buildTextField(
                    controller: _emergencyController,
                    label: 'Factor Emergencia',
                    validator: _validatePositiveDouble,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: _buildTextField(
                    controller: _tollsController,
                    label: 'Costo Peajes (PEN/USD)',
                    validator: _validatePositiveDouble,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _buildTextField(
              controller: _userIdController,
              label: 'ID de Usuario para Auditoría',
            ),
          ],
        ),

        const SizedBox(height: 24),

        // Botón de Envío
        FilledButton.icon(
          onPressed: _submitCalculation,
          style: FilledButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 18.0),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14.0),
            ),
            elevation: 2,
          ),
          icon: const Icon(Icons.rocket_launch_rounded),
          label: const Text(
            'CALCULAR TARIFA OFICIAL',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              letterSpacing: 1.0,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildResultPanel(ThemeData theme) {
    return BlocBuilder<PricingBloc, PricingState>(
      builder: (context, state) {
        if (state is PricingInitial) {
          return Container(
            padding: const EdgeInsets.all(32.0),
            decoration: BoxDecoration(
              color: theme.colorScheme.surfaceContainer,
              borderRadius: BorderRadius.circular(20.0),
              border: Border.all(
                color: theme.colorScheme.outlineVariant,
              ),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.receipt_long_rounded,
                  size: 64,
                  color: theme.colorScheme.primary.withOpacity(0.4),
                ),
                const SizedBox(height: 16),
                Text(
                  'Esperando Parámetros',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: theme.colorScheme.onSurface,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Ingrese los datos de la ruta en el formulario de la izquierda y presione "CALCULAR TARIFA OFICIAL" para procesar el desglose.',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          );
        }

        if (state is PricingLoading) {
          return const PricingLoadingWidget();
        }

        if (state is PricingSuccess) {
          return PricingResultCard(response: state.response);
        }

        if (state is PricingFailureState) {
          return PricingErrorWidget(
            errorMessage: state.errorMessage,
            onRetry: _submitCalculation,
          );
        }

        return const SizedBox.shrink();
      },
    );
  }

  Widget _buildSectionCard({
    required ThemeData theme,
    required String title,
    required IconData icon,
    required List<Widget> children,
  }) {
    return Card(
      elevation: 0,
      color: theme.colorScheme.surfaceContainer,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16.0),
        side: Border.all(color: theme.colorScheme.outlineVariant.withOpacity(0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: theme.colorScheme.primary, size: 20),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: theme.textTheme.labelMedium?.copyWith(
                    color: theme.colorScheme.primary,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.0,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            ...children,
          ],
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      decoration: InputDecoration(
        labelText: label,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      ),
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      validator: validator,
    );
  }

  Widget _buildDropdown<T>({
    required String label,
    required T value,
    required List<T> items,
    required void Function(T?) onChanged,
    required String Function(T) itemLabel,
  }) {
    return DropdownButtonFormField<T>(
      value: value,
      items: items.map((T item) {
        return DropdownMenuItem<T>(
          value: item,
          child: Text(itemLabel(item)),
        );
      }).toList(),
      onChanged: onChanged,
      decoration: InputDecoration(
        labelText: label,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      ),
    );
  }

  String? _validateCoordinate(String? val) {
    if (val == null || val.isEmpty) {
      return 'Obligatorio';
    }
    final d = double.tryParse(val);
    if (d == null) {
      return 'Número inválido';
    }
    return null;
  }

  String? _validatePositiveDouble(String? val) {
    if (val == null || val.isEmpty) {
      return 'Obligatorio';
    }
    final d = double.tryParse(val);
    if (d == null || d < 0) {
      return 'Debe ser >= 0';
    }
    return null;
  }
}
