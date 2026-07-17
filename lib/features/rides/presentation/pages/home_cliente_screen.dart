import 'dart:math';
import 'package:flutter/material.dart';
import '../../../../core/di/service_locator.dart';
import '../../../../core/services/firestore_service.dart';
import '../../../pricing/domain/usecases/calculate_pricing_usecase.dart';
import '../../../pricing/domain/entities/pricing_request.dart';
import '../../../pricing/domain/entities/pricing_response.dart';
import '../../../pricing/domain/value_objects/index.dart';
import '../../domain/repositories/ride_repository.dart';
import '../../domain/entities/user_entity.dart';
import '../../domain/entities/ride_entity.dart';
import '../../domain/entities/offer_entity.dart';
import '../../domain/usecases/create_ride_usecase.dart';
import '../../domain/usecases/cancel_ride_usecase.dart';
import '../../domain/usecases/accept_offer_usecase.dart';
import '../../domain/usecases/watch_ride_offers_usecase.dart';
import '../../data/models/location_model.dart';
import '../../data/models/ride_model.dart';

class HomeClienteScreen extends StatefulWidget {
  final UserEntity currentUser;
  final RideRepository rideRepository;

  const HomeClienteScreen({
    Key? key,
    required this.currentUser,
    required this.rideRepository,
  }) : super(key: key);

  @override
  _HomeClienteScreenState createState() => _HomeClienteScreenState();
}

class _HomeClienteScreenState extends State<HomeClienteScreen> {
  final TextEditingController _destinationController = TextEditingController();
  
  // Use cases para Clean Architecture estricta
  late final CreateRideUseCase _createRideUseCase;
  late final CancelRideUseCase _cancelRideUseCase;
  late final AcceptOfferUseCase _acceptOfferUseCase;
  late final WatchRideOffersUseCase _watchRideOffersUseCase;
  late final CalculatePricingUseCase _calculatePricingUseCase;

  // Estados de carga e interfaz
  bool _isLoadingPricing = false;
  bool _isCreatingRide = false;
  PricingResponse? _calculatedPricing;
  ServiceType _selectedServiceType = ServiceType.standard;

  @override
  void initState() {
    super.initState();
    _createRideUseCase = CreateRideUseCase(widget.rideRepository);
    _cancelRideUseCase = CancelRideUseCase(widget.rideRepository);
    _acceptOfferUseCase = AcceptOfferUseCase(widget.rideRepository);
    _watchRideOffersUseCase = WatchRideOffersUseCase(widget.rideRepository);
    
    // Recuperar use case de GetIt para el motor de precios
    _calculatePricingUseCase = sl<CalculatePricingUseCase>();
  }

  @override
  void dispose() {
    _destinationController.dispose();
    super.dispose();
  }

  // Ejecuta el motor oficial de precios (Prioridad 1)
  void _calculateOfficialPricing() async {
    if (_destinationController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Por favor ingresa la dirección de destino.')),
      );
      return;
    }

    setState(() {
      _isLoadingPricing = true;
      _calculatedPricing = null;
    });

    try {
      final quoteId = 'Q_${DateTime.now().millisecondsSinceEpoch}_${Random().nextInt(1000)}';
      
      // Coordenadas fijas en Trujillo para propósitos de demostración consistentes
      final originLoc = PricingLocation(latitude: -8.11189, longitude: -79.02875);
      final destLoc = PricingLocation(latitude: -8.12189, longitude: -79.01875);

      // Distancia simulada basada en destino (o aleatoria estable)
      final calculatedDistance = Distance(1.5 + Random().nextDouble() * 4.5);
      final calculatedDuration = Duration(8.0 + Random().nextDouble() * 15.0);

      final pricingRequest = PricingRequest(
        quoteId: quoteId,
        originLocation: originLoc,
        destinationLocation: destLoc,
        distance: calculatedDistance,
        duration: calculatedDuration,
        cityId: CityId.PE_TRUJILLO,
        serviceType: _selectedServiceType,
        requestedAt: DateTime.now().toUtc(),
        userId: widget.currentUser.uid,
        extensions: PricingExtensions.empty(),
      );

      final response = await _calculatePricingUseCase(pricingRequest);
      
      setState(() {
        _calculatedPricing = response;
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error al calcular precio oficial: $e')),
      );
    } finally {
      setState(() {
        _isLoadingPricing = false;
      });
    }
  }

