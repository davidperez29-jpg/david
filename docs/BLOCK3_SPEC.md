# Bloque 3 · Análisis del entrenamiento

**Estado: propuesta pendiente de tu aprobación (13 de noviembre de 2026, PROMPT 15).** Nada de este documento está implementado. El PROMPT 15 autoriza la auditoría, el diseño y la documentación del bloque 3, **no su implementación**.

**Punto de partida comprobado:** rama `claude/vigilant-bardeen-qfycp4` en `47f173a`, igual que el remoto y con el árbol limpio. Batería en verde al cerrar el PROMPT 14: 290 pruebas unitarias y de integración, y 135 E2E (más 2 omitidas por ser solo de móvil) (`AUDIT_BLOCK1.md` §15.13).

**Relación con otros documentos:**

- Refina `V1_SPEC.md` §6 (análisis de V1) y su bloque 3 (§9).
- Toma las definiciones de volumen de `EFFORT_AND_LOAD.md` §10 y las de carga interna de `PROGRESSION_AND_AUTOREGULATION.md` §6 y §7.
- Si algo choca, manda este documento para el bloque 3 y se corrige el otro (`MASTER_SPEC.md`).

**Leyenda** (la misma de `AUDIT_BLOCK1.md`):

| Marca | Significado                                             |
| ----- | ------------------------------------------------------- |
| **P** | Comprobado mediante pruebas                             |
| **I** | Comprobado mediante inspección del código o del esquema |
| **D** | Documentado, pero no verificado                         |
| **N** | No existe                                               |
| **?** | Pendiente de tu decisión (decisiones P-90 a P-113, §16) |

## 1. Resumen

El bloque 3 convierte lo registrado en el bloque 2 en herramientas de análisis para el entrenador. Responde a cinco preguntas: qué se planificó, qué se hizo, cómo se hizo, en qué se diferenció y qué conviene revisar.

**Propuesta en tres partes:**

| Parte    | Contenido                                                                                                                | Modelo de datos                                      | Necesita                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- | --------------------------- |
| **B3.1** | Análisis de una sesión (A8): cumplimiento por dimensiones, volumen por magnitud y diferencias serie a serie. Día y panel | Sin cambios: todo se calcula al leer                 | P-90 a P-95                 |
| **B3.2** | Cliente por semanas y por periodo (A9), evolución de un ejercicio (A10), volumen por patrón y página «Carga» corregida   | Sin cambios (o una tabla de ajustes si P-91 lo pide) | P-96 a P-100, P-104, P-106  |
| **B3.3** | RPE de la sesión y carga interna estimada (RPE de la sesión × minutos)                                                   | Una tabla nueva, solo de añadir (§11.3)              | Q2, P-101, P-112 (opcional) |

**Lo que no hace el bloque 3:**

- un porcentaje único de «cumplimiento»;
- recomendaciones o cambios automáticos de la prescripción;
- diagnósticos de fatiga;
- estimación del 1RM;
- cociente agudo:crónico;
- volumen por grupo muscular;
- convertir datos subjetivos en mediciones.

## 2. Datos disponibles hoy

Revisado en el esquema (`src/server/db/migrations/001`–`003`), el dominio y los servicios. Que un dato aparezca en la documentación no basta: se ha comprobado dónde se guarda y quién lo escribe.

### 2.1 Almacenado: por serie (`set_log`)

| Dato                                                              | Estado | Notas para el análisis                                                                                                                                                                                                                |
| ----------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Serie registrada (`client_set_id`), ejercicio, variante, nº serie | I, P   | Un único registro original por serie; las correcciones forman una cadena (`supersedes`). La **serie efectiva** es la que nadie sustituye                                                                                              |
| Versión de la prescripción con la que se registró                 | I, P   | `version_number`: cada serie se compara con **su** versión                                                                                                                                                                            |
| Hecha o no realizada (`completed`)                                | I, P   | «No realizada» es una decisión explícita de la clienta. Una serie sin registro es otra cosa: «sin registrar»                                                                                                                          |
| Repeticiones, segundos o metros                                   | I, P   | Uno de los tres según lo prescrito; en series por distancia, el tiempo es opcional                                                                                                                                                    |
| Carga realizada: `load_kind`, `load_kg`, `load_descriptor`        | I, P   | **`load_kg` cambia de significado según `load_kind`**: kg totales (`external`), kg de lastre (`bodyweight_plus`), kg de asistencia (`assisted`) o kg opcionales (`self_selected` y otros). Se interpreta siempre junto a su modalidad |
| Base de la carga (total, por lado, por implemento)                | I      | **No está en la serie**: está en la prescripción de su versión. La serie se registra en la misma base que lo prescrito                                                                                                                |
| RIR; RPE con su escala                                            | I, P   | Autodeclarados. El RPE siempre con escala (`rir_based`, `omni_res` o `borg_cr10`)                                                                                                                                                     |
| Observación de la serie                                           | I, P   | Texto libre, como mucho 300 caracteres                                                                                                                                                                                                |
| Hora de ejecución, del dispositivo, zona, desfase y recepción     | I, P   | Reglas T1–T4 (`EXECUTION.md` §7.1), con el motivo si se usó la hora de recepción                                                                                                                                                      |
| Procedencia (`origin`, `recorded_by`)                             | I, P   | Hoy siempre `self_reported` por el `client` (migración `003`)                                                                                                                                                                         |

### 2.2 Almacenado: por sesión y por versión

| Dato                                                                     | Estado | Notas                                                                                                                                       |
| ------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Fecha prevista y orden en el día (`session`)                             | I, P   | Varias sesiones el mismo día                                                                                                                |
| Prescripción de cada versión (`session_version.content`, JSON)           | I, P   | Inmutable. Series, repeticiones o rango, carga, esfuerzo objetivo, descanso, tempo y notas; `estimatedMinutes` (opcional) y `focus` (texto) |
| Autor, fecha, motivo y resumen de cambios de cada versión                | I, P   |                                                                                                                                             |
| Inicio, versión de inicio, fin, motivo del fin, series pendientes        | I, P   | `finish_reason`: `all_done` o `ended_early`; `pending_sets_confirmed` al cerrar parcialmente                                                |
| Pausas: total acumulado (`paused_seconds`) y pausa abierta (`paused_at`) | I, P   | **Solo el total**: no se guarda la hora de cada pausa ni de cada reanudación                                                                |
| Última actividad (`last_activity_at`)                                    | I      | Solo la última, no la serie de actividades                                                                                                  |
| Comentario final de la clienta (`comment`)                               | I, P   |                                                                                                                                             |
| `perceived_effort` (0–10)                                                | I      | **Solo lo rellena la semilla, con valores ficticios y sin escala.** El bloque 2 no lo registra. **No hay hoy ningún RPE de sesión real**    |

### 2.3 Almacenado: biblioteca (en el código, no en la base)

| Dato                                               | Estado | Utilidad para el análisis                                                                                                     |
| -------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Patrón principal y secundarios de cada variante    | I      | Volumen por patrón (§6.4)                                                                                                     |
| Región corporal (tren superior, inferior, tronco…) | I      | Demasiado general para hablar de «grupos musculares»                                                                          |
| Etiquetas de cualidad (`capacity`) por variante    | I      | Varias por variante: describen **para qué sirve** el ejercicio, **no** con qué intención se prescribió en una sesión concreta |
| Grupos musculares                                  | **N**  | No hay taxonomía de músculos (P-53)                                                                                           |

### 2.4 Calculable sin estimaciones

| Cálculo                                                             | Con qué datos                                        | Condición                                                  |
| ------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------- |
| Series prescritas, hechas, no realizadas y sin registrar            | Prescripción de referencia (§4.2) y series efectivas | Siempre                                                    |
| Repeticiones, segundos y metros prescritos frente a hechos          | Ídem                                                 | Cada magnitud por separado                                 |
| Diferencias por serie: repeticiones, kg, RIR y RPE                  | Serie frente a su versión                            | Kg solo en la misma modalidad; RPE solo en la misma escala |
| Tonelaje externo prescrito y ejecutado                              | kg externos **totales**                              | Base total, o por implemento con el número de implementos  |
| Lastre y asistencia                                                 | `bodyweight_plus` y `assisted`                       | Aparte del tonelaje                                        |
| Duración bruta (inicio → fin) y activa (menos pausas)               | `session_log`                                        | Sesión terminada; aviso si no es representativa (§4.6)     |
| Fecha prevista frente a real, adelanto o retraso                    | `planned_date` y la fecha local del inicio           | Siempre                                                    |
| Versiones usadas, correcciones y series fuera de la versión vigente | `version_number` y `supersedes`                      | Siempre                                                    |
| Recuento de series por patrón                                       | Biblioteca                                           | Principal, y principal con secundarios, por separado       |

### 2.5 No existe todavía

| Dato                                                        | Consecuencia en el bloque 3                                | Qué haría falta                                                                |
| ----------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Descanso realmente hecho**                                | Solo se muestra el previsto, con «no registrado»           | Registrar el descanso en el reproductor (comando nuevo) en un bloque posterior |
| **RPE de la sesión**                                        | Sin carga interna                                          | B3.3 (Q2, P-48, P-49), §7                                                      |
| Motivo de una serie no realizada o de un ejercicio no hecho | «No realizada» sin motivo                                  | `stop_reason` o `exercise_skip` (`DATA_MODEL.md` §5), más adelante             |
| Series de calentamiento (`set_role`)                        | Todas son de trabajo                                       | Bloque 4 o posterior (P-20)                                                    |
| Criterios de finalización, calidad o velocidad medida       | Sin cumplimiento «cualitativo» por criterios               | Bloque 4 y posteriores                                                         |
| Hora de cada pausa y reanudación                            | La duración activa solo resta el total de pausas           | No hace falta para B3                                                          |
| Peso corporal medido, 1RM de referencia en la base          | Sin intensidad relativa ni carga respecto al peso corporal | Evaluaciones (V3) y prescripción completa (bloque 4)                           |
| Entidad «bloque» o plan de entrenamiento                    | El «bloque» es un rango de fechas que elige el entrenador  | Planificación (Fase 6 y V4)                                                    |
| Frecuencia cardiaca u otros fisiológicos                    | Nada                                                       | Integraciones verificadas (E5)                                                 |
| Motivo de una corrección y anotaciones del entrenador       | Se ven las correcciones, pero no su porqué                 | §13 (P-109)                                                                    |

