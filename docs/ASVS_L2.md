# Checklist OWASP ASVS nivel 2

> Fase 13. Esta es una revisión **por capítulo** frente a OWASP ASVS 4.0.3, nivel 2 (`MASTER_SPECIFICATION.md` §3: «OWASP ASVS nivel 2 como checklist»).
>
> - Cada fila resume los requisitos del capítulo que aplican a esta aplicación y cómo se cumplen.
> - La correspondencia requisito a requisito con el texto oficial (numeración `V2.1.1`…) está sin hacer: **[REQUIERE VERIFICACIÓN]** por una persona revisora con el estándar delante.
> - Estados: ✅ cumple · ◐ parcial (motivo) · ⏳ fuera de alcance de la aplicación o del despliegue · — no aplica.
> - **Revisada de nuevo en la fase 10 de la reestructuración** (06/10/2026) con la interfaz nueva y los módulos de lesiones, fichaje, cola sin conexión y fichas «Fuente». Los cambios están marcados «(Reestr. F10)»; los hallazgos, en `PENTEST.md` (P-10 a P-13).
> - **Revisada otra vez en la fase 18 de la reestructuración** (09/10/2026) con lo añadido en las fases 11 a 17. Los cambios están marcados «(Reestr. F18)»; los hallazgos, en `PENTEST.md` (P-14 a P-23).

## V1 Arquitectura y modelo de amenazas

| Control | Estado | Evidencia |
|---|---|---|
| Modelo de amenazas documentado | ✅ | `MASTER_SPECIFICATION.md` §14.1 |
| Un único punto de autorización, compartido por la API y la interfaz | ✅ | Casos de uso `secured()` + `authorize*` en `packages/application`; las rutas no deciden permisos |
| Defensa en profundidad en la capa de datos | ✅ | RLS en todas las tablas, rol `app_runtime` sin `BYPASSRLS` (`DATABASE.md` §5) |
| Capas separadas, con dependencias verificadas | ✅ | `pnpm depcruise` en CI (`ARCHITECTURE.md`) |
| Cifrado de datos sensibles documentado, con rotación | ✅ | `SECURITY.md` §1 (cifrado de columna y rotación) |

## V2 Autenticación

| Control | Estado | Evidencia |
|---|---|---|
| Contraseña de al menos 12 caracteres, hasta 128; sin reglas de composición; se permiten espacios y Unicode | ✅ | `domain/iam/password-policy.ts` |
| Rechazo de contraseñas filtradas | ✅ | `auth/pwned.ts` (k-anonimato), activable con `PWNED_PASSWORDS_CHECK=on`; si el servicio no responde, no bloquea |
| Almacenamiento con función lenta y sal | ✅ | argon2id (`auth/password.ts`) |
| Protección frente a fuerza bruta | ✅ | Bloqueo de cuenta y límites por email e IP, contados en BD (`auth/rate-limit.ts`), válidos con varias réplicas |
| Sin enumeración de cuentas | ✅ | Mismo mensaje y tiempo similar en el login; la recuperación siempre responde OK |
| Recuperación por enlace de un solo uso y con caducidad; sin preguntas de seguridad | ✅ | `password_reset_tokens` hasheados |
| Cambio de contraseña con la contraseña actual; revoca las demás sesiones | ✅ | `changePassword` |
| Segundo factor (TOTP) y obligatorio para ADMIN | ✅ | `organizations.require_admin_2fa` (activo por defecto); la API bloquea a un ADMIN sin 2FA salvo `/auth/*` |
| Código TOTP de un solo uso dentro de su ventana | ✅ | `users.totp_last_step` (Fase 13, hallazgo P-1 de `PENTEST.md`) |
| Códigos de recuperación de un solo uso, guardados como hash | ✅ | `user_recovery_codes`, consumo atómico y auditado |
| Avisar al usuario de cambios en su autenticación (por email) | ◐ | Queda auditado; sin email hasta decidir el proveedor (D4) |

## V3 Gestión de sesiones

| Control | Estado | Evidencia |
|---|---|---|
| Token aleatorio de 256 bits; en BD solo su hash | ✅ | `auth/session.ts` |
| Cookie `HttpOnly`, `Secure`, `SameSite=Lax`, ámbito `/` | ✅ | `server/session.ts`; lo comprueba `e2e/security.spec.ts` |
| Caducidad por inactividad y absoluta | ✅ | Staff: 12 h / 7 d · clientes: 30 d / 90 d |
| Cierre de sesión que invalida el token en el servidor | ✅ | `logout` revoca en BD |
| Ver y cerrar las sesiones abiertas | ✅ | Ajustes → «Sesiones abiertas» (Fase 13) |
| Revocación al cambiar o restablecer la contraseña, o al desactivar la cuenta | ✅ | `auth-service.ts`, `users.ts` |

