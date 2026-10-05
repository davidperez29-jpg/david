# API REST v1

Base: `/api/v1`. JSON. Autenticación por cookie de sesión `tp_session` (httpOnly). Las mutaciones exigen cabecera `Origin` del mismo host (CSRF). Respuestas con `Cache-Control: no-store`.

> La generación automática de OpenAPI desde los esquemas Zod (`packages/contracts`) está prevista; hasta entonces, esta tabla y los esquemas son la referencia.

## Errores

```json
{ "error": { "code": "validation", "message": "Datos no válidos.", "details": { "basics.firstName": ["..."] }, "requestId": "uuid" } }
```

| code | HTTP |
|---|---|
| `unauthenticated` | 401 |
| `forbidden` | 403 |
| `not_found` | 404 (también para recursos de otra organización o fuera de ámbito, y para un identificador mal formado en la ruta, que nunca llega a la base de datos) |
| `conflict` | 409 (bloqueo optimista, duplicados, falta de consentimiento) |
| `validation` | 422 |
| `rate_limited` | 429 |
| `internal` | 500 |

## Endpoints

| Método y ruta | Acceso | Esquema de entrada | Descripción |
|---|---|---|---|
| `POST /auth/login` | público | `loginSchema` | Inicia sesión. Devuelve `{requiresSecondFactor}` y fija la cookie. |
| `POST /auth/2fa/verify` | público (sesión pendiente) | `totpCodeSchema` | Completa el segundo factor. |
| `POST /auth/logout` | público | — | Revoca la sesión actual. |
| `POST /auth/password-reset/request` | público | `passwordResetRequestSchema` | Envía enlace (siempre 200). |
| `POST /auth/password-reset` | público | `passwordResetSchema` | Nueva contraseña con token. |
| `POST /invitations/accept` | público | `acceptInvitationSchema` | Crea la cuenta e inicia sesión. |
| `POST /auth/2fa/enroll` | sesión | — | Devuelve secreto y QR. |
| `POST /auth/2fa/confirm` | sesión | `totpCodeSchema` | Activa 2FA. |
| `POST /auth/password` | sesión | `changePasswordSchema` | Cambia la contraseña, revoca el resto de sesiones. |
| `GET /me` | sesión | — | Actor actual. |
| `POST /invitations` | `users:manage` (staff) · `invitations:create` (cliente) | `createInvitationSchema` | Devuelve `{invitationId, link, expiresAt}`. |
| `GET /users` | `users:read` | — | Usuarios e invitaciones pendientes. |
| `POST /users/{id}/status` | `users:manage` | `{active: boolean}` | Activa/desactiva (revoca sesiones). |
| `GET /trainers` | `clients:read` | — | Entrenadores activos. |
| `GET /catalog` | `catalog:read` | — | Objetivos, deportes y material. |
| `GET /programming-profiles` | `clients:read` | — | Perfiles de programación (globales y propios) con sus 3 niveles, objetivo y batería sugeridos (reestructuración, fase 1). |
| `GET /clients` | `clients:read` | `listClientsSchema` (query: `q`, `status`, `limit`, `offset`) | Listado paginado según ámbito; incluye perfil y nivel. |
| `POST /clients` | `clients:create` | `createClientSchema` | Alta completa transaccional. `basics` admite `programmingProfileId`, `programmingLevel` (1–3) y `sportId` (globales o de la organización). |
| `GET /clients/{id}` | `clients:read` | — | Ficha (sin datos de salud; incluye `referral`). |
| `PATCH /clients/{id}` | `clients:write` | `updateClientSchema` (`expectedVersion` obligatorio) | Incluye perfil, nivel y deporte. Cliente: solo `email`, `phone`, `preferences`. |
| `POST /clients/{id}/archive` | `clients:archive` | `{archived, reason?}` | Archivar o restaurar. |
| `PUT /clients/{id}/profile` | `clients:write` (staff) | `trainingProfileSchema` | Perfil de entrenamiento. |
| `PUT /clients/{id}/goals` | `goals:write` (staff) | `setGoalsSchema` | Reemplaza objetivos activos (los anteriores pasan a historial). |
| `PUT /clients/{id}/availability` | `clients:write` (incl. cliente) | `setAvailabilitySchema` | Disponibilidad semanal. |
| `PUT /clients/{id}/equipment` | `clients:write` (staff) | `setEquipmentSchema` | Material. |
| `POST /clients/{id}/history` · `DELETE …/history/{entryId}` | `clients:write` (staff) | `historyEntrySchema` | Historial deportivo y de entrenamiento. |
| `GET /clients/{id}/health` | `health:read` (auditado) | — | Declaraciones, cribados y estado de derivación. |
| `POST /clients/{id}/health` | `health:write` (staff) + consentimiento | `healthDeclarationSchema` | Nueva declaración. |
| `POST /clients/{id}/health/{declId}/clear` | `health:write` (staff) | `clearHealthDeclarationSchema` | Registra la valoración de un profesional. |
| `POST /clients/{id}/screenings` | `health:write` (staff) + consentimiento | `screeningSchema` | Resultado de cribado externo. |
| `GET /clients/{id}/consents` | `consents:read` | — | Estado y registro. |
| `POST /clients/{id}/consents` | `consents:write` | `consentGrantSchema` | Cliente: `in_app`; staff: `paper` / `verbal_recorded`. |
| `DELETE /clients/{id}/consents/{purpose}` | `consents:write` | — | Revocación. |
| `POST /clients/{id}/assignments` · `DELETE …/{assignmentId}` | `clients:assign` (ADMIN) | `assignTrainerSchema` | Asignaciones (mínimo una activa). |
| `GET /clients/{id}/audit` | `audit:read` | — | Historial de cambios del cliente. |