### 2.6 Hallazgos que afectan al análisis

1. **`perceived_effort` es de la semilla** [I]: valores inventados sin escala, que la pestaña «Registro» muestra como «esfuerzo percibido X/10». No sirven para carga interna (P-102).
2. **La página «Carga» de la Fase 1 cuenta por fecha prevista** [I] (`getLoadOverview`): una sesión hecha otro día suma a la semana prevista, no a la real (P-93, P-106).
3. **El tonelaje 1.0.0 toma los kg «externos» sin mirar la base** [I] (`performedKg` en `compat.ts`). Con «por implemento» o «por lado» daría una cifra errónea. Hoy no ocurre, porque la semilla y el constructor solo usan «total», pero el modelo lo admite.
4. **Las vistas de la Fase 1 comparan con la versión vigente** [I] (capa de compatibilidad), no con la versión de cada serie. A7 sí lo hace bien (`review.ts`). El análisis nuevo seguirá a A7.
5. **La duración incluye los cortes sin pausa** [I]: si la clienta cierra la aplicación sin pausar y vuelve al día siguiente, «inicio → fin» abarca la noche. Hace falta el aviso del §4.6.
6. **Otras acciones del entrenador ante una base ocupada** [I]: crear sesión, borrar o mover un borrador, copia y restablecer no devuelven el error tipado de ADR-29 y acaban en la página de error genérica. Es residual de A-11 y se propone resolverlo con la página de error de la base (P-108).

## 3. Objetivos, alcance y exclusiones

### 3.1 Objetivos

1. Ver en una pantalla qué se prescribió, qué se hizo y en qué se diferenció cada serie, **sin mezclar magnitudes**.
2. Medir el cumplimiento por **dimensiones separadas** y transparentes, sin un porcentaje que lo resuma todo (§5).
3. Seguir el volumen y la evolución de un cliente por sesión, día, semana y periodo, con lo **prescrito** (original o vigente) y lo **ejecutado**.
4. Dejar preparados los datos y las vistas que necesitará la autorregulación supervisada (1C), sin tomar decisiones automáticas (§10).
5. Todo cálculo, con su fórmula y versión del registro (`src/domain/formulas.ts`) y la insignia «Cálculo».

### 3.2 Alcance por partes

| Parte    | Incluye                                                                                                                                                                                                                                                                                        |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B3.0** | (Previa, si apruebas P-108) Página de error de la base y errores tipados en las acciones del entrenador que aún no los tienen                                                                                                                                                                  |
| **B3.1** | <ul><li>Dominio de análisis y fórmulas registradas (§12).</li><li>A8 · Análisis de la sesión.</li><li>Totales por día en A3.</li><li>Panel A1: sesiones de hoy y pendientes de revisar.</li><li>Resumen prescrito en el constructor (E2E-1, paso 1).</li></ul>                                 |
| **B3.2** | <ul><li>A9 · Análisis del cliente: semana y periodo, con filtros.</li><li>A10 · Evolución de un ejercicio.</li><li>Volumen por patrón.</li><li>Incumplimientos repetidos como listas descriptivas.</li><li>La página «Carga» de todos los clientes, rehecha con las fórmulas nuevas.</li></ul> |
| **B3.3** | (Opcional) Pregunta del RPE de la sesión a la clienta al terminar, migración `004`, carga interna estimada por sesión y semana                                                                                                                                                                 |

### 3.3 Exclusiones

- Recomendaciones de carga, progresiones y cambios automáticos de la prescripción (1C, P-45).
- Diagnóstico de fatiga, «riesgo de lesión» y cociente agudo:crónico (`PROGRESSION_AND_AUTOREGULATION.md` §6.3).
- Monotonía y _strain_ de Foster: no se calculan en este bloque.
- Estimación del 1RM, intensidad relativa (% 1RM) y carga respecto al peso corporal (necesitan evaluaciones y el bloque 4).
- Volumen por grupo muscular (P-53) y por cualidad (P-99).
- Análisis para la clienta: su «Progreso» no cambia, salvo la corrección de fórmulas que la afecte (§9.7).
- Informes imprimibles (V6), tiempo real e integraciones.

## 4. Reglas comunes del análisis

### 4.1 Qué cuenta

- **Solo las series efectivas:** un reenvío o una corrección cuentan una vez.
- **Una serie «no realizada»** no suma magnitudes, pero sí cuenta como prescrita y no hecha.
- **Una sesión en curso o interrumpida** se analiza con lo confirmado y lo dice: «En curso: lo pendiente en el móvil de la clienta no se ve».
- **Solo lo confirmado por el servidor.** Lo pendiente en el móvil no existe para el análisis.
- **Los datos de la semilla** se analizan igual que los demás (son ficticios), salvo `perceived_effort` (P-102).

### 4.2 Prescripción de referencia (P-92)

Una sesión puede tener varias versiones, y una serie puede registrarse con una versión que ya no es la vigente. Para comparar:

| Caso                                            | Se compara con                                           |
| ----------------------------------------------- | -------------------------------------------------------- |
| Serie registrada                                | La prescripción de **la versión con la que se registró** |
| Serie sin registrar                             | La de la **versión vigente**                             |
| Serie registrada que ya no existe en la vigente | Su versión; se lista como «fuera de la versión vigente»  |

Los **totales prescritos** de la sesión salen de esa referencia, serie a serie. Además, A8 y A9 permiten ver **lo prescrito originalmente** (la primera versión publicada) y **lo prescrito vigente**, para que un cambio de prescripción nunca borre lo que se planificó.

### 4.3 Fechas (P-93, P-94)

| Concepto               | Regla                                                                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fecha prevista**     | `session.planned_date`                                                                                                                                                                |
| **Fecha de ejecución** | La fecha local del **inicio**, en la zona horaria del dispositivo al empezar (`executionDate`, ya implementado y probado). Las series de después de medianoche pertenecen a la sesión |
| **Día y semana**       | Lo **ejecutado** se atribuye a la fecha de ejecución; lo **planificado**, a la fecha prevista. Son dos vistas y no se mezclan                                                         |
| **Semana**             | ISO 8601, de lunes a domingo, calculada sobre esas fechas locales                                                                                                                     |
| **Sesión trasladada**  | En la semana prevista: «prevista aquí, hecha el 14 (otra semana)». En la semana real, cuenta lo ejecutado                                                                             |
| **Zonas horarias**     | Cada sesión usa la zona de su inicio. Un viaje no mueve sesiones ya hechas. Los instantes se comparan en UTC                                                                          |

### 4.4 Varias sesiones el mismo día

El día suma cada magnitud de sus sesiones (por fecha de ejecución). Nunca promedia los porcentajes de cada sesión: vuelve a calcular con los totales. Las sesiones siguen distinguiéndose por su orden y su contexto («Mañana», «Tarde»).

### 4.5 Semanas con distinto número de sesiones

No se normaliza por defecto: se muestran los totales y el número de sesiones (prescritas, empezadas, completadas y parciales). Una media por sesión se ofrece solo junto a su denominador («media de 3 sesiones»).

### 4.6 Duración (P-95)

| Métrica              | Definición                                                                                                                          | Unidad |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **Prevista**         | `estimatedMinutes` de la versión, si existe                                                                                         | min    |
| **Bruta**            | Fin − inicio                                                                                                                        | min    |
| **Activa**           | Bruta − pausas registradas                                                                                                          | min    |
| **¿Representativa?** | No, si entre dos actividades consecutivas (inicio, cada serie, fin) hay un hueco mayor que **G** minutos que las pausas no explican | —      |

- **G es un parámetro de diseño, no un valor científico.** Se propone G = 30 min (P-95).
- Si no es representativa, se muestra «Duración no representativa: 9 h 05 min sin actividad entre las 21:10 y las 06:15» y no entra en medias ni en la carga interna (§7).
- Como solo se guarda el total de pausas, la regla es conservadora: compara cada hueco con el total de pausas, no con la pausa concreta.

## 5. Cumplimiento: propuesta multidimensional (P-90)

### 5.1 Principios

1. **No hay un número único.** «10 de 10 ejercicios» no es «100 % de la sesión» si las cargas, las repeticiones o el esfuerzo fueron otros.
2. **Cada dimensión se mide en su unidad** y se muestra como **fracción con su denominador** («14 de 16 series»). Un porcentaje solo acompaña a la fracción, nunca la sustituye.
3. **Sin dato no es incumplimiento.** Si se pidió RIR y no se registró, es «sin dato», no «no cumplido».
4. **Solo se compara lo comparable:** kg con kg en la misma modalidad y base, y RPE con RPE en la misma escala.
5. **Es una definición operativa** (decisión de diseño), no un indicador validado científicamente. Se registra en el registro de fórmulas como `operational_definition`.

### 5.2 Dimensiones

