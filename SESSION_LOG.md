# Registro de Sesión

**Fecha:** 18 de Noviembre de 2026 (parte 4)
**Agente:** Claude (Sonnet 5)
**Fase:** MySQL/cPanel — Calificación de viajes

## Objetivo Completado
- Calificación de viajes (paquete 4 del orden fijado por el usuario): `POST /api/rides/:rideId/rate` en `server/services/ride.service.ts` (`RideService.rateRide`) y `server/routes/ride.routes.ts`. Solo el cliente del pedido puede calificar, solo cuando ya está `COMPLETED`, solo una vez (409 si ya tiene `rating`), de 1 a 5 estrellas con comentario opcional.
- Al calificar se recalcula `AVG(rides.rating)` de todos los pedidos de ese motorizado dentro de la misma transacción y se actualiza `driver_profiles.rating` y `users.rating` — ambas columnas ya existían desde el esquema original pero nadie las usaba todavía.
- `admin.service.ts` agrega `p.rating` al `SELECT` y a `DriverApplicationView`; `src/api/types.ts` lo refleja en `ApiDriverApplication`.
- App: `OrderHistory.tsx` agrega el componente `RateRide` (estrellas tappables + comentario opcional) dentro de la tarjeta expandida de un pedido `COMPLETED` sin calificar todavía, visible solo para el cliente (no para el motorizado, que no puede autocalificarse). `AdminHome.tsx` muestra el promedio (con ícono de estrella) junto a los datos de un motorizado ya aprobado.
- Prueba `test:rating` (13 aserciones): pedido inexistente, no calificar antes de `COMPLETED`, rango 1-5 rechaza 0 y 6, califica con 4 estrellas y guarda el comentario, no se puede calificar dos veces, un cliente no puede calificar el pedido de otro, el promedio se recalcula bien con pedidos de dos clientes distintos ((4+2)/2=3.00), el motorizado no puede calificarse a sí mismo, requiere sesión. `npm run lint` y `npm run build` limpios. Suite completa: 185/185 OK (172 anteriores + 13 nuevas).
- Commit `9ac64f8`, push a `zenith/mysql-login`.

## Pendiente / Siguiente
- Seguir con el paquete 5 del orden fijado: **push notifications + GPS en segundo plano**. Probablemente Web Push/FCM para las notificaciones y, para el GPS en segundo plano del motorizado en Android, revisar los permisos de ubicación en background que necesitará el APK (paquete 8).
- No se hizo verificación visual con Playwright de la pantalla nueva (sí 13 pruebas de backend contra la API real).

---

**Fecha:** 18 de Noviembre de 2026 (parte 3)
**Agente:** Claude (Sonnet 5)
**Fase:** MySQL/cPanel — Historial de pedidos

## Objetivo Completado
- Historial de pedidos (paquete 3 del orden fijado por el usuario): `GET /api/rides/history`, paginado y del más reciente al más antiguo, con los pedidos ya terminados (entregado/cancelado/sin motorizado) del cliente o del motorizado. Reutiliza la tabla `rides` existente (ya tenía `order_type`, `rating`, `feedback`, `cancelled_by`, `cancel_reason`), así que no hizo falta migración.
- `RideService.getHistory()` en `server/services/ride.service.ts`: filtra por `passenger_id` o `driver_id` igual al usuario de la sesión, `pageSize` con tope de 50. Ruta en `server/routes/ride.routes.ts`, antes de `/:rideId` para que no choque con el parámetro.
- `RideView`/`ApiRide` ahora exponen `rating`/`feedback`/`cancelledBy`/`cancelReason` (ya estaban en la tabla, solo faltaba mapearlos) — quedan listos para el siguiente paquete (calificación).
- App: `src/components/app/OrderHistory.tsx`, ícono propio ('History') en el header visible para cliente y motorizado (sin restricción de rol, a diferencia de billetera/documentos que son solo del motorizado), tarjetas expandibles con el detalle de cada pedido (ítems si es comida, direcciones si es delivery, pago, contraparte, motivo de cancelación, estrellas si ya tiene calificación) y botón "Ver más" para paginar.
- Prueba `test:order-history` (13 aserciones): historial vacío al empezar, un pedido en curso no aparece hasta que termina, el cliente y el motorizado lo ven cada uno desde su lado, un motorizado no ve pedidos ajenos, orden descendente por fecha, paginación con `hasMore` correcto sin repetir pedidos, `pageSize` se recorta a un máximo, y el endpoint exige sesión. `npm run lint` y `npm run build` limpios. Suite completa: 172/172 OK (159 anteriores + 13 nuevas).
- Commit `5ab984f`, push a `zenith/mysql-login`.

