# Ejecución del entrenamiento, registro de series y sincronización (V1 · bloque 2)

Este documento describe cómo funciona hoy la ejecución de una sesión: el modelo, los estados, la API de comandos, la cola local del móvil y los conflictos. La especificación de partida es `V1_SPEC.md` (§5.5–5.8 y §8.4). Las diferencias con ella están en `V1_SPEC.md` §9.3.

**Fuera del bloque 2:** tonelaje, 1RM, análisis de volumen, recomendaciones de progresión, autenticación real, servicios externos e integraciones. Nada de esto se calcula ni se muestra.

## 1. Recorrido y capas de datos

**Recorrido:** Hoy → detalle → «Empezar entrenamiento» → ejercicio → «Serie hecha» → descanso → siguiente serie o ejercicio → «Terminar sesión» → resumen. Desde cualquier punto se puede pausar, volver atrás, ir a otro ejercicio («Tu sesión») y continuar más tarde.

Cada dato pertenece a una de estas cinco capas:

| Capa                         | Dónde vive                                                                                        | Se puede cambiar                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **Prescripción original**    | `session_version`: cada versión publicada, inmutable (disparadores)                               | Nunca. Una versión nueva es otra fila                                                |
| **Ejecución registrada**     | `session_log` (una por sesión) y `set_log` (una fila por registro)                                | `set_log` solo admite añadir filas. Las marcas de inicio y de fin no se reescriben   |
| **Pendiente de sincronizar** | IndexedDB del navegador (`trainpro-ejecucion`, almacén `commands`)                                | Se borra al confirmarse. La interfaz lo marca «Pendiente de envío», nunca «guardado» |
| **Confirmado en servidor**   | Lo anterior, tras una transacción SQLite y la respuesta `200`                                     | Solo con una corrección                                                              |
| **Corrección posterior**     | Una fila nueva de `set_log` con `supersedes` = el registro que sustituye. La anterior se conserva | Hasta terminar la sesión                                                             |

## 2. Modelo de datos (migración `002-ejecucion`)

La migración `src/server/db/migrations/002-ejecucion.ts` reconstruye dos tablas de la `001`. SQLite no permite añadir una clave foránea ni cambiar un `CHECK` con `ALTER TABLE`.

**`session_log`**, una fila por sesión empezada:

| Columna                                                                                         | Para qué                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `started_version`                                                                               | La versión exacta con la que se empezó: clave foránea a `session_version (session_id, number)`. Las filas antiguas se rellenan con la última versión publicada antes del inicio |
| `started_at`, `start_device_at`, `start_time_zone`, `start_utc_offset_min`, `start_received_at` | Hora real del inicio (la del dispositivo, salvo que vaya adelantada: P-86), zona y desfase del móvil, y hora de recepción                                                       |
| `last_activity_at`                                                                              | Última serie, pausa o reanudación. Sirve para «En curso» frente a «Interrumpida»                                                                                                |
| `paused_at`, `paused_seconds`                                                                   | Pausa abierta y segundos acumulados en pausas. `paused_seconds` solo crece (disparador)                                                                                         |
| `finished_at`, `finish_*`, `finish_reason`, `pending_sets_confirmed`                            | Fin, motivo (`all_done` o `ended_early`) y series que quedaban al cerrar parcialmente                                                                                           |

**Disparadores de `session_log`:**

- el inicio y la versión de inicio no cambian;
- el fin se escribe una sola vez;
- las pausas solo suman;
- no se borra.

`CHECK`: una sesión terminada no puede estar en pausa.

**`set_log`**, un registro por serie (sin cambios en la `002`):

- **Identidad:** `client_set_id` único, generado en el móvil. Cada fila apunta a la ejecución, a la sesión, al cliente, a la versión (`version_number`), al ejercicio de esa versión (`prescription_id`), a la variante y al número de serie.
- **Datos:** `completed`, repeticiones, segundos, metros, carga según su modalidad, RIR y RPE (con su escala), observación, hora del dispositivo y de recepción.
- **Un solo original por serie:** índice parcial único sobre (ejecución, ejercicio, serie) cuando `supersedes IS NULL`.
- **Correcciones:** `supersedes` es único, así que cada serie forma una cadena lineal de correcciones. El registro efectivo es el que nadie sustituye.

