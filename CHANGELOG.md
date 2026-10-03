# Changelog

Formato: fecha · cambio · motivo · archivos · impacto.

## 2026-10-03 — Fase 1: autenticación, usuarios y clientes

- **Cambio:** monorepo TypeScript (`apps/web`, `packages/{domain,contracts,db,auth,application}`) con CI, lint, formato y reglas de capas.
  - **Motivo:** arquitectura de §4–§5.
  - **Archivos:** raíz, `.github/workflows/ci.yml`, `.dependency-cruiser.cjs`.
  - **Impacto:** base de todo el desarrollo posterior.
- **Cambio:** esquema y migraciones de identidad, clientes, catálogos y auditoría *append-only* (trigger).
  - **Archivos:** `packages/db`.
  - **Impacto:** 25 tablas; catálogos de 17 objetivos, deportes y material.
- **Cambio:** autenticación propia en lugar de Better Auth (ADR-002).
  - **Motivo:** flujo solo por invitación, roles por organización, auditoría transaccional.
  - **Archivos:** `packages/auth`, `packages/application/src/{auth-service,invitations}.ts`.
  - **Impacto:** argon2id, sesiones revocables, 2FA TOTP, bloqueo y rate limiting.
- **Cambio:** casos de uso de cliente (alta, ficha, objetivos, disponibilidad, material, historial, salud declarada, cribado, consentimientos, asignaciones, auditoría).
  - **Motivo:** §10 y §14 del encargo.
  - **Impacto:** el consentimiento explícito es obligatorio para los datos de salud; aviso de derivación no diagnóstico.
- **Cambio:** aplicación web, con API REST v1 (32 rutas), área de entrenador y área móvil de cliente.
  - **Archivos:** `apps/web`.
  - **Impacto:** primer uso real posible: gestión de clientes.
- **Cambio:** datos demo (3 entrenadores, 10 clientes ficticios) y CLI `create-org`.
- **Cambio:** tests: 60 unitarios, 34 de integración y 6 E2E.
- **Cambio:** documentación: `ARCHITECTURE.md`, `SECURITY.md`, `TESTING.md`, `API.md` y `ROADMAP.md`; decisión D3 cerrada en la especificación.

## 2026-10-03 — Fase 0: investigación y arquitectura

- **Cambio:** especificación maestra del sistema.
  - **Motivo:** el encargo exige pensar antes de programar.
  - **Archivos:** `docs/MASTER_SPECIFICATION.md`.
  - **Impacto:** define la arquitectura (monolito modular TypeScript, PostgreSQL), el modelo de datos, los motores, la seguridad, el roadmap y los riesgos. Todavía no hay código.
- **Cambio:** anexos de investigación.
  - **Motivo:** trazabilidad científica.
  - **Archivos:** `docs/research/*`.
  - **Impacto:** registro de evidencia de partida, con estado de verificación por dato.
  - **Limitación:** sin acceso a Crossref/PubMed (política de red); verificación solo con el buscador web, con el cupo de búsquedas agotado.
- **Cambio:** README y .gitignore.
  - **Motivo:** base del repositorio.
  - **Archivos:** `README.md`, `.gitignore`.
  - **Impacto:** ninguno funcional.