## Pendiente / Siguiente
- Seguir con el paquete 4 del orden fijado: **calificación de viajes**. Las columnas `rides.rating`/`rides.feedback` ya existen y ya están expuestas en `RideView`; falta el endpoint para que el cliente califique (probablemente `POST /api/rides/:rideId/rate`, solo tras `COMPLETED` y solo una vez) y mostrarlo en el perfil del motorizado / panel admin.
- No se hizo verificación visual con Playwright de la pantalla nueva (sí 13 pruebas de backend contra la API real).

---

**Fecha:** 18 de Noviembre de 2026 (parte 2)
**Agente:** Claude (Sonnet 5)
**Fase:** MySQL/cPanel — SMS real con Twilio

## Objetivo Completado
- SMS real (paquete 2 del orden fijado por el usuario): `server/services/sms.service.ts` ahora tiene una clase `TwilioSms` (implementa `SmsSender`) junto a la ya existente `ConsoleSms`. `SMS_PROVIDER=twilio` envía por Twilio de verdad; `SMS_PROVIDER=console` sigue siendo el default y lo que usan todos los tests.
- Credenciales: el usuario confirmó que ya tiene cuenta y credenciales de Twilio, pero decidí no pedírselas ni aceptarlas por el chat (son sensibles). El código las lee solo de variables de entorno (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` o `TWILIO_MESSAGING_SERVICE_SID`); el usuario las pondrá él mismo en su `.env`/entorno de cPanel al desplegar.
- Antes de decidir Twilio: el usuario pidió evaluar un proveedor llamado "Gamanet"; busqué documentación pública (3 búsquedas distintas) y no encontré ningún rastro de un proveedor de SMS con ese nombre. El usuario confirmó que no tiene cuenta ni documentación de Gamanet aún, y eligió integrar Twilio ahora mismo en vez de esperar.
- `.env.example` documenta las 4 variables nuevas de Twilio (vacías, sin valores reales).
- `npm install twilio` (`^6.3.0`). `npm run lint` y `npm run build` limpios. Reinicié MariaDB (el entorno se reseteó) y corrí la suite completa: 159/159 OK (auth 23, rides 38, realtime 13, app 27, food 15, admin 11, wallet 20, driver-documents 12) — sin cambios porque los tests usan `setSmsSender()` para inyectar un sender simulado.
- Commit `b36257b` y push a `zenith/mysql-login`.

## Pendiente / Siguiente
- Seguir con el paquete 3 del orden fijado: **historial de pedidos**.
- Si en el futuro aparece documentación de "Gamanet", basta agregar una clase más que implemente `SmsSender` y un nuevo `case` en `getSmsSender()`, sin tocar el resto del login.

---

**Fecha:** 18 de Noviembre de 2026
**Agente:** Claude (Sonnet 5)
**Fase:** MySQL/cPanel — Documentos del motorizado (APP-002 completo)

## Objetivo Completado
- Documentos del motorizado: datos de vehículo/licencia + fotos de licencia y vehículo, con revisión del admin. Completa APP-002 (lo que faltaba tras el panel de aprobar/rechazar de la sesión anterior).
- Migración `006_driver_documents.sql`; `driver-documents.service.ts` (valida placa/licencia, exige ambas fotos); `driver-documents.routes.ts` con `multer` (multipart, 5MB máx, jpg/png/webp) — las fotos se sirven solo al propio motorizado o a un admin, nunca públicas, guardadas en `uploads/driver-docs/` (añadido a `.gitignore`).
- App: `MyDocuments.tsx` para el motorizado (ícono propio en el header); `AdminHome.tsx` ahora muestra miniaturas de ambas fotos en cada solicitud pendiente/en revisión.
- Prueba `test:driver-documents` (12 aserciones). Suite completa 159/159 en verde (`npm run lint` y `npm run build` limpios).
- El usuario pidió que yo decida el orden de las siguientes prioridades de desarrollo, dejando Google Routes al final. Quedó fijado en `PROJECT_STATE.json` y `ROADMAP.md`: 1) documentos [hecho], 2) SMS real, 3) historial de pedidos, 4) calificación, 5) push + GPS en segundo plano, 6) recarga con OCR/IA, 7) limpieza técnica, 8) APK firmado, 9) backups/secretos, 10) Google Routes.

## Pendiente / Siguiente
- Seguir con el paquete 2 del orden fijado: **SMS real** (hoy `SMS_PROVIDER=console`; el código solo sale en el log del servidor, así que nadie fuera de pruebas puede registrarse todavía).
- No se hizo verificación visual con Playwright de las pantallas nuevas (sí 12 pruebas de backend contra la API real).

---

**Fecha:** 17 de Noviembre de 2026 (parte 2)
**Agente:** Claude (Sonnet 5)
**Fase:** MySQL/cPanel — Billetera (deuda de comisión) + recarga Yape manual

## Objetivo Completado
- Billetera del motorizado con modelo InDrive: el cliente paga en efectivo/Yape directo al motorizado; el motorizado le debe a Zénith la comisión de cada pedido completado (10%, mínimo S/ 0.50, 0% los primeros 14 días desde su aprobación).
- Backend: migración `005_wallet_topup.sql`; `wallet.service.ts` cobra la comisión dentro de la misma transacción que completa el pedido (`ride.service.ts`) y bloquea la conexión del motorizado si su deuda supera S/ 2 (`driver.service.ts`); `topup.service.ts` con el flujo manual de recarga Yape (sin OCR/IA): pedir con monto + número de operación, el admin acredita o rechaza con motivo.
- Se encontró que el backend de wallet/topup que ya existía (`wallet.controller.ts`, `topup.controller.ts`, `WalletService`/`TopupService` viejos) seguía 100% atado a Firebase/Firestore — nunca se migró a MySQL y estaba desactivado en producción (`FIREBASE_DISABLED=true`). Se reemplazó por completo y se borraron esos archivos muertos, junto con el test `test/topup-v1-suite.ts` que dependía del emulador de Firebase.
- App: `WalletHome.tsx` (deuda, días gratis, pedir recarga, historial) con ícono de billetera en el header solo para motorizados; pestaña "Recargas" dentro del panel admin (`AdminTopups.tsx`).
- Prueba `test:wallet` (20 aserciones) contra MariaDB real. Suite completa 147/147 en verde (`npm run lint` y `npm run build` también limpios).
- Nota de entorno: el contenedor había perdido el servicio MariaDB y el `.env` de la sesión anterior (se reinició entre sesiones); hubo que recrear el usuario root de MariaDB (vía `--skip-grant-tables`), la base de prueba `zt`, el `.env` local y reaplicar `schema.sql` + las 5 migraciones antes de poder correr cualquier prueba.

## Pendiente / Siguiente
- No hay un paquete siguiente explícitamente pedido por el usuario — su pedido de "panel para aprobar y luego la billetera" quedó completo con esta sesión.
- Ideas para la próxima iteración (no pedidas aún): subir foto del comprobante Yape con OCR/IA (hoy la recarga es 100% manual), documentos del motorizado (fotos de licencia/brevete), calificación, historial de pedidos, limpiar pantallas y servicios viejos de Firebase que ya no usa `App.tsx` (`DriverFlow.tsx`, `ControlCenter.tsx`, `OperationalEngine.ts`, `src/services/WalletService.ts`, `ride-settlement.service.ts`, rutas `settlement/payment/audit/ledger`).
- No se hizo verificación visual con Playwright de las pantallas nuevas (sí se verificó con 20 pruebas de backend contra la API real, igual que el panel admin de la sesión anterior).

---

**Fecha:** 17 de Noviembre de 2026
**Agente:** Claude (Sonnet 5)
**Fase:** MySQL/cPanel — Panel de aprobación de motorizados

## Objetivo Completado
- Panel de administración para aprobar/rechazar motorizados (parte de APP-002), reemplazando la aprobación manual por phpMyAdmin.
- Backend: migración `004_admin_drivers.sql`, `AdminService` (listar/aprobar/rechazar), rutas `/api/admin/drivers/*` protegidas por `requireAppRole(['admin'])`, reutilizando `users.is_admin` y `audit_logs`.
- Frontend: `AdminHome.tsx` con pestañas Pendientes/Aprobados/Rechazados, accesible por el ícono de escudo en el header solo si `user.isAdmin`.
- Prueba `test:admin` (11 aserciones) contra MariaDB real. Suite completa 127/127 en verde. `npm run lint` y `npm run build` limpios.
- Commit `feat(admin): panel de aprobación/rechazo de motorizados` en `zenith/mysql-login`.

## Pendiente / Siguiente
- Billetera/Yape (Culqi): revisar esquema ya existente (`wallets`, `wallet_movements`, `topup_requests`, `topup_audit`, `bank_movements`, `processed_bank_movements`, `ride_settlements`, `accounting_entries`, `accounting_lines`) y `wallet.routes.ts`/`topup.routes.ts` antes de escribir código nuevo.
- Nota para el siguiente agente: el claim `adm` del JWT queda fijo al momento de iniciar sesión; si se otorga `is_admin=1` por SQL directo hay que volver a loguear esa cuenta.
- No se hizo verificación visual con Playwright de esta pantalla (sí se verificó con 11 pruebas de backend contra la API real).

---

**Fecha:** 18 de Septiembre de 2026
**Agente:** ZENITH_LEAD_ARCHITECT_AGENT
**Fase:** Zénith MVP V1.1 — Dominio Operativo de Motorizados y Envíos (Sprint OPS-V1.1)

## Objetivo Completado
- Implementación exhaustiva del **Dominio Operativo Zénith MVP V1.1** gobernando las operaciones de entrega en moto bajo el modelo Zero-Trust y Server Authority.
- Implementación de los 4 protagonistas operacionales: Solicitante, Pagador, Receptor y Motorizado (con validación de roles desacoplados).
- Modelado e implementación de los niveles de evidencia (Básico, Intermedio, Máximo) con captura de foto/guía y verificación estricta de OTP de 4 dígitos.
- Implementación de la matriz completa de casos operativos del protocolo:
  - **Caso 01**: Recorrido normal con confirmación mediante OTP.
  - **Caso 02**: Receptor no disponible tras 4 intentos de comunicación; activación de Custodia Activa (60 min perecible / 48 hrs no perecible).
  - **Caso 03**: Recojo no disponible tras espera de 5 minutos, cobro de tarifa base y compensación de 3 km al motorizado.
  - **Casos 04 & 05**: Rechazo en punto de origen por producto no apto o empaque defectuoso con tarifa base compensada.
  - **Caso 08**: Cancelación unilateral del motorizado con penalidades progresivas según el contador diario (alerta, S/ 5, S/ 10, suspensión de 24h a partir de la 4ta).
  - **Caso 09**: Incidentes en tránsito (Avería mecánica: 1ra sin costo / 2da con descanso preventivo de 4 horas; Accidente: protocolo de emergencia con rescate y reasignación).
  - **Caso 10**: Modificación de destino en tránsito con recálculo dinámico de tarifa, validación de margen (máx 15 km) y derecho de aceptación/rechazo del motorizado.
  - **Recuperación de Custodia (Pedido 2)**: Creación de segundo trayecto remunerado para devolución al remitente o entrega a nuevo destino.
  - **Disposición Final**: Liberación legal de custodia tras expiración del plazo estipulado.
- Construcción de componentes de presentación tácticos:
  - `ZenithOrderCreationModal.tsx`: Creación guiada con configuración de protagonistas y cláusula de contingencia.
  - `ZenithActiveOperationHUD.tsx`: Panel para el solicitante/pasajero con control de cambio de destino, solicitud de Pedido 2 y timeline de eventos.
  - `ZenithOperationTimeline.tsx`: Línea de tiempo inmutable con registro cronológico de auditoría en Firestore.
  - `ZenithMotorizadoCockpit.tsx`: Cabina operativa del motorizado con temporizadores, llamadas/WhatsApp, botones de contingencia, fotos y validación OTP.
  - `ZenithCustodyPanel.tsx`: Panel de gestión de productos en custodia retenidos por el motorizado.
- Integración en flujos principales:
  - `PassengerFlow.tsx`: Integración de `ZenithOrderCreationModal`, `ZenithActiveOperationHUD` y banner de regularización de deuda pendiente.
  - `DriverFlow.tsx`: Integración de `ZenithMotorizadoCockpit` en tránsito activo y `ZenithCustodyPanel` en el dashboard.
- Actualización de servicios backend:
  - `WalletService.creditCompensation`: Abono de créditos de compensación por esperas o fallos de entrega.
  - `NotificationService.notifyUser`: Notificaciones directas a usuarios sobre cambios operacionales.
  - `OperationalEngine.disposeCustodyProduct`: Disposición autorizada de productos custodiados.

## Archivos Creados
- `/src/components/delivery/ZenithOrderCreationModal.tsx`
- `/src/components/delivery/ZenithActiveOperationHUD.tsx`
- `/src/components/delivery/ZenithOperationTimeline.tsx`
- `/src/components/delivery/ZenithMotorizadoCockpit.tsx`
- `/src/components/delivery/ZenithCustodyPanel.tsx`

## Archivos Modificados
- `/src/types.ts`
- `/src/services/OperationalEngine.ts`
- `/src/services/WalletService.ts`
- `/src/services/NotificationService.ts`
- `/src/components/PassengerFlow.tsx`
- `/src/components/DriverFlow.tsx`
- `/PROJECT_STATE.json`
- `/SESSION_LOG.md`
- `/CHANGELOG.md`
- `/ROADMAP.md`

## Pruebas de Estabilidad
- `lint_applet` (`tsc --noEmit`): Ejecutado exitosamente con 0 errores y 0 warnings.
- `compile_applet` (`npm run build`): Compilación de producción exitosa en Vite y Node.

## Próximos Pasos (Handoff)
- **Recarga de Billetera vía Yape**: Implementar el módulo de recarga de saldo mediante Yape exclusivo para el motorizado (modelo InDrive: el pasajero no tiene billetera, el motorizado recarga créditos para pagar comisiones/penalidades).
- **Pruebas E2E**: Ejecutar recorridos simulados de los Casos 02, 03, 08 y 10 para certificar la experiencia visual en el dispositivo móvil del motorizado.

---

# Sesión 2026-11-17 — Migración a MySQL/cPanel (Claude Sonnet 5.5)

## Objetivo
Dejar el servidor de Zénith funcionando en el cPanel propio (shocos.nom.pe), sin Firebase, con login, pedidos, despacho y avisos en tiempo real.

## Hecho
- Esquema MySQL (30 tablas) + migración 002 (pedidos) aplicados en `shocos_zenith`.
- Login celular + clave (bcrypt, JWT 1 h + refresh 30 d con rotación), SMS solo para registro/recuperar clave.
- Pedidos: cotización firmada, despacho al motorizado aprobado más cercano (≤6 km, GPS <120 s), oferta 15 s, aceptar, código de recojo de 4 dígitos, entrega.
- Tiempo real por WebSocket (`/zenith-api/ws`): ofertas, estados, ubicación en vivo; la app cae a consulta periódica si falla.
- Rutas con estimación gratuita por defecto; Google solo con `ROUTE_PROVIDER=google`.
- Comisión configurable en `app_settings` (10%, mín. S/0.50, 14 días gratis).
- Desplegado en el servidor real y probado de punta a punta; usuarios de prueba borrados.

## Archivos clave
`database/schema.sql`, `database/migrations/002_pedidos.sql`, `server/services/*` (auth, dispatch, ride, driver, routes, pricing, settings, sms), `server/routes/*`, `server/realtime/*`, `server/config/mysql.ts`, `deploy/cpanel/package.json`. Pruebas: `test:auth` (23), `test:rides` (38), `test:realtime` (13), pricing (23), geo (42).

## Pendiente
Ver `next_work_package` en PROJECT_STATE.json. Limpieza: app `zenith-wstest`, 13% fijo viejo, ramas sin fusionar.

## Entorno
Despliegue: push a GitHub → rama `deploy-cpanel` → copiar `dist/server.cjs` y `package.json` a `/home/shocos/zenith-deploy` → NPM Install y reiniciar en Node.js Selector. Único log persistente: `stderr.log`. phpMyAdmin pide confirmación manual en cada DELETE.

---

# Sesión 2026-11-17 (noche) — APP-001: la app sobre la API MySQL (Claude Opus 5.5)

## Objetivo
Que la app deje de depender de Firebase en su flujo principal: entrar, pedir y repartir contra `shocos.nom.pe/zenith-api`.

## Hecho
- `src/api/`: cliente HTTP con sesión guardada y renovación automática (una sola a la vez), WebSocket con reconexión y consulta de respaldo, GPS (Capacitor), tipos espejo del servidor.
- `PhoneAuth`: entrar con celular + clave; registro y recuperar clave con SMS.
- `PassengerHome`: mapa OpenStreetMap, buscar/tocar/GPS, precio firmado, pedir, seguimiento en vivo (estado + ubicación), código de recojo, cancelar.
- `DriverHome`: conectarse con GPS (latido cada 15 s, 5 s con pedido), oferta 15 s, aceptar/rechazar, en camino → llegué → código → entregado, enlaces a Google Maps/Waze.
- Servidor: buscador de direcciones gratis (`/api/geo`, Nominatim con caché 24 h y cola de 1 consulta/seg); CORS acepta el origen del APK.
- `App.tsx` reescrito sin Firebase. Decisión del dueño: mapa OpenStreetMap (gratis) hasta el lanzamiento.

## Verificado
- `tsc` 0 errores, `npm run build` OK, Firebase fuera del paquete de la app.
- MariaDB local: auth 23, rides 38, realtime 13, app 27 (nuevo), pricing 23, geo 42.
- Recorrido completo en Chrome con dos teléfonos simulados (cliente y motorizado): registro → pedido → oferta → aceptar → código → entregado.

## Pendiente
- Desplegar servidor en cPanel (rutas `/api/geo`, CORS) y compilar el APK.
- APP-002: documentos del motorizado + panel admin. Luego billetera/Yape (comisión 10 % desde `app_settings`).
- Las pantallas viejas (PassengerFlow, DriverFlow, admin, LSO, prueba corazón) siguen en el repo sin usarse.
