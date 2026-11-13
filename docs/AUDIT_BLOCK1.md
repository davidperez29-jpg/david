# Auditoría técnica del bloque 1 y del estado real del bloque 2

**Fecha:** 13 de noviembre de 2026 · **Rama:** `claude/vigilant-bardeen-qfycp4` (`a5799dd`)

**Alcance:** entorno, persistencia, integridad, migraciones, copias, constructor, sesiones y versiones, y seguridad local. Incluye una especificación del bloque 2 contrastada con el código y criterios de aceptación verificables.

> **Actualización (13 nov 2026, PROMPT 14):** las correcciones R1–R11 están aplicadas y probadas. El estado de cada problema, con su causa raíz, la solución y las pruebas, está en el **§15**. Lo que sigue (§1–§14) es el registro original de la auditoría.

**Sin cambios de código:** las pruebas se han hecho con scripts propios en un directorio temporal, contra servidores de producción arrancados aparte con datos ficticios en `.data/auditoria/`. No se ha tocado la base principal ni ningún archivo del proyecto salvo esta documentación.

> **Contradicción de partida.** El encargo de esta auditoría (PROMPT 13) da por hecho que el bloque 2 no existe. En la rama sí existe: se implementó con el PROMPT 11 (commits `c8c0d90` a `a5799dd`; `EXECUTION.md`, `V1_SPEC.md` §9.3). No se ha retirado ni modificado. Esta auditoría lo trata como parte del estado real. Por eso el §11 contrasta tus requisitos del bloque 2 con lo que ya hay, en lugar de redactar otra especificación que duplicaría `EXECUTION.md`. Qué hacer con él es una decisión tuya (§14).

**Leyenda de evidencias** (se usa en todo el documento):

| Marca | Significado                                                              |
| ----- | ------------------------------------------------------------------------ |
| **P** | Comprobado mediante pruebas ejecutadas en esta auditoría o en la batería |
| **I** | Comprobado mediante inspección del código                                |
| **D** | Documentado, pero no verificado                                          |
| **N** | No implementado                                                          |
| **?** | Pendiente de decisión                                                    |

## 1. Entorno y dependencias

| Elemento                           | Valor real                                                                                                                                              | Evidencia y valoración                                                                                                                                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js                            | **26.13.1**, `process.release.lts = "Lithium"` (LTS activa). `.nvmrc` 26.13.1, `engines` `>=26.13.1 <27`, `engine-strict=true`                          | **P.** Adecuada: LTS hasta el 30-04-2029. Los scripts `.ts` se ejecutan con Node sin compilador y sin avisos experimentales (se cargó `location.ts` sin `ExperimentalWarning`)                                                                 |
| pnpm                               | 10.28.0 (Corepack 0.36.0)                                                                                                                               | **P**                                                                                                                                                                                                                                          |
| Next.js                            | 16.4.5 (hay 16.4.6, del 9-11, parche)                                                                                                                   | **P.** `pnpm audit --prod`: «No known vulnerabilities found»                                                                                                                                                                                   |
| React                              | 19.3.1                                                                                                                                                  | **P**                                                                                                                                                                                                                                          |
| TypeScript                         | 6.0.3 (hay 7.0.2, versión mayor)                                                                                                                        | **P.** Sin motivo para cambiar ahora                                                                                                                                                                                                           |
| SQLite                             | **3.53.4**, vía `better-sqlite3` 13.0.3                                                                                                                 | **P.** Opciones: `THREADSAFE=2`, `DEFAULT_SYNCHRONOUS=2`, FTS5. El binario es N-API 10 (`prebuilds/linux-x64.node`), estable entre versiones de Node, no ligado al ABI 147 de Node 26. Incluye `win32-x64` y `win32-arm64` (**no ejecutados**) |
| Configuración de la conexión       | WAL, `synchronous=FULL`, `foreign_keys=ON`, `busy_timeout=5000`, `BEGIN IMMEDIATE`                                                                      | **I** (`src/server/db/sqlite.ts`) y **P** (pruebas del §2)                                                                                                                                                                                     |
| Persistencia, migraciones y copias | Sin dependencias extra: migraciones propias con SHA-256, API de copia de SQLite y `copyFileSync`                                                        | **I**                                                                                                                                                                                                                                          |
| `pnpm verify:env`                  | Todo correcto: Node, carga del binario, migraciones 1 y 2, integridad, claves ajenas, copia y restauración, persistencia al reabrir                     | **P**                                                                                                                                                                                                                                          |
| `pnpm audit` (todas)               | 1 moderada, **solo en desarrollo**: `minimatch` vía `eslint` (GHSA-g3hv-75wg-m249)                                                                      | **P.** No llega al servidor ni al navegador                                                                                                                                                                                                    |
| `pnpm outdated`                    | Parches: `next` 16.4.6 y `better-sqlite3` 13.1.1 (publicada el 11-11, hace 2 días). Menores: `@playwright/test` 1.65, `vitest` 5.1… Mayor: TypeScript 7 | **P.** Nada urgente. La política de §8.7 de `V1_SPEC.md` aconseja esperar a que una versión tenga unas semanas                                                                                                                                 |
| Dependencias experimentales        | Ninguna en producción. `node:sqlite` (la alternativa) sigue siendo _release candidate_                                                                  | **I**                                                                                                                                                                                                                                          |

**Valoración.**

- **Mantenibilidad:** la solución es mantenible para el prototipo. Un solo módulo importa el controlador (regla de ESLint), y el SQL es portable a PostgreSQL.
- **Límite estructural:** `better-sqlite3` es **síncrono**. Mientras espera un bloqueo de escritura, todo el servidor se detiene (A-11). Con un solo proceso y pocas personas no es un problema; para varios entrenadores a la vez sería otra arquitectura (PostgreSQL, Fase 2).

**Batería existente (ejecutada hoy):**