## Biblioteca de ejercicios (Fase 3)

| Método y ruta | Permiso | Entrada | Descripción |
|---|---|---|---|
| `GET /library/taxonomies` | `library:read` | — | Patrones, músculos, categorías, etiquetas, material, perfiles de prescripción. |
| `GET /exercises` | `library:read` | `listExercisesSchema` (query: `q`, `patternId`, `categoryId`, `muscleGroup`, `level`, `region`, `laterality`, `contraction`, `equipmentIds` CSV, `status`, `needsReview`, `video`, `scope`, `limit`, `offset`) | Búsqueda sin tildes, tolerante a errores. |
| `POST /exercises` | `library:write` | `createExerciseSchema` | Crea un borrador. |
| `GET /exercises/{id}` | `library:read` | — | Ficha completa, `publishProblems`, relaciones, media (`embedUrl`, `notice`). |
| `PATCH /exercises/{id}` | `library:write` | `updateExerciseSchema` (`expectedVersion` obligatorio) | Solo ejercicios propios; las relaciones enviadas se reemplazan. |
| `POST /exercises/{id}/status` | `library:publish` / `library:write` | `{status}` | Publicar exige los requisitos de `EXERCISE_LIBRARY.md` §2.1. |
| `POST /exercises/{id}/review` | `library:write` | `{notes?}` | Marca como revisado un ejercicio importado. |
| `POST /exercises/{id}/fork` | `library:write` | — | Copia un ejercicio global a la organización. |
| `POST /exercises/{id}/duplicate` | `library:write` | — | Nuevo borrador «(copia)». |
| `POST /exercises/{id}/videos` | `library:write` | `addVideoSchema` | YouTube o Vimeo; queda pendiente de verificación. |
| `POST /exercises/{id}/media/{mediaId}/verify` | `library:write` | `{status: verified \| broken}` | Verificación humana. |
| `DELETE /exercises/{id}/media/{mediaId}` | `library:write` | — | |
| `POST /exercises/{id}/silhouette` | `library:write` | `multipart/form-data` (`file`) | PNG/JPEG/WebP ≤ 2 MB, tipo detectado por contenido. |
| `GET /exercises/{id}/substitutes` | `library:read` | `substitutesQuerySchema` (`reason`, `clientId?`, `location?`, `limit`) | Sugerencias con motivos y número de excluidos. |
| `POST /exercise-progressions` · `DELETE /exercise-progressions/{id}` | `library:write` | `progressionSchema` | Rechaza contradicciones (ciclos). |
| `GET /files/{id}` | `library:read` | — | Archivo autorizado (siluetas). |
| `GET/POST /clients/{id}/tolerances` · `DELETE …/{toleranceId}` | `health:read` / `health:write` (staff) + consentimiento | `toleranceSchema` | Ejercicios o patrones tolerados / no tolerados. |

## Biblioteca científica (Fase 4)

Detalle del modelo y de las reglas en `SCIENTIFIC_FRAMEWORK.md`. El contenido global es de solo lectura; el de otra organización devuelve 404.

