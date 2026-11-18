# Changelog

All notable changes to the **ZÉNITH** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.8.0-ride-rating] - 2026-11-18
### Added
- Calificación de viajes (completa el ítem 4 de la lista de prioridades): `POST /api/rides/:rideId/rate`, solo el cliente, solo tras `COMPLETED`, solo una vez (1 a 5 estrellas, comentario opcional hasta 500 caracteres).
- Al calificar, se recalcula al vuelo `AVG(rides.rating)` del motorizado y se actualiza `driver_profiles.rating` y `users.rating` (columnas que ya existían en el esquema desde la migración inicial, pero nunca se usaban).
- `admin.service.ts` expone `rating` en `DriverApplicationView`/`ApiDriverApplication`.
- App: `OrderHistory.tsx` agrega un selector de estrellas tappable en pedidos entregados sin calificar (solo para el cliente); `AdminHome.tsx` muestra el promedio del motorizado aprobado.
- Prueba `test:rating` (13 casos): rango 1-5, una sola vez, no antes de `COMPLETED`, no calificar pedido ajeno, el motorizado no puede autocalificarse, recálculo correcto del promedio con pedidos de distintos clientes, requiere sesión. Suite completa 185/185 en verde.

---

## [2.7.0-order-history] - 2026-11-18
### Added
- Historial de pedidos (completa el ítem 3 de la lista de prioridades): `GET /api/rides/history`, paginado y del más reciente al más antiguo, con los pedidos ya terminados (`COMPLETED`/`CANCELLED`/`EXPIRED`) del cliente o del motorizado — reutiliza la tabla `rides` existente, sin migración nueva.
- `RideService.getHistory()` filtra por `passenger_id` o `driver_id` igual al usuario; `pageSize` tiene un tope de 50.
- `RideView`/`ApiRide` ahora incluyen `rating`, `feedback`, `cancelledBy`, `cancelReason` (las columnas ya existían en `rides`, solo faltaba exponerlas).
- App: `OrderHistory.tsx`, con ícono propio en el header (visible para cliente y motorizado, sin restricción de rol), tarjetas expandibles por pedido y "Ver más" para paginar.
- Prueba `test:order-history` (13 casos): historial vacío, pedido activo no sale hasta terminar, ambos lados lo ven, no ve pedidos ajenos, orden descendente, paginación, tope de `pageSize`, requiere sesión. Suite completa 172/172 en verde.

---

