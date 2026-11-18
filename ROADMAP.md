# ZÉNITH — ROADMAP

Este documento define la trayectoria técnica del proyecto **ZÉNITH**, dividida en fases y sprints lógicos. Permite a los agentes y desarrolladores visualizar el estado del proyecto, los hitos completados y los requisitos inmediatos para las siguientes fases.

---

## Estado Actual
- **Fase Activa:** Migración a MySQL en cPanel (servidor 100 %, app núcleo 100 %, documentos/admin/billetera 0 %)
- **Sprint Activo:** APP-001 (completado: login, cliente, motorizado) → APP-002 (documentos + admin, siguiente)
- **Progreso Global Estimado:** **~65%** (servidor y app núcleo listos; faltan documentos/admin, billetera, APK)

---

```text
Fase 1: Core Operativo y Despacho      ████████████████████ 100%
Fase 2: Admin, Verificación y Seguridad ████████████████████ 100%
Fase 3: Dominio Operativo MVP V1.1     ████████████████████ 100%
Fase 4: Recarga Yape y Billetera Moto  ██████████████░░░░░░ 70%
Fase 5: Firma Digital y SUNAT Directa  ░░░░░░░░░░░░░░░░░░░░ 0%
Fase 6: Despliegue y Prod              ░░░░░░░░░░░░░░░░░░░░ 0%
```

---

## HITOS Y DESGLOSE DE FASES

### 🟢 Fase 7: Marketplace de Comida (Completo — 100%)
*Restaurantes publican su menú gratis en Zénith — sin la comisión alta de Rappi/PedidosYa.*
- [x] Decidido con el dueño: el restaurante no paga nada. Zénith solo gana con la comisión de envío (10%, ADR-004).
- [x] Esquema: tablas `restaurants` y `menu_items` (migración 003); el pedido de comida reutiliza `rides` (`order_type='FOOD'`, `restaurant_id`).
- [x] API: alta de restaurante y menú por el dueño, listado público de abiertos/menú, y pedido con precios congelados y validados por el servidor (`/api/restaurants/*`).
- [x] Flujo de pedido de comida reutilizando el motor de precio firmado + despacho + OTP + realtime ya existente (origin=restaurante, destination=cliente). 15 pruebas en verde (`npm run test:food`).
- [x] Pantalla `RestaurantHome.tsx`: cualquier cuenta publica su restaurante gratis, sube/oculta platos, abre/cierra (ícono de tienda en el header).
- [x] Pantalla `FoodOrder.tsx` + pestaña "Pedir comida" en `PassengerHome`: el cliente navega restaurantes abiertos, arma su carrito, elige a dónde lo llevan y ve comida + envío por separado antes de pedir.
- [x] Verificado de punta a punta con un flujo real en el navegador (dueño publica → sube menú → cliente pide → pedido buscando motorizado con el desglose correcto).


### 🟢 Fase 1: Core Operativo (Completado)
*Despliegue de la infraestructura básica y el flujo principal de servicio.*
- [x] Configuración inicial del SDK de Firebase y persistencia en Firestore.
- [x] Portal del Pasajero (Búsqueda de viajes, wallet digital, solicitud).
- [x] Portal del Conductor (Aceptación de viajes, navegación simulada).
- [x] Motor de Despacho Inteligente y simulación de trayectos GPS en tiempo real.

### 🟢 Fase 2: Administración y Verificación (Completado)
*Consola de gobernanza, seguridad y control del ecosistema.*
- [x] Panel de verificación de antecedentes e identidad de conductores (KYC).
- [x] Consola de Despacho en vivo con visualización de viajes activos.
- [x] Implementación de Reglas de Seguridad estrictas basadas en Atributos (ABAC) en Firestore.
- [x] Motor de Auditoría centralizado (`AuditEngine`) inmutable.

### 🟢 Fase 3: Dominio Operativo Zénith MVP V1.1 (Completado)
*Reglas operacionales completas para entregas en motocicleta.*
- [x] Implementación de 4 Protagonistas (Solicitante, Pagador, Receptor, Motorizado).
- [x] Niveles de Evidencia (Básico, Intermedio, Máximo) con OTP obligatorio de 4 dígitos.
- [x] Caso 01: Flujo estándar con verificación OTP.
- [x] Caso 02: Receptor no disponible con ventana de Custodia Activa (60 min / 48 horas).
- [x] Caso 03: Recojo no disponible tras espera de 5 min con compensación de tarifa base + 3 km.
- [x] Casos 04 & 05: Rechazo por producto no apto o empaque ausente con evidencia fotográfica.
- [x] Caso 08: Cancelaciones unilaterales con escala progresiva de penalidades (Alerta, S/ 5, S/ 10, Suspensión 24h).
- [x] Caso 09: Avería mecánica (1ra libre / 2da descanso preventivo de 4h) y rescate por accidente.
- [x] Caso 10: Cambio de destino en tránsito con recálculo dinámico de tarifa y aceptación de motorizado.
- [x] Recuperación de Custodia (Pedido 2) para retorno al remitente o nuevo punto.
- [x] Disposición de Custodia al vencer los plazos legales.
- [x] Componentes de interfaz: `ZenithOrderCreationModal`, `ZenithActiveOperationHUD`, `ZenithMotorizadoCockpit`, `ZenithCustodyPanel`, `ZenithOperationTimeline`.
- [x] Integración en `PassengerFlow.tsx` y `DriverFlow.tsx`.