| Dimensión                          | Qué responde                             | Unidad de cálculo                          | Resultado                                                                                                                                                                          |
| ---------------------------------- | ---------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Estructural · ejercicios**    | ¿Qué ejercicios se hicieron?             | Ejercicio de la prescripción de referencia | Completo (todas sus series hechas) · parcial · no realizado (todas marcadas «no realizada») · sin registrar                                                                        |
| **1. Estructural · series**        | ¿Qué series se hicieron?                 | Serie prescrita                            | Hechas / no realizadas / sin registrar, sobre las prescritas                                                                                                                       |
| **2. Cuantitativa · repeticiones** | ¿Cuánto se hizo respecto a lo previsto?  | Serie hecha, prescrita por repeticiones    | Por serie: igual (o dentro del rango) / menos / más, con la diferencia. Total: Σ hechas frente a Σ previstas (rango: [Σ mín., Σ máx.])                                             |
| **2. Cuantitativa · tiempo**       | Ídem, por tiempo                         | Serie hecha, prescrita en segundos         | Igual / menos / más. Total en s                                                                                                                                                    |
| **2. Cuantitativa · distancia**    | Ídem, por distancia                      | Serie hecha, prescrita en metros           | Igual / menos / más. Total en m                                                                                                                                                    |
| **3. Intensidad · carga**          | ¿Con qué carga, respecto a la prevista?  | Serie hecha con carga comparable           | Igual / menos / más, con la diferencia en kg y en % de lo previsto. Asistencia: «más asistencia» significa **menos carga**. Bandas, dispositivo u «otra»: igual o distinta (texto) |
| **3. Intensidad · esfuerzo**       | ¿Con qué esfuerzo, respecto al objetivo? | Serie hecha con objetivo de RIR o RPE      | RIR: igual / **más exigente** (RIR menor) / **menos exigente** (RIR mayor). RPE en la misma escala: igual / más / menos. Sin registro: «sin dato»                                  |
| **4. Cualitativa**                 | ¿Qué pasó además?                        | Sesión, ejercicio y serie                  | Observaciones, comentario final, correcciones, versiones usadas, cierre parcial, horas ajustadas. **Sin puntuación**                                                               |

**Rangos:** dentro del rango cuenta como «igual». Por debajo, la diferencia es respecto al mínimo; por encima, respecto al máximo.

**Carga autoseleccionada:** no hay kg previstos, así que no hay diferencia. Se muestra «carga elegida: 18 kg».

### 5.3 Tolerancias (P-91)

Cada dimensión numérica tiene una tolerancia: repeticiones (rep.), carga (% de lo previsto), RIR (rep.) y RPE (puntos). **Se propone empezar con tolerancia 0**, es decir, comparación exacta mostrando siempre la diferencia numérica, y permitir que el entrenador la ajuste más adelante.

Cualquier tolerancia distinta de 0 es una preferencia del entrenador, no un valor científico. Por ejemplo, la imprecisión del RIR aumenta lejos del fallo (Zourdos et al., 2021; `EFFORT_AND_LOAD.md` §4.3), pero eso no fija ningún margen concreto.

### 5.4 Agregación

- **Por ejercicio y por sesión:** recuentos por estado en cada dimensión, sobre las series en las que la dimensión **aplica**, con «sin dato» y «no aplica» aparte.
- **Por día, semana y periodo:** se suman recuentos y magnitudes y se recalculan las fracciones. Nunca se promedian porcentajes.
- **Entre dimensiones: nada.** No se suman, no se ponderan y no se combinan.

### 5.5 ¿Índice global? (P-103)

**Recomendación: no** en el bloque 3. Si en el futuro lo quieres, solo como opción:

- con los pesos que elija el entrenador;
- con cada componente visible al lado;
- con el nombre «índice configurado por el entrenador (no validado)»;
- nunca como valor por defecto ni para comparar clientes.

TrainPro no propondrá pesos: cualquier ponderación sería arbitraria.

### 5.6 Ejemplo verificable (E2E-1 ampliado)

**Prescripción (v1):**

- Sentadilla trasera: 3 × 10 × 60 kg, RIR 2, descanso 2 min.
- Plancha: 3 × 30 s, sin carga externa ni objetivo de esfuerzo.

**Realizado:**

| Ejercicio  | Serie 1           | Serie 2           | Serie 3                |
| ---------- | ----------------- | ----------------- | ---------------------- |
| Sentadilla | 10 × 60 kg, RIR 2 | 10 × 60 kg, RIR 1 | 9 × 60 kg, RIR 0       |
| Plancha    | 30 s              | 30 s              | Marcada «no realizada» |

La sesión se termina como parcial.

| Dimensión        | Resultado                                                                       |
| ---------------- | ------------------------------------------------------------------------------- |
| Ejercicios       | Sentadilla **completa** · Plancha **parcial**                                   |
| Series           | **5 de 6** hechas · 1 no realizada · 0 sin registrar                            |
| Repeticiones     | Sentadilla **29 de 30** · serie 3: **−1**                                       |
| Tiempo           | Plancha **60 de 90 s**: las 2 series hechas, iguales; la 3.ª no se hizo         |
| Carga            | **3 de 3** series de sentadilla con la carga prevista                           |
| Esfuerzo (RIR)   | **1 de 3** igual · **2 de 3 más exigentes** (RIR 1 y 0 frente a 2) · 0 sin dato |
| Tonelaje externo | Previsto **1.800 kg** · ejecutado **1.740 kg** (`training.volume-load` 2.0.0)   |
| Cualitativa      | Cierre parcial con 1 serie no realizada; sin correcciones; versión v1           |

**Lo que no se muestra:** «83 % de cumplimiento». La sesión se lee así: «Hizo todo lo de la sentadilla, con una repetición menos al final y más cerca del fallo de lo previsto; la plancha se quedó en 2 de 3 series».

### 5.7 Limitaciones

- El RIR y el RPE son estimaciones de la clienta, con error, sobre todo lejos del fallo (Zourdos et al., 2021) y con poca experiencia (Helms et al., 2016). Las diferencias de esfuerzo no son mediciones.
- No se sabe **por qué** se hizo menos: no hay motivo estructurado (§2.5). Las observaciones son la única pista.
- La dimensión cualitativa no puntúa criterios (calidad, velocidad, técnica) porque no se registran.
- Más series «más exigentes» no implican fatiga: puede ser una carga prevista demasiado alta, una mala estimación del RIR o un mal día. **El análisis describe; el entrenador interpreta.**

## 6. Volumen

### 6.1 Validez de cada cálculo

| Tipo de serie                                 | Series | Repeticiones | Tiempo / distancia | Tonelaje externo                                      | Otra magnitud                                                                      |
| --------------------------------------------- | ------ | ------------ | ------------------ | ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Carga externa, base **total**                 | Sí     | Sí           | —                  | **Sí**: repeticiones × kg                             | —                                                                                  |
| Carga externa, **por implemento** (n)         | Sí     | Sí           | —                  | **Sí**: repeticiones × kg × n                         | —                                                                                  |
| Carga externa, **por lado** (discos por lado) | Sí     | Sí           | —                  | **No**: falta el peso de la barra o del soporte       | «Tonelaje sin calcular: carga por lado» (P-97)                                     |
| %1RM con kg congelados                        | Sí     | Sí           | —                  | Sí, con los kg **realizados**                         | (La intensidad relativa necesita un 1RM de referencia en la base: bloque 4)        |
| Peso corporal sin lastre                      | Sí     | Sí           | —                  | **No** (`EFFORT_AND_LOAD.md` §10.3)                   | Repeticiones con peso corporal                                                     |
| Peso corporal + lastre                        | Sí     | Sí           | —                  | **No** se suma al tonelaje                            | **Lastre**: Σ repeticiones × kg añadidos (`training.added-load-volume`)            |
| Asistida                                      | Sí     | Sí           | —                  | **No**                                                | **Asistencia**: series, repeticiones y asistencia media ponderada por repeticiones |
| Bandas elásticas, dispositivo u «otra»        | Sí     | Sí           | —                  | **No**: resistencia no cuantificada en kg             | Recuento de series y de repeticiones, con el descriptor                            |
| Isométrico (por tiempo)                       | Sí     | **No**       | **Segundos**       | **No**                                                | Tiempo bajo tensión prescrito frente a hecho (Σ s)                                 |
| Por distancia                                 | Sí     | **No**       | **Metros**         | **No** (aunque haya carga, p. ej. paseo del granjero) | Σ m; con carga: «Σ m con 2 × 24 kg» como texto, sin multiplicar                    |
| Sin carga externa                             | Sí     | Sí           | Según el tipo      | **No**                                                | —                                                                                  |
| Carga autoseleccionada con kg anotados        | Sí     | Sí           | —                  | **Sí**, con los kg realizados (base total)            | Sin prescrito en kg: no hay tonelaje previsto                                      |

**Reglas que no se rompen** (V1_SPEC §6 y P-36):

- no se suman repeticiones de tipos distintos, ni segundos con repeticiones, ni metros con nada;
- no se suma tonelaje con lastre, asistencia ni peso corporal × repeticiones;
- las series se pueden sumar entre tipos, **pero se muestran desglosadas** porque una serie de 30 s de plancha y una de 5 × 100 kg no son equivalentes;
- el tonelaje de ejercicios distintos se puede sumar como orientación general, con esa limitación escrita; no es trabajo mecánico.

### 6.2 Repeticiones por lado (P-96)

Una serie de «10 por lado» se registra como 10.

- **Repeticiones:** se cuentan 10, con la marca «por lado», y se muestran aparte del resto.
- **Tonelaje:** se cuentan los dos lados (30 kg × 10 × 2), como ya decía `EFFORT_AND_LOAD.md` §3.

Hoy el constructor no ofrece «por lado» (solo el modelo lo admite), así que esta regla no afecta a ningún dato actual.

### 6.3 Escalas

Cada magnitud se calcula por ejercicio, sesión, día, semana y periodo, siempre **prescrita frente a ejecutada**, con las reglas de fechas del §4.3.

### 6.4 Por patrón, cualidad y grupo muscular

| Agrupación                          | Propuesta                                                                                                                                                                                                                                                                                                        |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Por patrón de movimiento** (P-98) | En B3.2. Dos recuentos **separados** (`TAXONOMY.md`):<ul><li>«solo patrón principal»: cada serie suma 1 a su patrón principal;</li><li>«principal y secundarios»: suma 1 a cada patrón de la variante.</li></ul>No se inventan pesos para los secundarios. Series y magnitudes por tipo, igual que en §6.1       |
| **Por cualidad u objetivo** (P-99)  | **No en el bloque 3.** Las etiquetas de cualidad describen usos posibles de la variante, y una serie contaría a la vez en «fuerza máxima» e «hipertrofia» sin que esa fuera la intención. Propuesta: una intención estructurada por ejercicio en la prescripción (bloque 4) y, con ella, el volumen por objetivo |
| **Por grupo muscular** (P-100)      | **No en el bloque 3** (P-53, E3): no hay taxonomía de músculos. La región corporal es demasiado general para llamarla «grupo muscular»                                                                                                                                                                           |