## [2.6.0-sms-twilio] - 2026-11-18
### Added
- SMS real con Twilio (completa el ítem 2 de la lista de prioridades): `server/services/sms.service.ts` agrega una clase `TwilioSms` que implementa `SmsSender`, usando el paquete `twilio` (`^6.3.0`).
- `SMS_PROVIDER=twilio` activa el envío real; lee `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, y `TWILIO_FROM_NUMBER` (o `TWILIO_MESSAGING_SERVICE_SID` si se usa un Messaging Service) solo de variables de entorno — nunca se pidieron ni se escribieron credenciales reales en el chat.
- `SMS_PROVIDER=console` sigue siendo el modo de prueba por defecto (el código solo sale en el log), y es el que usa toda la suite de tests vía `setSmsSender()`.
- `.env.example` documenta las 4 variables nuevas de Twilio, vacías, con nota de que las credenciales reales van solo en el `.env`/entorno de cada despliegue.
### Decided
- Se evaluó un proveedor llamado "Gamanet" a pedido del usuario; no se encontró documentación pública de ningún proveedor de SMS con ese nombre. El usuario confirmó que no tiene cuenta ni documentación aún, y eligió integrar Twilio ahora (ya tiene cuenta y credenciales). Si Gamanet aparece más adelante, basta agregar otra clase que implemente `SmsSender` y un nuevo `case` en el switch de `getSmsSender()`.

---

## [2.5.0-driver-documents] - 2026-11-18
### Added
- Documentos del motorizado (completa APP-002): datos de vehículo/licencia y fotos de la licencia/brevete y del vehículo (placa visible), en vez de aprobar solo con el texto de la solicitud.
- Migración `006_driver_documents.sql`: columnas `license_photo_path`, `vehicle_photo_path`, `documents_submitted_at` en `driver_profiles`.
- `driver-documents.service.ts`: valida placa y número de licencia, exige que ambas fotos existan (la recién subida o una ya guardada); al enviar pasa el estado a `UNDER_REVIEW` (si estaba `PENDING` o `REJECTED`) y limpia el motivo de rechazo.
- `driver-documents.routes.ts`: `POST`/`GET /api/driver/profile` (multipart con `multer`, máx. 5 MB, solo jpg/png/webp) y `GET /api/driver/documents/:driverId/:kind`, que sirve la foto solo al propio motorizado o a un admin — nunca pública. Los archivos se guardan en `uploads/driver-docs/` (fuera de git).
- `admin.service.ts` expone `hasLicensePhoto`/`hasVehiclePhoto`/`documentsSubmittedAt` para el panel.
- App: `MyDocuments.tsx` (formulario + fotos, bloqueado una vez aprobado) con ícono propio en el header; `AdminHome.tsx` muestra miniaturas de ambas fotos en las solicitudes pendientes/en revisión antes de aprobar o rechazar.
- Prueba `test:driver-documents` (12 casos) contra MariaDB real; suite completa 159/159 en verde.
### Decided
- El usuario fijó el orden de las siguientes prioridades de desarrollo (ver `ROADMAP.md`), dejando Google Routes al final.

---

## [2.4.0-wallet] - 2026-11-17
### Added
- Billetera del motorizado con modelo InDrive: el cliente paga en efectivo/Yape directo al motorizado; el motorizado le debe a Zénith la comisión de cada pedido completado.
- Migración `005_wallet_topup.sql`: columnas `operation_number`, `rejection_reason`, `reviewed_by`, `reviewed_at` en `topup_requests`; setting `wallet_debt_limit` (S/ 2) en `app_settings`.
- `wallet.service.ts`: cobra la comisión (10%, mínimo S/ 0.50) al completar un pedido, dentro de la misma transacción que `ride.service.ts`; 0% de comisión durante `new_driver_free_days` (14 días) desde la aprobación del motorizado; bloquea su conexión si la deuda supera `wallet_debt_limit`; aplica recargas acreditadas contra la deuda.
- `topup.service.ts`: flujo manual V1 (sin OCR/IA) — el motorizado pide la recarga con el monto y el número de operación de su Yape; el admin la revisa y la acredita o la rechaza con motivo.
- Rutas `GET /api/wallet/me`, `GET /api/wallet/movements`, `POST /api/topups`, `GET /api/topups/mine`, y para el admin `GET /api/topups?status=`, `POST /api/topups/:id/credit`, `POST /api/topups/:id/reject`.
- App: `WalletHome.tsx` (deuda, días gratis restantes, pedir recarga, historial de movimientos y recargas) con ícono de billetera en el header solo para motorizados; pestaña "Recargas" dentro del panel admin (`AdminTopups.tsx`).
- Prueba `test:wallet` (20 casos) contra MariaDB real; suite completa 147/147 en verde.
### Removed
- Controladores `wallet.controller.ts`/`topup.controller.ts` y el test `test/topup-v1-suite.ts`: seguían atados a Firebase/Firestore, nunca se migraron a MySQL y estaban desactivados en producción (dead code).

---

## [2.3.0-admin-approval] - 2026-11-17
### Added
- Panel de administración para aprobar/rechazar motorizados: ya no se hace a mano por phpMyAdmin.
- Migración `004_admin_drivers.sql`: columnas `rejection_reason`, `reviewed_by`, `reviewed_at` en `driver_profiles`.
- `admin.service.ts` y `/api/admin/drivers` (`GET` listar con filtro `?status=`, `POST /:id/approve`, `POST /:id/reject` con motivo obligatorio), protegidos por `requireAppRole(['admin'])`; reutiliza `users.is_admin` y `audit_logs`, sin crear un rol ni un mecanismo de auth nuevo.
- App: `AdminHome.tsx` (pestañas Pendientes/Aprobados/Rechazados, aprobar o rechazar con motivo) accesible por el ícono de escudo en el header, solo visible si `user.isAdmin`.
- `AdminApi` y tipos `ApiDriverApplication`/`DriverReviewStatus` en `src/api`.
- Prueba `test:admin` (11 casos) contra MariaDB real; suite completa en verde (127 pruebas en total).
### Note
- El claim `adm` del token queda fijo al iniciar sesión: si se otorga `is_admin = 1` por SQL directo, esa cuenta debe volver a loguearse para que el panel la reconozca.

---

## [2.2.0-food-marketplace] - 2026-11-17
### Added
- Marketplace de comida (FOOD-001), **completo end-to-end** (backend + app): restaurantes publican su menú **sin costo**; Zénith solo gana con la comisión de envío ya existente (10%, ADR-004).
- Migración `003_restaurantes.sql`: tablas `restaurants` y `menu_items`; columna `rides.restaurant_id`.
- `restaurant.service.ts` y `/api/restaurants/*`: alta de restaurante y menú (solo el dueño), listado público de restaurantes abiertos y su menú, abrir/cerrar, y creación de pedido de comida con los precios de los platos congelados y validados por el servidor (nunca por el cliente).
- El pedido de comida reutiliza el motor de precio firmado, despacho, OTP y realtime ya existente para encomiendas (origen = restaurante, destino = cliente, `order_type = 'FOOD'`), sin duplicar lógica.
- App: `RestaurantHome.tsx` (publicar/gestionar menú/abrir-cerrar, accesible por el ícono de tienda en el header) y `FoodOrder.tsx` (navegar restaurantes, carrito, dirección de entrega, pago) con una pestaña "Pedir comida" en `PassengerHome`.
- `src/api`: `FoodApi` y tipos `ApiRestaurant`/`ApiMenuItem`/`FoodOrderDetails`.
- Prueba `test:food` (15 casos) contra MariaDB real, más una verificación visual de punta a punta en el navegador (Playwright) del flujo completo dueño → menú → cliente → pedido.
### Changed
- `ride.service.ts`: `order_type` ahora es dinámico (`DELIVERY` | `FOOD`) en vez de fijo; `package_info` guarda el detalle de encomienda o de comida según corresponda.
- `http.ts`: el cliente ahora admite `PATCH` además de `GET`/`POST`.

---

## [2.1.0-app-mysql] - 2026-11-17
### Added
- App sobre la API MySQL (APP-001): `src/api/` (sesión con renovación automática, WebSocket con reconexión, GPS).
- Pantalla de entrada con celular + clave; registro y recuperar clave con SMS.
- Cliente: mapa OpenStreetMap (Leaflet), buscar dirección / tocar el mapa / GPS, precio firmado, pedir, seguimiento en vivo, código de recojo, cancelar.
- Motorizado: conectarse con GPS, oferta con cuenta regresiva, aceptar/rechazar, estados, validar código, entregado, navegación por enlace a Google Maps/Waze.
- Servidor: `/api/geo/search` y `/api/geo/reverse` (Nominatim con caché y 1 consulta/seg).
- Prueba `test:app` (27) del cliente de la app contra servidor + MariaDB.
### Changed
- `App.tsx` ya no usa Firebase (el paquete de la app no incluye Firebase).
- CORS acepta siempre el origen del APK (`https://localhost`) aunque `FRONTEND_URL` esté definido; `FRONTEND_URL` admite varias direcciones separadas por coma.

## [2.0.0-mysql-cpanel] - 2026-11-17
### Added
- Servidor en MySQL/MariaDB (cPanel) sin Firebase: login celular + clave, pedidos y despacho, código de recojo, avisos en tiempo real por WebSocket.
- Rutas con estimación gratuita (`EstimateRouteProvider`); Google Routes opcional con `ROUTE_PROVIDER=google`.
- Comisión configurable en `app_settings` (10 %, mínimo S/ 0.50, 14 días gratis).
- Pruebas: auth (23), pedidos (38), tiempo real (13).
### Changed
- Firebase es opcional (`FIREBASE_DISABLED=true`); rutas de pedidos y precios reescritas para MySQL.
### Removed
- Controlador y pruebas antiguas que dependían del emulador de Firebase.

## [1.1.0-operational] - 2026-09-18
### Added
- **Operational Domain Zénith MVP V1.1**: Full operational domain engine (`OperationalEngine.ts`) mapping the operational rules for motorcycle parcel delivery and passenger requests.
- **Protagonist Architecture**: Multi-role participant modeling (Solicitante, Pagador, Receptor, Motorizado) with decoupled payment rules, contact validation, and contingency clauses.
- **Evidence Levels**: Formal three-tier evidence system (Básico, Intermedio, Máximo) with photo uploads and mandatory 4-digit OTP handshake.
- **Operational Cases (01 - 10)**:
  - Case 01: Standard delivery with OTP delivery verification.
  - Case 02: Recipient unavailable after 4-attempt communication protocol; automatic activation of active custody window (60 min for perishables / 48 hrs for non-perishables).
  - Case 03: Pickup unavailable after 5-minute wait with GPS geofencing, base fare deduction, and 3 km compensation credited to the motorizado.
  - Cases 04 & 05: Origin rejection due to unfit package or missing packaging with documented photographic evidence and base fare compensation.
  - Case 08: Motorizado unilateral cancellation with progressive daily penalty ladder (warning, S/ 5, S/ 10, and 24-hour preventive suspension on 4th cancellation).
  - Case 09: En-route mechanical breakdown (1st: re-dispatch without cost; 2nd: 4-hour preventive safety rest) and accident emergency protocol.
  - Case 10: Dynamic mid-transit destination change with automatic distance recalculated, fare adjustment, and motorizado acceptance handshake.
  - Custody Recovery (Pedido 2): Creation of return or re-routing trip.
- **Presentation Components**:
  - `ZenithOrderCreationModal.tsx`: Tactical order creation with protagonist setup and evidence levels.
  - `ZenithActiveOperationHUD.tsx`: Passenger active HUD with destination modification, recovery flow, and live event timeline.
  - `ZenithMotorizadoCockpit.tsx`: Driver cockpit with timers, call/WhatsApp direct triggers, custody transitions, OTP verification, and breakdown logging.
  - `ZenithCustodyPanel.tsx`: Driver panel to view and dispose of items held in temporary custody.
  - `ZenithOperationTimeline.tsx`: Immutable event stream powered by Firestore event sourcing.

---

## [1.1.0] - 2026-07-17

### Added
- **Repository Memory Infrastructure**: Established a permanent memory foundation at the root level including `PROJECT_STATE.json`, `SESSION_LOG.md`, `DECISIONS.md`, `ROADMAP.md` and updated `README.md`.
- **Ecosistema Tributario (Tax Engine)**: Implemented decoupled, high-integrity tax calculations (subtotal, IGV, discounts, totals).
- **Libro Contable Inmutable (Ledger Engine)**: Added append-only dual bookkeeping double-entry model based on Event Sourcing. No updates allowed.
- **Patrón Adapter para SUNAT**: Configured adaptors for five main providers (`SunatAdapter`, `NubefactAdapter`, `FactilizaAdapter`, `DigiflowAdapter`, `EfactAdapter`) under the `TaxAdapter` interface.
- **Tax Center Dashboard**: Integrated a brand-new tab called `TRIBUTACIÓN` into the admin area for real-time compliance monitoring, KPI sales tracking, and live simulation of documents.
- **Audit Engine Integration**: Automatic logging of fiscal transitions and ledger entries with cryptographic security hashes.

### Changed
- **Admin Dashboard Layout**: Integrated the Tributación center as an administrative tab inside `/src/components/admin/AdminDashboard.tsx`.

---

## [1.0.0] - 2026-07-10

### Added
- **Core Operating Infrastructure**: Initial stable release of the ZÉNITH Intelligent Dispatch, Passenger Wallet, GPS Trackers, and Driver Verification Modules.
- **Audit Engine**: Robust, immutable audit trail system configured to trace platform activities in Firestore.
- **Security Rules**: Added security specifications for attribute-based access control (ABAC) in `/firestore.rules`.

## [1.0.1-enterprise] - 2026-07-25
### Changed (OTA-001B)
- **Security:** Aplicación del paradigma estricto *Server Authority* en el ecosistema.
- **Security:** Endurecimiento (Hardening) de `firestore.rules` cerrando todas las brechas cliente-servidor en colecciones contables/financieras (`wallets`, `transactions`, `accounting_ledger`, `audit_logs`).
- **Refactor:** Migración de `WalletService`, `PaymentEngine`, `TransactionEngine`, `AuditEngine` y `LedgerEngine` de mutadores directos a clientes Proxy hacia `server/routes/*`.
- **Refactor:** `PassengerFlow.tsx` purgado de dependencias de débito client-side. Todo manejado en la nube por `PaymentService`.
