# ZÉNITH MASTER: FUENTE ÚNICA DE VERDAD ARCHITECTURAL SPECIFICATION
## SPRINT: ZENITH-FORENSICS-001 / ENTERPRISE-004 | ENTERPRISE PRODUCTION STABILIZATION

---

## 1. ARQUITECTURA GENERAL DEL SISTEMA

El ecosistema de **ZÉNITH** se estructura como una plataforma de transporte urbano y logística bajo demanda con dos frentes tecnológicos claramente diferenciados y un núcleo de datos reactivo unificado en **Firebase Cloud Services**:

```
                                  +------------------------------------+
                                  |     ZÉNITH CLOUD BACKEND (V2)      |
                                  |                                    |
                                  |  +------------------------------+  |
                                  |  |   Firebase Authentication    |  |
                                  |  +------------------------------+  |
                                  |  |     Cloud Firestore DB       |  |
                                  |  |   - /users  - /rides         |  |
                                  |  |   - /rides/{id}/offers       |  |
                                  |  +------------------------------+  |
                                  |  |  Firestore Security Rules v2 |  |
                                  |  +------------------------------+  |
                                  |  |  Callable Functions v2       |  |
                                  |  |  - calculatePricing          |  |
                                  |  +------------------------------+  |
                                  +-----------------+------------------+
                                                    |
                                                    |
                         +--------------------------+--------------------------+
                         |                                                     |
                         v                                                     v
+----------------------------------------+          +----------------------------------------+
|      ZÉNITH CLIENT FRONTEND (REACT)    |          |     ZÉNITH MOBILE OPERATOR (FLUTTER)   |
|                                        |          |                                        |
|  - SPA React 19 + Vite + Tailwind v4   |          |  - Flutter Clean Arch + DDD + BLoC     |
|  - Google Maps React SDK (vis.gl)      |          |  - Zenith Pricing Engine Module        |
|  - Bidirectional Real-time Negotiation  |          |  - Mobile Client SDK Integration       |
|  - State: Firebase Web SDK Native      |          |  - Domain-Driven Value Objects         |
+----------------------------------------+          +----------------------------------------+
```

---

## 2. FRONTEND REACT (TECNOLOGÍA ACTIVA)

### 2.1 Stack Tecnológico y Dependencias (package.json)
- **Framework:** React 19.0.1 (Single Page Application)
- **Compilador/DevServer:** Vite v6.2.3 (Hot Module Replacement desactivado por entorno)
- **Estilos:** Tailwind CSS v4.1.14 (inyección nativa vía `@import "tailwindcss";` en `src/index.css`)
- **Animaciones:** Motion v12.23.24 (`motion/react`)
- **Iconografía:** Lucide-React v0.546.0
- **Servicio de Mapas:** `@vis.gl/react-google-maps` v1.8.3
- **Base de Datos y Auth:** Firebase Web SDK v12.13.0
- **Herramientas de Ejecución/Desarrollo:** `tsx` (Node.js TypeScript runner), `typescript` ~5.8.2, `@types/express`, `@types/node`

### 2.2 Componentes de la Interfaz
- `App.tsx`: Orquestador principal de estado. Controla la sesión del usuario (`currentUser`), la persistencia del estado de autenticación (`onAuthStateChanged`), el cambio dinámico de rol en tiempo real con mezcla en Firestore y las transiciones fluidas de pantalla con `<AnimatePresence>`.
- `components/Auth.tsx`: Formulario unificado de inicio de sesión y registro de operadores/clientes. Diseñado con una interfaz táctica oscura que incluye retroalimentación visual inmediata.
- `components/PassengerFlow.tsx`: Flujo exclusivo de pasajeros. Permite la selección de origen/destino mediante autocompletado, propuesta de tarifa manual, publicación del viaje en Firestore y suscripción en tiempo real a las ofertas de los conductores.
- `components/DriverFlow.tsx`: Flujo de conductores. Visualiza solicitudes pendientes en formato de radar militar táctico, permite aceptar viajes de forma directa a la tarifa propuesta o enviar contraofertas numéricas. Orquesta los estados de tránsito activos.
- `components/MapContainer.tsx`: Contenedor inmersivo de Google Maps. Carga estilos tácticos oscuros (`DARK_MAP_STYLE`), renderiza pines interactivos con ondas de pulso de radar y dibuja polilíneas de ruta mediante la inyección directa de `DirectionsRenderer`.
- `components/PlacesAutocomplete.tsx`: Entrada inteligente que consume el servicio de Google Places Autocomplete e inyecta coordenadas espaciales precisas en el flujo operativo.
- `components/PromptHelper.tsx`: Módulo utilitario expuesto opcionalmente para diagnóstico y sincronización del sistema.