**`client_command`**, idempotencia:

- **Columnas:** `command_id` (clave primaria), sesión, cliente, tipo (`start`, `log_set`, `pause`, `resume`, `finish`), `payload_hash` y hora de recepción.
- **Inmutable:** no se actualiza ni se borra.

**Procedimiento de reconstrucción (`rebuildsTables`):**

1. `PRAGMA foreign_keys = OFF` fuera de la transacción. Dentro, con las claves activas, el cambio de nombre de una tabla no vuelve a validar las referencias.
2. Migración dentro de `BEGIN IMMEDIATE`.
3. `PRAGMA foreign_key_check` debe salir vacío antes del `COMMIT`. Si no, se deshace todo.
4. Copia de seguridad automática antes de migrar (`antes-de-migrar`), como en la `001`.

Probado:

- con una base de la `001` con ejecuciones (`execution.test.ts`);
- sobre una copia de la base de las E2E: 38 ejecuciones y 428 series conservadas.

**Migración `003-procedencia`** (13 nov 2026; A-10 y A-14; ADR-28 y ADR-31). Solo añade columnas (`ALTER TABLE ADD COLUMN`) y un disparador; no reescribe filas:

| Tabla         | Columnas nuevas                                                                               | Para qué                                                                                                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `set_log`     | `origin`, `recorded_by`, `origin_method`                                                      | Procedencia de cada registro: `self_reported`, `direct`, `imported`, `calculated` o `estimated`; quién lo registró (`client`, `trainer`, `device`, `system`); método o fuente |
| `set_log`     | `clock_adjustment`                                                                            | Por qué se usó la hora de recepción: `ahead_of_server` o `before_lower_bound` (§7.1). La hora del dispositivo se sigue guardando aparte                                       |
| `session_log` | `origin`, `recorded_by`, `origin_method`, `start_clock_adjustment`, `finish_clock_adjustment` | Lo mismo para el inicio y el fin                                                                                                                                              |

- **Valores:** `origin` y `recorded_by` tienen `CHECK` con la lista cerrada. `origin_method` es obligatorio para lo importado, calculado o estimado. Los registros existentes son lo que eran: autodeclarados por el cliente (valores por defecto).
- **Inmutable:** disparador `session_log_provenance_is_immutable`; en `set_log` ya no se modifica nada.
- **Quién lo escribe:** el servidor, al aplicar el comando. No se deduce en la interfaz.
- **Registros antiguos con `clock_adjusted = 1`:** su motivo era `ahead_of_server`, el único que existía; se lee así sin reescribirlos.
- **Antes de migrar** se hace la copia automática `antes-de-migrar`.
- **Probado:** migración desde la `002` con datos, valores por defecto, disparador y `CHECK` (`execution.test.ts`).

**Fechas prevista y real, separadas:**

- `session.planned_date` es la fecha prevista.
- La fecha real es la local del inicio (`started_at` en la zona de la aplicación).
- `daysFromPlanned` da «(1 día después)» o «(2 días antes)».
- Se puede empezar cualquier día, varias sesiones el mismo día y sesiones de días anteriores.

## 3. Estados

### 3.1 Sesión

Se deducen de los registros (`executionStatus` en `src/domain/training/execution.ts`); no se guardan.

| Estado           | Condición                                                                  | Dónde se ve                                         |
| ---------------- | -------------------------------------------------------------------------- | --------------------------------------------------- |
| **Programada**   | Sin empezar y la fecha prevista es hoy o futura                            | Hoy, A3                                             |
| **Sin hacer**    | Sin empezar y la fecha ya pasó (se puede hacer)                            | «De días anteriores», A3                            |
| **En curso**     | Empezada, sin terminar, sin pausa y con actividad hoy                      | Hoy («Continuar entrenamiento · X de Y series»), A3 |
| **Pausada**      | Con una pausa abierta (la clienta pulsó «Pausar»)                          | Hoy, A3, reproductor («Reanudar»)                   |
| **Interrumpida** | Empezada, sin terminar, sin pausa y sin actividad hoy (se puede continuar) | Hoy o «De días anteriores», A3                      |
| **Completada**   | Todas las series de la versión vigente hechas                              | Resumen «¡Sesión completada!», A3, A7               |
| **Parcial**      | Terminada con series sin registrar o no realizadas, tras confirmarlo       | Resumen «Sesión terminada parcialmente», A3, A7     |

