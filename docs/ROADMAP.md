# Roadmap

Plan completo y criterios de aceptación: `MASTER_SPECIFICATION.md` §16.

| Fase | Estado | Entregado / siguiente |
|---|---|---|
| 0 Investigación + arquitectura | ✅ 2026-10-03 | Especificación maestra y anexos de investigación (verificación científica pendiente de acceso directo a Crossref/PubMed, D1). |
| 1 Auth + usuarios + clientes | ✅ 2026-10-03 | Monorepo y CI; autenticación propia con 2FA; organizaciones, roles, invitaciones; ficha de cliente completa (perfil, objetivos, disponibilidad, material, historial, salud declarada, cribado, consentimientos); auditoría *append-only*; UI de entrenador y de cliente; datos demo; tests unitarios, de integración y E2E. |
| 2 Base de datos + estructura | ✅ 2026-10-03 | Esquema completo (91 tablas), restricciones, triggers de integridad multi-tenant, RLS en todas las tablas con activación automática por caso de uso, catálogos estructurales (patrones, músculos, categorías, variables y perfiles de prescripción, poblaciones, desenlaces), `DATABASE.md`. |
| 3 Biblioteca de ejercicios | ✅ 2026-10-03 | Alta, edición, publicación con requisitos, búsqueda sin tildes y filtros, vídeos con verificación humana, siluetas, grafo de progresiones sin contradicciones, sustituciones explicadas con material y tolerancias del cliente; banco de los Excel (1 141 ejercicios) importado como borradores para revisar. |
| 4 Biblioteca científica | ✅ 2026-10-03 | Fuentes, hallazgos, afirmaciones y métodos con niveles A–H calculados, QA científico, revisión con lista de control, publicación solo por administración; trazabilidad método → fuente con DOI/PubMed; 135 fuentes verificadas en PubMed (139 desde la Fase 8), 80 afirmaciones y 23 métodos globales; enlace ejercicio ↔ método. |
| 5 Evaluación | ✅ 2026-10-03 | Catálogo de 43 tests con protocolo, fiabilidad (38 filas) y referencias (10 filas) verificadas en PubMed; baterías por objetivo con exclusiones de seguridad; registro por intentos; métricas derivadas; cambio interpretado frente al error típico y el MDC95 (sin veredicto si el error es desconocido); z-score solo con referencia aplicable; gráficos; vista sencilla para el cliente. |
| 6 Planificación | ✅ 2026-10-03 | Planes de 3/6/9/12 meses (fases → mesociclos → semanas → sesiones → bloques → ejercicios), 17 plantillas por objetivo y frecuencia con métodos enlazados, 92 ejercicios globales publicados, % 1RM → kg desde un 1RM medido, conflictos de material y tolerancias, progresión declarativa, editor de sesión con overrides auditados, duplicaciones, guardar como plantilla, revisiones e indicadores semanales, calendario. |
| 7 Sesiones | ✅ 2026-10-03 | Publicación por sesión, semana o plan; PWA instalable con service worker propio y cola en IndexedDB; reproductor con registro de un toque, RIR, descanso, sustitución en vivo con alternativas preaprobadas y cierre (sRPE, dolor con consentimiento); sincronización idempotente sin duplicados con conflictos marcados; modo sala; revisión del entrenador. |
| 8 Feedback + adherencia | ✅ 2026-10-03 | Adherencia (24/21 = 87,5 %), carga interna sRPE, monotonía y tensión descriptivas (sin ACWR), bienestar, valoración por ejercicio, 10 reglas de alerta 🟢🟡🔴 configurables por centro y por cliente, evaluación tras cada evento y trabajo diario, página de alertas, Hoy y ficha de seguimiento. |
| 9 Dashboard | ✅ 2026-10-03 | Hoy del entrenador según §8.2 (cifras, alertas, sesiones de hoy, feedback reciente, evaluaciones pendientes), calendario global (mes, semana, filtros, estados, evaluaciones, fases y descargas), Resumen del cliente, Hoy y Progreso del cliente (vista previa, racha, hitos, métricas elegidas por el entrenador), modo oscuro elegible, revisión UX con 3 tareas cronometradas. |
| 10 Motor de decisiones | ⏭ siguiente | Context builder, cribado, perfilado, necesidades, priorización, selección de métodos, ejercicios y dosis, explicación. |
| 11–15 | pendiente | Ver especificación. |

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

## Criterios de cierre de la Fase 3

