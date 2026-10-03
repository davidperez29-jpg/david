# Changelog

Formato: fecha · cambio · motivo · archivos · impacto.

## 2026-10-03 — Fase 10: motor de decisiones

- **Cambio:** dominio del motor (§13).
  - **Incluye:** DSL de condiciones en JSON sin `eval`; 10 etapas puras y deterministas (hechos, cribado, perfil, necesidades, priorización, métodos, ejercicios, dosis, plan y explicación); fase de introducción por puntuación; 24 reglas por defecto como datos (nivel F) enlazadas a afirmaciones.
  - **Archivos:** `packages/domain/src/decision/*`.
- **Cambio:** umbrales del perfil sin valor por defecto.
  - **Motivo:** no inventar números. El motor avisa y usa una referencia verificada aplicable o la valoración del entrenador.
- **Cambio:** contexto desde la base de datos, con datos de salud solo con consentimiento.
  - **Incluye:** ejecuciones guardadas con su huella y versión de reglas; propuestas con evidencia enlazada; decisiones (aceptar, aceptar con cambios auditados en `manual_overrides`, rechazar, posponer); rasgos manuales; editor de reglas versionado (ADMIN) con métricas de rechazo por regla; desactivación por cliente.
  - **Archivos:** `packages/application/src/decision.ts`, migraciones `0017` y `0018`, rutas `/api/v1/clients/{id}/decision*`, `/recommendations/{id}/decision`, `/clients/{id}/trait-flags` y `/decision/rules`.
  - **Impacto:** permisos `decision:read`, `decision:run`, `decision:decide` y `decision:rules`.
- **Cambio:** interfaz.
  - **Incluye:** pestaña «Necesidades» con «¿Por qué?» (DATOS / INTERPRETACIÓN / REGLA / EVIDENCIA con DOI / APLICABILIDAD / LIMITACIONES / CONFIANZA) y acciones en cada propuesta; «Ajustes → Reglas del motor de decisión».
- **Cambio:** demo con umbrales de futbolista en el centro, 1RM reciente de Iker y propuestas para todos los clientes.
- **Cambio:** tests: 288 unitarios (golden case del futbolista de §69 y otros 8), 118 de integración y 28 E2E.
- **Cambio:** documentación: `DECISION_ENGINE.md`; `API.md`, `TESTING.md`, `DATABASE.md`, `ROADMAP.md`, `SCIENTIFIC_FRAMEWORK.md`, `MASTER_SPECIFICATION.md` y `README.md` actualizados.

## 2026-10-03 — Fase 9: dashboards y calendario

- **Cambio:** dominio de dashboards: racha, hitos positivos (solo mejoras confirmadas), cuadrícula de mes, fases y descargas como intervalos.
  - **Archivos:** `packages/domain/src/dashboard`.
- **Cambio:** casos de uso: calendario global (alcance por RLS, filtro por entrenador para ADMIN), dashboard del entrenador, Resumen del cliente, dashboard del cliente, tests visibles en el Progreso del cliente; la agenda del cliente incluye evaluaciones.
  - **Archivos:** `packages/application/src/dashboard.ts`, migración `0016`.
- **Cambio:** interfaz del entrenador.
  - **Incluye:** «Calendario» (mes y semana, filtros, estados con icono y texto, evaluaciones, fases y descargas, agenda en el móvil); Hoy según §8.2 (feedback reciente, evaluaciones pendientes); Resumen del cliente; selector de tests visibles.
- **Cambio:** interfaz del cliente: Hoy con los ejercicios de la sesión, racha y próxima evaluación; Progreso con hitos y los tests elegidos; Calendario con evaluaciones.
- **Cambio:** tema claro, oscuro o del sistema en Ajustes, aplicado antes de pintar (§9.7).
- **Cambio:** revisión UX con 3 tareas cronometradas en E2E (`UX_REVIEW.md`); 4 problemas detectados y corregidos.
- **Cambio:** tests: 270 unitarios, 110 de integración y 27 E2E.
- **Cambio:** documentación: `DASHBOARD.md` y `UX_REVIEW.md`; `API.md`, `TESTING.md`, `DATABASE.md`, `ROADMAP.md`, `MASTER_SPECIFICATION.md` y `README.md` actualizados.

## 2026-10-03 — Fase 8: seguimiento y alertas