| Método y ruta | Permiso | Entrada | Descripción |
|---|---|---|---|
| `GET /science/taxonomies` | `science:read` | — | Poblaciones y desenlaces. |
| `GET /science/sources` | `science:read` | `listScienceSchema` (`q` título/revista/DOI/PMID, `design`, `status`, `limit`, `offset`) | Fuentes con número de hallazgos. |
| `POST /science/sources` | `science:write` | `sourceSchema` | Se crea **sin verificar**. DOI/PMID únicos por organización. |
| `GET /science/sources/{id}` | `science:read` | — | Fuente, hallazgos (nivel, explicación de la gradación), revisiones y QA. |
| `PATCH /science/sources/{id}` | `science:write` | `updateSourceSchema` (`expectedVersion`) | Cambiar título, autores, año, revista, DOI o PMID anula la verificación. |
| `POST /science/sources/{id}/verify` | `science:publish` | `verifySourceSchema` (`status`, `access`, `verificationMethod`, `corrections?`) | Exige DOI, PMID o URL. Recalcula niveles. |
| `POST /science/sources/{id}/findings` | `science:write` | `findingSchema` (cita literal y `grading` obligatorios) | Devuelve `{id, level}`; el nivel se calcula. |
| `GET /science/findings` | `science:read` | `listScienceSchema` (`q`, `level`) | Selector de hallazgos. |
| `DELETE /science/findings/{id}` | `science:write` | — | Recalcula las afirmaciones afectadas. |
| `GET /science/claims` | `science:read` | `listScienceSchema` (`q`, `level`, `status`) | |
| `POST /science/claims` | `science:write` | `claimSchema` | Nace en borrador; nivel calculado. |
| `GET /science/claims/{id}` | `science:read` | — | Evidencia (cita, DOI/PMID, verificación), QA, revisiones y uso en métodos. |
| `PATCH /science/claims/{id}` | `science:write` | `updateClaimSchema` (`expectedVersion`) | Si estaba publicada, vuelve a borrador. |
| `POST /science/claims/{id}/status` | `science:publish` (revisar y publicar) / `science:write` | `{status}` | Publicar exige QA sin errores (`details.qa`). |
| `POST /science/reviews` | `science:publish` | `evidenceReviewSchema` | Aprobar exige la lista de control completa. |
| `GET /science/methods` | `science:read` | — | Métodos con número de afirmaciones y ejercicios. |
| `POST /science/methods` | `science:write` | `methodSchema` | Notas, variables de dosis y hallazgos. |
| `GET /science/methods/{id}` | `science:read` | — | Trazabilidad completa: variables y notas → afirmaciones → hallazgos → fuentes. |
| `PATCH /science/methods/{id}` | `science:write` | `updateMethodSchema` (`expectedVersion`) | Las listas enviadas se reemplazan. |
| `POST /science/methods/{id}/status` | `science:publish` (publicar) / `science:write` | `{status}` | Publicar exige definición y todas las variables justificadas (`details.publish`). |
| `GET /science/qa` | `science:read` | — | Totales, afirmaciones por nivel, errores y avisos con enlace. |
| `PUT /exercises/{id}/methods` | `library:write` | `{methodIds}` | Enlaza un ejercicio propio con métodos (propios o globales). |

## Evaluación (Fase 5)

Detalle de reglas en `ASSESSMENT.md`. Una evaluación de un cliente fuera de alcance devuelve 404.

| Método y ruta | Permiso | Entrada | Descripción |
|---|---|---|---|
| `GET /assessment-tests` | `assessments:read` | query `q`, `category` | Catálogo, con número de filas de fiabilidad y de referencia. |
| `POST /assessment-tests` | `assessments:catalog` | `testSchema` | Test propio de la organización. |
| `GET /assessment-tests/{id}` | `assessments:read` | — | Ficha, fiabilidad, referencias, fuentes y fórmulas derivadas. |
| `PATCH /assessment-tests/{id}` | `assessments:catalog` | `updateTestSchema` (`expectedVersion`) | Solo tests propios; cambiar el protocolo crea una versión nueva. |
| `POST /assessment-tests/{id}/reliability` | `assessments:catalog` | `localReliabilitySchema` (SEM, CV o MDC95 obligatorio) | Test-retest del centro. |
| `DELETE /assessment-reliability/{id}` | `assessments:catalog` | — | Solo fiabilidad local. |
| `GET /assessment-batteries` · `POST` | `assessments:read` / `assessments:catalog` | `batterySchema` | Baterías globales y propias. |
| `GET /clients/{id}/assessments` · `POST` | `assessments:read` / `assessments:write` | `createAssessmentSchema` (`assessedOn`, `batteryId?`, `testIds`) | Si se indica una batería y no se pasan tests, se usan los de la batería. |
| `GET /clients/{id}/assessments/proposal` | `assessments:write` | — | Batería propuesta, tests excluidos con su motivo y explicación. |
| `GET /clients/{id}/assessments/progress` | `assessments:read` | — | Series por test y lado, cambio frente al error, tendencia, referencias y métricas derivadas. |
| `GET /assessments/{id}` | `assessments:read` | — | Tests, resultados con cambio y referencias, métricas derivadas y banderas. |
| `POST /assessments/{id}/results` | `assessments:write` | `recordResultSchema` (`testId`, `side`, `attempts`, `measurementMethod?`, `valid`) | Crea o reemplaza el resultado del test y lado; recalcula las métricas derivadas. |
| `DELETE /assessment-results/{id}` | `assessments:write` | — | |
| `POST /assessments/{id}/status` | `assessments:write` | `{status}` | Planificada, en curso, completada o cancelada. |

## Planificación (Fase 6)

Detalle en `PLANNING.md`. Lo que queda fuera de ámbito devuelve 404. Las ediciones de prescripción validan rangos, tempo, RIR o RPE (no ambos) y VBT.