### 🟡 Fase 4: Recarga Yape para Motorizados (Siguiente Sprint)
*Autonomía financiera del motorizado inspirada en InDrive (pasajero sin billetera).*
- [ ] Módulo de recarga de saldo mediante Yape para motorizados.
- [ ] Acreditación de saldo para cobertura de comisiones y penalidades.
- [ ] Validación de comprobante o integración de pago móvil.

### ⚪ Fase 4: Firma Digital y Conexión SUNAT Directa (Próxima Fase)
*Integración externa real y validación tributaria.*
- [ ] Adaptador de firma digital criptográfica de SUNAT (DSIG).
- [ ] Generación física de XML con formato estándar UBL v2.1.
- [ ] Conexión TLS / Soap real hacia el OSE o webservice directo de SUNAT.
- [ ] Manejo real de Códigos de Respuesta CDR y conciliación de rechazos.
- [ ] Implementación de Notas de Crédito automatizadas en caso de cancelaciones de viajes.

### ⚪ Fase 5: Auditoría Externa, Producción y Escala (Hacia el Lanzamiento)
- [ ] Auditoría de seguridad del código de contratos de la Wallet y datos de usuarios.
- [ ] Optimización de índices compuestos de Firestore.
- [ ] Pruebas de estrés y volumen para transacciones contables simultáneas.
- [ ] Paso de entorno de homologación (Pruebas) a Producción real en SUNAT.


---

## Avance MySQL/cPanel (2026-11-17)
- [x] Esquema, login, pedidos/despacho, tiempo real, rutas gratis, despliegue y prueba real.
- [x] APP-001: migrar login/cliente/motorizado de Firebase a MySQL.
- [x] Marketplace de comida (FOOD-001): publicar restaurante, menú, pedidos, comisión de envío.
- [x] Panel de aprobación del admin (parte de APP-002): aprobar/rechazar motorizados desde la app, ya no por phpMyAdmin.
- [x] Billetera/Yape: deuda de comisión 10 % (mín. S/ 0.50, 14 días gratis para motorizados nuevos), recarga Yape manual revisada por el admin, bloqueo casi al llegar a S/ 0 (modelo InDrive: nunca acumula deuda).
- [x] Documentos del motorizado: datos de vehículo/licencia + fotos de licencia y vehículo, con revisión del admin antes de aprobar.
- [x] SMS real con Twilio: `SMS_PROVIDER=twilio` envía el código por SMS real (credenciales solo por variable de entorno); `console` sigue de modo prueba y es lo que usa toda la suite de tests.
- [x] Historial de pedidos: `GET /api/rides/history` paginado (delivery y comida, cliente y motorizado), reutilizando la tabla `rides` existente.
- [x] Calificación de viajes: `POST /api/rides/:rideId/rate` (1 a 5 estrellas, el cliente al motorizado, una sola vez); promedio visible en el panel admin.

### Orden de prioridades fijado por el usuario (17-nov-2026, Google Routes al final)
1. [x] Documentos del motorizado.
2. [x] SMS real (Twilio integrado; `SMS_PROVIDER=console` sigue siendo el modo de prueba).
3. [x] Historial de pedidos.
4. [x] Calificación de viajes.
5. [x] Push notifications (Web Push/VAPID) — [ ] GPS en segundo plano real (queda para el APK nativo).
6. [x] Recarga con menos fricción: Culqi (tarjeta/Yape de un toque, se acredita al instante); la manual sigue de respaldo.
7. [ ] Limpieza técnica: pantallas/servicios Firebase muertos, ramas sin fusionar, borrar `zenith-wstest` en cPanel.
8. [ ] APK firmado para Play Store.
9. [ ] Backups de la base de datos + revisar secretos de producción en cPanel.
10. [ ] Google Routes (reactivar con tope de cuota y alerta de presupuesto) — al final.
- [ ] APK y prueba con 3–5 motorizados; SMS real; términos y privacidad; respaldos de la BD.
- [ ] Antes del lanzamiento: Google Routes con tope de cuota y alerta de presupuesto.
