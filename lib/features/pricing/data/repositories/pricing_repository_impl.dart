/// ============================================================================
/// ZENITH
/// Module : Pricing
/// Layer  : Data
/// Type   : RepositoryImplementation
/// File   : pricing_repository_impl.dart
/// ============================================================================

import '../../domain/entities/pricing_request.dart';
import '../../domain/entities/pricing_response.dart';
import '../../domain/repositories/pricing_repository.dart';
import '../datasources/pricing_remote_datasource.dart';
import '../mappers/pricing_request_mapper.dart';
import '../mappers/pricing_response_mapper.dart';

/// {@template pricing_repository_impl}
/// Implementación oficial del contrato de repositorio para el Zenith Pricing Engine™.
///
/// **Objetivo:** Orquestar de manera limpia y síncrona el flujo de datos entre la fuente de datos remota y la capa de dominio.
/// **Responsabilidad:** Mapear peticiones de dominio a DTOs de infraestructura, delegar la invocación de red al DataSource remoto y mapear de vuelta los DTOs de respuesta a entidades puras de dominio.
/// **Dependencias:** [PricingRepository], [PricingRemoteDataSource], [PricingRequestMapper], [PricingResponseMapper]
///
/// **Garantías de Diseño (Auditoría Enterprise - BUILD-006.2):**
/// 1. **Ausencia de Lógica de Negocio:** No se realiza ninguna validación de reglas de negocio en esta capa; toda validación pertenece exclusivamente a los Value Objects y Entidades de Dominio.
/// 2. **Ausencia de Lógica Matemática:** No se efectúan cálculos de precios, tasas, descuentos, ni ninguna operación aritmética.
/// 3. **Ausencia de Lógica de Infraestructura:** El repositorio desconoce por completo la tecnología de red utilizada (HTTP, gRPC, Firebase Cloud Functions). No manipula llamadas asíncronas de Firebase ni realiza transformaciones JSON.
/// 4. **Orquestador Puro:** Su única responsabilidad es actuar como puente/mediador (mediante mappers) respetando la inversión de dependencias de Clean Architecture.
///
/// **Ejemplo de uso:** `final repository = PricingRepositoryImpl(remoteDataSource);`
/// {@endtemplate}
class PricingRepositoryImpl implements PricingRepository {
  /// {@macro pricing_repository_impl}
  const PricingRepositoryImpl(this._remoteDataSource);

  final PricingRemoteDataSource _remoteDataSource;

  @override
  Future<PricingResponse> calculatePricing(PricingRequest request) async {
    // 1. Mapear de entidad de dominio a DTO (La transformación es estructural, no contiene lógica matemática ni de negocio)
    final requestDto = PricingRequestMapper.toDto(request);

    // 2. Invocar la fuente de datos remota (Inversión de dependencias: se delega el transporte y la comunicación a la interfaz abstracta)
    final responseDto = await _remoteDataSource.calculatePricing(requestDto);

    // 3. Mapear de DTO de respuesta a entidad de dominio pura e iniciar el retorno al caso de uso
    return PricingResponseMapper.toDomain(responseDto);
  }
}
