# Changelog

Formato: fecha · cambio · motivo · archivos · impacto.

## 2026-10-03 — Fase 4: biblioteca científica

- **Cambio:** dominio científico.
  - `gradeFinding` calcula el nivel A–H a partir de la justificación guardada (diseño y motivos para bajar).
  - `claimLevel` calcula el nivel de las afirmaciones y da D ante contradicciones comparables.
  - `assessApplicability` compara a una persona con la población estudiada.
  - Validadores de QA científico para fuentes, hallazgos y afirmaciones.
  - **Motivo:** §10.4 y §10.6.
  - **Archivos:** `packages/domain/src/science/*`.
- **Cambio:** casos de uso, API y UI de la biblioteca científica.
  - **Incluye:** fuentes, verificación, hallazgos, afirmaciones, revisiones con lista de control, métodos con variables de dosis, informe de QA y enlace ejercicio ↔ método.
  - **Archivos:** `packages/application/src/science.ts`, `apps/web/src/app/app/science/*`, `apps/web/src/app/api/v1/science/*`.
  - **Impacto:** permisos `science:read/write` para ADMIN y TRAINER, y `science:publish` solo para ADMIN.
- **Cambio:** semilla global de evidencia verificada en PubMed (conector NCBI).
  - **Datos:** 135 fuentes, 218 hallazgos con cita literal, 80 afirmaciones y 23 métodos.
  - **Importación:** idempotente, en `db:seed` y `db:reset`.
  - **Comprobación:** muestra aleatoria de 12 fuentes contrastada con PubMed, con coincidencia total.
  - **Archivos:** `seed-data/evidence/*`, `packages/db/src/seed/evidence.ts`.
  - **Impacto:** 8 desenlaces y 4 poblaciones nuevos en el catálogo.
- **Cambio:** 28 correcciones a referencias de los documentos aportados y 19 referencias no localizables en PubMed **[REQUIERE VERIFICACIÓN]**.
  - **Archivos:** `docs/research/evidence_seed_report.md`.
- **Corrección:** las restricciones únicas de DOI, PMID y claves de semilla trataban `NULL` como igual, así que una organización no podía tener dos fuentes sin DOI ni dos hallazgos sin clave. Ahora son índices únicos parciales.
  - **Archivos:** `drizzle/0008_science_unique_identifiers.sql`.
- **Corrección:** los esquemas de actualización de fuentes y afirmaciones aplicaban los valores por defecto de creación. Una edición parcial vaciaba los autores (y anulaba la verificación) o los hallazgos enlazados. Hay tests de regresión.
- **Cambio:** tests: 138 unitarios, 76 de integración y 11 E2E.
- **Cambio:** documentación: `SCIENTIFIC_FRAMEWORK.md`; `API.md`, `TESTING.md`, `ROADMAP.md`, `DATABASE.md`, `EXERCISE_LIBRARY.md` y `README.md` actualizados.

## 2026-10-03 — Fase 3: biblioteca de ejercicios

- **Cambio:** dominio de la biblioteca: sustituciones con filtros y motivos explicados, detección de contradicciones en progresiones, validación de vídeos, requisitos de publicación.
  - **Motivo:** §14, §27–§30.
  - **Archivos:** `packages/domain/src/library/*`.
- **Cambio:** casos de uso, API y UI de la biblioteca.
  - **Incluye:** búsqueda sin tildes (`immutable_unaccent` + trigram), filtros, edición con bloqueo optimista, copia de contenido global, vídeos con verificación humana, siluetas, progresiones, sustituciones y tolerancias del cliente.
  - **Archivos:** `packages/application/src/library.ts`, `apps/web/src/app/app/library/*`, migraciones `0005` y `0006`.
  - **Impacto:** nuevo permiso `library:*` para el staff.
- **Cambio:** almacenamiento de archivos (puerto `FileStorage`, disco local) y descarga autorizada.
  - **Impacto:** nueva variable `FILE_STORAGE_DIR`.
- **Cambio:** normalización e importación del banco de ejercicios de los 4 Excel.
  - **Datos:** 1 141 ejercicios y 1 011 vídeos.
  - **Estado:** importados como borradores pendientes de revisión y con los vídeos sin verificar; incluidos en la demo.
  - **Archivos:** `seed-data/exercise-bank/bank.json`, `packages/application/scripts/exercise-bank/*`, `src/library-import.ts`.
- **Corrección:** el límite de intentos de login por IP contaba también los accesos correctos, de modo que un gimnasio con IP compartida podía quedar bloqueado. Ahora cuenta solo los fallos (50 en 15 min).
  - **Archivos:** `packages/auth/src/rate-limit.ts`.
- **Cambio:** tests: 102 unitarios, 63 de integración y 8 E2E, ahora repetibles sin reiniciar la base de datos.
- **Cambio:** documentación: `EXERCISE_LIBRARY.md`; `API.md`, `TESTING.md`, `SECURITY.md`, `ARCHITECTURE.md` y `ROADMAP.md` actualizados.

## 2026-10-03 — Fase 2: base de datos y estructura

- **Cambio:** esquema completo de §6.
  - **Tablas:** 66 nuevas para biblioteca de ejercicios, biblioteca científica, evaluación, planificación, seguimiento, motor de decisiones y plataforma.
  - **Restricciones:** 53 `CHECK` (RIR 0–10, RPE en pasos de 0,5, tempo, duración 3/6/9/12 meses, fuente obligatoria en valores de referencia…).
  - **Motivo:** preparar las Fases 3–12 sin rehacer el modelo.
  - **Archivos:** `packages/db/src/schema/{library,science,assessment,planning,tracking,decision,platform}.ts`, `drizzle/0002`, `drizzle/0003`.
  - **Impacto:** 91 tablas en total.
- **Cambio:** triggers `inherit_scope` y `check_client_org`.
  - **Motivo:** imposibilitar que un dato apunte a otra organización u otro cliente.
- **Cambio:** Row Level Security en todas las tablas (168 políticas), generada desde un mapa declarativo; `secured()` ejecuta cada caso de uso como `app_runtime` con el actor ligado.
  - **Motivo:** defensa en profundidad (§14.3).
  - **Archivos:** `packages/db/src/rls/*`, `drizzle/0004_rls.sql`, `packages/application/src/rls.ts`.
  - **Impacto:** el usuario de BD de la aplicación debe ser miembro de `app_runtime`.
- **Cambio:** `email_in_use()` (SECURITY DEFINER) para comprobar emails en todas las organizaciones sin revelarlas.
- **Cambio:** catálogos estructurales: 17 patrones, 26 músculos, 24 categorías, 28 variables y 10 perfiles de prescripción, 11 poblaciones y 21 desenlaces.
- **Cambio:** tests de RLS con SQL directo, de cobertura de tablas y de desviación de la migración: 66 unitarios, 49 de integración y 6 E2E.
- **Cambio:** `docs/DATABASE.md` y actualización de la arquitectura, la seguridad, los tests y el roadmap.

## 2026-10-03 — Fase 1: autenticación, usuarios y clientes

- **Cambio:** monorepo TypeScript (`apps/web`, `packages/{domain,contracts,db,auth,application}`) con CI, lint, formato y reglas de capas.
  - **Motivo:** arquitectura de §4–§5.
  - **Archivos:** raíz, `.github/workflows/ci.yml`, `.dependency-cruiser.cjs`.
  - **Impacto:** base de todo el desarrollo posterior.
- **Cambio:** esquema y migraciones de identidad, clientes, catálogos y auditoría _append-only_ (trigger).
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