## 7. Carga interna

### 7.1 Variables que no se confunden

| Variable                          | Qué es                                          | Unidad                    | Escala                                | Cuándo                 | Estado           |
| --------------------------------- | ----------------------------------------------- | ------------------------- | ------------------------------------- | ---------------------- | ---------------- |
| **RIR de una serie**              | Repeticiones que quedaban antes del fallo       | repeticiones              | Enteros de 0 a 10                     | Al registrar la serie  | Existe (I, P)    |
| **RPE de una serie**              | Esfuerzo percibido en esa serie                 | puntos de su escala       | `rir_based`, `omni_res` o `borg_cr10` | Al registrar la serie  | Existe (I, P)    |
| **RPE de la sesión**              | Esfuerzo global de toda la sesión               | puntos                    | CR-10 modificada de Foster            | Tras terminar (§7.3)   | **N** (B3.3)     |
| **Duración**                      | Tiempo de la sesión                             | min                       | —                                     | Inicio, fin y pausas   | Existe (I)       |
| **Carga interna estimada (sRPE)** | RPE de la sesión × duración                     | unidades arbitrarias (UA) | —                                     | Al existir las dos     | **N** (B3.3)     |
| Frecuencia cardiaca y otras       | Respuesta fisiológica medida por un instrumento | lpm u otras               | —                                     | Importación verificada | **N** (E5)       |
| Valoración previa                 | Energía y recuperación antes de la sesión       | puntos (ítems propios)    | 1–10, sin validar                     | Antes de empezar       | **N** (P-47, Q2) |

- **El RPE de la sesión no es la media de los RPE de las series.** Sweet et al. (2004) observaron que el RPE de la sesión puede subestimar la media de los RPE tomados tras cada serie. Ni se calcula uno a partir de otro ni se sustituyen.
- **La carga interna no se suma al tonelaje:** son constructos distintos (Impellizzeri et al., 2019).

### 7.2 Carga interna estimada por el método del RPE de la sesión

| Elemento                 | Definición propuesta                                                                                                                                                                                                                                                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Qué calcula**          | Una puntuación de la carga interna de una sesión: intensidad global percibida × tiempo                                                                                                                                                                                                                                                         |
| **Fórmula**              | `carga interna (UA) = RPE de la sesión (0–10) × duración activa (min)`                                                                                                                                                                                                                                                                         |
| **Variables**            | RPE de la sesión: entero 0–10, escala CR-10 modificada por Foster et al. (2001). Duración activa: §4.6, en minutos enteros (redondeo al más próximo)                                                                                                                                                                                           |
| **Unidades**             | Unidades arbitrarias (UA). No son kg, ni julios, ni comparables con el tonelaje                                                                                                                                                                                                                                                                |
| **Supuestos**            | <ul><li>La persona conoce la escala.</li><li>El RPE refleja la sesión entera.</li><li>La duración es representativa (§4.6).</li></ul>                                                                                                                                                                                                          |
| **Escala y pregunta**    | «¿Cómo ha ido tu entrenamiento?» con la CR-10 modificada. Anclas según la tabla que reproduce Haddad et al. (2017): 0 reposo, 1 muy, muy fácil, 2 fácil, 3 moderado, 4 algo duro, 5 duro, 7 muy duro, 10 máximo (6, 8 y 9 sin rótulo). La traducción es propia y entra en la revisión de textos (Q6). **Pendiente de cotejar con el original** |
| **Momento**              | Al terminar, con «Responder más tarde» durante 24 h, guardando los minutos desde el fin (P-48). La tradición son unos 30 min después (Day et al., 2004, midieron a los 30 min). El momento queda registrado para poder analizar su efecto                                                                                                      |
| **Duración**             | Activa: fin − inicio − pausas. Haddad et al. (2017) recogen estudios que incluyeron y que excluyeron los descansos de la duración. Es una **decisión de diseño** (P-49) y se documenta                                                                                                                                                         |
| **Sin calcular**         | Si falta el RPE, si la sesión no terminó o si la duración no es representativa: «sin calcular», con el motivo                                                                                                                                                                                                                                  |
| **Semana**               | Σ de las sesiones con carga calculada, junto al número de sesiones incluidas y excluidas                                                                                                                                                                                                                                                       |
| **Contextos apropiados** | Seguir tendencias **de la misma persona** entre sesiones y semanas, con muchos tipos de ejercicio (Haddad et al., 2017). En fuerza es fiable (CCI 0,88; Day et al., 2004)                                                                                                                                                                      |
| **Limitaciones**         | <ul><li>Es una percepción, no una medición fisiológica.</li><li>Cambia con factores psicológicos y del entorno (Haddad et al., 2017).</li><li>No sirve para comparar personas.</li><li>Sesiones cortas e intensas y largas y suaves pueden dar la misma cifra.</li><li>Sin la duración bien definida, la cifra no es comparable.</li></ul>     |
| **Procedencia**          | RPE de la sesión: `self_reported`. Carga interna: `calculated` con `training.session-internal-load` 1.0.0                                                                                                                                                                                                                                      |

**Verificación de la fuente** (13 nov 2026, PubMed):

