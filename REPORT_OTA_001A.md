# INFORME DE AUDITORÍA TÉCNICA: OTA-001A (VERIFICACIÓN ARQUITECTÓNICA)

## VALIDACIÓN 1: ESTRUCTURA DEL BACKEND
**Estado:** IMPLEMENTADO
**Evidencia encontrada:** El comando `ls -laR server/` confirma la existencia del árbol de directorios requerido bajo el patrón Clean Architecture:
- `server/app.ts` (Entry point de Express)
- `server/config/firebase.ts`
- `server/controllers/` (`payment.controller.ts`, `ride.controller.ts`, `settlement.controller.ts`)
- `server/middlewares/` (`auth.middleware.ts`, `security.middleware.ts`)
- `server/routes/` (`index.ts`, `payment.routes.ts`, `ride.routes.ts`, `settlement.routes.ts`)
- `server/services/` (`payment.service.ts`, `pricing.service.ts`, `ride.service.ts`, `settlement.service.ts`, `wallet.service.ts`)

## VALIDACIÓN 2: DESACOPLAMIENTO DE `server.ts`
**Estado:** IMPLEMENTADO
**Evidencia encontrada:** Archivo `/server.ts`.
- **Lógica Mantenida:** Exclusivamente la inicialización del servidor HTTP (bind al puerto 3000), la carga del middleware de Vite (`createViteServer`) para entornos de desarrollo y la entrega de estáticos (`express.static('dist')`) en producción.
- **Lógica Movida:** Toda la inicialización de Firebase Admin, endpoints (antes dispersos) y lógica de negocio fue delegada a `/server/app.ts` (a través de la exportación `createApp`).

## VALIDACIÓN 3: EXISTENCIA Y RESPONSABILIDADES DE `app.ts`
**Estado:** IMPLEMENTADO
**Evidencia encontrada:** Archivo `/server/app.ts`.
- **Responsabilidades:** Configuración de Express como contenedor de la API.
- **Middlewares Registrados:** `express.json({ limit: '1mb' })`, `express.urlencoded`, y `configureSecurity(app)`.
- **Rutas Cargadas:** Endpoint de salud (`/api/health`) y enrutador maestro `apiRoutes` (`/api`).

## VALIDACIÓN 4: MIDDLEWARES DE AUTENTICACIÓN Y SEGURIDAD
**Estado:** IMPLEMENTADO
**Evidencia encontrada:**
- **auth.middleware.ts:** Valida la presencia de `req.headers.authorization`. Separa el prefijo `Bearer ` e invoca `auth.verifyIdToken(token)` del SDK `firebase-admin`. Si es válido, inyecta `req.user = { uid, email, role }` permitiendo la autorización Zero-Trust. Protege todas las rutas de los controladores inyectando `requireAuth`.
- **security.middleware.ts:** Implementa `helmet` para cabeceras HTTP. Configura `cors` (restringiendo orígenes en producción). Implementa `express-rate-limit` con un límite general de 100 reqs/15 min y uno estricto de 10 reqs/15 min para operaciones financieras críticas (`/api/payments` y `/api/settlements`).

## VALIDACIÓN 5: ANÁLISIS DE SERVICIOS DEL BACKEND
**Estado:** IMPLEMENTADO
**Evidencia encontrada:**
- **pricing.service.ts:** `/server/services/pricing.service.ts`. *Métodos:* `calculateProtectedPrice`, `verifyPricingSeal`. *Responsabilidad:* Calcular determinísticamente la tarifa inmutable y emitir el sello criptográfico (Sello Zénith). Sin dependencias externas.
- **wallet.service.ts:** `/server/services/wallet.service.ts`. *Métodos:* `getOrCreateWallet`, `creditRideEarnings`, `depositFunds`, `withdrawFunds`. *Responsabilidad:* Gestión segura del saldo. *Dependencias:* `firebase-admin/firestore`.
- **payment.service.ts:** `/server/services/payment.service.ts`. *Métodos:* `process`. *Responsabilidad:* Prevención de fraude simulado, débito transaccional (ACID) y grabación de registros de pago. *Dependencias:* `firebase-admin/firestore`.
- **settlement.service.ts:** `/server/services/settlement.service.ts`. *Métodos:* `process`. *Responsabilidad:* Ejecutar cierres de caja usando transacciones de Firestore para evitar condiciones de carrera (cero balances). *Dependencias:* `firebase-admin/firestore`.
- **ride.service.ts:** `/server/services/ride.service.ts`. *Métodos:* `requestRide`, `acceptRide`, `cancelRide`, `updateRideStatus`. *Responsabilidad:* Máquina de estados del viaje. Asegura que solo conductores y pasajeros involucrados puedan modificar su estado. *Dependencias:* `pricing.service`, `firebase-admin/firestore`.