## V4 Control de acceso

| Control | Estado | Evidencia |
|---|---|---|
| Denegar por defecto; permisos por rol y ámbito (`org` / `assigned` / `own`) | ✅ | `domain/iam/permissions.ts`, `policy.ts` |
| IDOR: los recursos fuera de ámbito responden 404 | ✅ | `authz.ts`; E2E `trainer.spec.ts` y `security.spec.ts`; en la Fase 14, **todas las rutas** con 3 atacantes (`security-routes.spec.ts`) |
| Ninguna ruta sin autorización | ✅ | `routes.unit.test.ts` enumera todas las rutas |
| Aislamiento entre organizaciones | ✅ | RLS + triggers de integridad; tests de integración multi-tenant; matriz RLS de todas las tablas (Fase 14) |
| Operaciones sensibles con confirmación adicional | ✅ | Supresión RGPD con doble confirmación; 2FA para ADMIN |
| CSRF | ✅ | `SameSite=Lax` + comprobación de `Origin`/`Referer` |
| Datos de salud solo para quien los necesita | ✅ | (Reestr. F10) Los casos de lesión son solo de staff con el cliente en su ámbito: la RLS los oculta a la app del cliente, y sus lecturas se auditan como `view_sensitive` (`INJURY_MODULE.md`) |
| Estados que impiden editar | ✅ | (Reestr. F10) Un plan completado o archivado no se edita tampoco por la API (`409`, P-12) |
| Permisos acordes al alcance del cambio | ✅ | (Reestr. F18) Las normas del centro, que cambian las comparaciones de todos los clientes, solo las importa y elimina ADMIN (`science:publish`, P-17) |

## V5 Validación, saneamiento y codificación

| Control | Estado | Evidencia |
|---|---|---|
| Validación de toda entrada con esquemas | ✅ | zod en `packages/contracts` |
| Consultas parametrizadas, sin SQL dinámico con datos | ✅ | Drizzle; escape de comodines `LIKE` |
| Codificación de salida | ✅ | React escapa por defecto; sin `dangerouslySetInnerHTML` con datos de usuario |
| Inyección de fórmulas en CSV/XLSX | ✅ | `domain/reports/csv.ts` |
| Límite de tamaño de las peticiones | ✅ | 256 KB en JSON; 2 MB en archivos. (Reestr. F18) Además, 5 000 caracteres por celda importada y 500 en la lista de percentiles (P-14) |
| Expresiones regulares sin retroceso catastrófico (ReDoS) | ✅ | (Reestr. F18) Patrones lineales sobre texto acotado; una prueba rechaza entradas patológicas en < 200 ms (P-14) |
| Claves de objetos controladas por el usuario | ✅ | (Reestr. F18) Solo claves propias (`Object.hasOwn`), nunca heredadas del prototipo (P-16) |

## V6 Criptografía almacenada

| Control | Estado | Evidencia |
|---|---|---|
| AES-256-GCM con IV aleatorio | ✅ | `auth/crypto.ts` |
| Claves derivadas de una maestra (HKDF/HMAC) y fuera del código | ✅ | `APP_ENCRYPTION_KEY` en el entorno |
| Rotación de claves sin pérdida de datos | ✅ | `APP_ENCRYPTION_KEYS_PREVIOUS` + `pnpm keys:rotate`. (Reestr. F18) Un valor que ninguna clave abre no rompe la página: aviso en el campo y registro sin contenido (P-20) |
| Números aleatorios criptográficos | ✅ | `node:crypto` |
| Gestión de secretos en un vault o KMS | ⏳ | Despliegue (Fase 15) |

## V7 Errores y registro

| Control | Estado | Evidencia |
|---|---|---|
| Sin trazas ni detalles internos en las respuestas | ✅ | `server/api.ts`; E2E `security.spec.ts` |
| Registro de eventos de seguridad: login, fallos, 2FA, códigos, sesiones, contraseñas | ✅ | `audit_logs` |
| Registro a prueba de manipulación | ✅ | Trigger *append-only*; la única redacción es la supresión RGPD, que conserva quién y cuándo |
| Sin datos sensibles en los registros | ✅ | Secretos y texto de salud nunca se copian; el log del servidor no incluye cuerpos de petición |
| Registro estructurado y sin datos personales | ✅ | JSON por línea, redacción y depuración probadas (`observability.ts`, Fase 15) |
| Sincronización horaria y retención de los registros | ⏳ | Despliegue (`OPERATIONS.md`) |

## V8 Protección de datos