### 2.3 Sistema de Navegación y Transición
- **Estructura:** Layout de pantalla única (Single-View Layout).
- **Mecanismo:** Selección condicional de componentes basada en estados lógicos de React (`currentUser.role` y `activeRide`).
- **Efectos:** Animaciones fluidas de desvanecimiento, deslizamiento e interpolación de escala gobernadas por `motion` de Framer.

---

## 3. FRONTEND FLUTTER (NÚCLEO CLEAN ARCHITECTURE ACTIVE)

### 3.1 Estructura Arquitectónica del Módulo de Pricing & Rides (`/lib`)
El módulo en Flutter representa una implementación de nivel Enterprise de **Clean Architecture** estructurada en capas desacopladas con diseño guiado por el dominio (DDD):

```
+-----------------------------------------------------------------------------------+
|                                 PRESENTATION LAYER                                |
|                  pricing_bloc  |  home_cliente_screen  |  home_motorizado_screen  |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                                   DOMAIN LAYER                                    |
|                      Entities  |  Value Objects  |  Use Cases                      |
|                      (Inmutabilidad estricta vía Equatable)                        |
|                                         |
|    - CreateRideUseCase, AcceptOfferUseCase, GetUserProfileUseCase, etc            |
|                                         |
|                      Interfaces: UserRepository | RideRepository | OfferRepository|
+-----------------------------------------+-----------------------------------------+
                                          ^
                                          |
+-----------------------------------------+-----------------------------------------+
|                                    DATA LAYER                                     |
|           FirestoreUserRepository | FirestoreRideRepository | FirestoreOfferRepository|
|                      Mappers & DTOs | FirestoreService (Client SDK)               |
+-----------------------------------------------------------------------------------+
```

#### Capa de Dominio (Domain Layer - Pura)
- **Entities:**
  - `pricing_request.dart`: Entidad raíz que contiene el ID de cotización, ubicaciones de origen y destino, distancia, duración, multiplicador de la ciudad, tipo de servicio y extensiones dinámicas.
  - `pricing_response.dart`: Entidad inmutable que encapsula la respuesta firmada del motor, conteniendo los desgloses exactos de tarifa base, precio por distancia, precio por duración, marcas de tiempo de expiración y firma criptográfica (`pricingSeal`).
  - `user_entity.dart`, `ride_entity.dart`, `offer_entity.dart`, `location_entity.dart`: Entidades inmutables con constructores `const` y herencia de `Equatable` para evitar re-renders y re-evaluaciones innecesarias en la interfaz.
- **Value Objects:** Objetos inmutables autocontenidos que aplican reglas estrictas de validación en su constructor:
  - `city_id.dart`: Enum de ciudades soportadas (`PE_LIMA`, `PE_TRUJILLO`, `PE_AREQUIPA`).
  - `service_type.dart`: Enum de servicios de transporte (`standard`, `express`, `cargo`, `priority`).
  - `money.dart`, `distance.dart`, `duration.dart`, `multiplier.dart`, `percentage.dart`, `pricing_seal.dart`, `risk_level.dart`, `confidence_level.dart`.
- **Repositories (Segregados según SRP):**
  - `user_repository.dart`: Contrato abstracto para perfiles de usuario.
  - `ride_repository.dart`: Contrato abstracto para creación y estados de viajes.
  - `offer_repository.dart`: Contrato abstracto para envío y aceptación de ofertas.
  - `location_repository.dart`: Contrato abstracto para persistencia geográfica.