| Batería         | Resultado                                                                                                                                                                                                                                       |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`    | Formato, lint, tipos y compilación correctos; **233 de 233** pruebas unitarias y de integración (19 archivos)                                                                                                                                   |
| `pnpm test:e2e` | **119 pasan, 2 fallan, 2 se omiten.** Las 2 fallas son la misma prueba (`responsive.spec.ts`, «B2 · detalle…») en escritorio y móvil, y dependen del día (A-13). Las 2 omitidas son pruebas solo para móvil, saltadas a propósito en escritorio |

## 2. Persistencia real

Todas las pruebas de esta sección usan servidores de producción propios (`next start`, modo `local-demo`) y la API real. Las comprobaciones se hacen leyendo SQLite directamente.

### 2.1 Cortes bruscos con escrituras en curso (P1)

**Prueba:**

1. Ocho clientes simultáneos envían comandos de ejecución.
2. El servidor se mata con `SIGKILL` a mitad (tres veces) y se vuelve a arrancar.
3. Después se reenvían todos los comandos.

| Ronda                                                    | Confirmados (200) | En la base    | Perdidos tras confirmar | A medias | Duplicados | Integridad                   |
| -------------------------------------------------------- | ----------------- | ------------- | ----------------------- | -------- | ---------- | ---------------------------- |
| 79 inicios y series; corte a 350 ms                      | 58                | 59            | **0**                   | 0        | 0          | ok, 0 claves rotas           |
| 592 correcciones encadenadas; cortes a 250, 500 y 800 ms | 25 → 89 → 220     | 25 → 90 → 220 | **0**                   | 0        | 0          | ok                           |
| Reenvío de todo (dos veces)                              | 79 + 592          | 79 + 592      | 0                       | 0        | 0          | ok · todos `already_applied` |

- **Lo que demuestra:** en los dos cortes en que la base tenía una fila más que las confirmadas, el comando se aplicó entero aunque el cliente se quedó sin respuesta, y el reenvío lo reconoció como `already_applied`. Cada una de las 74 series conserva un único registro efectivo al final de cada cadena.
- **Límite de la prueba:** `SIGKILL` simula la caída del proceso, **no un corte de corriente**. `synchronous=FULL` está pensado para eso, pero no se puede probar aquí.

**También comprobado por la batería:**

- persistencia al recargar, al cerrar y abrir el navegador, y tras reiniciar con `SIGTERM` y `SIGKILL` (`restart.spec.ts` B1-01 y B2);
- ausencia de duplicados (`sessions.spec.ts` B1-07; contrato del repositorio).

### 2.2 Error de escritura (P2)

**Prueba:** otro proceso reserva la escritura en SQLite (`BEGIN IMMEDIATE`) durante 8 s mientras se registra una serie.

| Comprobación                                                    | Resultado                                                                                      |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Respuesta de la API                                             | `500 server_error` «No se ha podido guardar. Se reintentará.», a los 5.024 ms (`busy_timeout`) |
| Estado de la base                                               | **0** comandos y **0** series de esa operación: nada a medias                                  |
| Reintento con el mismo identificador                            | `200 applied`; el siguiente, `200 already_applied`; 1 serie; integridad ok                     |
| Otra petición al mismo servidor durante el bloqueo (la portada) | **4.749 ms**: todo el servidor estuvo parado (A-11)                                            |

**Fallo a mitad de una operación:** la prueba de integración «un comando que falla en la base no deja nada a medias» inyecta el fallo dentro de la transacción y verifica que no queda ni la serie ni el comando (**P**). Las escrituras del entrenador (crear, guardar, publicar, reordenar, eliminar) van en `db.transaction` (`src/server/repositories/sqlite/training.ts`; **I**).

### 2.3 Integridad y restricciones (P3)

Escrituras inválidas directamente en SQL sobre una copia, saltándose la aplicación:

| Intento                                                                        | Resultado                                                                                                 |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Modificar o borrar una versión publicada                                       | Rechazado (disparador «session_version solo admite añadir filas»)                                         |
| Modificar o borrar una serie registrada                                        | Rechazado (disparador)                                                                                    |
| Segundo registro **original** de la misma serie                                | Rechazado (índice único parcial `set_log_one_original`)                                                   |
| Serie de una ejecución o de una versión inexistentes                           | Rechazado (clave ajena)                                                                                   |
| Serie de otro cliente sobre la ejecución de Marta                              | Rechazado (clave ajena compuesta)                                                                         |
| Repeticiones fuera de rango (500)                                              | Rechazado (`CHECK`)                                                                                       |
| Cambiar la versión de inicio, reducir el tiempo en pausa, borrar una ejecución | Rechazado (disparadores)                                                                                  |
| Comando de tipo desconocido; modificar un comando                              | Rechazado (`CHECK`; disparador)                                                                           |
| Sesión de un cliente o entrenador inexistentes                                 | Rechazado (clave ajena)                                                                                   |
| **Serie con un ejercicio que no existe en su versión**                         | **Aceptada**: la prescripción es JSON y la base no puede comprobarlo; solo lo valida la aplicación (A-19) |
| **Sesión con fecha imposible (2026-13-45)**                                    | **Aceptada**: el `CHECK` solo comprueba el formato (A-19)                                                 |

**Disparadores existentes:** `session_version_no_update/no_delete`, `set_log_no_update/no_delete`, `set_log_correction_same_set`, `session_log_start_is_immutable`, `session_log_finish_once`, `session_log_paused_seconds_only_grow`, `session_log_no_delete`, `client_command_no_update/no_delete`.

### 2.4 Migraciones (P4)

| Comprobación                             | Resultado                                                                                                                                                                                                                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Migraciones existentes                   | `001-v1` y `002-ejecucion` (reconstruye dos tablas). Cada una en su transacción, con SHA-256 en `schema_migrations` (**I**)                                                                                                                                              |
| De la 001 a la 002 con datos             | Pruebas de integración (`db.test.ts`, `execution.test.ts`) y una copia real de la base E2E del bloque 2: 38 ejecuciones y 428 series conservadas (**P**)                                                                                                                 |
| Copia antes de migrar                    | `beforeMigrate` crea `antes-de-migrar` si la base ya tenía migraciones (**P** en integración; **I**)                                                                                                                                                                     |
| Migración modificada tras aplicarse      | El servidor **se niega**: «La migración 2 (ejecucion) ha cambiado después de aplicarse» (**P**)                                                                                                                                                                          |
| Base de una versión futura (migración 3) | Se niega: «… que este código no conoce» (**P**)                                                                                                                                                                                                                          |
| Base dañada (truncada a la mitad)        | `SqliteError: database disk image is malformed` (**P**)                                                                                                                                                                                                                  |
| Lo que ve la persona en esos tres casos  | **Página genérica «Algo no ha ido bien» (HTTP 500) en todas las pantallas**; el motivo solo está en el registro del servidor (A-15)                                                                                                                                      |
| Una actualización futura del modelo      | Solo hacia delante. Una migración que reconstruye tablas usa `rebuildsTables`: claves ajenas desactivadas fuera de la transacción y `foreign_key_check` vacío antes de confirmar. No hay migraciones hacia atrás: se vuelve atrás con la copia `antes-de-migrar` (**I**) |

### 2.5 Recuperación

| Situación                                | Resultado                                                                                                                                             |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| El servidor muere durante una escritura  | Cada operación se aplica entera o no se aplica; las confirmadas se conservan (§2.1, **P**)                                                            |
| Error de escritura                       | Respuesta tipada, nada a medias, reintento idempotente (§2.2, **P**). **En el constructor, el mismo error hace perder el trabajo** (A-05)             |
| Riesgo de corrupción o pérdida           | No apareció en el uso normal ni con cortes del proceso. **Sí aparece al restaurar copias y con dos servidores sobre la misma base** (§3, A-01 a A-04) |
| Borrar `.data` con el servidor en marcha | El servidor siguió aceptando datos sobre archivos ya borrados, sin aviso: se pierden al pararlo. Se observó por accidente en esta auditoría (A-20)    |

## 3. Copias de seguridad y restauración

**Dónde y cómo.** Las copias se guardan en `<carpeta de la base>/backups/` y se crean de tres formas (**I**):

- `pnpm db:backup` o «Hacer una copia ahora» (Configuración), con la API de copia en línea de SQLite;
- automáticamente antes de migrar y de restablecer (`snapshotSync`: vuelca el WAL y copia el archivo);
- antes de restaurar, con `copyFileSync` y **sin volcar el WAL**.

Cada copia nueva se verifica: `integrity_check`, `foreign_key_check` y migraciones iguales a las del código. Incluyen la base completa (todas las tablas). No hay copias programadas ni rotación.

| Prueba                                                                             | Resultado                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B1 · Tres copias en caliente** con escrituras en curso                           | Las tres: integridad ok, 0 claves rotas, 0 comandos sin su serie, recuentos crecientes (495 → 562 → 623 series). **P**                                                                                                                                                                                           |
| **B2 · Restaurar con el servidor en marcha**                                       | Se niega: «El servidor (proceso …) tiene la base abierta». **P**                                                                                                                                                                                                                                                 |
| **B3 · Restaurar recupera los datos** (servidor parado con `SIGTERM`)              | Antes: 623 series y 189 comandos. Copia: 495 y 61. Después: **exactamente 495 y 61**, íntegra. El servidor arranca y sirve esos datos. «antes-de-restaurar» guarda los 623 y 189. **P**                                                                                                                          |
| **B4 · Copias dañadas** (bytes alterados, truncada, no es SQLite)                  | Las tres se rechazan antes de tocar nada («La copia no está íntegra», «malformed», «file is not a database»); la base queda intacta (mismo SHA-256). **P**                                                                                                                                                       |
| **B5 · Restaurar después de un corte brusco**                                      | 20 series confirmadas (`200`) solo en el WAL (700 KB) y `SIGKILL`. Restaurar crea «antes-de-restaurar» **sin ninguna de las 20** y borra el WAL: **se pierden**, aunque la herramienta dice «El estado anterior quedó guardado». **P** (A-01)                                                                    |
| **B6 · Restauración interrumpida** (`SIGKILL` en momentos distintos; 320 intentos) | 190 sin cambios; 125 completas; **4 dejaron una base que no se abre** (`SQLITE_CORRUPT` o `SQLITE_ERROR`); **1 dejó una base distinta de la original y de la copia que pasa `integrity_check`** (no se pudo reproducir para analizarla). En los 5 había «antes-de-restaurar» para recuperar a mano. **P** (A-02) |
| **S · Dos servidores sobre la misma base**                                         | No se impide. A y B escriben bien. Cuando A hace «Restablecer datos demo», B sigue respondiendo `200 applied`, pero escribe en el archivo anterior, ya sustituido: esas escrituras **no están en la base**, y tras parar los dos siguen sin estar. **P** (A-03)                                                  |
| **S2 · La marca `.pid`**                                                           | B la sobrescribe con su número y la borra al parar, aunque A sigue en marcha. `db:restore` se ejecuta entonces con A usando la base. **P** (A-04)                                                                                                                                                                |
| Permisos                                                                           | Base `600`; **copias `644`**, legibles por otros usuarios del equipo. **P** (A-16)                                                                                                                                                                                                                               |
| Archivos de más                                                                    | Al verificar una copia se abre en modo WAL y quedan `-wal` y `-shm` junto a ella en `backups/`. **P** (A-17)                                                                                                                                                                                                     |

**Conclusión:** crear copias y restaurarlas en condiciones normales **funciona y está verificado**. La restauración **no es segura** ni tras un corte brusco ni si se interrumpe, y la protección de «un solo servidor» se puede saltar.

## 4. Constructor y borradores

| Elemento                                                                   | Dónde vive                                                                                         | Evidencia |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------- |
| Datos generales de la sesión (fecha, contexto, título, objetivo, duración) | **Se guardan** al pulsar «Crear borrador» (A4)                                                     | **P**     |
| Ejercicios, series, carga, esfuerzo, descanso, tempo, notas (A5)           | **Solo en memoria** hasta pulsar «Guardar» o «Publicar». No hay guardado automático ni copia local | **P**     |
| Indicador                                                                  | «Cambios sin guardar» / «Guardando…» / «Borrador guardado · 08:55». Visible y correcto             | **P**     |

| Situación                                                   | Resultado                                                                                           |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Recargar con cambios sin guardar                            | El navegador avisa (`beforeunload`). Si se acepta, el ejercicio añadido se pierde (0 tras recargar) |
| Cerrar la pestaña con cambios sin guardar                   | El navegador avisa (`beforeunload`)                                                                 |
| **Ir a otra sección desde el menú** con cambios sin guardar | **Sin aviso.** Se pierden (0 ejercicios al volver) (A-06)                                           |
| Guardar y recargar                                          | Se conserva (1 ejercicio)                                                                           |
| Dos pestañas sobre el mismo borrador                        | La segunda en guardar ve «Hay una versión más reciente de este borrador» y no pisa la primera       |
| **Error del servidor al guardar** (base bloqueada)          | **Toda la página pasa a «Algo no ha ido bien… Reintentar» y se pierde lo no guardado** (A-05)       |
| Cierre forzoso del navegador o caída del equipo             | Se pierde lo no guardado: no hay copia local (A-07, **I**)                                          |

Todo lo anterior es **P** salvo donde se indica.

**Propuesta (sin implementar):**

1. **Guardado automático en el servidor:** de 2 a 3 s después del último cambio, con la revisión que ya existe para no pisar otra pestaña. Un fallo no borra nada.
2. **Errores tipados en las acciones de guardar y publicar:** `{ ok: false, reason: 'storage_error' }`, nunca una excepción que tire la página. El contenido se queda en pantalla, con «No se ha podido guardar · Reintentar».
3. **Copia local del borrador** en el navegador por sesión y revisión, con «Tienes cambios sin guardar de las 10:32 · Recuperar / Descartar» al volver.
4. **Aviso en la navegación interna** mientras haya cambios sin guardar (o guardar antes de salir, gracias al punto 1).
5. **Pruebas E2E** de cada caso de la tabla.

## 5. Sesiones y versiones

| Requisito                                              | Estado                                                                                                                                                                                                                                              | Evidencia                                                                                            |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Varias sesiones en un mismo día                        | Sí                                                                                                                                                                                                                                                  | **P** (`sessions.spec` B1-03; integración B1-03)                                                     |
| Fecha prevista y fecha real distintas                  | Sí, por separado (`planned_date` y la fecha local del inicio)                                                                                                                                                                                       | **P** (E2E-18: «(1 día después)», «(2 días antes)»)                                                  |
| Interrumpir y reanudar                                 | Sí (Pausada, Interrumpida, Continuar)                                                                                                                                                                                                               | **P** (bloque 2)                                                                                     |
| Modificar una sesión publicada (versión n + 1)         | **Solo desde el servicio** (`publishSessionChange`); sin interfaz (bloque 5)                                                                                                                                                                        | **P** en integración («se publica la v2 desde el servicio y la v1 no cambia») · **N** en la interfaz |
| Cambio de prescripción durante la ejecución            | Las series quedan ligadas a su versión; el reproductor avisa y no cambia solo                                                                                                                                                                       | **P** en integración · el aviso, **I** (sin E2E: no hay interfaz para publicar la v2)                |
| Historial de modificaciones                            | Cada versión publicada se conserva con autor y fecha. Del borrador solo queda la última revisión. Sin pantalla de historial (bloque 5)                                                                                                              | **P** (base) · **N** (interfaz)                                                                      |
| Correcciones posteriores justificadas                  | La clienta corrige hasta terminar la sesión; la corrección conserva lo anterior. **No hay motivo ni justificación**, el entrenador no puede anotar ni corregir (`set_annotation` de `DATA_MODEL.md`, no implementado) y tras terminar no se corrige | **P** (corrección) · **N** (justificación y anotación)                                               |
| Conservación de la ejecución original                  | Sí: solo se añaden filas                                                                                                                                                                                                                            | **P** (disparadores, §2.3)                                                                           |
| 1. Versiones publicadas inmutables                     | Sí                                                                                                                                                                                                                                                  | **P**                                                                                                |
| 2. Cada registro asociado a la versión exacta          | Sí (`set_log.version_number` con clave ajena; `session_log.started_version`)                                                                                                                                                                        | **P**                                                                                                |
| 3. Cambios posteriores no alteran registros anteriores | Sí                                                                                                                                                                                                                                                  | **P**                                                                                                |
| 4. Series hechas, ligadas a su versión original        | Sí; la revisión compara cada serie con su versión                                                                                                                                                                                                   | **P** en integración                                                                                 |
| 5. Aplicar cambios pendientes con trazabilidad         | En el servicio sí (bloqueos y motivo obligatorio si está terminada); sin interfaz                                                                                                                                                                   | **P** en integración · **N** en la interfaz                                                          |

**Contradicciones entre el código y la documentación** (A-21):

| Documento                        | Dice                                                                                                                                                     | Realidad                                                                                                                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ARCHITECTURE.md` (línea 73)     | V1 usa `localStorage`; IndexedDB llega en V2                                                                                                             | El bloque 2 usa IndexedDB (ADR-24)                                                                                                                                               |
| `ARCHITECTURE.md` (línea 240)    | «Reproductor de la Fase 1 (aún no guarda)»                                                                                                               | Reproductor por pasos que guarda en el servidor                                                                                                                                  |
| `DECISIONS.md` P-65              | En V1, `localStorage`                                                                                                                                    | Sustituida por ADR-24 sin anotarlo en P-65                                                                                                                                       |
| `V1_SPEC.md` §8.7 y §0           | «hoy 26.13.0»                                                                                                                                            | Se usa la 26.13.1 (cambio justificado en el bloque 2)                                                                                                                            |
| `DATA_MODEL.md` (líneas 226–240) | `set_log` con `set_role`, `reps_per_side`, `stop_reason`, `exercise_feedback`, `exercise_skip`, `set_annotation`; «todo lo realizado es `self_reported`» | V1 implementa un subconjunto (`EXECUTION.md` §2): sin calentamiento, sin motivo de parada, sin anotaciones. **La procedencia no se guarda ni se muestra** en la ejecución (A-14) |
| `README.md` y `DEVELOPMENT.md`   | «Un solo proceso de servidor»                                                                                                                            | Es una condición, pero nada la impone (A-03, A-04)                                                                                                                               |

