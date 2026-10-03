# Seguridad y privacidad

> Base de la Fase 1. Se completará en la Fase 13 (ASVS L2, DPIA, retención, exportación/supresión RGPD). Diseño completo: `MASTER_SPECIFICATION.md` §14.

## 1. Controles implementados

| Área | Control | Dónde |
|---|---|---|
| Contraseñas | argon2id (m = 19 MiB, t = 2, p = 1); mínimo 12 caracteres, máximo 128; rechazo de triviales y de las que contienen el email | `packages/auth/src/password.ts`, `packages/domain/src/iam/password-policy.ts` |
| Enumeración de cuentas | Mismo mensaje y tiempo similar (verificación contra hash ficticio) para usuario inexistente y contraseña errónea; la recuperación de contraseña siempre responde OK | `auth-service.ts` |
| Fuerza bruta | Bloqueo de la cuenta 15 min tras 5 fallos; límite por email (5 fallos / 15 min) y por IP (30 intentos / 15 min); claves seudonimizadas con HMAC | `rate-limit.ts`, `auth-service.ts` |
| Sesiones | Token opaco de 256 bits; en BD solo el SHA-256; cookie `HttpOnly`, `Secure` (prod), `SameSite=Lax`; inactividad 12 h / máximo 7 d para staff y 30 d / 90 d para clientes; revocación al desactivar usuario, cambiar o restablecer contraseña | `session.ts`, `server/session.ts` |
| 2FA | TOTP (RFC 6238) opcional para todos, recomendado para staff; secreto cifrado; la sesión queda en `second_factor_required` hasta verificar | `totp.ts`, `/login/2fa`, `/app/settings` |
| Invitaciones | Únicas, de 7 días, de un solo uso, token hasheado; una nueva anula las pendientes del mismo email; solo ADMIN invita a staff | `invitations.ts` |
| Autorización | RBAC + ámbito (`org` / `assigned` / `own`), *deny by default*; recursos fuera de ámbito → 404 | `domain/iam/policy.ts`, `application/authz.ts` |
| Rutas | Todo handler de `/api/v1` usa `authedRoute` o `publicRoute`; los públicos están en una lista cerrada (test) | `server/api.ts`, `test/routes.unit.test.ts` |
| CSRF | `SameSite=Lax` + comprobación de `Origin`/`Referer` en POST/PUT/PATCH/DELETE | `server/api.ts` |
| Cabeceras | CSP sin orígenes externos, `frame-ancestors 'none'`, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy` | `next.config.ts` |
| Validación | Zod en toda entrada; límite de 256 KB por petición; escape de comodines `LIKE` en búsquedas | `contracts`, `server/api.ts`, `clients.ts` |
| Bloqueo optimista | `version` en clientes: un cambio concurrente devuelve 409 | `updateClient` |
| Cifrado de columna | AES-256-GCM (IV aleatorio, etiqueta de autenticación) para teléfono, texto libre de salud y secreto TOTP | `auth/crypto.ts` |
| Auditoría | Toda escritura sobre cliente, objetivos, salud, consentimientos, asignaciones, usuarios e invitaciones, en la misma transacción; diff por campo; lecturas de salud auditadas (`view_sensitive`); secretos y texto de salud nunca copiados al log; trigger *append-only* | `application/audit.ts`, migración `0001` |
| Errores | Respuestas sin trazas ni datos internos; `requestId` para correlación; el log de servidor no incluye cuerpos de petición | `server/api.ts` |

## 2. RGPD implementado en Fase 1

- **Consentimiento explícito para datos de salud** (art. 9.2.a): sin consentimiento activo para `health_data`, el sistema **rechaza** registrar declaraciones de salud o cribados.
- Consentimientos **granulares** (servicio, salud, fotografías, comercial), **versionados** (si cambia el texto, hay que volver a consentir) y **revocables**; historial completo.
- El cliente otorga o revoca en la app (`in_app`); el staff solo puede registrar consentimientos obtenidos en papel o de forma verbal registrada, nunca suplantar el consentimiento en la app.
- Minimización: no se piden diagnósticos ni medicación; el texto de salud lleva el aviso «No incluyas información médica innecesaria».
- No diagnóstico: el único mensaje sanitario es *«Requiere valoración por profesional sanitario.»*; la «valoración registrada» documenta lo que aporta un profesional, el sistema no la decide.

## 3. Pendiente (con fase)

| Elemento | Fase |
|---|---|
| RLS de PostgreSQL como defensa en profundidad | 2 |
| Comprobación de contraseñas filtradas (k-anonimato) | 13 |
| Exportación y supresión/anonimización del interesado desde la UI | 13 |
| Política de retención automática y DPIA | 13 (requiere asesoramiento legal, D7) |
| Proveedor de email en la UE y plantillas | Decisión D4 |
| Rotación de `APP_ENCRYPTION_KEY` (re-cifrado) | 13 |
| Rate limiting distribuido (si hay varias réplicas) | 15 |
| Códigos de recuperación de 2FA | 13 |
| Configuración de proxy de confianza para `X-Forwarded-For` | Despliegue |

## 4. Notificar vulnerabilidades

Escribe al responsable del repositorio. No abras issues públicas con detalles de explotación.