- **Foster et al. (2001), PMID 11708692:** el resumen confirma que el método del RPE de la sesión cuantifica el entrenamiento y es válido frente a la frecuencia cardiaca, pero **no detalla la fórmula**, y el texto completo no está en PubMed Central.
- **Haddad et al. (2017), [doi:10.3389/fnins.2017.00612](https://doi.org/10.3389/fnins.2017.00612), texto completo:** describe la multiplicación del RPE por la duración en minutos, con el ejemplo 87 min × 4 = 348 UA, y la escala con sus anclas.

**Es una fuente secundaria.** Según `SCIENTIFIC_RIGOR.md`, una fórmula científica se registra tras leer la fuente primaria, así que **B3.3 queda bloqueado hasta cotejar el original** (P-112). El ejemplo 87 × 4 = 348 servirá como prueba numérica.

### 7.3 Registro del RPE de la sesión (B3.3, si se aprueba)

1. Al terminar, el resumen del reproductor pregunta «¿Cómo ha ido tu entrenamiento?» con la escala de 0 a 10 y sus anclas, y la opción «Responder más tarde».
2. La respuesta va por la cola local, con un comando idempotente nuevo (`rate_session`), identidad (A-08) y reglas de hora.
3. Durante 24 h desde el fin, Hoy recuerda «Valora tu sesión de ayer». Después, la pregunta caduca y queda «sin valorar»: no se inventa nada.
4. Una sola respuesta por sesión. Una corrección es otra fila que sustituye a la anterior, con el mismo patrón que las series.
5. El entrenador puede desactivar la pregunta para un cliente indicando el motivo (P-48).

### 7.4 Lo que no se hace

- No se calcula sin RPE de sesión real: **`perceived_effort` de la semilla no se usa** (P-102).
- No se calculan el cociente agudo:crónico, la monotonía ni el _strain_.
- No se habla de «riesgo», «fatiga» ni «sobreentrenamiento».
- No se convierte el RPE de la sesión en RIR ni en % del 1RM.

## 8. Escalas temporales

| Escala             | Qué se ve                                                                                                                                            | Notas                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Sesión**         | A8 completo (§9.2)                                                                                                                                   | Con su versión de referencia                                       |
| **Día**            | Totales del día por magnitud, cada sesión con su estado, y la lista de sesiones                                                                      | Por fecha de ejecución; las previstas ese día y no hechas, aparte  |
| **Semana**         | Planificado frente a ejecutado por magnitud; sesiones prescritas, empezadas, completadas, parciales y sin hacer; perfil de cumplimiento; trasladadas | ISO, de lunes a domingo                                            |
| **Varias semanas** | Serie semanal de cada magnitud (prescrita y ejecutada), con las semanas vacías visibles                                                              | Ya hay una base (`weeklyVolume`), que se ampliará                  |
| **Bloque**         | Un rango de fechas elegido por el entrenador, con nombre opcional, sin guardar; los mismos totales y el perfil del periodo                           | Una entidad «bloque» real llega con la planificación (Fase 6 y V4) |

**Casos especiales:**

- **Sesiones incompletas:** cuentan con lo hecho; el perfil de cumplimiento muestra lo no hecho.
- **Cambios de prescripción:** el ejecutado se compara con la versión de cada serie. El planificado de la semana se puede ver como **original** (primera versión) o **vigente**. Si difieren, la semana muestra «La prescripción cambió en 2 sesiones: ver diferencias».
- **Sesiones que cruzan la medianoche:** cuentan en el día de su inicio.

## 9. Experiencia del entrenador

### 9.1 Principio

**Cada visualización responde a una pregunta y ayuda a una decisión.** Si no hay pregunta, no hay gráfico. Los gráficos son componentes propios (ADR-12), sin dependencias nuevas, accesibles (tabla equivalente y texto alternativo) y con la identidad de `DESIGN_SYSTEM.md`.

| Pregunta del entrenador                        | Visualización                                                                                             | Decisión que facilita                               | Dónde   |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------- |
| ¿Cómo fue la sesión de hoy?                    | Tarjeta de estado y **perfil de cumplimiento** (barras de estado por dimensión con fracciones)            | Revisar o seguir adelante                           | A8      |
| ¿En qué series se desvió y cuánto?             | **Tabla** prescrito \| realizado \| diferencia, con la versión; las diferencias resaltadas                | Ajustar la carga o el objetivo de la próxima sesión | A8      |
| ¿Se hizo lo planificado esta semana?           | Barras **planificado frente a ejecutado** por magnitud, y lista de sesiones con estado                    | Recolocar sesiones o reducir la carga de la semana  | A9      |
| ¿Cómo evoluciona el volumen?                   | **Serie semanal** por magnitud (una por gráfico), prescrito como línea y ejecutado como barras            | Mantener, aumentar o descargar                      | A9      |
| ¿Cómo evoluciona la carga en este ejercicio?   | **Puntos por sesión** con los kg de cada serie (mejor serie y rango) y las repeticiones; esfuerzo anotado | Progresar o mantener la carga                       | A10     |
| ¿Se repite un incumplimiento?                  | **Lista descriptiva** filtrable: «ejercicios con series por debajo en ≥ N de las últimas M sesiones»      | Revisar la prescripción con el cliente              | A9      |
| ¿Cómo se reparte por patrones?                 | **Barras horizontales** por patrón, con el conmutador «solo principal» o «principal y secundarios»        | Equilibrar la semana                                | A9      |
| ¿El esfuerzo registrado se aleja del objetivo? | Por ejercicio: recuento de series igual, más exigente y menos exigente en el periodo, con «sin dato»      | Revisar el objetivo o la carga, o enseñar la escala | A9, A10 |

**Lo que no se hace:** tartas, indicadores de tipo velocímetro, puntuaciones globales, rankings de clientes y gráficos sin la tabla equivalente.

### 9.2 A8 · Análisis de la sesión (`…/sesiones/[sessionId]/analisis`)

```
Fuerza · pierna · Mañana · prevista el 7 nov · hecha el 7 nov (en su día)          [Parcial]
Duración 49 min (activa 44 · pausas 5) · prevista 40 min · versión v1 · terminada antes
┌ Cumplimiento ────────────────────────────────────────────────────────────────────────┐
│ Ejercicios   ██████████░░░░  1 completo · 1 parcial · 0 sin hacer                    │
│ Series       █████████████░  5 de 6 · 1 no realizada                                 │
│ Repeticiones 29 de 30 (sentadilla)          Tiempo  60 de 90 s (plancha)            │
│ Carga        3 de 3 como estaba prevista                                             │
│ Esfuerzo     RIR: 1 igual · 2 más exigentes · 0 sin dato                             │
└──────────────────────────────────────────────────────────── ⓒ fórmulas y versiones ─┘
Volumen, sin mezclar magnitudes            Previsto   Hecho
  Series                                   6          5
  Repeticiones (por repeticiones)          30         29        ⓒ training.total-reps 2.0.0
  Tiempo (isométricos)                     90 s       60 s      ⓒ training.duration-total 1.0.0
  Tonelaje externo                         1.800 kg   1.740 kg  ⓒ training.volume-load 2.0.0
A · Sentadilla trasera con barra                                    [completo]
  Serie │ Versión │ Prescrito          │ Realizado          │ Diferencia
    1   │ v1      │ 10 × 60 kg · RIR 2 │ 10 × 60 kg · RIR 2 │ —
    2   │ v1      │ 10 × 60 kg · RIR 2 │ 10 × 60 kg · RIR 1 │ más exigente (RIR 1)
    3   │ v1      │ 10 × 60 kg · RIR 2 │ 9 × 60 kg · RIR 0  │ −1 rep. · más exigente (RIR 0)
  Descanso previsto 2 min · real: no registrado
B · Plancha                                                          [parcial]
  …
Comentario de Lucía: «La última de sentadilla costó mucho»
Total del día 7 nov: 2 sesiones · … (enlace al día)
```

- **Jerarquía:**
  1. Estado y fechas.
  2. Perfil de cumplimiento.
  3. Volumen por magnitud.
  4. Tabla por ejercicio.
  5. Series fuera de la versión vigente.
  6. Comentario.
  7. Enlace al día y a la semana.
- **Selector de prescripción:** «Comparar con: la versión de cada serie (por defecto) · la original · la vigente».
- **Estados:**
  - **Sin empezar:** «Lucía aún no ha empezado esta sesión».
  - **En curso:** aviso de que lo pendiente en el móvil no se ve.
  - **Error de la base:** página de error (P-108).
- **En el móvil:** el perfil se apila; la tabla pasa a tarjetas por serie con «Prescrito» y «Realizado» uno debajo de otro.

### 9.3 A3 · Sesiones por día (ampliación)

Cada día de la ficha muestra en su cabecera el total realizado por magnitud, como ya preveía V1_SPEC §3, y «2 sesiones · 1 completada · 1 parcial». Cada sesión enlaza con A8.

### 9.4 A1 · Panel

1. Sesiones de hoy de todos los clientes, con su estado.
2. **Pendientes de revisar:** sesiones terminadas desde la última vez que se abrió su análisis.
3. Borradores.

Saber qué análisis se ha abierto requiere guardar una marca de lectura (P-111). Sin ella, «pendientes de revisar» se reduce a «terminadas en los últimos 7 días».

### 9.5 A9 · Análisis del cliente (nueva pestaña «Análisis» de la ficha)

- **Filtros:**
  - periodo: esta semana, 4 semanas, 12 semanas o un rango libre como «bloque»;
  - vista: planificado o ejecutado, y prescripción original o vigente;
  - patrón;
  - ejercicio.
- **Secciones:**
  1. Resumen del periodo: sesiones prescritas, empezadas, completadas, parciales y sin hacer; perfil de cumplimiento del periodo.
  2. Volumen semanal: una serie por magnitud.
  3. Patrones.
  4. Ejercicios del periodo: series, magnitudes y esfuerzo frente al objetivo, con enlace a A10.
  5. Incumplimientos repetidos (lista descriptiva; P-104).
  6. Carga interna semanal (solo con B3.3).
- **En el móvil:** un gráfico por pantalla, con su tabla debajo y los filtros en una hoja inferior.

### 9.6 A10 · Evolución de un ejercicio (variante) para un cliente

Por sesión, en orden de ejecución:

- series hechas frente a prescritas;
- kg de cada serie (mejor y rango) y repeticiones;
- RIR o RPE frente al objetivo;
- las versiones;
- las notas.

Solo con datos de la **misma variante** y la **misma modalidad de carga**. Si cambia la modalidad, la serie se corta y se avisa. Sin estimación del 1RM.

### 9.7 «Carga» de todos los clientes y lo que ve la clienta

- **`/entrenador/carga`** pasa a las fórmulas nuevas: fecha de ejecución, base de la carga y versión de cada serie (P-106). Sigue siendo un resumen semanal por cliente, con enlaces a su A9.
- **La clienta no tiene análisis nuevo.** Su «Progreso» usa hoy `training.volume-load` 1.0.0. Al pasar a 2.0.0, lo verá con la misma fórmula que el entrenador. Con los datos actuales, todos con base «total», las cifras no cambian.

## 10. Preparación para la autorregulación (1C)

| Lo que necesitará la 1C              | Qué deja el bloque 3                                                                          | Qué falta                                                 |
| ------------------------------------ | --------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Detectar incumplimientos repetidos   | Clasificación por serie y dimensión, consultable por ejercicio y periodo; listas descriptivas | Reglas que configure el entrenador (P-45)                 |
| Tendencias de esfuerzo               | Serie por ejercicio del RIR/RPE frente al objetivo, en la misma escala                        | Comprobar la familiaridad con el RIR (Helms et al., 2016) |
| Carga planificada frente a ejecutada | Diferencias en kg y en %, por serie y agregadas                                               | —                                                         |
| Evolución del volumen                | Series semanales por magnitud y por patrón                                                    | —                                                         |
| Posibles señales de fatiga           | **Nada automático.** Se ven juntos esfuerzo, cumplimiento y carga interna (B3.3)              | La valoración previa (Q2) y el criterio del entrenador    |
| Decisiones del entrenador            | Vistas que explican cada cifra con su fórmula                                                 | El registro de decisiones (1C)                            |

**Salvaguardas:**

- no hay recomendaciones ni cambios automáticos;
- ningún indicador aislado se presenta como fatiga;
- lo subjetivo se rotula como autodeclarado;
- cada regla futura se apoyará en estas funciones del dominio, no en cálculos nuevos escondidos en la interfaz.

## 11. Modelo de datos

### 11.1 B3.1 y B3.2: sin cambios en la base

Todo se calcula **al leer**, en el dominio, a partir de:

- `session` y `session_version` (prescripción);
- `session_log` y `set_log` efectivos;
- la biblioteca (patrones).

**Por qué sin tablas de resumen:**

- No se duplican datos que podrían desincronizarse.
- Las fórmulas pueden cambiar de versión sin migrar resultados.
- El volumen previsto es pequeño. Un cliente con un año de sesiones tiene unas 200 sesiones y unas 4.000 series, y el cálculo en memoria es inmediato.
- Si una prueba de rendimiento lo desmintiera, se propondría un índice o una tabla en una migración aparte (P-111).

**Lecturas nuevas** (puertos de solo lectura, sin cambiar el esquema):

- ejecuciones de un cliente en un rango, por fecha prevista **o** por inicio. Se pide un margen de ±1 día en UTC y después se filtra por la fecha local (§4.3);
- todas las versiones de esas sesiones, para comparar con lo original y lo vigente.

**Excepción (P-91):** si quieres tolerancias configurables por entrenador desde B3.2, haría falta una tabla `trainer_setting` (entrenador, clave, valor JSON validado y fecha de cambio), en una migración `004`.

### 11.2 Dominio y capas

- **`src/domain/analysis/`** (puro, probado):
  - `reference.ts`: prescripción de referencia (§4.2);
  - `compliance.ts`: dimensiones y estados (§5);
  - `volume.ts`: amplía el actual con las magnitudes del §6;
  - `duration.ts`: duración y representatividad (§4.6);
  - `timeline.ts`: día, semana y periodo con las reglas de fechas;
  - `patterns.ts`: recuento por patrón.
- **`src/contracts/analysis.ts`:** los modelos de vista de A8, A9 y A10.
- **`src/server/services/trainer-analysis.ts`:** casos de uso con las políticas de `src/domain/access.ts` (`canAccessClient`, `canViewSession` y `canReadExecution`, que ya existen) y pruebas de acceso no autorizado.
- **`src/app/entrenador/...`:** las pantallas del §9.

### 11.3 B3.3: tabla nueva, solo de añadir (migración `004`, si se aprueba)

| Columna                                     | Para qué                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------- |
| `id` (PK), `session_log_id`, `client_id`    | Una valoración por ejecución; la corrección es otra fila con `supersedes`       |
| `rpe` (0–10, entero), `scale`               | `scale` = identificador y versión de la escala: `foster_cr10_modified@1` (P-64) |
| `recorded_at`, dispositivo, zona, recepción | Reglas T1–T4                                                                    |
| `minutes_after_finish`                      | Momento de la respuesta (P-48)                                                  |
| `origin`, `recorded_by`                     | `self_reported`, `client`                                                       |
| `supersedes`                                | Corrección                                                                      |

**Por qué una tabla aparte y no columnas en `session_log`:** una ejecución terminada no se modifica (disparador), y la valoración llega después del fin.

**`perceived_effort`** sigue en `session_log` como dato de la semilla, sin uso analítico (P-102).

### 11.4 Fuera del bloque 3 (diseño, §13)

`correction_reason` en `set_log` y la tabla `set_annotation`, para las correcciones justificadas y las anotaciones del entrenador.

## 12. Fórmulas que se registrarán

Todas son `operational_definition` (aritmética acordada; sin referencia obligatoria pero con limitaciones), salvo la carga interna.

| Id                                 | Versión | Qué calcula                                                                                          | Unidad             | Limitaciones principales                                                   |
| ---------------------------------- | ------- | ---------------------------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------- |
| `training.completed-sets`          | 1.0.0   | (Existe) series hechas                                                                               | series             | No distingue intensidad                                                    |
| `training.prescribed-volume`       | 1.0.0   | Series y repeticiones, segundos o metros previstos, por tipo; rangos como [mín., máx.]               | series, rep., s, m | Depende de la prescripción de referencia (§4.2)                            |
| `training.total-reps`              | 2.0.0   | Σ repeticiones de series hechas prescritas por repeticiones; las «por lado», aparte                  | rep.               | No suma tiempos ni distancias                                              |
| `training.duration-total`          | 1.0.0   | Σ segundos de las series hechas por tiempo                                                           | s                  | No es tiempo de sesión                                                     |
| `training.distance-total`          | 1.0.0   | Σ metros de las series hechas por distancia                                                          | m                  | No incluye la carga transportada                                           |
| `training.volume-load`             | 2.0.0   | Σ rep. × kg externos **totales** (total; por implemento × n; por lado excluido; rep. por lado × 2)   | kg                 | No es trabajo mecánico; excluye peso corporal, lastre, asistencia y bandas |
| `training.prescribed-volume-load`  | 1.0.0   | Lo mismo con lo previsto (rangos y kg congelados del %1RM como [mín., máx.])                         | kg                 | Ídem                                                                       |
| `training.added-load-volume`       | 1.0.0   | Σ rep. × kg de lastre                                                                                | kg                 | No se suma al tonelaje                                                     |
| `training.assistance-summary`      | 1.0.0   | Series y rep. asistidas; asistencia media ponderada por repeticiones                                 | series, rep., kg   | Más asistencia es menos carga                                              |
| `training.rep-deviation`           | 1.0.0   | Diferencia de repeticiones (0 dentro del rango; si no, respecto al límite más cercano)               | rep.               | Solo en series hechas por repeticiones                                     |
| `training.load-deviation`          | 1.0.0   | Diferencia de kg y % sobre lo previsto, en la misma modalidad y base; texto en bandas y dispositivos | kg, %              | Sin diferencia en la carga autoseleccionada                                |
| `training.effort-deviation`        | 1.0.0   | RIR registrado − objetivo (negativo = más exigente); RPE en la misma escala                          | rep. / puntos      | Autodeclarado, con error                                                   |
| `training.compliance-profile`      | 1.0.0   | Estados por serie y dimensión (§5.2) con tolerancias (§5.3) y sus recuentos                          | series             | Definición de diseño, no validada; sin índice global                       |
| `training.exercise-status`         | 1.0.0   | Completo, parcial, no realizado o sin registrar                                                      | —                  | Sin motivo                                                                 |
| `training.session-adherence`       | 1.0.0   | Sesiones prescritas, empezadas, completadas, parciales y sin hacer por fecha prevista                | sesiones           | —                                                                          |
| `training.schedule-offset`         | 1.0.0   | Días entre la fecha prevista y la de ejecución                                                       | días               | —                                                                          |
| `training.session-elapsed`         | 1.0.0   | Fin − inicio                                                                                         | min                | Incluye cortes sin pausa                                                   |
| `training.session-active-duration` | 1.0.0   | Fin − inicio − pausas, con la comprobación de representatividad (G)                                  | min                | G es un parámetro de diseño (P-95)                                         |
| `training.pattern-set-count`       | 1.0.0   | Series por patrón: solo principal, y principal con secundarios                                       | series             | La clasificación es del catálogo; sin pesos para los secundarios           |
| `training.session-internal-load`   | 1.0.0   | **`scientific_formula`** · RPE de la sesión × duración activa (B3.3)                                 | UA                 | §7.2. **Solo tras cotejar el original de Foster et al. (2001)** (P-112)    |

`training.volume-load` 1.0.0 y `training.total-reps` 1.0.0 se conservan en el registro: un resultado antiguo siempre conserva la versión con la que se calculó.

## 13. Correcciones justificadas y anotaciones del entrenador (diseño, P-109)

**Correcciones de la clienta:**

- La fila que corrige añadiría un **motivo opcional**:
  - «me equivoqué al anotar»;
  - «se me olvidó registrarla»;
  - «otro», con texto de hasta 200 caracteres.
- Se guardaría en `set_log.correction_reason` de la fila nueva. Las anteriores no cambian.
- A8 lo muestra en el historial de la serie.

**Anotaciones del entrenador:** tabla nueva `set_annotation`, solo de añadir:

| Columna                               | Para qué                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------- |
| `id`, `set_log_id`, `trainer_id`      | Qué serie (la fila exacta) y quién anota                                  |
| `kind`                                | `comment` o `exclude_from_analysis`                                       |
| `text` (obligatorio en una exclusión) | Por qué                                                                   |
| `created_at`, `supersedes`            | Cuándo; una anotación nueva sustituye a otra, con el historial conservado |

- **Lo registrado no se modifica nunca.** Una exclusión del análisis es explícita, reversible y visible («serie excluida por Alex: técnica no válida»), y los totales dicen «1 serie excluida».
- Si el entrenador registra en nombre de la clienta (por ejemplo, en una sesión presencial), sería otra fila con `recorded_by = trainer` y motivo obligatorio. La procedencia diría si lo observó (`direct`) o se lo contaron (`self_reported`).

**Recomendación:** implementarlo **después** del bloque 3. El análisis no lo necesita para empezar, y respetará las exclusiones cuando existan.

## 14. Criterios de aceptación

Verificables con pruebas. Los números salen de los ejemplos de este documento y de V1_SPEC §10.

| Id       | Criterio                                                                                                                                                                                 |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-B3-01 | **E2E-1 completo:** A8 muestra «Completada», «en su día», **30 → 29 repeticiones**, **1.800 → 1.740 kg** y «−1 rep.» en la serie 3                                                       |
| AC-B3-02 | **Ejemplo del §5.6:** exactamente las fracciones de su tabla, y en ningún sitio un porcentaje global de cumplimiento                                                                     |
| AC-B3-03 | **E2E-12 (dos sesiones el mismo día):** mañana **15 rep. y 1.200 kg**; tarde **16 rep. y 640 kg**; día **31 rep. y 1.840 kg**                                                            |
| AC-B3-04 | **Tipos de serie:** una plancha (s), un paseo del granjero (m), dominadas con peso corporal, con lastre y asistidas, y bandas: cada magnitud en su fila, ninguna en el tonelaje          |
| AC-B3-05 | **Por implemento:** «2 × 20 kg», 3 × 10 → 1.200 kg. **Por lado:** «tonelaje sin calcular: carga por lado»                                                                                |
| AC-B3-06 | **Cambio de versión a media sesión:** las series v1 se comparan con la v1 y las v2 con la v2; la vista «original» muestra la v1 completa                                                 |
| AC-B3-07 | **Sesión trasladada:** prevista el lunes 9 de una semana y hecha el lunes 16 de la siguiente: en la semana del 9 aparece «hecha el 16 (otra semana)» y suma en la del 16                 |
| AC-B3-08 | **Medianoche:** sesión empezada a las 23:50 con series a las 23:58 y 00:03: todo en el día de inicio                                                                                     |
| AC-B3-09 | **Duración no representativa:** inicio a las 21:00, serie a las 21:10 y fin a las 06:15 sin pausas → aviso y fuera de las medias                                                         |
| AC-B3-10 | **Sin dato frente a incumplimiento:** con RIR pedido y no registrado, «sin dato» y nunca «más» ni «menos exigente»                                                                       |
| AC-B3-11 | **Escalas:** RPE en `omni_res` frente a un objetivo en `rir_based` → «no comparable», sin diferencia numérica                                                                            |
| AC-B3-12 | **Reenvíos y correcciones:** reenviar un comando o corregir una serie no cambia los totales más que en el valor corregido                                                                |
| AC-B3-13 | **Fórmula visible:** cada cifra calculada tiene la insignia con su id y versión, y la ficha de la fórmula muestra sus limitaciones                                                       |
| AC-B3-14 | **Permisos:** otro entrenador, la clienta o una petición sin identidad reciben `404` o redirección al pedir A8, A9 o A10 de un cliente ajeno; los datos no aparecen en ninguna respuesta |
| AC-B3-15 | **Accesibilidad y adaptación:** axe sin infracciones en A8, A9 y A10; nada desborda a 360 px; cada gráfico tiene su tabla                                                                |
| AC-B3-16 | **Semanas vacías:** visibles con cero, nunca omitidas                                                                                                                                    |
| AC-B3-17 | **Lo que no hay:** ningún «RPE de sesión» ni «carga interna» sin B3.3; `perceived_effort` de la semilla no aparece en el análisis                                                        |
| AC-B3-18 | **Rendimiento:** A9 con 52 semanas de datos generados (unas 200 sesiones) responde en el servidor en menos de 300 ms en el entorno de pruebas (objetivo de diseño, a confirmar al medir) |
| AC-B3-19 | (B3.3) **87 min × RPE 4 = 348 UA** (ejemplo de Haddad et al., 2017); sin RPE, sesión sin terminar o duración no representativa → «sin calcular», con el motivo                           |

## 15. Plan de pruebas

| Tipo                        | Qué                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unitarias del dominio**   | Cada fórmula con casos en tabla: rangos, bases de carga, por lado, modalidades, escalas, «sin dato», tolerancias, prescripción de referencia, fechas (zona, medianoche, traslado, semana ISO) y representatividad de la duración                                                                                                                                |
| **Invariantes**             | <ul><li>La suma de las sesiones de un día es el total del día.</li><li>La suma de los días de una semana, el total de la semana.</li><li>Cambiar el orden de los registros no cambia nada.</li><li>Reenviar no cambia nada.</li><li>Ninguna dimensión se mezcla con otra.</li></ul>Comprobado sobre conjuntos generados de forma determinista, sin dependencias |
| **Registro de fórmulas**    | `registryIssues` sin incidencias; cada id usado en el código está registrado                                                                                                                                                                                                                                                                                    |
| **Integración (servicios)** | Con SQLite real: A8, A9 y A10 desde la semilla y desde ejecuciones creadas por comandos; permisos con el intento no autorizado                                                                                                                                                                                                                                  |
| **E2E**                     | AC-B3-01 a AC-B3-17 en escritorio y Pixel 7, con el reloj del navegador fijado y espacios de datos propios                                                                                                                                                                                                                                                      |
| **Regresión**               | Toda la batería actual en verde, incluida la equivalencia de compatibilidad. La página «Carga» y el «Progreso» de la clienta mantienen sus cifras con los datos actuales (todos con base «total»)                                                                                                                                                               |
| **Rendimiento**             | AC-B3-18 con un conjunto generado de 52 semanas                                                                                                                                                                                                                                                                                                                 |
| **Determinismo**            | Fechas relativas a la semilla (ADR-32) y reloj fijado; cada prueba repetida tres veces antes de cerrar el bloque                                                                                                                                                                                                                                                |

## 16. Decisiones pendientes

| Id    | Cuestión                                | Opciones                                                                                                             | Recomendación                                                                         | Justificación                                                                          | Consecuencias técnicas                                            | Consecuencias funcionales                                              | ¿Cambia el modelo?        | ¿Bloquea B3?              |
| ----- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------- | ------------------------- |
| P-90  | Definición de cumplimiento              | a) Multidimensional sin índice · b) % de series hechas · c) índice ponderado                                         | **a**                                                                                 | Evita el número engañoso y respeta las unidades                                        | Funciones por dimensión                                           | El entrenador lee varias fracciones, no una nota                       | No                        | **Sí**                    |
| P-91  | Tolerancias                             | a) 0 con la diferencia visible · b) márgenes por defecto · c) configurables ya en B3.1                               | **a** en B3.1; configurables en B3.2 si las quieres                                   | Cualquier margen por defecto sería inventado                                           | c) necesita `trainer_setting` (migración `004`)                   | Con a), una diferencia de 0,5 kg aparece como «menos»                  | Solo con c)               | **Sí** (el valor inicial) |
| P-92  | Prescripción de referencia              | a) La versión de cada serie, con vistas «original» y «vigente» · b) solo vigente · c) solo original                  | **a**                                                                                 | Es la regla de A7 y no esconde cambios                                                 | Leer todas las versiones                                          | Comparación justa tras un cambio                                       | No                        | **Sí**                    |
| P-93  | Fecha para día y semana                 | a) Ejecutado por fecha de ejecución y planificado por prevista · b) todo por prevista · c) todo por ejecución        | **a**                                                                                 | Cada vista responde a su pregunta                                                      | Dos agrupaciones                                                  | Una sesión trasladada aparece en las dos semanas, con su papel         | No                        | **Sí**                    |
| P-94  | Semana                                  | a) ISO lunes–domingo, zona del inicio · b) configurable por entrenador                                               | **a**                                                                                 | Estándar y ya usada en `weeklyVolume`                                                  | —                                                                 | —                                                                      | No (b: sí)                | **Sí** (por defecto)      |
| P-95  | Duración y representatividad            | a) Bruta y activa, con aviso si hay huecos de más de G = 30 min · b) solo bruta · c) G configurable                  | **a**                                                                                 | Sin aviso, una noche entera parece entrenamiento                                       | Comprobación por huecos                                           | Algunas sesiones salen «no representativas»                            | No                        | **Sí**                    |
| P-96  | Repeticiones por lado                   | a) Rep. como registradas con «por lado», tonelaje × 2 · b) duplicar las repeticiones                                 | **a**                                                                                 | Coherente con `EFFORT_AND_LOAD.md` §3; no cambia lo registrado                         | —                                                                 | Hoy sin efecto (el constructor no lo ofrece)                           | No                        | No                        |
| P-97  | Carga «por lado» en el tonelaje         | a) Excluir y avisar · b) pedir el peso de la barra                                                                   | **a**                                                                                 | Sin el peso del soporte, el total es desconocido                                       | —                                                                 | Algunas series sin tonelaje                                            | No (b: sí)                | No                        |
| P-98  | Volumen por patrón                      | a) En B3.2, con dos recuentos · b) aplazarlo                                                                         | **a**                                                                                 | Con los datos actuales y sin pesos inventados                                          | Lee la biblioteca                                                 | Equilibrio entre patrones de la semana                                 | No                        | No                        |
| P-99  | Volumen por cualidad                    | a) Aplazarlo hasta tener la intención en la prescripción (bloque 4) · b) por etiquetas de la variante                | **a**                                                                                 | Las etiquetas no son la intención: b) contaría una serie en varias cualidades          | —                                                                 | No hay vista por cualidad en el bloque 3                               | a) en el bloque 4: sí     | No                        |
| P-100 | Volumen por grupo muscular              | a) No en el bloque 3 (P-53, E3) · b) por región corporal                                                             | **a**                                                                                 | No hay taxonomía de músculos; la región es demasiado general                           | —                                                                 | —                                                                      | No                        | No                        |
| P-101 | RPE de la sesión y carga interna (Q2)   | a) B3.3 tras B3.1 y B3.2 · b) aplazarlo a la 1C · c) solo recoger el RPE, sin carga interna                          | **a** si apruebas Q2 y P-112; si no, **c**                                            | Sin datos no habrá tendencias cuando llegue la 1C                                      | Tabla nueva, comando nuevo y pantalla de la clienta               | Una pregunta más al terminar                                           | **Sí** (`004`)            | No (solo B3.3)            |
| P-102 | `perceived_effort` de la semilla        | a) Rotularlo «dato de demostración sin escala» y excluirlo del análisis · b) quitarlo de la semilla · c) usarlo      | **a**                                                                                 | Inventado y sin escala; usarlo violaría el rigor                                       | —                                                                 | La pestaña «Registro» lo rotula                                        | No (b: cambia la semilla) | No                        |
| P-103 | Índice global                           | a) No · b) opcional con pesos del entrenador                                                                         | **a**                                                                                 | Cualquier peso sería arbitrario                                                        | —                                                                 | —                                                                      | No (b: sí)                | No                        |
| P-104 | Incumplimientos repetidos               | a) Listas descriptivas filtrables (N de M sesiones), sin alertas · b) alertas · c) nada                              | **a**                                                                                 | Útil para decidir sin automatizar                                                      | Consultas sobre el perfil                                         | Una sección en A9                                                      | No                        | No                        |
| P-105 | Descanso real                           | a) Solo el previsto, con «no registrado» · b) mostrar el intervalo entre registros                                   | **a**; registrar el descanso en un bloque posterior si interesa                       | El intervalo entre registros incluye la serie y el tiempo hasta anotar: no es descanso | —                                                                 | —                                                                      | No                        | No                        |
| P-106 | Página «Carga» de la Fase 1             | a) Rehacerla con las fórmulas nuevas · b) mantenerla                                                                 | **a**                                                                                 | Corrige la fecha, la base y la versión (§2.6)                                          | Reutiliza el dominio nuevo                                        | Cifras coherentes en todas las vistas                                  | No                        | No                        |
| P-107 | Copias programadas y rotación           | §17.2                                                                                                                | **Copia automática al arrancar si la última tiene más de 24 h** y retención del §17.2 | Protege sin programador ni servicio externo                                            | Código en `store.ts` y limpieza segura                            | Copias diarias si se usa a diario                                      | No                        | No                        |
| P-108 | Página de error de la base              | a) Antes del bloque 3 (B3.0) · b) después                                                                            | **a**                                                                                 | B3 añade pantallas de lectura; resuelve también el residual de A-11                    | `error.tsx` y errores tipados en las acciones                     | Un mensaje útil en lugar de «Algo no ha ido bien»                      | No                        | No (recomendado antes)    |
| P-109 | Correcciones justificadas y anotaciones | §13: a) después del bloque 3 · b) dentro del bloque 3                                                                | **a**                                                                                 | El análisis no lo necesita para empezar                                                | Migración y tabla nuevas                                          | Trazabilidad del porqué                                                | **Sí**                    | No                        |
| P-110 | Plataformas (Windows, Safari, iOS)      | §17.4                                                                                                                | Plan del §17.4                                                                        | Sin infraestructura ni servicios nuevos                                                | WebKit de Playwright: descarga de un navegador (pedir aprobación) | Limitaciones explícitas hasta verificarlas                             | No                        | No                        |
| P-111 | Rendimiento y «pendientes de revisar»   | a) Cálculo al leer y «terminadas en 7 días» · b) tablas de resumen y marca de lectura                                | **a**; medir antes de cambiar                                                         | Menos estado que mantener                                                              | b) migración                                                      | a) no sabe qué has abierto ya                                          | No (b: sí)                | No                        |
| P-112 | Verificación de la carga interna        | a) Cotejar el original de Foster et al. (2001) antes de registrarla · b) aceptar la revisión de Haddad et al. (2017) | **a** (regla de `SCIENTIFIC_RIGOR.md`)                                                | Una fuente secundaria no basta para una fórmula científica                             | —                                                                 | B3.3 espera al original                                                | No                        | No (solo B3.3)            |
| P-113 | Hora imposible del móvil (T1, ADR-28)   | a) Mantener el rechazo (`422`) · b) aceptar con la hora de recepción y el motivo                                     | **a**, con un mensaje que explique que hay que corregir el reloj y volver a registrar | Lo pediste así, y aceptar una hora imposible esconde un reloj roto                     | —                                                                 | Una serie registrada sin conexión con el reloj roto se vuelve a anotar | No                        | No                        |