## 6. Seguridad y funcionamiento local

**Cómo se inicia:**

- `pnpm dev` y `pnpm start` escuchan solo en `127.0.0.1` (`-H 127.0.0.1` en `package.json`);
- hace falta `TRAINPRO_MODE=local-demo` (en `.env.local`);
- `TRAINPRO_ALLOWED_HOSTS` vale por defecto `localhost,127.0.0.1`;
- `TRAINPRO_DEMO_SPACES` es `off` salvo en las E2E.

| Comprobación                                                                                  | Resultado                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cabeceras de seguridad                                                                        | CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP presentes; sin `X-Powered-By`. La CSP lleva `'unsafe-inline'` en scripts, documentado hasta usar _nonces_ con la autenticación real. **P**                                         |
| `Host` ajeno y `X-Forwarded-Host` ajeno                                                       | `403` las dos. **P**                                                                                                                                                                                                                                                |
| **Servidor arrancado sin `-H 127.0.0.1`** (todas las interfaces)                              | Desde otra dirección con `Host` real → `403`; **con `Host: localhost` falsificado → `200`, área del entrenador visible**. La comprobación de `Host` protege contra DNS rebinding, no contra la red local: la única barrera es la dirección de escucha (A-12). **P** |
| Sin `TRAINPRO_MODE`                                                                           | No hay «Entrar como…» y las áreas privadas vuelven a la portada (`restart.spec` B1-11). **P**                                                                                                                                                                       |
| Área del cliente sin cookie                                                                   | Marta, por diseño de la demo. **P**                                                                                                                                                                                                                                 |
| Área del entrenador sin cookie                                                                | Alex, siempre en `local-demo`. **P**                                                                                                                                                                                                                                |
| Cookie de cliente con el id del entrenador (`t-alex`) o de un cliente no ofrecido (`c-diego`) | Vuelve a la portada (307). **P**                                                                                                                                                                                                                                    |
| Cookie de espacio con los espacios desactivados                                               | Se ignora; no se crea ningún archivo. **P**                                                                                                                                                                                                                         |
| Sesión o API de otra clienta                                                                  | `404` sin revelar nada (`execution-api`, integración). **P**                                                                                                                                                                                                        |
| `GET /estado` con un origen ajeno                                                             | `200`, pero sin `Access-Control-Allow-Origin`: el navegador no deja leerlo. Las escrituras exigen el mismo origen (`403`). **P**                                                                                                                                    |
| Cookie de identidad                                                                           | `httpOnly`, `SameSite=Lax`, 30 días, sin firmar (es un selector de demo). **I**                                                                                                                                                                                     |
| **Cola local de un navegador compartido**                                                     | Lo pendiente de Marta se envió con la cookie de Lucía → `404` → «Error de envío» permanente. Lucía ve «1 registro pendiente de envío en este móvil», que es de otra persona (A-08). **P**                                                                           |

**Tres cosas distintas que no deben confundirse:**

|                                     | Qué es                                                | Qué hay hoy                                                                                                                                                                     |
| ----------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Selector de perfiles de la demo** | Elegir con qué persona ficticia se ve la app          | «Entrar como…»: una cookie sin firmar con el id. Cualquiera con acceso al equipo puede ser cualquiera de las tres personas                                                      |
| **Autenticación**                   | Demostrar quién eres (contraseña, enlace, proveedor…) | **No existe**                                                                                                                                                                   |
| **Autorización**                    | Qué puede ver o hacer cada identidad                  | Existe y está probada: políticas de `src/domain/access.ts` en los casos de uso, con pruebas del acceso no autorizado. Hoy se aplica sobre una identidad que nadie ha verificado |

**Limitaciones actuales:**

- **Datos:** sin cifrado en reposo; sin autenticación real.
- **Un solo proceso, sin imponer:** si se arrancan dos servidores sobre la misma base, se pueden perder datos (A-03).
- **Entorno en la nube efímero:** `.data` desaparece si se recrea el contenedor, y en este entorno no hay ninguna base principal.
- **Copias:** sin copias programadas, sin rotación y con permisos `644`.
- **Lo pendiente vive en el navegador** y se pierde si se borran sus datos.
- **Windows:** no verificado.
- **Navegadores:** solo Chromium probado (sin Safari ni iOS reales).
- **Servidor síncrono:** un bloqueo externo lo detiene hasta 5 s (A-11).

## 7. Estado real de cada funcionalidad del bloque 1

| Funcionalidad                                                                                                                          | Estado                                                                                                               | Evidencia        |
| -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Node 26 + `better-sqlite3`, adaptador único                                                                                            | Verificada en Linux                                                                                                  | P                |
| Migraciones con suma de comprobación                                                                                                   | Verificada                                                                                                           | P                |
| Semilla v2 y almacén por archivo                                                                                                       | Verificada                                                                                                           | P                |
| Espacios E2E                                                                                                                           | Verificada                                                                                                           | P (batería)      |
| Compatibilidad con las pantallas de la Fase 1                                                                                          | Verificada por la prueba de equivalencia                                                                             | P                |
| `db:status` y `db:backup`                                                                                                              | Verificadas                                                                                                          | P                |
| `db:restore`                                                                                                                           | **Parcial:** funciona en condiciones normales, pero no es segura tras un corte ni ante una interrupción (A-01, A-02) | P                |
| «Hacer una copia ahora» y «Restablecer datos demo»                                                                                     | Verificadas con un solo servidor; con dos se pierden datos (A-03)                                                    | P                |
| Protección local (`127.0.0.1`, `Host`, `TRAINPRO_MODE`)                                                                                | **Parcial:** depende de arrancar con `-H 127.0.0.1` (A-12)                                                           | P                |
| Dominio v2: `resolveSets`, validaciones, avisos, bloqueos, resumen de cambios                                                          | Verificado en unitarias e integración                                                                                | P                |
| Versión n + 1                                                                                                                          | Solo en el servicio                                                                                                  | P · N (interfaz) |
| Lucía y «Entrar como…»                                                                                                                 | Verificados                                                                                                          | P                |
| A3 (sesiones por días)                                                                                                                 | Verificada                                                                                                           | P                |
| A4 (nueva sesión)                                                                                                                      | Verificada                                                                                                           | P                |
| A5 (constructor)                                                                                                                       | **Parcial:** riesgo de perder trabajo (A-05, A-06, A-07)                                                             | P                |
| A7 (sesión publicada)                                                                                                                  | Verificada                                                                                                           | P                |
| Configuración (datos de la demo)                                                                                                       | Verificada                                                                                                           | P                |
| Hoy, detalle (B2) y reproductor                                                                                                        | Verificados; el reproductor es ya el del bloque 2                                                                    | P                |
| Totales del día en A3, %1RM, lastre y asistida en el constructor, tiempo y distancia en el constructor, editar lo publicado, historial | **No implementados** (bloques 3, 4 y 5)                                                                              | N                |

## 8. Registro de problemas

**Gravedad:**

- **Crítica:** pérdida o corrupción de datos en el uso normal.
- **Alta:** pérdida de datos o de trabajo en situaciones plausibles.
- **Media:** fiabilidad, seguridad o integridad con condiciones especiales.
- **Baja:** calidad, claridad o defensa en profundidad.

> Estado actual de cada problema: §15.1.

No se ha encontrado ningún problema crítico: en el uso normal (un servidor, sin restaurar copias) no se ha perdido ni duplicado nada.

