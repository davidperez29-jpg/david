# Roadmap

Plan completo y criterios de aceptación: `MASTER_SPECIFICATION.md` §16.

| Fase | Estado | Entregado / siguiente |
|---|---|---|
| 0 Investigación + arquitectura | ✅ 2026-10-03 | Especificación maestra y anexos de investigación (verificación científica pendiente de acceso directo a Crossref/PubMed, D1). |
| 1 Auth + usuarios + clientes | ✅ 2026-10-03 | Monorepo y CI; autenticación propia con 2FA; organizaciones, roles, invitaciones; ficha de cliente completa (perfil, objetivos, disponibilidad, material, historial, salud declarada, cribado, consentimientos); auditoría *append-only*; UI de entrenador y de cliente; datos demo; tests unitarios, de integración y E2E. |
| 2 Base de datos + estructura | ✅ 2026-10-03 | Esquema completo (91 tablas), restricciones, triggers de integridad multi-tenant, RLS en todas las tablas con activación automática por caso de uso, catálogos estructurales (patrones, músculos, categorías, variables y perfiles de prescripción, poblaciones, desenlaces), `DATABASE.md`. |
| 3 Biblioteca de ejercicios | ⏭ siguiente | CRUD y buscador, media con verificación, progresiones, sustituciones; normalización del banco de los Excel. |
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
| Pendiente conocido | Envío real de emails (D4); exportación y supresión RGPD (Fase 13). |

## Criterios de cierre de la Fase 2

| Criterio | Estado |
|---|---|
| Funcionalidad | ✅ Esquema completo de §6 con migraciones reproducibles desde cero (`pnpm db:reset`). |
| Seguridad | ✅ RLS en todas las tablas, probada con SQL directo; integridad organización/cliente por triggers. |
| Tests | ✅ 66 unitarios, 49 de integración y 6 E2E. |
| Documentación | ✅ `DATABASE.md`; `ARCHITECTURE.md`, `SECURITY.md` y `TESTING.md` actualizados. |
| Datos | ✅ Catálogos estructurales sembrados de forma idempotente; demo cargable con un comando. |
| UX | Sin cambios visibles (fase de estructura). |
