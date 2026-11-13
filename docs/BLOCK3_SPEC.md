# Bloque 3 · Análisis del entrenamiento

**Estado:** especificación consolidada, versión 2 (13 de noviembre de 2026, PROMPT 16).

- **Aprobadas:** las decisiones P-90 a P-95 (ADR-33).
- **No autorizada:** la implementación de cualquier etapa (B3.0 a B3.3).
- **Sin cambios:** este documento no modifica código, base de datos ni dependencias.

| Versión | Fecha       | Cambios                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1       | 13 nov 2026 | Propuesta inicial (commit `cd2aa52`, PROMPT 15): inventario de datos, cumplimiento multidimensional, volumen, carga interna, pantallas, decisiones P-90 a P-113                                                                                                                                                                                                                                                                    |
| 2       | 13 nov 2026 | <ul><li>P-90 a P-95 aprobadas e incorporadas con tus matices: tres niveles (diferencia, condición e interpretación), dos perspectivas de la prescripción, fechas, semana ISO y duración.</li><li>Auditoría de volumen y tonelaje, y del modelo por origen del dato.</li><li>Contradicciones encontradas y su resolución.</li><li>Decisiones clasificadas por etapa.</li><li>Plan B3.0–B3.3.</li><li>Revisión científica.</li></ul> |

**Relación con otros documentos:**

- Refina `V1_SPEC.md` §6 y el bloque 3 de su §9.
- Toma las definiciones de volumen de `EFFORT_AND_LOAD.md` §10 y las de carga interna de `PROGRESSION_AND_AUTOREGULATION.md` §6 y §7.
- Si algo choca, manda este documento para el bloque 3 y el otro se corrige; las contradicciones encontradas están en el §18.

**Leyenda:**

| Marca | Significado                                             |
| ----- | ------------------------------------------------------- |
| **P** | Comprobado mediante pruebas                             |
| **I** | Comprobado mediante inspección del código o del esquema |
| **D** | Documentado, pero no verificado                         |
| **N** | No existe                                               |
| **?** | Pendiente de tu decisión (§16)                          |

## 1. Resumen

El bloque 3 convierte lo registrado en el bloque 2 en análisis para el entrenador. Responde a cinco preguntas:

1. Qué se había planificado.
2. Qué se ha realizado.
3. Qué diferencias hay.
4. Qué información falta.
5. Qué se puede concluir y qué no.

| Etapa    | Contenido                                                                                                                                                           | Esquema de la base                           |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **B3.0** | Página de error de la base; errores tipados en las acciones del entrenador que no los tienen; generadores de datos de prueba para el análisis                       | Sin cambios                                  |
| **B3.1** | Análisis de una sesión (A8): prescripción frente a ejecución, cumplimiento por dimensiones, volumen por magnitud, duración con advertencias; totales diarios; panel | Sin cambios                                  |
| **B3.2** | Cliente por semanas y periodos (A9); evolución de un ejercicio (A10); volumen por patrón; vistas existentes corregidas («Carga», «Resultados» y «Progreso»)         | Sin cambios                                  |
| **B3.3** | RPE global de la sesión y carga interna estimada                                                                                                                    | Tabla nueva, solo de añadir (si se autoriza) |

**Exclusiones:**

- índice o puntuación global de cumplimiento;
- recomendaciones o cambios automáticos de la prescripción;
- diagnóstico de fatiga;
- estimación del 1RM;
- cociente agudo:crónico, monotonía y _strain_;
- trabajo mecánico;
- volumen por grupo muscular o por cualidad;
- rankings de clientes;
- análisis nuevo para la clienta.

## 2. Datos: qué existe de verdad

Comprobado en el esquema (migraciones `001`–`003`), el dominio, los servicios y una base sembrada. Que un dato aparezca en la documentación o en la semilla no basta.

### 2.1 Por origen del dato

| Origen                                                | Qué incluye                                                                                                                                                                                                                                                                              | Estado |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **Persistido, registrado por la clienta al ejecutar** | <ul><li>Cada serie: hecha o no; repeticiones, segundos o metros; carga en su modalidad; RIR y RPE con escala; observación; horas.</li><li>Inicio y fin, total de pausas, motivo del fin y comentario final.</li><li>Procedencia `self_reported` · `client`.</li></ul>                    | I, P   |
| **Introducido por el entrenador**                     | <ul><li>La prescripción de cada versión (series, repeticiones o rango, carga y base, esfuerzo objetivo, descanso, tempo, duración estimada).</li><li>Notas de la sesión y de cada ejercicio (visibles y privadas).</li><li>Fecha prevista y orden, **dentro de cada versión**.</li></ul> | I, P   |
| **Derivado por cálculo**                              | Serie efectiva, fecha de ejecución, estado de la sesión, diferencias por serie, totales y duraciones                                                                                                                                                                                     | I, P   |
| **Importado**                                         | Nada (0 filas con `origin = imported`)                                                                                                                                                                                                                                                   | I      |
| **Estimado**                                          | Nada                                                                                                                                                                                                                                                                                     | I      |
| **Generado por la semilla (ficticio)**                | <ul><li>Ejecuciones y series de ejemplo, con la procedencia por defecto `self_reported` (simulada).</li><li>**`perceived_effort` (0–10) sin escala**: en una base sembrada aparece en 31 de 44 ejecuciones. **El bloque 2 nunca lo registra.**</li></ul>                                 | I      |
| **Datos de referencia en el código**                  | La biblioteca: patrón principal y secundarios, región corporal y etiquetas de cualidad de cada variante                                                                                                                                                                                  | I      |

### 2.2 Dato a dato

| Dato                                                | Estado                                 | Detalle                                                                                                                                                                |
| --------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RPE de la sesión**                                | **N** (solo en la semilla, sin escala) | No se puede usar para carga interna (§7)                                                                                                                               |
| **RIR por serie**                                   | I, P                                   | Opcional, y **solo si se prescribió**: sin objetivo no se puede registrar. **Nunca se rellena por defecto**                                                            |
| **RPE por serie**                                   | I, P                                   | Igual que el RIR, con la escala de la prescripción                                                                                                                     |
| **Descanso real**                                   | **N**                                  | El temporizador vive en el móvil y no se envía                                                                                                                         |
| **Duración**                                        | I, P (parcial)                         | Inicio, fin y **total** de pausas. **No se guarda la hora de cada pausa** (`client_command` solo guarda la hora de recepción, no la del dispositivo)                   |
| **Fecha de ejecución**                              | I, P                                   | Fecha local del inicio en la **zona del dispositivo** (`executionDate`)                                                                                                |
| **Fecha prevista**                                  | I, P                                   | En **cada versión** (`content.plannedDate`). `session.planned_date` guarda **solo la vigente**: publicar una versión con otra fecha la sobrescribe                     |
| **Carga y modalidad**                               | I, P                                   | `load_kg` cambia de significado según `load_kind`: kg totales, lastre, asistencia u opcionales. La base (total, por lado, por implemento) solo está en la prescripción |
| **Versiones de la prescripción**                    | I, P                                   | Inmutables, con autor y hora de publicación; cada serie guarda la suya; la ejecución guarda la de inicio                                                               |
| **Motivo de una serie no realizada**                | **N**                                  | Solo «no realizada»                                                                                                                                                    |
| **Observaciones de la clienta**                     | I, P                                   | Por serie (300 caracteres) y comentario final (500)                                                                                                                    |
| **Observaciones del entrenador sobre la ejecución** | **N**                                  | Solo las notas de la prescripción. Anotaciones: §13                                                                                                                    |
| **Valores propuestos frente a editados**            | **N**                                  | Repeticiones, tiempo, distancia y carga **se rellenan con lo prescrito** (en los rangos, con el mínimo). No se sabe si la clienta los cambió                           |

### 2.3 Lo que hay en una base sembrada

Consulta de solo lectura sobre una base de las pruebas:

- **Modalidades prescritas:** solo kg externos con base «total», peso corporal y «otra». No hay lastre, asistida, bandas, dispositivo, autoseleccionada, %1RM, «por implemento», «por lado», prescripción por serie ni repeticiones «por lado».
- **Tipos de serie:** repeticiones fijas y en rango, segundos y metros.
- **Esfuerzo:** RIR, RPE y **5 objetivos de tipo «carácter»**, que no tienen nada registrable con lo que compararlos.
- **Ejecución:** no hay pausas, ni versiones posteriores a la primera, ni correcciones.

**Las pruebas del bloque 3 necesitarán escenarios generados** (B3.0).

### 2.4 Qué se puede construir sin cambiar el esquema

| Funcionalidad                                       | ¿Sin cambios?                      | Condición                                       |
| --------------------------------------------------- | ---------------------------------- | ----------------------------------------------- |
| B3.0 completo                                       | Sí                                 | —                                               |
| A8, totales diarios y panel (B3.1)                  | Sí                                 | Con la advertencia de huecos aproximada (P-116) |
| A9, A10, patrones y vistas corregidas (B3.2)        | Sí                                 | Patrones desde la biblioteca del código         |
| «Pendientes de revisar» exacto en el panel          | No: necesita marcas de lectura     | Aproximación sin esquema en B3.1 (P-111)        |
| Advertencia de huecos exacta                        | No: necesita la hora de cada pausa | P-116 c)                                        |
| Saber si un valor se editó o se aceptó el propuesto | No                                 | P-119                                           |
| RPE de la sesión y carga interna (B3.3)             | No: tabla nueva                    | Q2, P-101, P-112                                |
| Correcciones justificadas y anotaciones             | No                                 | P-109                                           |

### 2.5 Hallazgos

1. **`perceived_effort` es de la semilla** y la pestaña «Registro» lo muestra como «esfuerzo percibido X/10» sin escala [I]. P-102.
2. **Las vistas de volumen existentes no usan la misma fecha** [I]:
   - «Carga» y la pestaña «Resultados» del entrenador agrupan por fecha **prevista**;
   - el «Progreso» de la clienta, por fecha **de ejecución**.

   P-93 lo resuelve a favor de la fecha de ejecución; se corrige en B3.2.