| Id   | Gravedad | Área                  | Problema                                                                                                                                                                                   | Evidencia                                                                             | Propuesta                                                                         |
| ---- | -------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| A-01 | **Alta** | Copias                | Tras un corte brusco, `db:restore` pierde lo confirmado que estaba en el WAL. La copia «antes-de-restaurar» no lo contiene y el WAL se borra; el mensaje dice lo contrario                 | P (B5: 0 de 20)                                                                       | R1                                                                                |
| A-02 | **Alta** | Copias                | La restauración no es atómica (sobrescribe el archivo en el sitio). Interrumpirla puede dejar una base que no se abre o, en 1 de 320 intentos, distinta e «íntegra»                        | P (B6)                                                                                | R1                                                                                |
| A-03 | **Alta** | Persistencia          | Nada impide dos servidores sobre la misma base. Con «Restablecer», el otro confirma (`200`) escrituras que se pierden                                                                      | P (S)                                                                                 | R2                                                                                |
| A-04 | **Alta** | Copias                | La marca `.pid` se sobrescribe y la borra otro proceso: `db:restore` se ejecuta con un servidor activo                                                                                     | P (S2)                                                                                | R2                                                                                |
| A-05 | **Alta** | Constructor           | Un error al guardar sustituye la página por «Algo no ha ido bien» y se pierde lo no guardado                                                                                               | P (U8)                                                                                | R3                                                                                |
| A-08 | **Alta** | Bloque 2              | La cola local no distingue personas. En un móvil compartido, lo pendiente de una se envía con la identidad de otra y queda en error permanente; además se ve un aviso de pendientes ajenos | P                                                                                     | R4                                                                                |
| A-06 | Media    | Constructor           | Cambiar de sección desde el menú no avisa de cambios sin guardar                                                                                                                           | P (U4)                                                                                | R3                                                                                |
| A-07 | Media    | Constructor           | Sin guardado automático ni copia local: una caída del navegador pierde el trabajo                                                                                                          | P, I                                                                                  | R3                                                                                |
| A-09 | Media    | Bloque 2              | «Reintentar» aparece con registros en error pero solo reintenta los pendientes; los errores necesitan «Descartar y volver a registrar»                                                     | I (`sync-engine.ts`: `find(e => e.status !== 'error')`; `resetBackoff` solo `queued`) | R5                                                                                |
| A-10 | Media    | Bloque 2 / integridad | La hora del dispositivo no tiene límite inferior: se aceptan un inicio en 2020 y una serie en 2019, anteriores a la publicación de la versión y al propio inicio                           | P                                                                                     | R6                                                                                |
| A-11 | Media    | Arquitectura          | Controlador síncrono + `busy_timeout` de 5 s: un bloqueo externo detiene todo el servidor                                                                                                  | P (P2: portada en 4,7 s)                                                              | R2 (evitar otros escritores); PostgreSQL en la Fase 2                             |
| A-12 | Media    | Seguridad             | Si se arranca sin `-H 127.0.0.1`, un `Host` falsificado desde la red da acceso completo                                                                                                    | P                                                                                     | R11                                                                               |
| A-13 | Media    | Pruebas               | Una prueba E2E depende del día de la semana (la semilla usa la fecha real) y hoy falla: «Empezar igualmente» en lugar de «Empezar entrenamiento»                                           | P                                                                                     | R7                                                                                |
| A-14 | Media    | Modelo                | La procedencia (`self_reported`) de lo registrado no se guarda ni se muestra en la ejecución (regla de `AGENTS.md`)                                                                        | I                                                                                     | R8                                                                                |
| A-15 | Baja     | Recuperación          | Base dañada o migraciones incompatibles: página genérica en todas las pantallas, sin indicar qué hacer                                                                                     | P (P4)                                                                                | R9                                                                                |
| A-16 | Baja     | Copias                | Copias con permisos `644`; la base, `600`                                                                                                                                                  | P                                                                                     | R10                                                                               |
| A-17 | Baja     | Copias                | Verificar una copia deja `-wal` y `-shm` junto a ella                                                                                                                                      | P                                                                                     | R10                                                                               |
| A-18 | Baja     | Copias                | Sin copias programadas ni rotación; sin `fsync` tras copiar                                                                                                                                | I                                                                                     | R10                                                                               |
| A-19 | Baja     | Integridad            | La base acepta un ejercicio inexistente en la versión y fechas imposibles; solo los valida la aplicación (la prescripción es JSON)                                                         | P (P3)                                                                                | Aceptar y documentar (la aplicación lo valida, probado), o comprobación periódica |
| A-20 | Baja     | Persistencia          | Si se borra `.data` con el servidor en marcha, sigue aceptando datos que se pierden                                                                                                        | P (observado)                                                                         | R2 (comprobar la marca periódicamente)                                            |
| A-21 | Baja     | Documentación         | Contradicciones del §5                                                                                                                                                                     | I                                                                                     | R12 (anotadas en esta entrega)                                                    |
| A-22 | Info     | Dependencias          | Parches disponibles; 1 vulnerabilidad moderada solo en desarrollo                                                                                                                          | P                                                                                     | Revisión periódica (§8.7)                                                         |
| A-23 | Info     | Plataforma            | Windows no verificado en Windows                                                                                                                                                           | N                                                                                     | R13                                                                               |

## 9. Riesgos técnicos pendientes

1. **Integridad operativa de la base local:** varias instancias, restauración y borrado de `.data` (A-01 a A-04, A-20). Es lo más importante.
2. **Pérdida de trabajo del entrenador** en el constructor (A-05 a A-07).
3. **Fiabilidad de la cola en dispositivos compartidos** (A-08, A-09). El mismo riesgo existirá con autenticación real.
4. **Datos temporales poco fiables** (A-10): afecta a duraciones y, en el bloque 3, al análisis por fecha.
5. **Escalabilidad:** un proceso síncrono no sirve para varios usuarios simultáneos (A-11). Es aceptable en el prototipo; para la Fase 2 está decidido PostgreSQL.
6. **Plataformas no verificadas:** Windows, Safari e iOS.
7. **Sin autenticación ni cifrado:** solo vale para datos ficticios.

## 10. Recomendaciones técnicas (propuesta de correcciones, sin implementar)

Ninguna necesita dependencias nuevas.

| Id  | Corrección                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Resuelve               | Esfuerzo       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | -------------- |
| R1  | **Restauración segura:**<ol><li>Abrir la base actual y volcar el WAL (`wal_checkpoint(TRUNCATE)`), o copiarla con la API de copia.</li><li>Verificar «antes-de-restaurar».</li><li>Escribir la copia en `<base>.restaurando`, sincronizar a disco y verificar.</li><li>Sustituir con `rename` atómico.</li><li>Solo entonces borrar `-wal` y `-shm`.</li></ol>Prueba: B5 y B6 automatizadas                                                                       | A-01, A-02             | Bajo           |
| R2  | **Instancia única de verdad:**<ul><li>Crear la marca con apertura exclusiva (`wx`).</li><li>Si existe y su proceso vive, no arrancar y explicarlo.</li><li>No borrar nunca la marca de otro proceso.</li><li>Comprobar periódicamente que la marca y la base siguen ahí; si no, avisar y dejar de escribir.</li></ul>Alternativa a decidir: `PRAGMA locking_mode=EXCLUSIVE` (también impide `pnpm db:backup` desde fuera: las copias se harían solo desde la app) | A-03, A-04, A-11, A-20 | Bajo-medio     |
| R3  | **Constructor sin pérdidas:**<ul><li>errores tipados en guardar y publicar;</li><li>guardado automático con la revisión;</li><li>copia local del borrador con recuperación;</li><li>aviso en la navegación interna.</li></ul>Pruebas E2E del §4                                                                                                                                                                                                                   | A-05, A-06, A-07       | Medio          |
| R4  | **Cola por identidad:**<ul><li>guardar `clientId` con cada comando;</li><li>enviar solo los de la identidad actual;</li><li>un `404` a un comando de otra identidad no es un error;</li><li>ocultar los pendientes ajenos.</li></ul>Prueba: la de A-08                                                                                                                                                                                                            | A-08                   | Bajo           |
| R5  | «Reintentar» también reintenta los errores que pueden reintentarse, o el botón se oculta cuando solo hay errores                                                                                                                                                                                                                                                                                                                                                  | A-09                   | Bajo           |
| R6  | **Límite inferior de la hora:** si la hora del dispositivo es anterior al inicio (o, para el inicio, a la publicación de la versión), usar la de recepción y marcarla como ajustada, igual que ya se hace con el límite superior                                                                                                                                                                                                                                  | A-10                   | Bajo           |
| R7  | **E2E deterministas:** fecha de semilla fija en las E2E, o pruebas que no dependan del día                                                                                                                                                                                                                                                                                                                                                                        | A-13                   | Bajo           |
| R8  | **Procedencia `self_reported`** en el contrato de lo registrado y una insignia en A7 y en el resumen                                                                                                                                                                                                                                                                                                                                                              | A-14                   | Bajo           |
| R9  | **Página de error de la base**, con el motivo y qué hacer (`pnpm db:status`, restaurar una copia)                                                                                                                                                                                                                                                                                                                                                                 | A-15                   | Bajo           |
| R10 | **Copias con permisos `600`:** pasar las copias a `journal_mode=DELETE` (sin `-wal`/`-shm`), sincronizar a disco y conservar las N últimas. Las copias programadas, solo si se aprueban                                                                                                                                                                                                                                                                           | A-16, A-17, A-18       | Bajo           |
| R11 | **Arranque solo en la propia máquina:** en `local-demo`, negarse a arrancar si la dirección de escucha no es de la propia máquina (a decidir cómo detectarla sin cambiar la arquitectura), y documentarlo en el README                                                                                                                                                                                                                                            | A-12                   | Bajo-medio     |
| R12 | Corregir las contradicciones del §5. En esta entrega solo se anotan, con la nota fechada                                                                                                                                                                                                                                                                                                                                                                          | A-21                   | Hecho en parte |
| R13 | Verificar en Windows: `pnpm verify:env`, `pnpm test` y `pnpm test:e2e` en tu equipo, o una máquina Windows en CI (P-04)                                                                                                                                                                                                                                                                                                                                           | A-23                   | Depende de ti  |

**Orden recomendado:**

1. R1, R2 y R3: fiabilidad de los datos y del trabajo del entrenador.
2. R4, R5 y R6: fiabilidad del registro de la clienta.
3. R7 y R8.
4. El resto.

## 11. Especificación del bloque 2 contrastada con lo implementado

El detalle del diseño está en `EXECUTION.md` (modelo, estados, API, cola, conflictos) y en `V1_SPEC.md` §9.3. Aquí se contrasta cada requisito de este encargo con el código.

### 11.1 Experiencia de ejecución

| Requisito                                                  | Estado                                                                               | Evidencia / hueco                                                                                                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1–3. Entrenamiento del día, ejercicios prescritos, empezar | Implementado                                                                         | P (`client-execution`, `client-app`)                                                                                                                  |
| 4. Ejercicio actual                                        | Implementado                                                                         | P                                                                                                                                                     |
| 5. Instrucciones, imágenes, vídeos                         | Instrucciones y silueta; vídeo como enlace si existe                                 | P (silueta, instrucciones) · **la biblioteca de la demo no tiene vídeos ni imágenes propias** (`MEDIA.md`), así que el vídeo no se ha visto funcionar |
| 6. Series, repeticiones, carga y esfuerzo                  | Implementado; carga y esfuerzo destacados                                            | P (capturas, E2E)                                                                                                                                     |
| 7. Registrar cada serie                                    | Implementado                                                                         | P                                                                                                                                                     |
| 8. Descanso                                                | Implementado                                                                         | P (E2E-4)                                                                                                                                             |
| 9. Siguiente ejercicio                                     | Implementado                                                                         | P (E2E-5)                                                                                                                                             |
| 10–11. Pausa, interrupción y reanudación                   | Implementado                                                                         | P                                                                                                                                                     |
| 12. Finalizar y resumen                                    | Implementado; cierre parcial explícito                                               | P                                                                                                                                                     |
| Fácil para personas sin conocimientos técnicos             | Textos llanos («¿Cuántas repeticiones te quedaban?»); sin prueba con personas reales | D                                                                                                                                                     |