**Reglas:**

- **«Completada» exige todas las series.** Terminar con series pendientes devuelve `409 confirmation_required` y el número de series que faltan. El reproductor ofrece entonces «Seguir entrenando» o «Terminar igualmente (cierre parcial)».
- **Protagonista de Hoy** (aclaración del §3 B1): la sesión en curso, o una pausada o interrumpida que se previó para hoy o se tocó hoy. Si no hay ninguna, la de hoy sin empezar; si no, la de hoy terminada. Una pausada o interrumpida de otro día va a «De días anteriores» con «Continuar».
- **Otra sesión a medias (P-21):** al empezar una sesión con otra sin terminar, el reproductor lo avisa («Empezar igualmente» o ir a la otra).

### 3.2 Serie

**En el reproductor**, mientras se registra:

| Estado                 | Significado                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------- |
| **Pendiente de envío** | Guardada en el móvil, aún sin respuesta del servidor (sin conexión o esperando turno) |
| **Enviando…**          | Petición en curso                                                                     |
| **Confirmada**         | El servidor respondió `200`: está en SQLite                                           |
| **Error de envío**     | El servidor la rechazó (`4xx`), con el motivo y «Descartar y volver a registrar»      |

La barra de sincronización resume la cola:

- «Todo guardado en el servidor»;
- «N pendientes de envío», con «· sin conexión» si no hay red;
- «Enviando…»;
- «N registros con error de envío».

Hay «Reintentar» siempre que queda algo.

**En la revisión** (resumen de la clienta, B2 y A7), por serie:

- **Hecha**, **No realizada** o **Sin registrar**;
- «corregida», con «Antes: …» (el historial);
- diferencias en lenguaje claro: «≠ −2 rep.», «≠ +2 kg», «RIR 0 (previsto 2)».

## 4. Qué se registra según el ejercicio

Lo decide `performedFieldsFor` (`src/domain/training/performance.ts`), igual en el servidor y en el reproductor. El formulario llega relleno con lo prescrito, así que, si todo coincide, basta un toque.

| Prescripción              | Se registra                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Repeticiones              | Repeticiones (1–100)                                                                                                            |
| Tiempo (plancha)          | Segundos (1–3.600)                                                                                                              |
| Distancia (carrera)       | Metros (1–10.000) y, si se quiere, la duración                                                                                  |
| Carga externa (kg, rango) | Kg realizados (0,5–500)                                                                                                         |
| Peso corporal             | Nada de carga: no hay tonelaje                                                                                                  |
| Peso corporal + lastre    | Kg añadidos (0–200)                                                                                                             |
| Asistida                  | Kg de asistencia (0–200)                                                                                                        |
| Bandas u otra descripción | Un texto (hasta 120 caracteres), sin kg                                                                                         |
| RIR o RPE                 | Solo si el entrenador lo pidió, y siempre opcional: RIR entero de 0 a 10; RPE de 1 a 10 en pasos de 0,5, en la escala prescrita |
| Observación               | Opcional, hasta 300 caracteres                                                                                                  |

**«No la he hecho»** registra la serie como no realizada (`completed = 0`), sin datos y con una observación opcional.

**Prescripción por serie:** si es distinta en cada serie (por ejemplo, la tercera con 8 repeticiones), cada serie se valida y se compara con su propio objetivo.

El servidor valida lo mismo y responde `422 invalid` con los campos y sus mensajes.

## 5. API de comandos

Un manejador de rutas con URL estable: las acciones de servidor cambian de identificador al compilar y no sirven para una cola de reintentos (V1_SPEC §8.4).

**`POST /api/cliente/sesiones/{sessionId}/comandos`**

- **Petición:** un comando por petición, JSON, del mismo origen, como mucho 16 KB.
- **Campos comunes:** cada comando lleva `commandId` (generado en el móvil, el mismo en todos los reintentos), `clientId` (quién lo creó) y `device: { recordedAt, timeZone, utcOffsetMinutes }`.
- **Quién es el cliente:** sale siempre de la identidad del servidor. Además, el `clientId` del comando debe ser esa identidad: si no, `409 identity_mismatch` y no se aplica nada (A-08, ADR-27). `payload_hash` no incluye `clientId`.

