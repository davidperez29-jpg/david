# Operación

> Fase 15. Cómo desplegar, escalar, vigilar y recuperar la plataforma.
>
> - Las decisiones de infraestructura que dependen del proveedor están marcadas como *[Completar al desplegar]*: proveedor, región UE y política de copias.
> - Lo que este documento afirma se probó en local con Docker. Ver §7.

## 1. Piezas

| Pieza | Qué es | Estado |
|---|---|---|
| App web + API | Next.js (`apps/web`), imagen `web` del `Dockerfile`: servidor autónomo (`standalone`), ≈ 480 MB | **Sin estado**: varias réplicas detrás de un balanceador |
| Base de datos | PostgreSQL 16 | Única fuente de verdad: sesiones, límites de peticiones, auditoría, datos |
| Archivos subidos | Siluetas de ejercicios | **Almacenamiento de objetos S3 compatible** (`S3_*`; bucket privado en la UE) o, sin él, `FILE_STORAGE_DIR` (volumen compartido si hay varias réplicas) |
| Trabajos diarios | `monitor:daily` (alertas) y `privacy:daily` (retención y depuración) | Un *cron* del proveedor, una vez al día, con la imagen `jobs` |
| Migraciones y trabajos | Imagen `jobs` (todo el *workspace*, ≈ 1,9 GB): `db:migrate` + catálogos (`db:seed`, idempotente), `injuries:encrypt-text` (idempotente, tras las migraciones), `monitor:daily`, `privacy:daily`, `keys:rotate`, `privacy:reapply-erasures` | Trabajos puntuales o programados |

## 2. Variables de entorno

| Variable | Obligatoria | Uso |
|---|---|---|
| `DATABASE_URL` | Sí | Conexión. El usuario debe ser propietario de las tablas y miembro de `app_runtime`: la app cambia a ese rol (sin `BYPASSRLS`) en cada transacción |
| `APP_ENCRYPTION_KEY` | Sí | 32 bytes en base64. Cifra el teléfono, el texto de salud y los secretos TOTP |
| `APP_ENCRYPTION_KEYS_PREVIOUS` | No | Claves anteriores durante una rotación (§5) |
| `APP_BASE_URL` | Sí (en Render no: usa `RENDER_EXTERNAL_URL`) | URL pública: enlaces de invitación y recuperación |
| `ADMIN_EMAIL` · `ADMIN_PASSWORD` · `ADMIN_NAME` · `ORG_NAME` | Solo en la imagen todo en uno | Primer administrador y su organización; se crean una vez, si no existen. `REQUIRE_ADMIN_2FA=false` desactiva el 2FA obligatorio de esa organización |
| `DAILY_JOBS` | No | `in-app`: trabajos diarios dentro de la app (sin *cron*) |
| `DEMO_DATA` | No | `true`: datos de ejemplo; sus usuarios usan la contraseña del administrador |
| `FILE_STORAGE_DIR` | No | `/data/files` en la imagen; solo si no hay `S3_BUCKET` |
| `S3_ENDPOINT` · `S3_REGION` · `S3_BUCKET` · `S3_ACCESS_KEY_ID` · `S3_SECRET_ACCESS_KEY` · `S3_SSE` | No | Almacenamiento de objetos. Firma AWS SigV4 con URL de tipo *path* (AWS, Scaleway, OVH, MinIO…). Bucket **privado**, en la UE, sin versionado o con caducidad corta de versiones antiguas, para que una supresión RGPD borre de verdad |
| `PWNED_PASSWORDS_CHECK` | No | `on` = rechazar contraseñas filtradas (k-anonimato) |
| `LOG_LEVEL` | No | `debug`, `info` (por defecto), `warn` o `error` |
| `ERROR_WEBHOOK_URL` | No | Recibe los errores inesperados ya depurados (JSON). Por ejemplo, un colector o un *relay* de Sentry en la UE *[Completar]* |
| `APP_VERSION` | No | Aparece en `/api/health` |
| `API_LIMIT_READ` · `API_LIMIT_WRITE` · `API_LIMIT_HEAVY` | No | Peticiones por usuario y minuto (por defecto 1 000 · 120 · 30) |

Los secretos van en el gestor de secretos del proveedor, nunca en el repositorio ni en la imagen *[Completar: vault o KMS]*.

## 3. Desplegar

**Opción recomendada: Render (UE), sin comandos.** Guía en `DEPLOY_RENDER.md`.
- `render.yaml` crea la web y PostgreSQL en Frankfurt.
- `Dockerfile.render` es una imagen todo en uno: al arrancar migra, carga catálogos, crea el primer administrador desde `ADMIN_EMAIL`/`ADMIN_PASSWORD` y sirve la aplicación (`deploy/start.sh`).
- Con `DAILY_JOBS=in-app`, los trabajos diarios se ejecutan dentro de la app, una vez al día (`scheduled_job_runs`).
- CI la arranca dos veces sobre una base vacía con un propietario sin privilegios de superusuario (`deploy/smoke-test.sh`).

