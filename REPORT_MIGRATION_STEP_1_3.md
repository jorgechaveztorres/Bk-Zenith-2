# ZÉNITH Migration Report - Etapas 1 a 3
## Archivos Modificados:
- `server.ts` -> Desacoplado.
- `server/app.ts` -> Nuevo punto de entrada de Express con middlewares globales.
- `server/middlewares/auth.middleware.ts` -> Validación Zero-Trust JWT con Firebase Admin.
- `server/middlewares/security.middleware.ts` -> Helmet, CORS, Rate Limiting (General y Sensible).
- `server/config/firebase.ts` -> Inicialización de Firebase Admin modular.
- `server/routes/` y `server/controllers/` -> Rutas y controladores segregados para Payments, Settlements, Rides.
- `server/services/` -> `payment.service.ts`, `settlement.service.ts`, `pricing.service.ts`, `ride.service.ts`, `wallet.service.ts`.

## Motivo del cambio:
Migración a Clean Architecture para el Backend (Node/Express). Establecimiento del principio "Server Authority". Desplazamiento de la lógica crítica de transacciones, liquidaciones y fijación de precios desde el cliente inseguro hacia el backend seguro.

## Riesgos mitigados:
- **Spoofing y Suplantación de Identidad**: Todos los endpoints ahora validan que el token JWT (Zero-Trust) coincida con la entidad que realiza la acción (`req.user.uid`).
- **Manipulación de Precios**: El cálculo y la firma criptográfica se ejecutan en Node.js mediante el `PricingEngine` centralizado.
- **Doble Gasto / Race Conditions**: `PaymentService`, `WalletService` y `SettlementService` ahora utilizan `db.runTransaction()` con el SDK de Admin.
- **Ataques de Fuerza Bruta y DoS**: Implementado Rate Limiting restrictivo para endpoints financieros (`/api/payments`, `/api/settlements`).

## Funcionalidades preservadas:
- Flujo transaccional completo: `WalletService`, `PaymentEngine`, y `SettlementEngine` siguen funcionando de forma transparente para el frontend (las llamadas se mantienen intactas en `src/services/` mientras el backend asume la ejecución lógica).
- Integración Vite HMR ininterrumpida.

## Siguiente etapa:
Etapa 4 y 5: Endurecimiento de Firestore (Security Rules para denegar escrituras desde el cliente) y Refactorización de componentes monolíticos frontend (separación de UI y la capa de red).