  // Publica la solicitud oficial basándose estrictamente en el voucher cotizado
  void _publishRideWithVoucher() async {
    if (_calculatedPricing == null) return;

    setState(() => _isCreatingRide = true);

    try {
      final origin = LocationModel(
        address: 'Origen de Diagnóstico (Trujillo)',
        lat: -8.11189,
        lng: -79.02875,
      );

      final destination = LocationModel(
        address: _destinationController.text,
        lat: -8.12189,
        lng: -79.01875,
      );

      // El viaje se publica con la tarifa oficial calculada por el motor, preservando la inmutabilidad
      final newRide = RideModel(
        id: '',
        passengerId: widget.currentUser.uid,
        passengerName: widget.currentUser.fullName,
        origin: origin,
        destination: destination,
        suggestedPrice: _calculatedPricing!.protectedPrice.amount,
        status: 'pending',
      );

      final rideId = await _createRideUseCase.execute(newRide);
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Servicio Zénith despachado con ID: $rideId')),
      );

      // Limpiar estados locales de búsqueda tras un despacho exitoso
      _destinationController.clear();
      setState(() {
        _calculatedPricing = null;
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error al despachar el viaje: $e')),
      );
    } finally {
      setState(() => _isCreatingRide = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D0D0D),
      appBar: AppBar(
        title: const Text(
          'ZÉNITH - PASAJERO CONSOLE',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            letterSpacing: 1.2,
            color: Color(0xFF39FF14),
          ),
        ),
        backgroundColor: Colors.black,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Color(0xFF39FF14)),
            onPressed: () => setState(() {}),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Perfil del Cliente
            Container(
              padding: const EdgeInsets.all(16.0),
              decoration: BoxDecoration(
                color: Colors.black,
                border: Border.all(color: const Color(0xFF39FF14).withOpacity(0.3)),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                children: [
                  const Icon(Icons.person, color: Color(0xFF39FF14), size: 40),
                  const SizedBox(width: 16),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.currentUser.fullName.toUpperCase(),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Rol: Pasajero • Reputación: ${widget.currentUser.rating}',
                        style: const TextStyle(
                          color: Colors.grey,
                          fontSize: 12,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Monitorear Flujos Activos de Viajes
            StreamBuilder<List<RideEntity>>(
              stream: widget.rideRepository.watchPassengerActiveRides(widget.currentUser.uid),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(
                    child: CircularProgressIndicator(color: Color(0xFF39FF14)),
                  );
                }

                if (snapshot.hasError) {
                  return Container(
                    padding: const EdgeInsets.all(16),
                    color: Colors.red.withOpacity(0.1),
                    child: Text('Error: ${snapshot.error}', style: const TextStyle(color: Colors.red)),
                  );
                }

                final rides = snapshot.data ?? [];
                if (rides.isEmpty) {
                  // No hay viaje activo: Mostrar Formulario de Cotización + Botón de Precios
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'SOLICITAR NUEVO VIAJE',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1.5,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.black,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: Colors.white10),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            TextField(
                              controller: _destinationController,
                              style: const TextStyle(color: Colors.white),
                              onChanged: (_) {
                                // Al alterar la ruta, invalidamos la cotización previa para evitar fraudes tarifarios
                                if (_calculatedPricing != null) {
                                  setState(() => _calculatedPricing = null);
                                }
                              },
                              decoration: const InputDecoration(
                                labelText: 'Dirección de Destino',
                                labelStyle: TextStyle(color: Colors.grey),
                                enabledBorder: UnderlineInputBorder(
                                  borderSide: BorderSide(color: Colors.white24),
                                ),
                                focusedBorder: UnderlineInputBorder(
                                  borderSide: BorderSide(color: Color(0xFF39FF14)),
                                ),
                              ),
                            ),
                            const SizedBox(height: 20),
                            const Text(
                              'CATEGORÍA DE SERVICIO',
                              style: TextStyle(
                                color: Colors.grey,
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 1.1,
                              ),
                            ),
                            const SizedBox(height: 8),
                            DropdownButtonFormField<ServiceType>(
                              value: _selectedServiceType,
                              dropdownColor: Colors.black,
                              style: const TextStyle(color: Colors.white),
                              decoration: const InputDecoration(
                                enabledBorder: InputBorder.none,
                              ),
                              items: ServiceType.values.map((type) {
                                return DropdownMenuItem<ServiceType>(
                                  value: type,
                                  child: Text(type.name.toUpperCase()),
                                );
                              }).toList(),
                              onChanged: (val) {
                                if (val != null) {
                                  setState(() {
                                    _selectedServiceType = val;
                                    _calculatedPricing = null;
                                  });
                                }
                              },
                            ),
                            const SizedBox(height: 24),
                            
                            // Flujo de Cotización o visualización de Voucher Unico
                            if (_calculatedPricing == null) ...[
                              SizedBox(
                                width: double.infinity,
                                height: 48,
                                child: ElevatedButton(
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFF39FF14),
                                    foregroundColor: Colors.black,
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                  ),
                                  onPressed: _isLoadingPricing ? null : _calculateOfficialPricing,
                                  child: _isLoadingPricing
                                      ? const SizedBox(
                                          height: 20,
                                          width: 20,
                                          child: CircularProgressIndicator(color: Colors.black, strokeWidth: 2),
                                        )
                                      : const Text(
                                          'CALCULAR TARIFA OFICIAL',
                                          style: TextStyle(fontWeight: FontWeight.black),
                                        ),
                                ),
                              ),
                            ] else ...[
                              // UN SOLO VOUCHER EN PANTALLA (Satisfaciendo regla de diseño estricta)
                              Container(
                                padding: const EdgeInsets.all(20),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF141414),
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(color: const Color(0xFF39FF14).withOpacity(0.4)),
                                  boxShadow: [
                                    BoxShadow(
                                      color: const Color(0xFF39FF14).withOpacity(0.1),
                                      blurRadius: 15,
                                      spreadRadius: 2,
                                    )
                                  ],
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.between,
                                      children: [
                                        const Text(
                                          'CERTIFICADO DE PRECIO SEGURO',
                                          style: TextStyle(
                                            color: Color(0xFF39FF14),
                                            fontSize: 10,
                                            fontWeight: FontWeight.bold,
                                            letterSpacing: 1.5,
                                          ),
                                        ),
                                        const Icon(Icons.verified, color: Color(0xFF39FF14), size: 16),
                                      ],
                                    ),
                                    const Divider(color: Colors.white24, height: 20),
                                    
                                    // Datos de Origen y Destino
                                    _buildVoucherRow('ORIGEN', 'Trujillo (Diagnóstico Satelital)'),
                                    const SizedBox(height: 8),
                                    _buildVoucherRow('DESTINO', _destinationController.text),
                                    const SizedBox(height: 8),
                                    _buildVoucherRow('DISTANCIA', '${_calculatedPricing!.distance.value.toStringAsFixed(2)} km'),
                                    const SizedBox(height: 8),
                                    _buildVoucherRow('DURACIÓN', '${_calculatedPricing!.duration.value.toStringAsFixed(1)} min'),
                                    const Divider(color: Colors.white12, height: 20),

                                    // Desglose de Fórmulas Matemáticas
                                    _buildVoucherDetailRow('Base regional', '\$${_calculatedPricing!.basePrice.amount.toStringAsFixed(2)}'),
                                    _buildVoucherDetailRow('Surcharge distancia', '\$${_calculatedPricing!.distancePrice.amount.toStringAsFixed(2)}'),
                                    _buildVoucherDetailRow('Surcharge tiempo', '\$${_calculatedPricing!.durationPrice.amount.toStringAsFixed(2)}'),
                                    _buildVoucherDetailRow('Multiplicador ciudad', '${_calculatedPricing!.cityMultiplier.value}x'),
                                    _buildVoucherDetailRow('Perfil temporal', '${_calculatedPricing!.timeProfileMultiplier.value}x'),
                                    const Divider(color: Colors.white12, height: 20),

                                    // Firma Criptográfica Oficial del Backend
                                    const Text(
                                      'FIRMA DIGITAL DE INTEGRIDAD (BACKEND)',
                                      style: TextStyle(color: Colors.grey, fontSize: 8, fontWeight: FontWeight.bold),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      _calculatedPricing!.pricingSeal.signature,
                                      style: const TextStyle(
                                        color: Colors.amber,
                                        fontFamily: 'monospace',
                                        fontSize: 9,
                                      ),
                                    ),
                                    const SizedBox(height: 20),

                                    // Precio Protegido Grande
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.between,
                                      children: [
                                        const Text(
                                          'TOTAL COTIZADO',
                                          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                                        ),
                                        Text(
                                          '\$${_calculatedPricing!.protectedPrice.amount.toStringAsFixed(2)}',
                                          style: const TextStyle(
                                            color: Color(0xFF39FF14),
                                            fontSize: 26,
                                            fontWeight: FontWeight.black,
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 24),

                                    // UN SOLO BOTÓN "PAGAR" PARA EL VOUCHER
                                    SizedBox(
                                      width: double.infinity,
                                      height: 50,
                                      child: ElevatedButton(
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: const Color(0xFF39FF14),
                                          foregroundColor: Colors.black,
                                          shadowColor: const Color(0xFF39FF14),
                                          elevation: 8,
                                          shape: RoundedRectangleBorder(
                                            borderRadius: BorderRadius.circular(12),
                                          ),
                                        ),
                                        onPressed: _isCreatingRide ? null : _publishRideWithVoucher,
                                        child: _isCreatingRide
                                            ? const SizedBox(
                                                height: 22,
                                                width: 22,
                                                child: CircularProgressIndicator(color: Colors.black, strokeWidth: 2),
                                              )
                                            : const Text(
                                                'PAGAR Y PUBLICAR',
                                                style: TextStyle(fontWeight: FontWeight.black, fontSize: 15),
                                              ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                  );
                }

                // Si ya existe un viaje activo despachado: Mostrar panel de seguimiento del viaje
                final activeRide = rides[0];
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.black,
                        border: Border.all(color: const Color(0xFF39FF14).withOpacity(0.5)),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.between,
                            children: [
                              const Text(
                                'VIAJE ACTIVO DETECTADO',
                                style: TextStyle(
                                  color: Color(0xFF39FF14),
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 1.5,
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF39FF14).withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Text(
                                  activeRide.status.toUpperCase(),
                                  style: const TextStyle(
                                    color: Color(0xFF39FF14),
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    fontFamily: 'monospace',
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          Text(
                            'Origen: ${activeRide.origin.address}',
                            style: const TextStyle(color: Colors.grey, fontSize: 13),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Destino: ${activeRide.destination.address}',
                            style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Precio cotizado: \$${activeRide.suggestedPrice.toStringAsFixed(2)}',
                            style: const TextStyle(color: Color(0xFF39FF14), fontWeight: FontWeight.bold),
                          ),
                          if (activeRide.driverName != null) ...[
                            const SizedBox(height: 12),
                            const Divider(color: Colors.white12),
                            const SizedBox(height: 8),
                            Text(
                              'Conductor Asignado: ${activeRide.driverName}',
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                            ),
                            Text(
                              'Precio Final acordado: \$${activeRide.finalPrice?.toStringAsFixed(2)}',
                              style: const TextStyle(color: Color(0xFF39FF14), fontWeight: FontWeight.bold),
                            ),
                          ],
                          const SizedBox(height: 16),
                          SizedBox(
                            width: double.infinity,
                            child: OutlinedButton(
                              style: OutlinedButton.styleFrom(
                                side: const BorderSide(color: Colors.red),
                                foregroundColor: Colors.red,
                              ),
                              onPressed: () => _cancelRideUseCase.execute(activeRide.id),
                              child: const Text('CANCELAR SOLICITUD'),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Ofertas de conductores en tiempo real para este viaje activo
                    if (activeRide.status == 'pending' || activeRide.status == 'negotiating') ...[
                      const Text(
                        'OFERTAS DE CONDUCTORES EN TIEMPO REAL',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1.5,
                        ),
                      ),
                      const SizedBox(height: 12),
                      StreamBuilder<List<OfferEntity>>(
                        stream: _watchRideOffersUseCase.execute(activeRide.id),
                        builder: (context, offerSnapshot) {
                          if (offerSnapshot.connectionState == ConnectionState.waiting) {
                            return const Center(child: CircularProgressIndicator(color: Color(0xFF39FF14)));
                          }

                          final offers = offerSnapshot.data ?? [];
                          if (offers.isEmpty) {
                            return Container(
                              padding: const EdgeInsets.all(24),
                              decoration: BoxDecoration(
                                color: Colors.black,
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: const Center(
                                child: Text(
                                  'Esperando contraofertas de operadores...',
                                  style: TextStyle(color: Colors.grey, fontSize: 12),
                                ),
                              ),
                            );
                          }

                          return ListView.separated(
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            itemCount: offers.length,
                            separatorBuilder: (context, index) => const SizedBox(height: 8),
                            itemBuilder: (context, index) {
                              final offer = offers[index];
                              return Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: Colors.black,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: Colors.white10),
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.between,
                                  children: [
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          offer.driverName,
                                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                                        ),
                                        Text(
                                          'Calificación: ${offer.driverRating} ⭐',
                                          style: const TextStyle(color: Colors.grey, fontSize: 11),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          'Propuesta: \$${offer.price.toStringAsFixed(2)}',
                                          style: const TextStyle(
                                            color: Color(0xFF39FF14),
                                            fontWeight: FontWeight.bold,
                                            fontSize: 16,
                                          ),
                                        ),
                                      ],
                                    ),
                                    ElevatedButton(
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: const Color(0xFF39FF14),
                                        foregroundColor: Colors.black,
                                      ),
                                      onPressed: () => _acceptOfferUseCase.execute(activeRide.id, offer),
                                      child: const Text('ACEPTAR'),
                                    ),
                                  ],
                                ),
                              );
                            },
                          );
                        },
                      ),
                    ],
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildVoucherRow(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(color: Colors.grey, fontSize: 9, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w500),
        ),
      ],
    );
  }

  Widget _buildVoucherDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.between,
        children: [
          Text(
            label,
            style: const TextStyle(color: Colors.grey, fontSize: 11),
          ),
          Text(
            value,
            style: const TextStyle(color: Colors.white, fontSize: 11, fontFamily: 'monospace'),
          ),
        ],
      ),
    );
  }
}