### 11.2 Registro de series y cargas

| Requisito                                                                              | Estado                                                                                                                                                                                            | Evidencia / hueco                                                    |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Repeticiones, carga, RIR/RPE, duración, distancia, observaciones según la prescripción | Implementado (`performedFieldsFor`)                                                                                                                                                               | P (unitarias; E2E: plancha en segundos, granjero en metros y tiempo) |
| Otros parámetros específicos (por lado, motivo de parada, calentamiento)               | No                                                                                                                                                                                                | N (`DATA_MODEL.md` los prevé)                                        |
| Prescrito, ejecutado, estimado y calculado separados                                   | **Prescrito** y **ejecutado**: separados, por tablas distintas e inmutables. **Calculado**: solo diferencias en la vista, sin guardar. **Estimado**: no existe. **La procedencia no se registra** | P · A-14                                                             |
| No inventar valores                                                                    | El formulario se rellena con lo prescrito, pero lo enviado es lo que la persona confirma. RIR y RPE nunca se rellenan solos                                                                       | P (unitarias `defaultPerformed`)                                     |
| Kg, peso corporal, lastre, asistida, bandas (descriptor), sin carga                    | Implementado en el registro                                                                                                                                                                       | P (unitarias)                                                        |
| %1RM                                                                                   | Se **prescribe** como %1RM y se **registran** los kg realmente usados (no se calcula ningún 1RM)                                                                                                  | P (unitarias) · el constructor aún no lo ofrece (bloque 4)           |
| RIR/RPE solo cuando corresponde                                                        | Solo si se prescribió; si no, el servidor rechaza el dato (`422`)                                                                                                                                 | P                                                                    |
| Carga externa frente a interna; sin tonelaje con el peso corporal                      | No se calcula tonelaje ni carga interna                                                                                                                                                           | P (unitarias: «sin tonelaje»)                                        |

### 11.3 Temporizador y reanudación

| Requisito                                                             | Estado                                                                  | Evidencia               |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------- |
| Tiempo prescrito, iniciar, pausar, reiniciar, omitir, ajustar (±15 s) | Implementado                                                            | P (E2E e inspección)    |
| «Modificarlo cuando esté permitido»                                   | Siempre se permite: no existe un ajuste del entrenador que lo restrinja | N (**?**: ¿hace falta?) |
| Cierre accidental, recarga                                            | Se recupera                                                             | P                       |
| Pérdida de conexión                                                   | Se recupera y se envía al volver                                        | P                       |
| Reinicio del servidor                                                 | Se recupera                                                             | P                       |
| Interrupciones prolongadas                                            | Pasa a «Interrumpida» y se puede continuar otro día                     | P (integración, E2E-18) |
| Cambio de fecha durante la ejecución                                  | Se acepta; la sesión conserva su día                                    | P (E2E-19)              |

### 11.4 Persistencia, envío y recuperación

| Punto                                           | Estado                                                                         | Evidencia / hueco                                      |
| ----------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Estados: pendiente, enviando, confirmado, error | Implementados y distinguidos                                                   | P                                                      |
| 1. Guardado temporal                            | IndexedDB, antes de enviar                                                     | P                                                      |
| 2. Envío                                        | Al registrar; en orden; al abrir, al recuperar la red y al volver a la pestaña | P                                                      |
| 3. Confirmación                                 | Solo con `200` y el estado del servidor                                        | P                                                      |
| 4. Reintentos                                   | 2, 4, 8, 16 y 30 s, y de inmediato ante esos sucesos                           | P (E2E-22)                                             |
| 5. Duplicados                                   | Identificador por comando + resumen del contenido + índice único               | P (§2.1, E2E-23)                                       |
| 6. Pendientes recuperados                       | Al reabrir                                                                     | P (E2E-21) · **mal en un navegador compartido** (A-08) |
| 7. Conflictos                                   | `set_already_logged` se reconcilia; el resto queda como error visible          | P · A-09                                               |
| 8. Reenviar una serie confirmada                | `already_applied`, también tras cerrar la sesión                               | P                                                      |
| No mostrar «guardado» sin confirmación          | Cumplido                                                                       | P                                                      |
| Evolución hacia conectividad limitada           | Cola genérica por comandos; falta abrir la app sin conexión (V2)               | I                                                      |

### 11.5 Preparado para el análisis (bloque 3)

| Dato                                        | ¿Está?                                            | Nota                                                                            |
| ------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------- |
| Series prescritas frente a realizadas       | Sí                                                | La versión de cada serie se guarda                                              |
| Repeticiones prescritas frente a realizadas | Sí                                                |                                                                                 |
| Carga prescrita frente a ejecutada          | Sí, con su modalidad                              | Peso corporal y bandas sin kg: el tonelaje deberá excluirlos o definirse aparte |
| RIR/RPE objetivo frente a registrado        | Sí, con la escala                                 |                                                                                 |
| Volumen por ejercicio y por sesión          | Los datos sí; las fórmulas no                     | Van al registro de fórmulas con versión (bloque 3)                              |
| Duración                                    | Inicio, fin y pausas acumuladas                   | **Poco fiable mientras exista A-10**                                            |
| Cumplimiento                                | No hay definición                                 | **?** Necesita una definición aprobada antes de mostrar porcentajes             |
| Ejecuciones parciales                       | Sí (`finish_reason`, series pendientes al cerrar) |                                                                                 |
| Cambios de prescripción                     | Sí (versiones inmutables, cada serie con la suya) |                                                                                 |

### 11.6 Modelo de datos necesario

**Lo que ya hay** está en `EXECUTION.md` §2: `session_log` con `started_version` y pausas, `set_log` de solo añadir con correcciones y un único original por serie, y `client_command`.

**Cambios propuestos** (para aprobar; ninguno rompe lo existente; son migraciones `003+` solo hacia delante):

| Cambio                                                                                                                                                        | Motivo                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Procedencia de lo registrado: columna o constante del contrato `self_reported`, y `clock_adjusted` también por límite inferior                                | A-14, A-10                              |
| `client_id` en cada comando de la cola local (en el navegador, sin cambio en la base)                                                                         | A-08                                    |
| Motivo opcional de una corrección (`correction_reason`) y anotaciones del entrenador (`set_annotation`, como en `DATA_MODEL.md`), sin modificar lo registrado | «Correcciones posteriores justificadas» |
| Más adelante: `set_role` (calentamiento), `stop_reason`, `reps_per_side`                                                                                      | `DATA_MODEL.md`; bloque 4 o posterior   |

## 12. Criterios de aceptación y plan de pruebas

### 12.1 Escenarios obligatorios

| #   | Escenario                                                | Resultado que debe producirse                                                                                                                                      | Prueba que lo demuestra                                                                                                                | Estado |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | La clienta completa una sesión normal                    | «¡Sesión completada!», N de N series; A7 compara serie a serie con su versión                                                                                      | `client-execution` «recorrido completo»; `client-app` «solo se da por completada…»                                                     | ✓      |
| 2   | Interrumpe y reanuda                                     | «Pausada» o «Interrumpida» en Hoy; «Continuar» abre la primera serie sin registrar; nada se pierde                                                                 | «pausar vuelve a Hoy…»; «cerrar y volver a abrir el navegador»                                                                         | ✓      |
| 3   | Registra una serie y recarga                             | La serie sigue: «Confirmada» o «Pendiente de envío»; ninguna duplicada                                                                                             | «recargar con series pendientes…»; E2E-4                                                                                               | ✓      |
| 4   | Pierde la conexión durante el registro                   | «Pendiente de envío»; al volver la red, «Confirmada» sin intervenir; una sola fila en SQLite                                                                       | «sin conexión…»; E2E-21; E2E-22                                                                                                        | ✓      |
| 5   | Vuelve a enviar una serie                                | Mismo identificador → `200 already_applied`; otro identificador para la misma serie → `409 set_already_logged`, reconciliado                                       | «respuesta perdida…»; `execution-api`; integración; auditoría §2.1                                                                     | ✓      |
| 6   | Error al guardar                                         | Registro: `500` tipado, nada a medias, reintento aplicado una vez. **Constructor: el contenido se conserva y se puede reintentar**                                 | Integración «un comando que falla…»; auditoría P2 · **constructor: falla hoy** (A-05)                                                  | ◐      |
| 7   | Reinicio del servidor                                    | Lo confirmado sigue; lo pendiente se envía al volver; una fila por serie                                                                                           | `restart` B1-01 y B2; auditoría P1                                                                                                     | ✓      |
| 8   | Dos sesiones en el mismo día                             | Ambas visibles; empezar una con otra a medias pide confirmación; cada una con su ejecución                                                                         | `sessions` B1-03 (crear); P-21, por inspección y en la prueba que hoy falla (A-13) · **falta un E2E que ejecute las dos el mismo día** | ◐      |
| 9   | El entrenador modifica la sesión durante la ejecución    | Aviso a la clienta; sigue con su versión hasta abrir la nueva; nada cambia solo                                                                                    | Integración (v2 a media ejecución) · **falta E2E** (no hay interfaz para publicar la v2: bloque 5)                                     | ◐      |
| 10  | Series hechas y pendientes cuando cambia la prescripción | Las hechas, ligadas a la v1; las pendientes, con la v2 tras aceptarla; la revisión compara cada una con su versión; «Fuera de la versión vigente» si ya no existen | Integración · **falta E2E** (bloque 5)                                                                                                 | ◐      |

**Criterios añadidos por esta auditoría** (todos **✗**, sin cumplir hoy):

| #   | Criterio verificable                                                                                                                               | Problema   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 11  | En un navegador compartido, lo pendiente de una persona no se envía con la identidad de otra ni se le muestra; al volver la primera, se envía solo | A-08       |
| 12  | Una hora del dispositivo anterior al inicio o a la publicación se sustituye por la de recepción y se marca                                         | A-10       |
| 13  | Tras un `SIGKILL`, `db:restore` conserva en «antes-de-restaurar» todo lo confirmado                                                                | A-01       |
| 14  | Interrumpir `db:restore` en cualquier momento deja la base anterior o la restaurada, nunca otra cosa                                               | A-02       |
| 15  | Un segundo servidor sobre la misma base no arranca                                                                                                 | A-03, A-04 |
| 16  | Un fallo al guardar el borrador no hace perder lo que hay en pantalla                                                                              | A-05       |
| 17  | Salir del constructor con cambios sin guardar (también por el menú) avisa o guarda antes                                                           | A-06       |
| 18  | La batería E2E pasa cualquier día de la semana                                                                                                     | A-13       |

### 12.2 Plan de pruebas por tipo

