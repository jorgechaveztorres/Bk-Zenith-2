# Instrucciones de Operación para Agentes de ZÉNITH

Este archivo contiene las directrices de gobernanza, flujos de trabajo e instrucciones persistentes que todos los agentes de Inteligencia Artificial que colaboren en este repositorio deben cumplir rigurosamente.

---

## 🔄 Protocolo de Cierre Diario: "finaliza y actualiza"

El comando explícito **"finaliza y actualiza"** es el disparador oficial para dar por concluido el trabajo diario. Al recibir este comando, el agente en turno debe detener cualquier desarrollo operativo y ejecutar de forma secuencial y obligatoria el siguiente protocolo de consolidación de memoria:

1. **Garantía de Estabilidad (Build Green & Zero Warnings)**:
   - Ejecutar la verificación del linter (`lint_applet`) y confirmar que esté libre de advertencias y errores.
   - Compilar el proyecto completo (`compile_applet`) para certificar que el código en el repositorio se encuentra en estado estable y desplegable.

2. **Sincronización de Memoria Permanente (Single Source of Truth)**:
   - **`PROJECT_STATE.json`**: Actualizar marcas de tiempo, versión de arquitectura si corresponde, estado del repositorio, tareas bloqueantes y la definición detallada del siguiente paquete de trabajo (`next_work_package`).
   - **`SESSION_LOG.md`**: Registrar detalladamente la sesión completada, indicando fecha, agente, objetivo, archivos modificados, código creado, tareas pendientes y observaciones del entorno.
   - **`CHANGELOG.md`**: Actualizar el registro cronológico de cambios bajo el estándar *Keep a Changelog* reflejando la nueva versión o los commits lógicos realizados en el día.
   - **`ROADMAP.md`**: Reflejar los avances porcentuales actualizados de cada módulo de la plataforma ZÉNITH y actualizar el estatus de los hitos activos.

3. **Preparación de Handoff (Día Siguiente)**:
   - Dejar el entorno de trabajo completamente limpio.
   - Redactar un reporte de salida estructurado y resumido para el usuario que sirva también de contexto inicial para que el agente del día siguiente pueda retomar el desarrollo de manera inmediata y actualizada, sin perder el hilo conductor.

---

## 🛡️ Reglas Generales de Arquitectura

- **Clean Architecture & SOLID**: Respetar el desacoplamiento entre el núcleo operativo de despacho/viajes y los motores financieros/tributarios.
- **Event Sourcing**: El libro contable (`LedgerEngine`) es estrictamente inmutable; bajo ninguna circunstancia se debe actualizar o borrar un asiento contable existente. Cualquier corrección se realiza mediante un nuevo registro compensatorio.
- **TypeScript Estricto**: No usar `any`, `TODO`, `FIXME` ni tipados implícitos en las interfaces tributarias u operativas.
