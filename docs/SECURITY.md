# Seguridad y privacidad

> Actualizado en la Fase 13. Diseño completo: `MASTER_SPECIFICATION.md` §14. Documentos relacionados: [`ASVS_L2.md`](ASVS_L2.md) (checklist de verificación), [`DPIA.md`](DPIA.md) (evaluación de impacto, plantilla) y [`PENTEST.md`](PENTEST.md) (pentest ligero).

## 1. Controles implementados

| Área | Control | Dónde |
|---|---|---|
| Contraseñas | argon2id (m = 19 MiB, t = 2, p = 1); mínimo 12 caracteres, máximo 128; rechazo de triviales y de las que contienen el email; con `PWNED_PASSWORDS_CHECK=on`, rechazo de contraseñas filtradas (Have I Been Pwned por **k-anonimato**: solo salen del servidor los 5 primeros caracteres hex del SHA-1; si el servicio no responde, no bloquea) | `packages/auth/src/password.ts`, `packages/auth/src/pwned.ts`, `packages/domain/src/iam/password-policy.ts` |
| Enumeración de cuentas | Mismo mensaje y tiempo similar (verificación contra hash ficticio) para usuario inexistente y contraseña errónea; la recuperación de contraseña siempre responde OK | `auth-service.ts` |
| Fuerza bruta | Bloqueo de la cuenta 15 min tras 5 fallos; límite por email (5 fallos / 15 min) y por IP (50 fallos / 15 min; los inicios de sesión correctos no cuentan, porque muchos clientes de un mismo gimnasio comparten IP); claves seudonimizadas con HMAC | `auth/rate-limit.ts` (en BD: vale con varias réplicas), `auth-service.ts` |
| Sesiones | Token opaco de 256 bits; en BD solo el SHA-256; cookie `HttpOnly`, `Secure` (prod), `SameSite=Lax`; inactividad 12 h / máximo 7 d para staff y 30 d / 90 d para clientes; revocación al desactivar usuario, cambiar o restablecer contraseña; el usuario ve sus **sesiones abiertas** en Ajustes y puede cerrar cualquiera | `session.ts`, `server/session.ts`, `DELETE /auth/sessions/{id}` |
| 2FA | TOTP (RFC 6238); **obligatorio para ADMIN** (ajuste de la organización, activo por defecto: sin 2FA, la API solo permite `/auth/*` y la interfaz lleva a Ajustes), recomendado para el resto del staff; secreto cifrado; la sesión queda en `second_factor_required` hasta verificar; **10 códigos de recuperación** de un solo uso (solo su SHA-256 en BD, se muestran una vez, regenerables con un código TOTP; su uso queda auditado) | `totp.ts`, `recovery.ts`, `/login/2fa`, `/app/settings` |
| Invitaciones | Únicas, de 7 días, de un solo uso, token hasheado; una nueva anula las pendientes del mismo email; solo ADMIN invita a staff | `invitations.ts` |
| Autorización | RBAC + ámbito (`org` / `assigned` / `own`), *deny by default*; recursos fuera de ámbito → 404 | `domain/iam/policy.ts`, `application/authz.ts` |
| Row Level Security | Segunda barrera en PostgreSQL para **todas** las tablas, probada tabla a tabla con una matriz positiva y negativa (Fase 14): rol `app_runtime` sin `BYPASSRLS`, actor por transacción, denegación sin contexto, tablas de seguridad solo para el sistema, auditoría no falsificable (`actor_user_id = app_user_id()`) | `packages/db/src/rls`, `application/rls.ts`, `DATABASE.md` §5 |
| Integridad multi-tenant | Triggers que impiden mezclar organización/cliente en hijos y relaciones | `DATABASE.md` §4 |
| Rutas | Todo handler de `/api/v1` usa `authedRoute` o `publicRoute`; los públicos están en una lista cerrada (test) | `server/api.ts`, `test/routes.unit.test.ts` |
| CSRF | `SameSite=Lax` + comprobación de `Origin`/`Referer` en POST/PUT/PATCH/DELETE | `server/api.ts` |
| Cabeceras | CSP sin orígenes externos, `frame-ancestors 'none'`, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy` | `next.config.ts` |
| Subida de archivos | Solo PNG/JPEG/WebP ≤ 2 MB detectados por contenido, sin SVG; clave de almacenamiento aleatoria y validada (sin *path traversal*); servido con `nosniff` y autorización | `application/storage.ts`, `library.ts` |
| Vídeos embebidos | Solo YouTube (`youtube-nocookie`) y Vimeo, en iframe con *sandbox*; CSP `frame-src` limitada a esos dos orígenes | `domain/library/video.ts`, `next.config.ts` |
| Validación | Zod en toda entrada; límite de 256 KB por petición; escape de comodines `LIKE` en búsquedas | `contracts`, `server/api.ts`, `clients.ts` |
| Bloqueo optimista | `version` en clientes: un cambio concurrente devuelve 409 | `updateClient` |
| Cifrado de columna | AES-256-GCM (IV aleatorio, etiqueta de autenticación) para teléfono, texto libre de salud y secreto TOTP. **Rotación**: la clave nueva va en `APP_ENCRYPTION_KEY` y las anteriores en `APP_ENCRYPTION_KEYS_PREVIOUS` (se siguen aceptando para leer); `pnpm keys:rotate` re-cifra todas las columnas e informa de las ilegibles | `auth/crypto.ts`, `application/privacy.ts` |
| Auditoría | Toda escritura sobre cliente, objetivos, salud, consentimientos, asignaciones, usuarios e invitaciones, en la misma transacción; diff por campo; lecturas de salud auditadas (`view_sensitive`); secretos y texto de salud nunca copiados al log; trigger *append-only*; la única excepción es la **supresión RGPD**: la función `redact_client_audit` (solo ADMIN) borra el detalle de los cambios del cliente y conserva quién, cuándo y qué acción | `application/audit.ts`, migraciones `0001` y `0023` |
| Exportaciones (Fase 12) | Inyección CSV/XLSX neutralizada (celdas de texto que empiezan por `= + - @` con prefijo `'`); alcance por RLS; cada exportación y descarga de informe auditada (`export`); descargas con `Cache-Control: no-store` y `nosniff`; sin declaraciones de salud | `domain/reports/csv.ts`, `application/exports.ts`, `server/api.ts` |
| Importaciones (Fase 12) | Solo CSV/XLSX, ≤ 2 MB y ≤ 1 000 filas; cada fila validada (zod + catálogos + permisos) antes de escribir nada; alta por los casos de uso normales (permisos, RLS, auditoría); el archivo no se guarda | `application/imports.ts` |
| Errores | Respuestas sin trazas ni datos internos; `requestId` para correlación; el log de servidor no incluye cuerpos de petición | `server/api.ts` |