| Método y ruta | Permiso | Entrada | Descripción |
|---|---|---|---|
| `GET /plan-templates` | `plans:templates` | `templateQuerySchema` en la consulta: `q`, `profile`, `level` 1–3, `days`, `population`, `kind`, `scope` (`all`/`global`/`mine`), `archived`, `client`, `fitsEquipment` | Biblioteca filtrada (solo metadatos). Con `client`, ordenada por encaje (`fit`) y con el material que le falta (`missingEquipment`). Reestructuración, fase 3. |
| `GET /plan-templates/{id}` | `plans:templates` | — | Estructura, sesiones de la semana (y de cada fase), métodos, material, `definition` con ids de edición y `versions`. |
| `POST /plan-templates` | `plans:templates` | `createTemplateSchema` (`name`, `sessionsPerWeek`, `durationMonths?`, `profileSlug?`, `levelN?`, `population?`, `kind?`) | «Crear desde cero»: sesiones vacías de una semana. Versión 1. |
| `PATCH /plan-templates/{id}` | `plans:templates` (solo las del centro) | `updateTemplateSchema` (`expectedVersion` y cualquiera de: datos, `definition` completa, `note`) | Cada cambio de nombre o contenido es una versión (agrupadas mientras ningún plan la use). 409 si otra persona la guardó; 403 en las de la plataforma. Cuerpo hasta 1 MB. |
| `POST /plan-templates/{id}/duplicate` | `plans:templates` | `{name?}` | Copia independiente en «Mis plantillas» (también de una de la plataforma). |
| `POST /plan-templates/{id}/archive` | `plans:templates` (solo las del centro) | `{archived}` | Archivar o recuperar; los planes siguen apuntando a ella. |
| `POST /plan-templates/{id}/restore` | `plans:templates` (solo las del centro) | `{version, expectedVersion}` | Trae el contenido de una versión anterior como versión nueva. |
| `GET /clients/{id}/plans` · `POST` | `plans:read` / `plans:write` | `createPlanSchema` (`name`, `durationMonths` 3/6/9/12, `weeks?`, `mesocycleWeeks`, `startDate?`, `weekdays`) | Plan en blanco con su esqueleto y fechas. |
| `POST /clients/{id}/plans/from-template` | `plans:write` + `plans:templates` | `planFromTemplateSchema` (`templateId`, `startDate`, `weekdays` = sesiones de la plantilla, `name?`, `durationMonths?` 3/6/9/12) | Plan independiente con la duración elegida; guarda la plantilla y su versión. Devuelve `{id, weeks, conflicts}`. |
| `GET /plans/{id}` · `PATCH` | `plans:read` / `plans:write` | `updatePlanSchema` | Árbol completo con indicadores semanales. |
| `POST /plans/{id}/status` | `plans:write` | `{status, reason?}` | Activar exige fecha de inicio y que no haya otro plan activo; crea una revisión. |
| `GET /plans/{id}/revisions` · `POST` | `plans:read` / `plans:write` | `{reason}` | Instantánea con su diferencia. |
| `POST /plans/{id}/duplicate` | `plans:write` | `{name, clientId?}` | Copia profunda en borrador. |
| `GET /plans/{id}/pdf?version=staff\|client` | `plans:read` (personal) · `sessions:read` (el propio cliente: plan activo o completado, sesiones publicadas, siempre su versión) | — | PDF del plan completo. Auditado como `export`; operación pesada. |
| `POST /plans/{id}/template` | `plans:templates` | `{name, description?}` | Plantilla anonimizada de la organización. |
| `PATCH /microcycles/{id}` · `POST /microcycles/{id}/duplicate` | `plans:write` | `{weekType}` · `{targetMicrocycleId}` | Tipo de semana · copiar semana (reemplaza). |
| `GET /plan-sessions/{id}` · `PATCH` | `plans:read` / `plans:write` | `updateSessionSchema` | Sesión con bloques, ejercicios, texto para el cliente y validación. |
| `POST /plan-sessions/{id}/blocks` · `POST /plan-sessions/{id}/duplicate` | `plans:write` | `blockSchema` · `{targetMicrocycleId}` | |
| `PATCH/DELETE /session-blocks/{id}` · `POST …/move` · `POST …/exercises` | `plans:write` | `updateBlockSchema` · `{direction}` · `sessionExerciseSchema` | |
| `PATCH/DELETE /session-exercises/{id}` · `POST …/move` | `plans:write` | `updateSessionExerciseSchema` (`expectedVersion`, `overrideReason?`) | Un override de plantilla o progresión se audita con su motivo. |
| `POST /plan-sessions/{id}/exercises` | `plans:write` | `addSessionExercisesSchema` (`blockId?`, `rows[]` de 1 a 200: `exerciseId`, `prescription`, `notesForClient?`) | Filas de la tabla de sesión (pegadas de Excel o escritas) en una transacción: si una fila no es válida no se añade ninguna y el error indica fila y campo (`rows.3.sets`). Sin `blockId`, al último bloque (crea uno principal si no hay). Reestructuración, fase 2. |
| `POST /session-exercises/duplicate` · `POST /session-exercises/delete` | `plans:write` | `{ids}` (1–100) | Duplica cada fila justo debajo (copia completa) · quita varias filas a la vez (todas o ninguna). |
| `POST /exercises/resolve` | `library:read` | `{names}` (1–200) | Reconoce nombres de ejercicio escritos o pegados: coincidencia exacta (sin mayúsculas, tildes ni signos) o el claramente más parecido; si hay duda, candidatos. Solo ejercicios globales y de la organización. |
| `GET /clients/{id}/program?plan&week&session` | `plans:read` | `programViewSchema` | Pestaña Programa: plan (por defecto el activo), meses, semanas con su estado, sesiones de la semana y sesión elegida (por defecto, la próxima por hacer). |

