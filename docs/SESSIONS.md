# Sesiones: publicación, ejecución y registro

> Fase 7. Implementa `MASTER_SPECIFICATION.md` §9 (aplicación del cliente), §4.5 (modo sin conexión) y el criterio de aceptación de §16.2: «registrar una sesión completa sin conexión y sincronizar sin duplicados».
>
> Lo que **no** hace esta fase: proponer cambios de carga a partir de los registros (eso llega en las Fases 8–11) ni diagnosticar nada. El dolor solo muestra «Si el dolor persiste o es intenso, consulta con un profesional sanitario» y avisa al entrenador.

## 1. Flujo

```
Entrenador: plan ACTIVO → publica (sesión | semana | plan)
Cliente:    Hoy → sesión → ✓ por serie (sin conexión también) → «No puedo hacer este ejercicio» → Terminar sesión
Servidor:   /sync idempotente → registros (o marcados para revisión) → aviso al entrenador si procede
Entrenador: Hoy (sesiones de hoy, revisión) → ficha del cliente › Sesiones → decide sustituciones, revisa registros
            Modo sala: el mismo reproductor, registrando en nombre del cliente
```

## 2. Publicación

| Regla | Detalle |
|---|---|
| Solo planes activos | Publicar en un plan en borrador devuelve `conflict` («Activa el plan antes de publicar»). Retirar siempre está permitido. |
| Alcance | Una sesión, una semana o el plan entero (`POST /sessions/publish`). |
| El cliente solo ve lo publicado | Una sesión no publicada **no existe** para el cliente (404), tanto en la agenda como en el reproductor. |
| Auditoría | Cada publicación o retirada queda en el historial con el número de sesiones afectadas. |

## 3. Reproductor (cliente y modo sala)

Una sola página (`/me/sesion/{id}`), pensada para una mano y la pantalla del móvil:

- **Texto para el cliente** de la prescripción («3 series de 8 repeticiones dejando aproximadamente 2 repeticiones en reserva»), notas del entrenador para el cliente y la **última vez** que hizo el ejercicio.
- **Cómo hacerlo**: descripción, indicaciones para el cliente (`audience` cliente o ambos) y **solo vídeos verificados**, incrustados con `youtube-nocookie`/Vimeo (§28).
- **Registro con un toque**: cada serie viene precargada (`preloadSet`: lo prescrito; si no hay carga prescrita, la de la última vez; las series siguientes parten de la anterior). ✓ la registra tal cual; se puede corregir kg y repeticiones antes. El campo de kg no aparece en ejercicios sin carga.
- **RIR** con chips 0–4+. RIR y RPE no se mezclan (validación compartida `validateSetLog`).
- **Descanso**: temporizador con +30 s y «Saltar»; vibra al terminar si el móvil lo permite.
- **«No puedo hacer este ejercicio»**: motivo (dolor, material, dificultad, espacio, preferencia, fatiga). Ver §5.
- **Terminar sesión**: si faltan series, pide el motivo; RPE de la sesión (CR-10, 0–10, con anclas), fatiga, motivación, comentario y, opcionalmente, dolor (intensidad y zona).
- Estado de sincronización siempre visible: «Sincronizado», «Sin conexión · 3 pendientes» y, por serie, «Pendiente de enviar», «Guardado» o «Guardado; tu entrenador/a lo revisará».

**Modo sala** (`/app/clients/{id}/sessions/{id}/sala`): el entrenador usa el mismo reproductor. Los registros quedan con `logged_by_role = trainer`, y sus sustituciones se aprueban en el momento. El modo sala se abre en edición aunque la sesión ya esté cerrada.

## 4. Sin conexión (§4.5)