```json
{ "commandId": "…", "clientId": "c-lucia", "type": "start", "versionNumber": 1, "device": { "recordedAt": "2026-11-12T17:00:00.000Z", "timeZone": "Europe/Madrid", "utcOffsetMinutes": 60 } }
{ "commandId": "…", "type": "log_set", "versionNumber": 1, "prescriptionId": "itm_…", "setNumber": 1, "supersedes": null,
  "completed": true, "reps": 10, "load": { "kind": "external", "kg": 16 }, "rir": 2, "rpe": null, "note": null, "device": { "…": "…" } }
{ "commandId": "…", "type": "pause", "device": { "…": "…" } }
{ "commandId": "…", "type": "resume", "device": { "…": "…" } }
{ "commandId": "…", "type": "finish", "confirmEndEarly": false, "comment": "Bien", "device": { "…": "…" } }
```

**`GET /api/cliente/sesiones/{sessionId}/estado`** devuelve el estado confirmado. Se pide al abrir, al volver a la pestaña y al recuperar la conexión.

**Respuestas:**

| HTTP  | Cuerpo                                           | Cuándo                                                                                                                                     |
| ----- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `200` | `{ ok: true, result: 'applied', state }`         | Aplicado ahora                                                                                                                             |
| `200` | `{ ok: true, result: 'already_applied', state }` | Ese comando ya estaba aplicado (reintento), o «empezar» una sesión ya empezada                                                             |
| `400` | `bad_request` (+ `issues`)                       | JSON roto o forma inválida (falta el identificador o el reloj, tipo desconocido…)                                                          |
| `403` | `forbidden_origin`                               | Sin `Origin` o con otro origen. Un `Host` ajeno lo para antes `proxy.ts`                                                                   |
| `404` | `not_found`                                      | La sesión no existe, no es del cliente o no está publicada (no se distingue)                                                               |
| `409` | `not_started`                                    | Registrar, pausar o terminar sin haber empezado                                                                                            |
| `409` | `closed`                                         | La sesión ya está terminada                                                                                                                |
| `409` | `set_already_logged` (+ `effective`)             | Otro registro original de esa serie (otro identificador sin `supersedes`)                                                                  |
| `409` | `not_effective` (+ `effective`)                  | Corrección de un registro que ya se había corregido                                                                                        |
| `409` | `command_id_reused`                              | El mismo identificador con otro contenido                                                                                                  |
| `409` | `unknown_version`, `unknown_set_in_version`      | La versión no existe, o la serie no existe en esa versión                                                                                  |
| `409` | `confirmation_required` (+ `pendingSets`)        | Terminar con series sin registrar sin `confirmEndEarly`                                                                                    |
| `409` | `identity_mismatch`                              | El comando lo creó otra identidad (móvil compartido). No se aplica; el móvil lo guarda para su titular                                     |
| `413` | `payload_too_large`                              | Más de 16 KB                                                                                                                               |
| `422` | `invalid` (+ `issues`)                           | Datos fuera de rango o que no corresponden a lo prescrito (kg en peso corporal, RIR no pedido…), o una hora del móvil imposible (T1, §7.1) |
| `503` | `storage_busy` (`Retry-After: 2`)                | Otra herramienta tiene la escritura de la base más de 1 s. No se aplicó nada; el móvil lo reintenta                                        |
| `503` | `storage_unavailable` (`Retry-After: 10`)        | La base o su bloqueo se borraron o sustituyeron por fuera. No se aplicó nada                                                               |
| `500` | `storage_error`                                  | Disco lleno, solo lectura, error de E/S o base dañada. No se aplicó nada                                                                   |
| `500` | `server_error`                                   | Error inesperado. El móvil lo reintenta                                                                                                    |

Las respuestas de error llevan `state` cuando la sesión es del cliente, para reconciliar. Los errores de almacenamiento (ADR-29) significan siempre que la transacción se deshizo entera: nada queda a medias ni se da por guardado.

### 5.1 Idempotencia

**En la aplicación:**

