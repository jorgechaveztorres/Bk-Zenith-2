# ZÉNITH MASTER — CORE INFRASTRUCTURE

Este repositorio contiene la infraestructura base de **Zénith**, el ecosistema descentralizado de transporte inteligente de última generación.

---

## 🧠 INFRAESTRUCTURA DE MEMORIA PERMANENTE

Para asegurar la continuidad del proyecto y garantizar que el repositorio sea la **Única Fuente de Verdad (Single Source of Truth)**, se ha establecido un sistema de memoria permanente a nivel raíz:

*   **[PROJECT_STATE.json](./PROJECT_STATE.json):** El estado oficial de ejecución del proyecto en tiempo de ejecución. Define fases, sprints, versión de arquitectura, agentes activos y bloqueos.
*   **[SESSION_LOG.md](./SESSION_LOG.md):** Historial inmutable de las sesiones de desarrollo realizadas por los agentes de IA, detallando objetivos, archivos modificados y tareas pendientes.
*   **[DECISIONS.md](./DECISIONS.md):** Architectural Decision Records (ADRs) que justifican formalmente las decisiones de diseño adoptadas (p. ej., Patrón Adapter, Event Sourcing).
*   **[CHANGELOG.md](./CHANGELOG.md):** Registro histórico y ordenado de los cambios de versión del software bajo el estándar *Keep a Changelog*.
*   **[ROADMAP.md](./ROADMAP.md):** Planificación estratégica detallando hitos completados, fases activas y la trayectoria de ZÉNITH hacia la producción.

---

## 📂 Arquitectura de Carpetas Operativa

*   `/src/firebase`: Configuración inicial del SDK de Firebase.
*   `/src/services`: Módulos desacoplados de alta confiabilidad (Logging, Observabilidad, Verificación).
*   `/src/services/tax`: Motor tributario empresarial (`TaxEngine`), libro contable inmutable (`LedgerEngine`), adaptadores SUNAT y repositorio fiscal.
*   `/src/components/admin`: Tableros de administración general, de despacho en tiempo real y centro contable tributario.
*   `/src/types.ts`: Modelos de datos del ecosistema en TypeScript estricto.
*   `/src/providers`: Proveedores globales de estado.
*   `firestore.rules`: Reglas de seguridad basadas en ABAC.
*   `firestore.indexes.json`: Índices optimizados para consultas complejas.

---

## 🚀 Configuración y Despliegue

1.  Instale las dependencias con `npm install`.
2.  Configure el archivo `.env` basándose en `.env.example`.
3.  Inicie el servidor de desarrollo local mediante `npm run dev`.
4.  El compilador y el linter se pueden ejecutar con `npm run build` y `npm run lint`.