| Pieza | Implementación |
|---|---|
| Instalación | PWA: `public/manifest.webmanifest` e `icon.svg`. |
| Service worker | `public/sw.js`, escrito a mano para que sea pequeño y auditable. Los recursos estáticos (con hash) van primero a caché. Las páginas `/me…` van primero a red y, sin conexión, se sirve la última copia. La API **nunca** se guarda en caché. Al cerrar sesión, se borran las páginas cacheadas. |
| Cola | `apps/web/src/lib/offline-queue.ts`: cada acción se escribe **primero en IndexedDB** (con memoria como respaldo) y después se envía en orden a `POST /sync`. Se reintenta al recuperar la conexión y al volver a primer plano. |
| Idempotencia | Cada mutación lleva un `clientMutationId` generado en el dispositivo, único en `set_logs` y `exercise_substitutions`. Reenviar la misma mutación devuelve `duplicate` y no crea nada. El cierre de sesión es un *upsert* por sesión; el dolor no se duplica. |
| Corregir una serie | Volver a registrar la misma serie (mismo ejercicio, número y lado) **actualiza** el registro en lugar de añadir otro. |
| Fallos parciales | `/sync` procesa cada mutación en su propio *savepoint*. Una mutación inválida se devuelve como `rejected` con su motivo, sin bloquear las demás, y el dispositivo la retira de la cola. Un fallo de red conserva la cola entera. |

**Conflictos: nunca se pierde un registro** (`syncConflict`). El servidor manda, pero guarda lo que hizo el cliente y lo **marca para revisión** (`needs_review` y `review_reason`) cuando:

1. el ejercicio ya no está en la sesión (el registro queda sin `session_exercise_id`);
2. la sesión dejó de estar publicada;
3. la sesión o el ejercicio se editaron después de descargarlos (`downloadedAt`);
4. se hizo un ejercicio distinto del prescrito sin una alternativa aprobada.

## 5. Sustitución en vivo (§9.3)

- **Alternativas preaprobadas**: el entrenador las elige en el editor de sesión (hasta 5 por ejercicio; nunca el mismo ejercicio). En la demo se rellenan con las regresiones y variantes del grafo de progresiones.
- Si el cliente elige una alternativa preaprobada, el cambio se aplica al momento, también sin conexión.
- En cualquier otro caso, la sustitución queda **pendiente** y se avisa a los entrenadores asignados.
- **Dolor**: siempre muestra el mensaje de derivación y siempre avisa al entrenador, aunque se elija una alternativa aprobada.
- **Avisos**: el cliente no puede escribir notificaciones (RLS). Usa la función `SECURITY DEFINER` `notify_client_trainers(cliente, …)`, que solo admite su propio registro de cliente (o personal) y solo notifica a sus entrenadores activos. Hay un test que comprueba que un cliente no puede notificar sobre otro.
- **Decisión del entrenador**: aprobar (eligiendo el ejercicio, y opcionalmente añadirlo como alternativa permanente) o rechazar. Al aprobar, los registros marcados solo por «ejercicio distinto» dejan de estar pendientes. Todo queda auditado.

## 6. Cierre, valoración y bienestar

| Dato | Regla |
|---|---|
| Asistencia | `completed`, `partial` o `missed`. Si no se indica, se calcula a partir de las series registradas (`sessionCompletion`). Parcial o no realizada **exige motivo**. |
| RPE de la sesión | CR-10 (0–10) de la sesión completa, como en el método sRPE. Se guarda tal cual; la carga interna (sRPE × minutos) se calculará en la Fase 8. |
| Dolor | Dato de salud (art. 9 RGPD): **solo se guarda con consentimiento de datos de salud**. Sin consentimiento se muestra el mensaje y no se almacena (`painStored: false`). A partir de 4/10 (umbral práctico, nivel F, configurable) se avisa al entrenador. |
| Bienestar diario | «¿Cómo llegas hoy?» (energía, sueño, agujetas, 0–10). Opcional, uno por día. Es contexto para el entrenador, nunca un diagnóstico. |

## 7. Vistas del entrenador