- **Cambio:** dominio de seguimiento (§13.7).
  - **Incluye:** adherencia (24/21 = 87,5 %), carga interna sRPE, monotonía y tensión descriptivas (sin ACWR), bienestar y 10 reglas de alerta configurables que describen y nunca diagnostican.
  - **Archivos:** `packages/domain/src/monitoring/*`.
- **Cambio:** evidencia nueva verificada en PubMed.
  - **Datos:** Foster 2001, Haddad 2017, Foster 1998 e Impellizzeri 2020; 3 afirmaciones.
  - **Archivos:** `seed-data/evidence/monitoring.json`.
- **Cambio:** evaluación de alertas como código de sistema tras confirmar (`afterCommit`) y en el trabajo diario (`pnpm monitor:daily`).
  - **Incluye:** una alerta viva por situación, escalado en el mismo registro, resolución automática, 7 días de espera tras resolver una persona, notificación de las rojas.
  - **Archivos:** `packages/application/src/monitoring.ts`, migración `0015`.
- **Cambio:** reglas por centro versionadas y auditadas (solo ADMIN); desactivación por cliente; valoración por ejercicio (también sin conexión); RPE previsto de la sesión.
  - **Impacto:** permisos `monitoring:read`, `alerts:manage` y `monitoring:rules`.
- **Cambio:** interfaz.
  - **Incluye:** menú «Alertas •N», página de alertas, Hoy con adherencia y alertas, pestaña Seguimiento con gráfico, tabla y evidencia, editor de reglas y «Tu constancia» en la app del cliente.
- **Cambio:** demo con adherencias del 45 % al 100 % y alertas de cada color.
- **Cambio:** tests: 261 unitarios, 107 de integración y 23 E2E.
- **Cambio:** documentación: `MONITORING.md`; `API.md`, `TESTING.md`, `DATABASE.md`, `ROADMAP.md`, `SCIENTIFIC_FRAMEWORK.md`, `SESSIONS.md`, `MASTER_SPECIFICATION.md` y `README.md` actualizados.

## 2026-10-03 — Fase 7: sesiones y app del cliente

- **Cambio:** esquema y dominio de ejecución (§9, §4.5).
  - **Incluye:** alternativas preaprobadas, marcas de revisión en registros, idempotencia de sustituciones, función acotada `notify_client_trainers` y reglas puras (hoy, precarga, validación de series, sustitución en vivo, conflictos de sincronización, cumplimiento).
  - **Archivos:** migraciones `0013` y `0014_rls_v3`, `packages/domain/src/sessions`.
- **Cambio:** casos de uso y API.
  - **Incluye:** publicación (solo planes activos), agenda, reproductor, registro idempotente, `/sync` con _savepoint_ por mutación, sustituciones, cierre con dolor solo con consentimiento, bienestar, modo sala, revisión y bandeja.
  - **Archivos:** `packages/application/src/sessions.ts`, `apps/web/src/app/api/v1/{sessions,set-logs,substitutions,sync,review-inbox}`.
  - **Impacto:** permisos `sessions:read/log/publish/review`.
- **Cambio:** app del cliente como PWA.
  - **Incluye:** manifiesto, service worker propio, cola en IndexedDB, reproductor de una página, Hoy, Calendario y bienestar.
  - **Impacto:** el menú inferior pasa a Hoy · Calendario · Progreso · Perfil; Privacidad y Ajustes se abren desde Perfil.
- **Cambio:** vistas del entrenador: publicar en el plan y en el editor, alternativas en el editor, pestaña Sesiones, revisión de sesión, modo sala y «Sesiones de hoy» y revisión en Hoy.
- **Cambio:** demo: los clientes con app tienen un plan activo relativo a la fecha, publicado y con las sesiones pasadas registradas.
- **Cambio:** tests: 238 unitarios, 100 de integración y 20 E2E, incluido el criterio de aceptación sin conexión.
- **Cambio:** documentación: `SESSIONS.md`; `API.md`, `TESTING.md`, `DATABASE.md`, `ROADMAP.md`, `PLANNING.md`, `MASTER_SPECIFICATION.md` y `README.md` actualizados.

## 2026-10-03 — Fase 6: planificación

