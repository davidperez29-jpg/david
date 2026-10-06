# Roadmap

> **Primera versión (fases 0–15): completada.** El trabajo nuevo, la reestructuración para que la aplicación sea sencilla y esté online, sigue `IMPLEMENTATION_ROADMAP.md`. Su diseño está en `PRODUCT_ARCHITECTURE.md` y documentos hermanos.

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
| 10 Motor de decisiones | ✅ 2026-10-03 | Contexto desde la base de datos (con consentimiento), 10 etapas puras y deterministas, DSL sin `eval`, 24 reglas como datos versionadas por centro, umbrales sin valor por defecto, explicación DATOS → … → CONFIANZA con DOI, decisiones del entrenador auditadas, rasgos manuales, desactivación por cliente, métricas de rechazo por regla, pestaña «Necesidades» y editor de reglas. |
| 11 Motor de programación | ✅ 2026-10-04 | Propuesta de plan (`PROPOSAL`) desde la ejecución del motor de decisiones, con semanas de introducción y sustituciones; aceptar como borrador o descartar. Ajustes semana a semana (carga por RIR o doble progresión, descarga, volumen, sustitución por molestias) que solo se aplican al aceptar, a sesiones futuras, con revisión, auditoría y deshacer. Aplicación automática opcional (desactivada por defecto). |
| 12 Informes | ✅ 2026-10-04 | Informe de cliente con los 11 apartados de §34 (pantalla, PDF reproducible, Excel y CSV desde una instantánea congelada con hash). Exportación CSV/XLSX de clientes, evaluaciones, planificación, sesiones y evolución, bajo RLS, auditada y con protección contra inyección de fórmulas. Importación validada de clientes, ejercicios, evaluaciones y referencias, con vista previa de errores por fila y columna. |
| 13 Seguridad | ✅ 2026-10-04 | Derechos RGPD ejercitables desde la interfaz (exportación JSON del interesado, solicitudes con plazo de un mes, bandeja de ADMIN, supresión por anonimización con doble confirmación y auditoría redactada); retención configurable con anonimización automática y depuración de registros de seguridad; 2FA obligatorio para ADMIN, códigos de recuperación, códigos TOTP de un solo uso, sesiones visibles y revocables; contraseñas filtradas por k-anonimato; rotación de claves de cifrado; checklist ASVS L2, plantilla de DPIA y pentest ligero automatizado. |
| 14 Pruebas | ✅ 2026-10-04 | Pirámide completa con umbrales: cobertura ≥ 90 % en el dominio y los motores (umbral en CI), 24 propiedades con fast-check, contrato de la API con detección de cambios rompientes, matriz RLS de todas las tablas, acceso cruzado en todas las rutas, accesibilidad WCAG 2.2 AA en 51 páginas (claro y oscuro), rendimiento con 1 000 clientes (< 300 ms p95) y TTI móvil < 2,5 s, auditoría de dependencias. |
| 15 Optimización y escala | ✅ 2026-10-04 | Observabilidad (logs JSON sin datos personales, `X-Request-Id`, errores depurados con *webhook* opcional, `/api/health` y `/api/ready`); límite de peticiones por usuario en BD; CSP con *nonce*; crear un plan 4× más rápido e índices revisados bajo carga; integraciones preparadas (puerto `ExternalDataSource`, importación CSV/JSON de mediciones con consentimiento para datos de salud); carga del equipo y traspaso de clientes; imagen Docker, *compose* y guía de operación con restauración que reaplica supresiones RGPD. |

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
| Pendiente conocido | Envío real de emails (D4); exportación y supresión RGPD (hecho en la Fase 13). |

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
| Pendiente conocido | ~~Llevar el filtro «solo publicadas» también a la RLS de `sessions`~~ (hecho en la reestructuración, fase 8). Carga interna, adherencia y alertas (Fase 8). Notificaciones push y por correo. |

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

## Criterios de cierre de la Fase 10

| Criterio | Estado |
|---|---|
| Funcionalidad | ✅ Contexto, cribado, perfil, necesidades, priorización, métodos, ejercicios, dosis, fase de introducción, propuesta de plan y explicación; editor de reglas; decisiones del entrenador; rasgos manuales. |
| Criterio de aceptación §16.2 | ✅ Golden cases: el futbolista de §69 y otros 8 (principiante, avanzado, mayor, derivación, adherencia baja con objetivos concurrentes, datos que faltan, regla desactivada y determinismo), con explicación completa y evidencia trazable (DOI). |
| UX | ✅ Revisada con capturas en escritorio y en el móvil: «¿Por qué?» plegable, acciones junto a cada propuesta, avisos y reglas pendientes arriba. |
| Seguridad | ✅ Permisos `decision:read/run/decide` (ADMIN o entrenador asignado) y `decision:rules` (ADMIN); RLS en las tablas nuevas; datos de salud solo con consentimiento; nunca diagnostica. |
| Tests | ✅ 288 unitarios, 118 de integración y 28 E2E. |
| Documentación | ✅ `DECISION_ENGINE.md`, `API.md`, `TESTING.md` y `DATABASE.md`. |
| Datos | ✅ Umbrales de futbolista en el centro demo; propuestas calculadas para los 10 clientes; Iker con decisiones que alimentan las métricas. |
| Pendiente conocido | Generar el plan desde la propuesta (Fase 11). Editor visual de condiciones. Umbrales por sexo o categoría. |

