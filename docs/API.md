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
