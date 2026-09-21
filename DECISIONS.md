# ZÉNITH — ARCHITECTURAL DECISIONS (ADR)

Este documento registra formalmente las decisiones arquitectónicas clave del proyecto ZÉNITH, detallando el contexto, las motivaciones, el estado actual de cada decisión y su impacto a nivel de código e infraestructura.

---

## ADR-001: Patrón Adapter para la Integración de Proveedores Tributarios (SUNAT)

- **ID de Decisión:** `ADR-001`
- **Fecha:** 2026-07-16
- **Autor:** Ecosistema de Arquitectura ZÉNITH
- **Estado:** ACEPTADA / IMPLEMENTADA
- **Descripción:** Implementar el patrón de diseño *Adapter* para desacoplar el core del negocio (viajes, cobros) del proceso de facturación electrónica. Se crearon adaptadores específicos (`SunatAdapter`, `NubefactAdapter`, `FactilizaAdapter`, `DigiflowAdapter`, `EfactAdapter`) bajo una interfaz única e inmutable llamada `TaxAdapter`.
- **Motivación (Razón):** La legislación peruana y los servicios de Proveedores de Servicios Electrónicos (PSE) y Operadores de Servicios Electrónicos (OSE) cambian con frecuencia. Depender directamente de las APIs de un proveedor específico incrementa la rigidez del software. El patrón Adapter permite alternar de proveedor en caliente mediante un selector en el panel de administración, sin alterar una sola línea de código operativo.
- **Impacto:**
  - Desacoplamiento total del sistema de despacho de viajes respecto al envío de comprobantes.
  - Flexibilidad comercial para negociar tarifas con múltiples PSE/OSE.
  - Mayor mantenibilidad de pruebas unitarias al poder simular respuestas SUNAT.
- **Archivos Afectados:**
  - `/src/services/tax/TaxTypes.ts`
  - `/src/services/tax/TaxAdapters.ts`
  - `/src/services/tax/TaxEngine.ts`

---

## ADR-002: Libro Contable Inmutable mediante Event Sourcing (Ledger Engine)

- **ID de Decisión:** `ADR-002`
- **Fecha:** 2026-07-16
- **Autor:** Ecosistema de Arquitectura ZÉNITH
- **Estado:** ACEPTADA / IMPLEMENTADA
- **Descripción:** Establecer un motor de contabilidad (`LedgerEngine`) bajo el principio de inmutabilidad total. Los asientos contables son de tipo *Append-Only* (Solo Inserción). Está estrictamente prohibido el uso de la operación `UPDATE` sobre los registros de contabilidad. Cualquier corrección o extorno posterior de transacciones contables debe ser realizado como un nuevo asiento corrector (Nota de Crédito/Débito) referenciado por hash.
- **Motivación (Razón):** En auditoría fiscal y contabilidad real, la inmutabilidad es crítica para evitar fraude y asegurar la trazabilidad. Un sistema de contabilidad transaccional tradicional que sobreescribe registros no puede ser auditado de forma confiable por la SUNAT o reguladores financieros.
- **Impacto:**
  - Garantiza trazabilidad inalterable de cada sol movilizado por la plataforma.
  - Cada entrada genera un hash único criptográfico auto-calculado y un id de auditoría cruzado con `AuditEngine`.
  - Se previenen errores de conciliación financiera y fraudes internos.
- **Archivos Afectados:**
  - `/src/services/tax/LedgerEngine.ts`
  - `/src/services/tax/TaxTypes.ts`

---

## ADR-003: Integración de Seguridad Criptográfica y Auditoría Profunda (Audit Engine)

- **ID de Decisión:** `ADR-003`
- **Fecha:** 2026-07-17
- **Autor:** Ecosistema de Arquitectura ZÉNITH
- **Estado:** ACEPTADA / IMPLEMENTADA
- **Descripción:** Vincular cada cambio de estado en el flujo fiscal y cada entrada contable al `AuditEngine` de ZÉNITH. Se registran de forma automática variables de entorno críticas como actorID, marcas de tiempo UTC estrictas, descripciones de transición, códigos de reintento y firmas de hash criptográfico en la base de datos de auditoría general.
- **Motivación (Razón):** La facturación electrónica en el Perú requiere que cada documento XML cuente con una firma digital `DSIG` válida. Preparando el terreno para esta integración, el sistema de base de datos de ZÉNITH requiere que el flujo interno de auditoría rastree de forma exacta quién y cuándo generó cada acción tributaria para blindar la plataforma ante posibles hackeos o discrepancias fiscales.
- **Impacto:**
  - Trazabilidad total de auditoría para cada documento tributario en Firestore.
  - Generación automática de logs de seguridad con niveles de severidad (`INFO`, `WARNING`, `SECURITY_ALERT`).
- **Archivos Afectados:**
  - `/src/services/tax/TaxRepository.ts`
  - `/src/services/tax/TaxEngine.ts`
  - `/src/services/tax/LedgerEngine.ts`