3. **El tonelaje 1.0.0 toma los kg «externos» sin mirar la base** [I]. Hoy no se nota porque solo hay base «total».
4. **Las vistas de la Fase 1 comparan con la versión vigente**, no con la de cada serie [I]. A7 sí lo hace bien.
5. **La duración incluye los cortes sin pausa** [I], y con horas ajustadas (ADR-28) puede salir incoherente (fin anterior al inicio en hasta 5 min). Hace falta una protección (§4.5).
6. **Los valores se proponen con lo prescrito** [I]: una «coincidencia» de repeticiones o carga puede significar que no se cambió el valor. El esfuerzo no tiene este problema porque no se rellena.
7. **La fecha prevista cambia con las versiones** [I], y `session.planned_date` solo conserva la vigente. La original se reconstruye desde el contenido de las versiones.
8. **Residual de A-11** [I]: crear sesión, borrar o mover un borrador, copia y restablecer no devuelven el error tipado de base ocupada. Se aborda en B3.0.
9. **`EXECUTION.md` §2 decía «zona de la aplicación»** para la fecha de ejecución; el código y `V1_SPEC.md` usan la zona del dispositivo. Corregido en la documentación (§18).

## 3. Decisiones aprobadas y cómo se aplican

### 3.1 P-90 · Cumplimiento multidimensional

- **Cuatro dimensiones independientes:**
  - **estructural:** ejercicios y series;
  - **cuantitativa:** repeticiones, segundos y metros;
  - **intensidad:** carga;
  - **esfuerzo:** RIR y RPE.
- **Un apartado cualitativo descriptivo**, sin puntuación.
- **Sin índice global** ni puntuación compuesta.
- **Valores observados con su denominador.**

### 3.2 P-91 · Diferencias con tolerancia cero, en tres niveles

| Nivel                             | Qué es                                                                                                             | Lo calcula TrainPro                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| **1. Diferencia observada**       | El número: «−3 kg», «+1 RIR», «7 rep. (rango 8–10, −1 respecto al mínimo)»                                         | Sí, siempre, sin márgenes que la oculten |
| **2. Condición prescrita**        | Si lo hecho satisface la forma de lo prescrito: un valor fijo (coincide o es distinto) o un rango (dentro o fuera) | Sí, factual                              |
| **3. Interpretación profesional** | Si la diferencia importa y por qué                                                                                 | **No: la hace el entrenador**            |

**Tus ejemplos, tal como se mostrarán:**

| Prescrito | Hecho | Nivel 1               | Nivel 2                         |
| --------- | ----- | --------------------- | ------------------------------- |
| 8–10 rep. | 9     | —                     | **Dentro del rango**            |
| 8–10 rep. | 7     | −1 respecto al mínimo | **Fuera del rango, por debajo** |
| 40 kg     | 37 kg | **−3 kg** (−7,5 %)    | Distinto de lo prescrito        |
| RIR 2     | RIR 2 | —                     | **Coincide**                    |
| RIR 2     | RIR 3 | **+1**                | Distinto de lo prescrito        |

**Vocabulario permitido:** «coincide», «distinto de lo prescrito», «dentro del rango», «fuera del rango (por debajo o por encima)», «sin dato», «no aplica», «no realizada» y «sin registrar».

**Vocabulario que no se usa:** «incumplimiento», «no cumplido», «mal», «más o menos exigente», ni colores de semáforo. Las diferencias se destacan con un estilo neutro.

### 3.3 P-92 · Prescripción original y vigente

| Perspectiva  | Definición aprobada                                                 | Cómo se reconstruye                                                                                                                      |
| ------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Original** | La instrucción que recibió la clienta en el momento correspondiente | **Serie registrada:** la versión de su registro (`set_log.version_number`) [I, P]. **Lo no registrado:** regla propuesta en P-117 (§4.2) |
| **Vigente**  | La prescripción actual del entrenador                               | `session.current_version` [I, P]                                                                                                         |

**Comprobación A:** las versiones se pueden vincular de forma fiable a cada ejecución [I, P].

- Son inmutables (disparadores probados).
- Cada serie guarda la suya.
- La ejecución guarda la de inicio.
- Cada versión tiene su hora de publicación.

La vista histórica no cambia aunque el entrenador publique después: la nueva versión es otra fila.

**Límite:** para lo **no registrado**, lo que vio la clienta no se guarda; se deduce con la regla de P-117.

**Cambio respecto a la versión 1:** se retira la tercera vista («primera versión publicada»), que no está en lo aprobado. El historial de versiones (bloque 5) ya permite ver cada versión.

### 3.4 P-93 · Fecha prevista y fecha de ejecución

- **La planificación** (lo prescrito, sesiones previstas y cumplimiento de lo planificado) se organiza por **fecha prevista**.
- **La carga ejecutada** (volumen y tonelaje hechos) se organiza por **fecha de ejecución**.
- Se conservan y se muestran **las dos**.

**Comprobación B:** la fecha de ejecución se recupera de forma fiable y no se confunde con la prevista [I, P].

- Es la fecha local del inicio en la zona del dispositivo, guardada con la ejecución.
- Las series de después de medianoche pertenecen a su sesión (probado: E2E-19).
- Si el inicio usó la hora de recepción (ADR-28, T2/T3), la fecha sale de esa hora y se marca como «hora ajustada».

**Consecuencias en consultas, agregaciones, filtros y gráficos:**

| Ámbito           | Regla                                                                                                                                                                                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Consultas**    | Dos ventanas: por `planned_date` (vigente), y por `session_log.started_at` con un margen de ±1 día en UTC, filtrando después por la fecha local. Para la fecha prevista original se leen las versiones (P-118)                                                               |
| **Agregaciones** | <ul><li>Lo planificado y su cumplimiento, por fecha prevista.</li><li>Lo ejecutado, por fecha de ejecución.</li><li>**Nunca** se suman en un mismo total magnitudes agrupadas por fechas distintas.</li></ul>                                                                |
| **Filtros**      | Cada bloque de la pantalla indica su base: «según fecha prevista» o «según fecha de ejecución». Un filtro de periodo se aplica a cada bloque sobre su propia base                                                                                                            |
| **Gráficos**     | En «planificado frente a ejecutado» por semana, una sesión trasladada aparece en la semana prevista (planificado) y en la de ejecución (ejecutado), marcada «trasladada», y la tabla equivalente lo lista. Sin esa marca, una semana parecería con déficit y otra con exceso |
| **A3**           | Es una vista de planificación: su cabecera muestra **el estado de las sesiones previstas** ese día, no «el total realizado del día». Lo hecho de esas sesiones se muestra con su fecha real                                                                                  |

### 3.5 P-94 · Semana ISO

- Lunes a domingo, numerada según ISO 8601.
- Se calcula **sobre fechas locales** (las de ejecución o las previstas), no sobre instantes UTC.

**Comprobación C** [P]: `isoWeekKey` y `startOfIsoWeek` coinciden con una implementación independiente de ISO 8601 en los **5.114 días de 2019 a 2032**, sin ninguna discrepancia (verificación de solo lectura, 13 nov 2026).

| Caso                                                  | Resultado                            |
| ----------------------------------------------------- | ------------------------------------ |
| 28 dic 2026 – 3 ene 2027                              | **2026-W53** (2026 tiene 53 semanas) |
| 4 ene 2027                                            | 2027-W01                             |
| 31 dic 2020 – 3 ene 2021                              | 2020-W53                             |
| 29 dic 2025                                           | 2026-W01                             |
| Inicio a las 23:50 del 31 dic 2026 en Madrid          | 31 dic → 2026-W53                    |
| Inicio a las 00:10 del 1 ene 2027 en Madrid           | 1 ene → 2026-W53                     |
| El mismo instante en Nueva York                       | 31 dic (la zona del inicio importa)  |
| Domingo 3 ene, 23:30, y lunes 4 ene, 00:30, en Madrid | 2026-W53 y 2027-W01                  |

**Para la interfaz:**

- Una semana que cruza el año se rotula con sus fechas («28 dic 2026 – 3 ene 2027»), no solo con «W53».
- El cambio de hora no afecta, porque se trabaja con fechas locales; ya está probado.

### 3.6 P-95 · Duración

| Dato                      | Definición                                                               |
| ------------------------- | ------------------------------------------------------------------------ |
| **Duración transcurrida** | Fin − inicio                                                             |
| **Pausas registradas**    | `paused_seconds`, la suma de las pausas que la clienta hizo con «Pausar» |
| **Duración calculada**    | Transcurrida − pausas registradas                                        |
| **Advertencias**          | Sobre la fiabilidad del dato (§4.5)                                      |

**Lo que no se hace:**

- descontar los huecos;
- suponer que la clienta estuvo inactiva;
- modificar ningún registro.

**Comprobación D:** sin protecciones habría resultados absurdos. El §4.5 define qué se muestra en cada caso.

**Límite:** el modelo no guarda dónde ocurrió cada pausa, así que no se puede saber con certeza si un hueco tuvo una pausa registrada (P-116).

**Cambio respecto a la versión 1:** se deja de llamar «activa» a la duración calculada, porque eso presupone actividad. Que una duración con advertencia entre o no en medias y totales de periodo queda pendiente (P-114).

**Comprobación E:** con el §3.2, ninguna diferencia numérica se convierte en un juicio. Las listas de «incumplimientos repetidos» de la versión 1 pasan a «diferencias repetidas respecto a lo prescrito» (P-104).

## 4. Reglas comunes

### 4.1 Qué cuenta

- **Solo las series efectivas:** un reenvío o una corrección cuentan una vez.
- **Una serie «no realizada»** no suma magnitudes, pero cuenta como prescrita.
- **Una sesión en curso o interrumpida** se analiza con lo confirmado, y la pantalla lo dice.
- **Solo lo confirmado por el servidor.**
- **`perceived_effort` de la semilla no se usa.**

### 4.2 Prescripción de referencia (P-92 aprobada; P-117 pendiente)

| Caso                                            | Original                                                                                                                                        | Vigente           |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Serie registrada                                | La versión de su registro (dato)                                                                                                                | `current_version` |
| Serie sin registrar en una sesión empezada      | **P-117 (propuesta):** la versión del último registro de la sesión o, si no hay, la de inicio                                                   | `current_version` |
| Sesión sin empezar                              | **P-117 (propuesta):** la versión vigente al terminar el día previsto (23:59:59 en la zona de la aplicación); si se publicó después, la primera | `current_version` |
| Serie registrada que ya no existe en la vigente | Su versión; se lista como «fuera de la versión vigente»                                                                                         | No existe en ella |

Los **totales prescritos** de cada perspectiva se calculan serie a serie con su referencia.

### 4.3 Fechas

Además de P-93 (§3.4):

- **Varias sesiones el mismo día:** cada magnitud se suma por separado; nunca se promedian porcentajes.
- **Semanas con distinto número de sesiones:** totales con el número de sesiones; una media solo con su denominador.
- **Sesión trasladada:** prevista aquí y hecha el día X (con fecha); su carga ejecutada cuenta el día X.
- **Fecha prevista que cambia entre versiones:** la planificación original usa la de la versión original y la vigente, la vigente (P-118, antes de B3.2). Hoy no hay ninguna interfaz que cambie la fecha de una sesión publicada (bloque 5).