## VALIDACIÓN 6: ELIMINACIÓN DE LÓGICA CRÍTICA EN EL FRONTEND
**Estado:** IMPLEMENTACIÓN PARCIAL
**Evidencia encontrada:**
- **Pricing:** El archivo `src/utils/pricingEngine.ts` desapareció, delegándose enteramente al backend.
- **Settlement & Payment:** `src/services/PaymentEngine.ts` y `src/services/SettlementEngine.ts` quedaron exclusivamente como **proxies de red** (hacen `fetch` a `/api/payments/process` y `/api/settlements/process`). Han perdido toda su lógica interna.
- **Wallet:** **RIESGO CRÍTICO ENCONTRADO.** El archivo `src/services/WalletService.ts` fue parcialmente recreado en la migración y **aún contiene lógica de negocio**, importando `updateDoc` y mutando el documento del usuario directamente desde el cliente con el Firebase Client SDK.

## VALIDACIÓN 7: FLUJO ZERO-TRUST
**Estado:** IMPLEMENTADO
**Evidencia encontrada:**
Recorrido demostrado de una solicitud (Ej: `/api/payments/process`):
1. **Cliente:** Invoca proxy `PaymentEngine.processPassengerPayment` incluyendo JWT en cabeceras.
2. **API:** Recibe POST en `server/routes/payment.routes.ts`.
3. **Middleware JWT:** `requireAuth` (`auth.middleware.ts`) verifica y extrae `req.user.uid` con SDK Admin, truncando la conexión si el token es nulo o alterado.
4. **Controller:** `payment.controller.ts` intercepta los DTOs. Compara identidades (Ej: valida `userId !== passengerId` para prevenir spoofing de peticiones).
5. **Service:** `PaymentService.process` orquesta el caso de uso y ejecuta la lógica financiera en transacciones.
6. **Firestore Admin:** Escribe como sistema usando `db.runTransaction`, eludiendo las restricciones de las security rules.

## VALIDACIÓN 8: MAPA DE RUTAS
**Estado:** IMPLEMENTADO
**Evidencia encontrada:**
En `/server/routes/index.ts` y derivados:
- **POST** `/api/payments/process` -> Middleware: `requireAuth` -> Controller: `payment.controller.processPayment`
- **POST** `/api/settlements/process` -> Middleware: `requireAuth` -> Controller: `settlement.controller.processSettlement`
- **POST** `/api/rides/request` -> Middleware: `requireAuth` -> Controller: `ride.controller.requestRide`
- **POST** `/api/rides/:rideId/accept` -> Middleware: `requireAuth` -> Controller: `ride.controller.acceptRide`
- **POST** `/api/rides/:rideId/cancel` -> Middleware: `requireAuth` -> Controller: `ride.controller.cancelRide`
- **POST** `/api/rides/:rideId/status` -> Middleware: `requireAuth` -> Controller: `ride.controller.updateRideStatus`

## VALIDACIÓN 9: ENDURECIMIENTO DE FIRESTORE
**Estado:** IMPLEMENTACIÓN PARCIAL / VULNERABLE
**Evidencia encontrada:**
Revisando `firestore.rules`:
- Las colecciones secundarias como `/payments/`, `/settlements/` y `/wallets/{userId}/movements` ya están bloqueadas con `allow write: if false;`.
- **EXCEPCIÓN CRÍTICA:** La billetera (`wallet`) está anidada dentro del documento principal del usuario en la colección `/users/{userId}`. Las reglas actuales indican: `allow update: if (isOwner(userId) && request.resource.data.uid == userId)`.
Al no haber un esquema de exclusión de campos (field-level security) en `firestore.rules`, un pasajero o conductor **todavía puede sobrescribir** el nodo `wallet` enviando un payload manipulado directamente desde la web, ya que el backend aún no es la única barrera real de escritura.

## VALIDACIÓN 10: MODIFICACIONES DE LA OTA-001
**Estado:** IMPLEMENTADO
**Evidencia encontrada:**
- `package.json`: Se instalaron `cors`, `helmet`, `express-rate-limit`, `firebase-admin`, `@types/cors`. Objetivo: Proveer herramientas de seguridad.
- `server.ts`: Limpieza masiva de más de 100 líneas, delegando la lógica. Impacto: Desacoplamiento.
- `server/app.ts`: Creación del entry point seguro para la API de Zénith.
- `server/config/`, `server/middlewares/`, `server/controllers/`, `server/routes/`, `server/services/`: Creados desde cero para segregar dominios.
- `src/services/PaymentEngine.ts` y `SettlementEngine.ts`: Reescribidos como proxies estáticos (stubs) apuntando a los endpoints de la API.

---
## CONCLUSIÓN Y ESTADO DE APROBACIÓN
La OTA-001 se encuentra **APROBADA PARCIALMENTE** con reservas graves.

La estructura del backend, los middlewares, el ruteo y el Principio de Server Authority están físicamente en el repositorio. Sin embargo, persisten dos fallas que impiden la certificación del endurecimiento:
1. `src/services/WalletService.ts` en el cliente no fue refactorizado como un proxy y mantiene lógica crítica.
2. `firestore.rules` permite mutaciones del campo `wallet` a nivel `isOwner`.

La auditoría cruzada requerida ha finalizado satisfactoriamente documentando el estado fáctico. Queda a la espera de la OTA-002 para mitigar los riesgos descritos.
