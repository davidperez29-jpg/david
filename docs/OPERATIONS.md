# Operación

> Fase 15. Cómo desplegar, escalar, vigilar y recuperar la plataforma.
>
> - Las decisiones de infraestructura que dependen del proveedor están marcadas como *[Completar al desplegar]*: proveedor, región UE y política de copias.
> - Lo que este documento afirma se probó en local con Docker. Ver §7.

## 1. Piezas

| Pieza | Qué es | Estado |
|---|---|---|
| App web + API | Next.js (`apps/web`), una imagen Docker (`Dockerfile`) | **Sin estado**: varias réplicas detrás de un balanceador |
| Base de datos | PostgreSQL 16 | Única fuente de verdad: sesiones, límites de peticiones, auditoría, datos |
| Archivos subidos | Siluetas de ejercicios (`FILE_STORAGE_DIR`) | Volumen compartido si hay más de una réplica *[o almacenamiento de objetos UE: adaptador pendiente]* |
| Trabajos diarios | `monitor:daily` (alertas) y `privacy:daily` (retención y depuración) | Un *cron* del proveedor, una vez al día, con la misma imagen |
| Migraciones | `db:migrate` + catálogos (`db:seed`, idempotente) | Un trabajo puntual antes de cada despliegue |

## 2. Variables de entorno

| Variable | Obligatoria | Uso |
|---|---|---|
| `DATABASE_URL` | Sí | Conexión. El usuario debe ser propietario de las tablas y miembro de `app_runtime`: la app cambia a ese rol (sin `BYPASSRLS`) en cada transacción |
| `APP_ENCRYPTION_KEY` | Sí | 32 bytes en base64. Cifra el teléfono, el texto de salud y los secretos TOTP |
| `APP_ENCRYPTION_KEYS_PREVIOUS` | No | Claves anteriores durante una rotación (§5) |
| `APP_BASE_URL` | Sí | URL pública: enlaces de invitación y recuperación |
| `FILE_STORAGE_DIR` | No | `/data/files` en la imagen |
| `PWNED_PASSWORDS_CHECK` | No | `on` = rechazar contraseñas filtradas (k-anonimato) |
| `LOG_LEVEL` | No | `debug`, `info` (por defecto), `warn` o `error` |
| `ERROR_WEBHOOK_URL` | No | Recibe los errores inesperados ya depurados (JSON). Por ejemplo, un colector o un *relay* de Sentry en la UE *[Completar]* |
| `APP_VERSION` | No | Aparece en `/api/health` |
| `API_LIMIT_READ` · `API_LIMIT_WRITE` · `API_LIMIT_HEAVY` | No | Peticiones por usuario y minuto (por defecto 1 000 · 120 · 30) |

Los secretos van en el gestor de secretos del proveedor, nunca en el repositorio ni en la imagen *[Completar: vault o KMS]*.

## 3. Desplegar

```bash
docker build -t training-platform:$VERSION .
# 1. Migraciones y catálogos (una vez por despliegue; las migraciones solo avanzan)
docker run --rm -e DATABASE_URL=… -w /app/packages/db training-platform:$VERSION \
  sh -c 'node node_modules/tsx/dist/cli.mjs scripts/migrate.ts && node node_modules/tsx/dist/cli.mjs scripts/seed.ts'
# 2. App (tantas réplicas como haga falta)
docker run -d -p 3000:3000 -e DATABASE_URL=… -e APP_ENCRYPTION_KEY=… -e APP_BASE_URL=… \
  -v files:/data/files training-platform:$VERSION
```

`docker-compose.yml` hace lo mismo en local:

```bash
POSTGRES_PASSWORD=… APP_ENCRYPTION_KEY=$(openssl rand -base64 32) docker compose up
```

**Orden en cada versión**:

1. Migrar.
2. Desplegar las réplicas una a una.
3. Esperar a que `/api/ready` responda 200 antes de dar tráfico a cada una.

Las migraciones son compatibles hacia atrás con la versión anterior durante el despliegue (solo añaden). Si alguna vez no lo fueran, el CHANGELOG lo indicará.

**Detrás de un proxy**: el límite de inicio de sesión por IP usa `X-Forwarded-For`. Configura el balanceador para que sustituya esa cabecera, no para que la añada, y que no se pueda falsear (PENTEST P-4).

## 4. Vigilar

- **`GET /api/health`** (*liveness*): el proceso responde. Lo usa el `HEALTHCHECK` de la imagen.
- **`GET /api/ready`** (*readiness*): la base de datos responde, con su número de migraciones aplicadas. Devuelve 503 si no.
- **Logs**: una línea JSON por evento en la salida estándar.
  - **`http_request`**: `requestId`, método, ruta sin ids (`/api/v1/clients/:id`), estado y `ms`.
  - **`unexpected_error`**: clase, mensaje depurado, código de PostgreSQL y las primeras líneas de la pila de nuestro código.
  - **`subject_erased`**: id seudónimo del cliente suprimido (§6).
  - **Nunca** se registran cuerpos de petición, cookies, emails, teléfonos, nombres ni texto de salud. Las claves sensibles se redactan y el texto libre se depura (`observability.ts`, con tests).