| Control | Estado | Evidencia |
|---|---|---|
| Datos sensibles fuera de cachés | ✅ | Descargas con `Cache-Control: no-store` |
| Minimización y consentimiento | ✅ | `SECURITY.md` §2.1 |
| Exportación y supresión de los datos del interesado | ✅ | `SECURITY.md` §2.2. (Reestr. F10) Cubren los casos de lesión y el resto de tablas nuevas. Una prueba de guardia exige que toda tabla con `client_id` se exporte o tenga un motivo escrito (P-11) |
| Retención configurable y depuración automática | ✅ | `SECURITY.md` §2.3 (plazo de clientes: **[REQUIERE VALIDACIÓN LEGAL]**) |
| Datos sensibles fuera de la URL | ✅ | Los tokens de invitación y de recuperación se consumen y se guardan como hash; ninguna consulta lleva datos personales |
| Almacenamiento en el cliente | ◐ | La PWA guarda en IndexedDB la cola sin conexión (series y, si el cliente las informa, molestias y comentarios de la sesión) solo hasta sincronizar, y entonces la borra; no se cifra en el dispositivo. (Reestr. F10) La cola es del usuario que la escribió: al cerrar sesión se vacía (avisando si queda algo pendiente) y al entrar otra cuenta se borra lo ajeno (P-10) |

## V9 Comunicaciones

| Control | Estado | Evidencia |
|---|---|---|
| TLS en todo el tráfico y HSTS | ◐ | La cabecera HSTS se envía siempre; la terminación TLS es del despliegue |
| TLS hacia la base de datos | ⏳ | Despliegue |

## V10 Código malicioso

| Control | Estado | Evidencia |
|---|---|---|
| Dependencias fijadas en un *lockfile*; sin scripts de terceros en el navegador | ✅ | `pnpm-lock.yaml`; CSP sin orígenes externos para scripts |
| Análisis de dependencias en CI | ✅ | `pnpm audit --prod --audit-level high` en CI (Fase 14). (Reestr. F18) La moderada de `uuid` (P-9) está corregida: `pnpm audit --prod` no encuentra nada |

## V11 Lógica de negocio

| Control | Estado | Evidencia |
|---|---|---|
| Flujos en orden y sin saltos | ✅ | Máquinas de estado: planes (completado o archivado = solo lectura en el servidor), importaciones, solicitudes RGPD, sesiones, fases de lesión (avanzar solo con criterios cumplidos, sin avisos abiertos y por decisión humana) |
| Límites antiautomatización en operaciones caras | ✅ | Login limitado; en la Fase 15, presupuesto por usuario y minuto para lecturas, escrituras y operaciones pesadas (`api-limits.ts`) |
| Concurrencia | ✅ | Bloqueo optimista; consumo atómico de tokens y códigos; sincronización idempotente |
| Lo realizado no se pierde | ✅ | (Reestr. F18) Una sesión con cualquier registro (asistencia o series) no se mueve ni se sustituye (P-15); una propuesta de días no admite valores editados (P-18); la aplicación automática solo da pasos estándar (P-21) |

## V12 Archivos y recursos

| Control | Estado | Evidencia |
|---|---|---|
| Tipo detectado por contenido; tamaño máximo; sin SVG | ✅ | `application/storage.ts` |
| Nombres de almacenamiento aleatorios, sin *path traversal* | ✅ | Clave validada |
| Descarga con `Content-Disposition: attachment` y `nosniff` | ✅ | `fileResponse` |
| Sin SSRF | ✅ | La única petición saliente va a una URL fija (HIBP), con tiempo de espera |

## V13 API

| Control | Estado | Evidencia |
|---|---|---|
| Autenticación y autorización en cada ruta | ✅ | `authedRoute`/`publicRoute` y test de enumeración |
| Tipo de contenido JSON y validación de esquema | ✅ | `readJson` + zod |
| Métodos HTTP explícitos por ruta | ✅ | Next exporta solo los métodos definidos; el resto responde 405 |

## V14 Configuración

| Control | Estado | Evidencia |
|---|---|---|
| Cabeceras de seguridad (CSP, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS) | ✅ | `next.config.ts`; E2E `security.spec.ts` |
| Sin cabecera `X-Powered-By` | ✅ | `poweredByHeader: false` |
| CSP sin `'unsafe-inline'` en scripts | ✅ | *Nonce* por petición y `'strict-dynamic'` (`src/proxy.ts`, Fase 15) |
| Construcción reproducible y CI con lint, tipos, tests y E2E | ✅ | `.github/workflows` |

## Resumen

- **Parciales**:
  - avisos por email (D4);
  - HSTS y TLS dependen del despliegue;
  - cola sin conexión de la PWA en IndexedDB: transitoria y ligada al usuario, pero sin cifrar en el dispositivo y puede incluir molestias (riesgo aceptado en la DPIA, R-6).
- **Fuera de alcance**: vault de secretos, TLS a la BD y retención de registros del servidor. Son del despliegue (Fase 15).
- **Ningún parcial es un fallo de autorización ni de aislamiento de datos.**