## Sesiones (Fase 7)

Detalle en `SESSIONS.md`. Para el cliente, una sesión no publicada no existe (404). Las mutaciones de registro son idempotentes por `clientMutationId` (8–100 caracteres `[A-Za-z0-9_-]`).

| Método y ruta | Permiso | Entrada | Descripción |
|---|---|---|---|
| `POST /sessions/publish` | `sessions:publish` | `{scope: session\|week\|plan, id, published}` | Solo en planes activos. Devuelve `{count}`. |
| `GET /clients/{id}/agenda?from&to` | `sessions:read` | — | `{today, next, sessions}`; el cliente solo recibe sesiones publicadas. |
| `GET /sessions/{id}` | `sessions:read` | — | Datos del reproductor: texto para el cliente, indicaciones, vídeo verificado, última vez, precarga, alternativas, registros, sustituciones, asistencia, valoración y `downloadedAt`. |
| `POST /set-logs` · `DELETE /set-logs/{id}` | `sessions:log` | `setLogSchema` | Devuelve `{id, status: applied\|duplicate\|flagged, reviewReason}`. El cliente no puede borrar en una sesión cerrada. |
| `POST /substitutions` | `sessions:log` | `{clientMutationId, sessionExerciseId, reason, chosenExerciseId?, comment?}` | `approved` si es una alternativa preaprobada (o lo decide el personal); si no, `pending` y se avisa al entrenador. |
| `POST /sessions/{id}/complete` | `sessions:log` | `completeSessionSchema` | Asistencia (calculada si se omite; con motivo si es parcial), sRPE, fatiga, motivación, comentario y dolor (solo con consentimiento). |
| `POST /sync` | `sessions:log` | `{mutations: [{type: set\|substitution\|complete, clientMutationId, …}]}` (≤ 500) | Reproduce la cola del dispositivo en orden, una mutación por *savepoint*. Devuelve un resultado por mutación (`applied`, `duplicate`, `flagged`, `approved`, `pending` o `rejected`). |
| `GET /clients/{id}/readiness?on=` · `PUT` | `sessions:read` / `sessions:log` | `readinessSchema` | Bienestar diario (uno por día). |
| `GET /clients/{id}/session-review` | `sessions:review` | — | Sesiones registradas o pendientes, con contadores de revisión. |
| `GET /review-inbox` | `sessions:review` | — | Sesiones de hoy, sustituciones pendientes y registros marcados de los clientes accesibles. |
| `POST /substitutions/{id}/decision` | `sessions:review` | `{approve, chosenExerciseId?, addAsAlternative?, comment?}` | Auditado. |
| `POST /set-logs/{id}/resolve` | `sessions:review` | `{note?}` | Marca un registro como revisado (auditado). |

`PATCH /session-exercises/{id}` acepta además `alternativeExerciseIds` (hasta 5, visibles para la organización y distintos del ejercicio).

## Seguimiento (Fase 8)

Detalle en `MONITORING.md`. Las alertas nunca son visibles para el cliente.

| Método y ruta | Permiso | Entrada | Descripción |
|---|---|---|---|
| `GET /clients/{id}/monitoring` | `monitoring:read` | — | Adherencia de 28 y 84 días, semanas (carga, monotonía, tensión, adherencia), últimas sesiones, bienestar y, solo para el personal, alertas vivas y reglas desactivadas. |
| `GET /alerts?status=live\|open\|seen\|resolved&severity=&clientId=&limit=` | `alerts:manage` | — | Ordenadas por gravedad y fecha. |
| `POST /alerts/{id}/status` | `alerts:manage` | `{status: seen\|resolved, note?}` | Auditado. |
| `POST /clients/{id}/alerts/refresh` | `alerts:manage` | — | Recalcula tras confirmar. |
| `PUT /clients/{id}/rule-overrides` | `alerts:manage` | `{ruleKey, enabled, reason?}` | Desactiva o reactiva una regla para el cliente (auditado). |
| `GET /monitoring/rules` · `PUT` | `monitoring:read` / `monitoring:rules` | `{rules: [{key, enabled, parameters}], notes?}` | El `PUT` crea una nueva versión de reglas; valida los rangos y la coherencia (rojo ≤ amarillo). |
| `GET /monitoring/overview` | `alerts:manage` | — | Adherencia de 28 días y recuento de alertas por color de los clientes accesibles. |
| `POST /exercise-feedback` | `sessions:log` | `{sessionExerciseId, difficulty?, pain?, comment?}` | También en `/sync` como `type: exercise_feedback`. |