### 4.4 Semana

Semana ISO (§3.5). Una entidad «bloque» de entrenamiento no existe: el entrenador elige un rango de fechas, sin guardarlo, hasta que exista la planificación (Fase 6 y V4).

### 4.5 Duración: casos y advertencias

| Situación                                                                                           | Qué se muestra                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Terminada, sin huecos de más de 30 min                                                              | Transcurrida, pausas registradas y calculada                                                                                                                                |
| Terminada, con un hueco entre actividades consecutivas (inicio, cada serie, fin) mayor de 30 min    | Lo mismo, más la advertencia: «La duración puede no representar el tiempo real de entrenamiento: hubo X min sin actividad entre las 21:10 y las 06:15». Niveles según P-116 |
| Sin terminar (en curso o interrumpida)                                                              | «Sin duración: la sesión no se ha terminado», con el inicio y la última actividad                                                                                           |
| Incoherente: fin anterior al inicio, o pausas mayores que la transcurrida (horas ajustadas, ADR-28) | «Datos de tiempo incoherentes», con las horas tal como están. No se calcula nada                                                                                            |
| Prevista (`estimatedMinutes`)                                                                       | Al lado, si existe; sin calcular ninguna diferencia porcentual                                                                                                              |

**G = 30 min** es tu decisión (P-95), no un valor científico.

## 5. Cumplimiento: definición aprobada aplicada

### 5.1 Dimensiones

| Dimensión                              | Unidad de cálculo                     | Nivel 2 (condición)                                                                                                                                                                                                                                                                          | Resumen con denominador                                                                              |
| -------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Estructural**                        | Ejercicio y serie de la referencia    | <ul><li>Serie: hecha, no realizada o sin registrar.</li><li>Ejercicio: completo, parcial, no realizado o sin registrar.</li></ul>                                                                                                                                                            | «5 de 6 series hechas · 1 no realizada»                                                              |
| **Cuantitativa**                       | Serie hecha, según su tipo            | Repeticiones, segundos o metros: coincide o distinto (valor fijo); dentro o fuera del rango                                                                                                                                                                                                  | «29 de 30 rep.» · «60 de 90 s» · «2 de 3 series en el rango»                                         |
| **Intensidad**                         | Serie hecha con carga comparable      | <ul><li>Kg (misma modalidad y base): coincide, distinto, o dentro o fuera del rango.</li><li>Lastre y asistencia: lo mismo, en su magnitud.</li><li>Bandas, dispositivo y «otra»: mismo descriptor o distinto.</li><li>Autoseleccionada, peso corporal o sin carga: **no aplica**.</li></ul> | «2 de 3 series con una carga distinta de la prescrita»                                               |
| **Esfuerzo**                           | Serie hecha con objetivo de RIR o RPE | <ul><li>Coincide, distinto, o dentro o fuera del rango.</li><li>**Sin dato** si se prescribió y no se registró.</li><li>**No aplica** con escalas distintas o con objetivos de carácter o de calidad (no hay nada registrable que comparar).</li></ul>                                       | «1 de 3 series con el RIR prescrito · 2 distintas · 0 sin dato»                                      |
| **Cualitativa** (apartado descriptivo) | Sesión, ejercicio y serie             | Sin condición ni puntuación                                                                                                                                                                                                                                                                  | Observaciones, comentario, correcciones, versiones, cierre parcial, horas ajustadas y datos ausentes |

### 5.2 Ejemplo (E2E-1 ampliado)

**Prescripción v1:**

- Sentadilla trasera: 3 × 10 × 60 kg, RIR 2.
- Plancha: 3 × 30 s.

**Realizado:**

- Sentadilla: 10 × 60 RIR 2 · 10 × 60 RIR 1 · 9 × 60 RIR 0.
- Plancha: 30 s · 30 s · no realizada.
- Terminada como parcial.

| Dimensión    | Se muestra                                                                                           |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| Estructural  | Sentadilla completa · plancha parcial · **5 de 6 series** · 1 no realizada                           |
| Cuantitativa | Sentadilla **29 de 30 rep.** (serie 3: −1) · plancha **60 de 90 s** (2 de 2 series hechas coinciden) |
| Intensidad   | **3 de 3** series de sentadilla con la carga prescrita                                               |
| Esfuerzo     | **1 de 3** con el RIR prescrito · **2 distintas** (RIR 1, −1; RIR 0, −2) · 0 sin dato                |
| Tonelaje     | Prescrito **1.800 kg** · ejecutado **1.740 kg**                                                      |
| Cualitativo  | Cierre parcial; versión v1; sin correcciones ni observaciones                                        |

No se muestra ningún porcentaje global, ni «más exigente», ni ningún juicio.

### 5.3 Agregación

- Por ejercicio, sesión, día, semana y periodo: se suman recuentos y magnitudes y se recalculan las fracciones. Nunca se promedian porcentajes.
- Entre dimensiones: nada.
- «Sin dato» y «no aplica» se muestran siempre aparte y no entran en el denominador de la condición.

### 5.4 Límites que la pantalla dice

- **Valores propuestos:** las repeticiones, el tiempo y la carga se proponen con lo prescrito. Una coincidencia indica que no se cambiaron, no que se midieran (§2.5.6). El esfuerzo no se propone.
- **RIR y RPE:** son estimaciones de la propia persona, con error, mayor lejos del fallo (Zourdos et al., 2021) y con poca experiencia (Helms et al., 2016).
- **Sin motivos:** no se sabe por qué algo no se hizo.
- **Sin interpretación automática:** el análisis describe y no interpreta. Tampoco indica fatiga ni adaptación.

## 6. Volumen y tonelaje: auditoría

### 6.1 Conceptos que no se confunden

| Concepto                       | Qué es                                                         | En el bloque 3                                                                                                |
| ------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Volumen cuantitativo**       | Series, repeticiones, segundos y metros, cada uno en su unidad | Sí                                                                                                            |
| **Tonelaje externo (nominal)** | Σ repeticiones × kg externos **declarados**, totales           | Sí, solo cuando el total se conoce (§6.2)                                                                     |
| **Lastre y asistencia**        | kg añadidos o de ayuda, en su propia magnitud                  | Sí, aparte                                                                                                    |
| **Carga interna**              | RPE de la sesión × duración (UA)                               | Solo en B3.3, si se autoriza (§7)                                                                             |
| **Intensidad relativa**        | kg ÷ 1RM de referencia                                         | **No:** no hay 1RM en la base (V3 y bloque 4)                                                                 |
| **Trabajo mecánico**           | Fuerza × desplazamiento                                        | **No calculable:** no hay recorrido, fuerza ni instrumentos. **Nunca se presentará el tonelaje como trabajo** |

El tonelaje **no** representa por sí solo la carga mecánica, el estímulo, la fatiga ni la adaptación. Es una suma de kg declarados.

### 6.2 Caso a caso

| Caso                                     | Hoy en los datos                                    | Tonelaje                                                                                                                                          | Otras magnitudes                                             | ¿Fiable?                                                                                    |
| ---------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| **1. kg por implemento** (n implementos) | No aparece (el constructor no lo ofrece)            | rep. × kg × n, con n prescrito                                                                                                                    | —                                                            | Sí, si la clienta usó implementos iguales (no se puede registrar uno distinto en cada mano) |
| **2. kg por lado** (discos por lado)     | No aparece                                          | **Sin calcular**, con el motivo «falta el peso de la barra o del soporte»                                                                         | —                                                            | **No** (P-97)                                                                               |
| **3. Carga total realmente desplazada**  | —                                                   | **No determinable.** Con base «total» se usan los kg **declarados**. En máquinas, el peso de la pila no es la carga desplazada (poleas, palancas) | —                                                            | Nominal, no físico                                                                          |
| **4. Lastre** (peso corporal + kg)       | No aparece                                          | **No** se suma al tonelaje                                                                                                                        | Σ rep. × kg de lastre                                        | Sí                                                                                          |
| **5. Asistencia**                        | No aparece                                          | **No**                                                                                                                                            | Series, rep. y asistencia media ponderada por repeticiones   | Sí, si se anotan los kg (son opcionales: sin ellos, «sin dato»)                             |
| **6. Unilaterales**                      | Las variantes tienen lateralidad; no hay «por lado» | Tal como se registran. Con «por lado», **sin calcular** hasta decidir P-96                                                                        | Rep. tal como se registran, marcadas «por lado» si lo son    | Sí sin «por lado»; con «por lado», pendiente                                                |
| **7. Bilaterales**                       | Sí                                                  | rep. × kg (total)                                                                                                                                 | —                                                            | Sí (nominal)                                                                                |
| **8. Bandas elásticas**                  | No aparece                                          | **No**: la resistencia no está en kg                                                                                                              | Series y rep.; el descriptor, comparable solo si es idéntico | Recuentos, sí                                                                               |
| **9. Peso corporal**                     | Sí (110 ejercicios en la semilla)                   | **No** (`EFFORT_AND_LOAD.md` §10.3): no se sabe qué parte del cuerpo se mueve y no hay peso corporal medido                                       | Series y rep. con peso corporal                              | Recuentos, sí                                                                               |
| **10. Unidades distintas de kg**         | «Otra» (15 en la semilla); dispositivo, sin datos   | **No**                                                                                                                                            | Descriptor de texto; segundos y metros en su magnitud        | Solo descriptivo; nada se suma entre unidades                                               |
| Carga autoseleccionada con kg anotados   | No aparece                                          | **Sin calcular** por defecto: su prescripción no tiene base (P-115)                                                                               | «Carga elegida: X kg»                                        | No, sin base                                                                                |
| Series por tiempo o distancia con carga  | Paseo del granjero (metros)                         | **No** (no se multiplican metros por kg)                                                                                                          | Σ s o Σ m, con la carga como texto                           | Sí, por separado                                                                            |

**Reglas que no se rompen:**

- no se suman repeticiones con segundos o metros;
- no se suma tonelaje con lastre, asistencia ni peso corporal;
- las series se pueden contar juntas, **pero se muestran desglosadas por tipo**;
- el tonelaje de ejercicios distintos solo es una orientación general.

### 6.3 Lo que hoy no se puede calcular de forma fiable

- tonelaje con carga por lado;
- carga desplazada real;
- trabajo mecánico;
- intensidad relativa;
- carga respecto al peso corporal;
- volumen por grupo muscular (no hay taxonomía) y por cualidad (las etiquetas no son la intención);
- descanso real;
- carga interna (sin RPE de sesión real).