| Criterio | Estado |
|---|---|
| Funcionalidad | ✅ Biblioteca completa (§14, §27–§30); importación del banco de la metodología del usuario. |
| UX | ✅ Revisada con capturas; búsqueda tolerante; alternativas con motivos legibles. Los nombres de grupos musculares se muestran en español. |
| Seguridad | ✅ Permisos `library:*`, RLS de catálogo, subida de imágenes con detección de tipo y sin SVG, CSP de `frame-src` restringida, límite por IP corregido para gimnasios con IP compartida. |
| Tests | ✅ 102 unitarios, 63 de integración y 8 E2E. |
| Documentación | ✅ `EXERCISE_LIBRARY.md`, `API.md`, `TESTING.md`. |
| Datos | ✅ Demo con 1 141 ejercicios en borrador y 1 011 vídeos pendientes de verificar. |
| Pendiente conocido | Revisión humana del banco importado (324 ejercicios sin patrón, 720 sin músculos); verificación de los vídeos. |

## Criterios de cierre de la Fase 4

| Criterio | Estado |
|---|---|
| Funcionalidad | ✅ Capa científica completa (§10): fuentes, hallazgos, afirmaciones, métodos, revisiones, QA y aplicabilidad; enlace ejercicio ↔ método. |
| UX | ✅ Niveles siempre con su significado; trazabilidad desplegable con citas literales y enlaces a DOI/PubMed; atribución «Según PubMed». |
| Seguridad | ✅ Permisos `science:*` (publicar solo ADMIN), RLS de catálogo, contenido global de solo lectura, bloqueo optimista, auditoría de cada cambio. |
| Tests | ✅ 138 unitarios, 76 de integración y 11 E2E. |
| Documentación | ✅ `SCIENTIFIC_FRAMEWORK.md`, `research/evidence_seed_report.md`, `API.md`, `TESTING.md`, `DATABASE.md`. |
| Datos | ✅ 135 fuentes (verificadas en PubMed), 218 hallazgos, 80 afirmaciones (79 publicadas), 23 métodos; incluidos en `db:seed`/`db:reset`. |
| Pendiente conocido | Revisión humana experta de las afirmaciones globales; 19 referencias de los documentos no localizables en PubMed **[REQUIERE VERIFICACIÓN]**. |

## Criterios de cierre de la Fase 5

| Criterio | Estado |
|---|---|
| Funcionalidad | ✅ §11 completo: catálogo, fiabilidad local y publicada, referencias con población, baterías, propuesta por objetivo, registro por intentos y lados, métricas derivadas, comparación antes/después, series y tendencia. |
| Criterio de aceptación §16.2 | ✅ Comparación antes/después interpretada frente al MDC (tests de dominio y de integración). **Sin z-score si la referencia no es aplicable** (test). |
| UX | ✅ Revisada con capturas: valores redondeados y en español, veredictos con su base, gráficos con banda de error, lenguaje sencillo para el cliente. |
| Seguridad | ✅ Permisos `assessments:*` y RLS de tipo `client_owned`. El cribado solo se lee con consentimiento de salud. Sin tests máximos sin cribado. Síntomas que detienen el test. Las referencias clínicas derivan, nunca diagnostican. |
| Tests | ✅ 176 unitarios, 84 de integración y 14 E2E. |
| Documentación | ✅ `ASSESSMENT.md`, `research/assessment_seed_report.md`, `API.md`, `TESTING.md` y `DATABASE.md`. |
| Datos | ✅ Catálogo global en `db:seed`/`db:reset`; demo con 2–3 evaluaciones por cliente (valores ficticios). |
| Pendiente conocido | Revisión experta de las baterías. Cortes EWGSOP2 y normas por edad pendientes de texto completo **[REQUIERE VERIFICACIÓN]**. La mayoría de los tests necesitarán test-retest propio para emitir veredictos. |

## Criterios de cierre de la Fase 6

| Criterio | Estado |
|---|---|
| Funcionalidad | ✅ §12.1–12.8: jerarquía completa, creación manual y desde plantilla, duplicar (sesión, semana, plan), guardar como plantilla, progresiones declarativas, perfiles de prescripción, revisiones, calendario e indicadores. |
| Criterio de aceptación §16.2 | ✅ Plan de 12 semanas y 3 días desde plantilla, editado y activado en un E2E de pocos segundos (umbral de 20 min). Overrides auditados con motivo (test de integración). |
| UX | ✅ Revisada con capturas: asistente por objetivo y frecuencia, vistas semanas/calendario/gestión, editor que muestra solo las variables del perfil y el texto para el cliente. |
| Seguridad | ✅ Permisos `plans:*`; RLS en plantillas (`rls_v2`); tolerancias leídas solo con consentimiento; un solo plan activo; nada automático modifica un plan activo. |
| Tests | ✅ 217 unitarios, 91 de integración y 16 E2E. |
| Documentación | ✅ `PLANNING.md`, ADR-013, `API.md`, `TESTING.md` y `DATABASE.md`. |
| Datos | ✅ 17 plantillas y 92 ejercicios globales en `db:seed`; demo con 8 planes (5 activos). |
| Pendiente conocido | Publicación al cliente y registro (Fase 7); progresión a partir de registros como recomendaciones (Fases 8–11); plantillas de los Excel tras su revisión. |