**Con contenedores propios** (servidor propio, otro proveedor):

```bash
docker build --target web  -t training-platform:$VERSION .
docker build --target jobs -t training-platform-jobs:$VERSION .
# 1. Migraciones, catálogos y cifrado del texto antiguo de lesiones (una vez por despliegue;
#    las migraciones solo avanzan; el cifrado es idempotente y necesita la clave)
docker run --rm -e DATABASE_URL=… -e APP_ENCRYPTION_KEY=… training-platform-jobs:$VERSION \
  sh -c 'node node_modules/tsx/dist/cli.mjs scripts/migrate.ts && node node_modules/tsx/dist/cli.mjs scripts/seed.ts \
    && cd /app/packages/application && node node_modules/tsx/dist/cli.mjs scripts/encrypt-injury-text.ts'
# 2. App (tantas réplicas como haga falta)
docker run -d -p 3000:3000 -e DATABASE_URL=… -e APP_ENCRYPTION_KEY=… -e APP_BASE_URL=… \
  -v files:/data/files training-platform:$VERSION
# Trabajos diarios (cron del proveedor), con la imagen jobs:
docker run --rm -e DATABASE_URL=… -e APP_ENCRYPTION_KEY=… -w /app/packages/application \
  training-platform-jobs:$VERSION node node_modules/tsx/dist/cli.mjs scripts/privacy-daily.ts
```

`docker-compose.yml` hace lo mismo en local:

```bash
POSTGRES_PASSWORD=… APP_ENCRYPTION_KEY=$(openssl rand -base64 32) docker compose up
# Con los datos de demostración (usuarios y clientes de prueba; se cargan una sola vez):
POSTGRES_PASSWORD=… APP_ENCRYPTION_KEY=… docker compose --profile demo up
```

El perfil `demo` es solo para probar: nunca en producción (contraseña conocida).

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

El script `scripts/restore-drill.sh` (fase 10 de la reestructuración) automatiza la parte técnica:

```bash
DATABASE_URL=postgres://…/origen scripts/restore-drill.sh --app
```

1. Copia la base con `pg_dump -Fc` desde una **instantánea exportada** (`pg_export_snapshot`), así que sirve con la base en uso.
2. La restaura en una base **nueva** del mismo servidor (`restore_drill_<fecha>`). No toca la de origen.
3. Compara origen y copia **en esa misma instantánea**: filas de cada tabla, RLS activada y forzada en cada tabla, número de políticas y migraciones aplicadas. Cualquier diferencia hace fallar el simulacro.
4. Con `--app`, arranca la build de producción contra la base restaurada (puerto 3170): `/api/ready`, inicio de sesión de un usuario demo y lista de clientes. Comprueba también que la clave de cifrado sigue abriendo los datos.
5. Borra la base restaurada (`--keep` la conserva) e imprime los tiempos para el registro.

**Registro de simulacros**:

| Fecha | Dónde | Datos | Copia | Restauración | Resultado |
|---|---|---|---|---|---|
| 06/10/2026 | Local (PostgreSQL 16), con la suite E2E escribiendo a la vez | Demo: 114 tablas, 16 022 filas, 211 políticas, 47 migraciones | 1,6 MB en 0,5 s | 2,5 s | Idéntica al origen |
| 06/10/2026 | Local, con `--app` | Demo recién cargada: 16 017 filas | 1,6 MB en 0,5 s | 2,6 s (6,0 s en total, con el arranque de la app) | Idéntica; `/api/ready` → `ready`; login y lista de clientes correctos |
| *[Completar]* | Render (base de pago, recuperación a un instante) | Producción | | | *Pendiente: lo hace el responsable en el panel; ver `DEPLOY_RENDER.md` → «Copias y restauración»* |

## 7. Qué se ha probado (Fase 15)

| Prueba | Resultado |
|---|---|
| `docker build` de `web` y `jobs` (también en CI, trabajo `image`) | `web` ≈ 480 MB (antes 1,7 GB); `jobs` ≈ 1,9 GB |
| Imagen `web` con datos demo | Inicio de sesión 200; PDF y Excel de un informe generados dentro del contenedor (comprueba que las fuentes de pdfkit van en la imagen) |
| `docker compose up` | Migraciones (31) y catálogos aplicados; la app sana; `/api/ready` → `ready`; `/login` 200; API sin sesión 401; logs `http_request` en JSON |
| Copia → supresión → restauración → reaplicación | El cliente suprimido vuelve con la copia; el script lo anonimiza de nuevo |
| Arranque sin red | La imagen no descarga nada al arrancar (se ejecuta con `node`, sin pnpm) |
| Almacenamiento de objetos | Subir, leer y borrar contra un servidor S3 real que valida las firmas (SeaweedFS, también en CI); una clave secreta errónea se rechaza |

**Pendiente**:

- **Plataforma**: proveedor, región y herramienta de monitorización *[Completar al desplegar]*.
