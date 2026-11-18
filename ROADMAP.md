# ZÉNITH — ROADMAP

Este documento define la trayectoria técnica del proyecto **ZÉNITH**, dividida en fases y sprints lógicos. Permite a los agentes y desarrolladores visualizar el estado del proyecto, los hitos completados y los requisitos inmediatos para las siguientes fases.

---

## Estado Actual
- **Fase Activa:** Migración a MySQL en cPanel (servidor 100 %, pantallas de la app 0 %)
- **Sprint Activo:** MYSQL-001 (servidor completado) → APP-001 (pantallas, siguiente)
- **Progreso Global Estimado:** **~55%** (servidor listo; faltan pantallas de la app, documentos/admin, billetera, APK)

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
- [ ] APP-001: migrar ~40 pantallas de la app desde Firebase.
- [ ] Documentos del motorizado + panel de aprobación del admin.
- [ ] Billetera/Yape con comisión 10 % (mín. S/ 0.50, 14 días gratis).
- [ ] APK y prueba con 3–5 motorizados; SMS real; términos y privacidad; respaldos de la BD.
- [ ] Antes del lanzamiento: Google Routes con tope de cuota y alerta de presupuesto.
