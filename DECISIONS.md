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

---

## ADR-004: Comisión fija de 10% y entrada al rubro de comida como marketplace gratuito

- **ID de Decisión:** `ADR-004`
- **Fecha:** 2026-11-17
- **Autor:** Kike (dueño) + Claude
- **Estado:** ACEPTADA
- **Descripción:**
  1. La comisión de Zénith a los motorizados queda fija en **10%** (mínimo S/ 0.50, 0% los primeros 14 días por motorizado nuevo). Se descarta el 13% que se había evaluado para cubrir IGV y la comisión de Culqi dentro del mismo número: esos costos son marginales frente a la comisión y no justifican subir el porcentaje.
  2. Posicionamiento: 10% es deliberadamente más bajo que el 15%-25% que cobran Uber, DiDi e inDrive en Perú, y coincide con el tope de 10% que un proyecto de ley en el Congreso busca imponer a estas plataformas en regiones (fuera de Lima y Callao). El precio bajo es la puerta de entrada, no la única defensa: un gigante puede bajar su comisión a 0% temporalmente (como ya hizo inDrive en Lima) para defenderse; lo que no puede igualar fácilmente es la cercanía de un dueño que también es motorizado en la misma ciudad, la tarifa protegida (sin negociación) y el nicho de encargos/paquetería.
  3. Zénith entra al rubro de comida como **marketplace gratuito para restaurantes**: publicar su menú no tiene costo. Esto lo diferencia directamente de Rappi y PedidosYa, cuya comisión alta sobre cada venta es una queja constante de los negocios pequeños. El modelo de cobro exacto (si Zénith no cobra nada al restaurante y solo gana con la comisión de envío ya existente, o si cobra una comisión aparte sobre la venta de comida) queda pendiente de confirmar antes de construir el módulo.
- **Motivación (Razón):** Kike vive a diario, como motorizado de InDrive, las quejas de otros conductores sobre las comisiones altas; busca que el precio bajo sea un argumento honesto y verificable, no una promoción temporal. El código no tenía antes ninguna integración con una pasarela de pagos (Culqi fue confirmado como la plataforma habilitada); el 13% evaluado antes mezclaba IGV y la comisión de Culqi dentro del mismo número sin separarlos.
- **Impacto:**
  - `app_settings.platform_commission_rate` se mantiene en 10% (ya configurado).
  - Pendiente: diseñar el esquema de restaurantes/menús/pedidos de comida (nuevo dominio, separado de los pedidos de encomienda) y decidir su modelo de cobro antes de tocar la base de datos.
- **Archivos Afectados:** Ninguno todavía (decisión de producto); el siguiente trabajo de código depende de la respuesta pendiente sobre el cobro a restaurantes.