- El caso de uso (`executeClientCommand`, `src/server/services/client-execution.ts`) calcula `payload_hash`: SHA-256 de `canonicalJson({ sessionId, command })`.
- Antes de nada, solo valida lo que no cambia: las versiones publicadas son inmutables y la serie existe o no en una versión.
- Por eso un reenvío idéntico siempre llega a la comprobación de duplicados, aunque la sesión se haya cerrado después: responde `already_applied`, no `closed` (probado).

**En la base:**

- El repositorio (`src/server/repositories/sqlite/execution.ts`) hace, en una sola transacción `BEGIN IMMEDIATE`: buscar el `command_id`, aplicar el cambio y guardar el comando.
- Si el identificador ya existe con el mismo contenido → `already_applied`; con otro → `command_id_reused`.
- La clave primaria de `client_command` y el índice parcial de `set_log` impiden el duplicado aunque dos peticiones llegaran a la vez.
- Si algo falla dentro, no queda ni el comando ni la serie.

## 6. Cola local y sincronización (el móvil)

**Almacén:** IndexedDB, base `trainpro-ejecucion` (`src/features/client/player/local-store.ts`), con dos almacenes:

- `commands`: los comandos pendientes, cada uno con su titular (`clientId`), con los índices `bySession` y `byOwnerSession` (versión 2 de la base, A-08);
- `ui`: la hora de fin del descanso y la posición en el reproductor, por persona y sesión.

Si el navegador no permite IndexedDB, el almacén pasa a memoria y se muestra un aviso permanente: «Este navegador no puede guardar temporalmente: no cierres la página hasta ver "Todo guardado"».

**Reglas** (`sync-engine.ts`, `use-execution-sync.ts`):

1. **Escribir antes de enviar.** Cada comando se guarda en IndexedDB y después se envía.
2. **En orden y de uno en uno.** Orden de creación, con un cerrojo por sesión: nunca hay dos envíos a la vez de la misma cola.
3. **Solo se borra con `200`.** El estado que devuelve el servidor manda sobre lo local.
4. **Fallo de red, `5xx` o tiempo agotado (15 s):** el comando sigue en el móvil y se reintenta solo, con el mismo identificador, a los 2, 4, 8, 16 y 30 s.
5. **Abrir, recuperar la conexión, volver a la pestaña o «Reintentar»** anulan esa espera: se intenta ya.
6. **Rechazo `4xx`:** no se descarta en silencio. Queda como «Error de envío», con el motivo.
   - Si el error es **recuperable** (`server_error`, `storage_busy`, `storage_unavailable`, `not_found`, `not_started`, `http_404`, `http_408` o `http_429`), «Reintentar» lo vuelve a poner en cola con su **identificador original**, así que no puede duplicarse (A-09, ADR-27).
   - Si no lo es, queda hasta que la clienta lo descarta y vuelve a registrar.
7. **`set_already_logged`:** se reconcilia. Se quita de la cola, se muestra lo que tiene el servidor y se avisa: «Esa serie ya estaba registrada…».
8. **Al salir:** si queda algo sin confirmar, el navegador avisa al cerrar la pestaña. «Pausar» espera al primer intento de envío antes de volver a Hoy.
9. **Fuera del reproductor:** `PendingSync` (Hoy, Semana, Progreso y el detalle) envía lo que quedó pendiente al abrir, al recuperar la conexión, al volver a la pestaña y cada 30 s, y refresca la pantalla cuando se confirma.
10. **Un comando que se estaba enviando al cerrar** vuelve a «pendiente» al abrir. Si el servidor ya lo tenía, responde `already_applied`.
11. **Cada persona, su cola** (A-08, ADR-27). La cola solo lista y envía los comandos de la identidad actual.
    - Lo de otra persona se queda en el dispositivo, sin enviarse, y Hoy, Semana y Progreso lo dicen: «Hay … de otra persona en este dispositivo. Se enviarán cuando esa persona vuelva a entrar.».
    - Si la identidad cambia en otra pestaña y el servidor responde `identity_mismatch`, el comando sigue guardado para su titular.
    - Los comandos antiguos sin titular solo los adopta la persona de esa sesión.
    - Nadie puede descartar lo de otra persona.

**Descanso:**

- Empieza al registrar la serie y se calcula con la hora de fin guardada, así que sobrevive a recargar, a cambiar de pantalla y a bloquear el móvil.
- Controles: −15 s y +15 s, «Pausar»/«Seguir», «Reiniciar» y «Saltar descanso». Vibra una vez al terminar.