**No se inventa nada para cubrir estas carencias:** se muestran como «sin calcular» con su motivo.

### 6.4 Por patrón, cualidad y grupo muscular

| Agrupación         | Propuesta                                                                                                    | Decisión             |
| ------------------ | ------------------------------------------------------------------------------------------------------------ | -------------------- |
| **Patrón**         | Dos recuentos separados: «solo patrón principal» y «principal y secundarios». Sin pesos para los secundarios | P-98 (antes de B3.2) |
| **Cualidad**       | No en el bloque 3: las etiquetas describen usos de la variante, no la intención de la sesión                 | P-99 (posponible)    |
| **Grupo muscular** | No en el bloque 3: no hay taxonomía de músculos                                                              | P-100 (posponible)   |

## 7. Carga interna (B3.3)

### 7.1 Variables que no se confunden

| Variable                    | Unidad               | Escala                                                  | Estado                |
| --------------------------- | -------------------- | ------------------------------------------------------- | --------------------- |
| RIR de una serie            | repeticiones         | Enteros 0–10                                            | Existe (I, P)         |
| RPE de una serie            | puntos de su escala  | `rir_based`, `omni_res` o `borg_cr10`                   | Existe (I, P)         |
| **RPE global de la sesión** | puntos               | CR-10 modificada de Foster (**pendiente de verificar**) | **N**                 |
| Duración calculada          | min                  | —                                                       | Existe (§3.6)         |
| **Carga interna estimada**  | UA                   | —                                                       | **N**                 |
| Frecuencia cardiaca y otras | lpm u otras          | —                                                       | **N** (integraciones) |
| Valoración previa           | puntos (sin validar) | 1–10                                                    | **N** (P-47, Q2)      |

- El RPE de la sesión **no** es la media de los RPE de las series: puede subestimarla (Sweet et al., 2004).
- La carga interna **no** se suma al tonelaje (Impellizzeri et al., 2019).

### 7.2 Antes de implementar B3.3 hay que tener