## 17. Revisión de decisiones anteriores y temas transversales

### 17.1 ADR-25 a ADR-32: consecuencias y recomendación

| ADR    | Decisión                                                | Ventajas                                                                                                | Limitaciones y consecuencias                                                                                                                                                                                                                                                                                                                                                         | Recomendación                                       |
| ------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| ADR-25 | Bloqueo del sistema operativo y restauración con diario | Exclusividad real; sin bloqueos obsoletos; restauración recuperable, probada con `SIGKILL` en cada fase | No protege en discos de red. En Linux y macOS, borrar `.lock` a mano inutiliza el primer servidor (nunca escriben dos). Windows sin probar                                                                                                                                                                                                                                           | **Mantener**                                        |
| ADR-26 | Guardado automático a los **2 s** y copia local         | Ventana de pérdida corta; una escritura por pausa; la copia cubre el intervalo                          | Cada guardado sube la revisión del borrador: con dos dispositivos, el segundo ve conflicto antes (es lo deseado). Dos pestañas del mismo navegador comparten la copia local. Con PostgreSQL remoto, 2 s sigue siendo razonable                                                                                                                                                       | **Mantener**                                        |
| ADR-27 | Identidad en cada comando                               | Ninguna serie de una persona se aplica a otra; probado con el escenario de la auditoría                 | Lo de otra persona espera en ese dispositivo hasta que vuelva                                                                                                                                                                                                                                                                                                                        | **Mantener**                                        |
| ADR-28 | **Tolerancia de 5 min** y **rango 2020–2100**           | Absorbe la deriva normal de los relojes; detecta relojes perdidos (1970, 2000)                          | <ul><li>Un reloj mal puesto dentro del rango (p. ej. 2025) no se rechaza: lo corrige T3 con la hora de recepción.</li><li>Una serie anotada sin conexión con un reloj fuera del rango queda en error no recuperable: hay que corregir el reloj y volver a registrarla (P-113).</li><li>Los 5 min son una decisión de diseño.</li></ul>                                               | **Mantener**; revisar los 5 min con datos reales    |
| ADR-29 | **Espera de 1 s** y errores clasificados                | El servidor no se congela más de 1 s; uso normal sin esperas (probado con 8 escritores); nada a medias  | <ul><li>Con una herramienta ajena escribiendo, las escrituras fallan pronto (`503`); el móvil y el constructor reintentan.</li><li>**Las demás acciones del entrenador** acaban en la página de error genérica (§2.6, P-108).</li><li>El punto de control antes de migrar o restablecer puede fallar si una copia larga está leyendo: se detiene con un mensaje, sin daño.</li></ul> | **Mantener**; completar los errores tipados en B3.0 |
| ADR-30 | `local-demo` solo en loopback, comprobado en el socket  | Imposible exponerlo por error                                                                           | <ul><li>Usa `process._getActiveHandles` (no documentado): si desaparece, no arranca (falla de forma segura; lo detectaría `startup.test.ts`).</li><li>**Impide probar en un móvil real por la red local** (§17.4).</li></ul>                                                                                                                                                         | **Mantener**                                        |
| ADR-31 | Procedencia guardada                                    | Base para importaciones y cálculos futuros                                                              | Ninguna relevante                                                                                                                                                                                                                                                                                                                                                                    | **Mantener**                                        |
| ADR-32 | Semilla relativa a su fecha                             | Pruebas iguales cualquier día                                                                           | Una base sembrada con otra versión de la semilla conserva su estructura hasta «Restablecer»                                                                                                                                                                                                                                                                                          | **Mantener**                                        |

