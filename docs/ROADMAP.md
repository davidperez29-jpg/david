# Roadmap

Plan completo y criterios de aceptación: `MASTER_SPECIFICATION.md` §16.

| Fase | Estado | Entregado / siguiente |
|---|---|---|
| 0 Investigación + arquitectura | ✅ 2026-10-03 | Especificación maestra y anexos de investigación (verificación científica pendiente de acceso directo a Crossref/PubMed, D1). |
| 1 Auth + usuarios + clientes | ✅ 2026-10-03 | Monorepo y CI; autenticación propia con 2FA; organizaciones, roles, invitaciones; ficha de cliente completa (perfil, objetivos, disponibilidad, material, historial, salud declarada, cribado, consentimientos); auditoría *append-only*; UI de entrenador y de cliente; datos demo; tests unitarios, de integración y E2E. |
| 2 Base de datos + estructura | ⏭ siguiente | Resto del esquema (§6), RLS, tablas de catálogo de ejercicios/tests/métodos vacías, `DATABASE.md`. |
| 3 Biblioteca de ejercicios | pendiente | Normalización del banco de los Excel. |
| 4 Biblioteca científica | pendiente | Requiere segunda verificación con acceso a Crossref/PubMed (D1). |
| 5–15 | pendiente | Ver especificación. |

## Criterios de cierre de la Fase 1 (§63)

| Criterio | Estado |
|---|---|
| Funcionalidad | ✅ Alta de cliente en un asistente de 4 pasos; login, 2FA, invitaciones y recuperación. |
| UX | ✅ Revisada con capturas en escritorio y móvil; objetivos táctiles ≥ 48 px en el área de cliente. Pendiente: prueba con usuarios reales. |
| Seguridad | ✅ Ver `SECURITY.md`; aislamiento probado en integración y E2E. |
| Tests | ✅ 60 unitarios, 34 de integración y 6 E2E. |
| Documentación | ✅ `ARCHITECTURE.md`, `SECURITY.md`, `TESTING.md`, `API.md`, `ROADMAP.md`, `CHANGELOG.md`. |
| Manejo de errores | ✅ Errores de dominio tipados, mensajes en español, estados vacíos. |
| Datos de prueba | ✅ `pnpm db:seed:demo`. |
| Pendiente conocido | Envío real de emails (D4); RLS (Fase 2); exportación y supresión RGPD (Fase 13). |