- **Alertas recomendadas** *[Completar en la herramienta de monitorización]*:
  - tasa de 5xx mayor del 1 % en 5 min;
  - p95 de `ms` en `http_request` mayor de 300 ms en listados;
  - `/api/ready` distinto de 200;
  - cualquier `unexpected_error`;
  - fallo del trabajo diario.
- Cada respuesta de la API lleva `X-Request-Id` para cruzar una queja de un usuario con los logs.

## 5. Escalar y mantener

- **Horizontal**:
  - la app no guarda estado en memoria;
  - las sesiones, los límites de intentos de inicio de sesión y los presupuestos de peticiones por usuario están en PostgreSQL;
  - una réplica se puede añadir o quitar en cualquier momento.
- **Medido** (`TESTING.md`, «Rendimiento»): con 10 entrenadores y 1 000 clientes, todos los listados están por debajo de 135 ms p95 en una sola instancia. Es el objetivo de §2.3: 1 instancia para 10 entrenadores y 1 000 clientes.
- **Conexiones**: cada réplica abre un *pool* de 10 conexiones (`createDb`). Ajusta `max_connections` de PostgreSQL a `réplicas × 10 + trabajos + margen`.
- **Rotación de la clave de cifrado**:
  1. Mueve la clave actual a `APP_ENCRYPTION_KEYS_PREVIOUS`.
  2. Pon la nueva en `APP_ENCRYPTION_KEY` y despliega.
  3. Ejecuta `pnpm keys:rotate`: debe informar de 0 valores ilegibles.
  4. Retira la clave anterior.
- **Dependencias**: CI falla con vulnerabilidades altas o críticas (`pnpm audit --prod --audit-level high`).

## 6. Copias de seguridad y restauración

**Política** (§2.3: copias diarias y PITR de 7 días) *[Completar: servicio gestionado UE o pgBackRest/WAL-G]*:

| Qué | Cómo | Retención |
|---|---|---|
| Base de datos | Copia completa diaria + archivo de WAL (recuperación a un instante) | 7 días de PITR; copias diarias *[Completar, p. ej. 30 días]* `[REQUIERE VALIDACIÓN LEGAL]` |
| Archivos subidos | Copia diaria del volumen | Igual que la base de datos |
| Logs | En la herramienta de logs, separados de la base de datos | Al menos tanto como las copias (los necesita la restauración) |

Las copias se cifran en reposo y se guardan en la UE, en otra cuenta o proyecto distinto del de producción.

**Restaurar** (probado en local con `pg_dump`/`pg_restore`, §7):

1. Restaura la copia o el instante en una base nueva y comprueba `/api/ready` contra ella.
2. **Vuelve a aplicar las supresiones RGPD** posteriores a la copia: si no, las personas suprimidas desde entonces volverían a estar.

   ```bash
   # Los eventos subject_erased de los logs desde la hora de la copia:
   grep subject_erased app.log | DATABASE_URL=… pnpm privacy:reapply-erasures
   ```

   El script anonimiza cada cliente que aún no lo esté e informa de cuántos aplicó.
3. Cambia la app a la base restaurada.

**Simulacro**: al menos cada 6 meses *[Completar]*. Restaura en un entorno aislado, reaplica las supresiones, comprueba unos cuantos clientes y registra la fecha y el tiempo que llevó.

## 7. Qué se ha probado (Fase 15)

| Prueba | Resultado |
|---|---|
| `docker build` (también en CI, trabajo `image`) | Imagen construida (≈ 1,7 GB sin optimizar) |
| `docker compose up` | Migraciones (31) y catálogos aplicados; la app sana; `/api/ready` → `ready`; `/login` 200; API sin sesión 401; logs `http_request` en JSON |
| Copia → supresión → restauración → reaplicación | El cliente suprimido vuelve con la copia; el script lo anonimiza de nuevo |
| Arranque sin red | La imagen no descarga nada al arrancar (se ejecuta con `node`, sin pnpm) |

**Pendiente**:

- **Imagen**: es grande porque incluye las dependencias de desarrollo, que las migraciones necesitan (`tsx`). Separar una imagen de trabajos de otra mínima con `output: 'standalone'` la reduciría.
- **Archivos**: adaptador de almacenamiento de objetos (UE) para no depender de un volumen compartido.
- **Plataforma**: proveedor, región y herramienta de monitorización *[Completar al desplegar]*.