### 17.2 Copias de seguridad en el modo local (P-107)

| Aspecto          | Hoy                                                       | Propuesta (pendiente de aprobación; no se implementa)                                                                                                                                                                                                                                           |
| ---------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Manuales**     | `pnpm db:backup` y «Hacer una copia ahora»                | Sin cambios                                                                                                                                                                                                                                                                                     |
| **Automáticas**  | Antes de migrar, de restablecer y de restaurar            | Además, **al arrancar el servidor si la última copia automática tiene más de 24 h**. Sin temporizadores en segundo plano: la aplicación local no está siempre encendida, y una copia al arrancar cubre el uso real                                                                              |
| **Frecuencia**   | —                                                         | Como mucho una diaria automática; las manuales, cuando se quiera                                                                                                                                                                                                                                |
| **Retención**    | Indefinida (crecen sin límite)                            | <ul><li>Automáticas diarias: las **14** últimas.</li><li>Previas a una operación (migrar, restablecer, restaurar): las **10** últimas de cada tipo.</li><li>**Manuales: nunca se borran solas.**</li></ul>La limpieza solo borra copias verificadas más antiguas, y nunca la única copia válida |
| **Tamaño**       | Una base sembrada ocupa unos 0,5 MB                       | 14 + 30 copias ≈ 25 MB                                                                                                                                                                                                                                                                          |
| **Recuperación** | `pnpm db:restore` (segura y recuperable) y `db:recover`   | `db:status` mostraría la última copia automática y avisaría si tiene más de 7 días                                                                                                                                                                                                              |
| **Ubicación**    | `<carpeta de datos>/backups/`, con permisos `700` y `600` | Igual. **Están en el mismo disco**: no protegen de su avería. Se documentaría cómo copiar a mano la carpeta a un disco externo. Sin nube (no hay servicios externos)                                                                                                                            |
| **Privacidad**   | Solo datos ficticios                                      | Sin cifrado (necesitaría una dependencia o infraestructura). Por eso siguen sin admitirse datos reales                                                                                                                                                                                          |