**Doble toque:** el formulario de la serie y el descanso no aceptan toques en sus primeros 400 ms (`aria-disabled`, `use-armed.ts`). Así, el segundo toque de un doble toque en «Serie hecha» no registra la serie siguiente ni salta el descanso.

## 7. Conflictos

| Caso                                                     | Qué pasa                                                                    | Prueba                                                        |
| -------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Reenvío del mismo comando (respuesta perdida, reintento) | `200 already_applied`: una sola serie                                       | `execution.test.ts`, E2E «respuesta perdida», B2-API          |
| Misma serie con otro identificador                       | `409 set_already_logged` con el registro efectivo. El móvil se reconcilia   | `execution.test.ts`, E2E-23                                   |
| Mismo identificador, otro contenido                      | `409 command_id_reused`: no se reinterpreta                                 | `execution.test.ts`, B2-API                                   |
| Serie inexistente o de otra versión                      | `409 unknown_set_in_version` / `unknown_version`                            | `execution.test.ts`                                           |
| Sesión de otra persona                                   | `404 not_found`, sin revelar si existe. Lo mismo para leer el estado        | `execution.test.ts` (Marta y Lucía), B2-API                   |
| Datos fuera de rango o de otra modalidad                 | `422 invalid` con cada campo. El formulario lo muestra antes de enviar      | `performance.test.ts`, `execution.test.ts`, `client-app.spec` |
| Sesión cerrada                                           | `409 closed`. Un reenvío de algo ya aplicado sigue siendo `already_applied` | `execution.test.ts`                                           |
| Terminar con series pendientes                           | `409 confirmation_required`. Solo con `confirmEndEarly` queda «Parcial»     | `execution.test.ts`, E2E «cierre parcial»                     |
| El entrenador publica otra versión a media sesión        | Ver §8                                                                      | `execution.test.ts` (v2 a media ejecución)                    |
| Reloj del móvil adelantado                               | Se usa la hora de recepción y se anota el motivo (T2, §7.1)                 | `v2.test.ts`, `execution.test.ts`                             |
| Reloj anterior a la publicación o al inicio              | Se usa la hora de recepción y se anota el motivo (T3)                       | `v2.test.ts`, `execution.test.ts`, E2E A-10                   |
| Hora del móvil imposible (antes de 2020 o desde 2100)    | `422 invalid`, sin aplicar nada (T1)                                        | `execution.test.ts`                                           |
| Pasada la medianoche o reanudada al día siguiente        | Se acepta con su hora; la sesión conserva su día previsto (T4)              | E2E-19, `execution.test.ts`                                   |
| Comando de otra persona (móvil compartido)               | `409 identity_mismatch`: no se aplica a nadie                               | `execution.test.ts`, B2-API, E2E A-08                         |
| Base ocupada por otra herramienta                        | `503 storage_busy` en menos de 2,5 s, sin aplicar nada; se reintenta        | `execution.test.ts`                                           |

### 7.1 Reglas de la hora de ejecución (A-10, ADR-28)

No se confía ciegamente en el reloj del móvil, pero tampoco se impone la hora del servidor a lo que se registró sin conexión. Para cada comando, con `device.recordedAt` (dispositivo) y la hora de recepción en el servidor:

| Regla  | Condición                                                                                                                                                       | Hora que se usa    | Se anota             |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | -------------------- |
| **T1** | Antes del 1 de enero de 2020 o desde 2100: imposible (reloj perdido)                                                                                            | Ninguna: `422`     | —                    |
| **T2** | Posterior a la recepción: el reloj va adelantado                                                                                                                | Recepción          | `ahead_of_server`    |
| **T3** | Más de 5 min antes del límite inferior: la **publicación de la versión** para el inicio; el **inicio de la ejecución** para series, pausas, reanudaciones y fin | Recepción          | `before_lower_bound` |
| **T4** | En cualquier otro caso                                                                                                                                          | La del dispositivo | —                    |

