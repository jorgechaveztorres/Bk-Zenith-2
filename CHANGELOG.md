# Changelog

All notable changes to the **ZÉNITH** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.2.0-food-marketplace] - 2026-11-17
### Added
- Marketplace de comida (FOOD-001), backend completo: restaurantes publican su menú **sin costo**; Zénith solo gana con la comisión de envío ya existente (10%, ADR-004).
- Migración `003_restaurantes.sql`: tablas `restaurants` y `menu_items`; columna `rides.restaurant_id`.
- `restaurant.service.ts` y `/api/restaurants/*`: alta de restaurante y menú (solo el dueño), listado público de restaurantes abiertos y su menú, abrir/cerrar, y creación de pedido de comida con los precios de los platos congelados y validados por el servidor (nunca por el cliente).
- El pedido de comida reutiliza el motor de precio firmado, despacho, OTP y realtime ya existente para encomiendas (origen = restaurante, destino = cliente, `order_type = 'FOOD'`), sin duplicar lógica.
- Prueba `test:food` (15 casos) contra MariaDB real.
### Changed
- `ride.service.ts`: `order_type` ahora es dinámico (`DELIVERY` | `FOOD`) en vez de fijo; `package_info` guarda el detalle de encomienda o de comida según corresponda.

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