1. **La fuente original verificada.** El resumen de Foster et al. (2001, PMID 11708692) no detalla la fórmula, y su texto completo no está en PubMed Central. La fórmula, la escala con sus anclas y el ejemplo 87 × 4 = 348 UA solo se han comprobado en una revisión secundaria con texto completo (Haddad et al., 2017, [doi:10.3389/fnins.2017.00612](https://doi.org/10.3389/fnins.2017.00612)). **Hay que conseguir el original** (biblioteca o editorial) y cotejar con él:
   - la pregunta;
   - la escala y sus anclas;
   - el momento de la respuesta;
   - qué duración se usa (con o sin descansos);
   - las unidades. (P-112)
2. **Escala y textos:** traducción de las anclas revisada por ti (Q6).
3. **Procedimiento de recogida:** al terminar, con «Responder más tarde» durante 24 h y los minutos desde el fin (P-48).
4. **Datos ausentes:** sin respuesta en 24 h → «sin valorar», sin rellenar nada. Si la duración tiene advertencia, se aplica lo que decidas en P-114.
5. **Autorización expresa** de Q2 y P-101.

**Lo que no se hará:** cociente agudo:crónico (Impellizzeri et al., 2020), monotonía, _strain_, «riesgo», ni conversiones a RIR o %1RM.

### 7.3 Modelo previsto (solo si se autoriza)

Tabla `session_rpe`, solo de añadir:

- una valoración por ejecución; la corrección es otra fila con `supersedes`;
- `rpe` entero 0–10 y `scale` (identificador y versión);
- hora del dispositivo, zona y recepción;
- `minutes_after_finish`;
- procedencia `self_reported` · `client`.

No va en `session_log` porque una ejecución terminada no se modifica.

## 8. Escalas temporales

| Escala             | Planificado (fecha prevista)                                                    | Ejecutado (fecha de ejecución)                                 |
| ------------------ | ------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Sesión**         | Su prescripción original y vigente                                              | Lo hecho, con su fecha                                         |
| **Día**            | Sesiones previstas ese día y su estado                                          | Magnitudes de las sesiones empezadas ese día                   |
| **Semana (ISO)**   | Sesiones previstas, empezadas, completadas, parciales y sin hacer; cumplimiento | Volumen por magnitud y por patrón                              |
| **Varias semanas** | Serie semanal de lo prescrito                                                   | Serie semanal de lo ejecutado, con las semanas vacías visibles |
| **«Bloque»**       | Rango de fechas libre                                                           | Ídem                                                           |

## 9. Experiencia del entrenador

### 9.1 Principios

- **Cada visualización responde a una pregunta** y tiene su **tabla equivalente**.
- Cada pantalla tiene un recuadro **«Qué se puede concluir y qué no»**, con los límites del §5.4.
- **Sin** tartas, velocímetros, semáforos, puntuaciones globales, rankings ni diagnósticos.
- Componentes propios (ADR-12), accesibles, con la identidad de `DESIGN_SYSTEM.md`.

### 9.2 Pregunta → vista

| Pregunta                                        | Vista                                                                                                                                                 | Tabla equivalente  | Dónde       |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ----------- |
| ¿Qué se planificó y qué se hizo en esta sesión? | Cabecera con las fechas (prevista y real), el estado, las versiones y la duración con advertencias                                                    | Es texto           | A8          |
| ¿En qué se diferenció, dimensión a dimensión?   | Perfil de cumplimiento: fracciones por dimensión en barras de recuento, con «sin dato» y «no aplica» aparte                                           | Tabla de recuentos | A8          |
| ¿Dónde y cuánto, serie a serie?                 | Tabla prescrito \| realizado \| diferencia (nivel 1) \| condición (nivel 2) \| versión                                                                | Es una tabla       | A8          |
| ¿Qué falta o no es fiable?                      | Recuadro **«Datos ausentes y advertencias»**: series sin registrar, esfuerzo sin dato, duración con advertencia, horas ajustadas, sesión sin terminar | Es una lista       | A8, A9      |
| ¿Cómo fue el día?                               | Totales del día por magnitud (fecha de ejecución) y sesiones previstas (fecha prevista)                                                               | Tabla              | A9 «Día»    |
| ¿Se hizo lo planificado esta semana?            | Barras planificado frente a ejecutado por magnitud, con las trasladadas marcadas                                                                      | Tabla por sesión   | A9 «Semana» |
| ¿Cómo evoluciona el volumen?                    | Una serie semanal por magnitud: prescrito como línea y ejecutado como barras                                                                          | Tabla por semana   | A9          |
| ¿Cómo se comparan las sesiones del periodo?     | **Tabla de sesiones** del periodo, una por fila, con las mismas columnas por dimensión y magnitud, ordenable por fecha (sin ordenar por «mejor»)      | Es una tabla       | A9          |
| ¿Cómo se reparte por patrones?                  | Barras horizontales por patrón, con el conmutador «solo principal» o «principal y secundarios»                                                        | Tabla              | A9          |
| ¿Se repiten diferencias?                        | Lista descriptiva: «ejercicios con series fuera de la condición prescrita en ≥ N de las últimas M sesiones»                                           | Es una lista       | A9 (P-104)  |
| ¿Cómo evoluciona este ejercicio?                | Puntos por sesión con los kg de cada serie y las repeticiones; esfuerzo frente a objetivo; la versión                                                 | Tabla por sesión   | A10         |

### 9.3 A8 · Análisis de la sesión (`…/sesiones/[sessionId]/analisis`)

```
Fuerza · pierna · Mañana                                                   [Parcial]
Prevista: lun 9 nov · Realizada: lun 9 nov (en su día) · versión v1
Duración: transcurrida 49 min · pausas registradas 5 min · calculada 44 min · prevista 40 min
Comparar con: (●) prescripción original  ( ) prescripción vigente
┌ Cumplimiento ──────────────────────────────────────────────────────────────────────┐
│ Estructural    5 de 6 series hechas · 1 no realizada · 0 sin registrar               │
│ Cuantitativa   Repeticiones 29 de 30 · Tiempo 60 de 90 s                             │
│ Intensidad     3 de 3 series con la carga prescrita                                  │
│ Esfuerzo       RIR: 1 de 3 coincide · 2 distintas · 0 sin dato                       │
└──────────────────────────────────────────────────────────── ⓒ fórmulas y versiones ┘
Datos ausentes y advertencias: ninguna
Volumen (sin mezclar magnitudes)       Prescrito  Realizado
  Series                               6          5
  Repeticiones                         30         29         ⓒ training.total-reps 2.0.0
  Tiempo (isométricos)                 90 s       60 s       ⓒ training.duration-total 1.0.0
  Tonelaje externo (nominal)           1.800 kg   1.740 kg   ⓒ training.volume-load 2.0.0
A · Sentadilla trasera con barra                                        completo
  Serie │ Versión │ Prescrito          │ Realizado          │ Diferencia │ Condición
    1   │ v1      │ 10 × 60 kg · RIR 2 │ 10 × 60 kg · RIR 2 │ —          │ coincide
    2   │ v1      │ 10 × 60 kg · RIR 2 │ 10 × 60 kg · RIR 1 │ RIR −1     │ RIR distinto
    3   │ v1      │ 10 × 60 kg · RIR 2 │ 9 × 60 kg · RIR 0  │ −1 rep. · RIR −2 │ rep. y RIR distintos
  Descanso prescrito 2 min · real: no registrado
B · Plancha                                                             parcial
  …
Comentario de la clienta: —
Qué se puede concluir y qué no: los valores se proponen con lo prescrito; el RIR es autodeclarado; no hay motivos registrados; esta vista no indica fatiga.
Día de ejecución (lun 9 nov): 2 sesiones · … → A9 «Día»
```

- **En el móvil:** las dimensiones se apilan; cada serie es una tarjeta con «Prescrito», «Realizado», «Diferencia» y «Condición».
- **Estados:**
  - **Sin empezar:** «La clienta aún no ha empezado esta sesión», con la prescripción.
  - **En curso:** aviso de que lo pendiente en el móvil no se ve.
  - **Error de la base:** la página de B3.0.

### 9.4 A3 y A1

- **A3** (planificación, por fecha prevista): la cabecera de cada día muestra las sesiones previstas con su estado. Las hechas otro día dicen «hecha el mar 10». **No** muestra totales ejecutados del día (§3.4).
- **A1 · Panel (primera versión, B3.1):**
  1. sesiones de hoy de todos los clientes, con su estado;
  2. sesiones terminadas en los últimos 7 días, con enlace a A8 (un «pendientes de revisar» exacto necesita marcas de lectura, P-111);
  3. borradores.

### 9.5 A9 · Análisis del cliente (pestaña «Análisis» de la ficha)

- **Periodos:** día, semana, 4 semanas, 12 semanas o un rango libre.
- **Perspectiva:** prescripción original o vigente.
- **Filtros:** patrón y ejercicio.
- **Base de fecha:** cada bloque indica la suya.
- **Secciones:**
  1. Resumen del periodo (por fecha prevista).
  2. Datos ausentes y advertencias.
  3. Volumen ejecutado por semana (por fecha de ejecución).
  4. Tabla de sesiones.
  5. Patrones.
  6. Ejercicios, con enlace a A10.
  7. Diferencias repetidas (P-104).
  8. Qué se puede concluir y qué no.
- **En el móvil:** un gráfico por pantalla, con su tabla debajo y los filtros en una hoja inferior.

### 9.6 A10 · Evolución de un ejercicio

- Por sesión, en orden de ejecución: series hechas frente a prescritas, kg de cada serie, repeticiones, esfuerzo frente a objetivo, versión y notas.
- Solo con la **misma variante y modalidad**: si cambia la modalidad, la serie se corta y se avisa.
- Sin estimación del 1RM.

### 9.7 Vistas existentes que se corrigen en B3.2

| Vista                            | Hoy                                             | Tras B3.2 (P-106)                                                                                                             |
| -------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| «Carga» (`/entrenador/carga`)    | Fecha prevista; tonelaje 1.0.0; versión vigente | Fecha de ejecución; tonelaje 2.0.0; versión de cada serie                                                                     |
| Pestaña «Resultados» de la ficha | Fecha prevista                                  | Fecha de ejecución                                                                                                            |
| «Progreso» de la clienta         | Fecha de ejecución; tonelaje 1.0.0              | El mismo dominio y la misma fórmula que el entrenador. Con los datos actuales (todos con base «total»), las cifras no cambian |

## 10. Preparación para la autorregulación (1C)

| Necesidad de la 1C                   | Qué deja el bloque 3                                                                |
| ------------------------------------ | ----------------------------------------------------------------------------------- |
| Diferencias repetidas                | Nivel 2 por serie y dimensión, consultable por ejercicio y periodo                  |
| Tendencias de esfuerzo               | RIR/RPE frente al objetivo por ejercicio, en la misma escala                        |
| Carga planificada frente a ejecutada | Diferencias en kg y en %                                                            |
| Evolución del volumen                | Series semanales por magnitud y patrón                                              |
| Posibles señales de fatiga           | **Nada automático.** Se ven juntos esfuerzo, diferencias y, con B3.3, carga interna |
| Decisiones                           | Vistas que explican cada cifra con su fórmula                                       |

## 11. Modelo de datos

- **B3.0, B3.1 y B3.2: sin cambios en el esquema.**
  - Se añaden lecturas de solo lectura en los puertos: ejecuciones de un cliente por rango de fechas (prevista o de ejecución) y todas las versiones de esas sesiones.
  - Todo se calcula al leer, sin tablas de resumen (P-111).
- **B3.3:** la tabla `session_rpe` del §7.3, en una migración `004`, si se autoriza.
- **Opcionales, que piden decisión aparte:**
  - hora de cada pausa y reanudación (P-116 c);
  - marca de valor editado o propuesto (P-119);
  - marcas de lectura del análisis (P-111 b);
  - motivo de corrección y anotaciones (P-109, §13).
- **Ya no hace falta:** `trainer_setting` para tolerancias, porque P-91 fija la tolerancia en cero.

## 12. Fórmulas que se registrarán

Todas son `operational_definition` (definiciones de diseño o aritméticas, con limitaciones escritas), salvo la carga interna.

| Id                                     | Versión | Qué calcula                                                                                                                                                                   | Unidad             |
| -------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `training.completed-sets`              | 1.0.0   | (Existe) series hechas                                                                                                                                                        | series             |
| `training.prescribed-volume`           | 1.0.0   | Series y rep., s o m prescritos, por tipo; rangos como [mín., máx.], por perspectiva (original o vigente)                                                                     | series, rep., s, m |
| `training.total-reps`                  | 2.0.0   | Σ rep. de series hechas por repeticiones; las «por lado», aparte                                                                                                              | rep.               |
| `training.duration-total`              | 1.0.0   | Σ s de series hechas por tiempo                                                                                                                                               | s                  |
| `training.distance-total`              | 1.0.0   | Σ m de series hechas por distancia                                                                                                                                            | m                  |
| `training.volume-load`                 | 2.0.0   | Σ rep. × kg externos totales: base total, o por implemento × n. **Sin calcular:** por lado, «por lado» en las rep. (P-96) y autoseleccionada (P-115), cada caso con su motivo | kg (nominal)       |
| `training.prescribed-volume-load`      | 1.0.0   | Lo mismo sobre lo prescrito (kg congelados del %1RM; rangos como [mín., máx.])                                                                                                | kg                 |
| `training.added-load-volume`           | 1.0.0   | Σ rep. × kg de lastre                                                                                                                                                         | kg                 |
| `training.assistance-summary`          | 1.0.0   | Series y rep. asistidas; asistencia media ponderada por rep. (con «sin dato»)                                                                                                 | series, rep., kg   |
| `training.rep-deviation`               | 1.0.0   | Nivel 1 de rep., s o m (0 dentro del rango; si no, respecto al límite más cercano)                                                                                            | rep., s, m         |
| `training.load-deviation`              | 1.0.0   | Nivel 1 de carga en la misma modalidad y base (kg y %); descriptor igual o distinto                                                                                           | kg, %              |
| `training.effort-deviation`            | 1.0.0   | Nivel 1 de RIR o RPE en la misma escala                                                                                                                                       | rep. / puntos      |
| `training.prescribed-condition`        | 1.0.0   | Nivel 2 por serie y dimensión: coincide, distinto, dentro o fuera del rango, sin dato o no aplica                                                                             | —                  |
| `training.compliance-profile`          | 1.0.0   | Recuentos por dimensión y estado, con sus denominadores                                                                                                                       | series, ejercicios |
| `training.exercise-status`             | 1.0.0   | Completo, parcial, no realizado o sin registrar                                                                                                                               | —                  |
| `training.session-adherence`           | 1.0.0   | Sesiones previstas, empezadas, completadas, parciales y sin hacer (por fecha prevista)                                                                                        | sesiones           |
| `training.schedule-offset`             | 1.0.0   | Días entre la fecha prevista y la de ejecución                                                                                                                                | días               |
| `training.session-elapsed`             | 1.0.0   | Fin − inicio                                                                                                                                                                  | min                |
| `training.session-calculated-duration` | 1.0.0   | Transcurrida − pausas registradas, con las advertencias del §4.5                                                                                                              | min                |
| `training.pattern-set-count`           | 1.0.0   | Series por patrón: solo principal, y principal con secundarios                                                                                                                | series             |
| `training.session-internal-load`       | 1.0.0   | **`scientific_formula`**. RPE de la sesión × duración calculada. **Solo tras P-112**                                                                                          | UA                 |

## 13. Correcciones justificadas y anotaciones del entrenador (diseño, P-109, posponible)

- **Motivo opcional en la fila que corrige:**
  - «me equivoqué al anotar»;
  - «se me olvidó registrarla»;
  - «otro», con texto.

  Las filas anteriores no cambian.

- **Tabla `set_annotation`**, solo de añadir, con:
  - qué serie se anota;
  - quién anota;
  - el tipo: `comment` o `exclude_from_analysis`;
  - el texto, obligatorio para una exclusión;
  - la fecha;
  - `supersedes`.

  Una exclusión es explícita, reversible y visible, y los totales la indican.

- **Registro por el entrenador en nombre de la clienta:** otra fila con `recorded_by = trainer`, motivo obligatorio y procedencia `direct` (lo observó) o `self_reported` (se lo contaron).
- **Lo registrado no se modifica nunca.**

## 14. Plan por etapas

**Ninguna etapa está autorizada.** Cada una necesita tu autorización expresa y termina con `pnpm check`, `pnpm test:e2e`, documentación, commit y un informe para tu revisión.

### B3.0 · Preparación

| Apartado                    | Contenido                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Objetivos**               | Que ningún error de la base deje al entrenador sin explicación, y tener los datos de prueba que el análisis necesita                                                                                                                                                                                                                                                                                                            |
| **Alcance**                 | <ul><li>Página de error de la base (A-15) que distinga ocupada, no disponible y dañada o incompatible, con qué hacer.</li><li>Errores tipados en crear sesión, borrar y mover borrador, copia y restablecer (residual de A-11).</li><li>Generadores deterministas de escenarios de prueba: versiones a media sesión, correcciones, pausas, huecos, sesiones trasladadas, medianoche, semana 53 y 52 semanas de datos.</li></ul> |
| **Fuera de alcance**        | Cualquier pantalla de análisis; cambios del esquema                                                                                                                                                                                                                                                                                                                                                                             |
| **Dependencias**            | Ninguna                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Datos necesarios**        | Los actuales                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Cambios de código**       | `error.tsx` en las áreas del entrenador y de la clienta; `safely` en las acciones restantes; generadores en las utilidades de prueba                                                                                                                                                                                                                                                                                            |
| **Cambios de modelo**       | Ninguno                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Criterios de aceptación** | <ul><li>AC-B3.0-1: con la base bloqueada por otro proceso, crear una sesión muestra «base ocupada, inténtalo en unos segundos» y no la página genérica.</li><li>AC-B3.0-2: con la base borrada por fuera, la página dice cómo seguir.</li><li>AC-B3.0-3: con migraciones incompatibles, indica `pnpm db:status` y `pnpm db:restore`.</li><li>AC-B3.0-4: los generadores producen los mismos datos en cada ejecución.</li></ul>  |
| **Pruebas unitarias**       | Clasificación del error en cada acción; determinismo de los generadores                                                                                                                                                                                                                                                                                                                                                         |
| **Pruebas de integración**  | Acciones con la base bloqueada (`BEGIN IMMEDIATE` desde otro proceso)                                                                                                                                                                                                                                                                                                                                                           |
| **Pruebas E2E**             | AC-B3.0-1 a AC-B3.0-3 en escritorio y móvil                                                                                                                                                                                                                                                                                                                                                                                     |
| **Riesgos**                 | Que la página de error oculte errores de programación: solo trata los de almacenamiento; el resto sigue en la genérica, con registro                                                                                                                                                                                                                                                                                            |
| **Terminado cuando**        | Criterios en verde tres veces seguidas; batería completa en verde; informe                                                                                                                                                                                                                                                                                                                                                      |

### B3.1 · Análisis de la sesión

| Apartado                    | Contenido                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Objetivos**               | Responder las cinco preguntas del §1 para una sesión y un día                                                                                                                                                                                                                                                                                                                      |
| **Alcance**                 | <ul><li>Dominio de análisis: referencia original y vigente, condición, perfil, volumen y duración.</li><li>Las fórmulas del §12 salvo patrones y carga interna.</li><li>A8.</li><li>Cabecera de A3 corregida.</li><li>Día en A9 («Día»: totales por fecha de ejecución).</li><li>Panel A1, primera versión.</li><li>Resumen prescrito en el constructor (E2E-1, paso 1).</li></ul> |
| **Fuera de alcance**        | Semanas y periodos, A10, patrones, corrección de «Carga», «Resultados» y «Progreso», B3.3                                                                                                                                                                                                                                                                                          |
| **Dependencias**            | B3.0; **P-116 y P-117**                                                                                                                                                                                                                                                                                                                                                            |
| **Datos necesarios**        | Versiones, ejecuciones y series efectivas (existen)                                                                                                                                                                                                                                                                                                                                |
| **Cambios de código**       | `src/domain/analysis/*`, `src/contracts/analysis.ts`, `src/server/services/trainer-analysis.ts` (`canAccessClient`, `canViewSession` y `canReadExecution`), lecturas nuevas en los puertos, páginas A8 y «Día», cabecera de A3 y panel                                                                                                                                             |
| **Cambios de modelo**       | Ninguno                                                                                                                                                                                                                                                                                                                                                                            |
| **Criterios de aceptación** | AC-B3-01 a AC-B3-13 y AC-B3-15 a AC-B3-17 (§15)                                                                                                                                                                                                                                                                                                                                    |
| **Pruebas unitarias**       | Cada fórmula con casos en tabla (rangos, bases, modalidades, escalas, sin dato y no aplica, referencia original y vigente, fechas, duración y advertencias); invariantes (sesiones → día; reenviar no cambia nada; ninguna dimensión se mezcla)                                                                                                                                    |
| **Pruebas de integración**  | Servicios con SQLite real desde la semilla y desde los generadores; permisos con intentos no autorizados                                                                                                                                                                                                                                                                           |
| **Pruebas E2E**             | A8 (E2E-1, E2E-12, versión a media sesión, trasladada, medianoche, sin dato, duración con advertencia e incoherente), día y panel, en escritorio y Pixel 7, con el reloj fijado; axe a 360 px                                                                                                                                                                                      |
| **Riesgos**                 | <ul><li>Leer «coincide» como «se midió así» (mitigado: «Qué se puede concluir»).</li><li>Una regla de P-117 mal elegida para lo no registrado.</li><li>Confusión entre fechas (mitigado: cada bloque dice su base).</li></ul>                                                                                                                                                      |
| **Terminado cuando**        | Criterios en verde tres veces; batería completa; fórmulas en el registro sin incidencias; informe                                                                                                                                                                                                                                                                                  |

### B3.2 · Cliente por periodos

| Apartado                    | Contenido                                                                                                                                                                                                                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Objetivos**               | Seguir a un cliente por semanas y periodos, y la evolución de cada ejercicio                                                                                                                                                                                                  |
| **Alcance**                 | <ul><li>A9 (semana, 4 y 12 semanas, rango libre; perspectivas; filtros por patrón y ejercicio; tabla de sesiones; datos ausentes; diferencias repetidas).</li><li>A10.</li><li>Volumen por patrón.</li><li>Corrección de «Carga», «Resultados» y «Progreso» (§9.7).</li></ul> |
| **Fuera de alcance**        | Cualidad y grupo muscular, carga interna, alertas, comparaciones entre clientes                                                                                                                                                                                               |
| **Dependencias**            | B3.1; **P-98, P-104, P-106, P-114 y P-118**                                                                                                                                                                                                                                   |
| **Datos necesarios**        | Los de B3.1 y los patrones de la biblioteca (existen)                                                                                                                                                                                                                         |
| **Cambios de código**       | Páginas A9 y A10; `patterns.ts`; `timeline.ts` (semanas y periodos); servicios de las vistas corregidas                                                                                                                                                                       |
| **Cambios de modelo**       | Ninguno                                                                                                                                                                                                                                                                       |
| **Criterios de aceptación** | AC-B3-14 y AC-B3-18 a AC-B3-23 (§15)                                                                                                                                                                                                                                          |
| **Pruebas unitarias**       | Semana ISO (incluida la 53 y el cambio de año), agrupación por cada fecha, perspectivas, patrones, diferencias repetidas                                                                                                                                                      |
| **Pruebas de integración**  | 52 semanas generadas; rendimiento; permisos                                                                                                                                                                                                                                   |
| **Pruebas E2E**             | A9 y A10 con filtros, trasladadas y semana 53; las vistas corregidas mantienen sus cifras con los datos actuales                                                                                                                                                              |
| **Riesgos**                 | <ul><li>Una pantalla demasiado densa (mitigado: un gráfico por pregunta y tablas).</li><li>Rendimiento con años de datos (se mide; P-111).</li><li>Cambiar cifras que la clienta ya veía (hoy no cambian).</li></ul>                                                          |
| **Terminado cuando**        | Igual que B3.1                                                                                                                                                                                                                                                                |

### B3.3 · RPE global de la sesión y carga interna

| Apartado                    | Contenido                                                                                                                                                                                                       |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Objetivos**               | Recoger el RPE global de la sesión con un procedimiento verificado y mostrar la carga interna estimada como tendencia individual                                                                                |
| **Alcance**                 | <ul><li>Pregunta al terminar, con «Responder más tarde» durante 24 h.</li><li>Comando idempotente `rate_session`.</li><li>Tabla `session_rpe`.</li><li>Carga interna por sesión y semana en A8 y A9.</li></ul>  |
| **Fuera de alcance**        | Cociente agudo:crónico, monotonía, _strain_, alertas, frecuencia cardiaca                                                                                                                                       |
| **Dependencias**            | B3.1; **Q2, P-48, P-101 y P-112** (original verificado); Q6 (textos de las anclas); P-114                                                                                                                       |
| **Datos necesarios**        | RPE de la sesión (no existe); duración calculada (existe)                                                                                                                                                       |
| **Cambios de código**       | Reproductor (resumen), cola local, API de comandos, dominio, A8 y A9                                                                                                                                            |
| **Cambios de modelo**       | **Sí:** migración `004` con `session_rpe`                                                                                                                                                                       |
| **Criterios de aceptación** | AC-B3-24 a AC-B3-26 (§15)                                                                                                                                                                                       |
| **Pruebas unitarias**       | Fórmula con el ejemplo publicado verificado en el original; sin RPE, sin terminar o con advertencia, «sin calcular» con el motivo                                                                               |
| **Pruebas de integración**  | Migración `004` desde la `003` con datos; idempotencia; identidad; reglas de hora                                                                                                                               |
| **Pruebas E2E**             | Responder al terminar, más tarde y no responder; sin conexión; móvil compartido                                                                                                                                 |
| **Riesgos**                 | <ul><li>Presentar una percepción como medición (mitigado: rótulos y procedencia).</li><li>Anclas mal traducidas (Q6).</li><li>Baja tasa de respuesta (se muestra cuántas sesiones tienen valoración).</li></ul> |
| **Terminado cuando**        | Original verificado y documentado; criterios en verde; informe                                                                                                                                                  |

## 15. Criterios de aceptación

| Id       | Etapa | Criterio                                                                                                                                                            |
| -------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-B3-01 | B3.1  | E2E-1: A8 muestra «Completada», «en su día», **30 → 29 rep.**, **1.800 → 1.740 kg** y «−1 rep.» en la serie 3                                                       |
| AC-B3-02 | B3.1  | Ejemplo del §5.2: exactamente sus fracciones; ningún porcentaje global; ninguna palabra fuera del vocabulario del §3.2                                              |
| AC-B3-03 | B3.1  | E2E-12: mañana **15 rep. y 1.200 kg**; tarde **16 rep. y 640 kg**; día de ejecución **31 rep. y 1.840 kg**                                                          |
| AC-B3-04 | B3.1  | Los ejemplos de P-91 del §3.2, tal cual en los niveles 1 y 2                                                                                                        |
| AC-B3-05 | B3.1  | Tipos de serie: plancha (s), paseo del granjero (m), peso corporal, lastre, asistida, bandas y «otra»: cada magnitud en su fila; ninguna en el tonelaje             |
| AC-B3-06 | B3.1  | Por implemento «2 × 20 kg», 3 × 10 → 1.200 kg; por lado → «sin calcular», con el motivo                                                                             |
| AC-B3-07 | B3.1  | Versión v2 a media sesión: con «original», cada serie frente a su versión; con «vigente», todas frente a la v2; publicar después una v3 no cambia la vista original |
| AC-B3-08 | B3.1  | Trasladada: prevista el lunes 9 y hecha el martes 10: A3 dice «hecha el mar 10»; su carga cuenta el martes 10                                                       |
| AC-B3-09 | B3.1  | Medianoche: inicio a las 23:50 con series a las 23:58 y 00:03: todo en el día de inicio                                                                             |
| AC-B3-10 | B3.1  | Duración: inicio 21:00, serie 21:10, fin 06:15 sin pausas → transcurrida, pausas 0, calculada y la advertencia, sin descontar nada; registros sin tocar             |
| AC-B3-11 | B3.1  | Duración incoherente (fin anterior al inicio por horas ajustadas) → «Datos de tiempo incoherentes», sin cifra                                                       |
| AC-B3-12 | B3.1  | Sin dato frente a diferencia: RIR prescrito y no registrado → «sin dato», fuera del denominador; RPE en otra escala u objetivo de carácter → «no aplica»            |
| AC-B3-13 | B3.1  | Reenvíos y correcciones: no cambian los totales salvo el valor corregido                                                                                            |
| AC-B3-14 | B3.2  | Semana 53: una sesión el 1 ene 2027 en Madrid cuenta en 2026-W53, rotulada «28 dic 2026 – 3 ene 2027»                                                               |
| AC-B3-15 | B3.1  | Fórmulas: cada cifra calculada lleva la insignia con su id y versión, y sus limitaciones                                                                            |
| AC-B3-16 | B3.1  | Permisos: otro entrenador, la clienta o una petición sin identidad reciben `404` o la redirección en A8, A9 y A10 de un cliente ajeno; sus datos no aparecen        |
| AC-B3-17 | B3.1  | Accesibilidad: axe sin infracciones; nada desborda a 360 px; cada gráfico con su tabla; «Qué se puede concluir y qué no» presente                                   |
| AC-B3-18 | B3.2  | Semanas vacías visibles con cero                                                                                                                                    |
| AC-B3-19 | B3.2  | Planificado frente a ejecutado con una trasladada entre semanas: aparece en las dos con su papel y marcada                                                          |
| AC-B3-20 | B3.2  | Patrones: los dos recuentos coinciden con la biblioteca en un caso de prueba con principal y secundarios                                                            |
| AC-B3-21 | B3.2  | «Carga», «Resultados» y «Progreso» usan la fecha de ejecución y mantienen sus cifras con los datos actuales                                                         |
| AC-B3-22 | B3.2  | Ningún `perceived_effort` de la semilla en el análisis                                                                                                              |
| AC-B3-23 | B3.2  | Rendimiento: A9 con 52 semanas generadas, menos de 300 ms en el servidor de pruebas (objetivo de diseño, a confirmar al medir)                                      |
| AC-B3-24 | B3.3  | El ejemplo numérico del original verificado (no el de una revisión) da exactamente su resultado                                                                     |
| AC-B3-25 | B3.3  | Sin RPE, sin terminar o con duración incoherente → «sin calcular», con el motivo; con advertencia, según P-114                                                      |
| AC-B3-26 | B3.3  | El RPE de la sesión respeta la identidad, la idempotencia y las reglas de hora del bloque 2                                                                         |

## 16. Decisiones

### 16.1 Aprobadas

P-90, P-91, P-92, P-93, P-94 y P-95 (13 nov 2026, PROMPT 16; ADR-33).

### 16.2 Cerradas como consecuencia

- **P-103 (índice global):** resuelta por P-90: no hay índice global.
- **P-91 c) (tolerancias configurables):** descartada por P-91: tolerancia cero.

### 16.3 Pendientes, por etapa

Ninguna se da por aprobada sin constancia documental. Solo se piden las necesarias para avanzar.

| Id    | Etapa                           | Qué hay que decidir                                                        | Recomendación                                                                                                                                                                                                                                                                                                                                                                          | Justificación                                                                       | Si no se decide                                                                | ¿Bloquea?                             |
| ----- | ------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------- |
| P-108 | **Antes de B3.0**               | Hacer B3.0 (página de error y errores tipados) antes del análisis          | **Sí**, con el alcance del §14                                                                                                                                                                                                                                                                                                                                                         | El análisis añade pantallas que hoy caerían en un error genérico                    | B3.1 sin una página de error útil                                              | **Sí** (es la propia B3.0)            |
| P-116 | **Antes de B3.1**               | Cómo aplicar la advertencia de P-95 sin la hora de cada pausa              | **a) Dos niveles con los datos actuales:** «advertencia» si el hueco supera en más de 30 min el total de pausas registradas (seguro que hubo más de 30 min sin pausa); «aviso» si el hueco pasa de 30 min pero las pausas registradas podrían explicarlo. b) Una sola advertencia para todo hueco de más de 30 min. c) Guardar la hora de cada pausa (cambio de esquema, más adelante) | a) es fiel a P-95 sin inventar dónde estuvo cada pausa ni dar falsas alarmas obvias | A8 no puede mostrar la duración conforme a P-95                                | **Sí**                                |
| P-117 | **Antes de B3.1**               | Qué es la «prescripción original» de lo no registrado (P-92)               | **Sesión empezada:** la versión del último registro o, si no hay, la de inicio. **Sesión sin empezar:** la vigente al terminar el día previsto (zona de la aplicación)                                                                                                                                                                                                                 | Es la mejor evidencia guardada de lo que tenía la clienta; no reescribe la historia | Los totales prescritos «originales» de sesiones incompletas quedan indefinidos | **Sí**                                |
| P-98  | Antes de B3.2                   | Volumen por patrón                                                         | Dos recuentos separados, sin pesos                                                                                                                                                                                                                                                                                                                                                     | Datos existentes; nada inventado                                                    | A9 sin patrones                                                                | Sí, solo esa sección                  |
| P-104 | Antes de B3.2                   | Lista de diferencias repetidas (N de M sesiones)                           | Lista descriptiva, sin alertas; N = 3 y M = 5 por defecto, ajustables en pantalla sin guardarlos                                                                                                                                                                                                                                                                                       | Ayuda a decidir sin automatizar                                                     | A9 sin esa sección                                                             | Sí, solo esa sección                  |
| P-106 | Antes de B3.2                   | Corregir «Carga», «Resultados» y «Progreso» según P-93 y el tonelaje 2.0.0 | **Sí**                                                                                                                                                                                                                                                                                                                                                                                 | Hoy hay vistas con fechas distintas (§2.5.2)                                        | Cifras incoherentes entre vistas                                               | Sí, solo esas vistas                  |
| P-114 | Antes de B3.2                   | Duraciones con advertencia en medias y totales de periodo                  | **Mostrar el total con y sin esas sesiones**, con cuántas son                                                                                                                                                                                                                                                                                                                          | No asume nada (P-95) y no oculta                                                    | Medias de periodo sin regla                                                    | Sí, para las medias de duración       |
| P-118 | Antes de B3.2                   | Fecha prevista para agrupar cuando una versión cambia la fecha             | Vista original, por la fecha de la versión original (P-117); vista vigente, por la vigente                                                                                                                                                                                                                                                                                             | Coherente con las dos perspectivas de P-92                                          | Agrupación ambigua cuando exista el bloque 5                                   | Sí, para la planificación por semanas |
| Q2    | Antes de B3.3                   | Recoger el RPE de la sesión (y la valoración previa)                       | Sí, solo recogida y visualización                                                                                                                                                                                                                                                                                                                                                      | Sin datos no habrá tendencias para la 1C                                            | Sin B3.3                                                                       | Sí (B3.3)                             |
| P-48  | Antes de B3.3                   | Procedimiento: al terminar, 24 h y posibilidad de desactivarlo con motivo  | Como está, tras cotejarlo con el original                                                                                                                                                                                                                                                                                                                                              | `PROGRESSION_AND_AUTOREGULATION.md` §6.2                                            | Sin B3.3                                                                       | Sí (B3.3)                             |
| P-101 | Antes de B3.3                   | Alcance de B3.3                                                            | Recogida y carga interna, tras P-112                                                                                                                                                                                                                                                                                                                                                   | §7                                                                                  | Sin B3.3                                                                       | Sí (B3.3)                             |
| P-112 | Antes de B3.3                   | Verificar el original de Foster et al. (2001)                              | Conseguir el texto completo y cotejarlo                                                                                                                                                                                                                                                                                                                                                | Regla de `SCIENTIFIC_RIGOR.md`                                                      | B3.3 sigue bloqueada                                                           | Sí (B3.3)                             |
| Q6    | Antes de B3.3                   | Textos de las anclas de la escala                                          | Que los revises                                                                                                                                                                                                                                                                                                                                                                        | Traducción propia sin validar                                                       | Anclas provisionales marcadas                                                  | Sí (B3.3)                             |
| P-96  | Posponible                      | Repeticiones «por lado» en el tonelaje                                     | Rep. como registradas y tonelaje × 2                                                                                                                                                                                                                                                                                                                                                   | `EFFORT_AND_LOAD.md` §3                                                             | Esas series, «sin calcular»                                                    | No (no hay datos)                     |
| P-97  | Posponible                      | Carga «por lado»                                                           | Excluir del tonelaje                                                                                                                                                                                                                                                                                                                                                                   | Falta el peso de la barra                                                           | «Sin calcular» (por defecto)                                                   | No                                    |
| P-99  | Posponible                      | Volumen por cualidad                                                       | Esperar a la intención en la prescripción (bloque 4)                                                                                                                                                                                                                                                                                                                                   | Las etiquetas no son la intención                                                   | Sin vista por cualidad                                                         | No                                    |
| P-100 | Posponible                      | Volumen por grupo muscular                                                 | No en el bloque 3                                                                                                                                                                                                                                                                                                                                                                      | Sin taxonomía de músculos                                                           | —                                                                              | No                                    |
| P-102 | Posponible                      | Rótulo de `perceived_effort` en «Registro»                                 | «Dato de demostración sin escala»                                                                                                                                                                                                                                                                                                                                                      | Es inventado                                                                        | Se sigue mostrando como hoy (el análisis no lo usa)                            | No                                    |
| P-105 | Posponible                      | Descanso real                                                              | Registrarlo en un bloque posterior si interesa                                                                                                                                                                                                                                                                                                                                         | El intervalo entre registros no es descanso                                         | Solo el prescrito, con «no registrado»                                         | No                                    |
| P-107 | Posponible                      | Copias automáticas y rotación                                              | §19.2                                                                                                                                                                                                                                                                                                                                                                                  | —                                                                                   | Copias solo manuales y antes de operaciones                                    | No                                    |
| P-109 | Posponible                      | Correcciones justificadas y anotaciones                                    | Después del bloque 3 (§13)                                                                                                                                                                                                                                                                                                                                                             | —                                                                                   | Sin motivos ni anotaciones                                                     | No                                    |
| P-110 | Posponible (antes de cerrar V1) | Windows, Safari e iOS                                                      | §19.4                                                                                                                                                                                                                                                                                                                                                                                  | —                                                                                   | Validación solo en Linux con Chromium                                          | No                                    |
| P-111 | Posponible                      | Tablas de resumen y marcas de lectura                                      | Calcular al leer; medir primero                                                                                                                                                                                                                                                                                                                                                        | —                                                                                   | Panel con «terminadas en 7 días»                                               | No                                    |
| P-113 | Posponible                      | Hora imposible (T1)                                                        | Mantener el rechazo con un mensaje mejor                                                                                                                                                                                                                                                                                                                                               | —                                                                                   | Igual que hoy                                                                  | No                                    |
| P-115 | Posponible                      | kg en la carga autoseleccionada                                            | Excluir del tonelaje hasta que la prescripción tenga base (bloque 4)                                                                                                                                                                                                                                                                                                                   | Sin base, el total es desconocido                                                   | «Sin calcular» (por defecto)                                                   | No (no hay datos)                     |
| P-119 | Posponible                      | Marcar si un valor se editó o se aceptó el propuesto                       | Valorarlo en los bloques 4 o 5                                                                                                                                                                                                                                                                                                                                                         | Mejoraría la lectura de «coincide» (§5.4)                                           | La limitación se muestra en pantalla                                           | No                                    |