## 2. RGPD

### 2.1 Consentimiento y minimización (Fase 1)

- **Consentimiento explícito para datos de salud** (art. 9.2.a): sin consentimiento activo para `health_data`, el sistema **rechaza** registrar declaraciones de salud o cribados.
- Consentimientos **granulares** (servicio, salud, fotografías, comercial), **versionados** (si cambia el texto, hay que volver a consentir) y **revocables**; historial completo.
- El cliente otorga o revoca en la app (`in_app`); el staff solo puede registrar consentimientos obtenidos en papel o de forma verbal registrada, nunca suplantar el consentimiento en la app.
- Minimización: no se piden diagnósticos ni medicación; el texto de salud lleva el aviso «No incluyas información médica innecesaria».
- No diagnóstico: el único mensaje sanitario es *«Requiere valoración por profesional sanitario.»*; la «valoración registrada» documenta lo que aporta un profesional, el sistema no la decide.

### 2.2 Derechos del interesado (Fase 13)

Todos se ejercen **desde la interfaz**:

| Derecho | Cliente (`/me/privacidad`) | ADMIN |
|---|---|---|
| Acceso y portabilidad (arts. 15 y 20) | «Descargar mis datos (JSON)»: copia inmediata de todas sus tablas, descifrada, con su registro de actividad (roles, no identidades del staff). Queda auditada y registrada como solicitud atendida. | Ficha → Privacidad → «Exportar datos del interesado». |
| Rectificación, supresión, limitación y oposición (arts. 16–18 y 21) | Formulario de solicitud con plazo de respuesta de **un mes** (art. 12.3); lista de sus solicitudes, con estado y respuesta; puede cancelarlas. | Menú **Privacidad**: bandeja con plazo y marca «Fuera de plazo»; se atiende o deniega con una respuesta obligatoria al interesado. |
| Supresión (art. 17) | — | Ficha → Privacidad → «Suprimir datos…»: **doble confirmación** (abrir el formulario y escribir el nombre completo) y motivo. Permiso `privacy:erase_subject`, solo ADMIN. |