| Tipo                         | Existe hoy                                                                                                                                | Falta                                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| A. Unitarias                 | Dominio de ejecución, campos por ejercicio, validación, diferencias, revisión por versión, hora (`performance`, `v2`, `session`)          | Límite inferior de hora (R6); procedencia (R8)                                                         |
| B. Integración               | Comandos, idempotencia, transacciones, permisos, migraciones, contrato del repositorio (`execution`, `sessions`, `db`, `store`, contrato) | Errores tipados del constructor (R3); instancia única (R2)                                             |
| C. E2E                       | 16 de ejecución, 7 de la app del cliente, API, reinicio, adaptación                                                                       | Dos sesiones el mismo día ejecutadas; versión nueva a media sesión (con el bloque 5); constructor (§4) |
| D. Persistencia              | Reinicio con `SIGTERM` y `SIGKILL`                                                                                                        | Convertir P1 (cortes con carga) en prueba permanente                                                   |
| E. Reanudación               | Cerrar y reabrir, pausa, días distintos, medianoche                                                                                       | —                                                                                                      |
| F. Duplicados e idempotencia | Reenvíos, respuesta perdida, `503`, duplicado manual                                                                                      | Navegador compartido (R4)                                                                              |
| G. Errores de conexión       | Sin red, `abort`, `503`, servidor caído                                                                                                   | Error de escritura en el constructor (R3)                                                              |
| H. Móvil                     | Pixel 7, 360 px, teclado, axe, tamaño táctil y barra inferior                                                                             | **Safari/iOS real**, sin cubrir en Chromium                                                            |
| Copias                       | `verify:env`; integración de copia y restauración                                                                                         | B5, B6 y S/S2 como pruebas permanentes                                                                 |
| Plataforma                   | Linux                                                                                                                                     | Windows (R13)                                                                                          |

## 13. Dependencias con los bloques posteriores

| Bloque                        | Depende de                                                                                                                                                  | Qué deja preparado el bloque 2                                                         |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **3 · Analizar**              | Registro de fórmulas con versión; definición de «cumplimiento» (**?**); exclusión del peso corporal y las bandas en el tonelaje; R6 para duraciones fiables | Series con versión, modalidad de carga, esfuerzo con escala, pausas, cierres parciales |
| **4 · Prescripción completa** | Tabla por serie, %1RM, lastre, asistida, tiempo y distancia **en el constructor**                                                                           | El registro ya admite todas esas modalidades                                           |
| **5 · Editar lo publicado**   | Interfaz de la versión n + 1, historial, resumen de cambios y aviso; E2E de los escenarios 9 y 10                                                           | Servicio `publishSessionChange`, bloqueos, aviso en el reproductor                     |
| **Fase 2**                    | Autenticación real, autorización sobre identidades verificadas, PostgreSQL, cifrado, copias gestionadas                                                     | Políticas de acceso ya probadas; SQL portable; puertos del repositorio                 |

## 14. Decisiones que necesitan tu aprobación

1. **El bloque 2 ya implementado:** mantenerlo como base y endurecerlo con R4–R6 (recomendado), o tratarlo de otra forma. No he tocado nada.
2. **Autorizar un bloque de correcciones** con R1, R2 y R3 (y, si quieres, R4–R10) antes del bloque 3. Ninguna añade dependencias.
3. **Instancia única (R2):** marca exclusiva con comprobación de proceso (recomendado), o `locking_mode=EXCLUSIVE` (también impide `pnpm db:backup` desde fuera).
4. **Constructor (R3):** guardado automático en el servidor más copia local (recomendado), o solo copia local con guardado manual.
5. **Arranque fuera de la propia máquina (R11):** negarse a arrancar o solo documentarlo.
6. **Definición de «cumplimiento»** antes del bloque 3, y si el entrenador debe poder **restringir el ajuste del descanso**.
7. **Correcciones justificadas:** motivo opcional en las correcciones de la clienta y anotaciones del entrenador (`set_annotation`).
8. **Verificar en Windows:** en tu equipo, o con una máquina Windows en CI (P-04).
9. **Convertir las pruebas de esta auditoría** (cortes con carga, restauración interrumpida, dos servidores, navegador compartido, hora del dispositivo) en pruebas permanentes del proyecto.

## 15. Correcciones aplicadas (PROMPT 14, 13 de noviembre de 2026)

**Autorización:** tu PROMPT 14 acepta conservar el bloque 2 (§14.1), autoriza las correcciones R1–R11 y decide tres cosas: exclusividad real del proceso que usa la base (§14.3), guardado automático con copia local (§14.4) y que `local-demo` **se niegue a arrancar** fuera de la propia máquina (§14.5). **No autoriza el bloque 3**, que no se ha empezado.

**Restricciones respetadas:** ninguna dependencia nueva; Node 26.13.1, Next.js 16.4.5, React 19.3.1 y SQLite 3.53.4 (de `better-sqlite3` 13.0.3) sin cambios; sin servicios externos ni despliegues; solo datos ficticios; sin reescribir el historial de Git.

Lo anterior de este documento (§1–§14) se conserva tal cual, como registro de la auditoría. El estado actual es el de esta sección.

### 15.1 Estado de cada problema

| Id   | Estado                                                                                                       | Evidencia                                  | Commit                       |
| ---- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------ | ---------------------------- |
| A-01 | Corregido                                                                                                    | P                                          | `099f0e7`                    |
| A-02 | Corregido                                                                                                    | P                                          | `099f0e7`                    |
| A-03 | Corregido                                                                                                    | P                                          | `8067eff`, pruebas `07dd83a` |
| A-04 | Corregido                                                                                                    | P                                          | `8067eff`, `099f0e7`         |
| A-05 | Corregido                                                                                                    | P                                          | `e61be28`                    |
| A-06 | Corregido para enlaces internos, recargar y cerrar; el botón «atrás» del navegador lo protege la copia local | P (enlaces, recarga, cierre) · I («atrás») | `e61be28`                    |
| A-07 | Corregido                                                                                                    | P                                          | `e61be28`                    |
| A-08 | Corregido                                                                                                    | P                                          | `7d9d168`                    |
| A-09 | Corregido                                                                                                    | P                                          | `7d9d168`                    |
| A-10 | Corregido (reglas T1–T4)                                                                                     | P                                          | `7d9d168`                    |
| A-11 | Acotado a 1 s con error controlado; el controlador sigue siendo síncrono                                     | P                                          | `7d9d168`                    |
| A-12 | Corregido                                                                                                    | P                                          | `8067eff`, pruebas `07dd83a` |
| A-13 | Corregido                                                                                                    | P                                          | `a990b2b`                    |
| A-14 | Corregido (migración `003`)                                                                                  | P                                          | `7d9d168`                    |
| A-15 | Sin cambios (fuera del alcance de este encargo)                                                              | N                                          | —                            |
| A-16 | Corregido: copias y copia previa con permisos `600`                                                          | P                                          | `099f0e7`                    |
| A-17 | Corregido: las copias quedan sin `-wal` ni `-shm`                                                            | P                                          | `099f0e7`                    |
| A-18 | En parte: cada copia se sincroniza a disco; sin copias programadas ni rotación                               | I (`fsync`) · N (resto) · ?                | `099f0e7`                    |
| A-19 | Aceptado: la aplicación valida la prescripción (probado); la base no                                         | P                                          | —                            |
| A-20 | Corregido: si la base o su bloqueo se borran por fuera, deja de escribir                                     | P                                          | `8067eff`                    |
| A-21 | En parte: corregidas las afirmaciones que estas correcciones dejaban obsoletas                               | I                                          | este commit de documentación |
| A-22 | Sin cambios (no se cambian versiones)                                                                        | P                                          | —                            |
| A-23 | Pendiente: Windows sigue sin ejecutarse en Windows                                                           | N                                          | —                            |

### 15.2 Restauración segura y recuperable (A-01, A-02)

**Problema:** tras un corte, `db:restore` perdía lo confirmado que estaba en el WAL, y la restauración sobrescribía el archivo en el sitio: interrumpida, podía dejar una base que no abría o distinta e «íntegra».

**Causa raíz:**

- La copia «antes-de-restaurar» copiaba solo el archivo principal; lo confirmado que seguía en el WAL no estaba en ella, y después se borraba el WAL.
- El nuevo estado se escribía directamente sobre la base activa, sin archivo temporal ni diario: no había forma de saber en qué punto se había quedado.

**Solución** (`src/server/db/backup.ts`, `restoreBackup`):

1. **Exige el bloqueo exclusivo** de la ubicación de datos (§15.3): con el servidor en marcha, se rechaza.
2. **Verifica la copia elegida** antes de tocar nada: `integrity_check`, claves ajenas y migraciones iguales a las del código (versión y suma de comprobación).
3. **Diario** `<base>.restauracion.json`, escrito de forma atómica, con la fase (`preparando` → `listo-para-sustituir` → `sustituido`).
4. **Copia previa** con la API de copia de SQLite sobre la base abierta, así que **incluye el WAL**. Queda autosuficiente (diario `DELETE`), verificada, con permisos `600` y en `backups/`. Si la base actual está dañada, se guardan sus archivos tal cual (con su WAL) y se indica que esa copia no está verificada.
5. **Archivo temporal** `<base>.restaurando`: se escribe por bloques, `fsync` y se cierra; se valida abierto en modo `DELETE` y se vuelve a sincronizar.
6. **Sustitución atómica** con `rename` y `fsync` del directorio (en Windows, Node sustituye el archivo con `MoveFileEx`, cuya atomicidad no está garantizada formalmente, y no hay `fsync` del directorio; no se ha probado allí). Antes, si junto a la base hubiera un WAL con contenido, se para: aplicarlo a la base nueva la dañaría.
7. **Solo se da por terminada** si la base sustituida se verifica. Si no, se vuelve a la copia previa.

**Recuperación** (`recoverInterruptedRestore`): la ejecutan el servidor al arrancar y `pnpm db:recover`, siempre con el bloqueo. Decide por la fase del diario y los archivos que existen:

- **No se llegó a sustituir:** se anula (`anulada`). La base no se tocó; se borran el temporal y una copia previa a medias.
- **Ya se sustituyó y la base es válida:** se da por terminada (`completada`).
- **La base sustituida no es válida:** se vuelve a la copia previa (`revertida`).

Es repetible: si se interrumpe la propia recuperación, la siguiente llega al mismo resultado.

**Pruebas:**

- `src/server/db/restore.test.ts`:
  - recupera exactamente la copia y guarda verificada la previa, con `600` y sin `-wal`;
  - A-01: la copia previa conserva lo que solo estaba en el WAL tras un corte;
  - interrupción en cada fase (`preparando`, `copia-previa`, `escribiendo`, `escrito`, `validando`, `sustituyendo`, `sustituido`) y durante la recuperación;
  - vuelta atrás si la base sustituida está dañada;
  - una copia dañada se rechaza sin crear diario ni temporal;
  - sin bloqueo no se restaura.