## 17. Revisión científica y metodológica

| Elemento                                                                                | Tipo                                                    | Respaldo y límites                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dimensiones de cumplimiento, tres niveles y vocabulario                                 | **Decisión de diseño** (P-90, P-91)                     | Sin respaldo científico: no se le atribuye ninguno                                                                                                                                                   |
| Tolerancia cero; G = 30 min; semana ISO; fecha de ejecución local; reglas de referencia | **Decisión de diseño** o estándar (ISO 8601)            | La semana ISO es una norma de calendario, no una evidencia                                                                                                                                           |
| Series, repeticiones, s, m, diferencias, recuentos y fracciones                         | **Fórmulas matemáticas** e **indicadores descriptivos** | Aritmética; describen lo registrado                                                                                                                                                                  |
| Tonelaje (Σ rep. × kg)                                                                  | **Definición operativa** de uso común                   | No se le atribuye validez como medida de estímulo, fatiga ni adaptación, ni equivale a trabajo mecánico                                                                                              |
| Escalas RIR y RPE                                                                       | **Métodos con respaldo**                                | Zourdos et al. (2016), Helms et al. (2016), Robertson et al. (2003), Borg (1982), verificados en `EFFORT_AND_LOAD.md`. Se usan para definir las escalas y la cautela, **no** para juzgar diferencias |
| Error del RIR lejos del fallo                                                           | **Evidencia**                                           | Zourdos et al. (2021). Justifica no emitir juicios automáticos; **no** fija ningún margen                                                                                                            |
| Método del RPE de la sesión                                                             | **Respaldado; procedimiento pendiente de verificar**    | Validez y fiabilidad en revisiones: 36 estudios (Haddad et al., 2017); en fuerza, CCI 0,88 (Day et al., 2004). **Original (Foster et al., 2001) sin cotejar en texto completo** (P-112)              |
| RPE de la sesión frente a media de las series                                           | **Evidencia**                                           | Puede subestimarla (Sweet et al., 2004)                                                                                                                                                              |
| Carga externa frente a interna                                                          | **Marco conceptual**                                    | Constructos distintos (Impellizzeri et al., 2019)                                                                                                                                                    |
| Cociente agudo:crónico                                                                  | **Descartado**                                          | Impellizzeri et al. (2020)                                                                                                                                                                           |
| Recuento fraccional por grupo muscular                                                  | **No se usa en el bloque 3**                            | La relación dosis–respuesta descrita es para resultados concretos (p. ej., hipertrofia) y no se generaliza                                                                                           |