`PATCH /plan-sessions/{id}` acepta `targetSessionRpe` (0–10).

## Dashboards y calendario (Fase 9)

Detalle en `DASHBOARD.md`.

| Método y ruta | Permiso | Entrada | Descripción |
|---|---|---|---|
| `GET /calendar?from&to&clientId&trainerId&perDay` | `sessions:read` (solo personal) | Rango de 9 semanas como máximo; `perDay` 1–200 (opcional) | Sesiones, evaluaciones y, con `clientId`, fases y semanas de descarga (`spans`). `trainerId` es el filtro de ADMIN. Con `perDay`, como mucho ese número de sesiones por día; `sessionTotals` da siempre el total de cada día (Fase 14). |
| `GET /dashboard/trainer` | `sessions:review` | — | Clientes activos, evaluaciones pendientes o vencidas y feedback reciente. |
| `GET /dashboard/home` | `clients:read` + `alerts:manage` + `sessions:review` | `listClientsSchema` (query) | Inicio del entrenador: «Mis clientes» (perfil y nivel, próxima sesión, adherencia de 4 semanas, estado `ok`/`look`/`review` y sus motivos) y «Entrenamientos de hoy». |
| `GET /clients/{id}/summary` | `monitoring:read` (personal) | — | Plan activo con fase y semana, próxima sesión, adherencia, alertas y métricas clave. |
| `GET /clients/{id}/dashboard` | `sessions:read` | — | Próxima sesión con vista previa, racha, adherencia, hitos, próxima evaluación y tests visibles. |
| `PUT /clients/{id}/progress-metrics` | `assessments:write` | `{testIds}` (hasta 5) | Tests visibles en el Progreso del cliente (auditado). |

`GET /clients/{id}/agenda` incluye además `assessments`.

## Motor de decisiones (Fase 10)

Detalle en `DECISION_ENGINE.md`. Solo personal: ADMIN de la organización o entrenador asignado. El cliente no ve las propuestas internas.

| Método y ruta | Permiso | Entrada | Descripción |
|---|---|---|---|
| `POST /clients/{id}/decision/run` | `decision:run` | — | Ejecuta el motor (determinista), guarda la ejecución y las propuestas con su evidencia y sustituye las pendientes. Devuelve `{runId, result}`. |
| `GET /clients/{id}/decision` | `decision:read` | — | Última ejecución, sus propuestas con estado y explicación, rasgos manuales y reglas desactivadas para el cliente. |
| `GET /clients/{id}/decision/context` | `decision:read` | — | Los datos que usaría el motor ahora (incluida la lista de datos que faltan). |
| `POST /recommendations/{id}/decision` | `decision:decide` | `{action: accept\|accept_with_changes\|reject\|postpone, changes?, reason?}` | Decide una propuesta pendiente o pospuesta. Con `accept_with_changes`, `changes` es obligatorio y cada campo se guarda en `manual_overrides`. `409` si ya está decidida. |
| `PUT /clients/{id}/trait-flags` | `decision:decide` | `{trait, value: boolean\|null, note?}` | Valoración manual de un rasgo (`null` la quita). Auditado. |
| `GET /decision/rules` | `decision:read` | — | Reglas vigentes con parámetros, pendientes, condición y métricas por regla. |
| `PUT /decision/rules` | `decision:rules` (ADMIN) | `{rules: [{key, enabled, parameters: {name: number\|null}}], notes?}` | Nueva versión de las reglas (`422` con errores por `regla.parámetro`). |

`PUT /clients/{id}/rule-overrides` (Fase 8) acepta también claves de reglas de decisión.

## Motor de programación (Fase 11)

Detalle en `PROGRAMMING_ENGINE.md`. Solo personal (ADMIN de la organización o entrenador asignado). Ningún endpoint cambia el plan activo salvo al **aceptar** un ajuste.