- `src/server/db/concurrency.test.ts`, con **procesos reales**: `pnpm db:restore` se mata con `SIGKILL` en cada fase (punto de pausa de pruebas `TRAINPRO_TEST_PAUSE_AT`) y después `pnpm db:recover`; también se mata la recuperación, y una restauración nueva recupera antes la anterior. Pasada tres veces seguidas sin fallos.

**Limitaciones:**

- En sistemas de archivos de red, `rename` y los bloqueos no son fiables: la base debe estar en un disco local.
- En Windows solo está **documentado** [D] (A-23).

### 15.3 Un solo proceso por base (A-03, A-04, A-20)

**Problema:** podían arrancar dos servidores sobre la misma base y uno confirmaba escrituras que se perdían; la marca `.pid` se sobrescribía o la borraba otro proceso, y `db:restore` se ejecutaba con un servidor activo; si se borraba `.data` con el servidor en marcha, seguía aceptando datos.

**Causa raíz:** la exclusividad dependía de una marca en un archivo, no de un mecanismo del sistema: cualquiera podía sobrescribirla o borrarla, y un PID puede reutilizarse.

**Solución** (`src/server/db/lock.ts`, `acquireOsLock` en `sqlite.ts`; ADR-25):

- **Bloqueo del sistema operativo** sobre `<base>.lock`, obtenido a través de SQLite (`locking_mode=EXCLUSIVE` más una escritura): `fcntl` en Linux y macOS, `LockFileEx` en Windows. No es una marca: lo tiene un solo proceso y nadie más puede liberarlo.
- **Cierres inesperados:** si el titular muere (también con `SIGKILL`), el sistema libera el bloqueo. No hay bloqueos obsoletos ni PID reutilizados que interpretar, así que **nunca se borra un bloqueo automáticamente**. El archivo `.lock` no se borra nunca.
- **Quién lo tiene:** `<base>.lock.json` (proceso, equipo, función, desde cuándo). Es solo informativo: borrarlo no libera nada. `pnpm db:status` lo muestra.
- **Quién lo toma:** el servidor al arrancar (si está ocupado, no arranca y nombra al titular), `pnpm db:restore` y `pnpm db:recover`. `pnpm db:backup` no lo necesita: solo lee una instantánea coherente con la API de copia.
- **Detección de manipulación (A-20):** en cada uso, el servidor comprueba que la base y el bloqueo siguen siendo los mismos archivos (dispositivo e inodo). Si alguien los borra o los sustituye por fuera, deja de escribir y responde `storage_unavailable` en lugar de perder datos.
- **Recuperación administrativa:** no hace falta borrar nada a mano. Si un proceso murió, el bloqueo ya está libre; si sigue vivo, `db:status` dice cuál es y hay que pararlo.

**Pruebas:**

- `src/server/db/concurrency.test.ts`: otro proceso no puede tomar el bloqueo y recibe quién lo tiene; `db:restore` se rechaza mientras otro lo tiene; tras `SIGKILL` del titular, el bloqueo queda libre.
- `src/server/db/store.test.ts`: el bloqueo se toma y se libera; borrar la base o el `.lock` detiene las escrituras.
- `e2e/restart.spec.ts` (A-03), con servidores reales: el segundo servidor no arranca y nombra al titular; borrar `.lock.json` no libera el bloqueo; `db:restore` se rechaza; el primero sigue escribiendo; al pararlo, `db:status` dice «Sin servidor usándola.».

**Limitaciones:**

- En Linux y macOS, alguien con permisos puede borrar `.lock` a mano. El titular lo detecta y deja de escribir, pero un proceso nuevo podría tomar un bloqueo sobre el archivo nuevo. **Nunca escriben dos**, pero el primero queda inutilizable hasta reiniciarlo.
- Sistemas de archivos de red: sin bloqueos fiables, no protege.

### 15.4 Constructor sin pérdida de trabajo (A-05, A-06, A-07)

**Problema:** un error al guardar sustituía la página por «Algo no ha ido bien» y se perdía lo no guardado; cambiar de sección desde el menú no avisaba; no había guardado automático ni copia local.

**Causa raíz:** las acciones de servidor lanzaban la excepción hasta el límite de error de Next.js, que desmonta la pantalla; el estado del constructor solo vivía en memoria; la navegación interna de Next.js no dispara `beforeunload`.

**Solución:**

- **Errores tipados** (`actions.ts`, `safely`): guardar y publicar devuelven `{ ok: false, reason }` (`storage_busy`, `storage_unavailable`, `storage_error`, `server_error`) en lugar de lanzar. El contenido sigue en pantalla.
- **Guardado automático** (`use-draft-autosave.ts`): 2 s después del último cambio.
  - Un solo guardado a la vez: lo que cambie mientras tanto se guarda después.
  - Cada respuesta solo da por guardado el contenido que **envió**, así que una respuesta antigua no puede pisar cambios recientes.
  - Estados visibles: «Cambios pendientes de guardar…», «Guardando…», «Borrador guardado · hh:mm» (**solo** con la confirmación del servidor), «No se ha podido guardar…» con «reintentar ahora» y reintento automático a los 5 s si es recuperable.
  - Si otra pestaña guardó antes, el servidor responde conflicto por revisión y no se pisa nada.
- **Copia local** (`draft-backup.ts`): `localStorage` con la clave `trainpro:borrador:v1:<entrenador>:<cliente>:<sesión>`, que guarda también la identidad y la revisión base. Se escribe en cada cambio y se borra cuando el servidor confirma ese contenido.
  - Al volver, «Tienes cambios sin guardar de una visita anterior»: «Recuperar mis cambios» o «Descartarlos».
  - Si el servidor tiene una revisión posterior: «Usar mi copia» o «Quedarme con la versión guardada». Mientras se decide, **no se edita**, y nada se sustituye en silencio.
  - Nunca se ofrece la copia de otra identidad: está en la clave y se comprueba al leer.
  - Si otra pestaña del mismo navegador guarda o borra esa copia, el aviso se actualiza o se retira.
- **Salida segura** (`leave-guard.tsx`): con cambios sin confirmar, cerrar o recargar avisa (`beforeunload`), y los enlaces internos (menú, migas) abren un diálogo: «Guardar y salir» (si falla, lo dice y no sale), «Salir (se conserva una copia)» o «Seguir editando».

**Pruebas** (`e2e/builder-protection.spec.ts`, 8, y `src/features/trainer/draft-backup.test.ts`, 3):

- guardado automático confirmado y conservado al recargar;
- **el caso de la auditoría:** base bloqueada por otro proceso (`BEGIN IMMEDIATE`) al guardar → aviso, el trabajo sigue y se guarda al liberarse;
- error `500` de las acciones → aviso y «reintentar ahora»;
- cerrar con `beforeunload` y recuperar en otra pestaña;
- salir por el menú: aviso, «Guardar y salir» sin servidor, salir con copia y recuperarla;
- copia local frente a una versión posterior de otro navegador: «Quedarme con la versión guardada» y «Usar mi copia»;
- dos pestañas del mismo navegador.

Repetidas tres veces seguidas: 24 de 24.

**Limitaciones:**

- **Botón «atrás»** del navegador: no se puede bloquear con fiabilidad en una aplicación de una sola página. Protege la copia local, que se ofrece al volver [I].
- **Sin almacenamiento local** (algunas navegaciones privadas): el diálogo de salida lo dice («Salir sin guardar»).
- **Dos pestañas con cambios sin guardar del mismo borrador** comparten la copia local: queda la última escrita. Cada pestaña conserva su contenido en pantalla y avisa al cerrar.

### 15.5 Cola de registros por persona (A-08)

**Problema:** en un móvil compartido, lo pendiente de Marta se enviaba con la identidad de Lucía.

**Causa raíz:** los comandos pendientes no guardaban quién los creó, la cola enviaba todo lo de la sesión, y el servidor tomaba la identidad solo de la cookie.

**Solución:**

- **En el servidor**, que es donde se valida: cada comando lleva `clientId`. Es obligatorio (`400` sin él) y, si no coincide con la identidad de la petición, se responde `409 identity_mismatch` **antes de nada**, sin efectos. El `payload_hash` no incluye `clientId`, así que un reintento legítimo sigue siendo idempotente.
- **En el móvil:** IndexedDB versión 2 con el índice `byOwnerSession`. Cada comando guarda su titular, y la cola solo lista y envía los de la identidad actual.
  - Los comandos antiguos sin titular solo los adopta la persona de esa sesión.
  - Si llega `identity_mismatch` (la identidad cambió en otra pestaña), el comando se queda guardado, sin aplicar, a la espera de su titular.
  - Hoy, Semana y Progreso muestran: «Hay … de otra persona en este dispositivo. Se enviarán cuando esa persona vuelva a entrar.».
  - La posición y el descanso del reproductor también van por persona.
- **Cómo se resuelven:** lo de otra persona solo lo envía o descarta esa persona cuando vuelve a entrar en ese dispositivo. **Nunca se descarta en silencio**, y nadie puede descartar lo de otra persona.

**Pruebas:**

- `execution.test.ts` (A-08): un comando de otra identidad nunca se aplica.
- `e2e/execution-api.spec.ts`: `400` sin `clientId`; `409 identity_mismatch` con el comando de Marta enviado como Lucía; Lucía con su propio identificador → `404`.
- `e2e/client-execution.spec.ts` (A-08), **el escenario exacto**: Marta registra sin conexión, se cambia a Lucía, vuelve la conexión y la cola procesa. La serie de Marta no se envía como de Lucía, y se envía cuando Marta vuelve.

**Limitación:** si esa persona no vuelve a entrar en ese dispositivo, lo suyo sigue guardado en él (se ve el aviso). Con autenticación real (Fase 2) la regla es la misma.

### 15.6 Reintentos de registros fallidos (A-09)

**Problema:** «Reintentar» solo reintentaba los pendientes; los registros en error necesitaban «Descartar y volver a registrar».

**Causa raíz:** `resetBackoff` solo tocaba los `queued`, y la cola saltaba los `error`.

**Solución** (`sync-engine.ts`, `retryRecoverable`):

- Los errores **recuperables** (`server_error`, `storage_busy`, `storage_unavailable`, `not_found`, `not_started`, `http_404`, `http_408` y `http_429`) vuelven a la cola con su **identificador original**. Si ya se hubiera aplicado, el servidor responde `already_applied`: no hay duplicados.
- Los demás (datos no válidos, sesión cerrada…) se quedan con su motivo hasta que la persona decide. Nunca se borran solos.
- El estado está en IndexedDB y sobrevive a recargar.

**Pruebas:** `e2e/client-execution.spec.ts` (A-09): error recuperable → «Reintentar» → una sola serie, confirmada.

### 15.7 Hora de ejecución (A-10)

**Problema:** se aceptaban un inicio en 2020 y una serie en 2019, anteriores a la publicación y al propio inicio.

**Causa raíz:** solo había límite superior (la hora de recepción, P-86); no había límite inferior.