**Principio:** el volumen de entrenamiento **no** es un equivalente universal de estímulo, fatiga ni adaptación. TrainPro lo muestra como lo que es: una descripción cuantitativa de lo prescrito y lo hecho.

## 18. Coherencia entre documentos

| Contradicción                                                                                                          | Origen                                    | Resolución                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `EXECUTION.md` §2: fecha de ejecución «en la zona de la aplicación»; el código y `V1_SPEC.md` §5: zona del dispositivo | Error de redacción en el bloque 2         | **Corregido** en `EXECUTION.md`: manda el código, que está probado                                    |
| Versión 1 de este documento: «original» = primera versión publicada; P-92: «original» = lo que recibió la clienta      | La versión 1 era anterior a tu definición | **Corregido** con tu definición; se retira la tercera vista                                           |
| Versión 1: estados «más o menos exigente» e «incumplimientos repetidos»; P-91: no juzgar                               | Ídem                                      | **Corregido:** vocabulario del §3.2 y «diferencias repetidas»                                         |
| Versión 1: la duración con advertencia «no entra en medias»; P-95: no asumir inactividad                               | Regla añadida por mí, no aprobada         | **Retirada;** queda pendiente (P-114)                                                                 |
| Versión 1 y `DATA_MODEL.md`: «activa» y `trainer_setting` para tolerancias                                             | Anteriores a P-91 y P-95                  | **Corregido:** «duración calculada»; sin tabla de tolerancias                                         |
| `V1_SPEC.md` §6: duración «con las pausas»; P-95: transcurrida, pausas y calculada                                     | La especificación de V1 era anterior      | **Nota** en `V1_SPEC.md` §6: sustituido por P-95                                                      |
| `V1_SPEC.md` A3: «el total realizado del día» en una vista agrupada por fecha prevista; P-93                           | Ídem                                      | **Nota** en `V1_SPEC.md`: A3 muestra el estado de lo previsto y lo hecho con su fecha (§9.4)          |
| Código: «Carga» y «Resultados» por fecha prevista, «Progreso» por fecha de ejecución                                   | Vistas de la Fase 1                       | **Pendiente de B3.2** (P-106)                                                                         |
| `EFFORT_AND_LOAD.md` §10.1: incluye la carga autoseleccionada con kg en el tonelaje; esta auditoría: no tiene base     | Diseño anterior a la auditoría de bases   | **Nota** en `EFFORT_AND_LOAD.md`; pendiente (P-115)                                                   |
| `MASTER_SPEC.md` (glosario): «tonelaje = Σ repeticiones × kg de carga externa», sin la base ni el carácter nominal     | Glosario general                          | **Precisado** en el glosario                                                                          |
| `PROGRESSION_AND_AUTOREGULATION.md` §6.3 y P-49: duración «sin las pausas registradas»                                 | —                                         | **Coherente** con P-95                                                                                |
| ADR-25 a ADR-32                                                                                                        | —                                         | **Sin contradicción.** ADR-28 (horas ajustadas) obliga a la protección de duración incoherente (§4.5) |