## Criterios de cierre de la Fase 11

| Criterio | Estado |
|---|---|
| Funcionalidad | ✅ Propuesta de plan desde plantilla y contexto. Progresión propuesta semana a semana. Propuestas de ajuste por respuesta, aceptables una a una o en bloque, editables, aplazables y reversibles. |
| Criterio de aceptación §16.2 | ✅ «Nunca modifica un plan activo sin aceptación»: test de integración que compara el plan activo antes y después de registrar, evaluar, ejecutar el trabajo diario, generar propuestas y recalcular el motor de decisiones. |
| UX | ✅ Revisada con capturas en escritorio y en el móvil: qué cambiaría antes de aceptar, «¿Por qué?», aviso en Seguimiento y en la propuesta de plan. |
| Seguridad | ✅ Solo personal asignado o ADMIN. Molestias solo con consentimiento. Sustitución sin diagnóstico. La aplicación automática se audita como `SYSTEM` y se puede deshacer. |
| Tests | ✅ 310 unitarios, 126 de integración y 29 E2E. |
| Documentación | ✅ `PROGRAMMING_ENGINE.md`, `API.md`, `TESTING.md`, `DATABASE.md` y `MONITORING.md`. |
| Datos | ✅ La demo tiene progresiones de carga de Iker pendientes, una propuesta de plan para Iker y ajustes por respuesta: descarga (Elena, Javier) y menos volumen (Tomás). |
| Pendiente conocido | Propuesta como nueva revisión del plan activo. Incremento configurable por ejercicio. Progresión VBT/e1RM. Aplicar ajustes desde la página de alertas. |

## Criterios de cierre de la Fase 12

| Criterio | Estado |
|---|---|
| Funcionalidad | ✅ Informe de cliente (11 apartados), exportaciones (5 entidades, CSV/XLSX) e importaciones validadas (4 entidades, CSV/XLSX) con plantillas. |
| Criterio de aceptación §16.2 | ✅ «PDF reproducible»: el test de integración descarga dos veces y compara byte a byte; el informe congelado no cambia aunque cambien los datos. ✅ «CSV/XLSX con validación previa y errores por fila»: vista previa con errores por columna antes de escribir nada; tests con CSV y XLSX. |
| UX | ✅ Revisada con capturas: informe en pantalla con gráficos, PDF de 4 páginas sin páginas en blanco, vista previa de importación con celdas marcadas. |
| Seguridad | ✅ Permisos `reports:generate`, `data:export` y `data:import` (más el de cada entidad); RLS; inyección CSV/XLSX neutralizada; exportaciones auditadas; salud solo con consentimiento; el archivo importado no se guarda. |
| Tests | ✅ 330 unitarios, 136 de integración y 30 E2E. |
| Documentación | ✅ `REPORTS.md`, `API.md`, `TESTING.md`, `DATABASE.md` y `SECURITY.md`. |
| Datos | ✅ Informe de Iker en la demo. |
| Pendiente conocido | ~~Informe para el cliente en su app. PDF del plan.~~ (hechos tras la Fase 15). Importación de referencias normativas. Trabajos en segundo plano para archivos grandes. |

## Criterios de cierre de la Fase 13

| Criterio | Estado |
|---|---|
| Funcionalidad | ✅ Exportación del interesado, solicitudes de los 6 derechos, bandeja de ADMIN, supresión, retención, 2FA obligatorio para ADMIN, códigos de recuperación, sesiones, contraseñas filtradas y rotación de claves. |
| Criterio de aceptación (§16) | ✅ «Checklist completo»: `ASVS_L2.md`, revisado capítulo a capítulo, con los parciales justificados (la correspondencia requisito a requisito queda [REQUIERE VERIFICACIÓN]). ✅ «Derechos ejercitables desde UI»: el cliente descarga sus datos y presenta solicitudes en `/me/privacidad`; ADMIN las atiende en **Privacidad** y suprime desde la ficha. Cubierto por E2E. |
| UX | ✅ Revisada con capturas: privacidad del cliente en el móvil, bandeja de ADMIN, supresión con doble confirmación (el botón se activa solo con el nombre exacto) y Ajustes. Mejora tras la revisión: «Cerrar las demás sesiones», porque la lista de sesiones puede ser larga. |
| Seguridad | ✅ Pentest ligero (`PENTEST.md`): un hallazgo medio (reutilización de códigos TOTP), corregido. Sin fallos de autorización ni de aislamiento. |
| Tests | ✅ 348 unitarios, 146 de integración y 34 E2E. |
| Documentación | ✅ `SECURITY.md`, `ASVS_L2.md`, `DPIA.md` (plantilla, [REQUIERE VALIDACIÓN LEGAL]), `PENTEST.md`, `API.md`, `DATABASE.md` y `TESTING.md`. |
| Datos | ✅ La demo tiene una solicitud de rectificación pendiente de Elena. Por ser demo, no exige 2FA a ADMIN. |
| Pendiente conocido | Validación legal de la DPIA y de los plazos (D7). Avisos por email (D4). CSP con *nonces*. Límite de peticiones por usuario fuera del login. Análisis de dependencias en CI. |