## Criterios de cierre de la Fase 7

| Criterio | Estado |
|---|---|
| Funcionalidad | ✅ §9: publicación por sesión, semana o plan; Hoy y calendario del cliente; reproductor con registro de un toque, RIR, descanso, sustitución en vivo y cierre (sRPE, fatiga, motivación, dolor); bienestar diario; modo sala; revisión del entrenador. |
| Criterio de aceptación §16.2 | ✅ Sesión registrada sin conexión y sincronizada sin duplicados (E2E con `setOffline` y reenvío de las mismas mutaciones). |
| UX | ✅ Revisada con capturas en Pixel 7: objetivos táctiles de 48 px, estado de sincronización visible y menú inferior Hoy · Calendario · Progreso · Perfil. |
| Seguridad | ✅ Permisos `sessions:*`; el cliente solo ve lo publicado; dolor solo con consentimiento; avisos mediante una función `SECURITY DEFINER` acotada; caché del service worker sin API y borrada al cerrar sesión. |
| Tests | ✅ 238 unitarios, 100 de integración y 20 E2E. |
| Documentación | ✅ `SESSIONS.md`, `API.md`, `TESTING.md` y `DATABASE.md`. |
| Datos | ✅ Los tres clientes demo con app tienen su plan activo, publicado y con las sesiones pasadas registradas por sincronización: una parcial y una sustitución pendiente. |
| Pendiente conocido | Llevar el filtro «solo publicadas» también a la RLS de `sessions`. Carga interna, adherencia y alertas (Fase 8). Notificaciones push y por correo. |

## Criterios de cierre de la Fase 8

| Criterio | Estado |
|---|---|
| Funcionalidad | ✅ Valoración de sesión y de ejercicio, bienestar, dolor (con consentimiento), asistencia, adherencia, carga interna sRPE, monotonía y tensión, 10 reglas de alerta 🟢🟡🔴 configurables por centro y desactivables por cliente, ciclo de vida de las alertas y trabajo diario. |
| Criterio de aceptación §16.2 | ✅ 24 planificadas / 21 realizadas = 87,5 % (tests unitario y de integración). |
| UX | ✅ Revisada con capturas: Hoy ordenado por lo que requiere acción, alertas con icono y texto, ficha de seguimiento con gráfico y tabla, «Tu constancia» en lenguaje sencillo. |
| Seguridad | ✅ Permisos `monitoring:read`, `alerts:manage` y `monitoring:rules` (ADMIN); el cliente no ve alertas (RLS); el dolor solo con consentimiento; la evaluación corre como sistema tras confirmar. |
| Tests | ✅ 261 unitarios, 107 de integración y 23 E2E. |
| Documentación | ✅ `MONITORING.md`, `API.md`, `TESTING.md`, `DATABASE.md` y `SCIENTIFIC_FRAMEWORK.md`. |
| Datos | ✅ Demo con adherencias del 45 % al 100 % y alertas de cada color (adherencia, dolor, RPE alto, bienestar, RIR y sesión sin valoración). 4 fuentes nuevas verificadas en PubMed. |
| Pendiente conocido | Dashboards completos (Fase 9). Aplicar las propuestas de ajuste desde la alerta (Fase 11). Notificaciones push y por correo. |

## Criterios de cierre de la Fase 9

| Criterio | Estado |
|---|---|
| Funcionalidad | ✅ Dashboards de entrenador y cliente y calendario global (F18: sesiones, evaluaciones, fases, descansos). |
| Criterio de aceptación §16.2 | ✅ Revisión UX con 3 tareas cronometradas (4, 6 y 2 interacciones; umbrales en CI). Ver `UX_REVIEW.md`. La prueba con personas reales queda como protocolo pendiente. |
| UX | ✅ Capturas en escritorio y Pixel 7, claro y oscuro; 4 problemas detectados y corregidos. |
| Seguridad | ✅ Calendario solo para el personal y con alcance por RLS; filtro por entrenador solo para ADMIN; tests visibles editables solo por el personal asignado (auditado). |
| Tests | ✅ 270 unitarios, 110 de integración y 27 E2E. |
| Documentación | ✅ `DASHBOARD.md`, `UX_REVIEW.md`, `API.md`, `TESTING.md` y `DATABASE.md`. |
| Datos | ✅ Evaluaciones próximas y vencidas en la demo; Iker con 2 tests visibles. |
| Pendiente conocido | Prueba UX con personas. Hitos configurables por el entrenador. Arrastrar y soltar en el calendario para reprogramar. |
