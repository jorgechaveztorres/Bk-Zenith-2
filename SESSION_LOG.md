# Registro de Sesión

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
