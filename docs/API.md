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