## Criterios de cierre de la Fase 14

| Criterio | Estado |
|---|---|
| Funcionalidad | ✅ Todos los niveles de la pirámide de §15.1 tienen herramienta, test y umbral en CI. |
| Criterio de aceptación §16.2 «Umbrales de §15» | ✅ Cobertura de líneas en el dominio 94,7 % (≥ 90 %, también por motor). Contrato sin cambios rompientes sin versión. Todas las políticas RLS con test positivo y negativo. Acceso cruzado en el 100 % de las rutas. Flujos críticos en E2E (escritorio y móvil). 0 infracciones graves de accesibilidad. Listados con 1 000 clientes: máximo 147 ms p95. TTI móvil ≈ 1,4–1,6 s. |
| UX | ✅ Accesibilidad: enlaces del calendario de al menos 24 px y sin controles anidados en la página de método. Calendario de un centro grande: 4 sesiones por día en el mes y «+N más». |
| Seguridad | ✅ La matriz RLS encontró tres huecos en la segunda barrera (asignaciones, invitaciones, columnas que el cliente podía cambiar), corregidos en RLS v7. Auditoría de dependencias en CI. |
| Tests | ✅ 379 unitarios, 148 de integración, 560 comprobaciones RLS y 39 E2E. |
| Documentación | ✅ `TESTING.md` (pirámide, áreas obligatorias, rendimiento), `API.md` (contrato), `DATABASE.md`, `SECURITY.md`, `ASVS_L2.md` y `PENTEST.md`. |
| Datos | ✅ Demo ampliada (otra organización para el aislamiento; Elena con todos sus tipos de datos; importación pendiente) y datos de carga (`pnpm db:seed:perf`). |
| Pendiente conocido | Crear un plan desde una plantilla tarda ≈ 0,9 s. CSP con *nonces*. Límite de peticiones por usuario en la API. ~~Las respuestas de la API no tienen esquema formal.~~ (hecho tras la Fase 15: `docs/api/responses.json`). |

## Criterios de cierre de la Fase 15

| Criterio | Estado |
|---|---|
| Funcionalidad | ✅ Rendimiento, caché (decidida: no hace falta), índices, observabilidad y preparación de integraciones (§16.2). Además: multi-entrenador a escala, límites de la API, CSP con *nonce* y operación. |
| Criterio de aceptación §16.2 «p95 objetivos de §2.3 con 1 000 clientes simulados» | ✅ Todos los listados ≤ 135 ms p95 (objetivo < 300 ms) con 10 entrenadores y 1 000 clientes; TTI móvil ≈ 1,5 s (objetivo < 2,5 s). Medido en CI en cada cambio. |
| UX | ✅ «Datos de dispositivos» en Seguimiento; «Carga del equipo» con traspaso en Usuarios. |
| Seguridad | ✅ Cerrados PENTEST P-2 (CSP) y P-3 (límites). Corregido: los datos de dispositivos no estaban ni en la exportación ni en la supresión RGPD. |
| Tests | ✅ 390 unitarios, 155 de integración, 566 comprobaciones RLS y 41 E2E. |
| Documentación | ✅ `OPERATIONS.md`, `INTEGRATIONS.md`; `API.md`, `DATABASE.md`, `SECURITY.md`, `ASVS_L2.md`, `PENTEST.md` y `TESTING.md` actualizados. |
| Datos | ✅ Una semana de mediciones de reloj de Elena; los datos de carga se generan en 42 s. |
| Pendiente conocido | Elegir el proveedor de despliegue (región UE, copias, monitorización) y el de email (D4). Validación legal (D7). ~~Adaptador de almacenamiento de objetos para los archivos. Imagen más pequeña (`standalone`).~~ (hechos, ver abajo). Conexiones con fabricantes cuando haya necesidad. |

## Pendientes técnicos cerrados tras la Fase 15

| Pendiente | Estado |
|---|---|
| Imagen Docker mínima | ✅ `web` ≈ 480 MB (servidor autónomo de Next) e imagen `jobs` para migraciones y trabajos (`OPERATIONS.md`). |
| Almacenamiento de objetos | ✅ Adaptador S3 compatible (SigV4), probado contra un servidor S3 real en CI. |
| Esquema de las respuestas de la API | ✅ `docs/api/responses.json`: forma de cada `GET`; el E2E falla ante un campo eliminado o un tipo cambiado. |
| Informe para el cliente en su app | ✅ El entrenador lo comparte; el cliente lo ve en lenguaje sencillo y lo descarga en PDF. RLS v10. |
| PDF del plan | ✅ Versión del equipo y del cliente; el cliente solo con lo publicado. |
| Siguen abiertos | Proveedor de despliegue y de email (D4), validación legal (D7), importación de referencias normativas, trabajos en segundo plano para archivos grandes, conexiones con fabricantes. |