**Solución:** reglas T1–T4 en `resolveExecutionInstant` (`src/domain/training/execution.ts`), detalladas en `EXECUTION.md` §7.1:

- **T1:** una hora imposible (antes de 2020 o desde 2100) se rechaza con `422`.
- **T2:** por delante del servidor → hora de recepción, motivo `ahead_of_server`.
- **T3:** más de 5 min antes del límite inferior (la publicación de la versión para el inicio; el inicio para lo demás) → hora de recepción, motivo `before_lower_bound`.
- **T4:** en otro caso, la del dispositivo. Esto incluye lo registrado sin conexión y una sesión reanudada al día siguiente.

La hora del dispositivo, su zona, su desfase, la recepción y el motivo se guardan siempre. El entrenador ve «hora de llegada (…)».

**Pruebas:**

- `v2.test.ts` (A-10, T1–T4);
- `execution.test.ts`: T1, T3, y T2 con T4;
- E2E A-10, con el reloj anterior a la publicación;
- E2E-19, pasada la medianoche con una sesión publicada antes.

### 15.8 Base ocupada (A-11)

**Problema:** un bloqueo externo de SQLite detenía todo el servidor (la portada tardó 4,7 s con `busy_timeout` de 5 s).

**Causa raíz:** el controlador es síncrono, así que mientras SQLite espera se detiene todo el proceso; y 5 s era demasiado para una petición.

**Solución:**

- **`BUSY_TIMEOUT_MS = 1000`** (`sqlite.ts`), con la justificación en el código y en ADR-29:
  - con el bloqueo exclusivo, ningún otro proceso de TrainPro escribe, y dentro del proceso no hay esperas;
  - solo espera ante una herramienta ajena;
  - 1 s acota la parada y basta para un punto de control.
- **Errores clasificados** (`storage-errors.ts`):
  - `storage_busy` (`503`, `Retry-After: 2`) y `storage_unavailable` (`503`, `Retry-After: 10`) son recuperables;
  - `storage_error` (`500`: disco lleno, solo lectura, E/S, base dañada) es definitivo hasta que se arregle.
  - En todos los casos la transacción se deshizo entera y nada se da por guardado.
- El móvil reintenta los recuperables; el constructor, también.

**Pruebas:**

- `execution.test.ts`: con otro proceso que tiene la escritura, el comando falla en menos de 2,5 s como `storage_busy`, sin aplicar nada, y el reintento entra una sola vez.
- E2E A-05: base bloqueada al guardar en el constructor.
- E2E A-04: carga concurrente sin ningún `storage_busy`.

**Limitación:** el controlador sigue siendo síncrono. Con varias personas a la vez no escala; está decidido PostgreSQL para la Fase 2.

### 15.9 `local-demo` solo en esta máquina (A-12)

**Problema:** arrancado sin `-H 127.0.0.1`, un `Host` falsificado desde la red daba acceso completo.

**Causa raíz:** la protección dependía de la cabecera `Host` y de un argumento de arranque que se podía omitir.

**Solución** (`src/server/startup.ts`, llamado desde `src/instrumentation.ts` antes de atender peticiones):

- En `local-demo` se lee la dirección **real** de los sockets abiertos del proceso. Si alguna no es de la propia máquina (127.0.0.0/8 o `::1`), el servidor **no arranca** y explica por qué. Si no se puede comprobar, tampoco arranca.
- Se mantiene la comprobación de `Host` de `proxy.ts` (contra el DNS rebinding), que se aplica a todas las rutas, archivos estáticos y acciones.
- **Revisión de rutas y acciones** [I]: las dos rutas de la API, las acciones del constructor, de Configuración (copia y restablecer) y «Entrar como…» resuelven la identidad en el servidor (`getTrainerContext`, `getClientApiContext`). «Entrar como…» solo existe en `local-demo`.
- **`local-demo` no es autenticación:** cualquiera que pueda usar el navegador de este equipo puede entrar como cualquier identidad ficticia. Así lo dicen el README y `SECURITY_PRIVACY.md`.

**Pruebas:**

- `src/server/startup.test.ts`: qué direcciones son de esta máquina; la dirección real del socket; `0.0.0.0` → no arranca, también si además escucha en `127.0.0.1`.
- `e2e/restart.spec.ts`:
  - A-12, con un servidor real y `-H 0.0.0.0`: no arranca y no llega a abrir la base;
  - B1-11: `Host` ajeno → `403`, también en archivos estáticos, y sin conexión desde otra interfaz.

### 15.10 Pruebas deterministas (A-13)

**Problema:** una E2E dependía del día de la semana y fallaba («Empezar igualmente» en lugar de «Empezar entrenamiento»). Además, había otra E2E que fallaba: E2E-19 planteaba un caso imposible tras las reglas de A-10.

**Causa raíz:**

- La semilla calculaba los identificadores y el azar a partir de la fecha absoluta, y el calendario se basaba en días de la semana. Por eso cada día de la semana daba otra estructura.
- E2E-19 ejecutaba una sesión antes de su publicación.

**Solución:**

- **Semilla relativa** a la fecha de siembra (`dataset.ts`, `SEED_VERSION` 3): el azar sale de `cliente:días-desde-hoy`, y el calendario de los días desde hoy módulo 7. Cualquier día da la misma estructura relativa.
- **E2E-19** reescrita con una sesión sembrada y publicada antes, y una E2E aparte para A-10.
- **Barra inferior:** la prueba daba un falso positivo con contenido dentro de un `<details>` cerrado. Ahora usa `checkVisibility` y mide también con el `<details>` abierto.

**Pruebas:** `sessions.test.ts` comprueba la misma estructura en cuatro fechas (lunes, jueves, viernes y sábado). Los scripts de la auditoría que eran útiles son ahora pruebas permanentes:

| Script de la auditoría             | Prueba permanente                                                      |
| ---------------------------------- | ---------------------------------------------------------------------- |
| corte con escrituras (P1)          | `e2e/restart.spec.ts` A-04                                             |
| restauración interrumpida (B5, B6) | `restore.test.ts` y `concurrency.test.ts`                              |
| dos servidores y marca (S, S2)     | `concurrency.test.ts` y `restart.spec.ts` A-03                         |
| navegador compartido (U)           | `client-execution.spec.ts` A-08                                        |
| constructor (U4, U8)               | `builder-protection.spec.ts`                                           |
| base bloqueada (P2)                | `execution.test.ts` (base ocupada) y `builder-protection.spec.ts` A-05 |
| seguridad local                    | `startup.test.ts` y `restart.spec.ts` A-12 y B1-11                     |

### 15.11 Procedencia de lo registrado (A-14)

**Problema:** la procedencia (`self_reported`) no se guardaba ni se mostraba.

**Solución:** migración `003-procedencia` (`DATA_MODEL.md` §5 y `EXECUTION.md` §2):

- **`origin`:** `self_reported`, `direct`, `imported`, `calculated` o `estimated`.
- **`recorded_by`:** `client`, `trainer`, `device` o `system`.
- **`origin_method`:** obligatorio para lo importado, calculado o estimado (fuente, o fórmula y versión).
- Las tres columnas están en `session_log` y `set_log`, con `CHECK`.
- **Motivo del ajuste del reloj:** `clock_adjustment`, `start_clock_adjustment` y `finish_clock_adjustment`.

Hoy todo lo registrado lo autodeclara el cliente (`self_reported`, `client`): lo dice el servidor al escribir, no se deduce en la interfaz. No se inventa ninguna otra procedencia, porque no hay integraciones. A7 y la revisión muestran «Autodeclarado».

**Pruebas:**

- `execution.test.ts`: la migración desde la `002` con valores por defecto, el disparador de inmutabilidad, y que lo que registra el cliente queda autodeclarado en la base y en la vista;
- E2E A-10, con «Autodeclarado».

### 15.12 Copias (A-16, A-17, A-18)

**Hecho:** cada copia queda autosuficiente (diario `DELETE`, sin `-wal` ni `-shm`), con permisos `600`, sincronizada a disco y verificada. La verificación borra los archivos auxiliares que ella misma crea.

**Pendiente (?):** copias programadas y rotación. No están autorizadas.

### 15.13 Validación final

| Prueba                                                                                                                   | Resultado                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check` (formato, lint con capas, tipos, pruebas unitarias y de integración, compilación)                           | Correcto: 23 archivos y 290 pruebas                                                                                                     |
| Compilación de producción desde cero                                                                                     | Sin avisos. Los tres de Turbopack que introdujo la restauración segura se corrigieron en `e060b8f`                                      |
| `pnpm test:e2e` (escritorio y móvil, Pixel 7)                                                                            | 135 correctas y 2 omitidas, dos ejecuciones completas. Las omitidas son pruebas solo de móvil, que se saltan en escritorio (como antes) |
| Persistencia, restauración, concurrencia, arranque y ejecución (`src/server/db`, `startup.test.ts`, `execution.test.ts`) | 91 de 91, tres veces seguidas                                                                                                           |
| `e2e/restart.spec.ts` (servidores reales: reinicios, dos servidores, `0.0.0.0`, corte bajo carga)                        | 18 de 18 (tres repeticiones en serie)                                                                                                   |
| `e2e/builder-protection.spec.ts`                                                                                         | 24 de 24 (tres repeticiones)                                                                                                            |

`restart.spec.ts` usa puertos fijos: sus repeticiones deben ir en serie (`--workers 1`). En una ejecución normal es el único archivo que los usa.

### 15.14 Residual encontrado después (13 nov 2026, PROMPT 15)

Al diseñar el bloque 3 se ha visto por inspección [I] que **las acciones del entrenador distintas de guardar y publicar** (crear sesión, borrar o mover un borrador, copia, restablecer) no devuelven el error tipado de ADR-29. Ante una base ocupada, acaban en la página de error genérica. No se pierde nada (la transacción se deshace entera), pero el mensaje no ayuda.

Propuesta: resolverlo con la página de error de la base, antes del bloque 3 (`BLOCK3_SPEC.md` P-108). No se ha cambiado código en esta entrega.

La definición de «cumplimiento» que pedía el §14.6 está ahora propuesta en `BLOCK3_SPEC.md` §5 (P-90).

### 15.15 Riesgos que permanecen

1. **Windows sin ejecutar en Windows** (A-23): el bloqueo (`LockFileEx`), `rename` y la ausencia de `fsync` del directorio están documentados, no probados.
2. **Controlador síncrono** (A-11): adecuado para una persona en un equipo, no para varios usuarios.
3. **Lo pendiente vive en el navegador:** se pierde si se borran los datos del sitio antes de enviarlo (Q4, `EXECUTION.md` §11).
4. **`local-demo` no es autenticación:** solo para datos ficticios.
5. **Página de error de la base** (A-15) sin hacer.
6. **Historial de Git:** `8067eff` no compila por sí solo (usa la restauración de `099f0e7`). No se ha reescrito el historial.