| Método y ruta | Permiso | Entrada | Descripción |
|---|---|---|---|
| `GET /clients/{id}/plan-proposals` | `plans:read` + `decision:read` | — | Propuestas de plan (`PROPOSAL`) con sus notas de generación. |
| `POST /clients/{id}/plan-proposals` | `plans:write` + `decision:run` | `{startDate, weekdays, templateId?}` | Genera una propuesta desde la última ejecución del motor de decisiones (la ejecuta si no hay). `409` con cribado positivo; `422` si los días no coinciden con la plantilla. |
| `POST /plans/{id}/proposal/accept` | `plans:write` | `{name?, reason?}` | La propuesta pasa a `CLIENT_PLAN` en borrador. `409` si ya se decidió. |
| `POST /plans/{id}/proposal/discard` | `plans:write` | `{reason?}` | La propuesta queda archivada. |
| `GET /clients/{id}/adjustments` | `plans:read` + `decision:read` | — | Ajustes pendientes y decididos (con cambios previstos o aplicados) y la opción de aplicación automática. |
| `POST /clients/{id}/adjustments/refresh` | `plans:write` | — | Recalcula ahora los ajustes. |
| `POST /adjustments/{id}/decision` | `plans:write` + `decision:decide` | `{action: accept\|accept_with_changes\|reject\|postpone, params?: {toKg?, setsDelta?, rirDelta?, toExerciseId?}, reason?}` | Al aceptar, aplica a sesiones futuras sin registrar, con revisión del plan y auditoría. `409` si ya está decidida o si nada es aplicable. |
| `POST /clients/{id}/adjustments/accept` | `plans:write` + `decision:decide` | `{ids, reason?}` | Aceptar en bloque; devuelve `{applied, failed}`. |
| `POST /adjustments/{id}/revert` | `plans:write` + `decision:decide` | `{reason?}` | Deshace un ajuste aplicado (`reverted`). |
| `PUT /clients/{id}/auto-apply` | `plans:write` + `decision:decide` | `{enabled}` | Aplicar las progresiones de carga rutinarias sin confirmación (desactivado por defecto; auditado). |

`POST /plans/{id}/status` responde `409` para una propuesta.

## Informes, exportación e importación (Fase 12)

Detalle en `REPORTS.md`. Las respuestas de descarga son archivos (`Content-Disposition: attachment`, `Cache-Control: no-store`).

| Método y ruta | Permiso | Entrada | Descripción |
|---|---|---|---|
| `GET /clients/{id}/reports` | `reports:generate` | — | Informes generados del cliente. |
| `POST /clients/{id}/reports` | `reports:generate` | `{from, to, trainerNotes?}` | Congela la instantánea del periodo (11 apartados) y devuelve `{id, hash}`. |
| `GET /reports/{id}` | `reports:generate` | — | El informe reconstruido desde la instantánea, con `intact` (comprobación del hash). |
| `GET /reports/{id}/download?format=pdf\|xlsx\|csv` | `reports:generate` | — | Archivo; auditado como `export`. El PDF es reproducible byte a byte. |
| `PUT /reports/{id}/share` | `reports:generate` | `{shared}` | Comparte el informe con la app del cliente o deja de compartirlo. Auditado. |
| `GET /clients/{id}/shared-reports` | `reports:read_shared` | — | Informes compartidos con el cliente: `[{id, from, to, sharedAt}]`. |
| `GET /reports/{id}/client-view` | `reports:read_shared` | — | Versión del cliente en lenguaje sencillo (7 apartados). Un cliente solo accede a los suyos compartidos; si no, 404. |
| `GET /reports/{id}/client-view/download` | `reports:read_shared` | — | PDF de la versión del cliente; auditado como `export`. Operación pesada (límite por minuto). |
| `GET /exports?entity&format[&clientId&planId&from&to]` | `data:export` | `entity`: `clients`, `assessments`, `plan`, `sessions` o `progress`; `format`: `csv` o `xlsx` | Exportación bajo RLS, auditada. |
| `POST /imports` | `data:import` (+ el de la entidad) | `{entity, fileName, contentBase64}` | Valida el archivo y crea la vista previa: `{id, total, valid, invalid}`. No escribe datos. |
| `GET /imports` · `GET /imports/{id}` | `data:import` | — | Historial; filas con estado, datos y errores por columna. |
| `POST /imports/{id}/confirm` | `data:import` | — | Importa las filas válidas: `{imported, failed}`. `409` si ya se confirmó o se canceló. |
| `POST /imports/{id}/cancel` | `data:import` | — | Cancela sin importar. |
| `GET /imports/templates/{entity}?format=csv\|xlsx` | `data:import` | — | Plantilla con ejemplo (y hoja de ayuda en XLSX). |

## Seguridad y RGPD (Fase 13)

Detalle en `SECURITY.md` §2.2–2.3. Si la organización exige 2FA a ADMIN (`requireAdmin2fa`, activo por defecto), un ADMIN sin 2FA recibe `403` en toda la API salvo `/auth/*`.

