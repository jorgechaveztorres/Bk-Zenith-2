import 'package:flutter/material.dart';
import '../../domain/repositories/ride_repository.dart';
import '../../domain/entities/user_entity.dart';
import '../../domain/entities/ride_entity.dart';
import '../../domain/entities/offer_entity.dart';
import '../../data/models/offer_model.dart';

class HomeMotorizadoScreen extends StatefulWidget {
  final UserEntity currentUser;
  final RideRepository rideRepository;

  const HomeMotorizadoScreen({
    Key? key,
    required this.currentUser,
    required this.rideRepository,
  }) : super(key: key);

  @override
  _HomeMotorizadoScreenState createState() => _HomeMotorizadoScreenState();
}

class _HomeMotorizadoScreenState extends State<HomeMotorizadoScreen> {
  final Map<String, TextEditingController> _priceControllers = {};
  bool _loading = false;

  @override
  void dispose() {
    for (final controller in _priceControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  TextEditingController _getController(String rideId, double initialPrice) {
    if (!_priceControllers.containsKey(rideId)) {
      _priceControllers[rideId] = TextEditingController(text: initialPrice.toStringAsFixed(0));
    }
    return _priceControllers[rideId]!;
  }

  void _acceptRideDirectly(RideEntity ride) async {
    setState(() => _loading = true);
    try {
      final offer = OfferModel(
        id: '${ride.id}_${widget.currentUser.uid}',
        rideId: ride.id,
        driverId: widget.currentUser.uid,
        driverName: widget.currentUser.fullName,
        driverRating: widget.currentUser.rating,
        price: ride.suggestedPrice,
        status: 'accepted',
      );
      await widget.rideRepository.acceptOffer(ride.id, offer);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Servicio aceptado directamente de forma exitosa!')),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error al aceptar servicio: $e')),
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  void _submitCounterOffer(RideEntity ride) async {
    final controller = _getController(ride.id, ride.suggestedPrice);
    final double? price = double.tryParse(controller.text);
    if (price == null || price <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Por favor ingresa un precio de contraoferta válido.')),
      );
      return;
    }

    setState(() => _loading = true);
    try {
      final offer = OfferModel(
        id: '${ride.id}_${widget.currentUser.uid}',
        rideId: ride.id,
        driverId: widget.currentUser.uid,
        driverName: widget.currentUser.fullName,
        driverRating: widget.currentUser.rating,
        price: price,
        status: 'pending',
      );
      await widget.rideRepository.submitOffer(offer);
      await widget.rideRepository.updateRideStatus(ride.id, 'negotiating');

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Contraoferta enviada exitosamente!')),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error al enviar contraoferta: $e')),
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D0D0D),
      appBar: AppBar(
        title: const Text(
          'ZÉNITH - OPERADOR CONSOLE',
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
            // Driver Profile Card
            Container(
              padding: const EdgeInsets.all(16.0),
              decoration: BoxDecoration(
                color: Colors.black,
                border: Border.all(color: const Color(0xFF39FF14).withOpacity(0.3)),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                children: [
                  const Icon(Icons.motorcycle, color: Color(0xFF39FF14), size: 40),
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
                        'Rol: Operador (Motorizado) • Calificación: ${widget.currentUser.rating}',
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

            // Active/Accepted Ride Check
            StreamBuilder<List<RideEntity>>(
              stream: widget.rideRepository.watchDriverActiveRides(widget.currentUser.uid),
              builder: (context, activeSnapshot) {
                if (activeSnapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator(color: Color(0xFF39FF14)));
                }

                final activeRides = activeSnapshot.data ?? [];
                if (activeRides.isNotEmpty) {
                  final activeRide = activeRides[0];
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'MISIÓN EN TRÁNSITO ASIGNADA',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1.5,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: Colors.black,
                          border: Border.all(color: const Color(0xFF39FF14)),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF39FF14).withOpacity(0.1),
                              blurRadius: 10,
                              spreadRadius: 2,
                            )
                          ],
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.between,
                              children: [
                                Text(
                                  'PASAJERO: ${activeRide.passengerName}',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 16,
                                    fontWeight: FontWeight.black,
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF39FF14),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Text(
                                    activeRide.status.toUpperCase(),
                                    style: const TextStyle(
                                      color: Colors.black,
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
                              'De: ${activeRide.origin.address}',
                              style: const TextStyle(color: Colors.grey, fontSize: 12),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'A: ${activeRide.destination.address}',
                              style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 12),
                            Text(
                              'Tarifa Final Acordada: \$${activeRide.finalPrice ?? activeRide.suggestedPrice}',
                              style: const TextStyle(
                                color: Color(0xFF39FF14),
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 20),
                            Row(
                              children: [
                                if (activeRide.status == 'accepted')
                                  Expanded(
                                    child: ElevatedButton(
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: const Color(0xFF39FF14),
                                        foregroundColor: Colors.black,
                                      ),
                                      onPressed: () => widget.rideRepository.updateRideStatus(activeRide.id, 'in_progress'),
                                      child: const Text('INICIAR TRÁNSITO', style: TextStyle(fontWeight: FontWeight.bold)),
                                    ),
                                  ),
                                if (activeRide.status == 'in_progress')
                                  Expanded(
                                    child: ElevatedButton(
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: const Color(0xFF39FF14),
                                        foregroundColor: Colors.black,
                                      ),
                                      onPressed: () => widget.rideRepository.updateRideStatus(activeRide.id, 'completed'),
                                      child: const Text('ENTREGAR SERVICIO', style: TextStyle(fontWeight: FontWeight.bold)),
                                    ),
                                  ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: OutlinedButton(
                                    style: OutlinedButton.styleFrom(
                                      side: const BorderSide(color: Colors.red),
                                      foregroundColor: Colors.red,
                                    ),
                                    onPressed: () => widget.rideRepository.updateRideStatus(activeRide.id, 'cancelled'),
                                    child: const Text('CANCELAR'),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  );
                }

                // If no active ride, show radar/available scan list
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: const [
                        Icon(Icons.radar, color: Color(0xFF39FF14), size: 16),
                        SizedBox(width: 8),
                        Text(
                          'RADAR TÁCTICO: SOLICITUDES DISPONIBLES',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 1.5,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    StreamBuilder<List<RideEntity>>(
                      stream: widget.rideRepository.watchAvailableRides(),
                      builder: (context, availableSnapshot) {
                        if (availableSnapshot.connectionState == ConnectionState.waiting) {
                          return const Center(child: CircularProgressIndicator(color: Color(0xFF39FF14)));
                        }

                        final availableRides = availableSnapshot.data ?? [];
                        if (availableRides.isEmpty) {
                          return Container(
                            padding: const EdgeInsets.all(32),
                            decoration: BoxDecoration(
                              color: Colors.black,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: Colors.white12),
                            ),
                            child: const Center(
                              child: Text(
                                'Escaneando señales... No hay viajes pendientes de despacho.',
                                style: TextStyle(color: Colors.grey, fontSize: 12, fontFamily: 'monospace'),
                              ),
                            ),
                          );
                        }

                        return ListView.separated(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: availableRides.length,
                          separatorBuilder: (context, index) => const SizedBox(height: 12),
                          itemBuilder: (context, index) {
                            final ride = availableRides[index];
                            final controller = _getController(ride.id, ride.suggestedPrice);

                            return Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: Colors.black,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: Colors.white10),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.between,
                                    children: [
                                      Text(
                                        ride.passengerName.toUpperCase(),
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                      Text(
                                        '\$${ride.suggestedPrice.toStringAsFixed(0)}',
                                        style: const TextStyle(
                                          color: Color(0xFF39FF14),
                                          fontSize: 18,
                                          fontWeight: FontWeight.black,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 12),
                                  Text(
                                    'Origen: ${ride.origin.address}',
                                    style: const TextStyle(color: Colors.grey, fontSize: 12),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'Destino: ${ride.destination.address}',
                                    style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                                  ),
                                  const SizedBox(height: 16),
                                  Row(
                                    children: [
                                      Expanded(
                                        child: ElevatedButton(
                                          style: ElevatedButton.styleFrom(
                                            backgroundColor: const Color(0xFF39FF14),
                                            foregroundColor: Colors.black,
                                          ),
                                          onPressed: _loading ? null : () => _acceptRideDirectly(ride),
                                          child: const Text('ACEPTAR \$ DIRECTO', style: TextStyle(fontSize: 11, fontWeight: FontWeight.black)),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Row(
                                          children: [
                                            Expanded(
                                              child: SizedBox(
                                                height: 36,
                                                child: TextField(
                                                  controller: controller,
                                                  keyboardType: TextInputType.number,
                                                  style: const TextStyle(color: Colors.white, fontSize: 13),
                                                  decoration: const InputDecoration(
                                                    contentPadding: EdgeInsets.symmetric(horizontal: 8),
                                                    filled: true,
                                                    fillColor: Colors.white10,
                                                    border: OutlineInputBorder(borderSide: BorderSide.none),
                                                  ),
                                                ),
                                              ),
                                            ),
                                            const SizedBox(width: 6),
                                            IconButton(
                                              icon: const Icon(Icons.send, color: Color(0xFF39FF14)),
                                              onPressed: _loading ? null : () => _submitCounterOffer(ride),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            );
                          },
                        );
                      },
                    ),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
