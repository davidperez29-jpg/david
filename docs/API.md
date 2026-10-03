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
| `not_found` | 404 (también para recursos de otra organización o fuera de ámbito) |
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
| `GET /clients` | `clients:read` | `listClientsSchema` (query: `q`, `status`, `limit`, `offset`) | Listado paginado según ámbito. |
| `POST /clients` | `clients:create` | `createClientSchema` | Alta completa transaccional. |
| `GET /clients/{id}` | `clients:read` | — | Ficha (sin datos de salud; incluye `referral`). |
| `PATCH /clients/{id}` | `clients:write` | `updateClientSchema` (`expectedVersion` obligatorio) | Cliente: solo `email`, `phone`, `preferences`. |
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
| `GET /plan-templates` · `GET /plan-templates/{id}` | `plans:templates` | — | Catálogo y vista previa (estructura, sesiones, métodos). |
| `GET /clients/{id}/plans` · `POST` | `plans:read` / `plans:write` | `createPlanSchema` (`name`, `durationMonths` 3/6/9/12, `weeks?`, `mesocycleWeeks`, `startDate?`, `weekdays`) | Plan en blanco con su esqueleto y fechas. |
| `POST /clients/{id}/plans/from-template` | `plans:write` + `plans:templates` | `planFromTemplateSchema` (`templateId`, `startDate`, `weekdays` = sesiones de la plantilla, `name?`) | Devuelve `{id, weeks, conflicts}`. |
| `GET /plans/{id}` · `PATCH` | `plans:read` / `plans:write` | `updatePlanSchema` | Árbol completo con indicadores semanales. |
| `POST /plans/{id}/status` | `plans:write` | `{status, reason?}` | Activar exige fecha de inicio y que no haya otro plan activo; crea una revisión. |
| `GET /plans/{id}/revisions` · `POST` | `plans:read` / `plans:write` | `{reason}` | Instantánea con su diferencia. |
| `POST /plans/{id}/duplicate` | `plans:write` | `{name, clientId?}` | Copia profunda en borrador. |
| `POST /plans/{id}/template` | `plans:templates` | `{name, description?}` | Plantilla anonimizada de la organización. |
| `PATCH /microcycles/{id}` · `POST /microcycles/{id}/duplicate` | `plans:write` | `{weekType}` · `{targetMicrocycleId}` | Tipo de semana · copiar semana (reemplaza). |
| `GET /plan-sessions/{id}` · `PATCH` | `plans:read` / `plans:write` | `updateSessionSchema` | Sesión con bloques, ejercicios, texto para el cliente y validación. |
| `POST /plan-sessions/{id}/blocks` · `POST /plan-sessions/{id}/duplicate` | `plans:write` | `blockSchema` · `{targetMicrocycleId}` | |
| `PATCH/DELETE /session-blocks/{id}` · `POST …/move` · `POST …/exercises` | `plans:write` | `updateBlockSchema` · `{direction}` · `sessionExerciseSchema` | |
| `PATCH/DELETE /session-exercises/{id}` · `POST …/move` | `plans:write` | `updateSessionExerciseSchema` (`expectedVersion`, `overrideReason?`) | Un override de plantilla o progresión se audita con su motivo. |

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