- **Lo legítimo se acepta (T4):** lo registrado sin conexión horas antes, lo que pasa de la medianoche y una sesión reanudada al día siguiente.
- **Siempre se guardan** la hora del dispositivo, su zona y su desfase, la recepción y el motivo del ajuste (migración `003`), para auditar cualquier discrepancia. El entrenador ve «hora de llegada (el reloj del móvil iba adelantado)» o «(… marcaba una hora imposible, anterior)».
- **Zonas horarias:** los instantes son UTC, así que un cambio de zona no altera el orden. La fecha local de cada registro se calcula con su propia zona; la fecha real de la sesión es la local de su inicio.
- **Fecha prevista y real:** se guardan por separado (`planned_date` frente a `started_at`).
- **Por qué 5 min:** cubren la deriva normal entre relojes sin sincronizar.
- **Código:** `resolveExecutionInstant` en `src/domain/training/execution.ts`.

## 8. Versiones durante la ejecución

La prescripción de una sesión empezada **nunca cambia en silencio**:

- **La versión de inicio queda guardada** (`started_version`). Cada serie guarda la versión con la que se registró.
- **Si Alex publica la v2**, el reproductor lo detecta en la siguiente respuesta del servidor y avisa: «Alex ha actualizado la sesión. Lo que ya has registrado no cambia. Mientras no la abras, sigues con la versión que tienes en pantalla».
  - «Ver la versión nueva» carga la v2.
  - Hasta entonces, las series se registran con la v1. El servidor las acepta si la serie existe en la v1 (S-07).
- **A7 y la revisión** comparan cada serie con la versión con la que se registró y dicen «empezada con la v1 · series registradas con v1 y v2».
- **Una serie de una versión anterior** que ya no existe en la vigente se lista como «Fuera de la versión vigente».

Editar una sesión publicada desde la interfaz es el bloque 5: hoy la v2 solo se publica desde el servicio (las pruebas lo hacen así).

## 9. Lo que ve el entrenador

**A3 (sesiones de la clienta):** cada sesión con su estado (Programada, Sin hacer, En curso, Pausada, Interrumpida, Completada o Parcial), «X de Y series» y, si se empezó otro día, «Hecha el … (1 día después)».

**A7 (sesión publicada) · «Ejecución: prescrito frente a realizado»:**

- **Cabecera:** series hechas, no realizadas y sin registrar; versiones; duración (con y sin pausas); cierre («Completada» o «Cerrada parcialmente por la clienta»); el mensaje final de la clienta.
- **Por ejercicio y serie:** lo previsto, lo hecho, las diferencias, la hora, la versión y las correcciones con lo anterior.
- **Ejemplo** (sentadilla goblet 3 × 10 · 16 kg · RIR 2):
  - serie 1: hecho 10 × 16 kg · RIR 2;
  - serie 2: 10 × 16 kg · RIR 1, «≠ RIR 1 (previsto 2)»;
  - serie 3: 8 × 16 kg · RIR 0, «≠ −2 rep. · RIR 0 (previsto 2)».

**Lo pendiente en el móvil no lo ve:** está solo en el móvil de la clienta. A7 lo dice mientras la sesión no está cerrada: «Solo se muestra lo confirmado por el servidor…».

## 10. Pruebas

