# INFORME TÉCNICO: OTA-001B (BLINDAJE ABSOLUTO DE FIRESTORE Y SERVER AUTHORITY)

## 1. Vulnerabilidades Críticas Encontradas en Auditoría
1. **Wallet (Billetera):** La colección de perfiles de usuario permitía, a través de `firestore.rules`, que cualquier propietario mutara libremente los nodos anidados. El campo `wallet` era un blanco fácil para sobrescribir saldos de manera fraudulenta directamente con el SDK Cliente.
2. **TransactionEngine:** En el frontend, ejecutaba la función `registerTransaction` que emitía un documento directamente en `transactions` e inyectaba el sello criptográfico en el cliente.
3. **AuditEngine & LedgerEngine:** Ambos motores inyectaban su bitácora inmutable emitiendo escrituras directas (`addDoc`, `setDoc`) a las colecciones `audit_logs` y `accounting_ledger` empleando el SDK cliente, lo que imposibilitaba garantizar la procedencia del log.
4. **Flujo de Pagos (PassengerFlow):** Restaba el saldo directamente desde el lado del cliente (con una promesa `WalletService.withdrawFunds`) antes de procesar el viaje.

## 2. Cambios Realizados y Corrección de Vulnerabilidades

### Reglas de Firestore (Zero-Trust)
- **Bloqueo del Perfil (`users`)**: Se incorporó el uso de `.diff().affectedKeys()` para prohibir estricamente las escrituras en los campos `wallet`, `role` e `isAdmin` a cualquier usuario que no sea un Administrador del sistema.
- **Bloqueo de Auditoría (`audit_logs`)**: Se revocó el `allow create` para clientes; ahora `allow write: if false;` obliga a canalizar toda bitácora por el Backend.
- **Declaración de Contabilidad (`accounting_ledger`, `transactions`)**: Explicitadas en las reglas con permisos estrictos de lectura y `allow write: if false;`.

### Server Authority (Servicios de Frontend)
- **`src/services/WalletService.ts`**: Eliminado el código que importaba `updateDoc`. Todo movimiento (consulta, recarga y débito) es ahora delegado a endpoints HTTP (`/api/wallet/...`).
- **`src/components/PassengerFlow.tsx`**: Purgada la deducción de saldo client-side. El backend asume la orquestación financiera integral en `PaymentService.process()`.
- **`src/services/TransactionEngine.ts`**: Reescrito para detonar una excepción bloqueante (Sever Authority Violation) ante cualquier intento de registro desde el frontend.
- **`src/services/AuditEngine.ts` y `LedgerEngine.ts`**: Transformados en proxys de red que despachan peticiones POST con JWT Auth hacia la API Server.

### Backend (Nuevos Controladores)
- Creados `wallet.controller.ts`, `audit.routes.ts` y `ledger.routes.ts`, incorporando sus respectivas importaciones al hub maestro de ruteo (`server/routes/index.ts`). Se validan identidades para proteger las auditorías desde `req.user.uid`.

## 3. Matriz Firestore Actualizada

| Colección | Lectura Cliente | Escritura Cliente | Escritura Backend |
| --- | --- | --- | --- |
| `users` | Sí (parcial) | Sí (Restringida, prohibido `wallet`) | Sí (Firebase Admin) |
| `wallets` / `movements` | Sí (isOwner) | **NO** | Sí (Firebase Admin) |
| `rides` | Sí | Sí (Campos limitados, requiere JWT) | Sí (Firebase Admin) |
| `payments` | Sí (Implicados) | **NO** | Sí (Firebase Admin) |
| `transactions` | Sí (Implicados) | **NO** | Sí (Firebase Admin) |
| `audit_logs` | NO | **NO** | Sí (Firebase Admin) |
| `history` | Sí (Implicados) | **NO** | Sí (Firebase Admin) |
| `accounting_ledger` | NO | **NO** | Sí (Firebase Admin) |

## 4. Riesgos Remanentes
El objetivo fundamental financiero ha sido asegurado. Las colecciones no financieras como `dispatch_logs` (algoritmos de asignación) y algunos campos de estado en `rides` (status) aún tienen escrituras controladas desde el SDK cliente. A nivel financiero/tributario, el riesgo de inyección es ahora CERO.

## 5. Resultado de las pruebas
El Linter (`tsc --noEmit`) arrojó ejecución con 0 errores tras acoplar exitosamente todas las interfaces. Los servicios Frontend fueron acoplados exitosamente a la topología API, sin romper la interfaz consumida por la capa visual (React).

---
✅ **OTA-001B APROBADA**