- **Use Cases:**
  - `calculate_pricing_usecase.dart`: Caso de uso puro del motor de precios.
  - `create_ride_usecase.dart`, `cancel_ride_usecase.dart`, `accept_offer_usecase.dart`, `watch_ride_offers_usecase.dart`, `get_user_profile_usecase.dart`, `submit_offer_usecase.dart`, `update_ride_status_usecase.dart`, `watch_available_rides_usecase.dart`.

#### Capa de Datos (Data Layer - Infraestructura)
- **DTOs & Mappers:** Aisla los tipos primitivos de Firestore de las entidades fuertemente tipadas de dominio.
- **Implementaciones de Repositorios (Inyección de Registro & Diagnósticos):**
  - `firestore_user_repository.dart`, `firestore_ride_repository.dart`, `firestore_offer_repository.dart`: Implementaciones que heredan de las interfaces de dominio, consumen `FirestoreService` de forma robusta e inyectan automáticamente registros a `AppLogger` y métricas a `TelemetryService`.

#### Capa de Presentación (Presentation Layer)
- **State Management (BLoC):**
  - `pricing_bloc.dart`, `pricing_event.dart`, `pricing_state.dart`: Administrador reactivo de estados para el motor de precios.
- **Widgets e Interfaz Material 3:**
  - `home_cliente_screen.dart`, `home_motorizado_screen.dart`: Consolas operativas oscuras que consumen de forma reactiva los flujos de Firebase en tiempo real, integrando el flujo de cotizaciones seguras del Zenith Pricing Engine.

---

## 8. OBSERVABILIDAD, DIAGNÓSTICOS Y AUDITORÍA AUTOMÁTICA

Para garantizar un estándar de producción Enterprise en el núcleo Flutter, el Sprint 004 introduce tres componentes clave de observabilidad y control de calidad:

### 8.1 Sistema de Logs Estructurados (`AppLogger`)
Módulo centralizado (`/lib/core/logging/app_logger.dart`) que reemplaza llamadas directas de consola por logs con niveles de severidad (`TRACE`, `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`), colores ANSI para la consola de desarrollo y metadatos detallados.

### 8.2 Motor de Telemetría en Memoria (`TelemetryService`)
Registra transacciones de red, latencias y errores de Firestore. Mantiene un ledger histórico in-memory de transacciones para evaluar el cumplimiento del Acuerdo de Nivel de Servicio (SLA) de la aplicación y reportar fallas en vivo.

### 8.3 Módulo de Auditoría en Tiempo de Ejecución (`EnterpriseAudit`)
Módulo inteligente (`/lib/core/audit/enterprise_audit.dart`) diseñado para auditorías automáticas de consistencia y salud. El método `runFullSystemAudit()` evalúa de manera programática:
1. **Consistencia de DI:** Verifica que todos los contratos abstractos (`UserRepository`, `RideRepository`, `OfferRepository`, `PricingRepository`) estén correctamente mapeados a sus implementaciones de producción en el contenedor `GetIt`.
2. **Integridad de Firmas:** Valida en memoria la estructura criptográfica de firmas generadas.
3. **Métricas de Performance:** Alerta si existen llamadas de base de datos que excedan el SLA de 3 segundos del negocio.

### 8.4 Suite de Pruebas Unitarias de Producción (`/test/unit_tests_enterprise.dart`)
Suite completa de pruebas unitarias que valida los caminos felices y de error para los casos de uso nucleares:
- `CreateRideUseCase` (Éxito & Error de Firebase)
- `AcceptOfferUseCase` (Éxito & Error de Precondición)
- `CalculatePricingUseCase` (Éxito & Error de Timeout)

---

## 9. BASE DE DATOS Y PERSISTENCIA (FIREBASE CLOUD BACKEND)

### 9.1 Colecciones y Modelos de Datos de Firestore
Las transacciones operativas del sistema de subasta se estructuran en colecciones de primer nivel y subcolecciones jerárquicas:

#### 1. Colección `/users`
- **Path:** `/users/{userId}`
- **Campos:**
  - `uid` (String): ID único de Firebase Auth.
  - `fullName` (String): Nombre del usuario registrado.
  - `email` (String): Correo electrónico del usuario.
  - `role` (String): Rol actual del usuario (`passenger` o `driver`).
  - `rating` (Number): Calificación inicializada estrictamente en `5.0`.