| Método y ruta | Permiso | Entrada | Descripción |
|---|---|---|---|
| `GET /clients/{id}/subject-data` | `privacy:export_subject` (ADMIN: organización; cliente: el suyo) | — | JSON con todos los datos del interesado, descifrados, y su registro de actividad. Auditado como `export`; si lo descarga el propio cliente, queda como solicitud de portabilidad atendida. |
| `GET /clients/{id}/privacy-requests` | `privacy:request` | — | Solicitudes del cliente. |
| `POST /clients/{id}/privacy-requests` | `privacy:request` | `{type, details?}`; `type`: `access`, `portability`, `rectification`, `erasure`, `restriction` u `objection` | Crea la solicitud con plazo de un mes (`dueOn`). `409` si ya hay una pendiente del mismo tipo. |
| `POST /privacy-requests/{id}/cancel` | `privacy:request` | — | Cancela una solicitud pendiente. |
| `GET /privacy-requests` | `privacy:manage` | — | Bandeja de ADMIN: pendientes primero, por plazo, con `overdue`. |
| `POST /privacy-requests/{id}/resolve` | `privacy:manage` | `{status: completed\|rejected, response}` | Responde al interesado. Una supresión solo se puede marcar como atendida si el cliente ya está anonimizado (`409`). |
| `POST /clients/{id}/erase` | `privacy:erase_subject` (solo ADMIN) | `{confirmation, reason}` | Supresión irreversible (anonimización). `confirmation` debe ser el nombre completo del cliente (sin distinguir mayúsculas); si no, `422`. |
| `GET /privacy/settings` · `PUT /privacy/settings` | `privacy:manage` | `{retentionMonths: 1–240 \| null, requireAdmin2fa}` | Plazo de conservación de clientes archivados y 2FA obligatorio para ADMIN. |
| `POST /auth/2fa/confirm` | sesión | `{code}` | Activa el 2FA y devuelve `{recoveryCodes}` (10, se muestran una sola vez). |
| `POST /auth/2fa/recovery-codes` | sesión | `{code}` (TOTP) | Regenera los códigos de recuperación; los anteriores dejan de valer. |
| `POST /auth/2fa/verify` | pública (sesión pendiente del 2FA) | `{code}`: TOTP de 6 dígitos o código de recuperación `XXXX-XXXX` | Cada código TOTP vale **una sola vez**; cada código de recuperación, también. |
| `DELETE /auth/sessions/{id}` | sesión | — | Cierra una de las sesiones propias. |

## Contrato de la API (Fase 14)

- **Archivo**: `docs/api/contract.json` es el contrato de `/api/v1`. Contiene cada ruta con su método y acceso, y el JSON Schema de entrada de cada petición, generado desde los esquemas zod.
- **Test**: `apps/web/test/contract.unit.test.ts` falla ante cualquier diferencia.
- **Cambio compatible** (ruta nueva, campo opcional nuevo, límite más amplio, valor de enumeración añadido): se acepta con `pnpm contract:update`.
- **Cambio rompiente** (ruta o campo eliminado, campo nuevo obligatorio, límite más estricto, valor eliminado, ruta que deja de ser pública): necesita una versión nueva de la API, o `pnpm contract:update --breaking` con su entrada en el CHANGELOG.
- **Respuestas**: `docs/api/responses.json` guarda la **forma** (claves y tipos, no valores) de la respuesta de cada `GET` autenticado (65 rutas; los archivos se registran por su tipo, p. ej. `file:application/pdf`).
  - **Test**: `apps/web/e2e/contract-responses.spec.ts` llama a cada ruta como la ADMIN demo, con ids reales, y falla si un campo desaparece o cambia de tipo.
  - **No rompen**: un campo nuevo, un `null` o una lista vacía (dependen de los datos). Los mapas libres (`changes`, `payload`, `params`, `data`…) solo prometen ser un objeto.
  - **Aceptar campos nuevos**: `pnpm contract:responses` (necesita la *build* y los datos demo). Un cambio rompiente necesita una versión nueva de la API o una entrada en el CHANGELOG antes de regenerar.
  - **Límite**: solo cubre `GET`; las respuestas de las mutaciones se comprueban en los tests de integración y E2E.

## Optimización y escala (Fase 15)

- **Límite de peticiones por usuario**: 1 000 lecturas, 120 escrituras y 30 operaciones pesadas por minuto.
  - Son pesadas: exportaciones, descargas de informes, datos del interesado, importaciones y generación de informes.
  - Al superarlo: `429` con `Retry-After` en segundos.
  - Configurable con `API_LIMIT_*`.
- **Tamaño del cuerpo**: 256 KB por defecto. Más en las rutas que reciben archivos: 3 MB en `POST /imports`, 1,1 MB en `POST /clients/{id}/external-measurements`. Si se supera: `422 «Petición demasiado grande.»`.
- **Cabecera `X-Request-Id`** en cada respuesta, para cruzarla con los logs.

| Método y ruta | Permiso | Descripción |
|---|---|---|
| `GET /api/health` | Pública (fuera de `/v1`) | *Liveness*: `{status, version}` |
| `GET /api/ready` | Pública (fuera de `/v1`) | *Readiness*: base de datos y migraciones; `503` si no responde |
| `POST /clients/{id}/external-measurements` | `integrations:import` | Importa mediciones de dispositivos (`INTEGRATIONS.md`) |
| `GET /clients/{id}/external-measurements` | `clients:read` (+ `health:read` para tipos de salud) | Mediciones |
| `GET /trainers/workload` | `clients:assign` (ADMIN) | Por entrenador: clientes, principal de, planes activos, alertas abiertas |
| `POST /trainers/transfer` | `clients:assign` (ADMIN) | `{fromTrainerId, toTrainerId, clientIds?}` → `{moved, alreadyAssigned}`. Auditado por cliente |