- **Cambio:** dominio de planificación (§12).
  - Validación de la prescripción: VBT solo en ejercicios compatibles y no para principiantes; RIR o RPE, nunca ambos.
  - Texto para el cliente.
  - Expansión de plantillas con fechas y progresión declarativa por semana: ola de RIR, carga lineal, +serie, descarga.
  - Propuestas post-sesión: doble progresión y ajuste por RIR. Solo proponen.
  - Indicadores semanales.
  - **Archivos:** `packages/domain/src/planning/*`.
- **Cambio:** tabla `plan_templates` (ADR-013), 17 plantillas por objetivo y frecuencia (12 semanas, métodos enlazados) y 92 ejercicios globales publicados.
  - **Archivos:** `seed-data/templates/*`, `seed-data/exercises/global.json`, migraciones `0011` y `0012_rls_v2`.
- **Cambio:** casos de uso, API y UI.
  - **Incluye:** planes desde plantilla (con % 1RM → kg desde un 1RM medido y conflictos de material y tolerancias) o en blanco; árbol, calendario e indicadores; editor de sesión; overrides auditados con motivo; duplicar sesión, semana y plan; guardar como plantilla anonimizada; activación con revisión y un solo plan activo; revisiones con diferencias.
  - **Archivos:** `packages/application/src/planning.ts`, `apps/web/src/app/app/plans/*`.
  - **Impacto:** permisos `plans:read/write/templates`.
- **Cambio:** demo con 8 planes; tests: 217 unitarios, 91 de integración y 16 E2E.
- **Cambio:** documentación: `PLANNING.md`; `API.md`, `TESTING.md`, `ROADMAP.md`, `DATABASE.md`, `ARCHITECTURE.md`, `EXERCISE_LIBRARY.md` y `README.md` actualizados.

## 2026-10-03 — Fase 5: evaluación

- **Cambio:** dominio de evaluación (§11).
  - Agregación de intentos.
  - Interpretación del cambio frente al error típico y al MDC95: primero la fiabilidad local, después la publicada en población similar y, si no hay, sin veredicto.
  - Errores combinados para las métricas de diferencia y tendencia con 3 o más puntos.
  - Métricas derivadas: IMC, déficit de COD por lado, fuerza relativa, CMJ/SJ y asimetrías descriptivas.
  - Aplicabilidad de referencias, con z-score solo si son aplicables.
  - Puntos de corte descriptivos frente a clínicos (solo los clínicos derivan).
  - Propuesta de batería con exclusiones de seguridad.
  - **Archivos:** `packages/domain/src/assessment/*`.
- **Cambio:** casos de uso, API y UI.
  - **Incluye:** catálogo y fichas, fiabilidad del centro, baterías, evaluaciones por intentos y lados, progreso con gráficos SVG con banda de error y la pantalla «Progreso» del cliente.
  - **Archivos:** `packages/application/src/assessments.ts`, `apps/web/src/app/app/assessments/*`, `apps/web/src/app/me/progreso`.
  - **Impacto:** permisos `assessments:read/write/catalog`.
- **Cambio:** catálogo global verificado en PubMed.
  - **Datos:** 43 tests, 38 filas de fiabilidad, 10 de referencia y 57 fuentes. Cada fila incluye la cita literal del resumen que contiene sus cifras.
  - **Comprobación:** 8 fuentes contrastadas de nuevo con PubMed antes de importar.
  - **Archivos:** `seed-data/assessment/*`, `packages/db/src/seed/{assessment,knowledge}.ts`.
  - **Impacto:** 3 poblaciones nuevas.
- **Cambio:** 5 referencias no localizadas y 24 datos no verificados **[REQUIERE VERIFICACIÓN]**, entre ellos los cortes EWGSOP2, que no figuran en el resumen.
  - **Archivos:** `docs/research/assessment_seed_report.md`.
- **Corrección:** el anexo de la Fase 0 tenía invertidos los MDC del lunge test (intra/inter); se sigue el resumen de Powden 2015. El PMID 31081853 propuesto para EWGSOP2 es una fe de erratas; el correcto es 30312372.
- **Cambio:** migraciones `0009` y `0010`; demo con 2–3 evaluaciones por cliente.
- **Cambio:** tests: 176 unitarios, 84 de integración y 14 E2E.
- **Cambio:** documentación: `ASSESSMENT.md`; `API.md`, `TESTING.md`, `ROADMAP.md`, `DATABASE.md` y `README.md` actualizados.

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