## 19. Temas transversales (de la versión 1, vigentes)

### 19.1 ADR-25 a ADR-32

Recomendación: **mantenerlas todas**. Consecuencias principales:

| ADR    | Decisión                                      | Consecuencias y recomendación                                                                                                                                                                                                                                                                  |
| ------ | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADR-25 | Bloqueo del sistema y restauración con diario | Exclusividad real y restauración recuperable. No protege en discos de red; en Linux y macOS, borrar `.lock` a mano inutiliza el primer servidor (nunca escriben dos). Windows sin probar. **Mantener**                                                                                         |
| ADR-26 | Guardado automático a los 2 s y copia local   | Ventana de pérdida corta; dos pestañas del mismo navegador comparten la copia. **Mantener**                                                                                                                                                                                                    |
| ADR-27 | Identidad en cada comando                     | Lo de otra persona espera en el dispositivo hasta que vuelva. **Mantener**                                                                                                                                                                                                                     |
| ADR-28 | Tolerancia de 5 min y rango 2020–2100         | <ul><li>Un reloj mal puesto dentro del rango lo corrige T3.</li><li>Una serie sin conexión con el reloj fuera del rango hay que volver a registrarla (P-113).</li><li>Las horas ajustadas pueden dar duraciones incoherentes (§4.5).</li></ul>**Mantener**; revisar los 5 min con datos reales |
| ADR-29 | Espera de 1 s y errores clasificados          | Las demás acciones del entrenador caen en la página genérica: B3.0. **Mantener**                                                                                                                                                                                                               |
| ADR-30 | `local-demo` solo en loopback                 | API no documentada (falla de forma segura); impide probar en un móvil real por la red local. **Mantener**                                                                                                                                                                                      |
| ADR-31 | Procedencia guardada                          | **Mantener**                                                                                                                                                                                                                                                                                   |
| ADR-32 | Semilla relativa                              | **Mantener**                                                                                                                                                                                                                                                                                   |

### 19.2 Copias en el modo local (P-107, sin implementar)

- **Manuales:** como hoy.
- **Automáticas:** antes de migrar, restablecer y restaurar, como hoy. Además, **al arrancar si la última automática tiene más de 24 h**, sin temporizadores en segundo plano.
- **Retención:**
  - las 14 últimas automáticas;
  - las 10 últimas de cada tipo previo a una operación;
  - **las manuales nunca se borran solas**;
  - nunca se borra la única copia válida.
- **Tamaño:** unos 0,5 MB por copia.
- **Recuperación:** `db:restore` y `db:recover`. `db:status` avisaría si la última copia tiene más de 7 días.
- **Ubicación:** la misma carpeta y el mismo disco. **No protegen de una avería del disco**; se documentaría cómo copiarlas a un disco externo. Sin nube y sin cifrado, así que solo valen para datos ficticios.

### 19.3 Página de error de la base (A-15)

Forma parte de B3.0 (§14).

### 19.4 Windows, Safari e iOS (P-110)

| Plataforma        | Plan                                                                                                                                                                                     | Mientras tanto                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Windows           | Lo ejecutas tú: `pnpm verify:env`, `pnpm test` y `pnpm test:e2e`, más dos servidores y una restauración interrumpida, con una lista de comprobación. CI con Windows, solo si lo apruebas | Bloqueo, `rename` y `fsync`, documentados y sin probar                                                |
| Safari escritorio | Proyecto WebKit de Playwright. Necesita descargar ese navegador: requiere tu aprobación                                                                                                  | Sin verificar                                                                                         |
| iOS               | Simulador de iOS en un Mac (Safari llega al `127.0.0.1` del Mac). Un iPhone real necesita salir de loopback, que ADR-30 impide                                                           | Safari puede borrar el almacenamiento local tras días sin uso; no hay sincronización en segundo plano |
| Android real      | Igual que un iPhone real                                                                                                                                                                 | Solo Chromium en modo Pixel 7                                                                         |

## 20. Dependencias con bloques posteriores

| Bloque o fase             | Qué necesita del bloque 3                                   | Qué aporta al bloque 3                                                                                                         |
| ------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 4 · Prescripción completa | Fórmulas por base, modalidad y tipo                         | Por serie, lastre, asistida, %1RM, tiempo y distancia en el constructor; base de la autoseleccionada (P-115); intención (P-99) |
| 5 · Editar lo publicado   | Perspectivas original y vigente; fechas por versión (P-118) | Versiones reales que analizar                                                                                                  |
| 6 · Cierre de V1          | A8–A10 accesibles                                           | —                                                                                                                              |
| V3 (evaluaciones)         | —                                                           | 1RM y peso corporal: intensidad relativa y carga respecto al peso corporal                                                     |
| V4 (semana y plantillas)  | Vista semanal                                               | Entidad «bloque»                                                                                                               |
| 1C (autorregulación)      | Nivel 2 por serie, tendencias de esfuerzo y carga interna   | Reglas supervisadas y registro de decisiones                                                                                   |
| Fase 2 (PostgreSQL)       | Dominio puro y portable                                     | Rendimiento con varios usuarios                                                                                                |