Una solicitud de supresión no puede marcarse como atendida si la supresión no se ha ejecutado; al ejecutarla, las solicitudes pendientes se cierran solas.

**Qué hace la supresión** (anonimización irreversible, en una transacción):

- **Borra**: declaraciones de salud, cribados, molestias, tolerancias, historial, alertas, informes, invitaciones y archivos.
- **Vacía**: comentarios libres en sesiones y feedback, y filas de importación.
- **Cierra la cuenta**: email sustituido por `anonimo-<id>@invalid.local`, desactivada, sin sesiones ni códigos.
- **Sustituye** en la ficha: nombre «Cliente anónimo …», contacto y preferencias vacíos; de la fecha de nacimiento solo se conserva el año.
- **Redacta** la auditoría del cliente (`redact_client_audit`) y añade una entrada `anonymize` sin datos personales.
- **Conserva**, sin identificar: los datos de entrenamiento (planes, series, evaluaciones) como agregados.

### 2.3 Retención (Fase 13)

- **Clientes archivados**: el ADMIN fija en **Privacidad → Conservación** el plazo en meses. Al vencer, `pnpm privacy:daily` los anonimiza como en una supresión.
  - **No hay plazo por defecto**: lo decide el responsable del tratamiento `[REQUIERE VALIDACIÓN LEGAL]` (D7).
- **Registros de seguridad**, depurados en el mismo proceso diario:
  - sesiones caducadas o revocadas hace más de 30 días;
  - intentos de inicio de sesión de más de 90 días;
  - tokens de recuperación de contraseña caducados;
  - filas de importaciones cerradas de más de 30 días.
- Estos plazos técnicos son una propuesta razonable, no un requisito legal verificado `[REQUIERE VALIDACIÓN LEGAL]`.

## 3. Pendiente

| Elemento | Cuándo |
|---|---|
| Validación legal de la DPIA, del registro de actividades y de los plazos de retención | Decisión D7 (asesor) |
| Proveedor de email en la UE y plantillas (avisos de solicitudes RGPD por email) | Decisión D4 |
| Límite de peticiones por usuario en el resto de la API (el login ya lo tiene, en BD) | 15 |
| Configuración de proxy de confianza para `X-Forwarded-For` | Despliegue |
| Copias de seguridad cifradas y propagación de supresiones a las copias (caducidad) | 15 |
| Auditoría o pentest externo | Opcional (H6) |
| Actualizar `exceljs` cuando su dependencia `uuid` salga del aviso moderado (no explotable: solo usa `v4`) | Mantenimiento |
| CSP con *nonces* (sin `'unsafe-inline'` en `script-src`) | 15 |

## 4. Notificar vulnerabilidades

Escribe al responsable del repositorio. No abras issues públicas con detalles de explotación.