| Dónde                                                             | Qué cubre                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/training/performance.test.ts` (15)                    | Campos por tipo de ejercicio, validación, valores por defecto, diferencias, sin tonelaje                                                                                                                                                                                                                                           |
| `src/server/services/execution.test.ts` (16)                      | Inicio y versión; registro y reenvío; `command_id_reused`; `set_already_logged`; correcciones; `422`/`409`; pausas; cierre parcial y reenvío tras cerrar; completada y revisión; v2 a media ejecución; permisos; nota privada; transacción fallida; índice parcial; reapertura de la base; migración desde la `001`; forma (`400`) |
| `src/server/services/execution.test.ts` (A-08, T1–T4, A-14, A-11) | Identidad en cada comando; reglas de la hora; procedencia en la base y en la vista; base ocupada (`storage_busy` en menos de 2,5 s y reintento una vez); migración `003`                                                                                                                                                           |
| `src/server/db/db.test.ts`                                        | Migraciones `[1, 2, 3]`, sumas de comprobación, copias y restauración                                                                                                                                                                                                                                                              |
| `e2e/client-execution.spec.ts` (16, Pixel 7)                      | Recorrido Alex → Lucía → Alex; cerrar y reabrir el navegador; sin conexión; recarga con pendientes; respuesta perdida y duplicados; cierre parcial; pausa; corrección; 360 px, teclado y accesibilidad; E2E-2, 4, 5, 18, 19, 21 y 22                                                                                               |
| `e2e/client-app.spec.ts`                                          | Registrar con pocas acciones, validación y «Completada» solo con las 16 series; lo que pide cada ejercicio: plancha en segundos sin kg, paseo del granjero en metros con tiempo opcional y carga descrita                                                                                                                          |
| `e2e/client-execution.spec.ts` (A-08, A-09, A-10)                 | Móvil compartido: lo pendiente de Marta nunca se envía como de Lucía y se envía al volver Marta; «Reintentar» de un error recuperable (una sola serie); reloj anterior a la publicación                                                                                                                                            |
| `e2e/execution-api.spec.ts`                                       | Origen (`403`), tamaño (`413`), forma (`400`, también sin `clientId`), idempotencia, `command_id_reused`, `identity_mismatch` y sesión ajena (`404`)                                                                                                                                                                               |
| `e2e/restart.spec.ts`                                             | `SIGKILL` a media sesión: lo confirmado sigue, lo registrado con el servidor caído se envía al volver y en SQLite hay una fila por serie y un comando por operación. A-04: `SIGKILL` con 8 escritores concurrentes, sin nada a medias ni duplicados, y reenviar todo da `already_applied` a lo confirmado                          |
| `e2e/responsive.spec.ts`                                          | Detalle B2, inicio del reproductor y A7 con ejecución, en móvil y escritorio                                                                                                                                                                                                                                                       |

## 11. Limitaciones conocidas

- **Lo pendiente vive en el navegador.** Se pierde si se borran los datos del sitio o se cambia de móvil antes de que se confirme. Lo confirmado nunca se pierde.
- **No se pide almacenamiento persistente** (`navigator.storage.persist()`). Firefox lo pregunta a la persona, y conviene decidir cuándo pedirlo. Safari puede borrar IndexedDB si la web pasa unos días sin usarse.
- **Sin IndexedDB** (algunas navegaciones privadas) la cola está en memoria, con aviso permanente: cerrar la página pierde lo no enviado.
- **Una sola pestaña o dispositivo a la vez.** Dos dispositivos que registran la misma serie se resuelven con `set_already_logged` (gana el primero). No hay mezcla de ediciones.
- **Lo pendiente de otra persona** en un móvil compartido solo se envía cuando esa persona vuelve a entrar en ese móvil. Mientras, sigue guardado y se ve el aviso.
- **No funciona sin conexión desde cero.** El service worker no guarda las páginas para abrirlas sin red: sin conexión muestra la página «Sin conexión». Si la página ya está abierta, se puede empezar, registrar, pausar y terminar sin conexión, y todo se envía al volver.
- **Windows no se ha probado en Windows.** Ver `V1_SPEC.md` §9.3: `pnpm verify:env` está listo para ejecutarlo allí.
- **La v2 durante la ejecución** solo se puede publicar desde el servicio (bloque 5).
- **Historial de Git:** el commit `e8c3bd1` borró el reproductor antiguo antes de añadir el nuevo (`c52849e`), así que `e8c3bd1` no compila por sí solo. No se ha reescrito el historial.

## 12. Probarlo en local

```bash
pnpm install
pnpm dev                     # http://127.0.0.1:3000 · datos en .data/trainpro.sqlite
```

1. «Entrar como Alex, entrenador» → Clientes › Lucía Gil › Sesiones → «Planificar una sesión» para hoy con un ejercicio con kg y RIR → «Publicar versión 1».
2. «Cambiar» → «Entrar como Lucía, clienta» (mejor en el móvil o en el modo móvil del navegador) → «Empezar entrenamiento».
3. Registra series, prueba el descanso, quita la conexión (DevTools › Network › Offline) y registra otra: queda «Pendiente de envío». Vuelve la conexión: «Confirmada».
4. Cierra y abre la pestaña: Hoy ofrece «Continuar».
5. Termina (también parcialmente) y entra como Alex: A7 compara prescrito y realizado.

Configuración muestra la ruta real de la base. «Restablecer datos demo» vuelve a la semilla y antes hace una copia.
