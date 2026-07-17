# ZÉNITH MASTER — CORE INFRASTRUCTURE

Este repositorio contiene la infraestructura base de **Zénith**, el ecosistema descentralizado de transporte inteligente de última generación.

## Arquitectura de Carpetas
- `/src/firebase`: Configuración inicial del SDK de Firebase.
- `/src/services`: Módulos desacoplados de alta confiabilidad (Logging, Observabilidad, Verificación).
- `/src/types.ts`: Modelos de datos del ecosistema en TypeScript estricto.
- `/src/providers`: Proveedores globales de estado.
- `firestore.rules`: Reglas de seguridad basadas en ABAC.
- `firestore.indexes.json`: Índices optimizados para consultas complejas.

## Configuración y Despliegue
1. Instale las dependencias con `npm install`.
2. Configure el archivo `.env` basándose en `.env.example`.
3. Inicie el servidor de desarrollo local mediante `npm run dev`.
4. El compilador y el linter se pueden ejecutar con `npm run build` y `npm run lint`.