#### 2. Colección `/rides`
- **Path:** `/rides/{rideId}`
- **Campos:**
  - `passengerId` (String): UID del creador de la solicitud.
  - `passengerName` (String): Nombre legible del cliente.
  - `driverId` (String, opcional): UID del conductor asignado.
  - `driverName` (String, opcional): Nombre legible del conductor.
  - `origin` (Map): Ubicación de recogida. Contiene `address` (String), `lat` (Number), `lng` (Number).
  - `destination` (Map): Ubicación de destino. Contiene `address` (String), `lat` (Number), `lng` (Number).
  - `suggestedPrice` (Number): Tarifa propuesta inicialmente por el cliente.
  - `finalPrice` (Number, opcional): Tarifa acordada tras la subasta.
  - `status` (String): Enums `pending`, `negotiating`, `accepted`, `in_progress`, `completed`, `cancelled`.
  - `createdAt` (Timestamp): Sincronizado con el reloj del servidor.
  - `updatedAt` (Timestamp): Última modificación registrada.

#### 3. Subcolección `/rides/{rideId}/offers`
- **Path:** `/rides/{rideId}/offers/{offerId}`
- **Campos:**
  - `rideId` (String): ID del viaje asociado.
  - `driverId` (String): UID del conductor que oferta.
  - `driverName` (String): Nombre del conductor.
  - `driverRating` (Number): Reputación del conductor.
  - `price` (Number): Tarifa propuesta.
  - `status` (String): `pending`, `accepted`, `rejected`.
  - `createdAt` (Timestamp).

---

## 10. REGLAS DE SEGURIDAD (firestore.rules)

Las reglas de seguridad aplican validación estricta a nivel de base de datos para garantizar la integridad operativa y la inmunidad frente a ataques de inyección, manipulación de datos y fugas de información sensible:

- **Global Safety Net:** Denegación explícita de lecturas y escrituras en cualquier ruta no mapeada (`allow read, write: if false;`).
- **users Collection Rules:**
  - Permite la lectura individual (`get`) a cualquier usuario autenticado.
  - Deniega explícitamente listados masivos de perfiles (`allow list: if false;`) para evitar fugas masivas de datos.
  - Permite creación de documento únicamente si el creador es el propietario del token (`isOwner(userId)`), campos requeridos completos, rol válido y calificación inicial exactamente `5.0`.
  - Permite modificaciones parciales (`update`) solo sobre `fullName`, `rating` y `role` por su respectivo propietario.
- **rides Collection Rules:**
  - Permite el listado de viajes activos a cualquier operador autenticado para posibilitar el escaneo en el panel táctico.
  - Permite creación únicamente a usuarios autenticados que firmen como pasajeros, inicien en estado `pending` y utilicen marcas de tiempo sincronizadas con el reloj de Firebase.
  - Restringe la actualización bajo un estricto mapa de transiciones permitidas.
- **offers Subcollection Rules:**
  - Permite listados de ofertas únicamente al pasajero dueño de la solicitud original o al conductor creador de la oferta específica.
  - Permite creación de ofertas solo a conductores autenticados y vinculados a viajes existentes, iniciándose en estado `pending`.
  - Permite actualizaciones de estado únicamente al pasajero propietario de la solicitud padre, restringiéndolos exclusivamente a los enums `accepted` o `rejected`.

---

## 11. MATRIZ DE TRANSICIONES DE ESTADO DEL VIAJE (RIDE STATUS)

El ciclo de vida de un viaje en ZÉNITH sigue un flujo determinista gobernado por reglas criptográficas de Firestore:

```
[ pending ] -----------------+------------------> [ cancelled ]
    |                        | (Pasajero cancela)
    | (Driver oferta)        v
    +------------------> [ negotiating ] -------> [ cancelled ]
                             |                  | (Pasajero cancela)
                             | (Pasajero acepta v
                             |  oferta)
                             +-----------------> [ accepted ]
                                                     |
                                                     | (Driver inicia tránsito)
                                                     v
                                               [ in_progress ]
                                                     |
                                                     | (Driver entrega servicio)
                                                     v
                                               [ completed ]
```