| Dónde | Qué |
|---|---|
| `/app` (Hoy) | Sesiones de hoy de sus clientes (con acceso al modo sala) y bandeja de revisión: sustituciones pendientes y registros marcados. RLS limita la bandeja a los clientes asignados. |
| Plan › Semanas | Publicar o retirar cada semana o el plan entero; «publicada» en cada sesión. |
| Editor de sesión | Publicar o retirar, alternativas aprobadas y enlace a «Registro y modo sala». |
| Cliente › Sesiones | Sesiones publicadas pasadas y registradas: asistencia, RPE, dolor, registros a revisar y sustituciones pendientes. |
| `/app/clients/{id}/sessions/{id}` | Cumplimiento, valoración, asistencia, registros por serie frente a lo prescrito, decisiones y «Marcar revisado». |

## 8. Permisos

| Permiso | ADMIN | TRAINER | CLIENT |
|---|---|---|---|
| `sessions:read` | Organización | Asignados | Propio (solo publicadas) |
| `sessions:log` | Organización | Asignados (modo sala) | Propio |
| `sessions:publish` · `sessions:review` | Organización | Asignados | ✗ |

Las tablas de seguimiento son de tipo `client_owned`, con escritura del cliente. Lo que queda fuera de ámbito devuelve 404.

**Limitación conocida:** la RLS de `sessions` permite al cliente leer filas de sus sesiones no publicadas. El filtro «solo publicadas» se aplica en la aplicación y está cubierto por tests de integración y E2E. Llevarlo también a la RLS es una mejora pendiente.

## 9. Reestructuración, fase 8: Hoy en el móvil, fichaje y feedback

**Tarjeta de cada ejercicio** (UX_FLOW §2.6), en este orden:
1. silueta con los músculos que trabaja (dibujada en el móvil, funciona sin conexión);
2. **▶ Ver vídeo**, solo si hay un vídeo verificado. No se contacta con el proveedor hasta que se pulsa;
3. series con reps, carga y RIR, y ✓ para registrar cada una;
4. **¿Cómo fue?** Fácil · Normal · Difícil · Muy difícil (la escala de los documentos del usuario);
5. **¿Molestias?** No · Algo · Mucho.
   - Con «Algo» o «Mucho» se puede añadir cuánto (0–10). Ese número es el que usan las alertas de dolor.
   - Es dato de salud: solo se guarda con consentimiento y siempre muestra el mensaje de consultar con un profesional.

Todos los botones miden al menos 48 px de alto. Al terminar, **¿Cómo fue?** de la sesión entera, además del RPE de sesión (0–10) que usa la carga interna.

**Fichaje automático** (§41):

| Estado | Cuándo |
|---|---|
| Planificada | Publicada y sin registro |
| Iniciada | Al registrar la primera serie |
| Completada / Incompleta | Al cerrarla el cliente o el entrenador |
| Incompleta (automática) | Se inició y no se cerró. El trabajo diario la cierra al pasar el día en que se empezó |
| No realizada (automática) | Pasó el día sin ningún registro. Mira los últimos 30 días |

- Lo automático queda marcado (`attendance.automatic`, sin `recorded_by`).
- El cliente o el entrenador pueden cerrarla después y su registro lo sustituye.
- Una sesión «Iniciada» cuenta como realizada para la adherencia.

**RLS «solo publicadas»**: la base de datos ya no deja al cliente leer sesiones sin publicar. Tampoco sus bloques, ejercicios ni series, aunque un caso de uso olvidara el filtro.

## 10. Pendiente

| Elemento | Fase |
|---|---|
| ~~Carga interna (sRPE × duración), adherencia y alertas a partir de los registros~~ Hecho: ver `MONITORING.md` | 8 |
| Propuestas de progresión (doble progresión, ajuste por RIR) a partir de los registros, como recomendaciones | 8–11 |
| Notificaciones push y por correo (ahora solo dentro de la app) | 13 |
| Reabrir una sesión cerrada desde el móvil del cliente (ahora la corrige el entrenador) | Según uso |