### 17.3 Página de error de la base (A-15, P-108)

**Recomendación: antes del bloque 3, como B3.0.**

- **Contenido:** un `error.tsx` en las áreas del entrenador y de la clienta que distinga:
  - **base ocupada:** «Inténtalo en unos segundos»;
  - **no disponible:** «La carpeta de datos ha cambiado: reinicia el servidor»;
  - **dañada o con migraciones incompatibles:** «Restaura una copia: `pnpm db:status` y `pnpm db:restore`».
- **Junto con ella:** los errores tipados en las acciones del entrenador que aún no los tienen (§2.6).
- **Por qué antes:** el bloque 3 añade pantallas de lectura que hoy caerían en «Algo no ha ido bien», y es poco esfuerzo.

### 17.4 Windows, Safari e iOS (P-110)

| Plataforma              | Plan realista                                                                                                                                                                                                                                                                                                                                         | Mientras tanto se asume                                                                                                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Windows**             | Lo ejecutas tú en tu equipo:<ul><li>`pnpm verify:env`, `pnpm test` y `pnpm test:e2e`;</li><li>dos servidores a la vez;</li><li>`db:restore` y `db:recover` interrumpidos (lista de comprobación que prepararía).</li></ul>Alternativa: una máquina Windows en CI, que es infraestructura y necesita tu aprobación                                     | Bloqueo con `LockFileEx`, `rename` sobre un archivo existente y sin `fsync` del directorio: **documentado, no probado**                                                                                     |
| **Safari (escritorio)** | Proyecto WebKit de Playwright en la batería E2E. Requiere descargar ese navegador (`playwright install webkit`), que no es una dependencia npm pero sí una descarga: necesita tu aprobación                                                                                                                                                           | Sin verificar                                                                                                                                                                                               |
| **iOS**                 | <ul><li>**Simulador de iOS en un Mac** (Xcode): Safari del simulador llega al `127.0.0.1` del Mac, así que funciona con `local-demo`.</li><li>**iPhone real:** necesita salir de loopback, lo que ADR-30 impide a propósito. Llegaría con autenticación real (Fase 2) o con un modo de prueba en red local que habría que diseñar y aprobar</li></ul> | <ul><li>Safari puede borrar IndexedDB y `localStorage` tras días sin uso (lo pendiente y la copia del borrador).</li><li>No hay sincronización en segundo plano.</li><li>Instalar la PWA difiere.</li></ul> |
| **Android real**        | Igual que el iPhone real: depende de salir de loopback                                                                                                                                                                                                                                                                                                | Probado solo con Chromium en modo Pixel 7                                                                                                                                                                   |

## 18. Dependencias con bloques posteriores

| Bloque o fase                 | Qué necesita del bloque 3                                                | Qué aporta al bloque 3                                                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **4 · Prescripción completa** | Fórmulas por base de carga, modalidad y tipo (§6.1), ya preparadas       | <ul><li>Tabla por serie, lastre, asistida, %1RM y tiempo y distancia en el constructor.</li><li>Intención estructurada (volumen por cualidad, P-99).</li></ul> |
| **5 · Editar lo publicado**   | La comparación por versión (§4.2) y la vista «original frente a vigente» | Más versiones reales que analizar                                                                                                                              |
| **6 · Cierre de V1**          | Pantallas A8–A10 accesibles; informe de V1                               | —                                                                                                                                                              |
| **V3 (evaluaciones)**         | —                                                                        | 1RM y peso corporal en la base: intensidad relativa y carga respecto al peso corporal                                                                          |
| **V4 (semana, plantillas)**   | Vista semanal                                                            | Entidad «bloque» o plan, que sustituiría al rango de fechas                                                                                                    |
| **1C (autorregulación)**      | Perfil de cumplimiento, tendencias de esfuerzo y carga interna (§10)     | Reglas supervisadas y registro de decisiones                                                                                                                   |
| **Fase 2 (PostgreSQL)**       | Funciones del dominio puras y portables                                  | Rendimiento con varios usuarios; tablas de resumen si hiciera falta                                                                                            |
