# Prescripción de carga y carácter del esfuerzo

> **Estado: diseño pendiente de aprobación.** Nada de este documento está implementado todavía. Describe cómo se ampliará el modelo actual (`src/domain/training/prescription.ts`, `session.ts` y `volume.ts`) sin perder lo que ya funciona. Requisito prioritario (R2), con su integración en volumen y tonelaje (R6).
>
> Referencias verificadas el **6 de noviembre de 2026** en PubMed (metadatos y resumen; el texto completo solo en Helms et al., 2016). Las que no se pudieron verificar en su fuente primaria se marcan como **pendientes** y no se usarán para ningún cálculo hasta verificarlas.

## 1. Principios

1. **Tres capas de datos que nunca se mezclan ni se sobrescriben:**

   | Capa                     | Quién la produce                     | Procedencia                    | Ejemplo                                    |
   | ------------------------ | ------------------------------------ | ------------------------------ | ------------------------------------------ |
   | **Prescrito**            | El entrenador                        | Decisión profesional (no mide) | 4 × 6, 80 kg, RIR 2                        |
   | **Realizado**            | El cliente (o el entrenador)         | `self_reported` o `direct`     | Serie 3: 6 repeticiones con 77,5 kg, RIR 1 |
   | **Calculado o estimado** | TrainPro, con una fórmula versionada | `calculated` o `estimated`     | 75 % de un 1RM de 107 kg → 80 kg           |

   Si el cliente usa otra carga, se guarda lo que hizo y **la prescripción no cambia**. Si el entrenador cambia el plan, la versión anterior se conserva (ver `TRAINING_EXPERIENCE.md`, §4).

2. **No hay un sistema único obligatorio.** El entrenador elige la modalidad de carga y el sistema de esfuerzo de cada ejercicio, según el ejercicio, el objetivo, la persona, su experiencia, la población, la fase (entrenamiento o readaptación) y los datos de evaluación disponibles.
3. **Sin valores por defecto ocultos.** TrainPro no asigna RIR ni RPE por su cuenta. Al crear un ejercicio en la planificación, el campo de esfuerzo empieza **vacío** y el entrenador elige, incluido «Sin escala de esfuerzo». Las plantillas sí copian lo que el entrenador guardó en ellas, porque es su decisión.
4. **Sin automatismos por defecto.** No se ajustan cargas, series ni esfuerzos de forma automática (§9).
5. **Lenguaje claro para el cliente.** El cliente ve qué carga usar y qué esfuerzo se espera, sin terminología científica (§6).

## 2. Situación actual y lo que falta

| Aspecto                   | Hoy (Fase 1)                                                           | Propuesta                                                                                                        |
| ------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Modalidades de carga      | `kg`, `bodyweight`, `percent_1rm`, `autoregulated`, `text`             | Diez modalidades (§3), con base de la carga (total, por lado o por implemento)                                   |
| Rango de carga            | No existe                                                              | `external_range` (70–75 kg)                                                                                      |
| Lastre y asistencia       | Solo como texto                                                        | `bodyweight_plus` (+10 kg) y `assisted` (asistencia de 20 kg)                                                    |
| Bandas y dispositivos     | Solo como texto                                                        | `elastic` y `device`, con descriptor (banda roja, nivel 7, polea placa 5)                                        |
| Esfuerzo                  | Un único objetivo para todas las series (RIR, RPE, carácter o ninguno) | Por ejercicio **o por serie**, valores o rangos, RIR y RPE juntos solo con justificación, escala RPE explícita   |
| Criterios de finalización | No existen                                                             | Pérdida de velocidad, de calidad, de técnica, dolor (readaptación), tope de tiempo o repeticiones (§5)           |
| Variación por serie       | No (todas las series iguales)                                          | Valores por defecto del ejercicio + excepciones por serie                                                        |
| Tempo                     | Cuatro fases obligatorias (`3-1-X-0`)                                  | Admitir también tres fases (`2-0-1`), como en el ejemplo del requisito (decisión P-22)                           |
| Registro por serie        | Repeticiones, kg y completada                                          | Carga realizada según su modalidad, repeticiones, tiempo o distancia, RIR o RPE reales, observaciones            |
| RIR/RPE reales            | Uno por ejercicio (`ExerciseFeedback`)                                 | Por serie (opcional) y por ejercicio, siempre `self_reported`                                                    |
| %1RM                      | Se muestra el porcentaje, sin calcular kg                              | Kg calculados con referencia de 1RM explícita (directa o estimada, con fecha) y redondeo, congelados al publicar |
| Estimación de 1RM         | No existe (prevista)                                                   | Diseño en §8; **no se implementa hasta verificar la fuente primaria de la ecuación**                             |

Lo que ya funciona y se conserva: estado de la sesión deducido de lo realizado, series sin duplicados (`effectiveSetRecords`), tonelaje solo con carga externa en kg, procedencia en cada dato y fórmulas versionadas.

## 3. Carga prescrita: modalidades

| Modalidad         | Campos                                                                                   | Ejemplo del requisito                 | Lo que ve el cliente                       | ¿Tonelaje externo?                                            |
| ----------------- | ---------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------ | ------------------------------------------------------------- |
| `external`        | kg, base (`total`, `per_side`, `per_implement`), número de implementos                   | Sentadilla: 80 kg                     | **80 kg**                                  | Sí                                                            |
| `external_range`  | kg mínimo y máximo, base                                                                 | Peso muerto: 70–75 kg                 | **Entre 70 y 75 kg**                       | Prescrito como rango (mín.–máx.); ejecutado con lo realizado  |
| `percent_1rm`     | Porcentaje (o rango), referencia de 1RM, regla de redondeo (p. ej., múltiplos de 2,5 kg) | Sentadilla: 75 % del 1RM              | **80 kg** (y el porcentaje si se comparte) | Sí, con los kg calculados                                     |
| `bodyweight`      | —                                                                                        | Saltos: peso corporal                 | **Tu peso corporal, sin carga**            | **No** (§10.3)                                                |
| `bodyweight_plus` | kg añadidos (lastre, chaleco, cinturón)                                                  | Dominadas: peso corporal + 10 kg      | **Peso corporal + 10 kg**                  | Solo la parte externa, como «carga externa añadida», separada |
| `assisted`        | kg de asistencia (si se conocen), medio (máquina, banda, compañero, otro), descriptor    | Dominadas asistidas: asistencia 20 kg | **Asistencia de 20 kg** (ayuda, no peso)   | **No**: la asistencia resta, no suma                          |
| `elastic`         | Descriptor de la banda (color, nivel, fabricante) y configuración (doble, anclaje)       | Remo con banda roja                   | **Banda roja, doble**                      | **No**: la tensión de una banda cambia con su estiramiento    |
| `device`          | Ajuste del dispositivo y su unidad (nivel, placa, inercia en kg·m²)                      | Polea: placa 7                        | **Placa 7**                                | Solo si el entrenador indica una equivalencia en kg calibrada |
| `self_selected`   | Orientación («la carga que te permita cumplir el RIR»)                                   | Sustituye a `autoregulated`           | **Elige la carga** + el esfuerzo objetivo  | Con lo realizado                                              |
| `none`            | —                                                                                        | Movilidad, sprints sin arrastre       | **Sin carga**                              | No                                                            |
| `other`           | Texto justificado                                                                        | «Trineo con 2 discos de 20»           | El texto                                   | No, salvo que se exprese en kg                                |

Reglas:

- **Base de la carga.** «2 × 20 kg» en press con mancuernas es `per_implement` con 2 implementos (40 kg por repetición). En un remo unilateral con 30 kg, 10 repeticiones **por lado**, el tonelaje es 30 × 10 × 2. Hoy el modelo no distingue ni la base de la carga ni las repeticiones por lado: es un hueco real que este diseño cierra (`perSide` en el objetivo de repeticiones).
- **Carga ligera o técnica.** «3 × 5, carga ligera, prioridad en la calidad» se expresa como `self_selected` u `other`, con el criterio de calidad del §5 y sin escala de esfuerzo.
- **%1RM.** El entrenador elige qué 1RM usar: una medición **directa** o una **estimación**, siempre con su fecha y su procedencia. Los kg se calculan con la fórmula `training.percent-1rm-load` (definición operativa: porcentaje × referencia, redondeado al múltiplo indicado) y **se congelan al publicar la sesión**. Si la referencia cambia después, las sesiones ya publicadas no se modifican en silencio: el entrenador ve el aviso y decide si recalcula. Sin referencia, el ejercicio no se puede publicar con %1RM y se ofrece cambiar a kg o a carga autoseleccionada.
- **Lo que ve el cliente del %1RM** depende de lo que el entrenador comparte (`SharingSettings`): siempre los kg; el porcentaje y la referencia, solo si comparte las evaluaciones.

## 4. Carácter del esfuerzo

### 4.1 Sistemas disponibles

| Sistema                   | Valores                                                          | Cuándo                                                                             |
| ------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **RIR**                   | Entero 0–10, o rango (1–3)                                       | Series con repeticiones hasta cerca del fallo (§4.2)                               |
| **RPE**                   | 1–10 en pasos de 0,5, o rango, **con la escala indicada** (§4.3) | Según la escala: series de fuerza (escala basada en RIR) u otras tareas (OMNI-RES) |
| **RIR + RPE**             | Ambos, con **justificación obligatoria**                         | Solo si miden cosas distintas (§4.4)                                               |
| **Carácter del esfuerzo** | Repeticiones realizadas (realizables), p. ej., `6 (12)`          | Ya existe; se conserva                                                             |
| **Criterio de calidad**   | Texto del entrenador y criterios de finalización (§5)            | Técnica, potencia, saltos, sprints, control motor                                  |
| **Sin escala**            | —                                                                | Cuando la naturaleza del ejercicio no la necesita                                  |

El esfuerzo se puede prescribir:

- igual para todas las series (`RIR 2`),
- **distinto por serie** (series 1–2 a RIR 3, serie 3 a RIR 2, serie 4 a RIR 1),
- como **rango** (`RIR 1–3` o `RPE 7–8`),
- con un **criterio de finalización** (§5), solo o junto a la escala.

### 4.2 Cuándo usar RIR

El RIR (repeticiones en reserva) estima cuántas repeticiones más se podrían hacer antes del fallo. Lo que dice la evidencia revisada:

- **La precisión mejora cerca del fallo y con series cortas.** En sentadilla al 70 % del 1RM, llevada al fallo (16 ± 4 repeticiones), el error al anunciar el RIR fue de 2,05 repeticiones a «1 RIR», 3,65 a «3 RIR» y 5,15 a «5 RIR». Más repeticiones por serie predijeron más error, y la experiencia no lo predijo (Zourdos et al., 2021).
- **Metaanálisis:** las personas **subestiman** las repeticiones que les quedan en unas 0,95 de media (IC 95 % 0,17–1,73), con heterogeneidad muy alta (I² = 97,9 %). La precisión mejora cerca del fallo, con series de 12 repeticiones o menos y en series posteriores, y no dependió del nivel de entrenamiento (Halperin et al., 2022).
- **En personas entrenadas y en press de banca al 75 %**, el error absoluto medio fue de 0,65 repeticiones al predecir 1 y 3 RIR (Refalo et al., 2024). La precisión fue mayor en press de banca que en sentadilla, y mejoró a lo largo de 8 semanas (Hermann et al., 2025).
- **Con poca experiencia**, Helms et al. (2016) recomiendan registrar el RIR para practicar, pero **no basar en él la intensidad** hasta comprobar la precisión, por ejemplo, anunciando el RIR en una serie y llevando después otra serie con la misma carga al fallo. En powerlifters, la precisión en sentadilla de potencia necesitó hasta 3 semanas (Helms et al., 2017b).

**Apropiado** en ejercicios con carga externa y repeticiones contadas, sobre todo multiarticulares y accesorios, cuando se quiere controlar la cercanía al fallo (fuerza, hipertrofia, resistencia muscular), con RIR bajos o moderados y series de 12 repeticiones o menos.

**Poco apropiado** o con mucha cautela:

- RIR altos (5 o más): el error es grande (Zourdos et al., 2021). Helms et al. (2016) agrupan 4–6 RIR en un solo tramo por eso.
- Series largas (más de 12 repeticiones).
- **Potencia y velocidad con cargas bajas o moderadas:** el objetivo es la intención máxima, no acercarse al fallo, y el RIR lejos del fallo no se puede estimar bien (Helms et al., 2016). Mejor un criterio de calidad o de velocidad (§5).
- Series por tiempo o distancia (isométricos, transportes de carga, sprints): el RIR se define en repeticiones. «Segundos en reserva» no es una medida validada y TrainPro no la ofrecerá.
- Personas que aún no conocen la escala: se puede registrar el RIR real como aprendizaje, sin prescribir con él.

### 4.3 Cuándo usar RPE (y qué escala)

«RPE» no es una sola escala. Mezclarlas es el error más frecuente, así que **cada prescripción de RPE lleva su escala** y los datos de escalas distintas no se comparan entre sí.

| Escala (`rpeScale`)  | Qué es                                                                                                                                                                                                  | Validación revisada                                                                                                                                                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rir_based` (1–10)   | Escala de fuerza basada en repeticiones en reserva: 10 = no podría hacer más, 9 = 1 en reserva, y así sucesivamente. 5–6 agrupa 4–6 en reserva; 3–4 = «esfuerzo ligero»; 1–2 = «poco o ningún esfuerzo» | Zourdos et al. (2016): relación inversa fuerte entre la puntuación y la velocidad media (r = −0,88 con experiencia, −0,77 sin ella). En powerlifters, relación muy fuerte entre puntuación y %1RM (r = 0,88–0,91) en sentadilla, press de banca y peso muerto (Helms et al., 2017a). Descriptores según Helms et al. (2016) |
| `omni_res` (0–10)    | Escala OMNI de ejercicio con resistencias, con apoyo visual. Distingue músculos activos y cuerpo entero                                                                                                 | Adultos jóvenes con entrenamiento recreativo (Robertson et al., 2003); versión infantil de 10 a 14 años (Robertson et al., 2005); usada para guiar la selección de carga en mayores de 60 (Gearhart et al., 2011)                                                                                                           |
| `borg_cr10` (0–10)   | Escala de categorías con propiedades de razón de Borg                                                                                                                                                   | Borg (1982). Uso general, no específica de fuerza                                                                                                                                                                                                                                                                           |
| **RPE de la sesión** | Una puntuación para toda la sesión, tomada unos 30 minutos después según Helms et al. (2016)                                                                                                            | Foster et al. (2001), comparada con un método basado en la frecuencia cardiaca. **Es otra métrica** (carga interna de la sesión, Fase 8), no el RPE de una serie                                                                                                                                                            |

**Apropiado:**

- Escala basada en RIR: los mismos casos que el RIR (§4.2). Es la misma información expresada de otra forma, con descriptores para esfuerzos bajos que sirven, por ejemplo, para **limitar** el esfuerzo en trabajo de velocidad («RPE como máximo 4», Helms et al., 2016).
- OMNI-RES: cuando la cercanía al fallo no es el objetivo o es difícil de estimar (población mayor, salud, personas sin experiencia, isométricos, circuitos). Tiene versión infantil validada. Con el ejercicio a varias series al 70 % del 1RM, el RPE OMNI subió entre series y al 50 % no (Lins-Filho et al., 2012).
- RPE de la sesión: seguimiento de la carga interna, en la Fase 8.

### 4.4 RIR y RPE a la vez: solo con justificación

- **Con la escala basada en RIR**, prescribir RIR y RPE juntos es **redundante**: «RPE 8» y «RIR 2» son el mismo dato. TrainPro lo impide y muestra el equivalente como ayuda.
- **Casos justificados:** RIR por serie + RPE de la sesión, RIR + OMNI-RES en estudios o en una fase de aprendizaje de la escala, o RIR + RPE de músculos activos en readaptación. El entrenador escribe la justificación, que queda guardada y visible.
- **Carga + esfuerzo sí se combinan sin problema:** «3 × 3 al 90 % del 1RM, RIR 0–1» es una forma documentada de comprobar que la carga prevista coincide con el esfuerzo real (Helms et al., 2016). Lo mismo con el ejemplo «Press banca: 3 × 8, 70 % 1RM, RPE 8».

### 4.5 Equivalencia RPE ↔ RIR: límites

La equivalencia «RPE 10 = RIR 0, RPE 9 = RIR 1…» **solo existe dentro de la escala basada en RIR**, porque esa escala se define así (Zourdos et al., 2016). No es una ley fisiológica. Límites:

1. **No se aplica a OMNI-RES ni a Borg CR10.** Un 8 en OMNI-RES no equivale a 2 RIR. TrainPro **no convierte** entre escalas.
2. **Pierde sentido por debajo de 5**: la escala usa ahí descriptores de esfuerzo, no repeticiones en reserva.
3. **Hereda el error del RIR** (§4.2): mayor lejos del fallo y en series largas.
4. **Diferencias por experiencia:** en un 1RM, las personas con experiencia puntuaron 9,80 ± 0,18 y las noveles 8,96 ± 0,43 (Zourdos et al., 2016, según Helms et al., 2016). Sin experiencia, se tiende a no reconocer el esfuerzo máximo.
5. **Evidencia limitada por ejercicio:** en 2016 los datos procedían sobre todo de sentadilla y press de banca con barra. Faltaban ejercicios en máquina, monoarticulares, solo excéntricos y comparaciones entre sexos (Helms et al., 2016).
6. **Tablas de %1RM, repeticiones y RIR:** son orientativas, de medias de personas entrenadas en sentadilla, y **no son una herramienta de conversión** por la variabilidad individual (Helms et al., 2016). TrainPro no las usará para calcular cargas.
7. **Hay una errata en el texto de Helms et al. (2016)**, que escribe «10 RPE = 1 RIR»; su tabla y el estudio original (Zourdos et al., 2016) dicen 10 = 0 RIR. Se usa la definición del estudio original.

### 4.6 Cuándo no hace falta ninguna escala

- **Técnica y aprendizaje motor**: la prioridad es la calidad. Mejor un criterio de técnica (§5).
- **Potencia, saltos, lanzamientos y sprints**: intención máxima y criterio de calidad o velocidad. Forzar una escala de esfuerzo es inadecuado (lo pide el propio requisito).
- **Movilidad, calentamiento y activación.**
- **Readaptación con criterios de dolor o síntomas** definidos por el profesional (§5), que sustituyen a la escala o se añaden a ella.
- **Personas que no pueden o no quieren usar una escala** (por ejemplo, con dificultades cognitivas). Lo decide el profesional; TrainPro no lo infiere.

### 4.7 Por tipo de ejercicio y de población (orientación, no reglas automáticas)

| Contexto                            | Opción habitual                                                        | Matices                                                              |
| ----------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Multiarticular de fuerza            | kg o %1RM + RIR (o escala basada en RIR)                               | RIR bajos o moderados; si se usa %1RM, el RIR comprueba el día a día |
| Accesorio o monoarticular           | kg o carga autoseleccionada + RIR                                      | Menos evidencia específica (§4.5, punto 5)                           |
| Técnico                             | Carga ligera, sin escala, criterio de técnica                          | —                                                                    |
| Potencia                            | kg o %1RM + criterio de velocidad o calidad; tope de esfuerzo opcional | El RIR lejos del fallo no es fiable                                  |
| Saltos, aterrizajes, sprints        | Sin carga o carga indicada + criterio de calidad                       | El conteo es de repeticiones o distancias, no de cercanía al fallo   |
| Isométricos y transportes de cargas | Tiempo o distancia + OMNI-RES o sin escala                             | Sin RIR                                                              |
| Salud y población mayor             | OMNI-RES o RIR moderado, tras familiarización                          | La escala no sustituye el juicio clínico                             |
| Niños y adolescentes (10–14)        | OMNI-RES infantil                                                      | Es la única validación revisada en esa franja                        |
| Readaptación                        | Criterios del profesional (dolor, técnica, fase) ± escala              | TrainPro no propone criterios clínicos                               |
| Rendimiento con experiencia         | RIR o escala basada en RIR por serie; velocidad si hay dispositivo     | El RIR exige práctica previa, también en personas entrenadas         |

## 5. Criterios de finalización de la serie

| Criterio                      | Datos                                                           | Quién lo valora                             | Requisito                                                                                               |
| ----------------------------- | --------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Pérdida de velocidad          | Porcentaje (p. ej., 20 %) e instrumento                         | El dispositivo                              | **Exige un medidor de velocidad.** TrainPro **no mide velocidad** ni se integra con dispositivos (P-25) |
| Pérdida de rendimiento        | Métrica (altura de salto, tiempo), porcentaje e instrumento     | El dispositivo o el entrenador              | Igual que el anterior                                                                                   |
| Pérdida de técnica            | Descripción del entrenador («si la rodilla se va hacia dentro») | El cliente o el entrenador                  | Texto visible en la serie                                                                               |
| Pérdida de calidad            | Descripción («si el contacto deja de ser rápido»)               | El cliente o el entrenador                  | Texto visible                                                                                           |
| Dolor o síntomas              | Umbral definido por el profesional                              | El cliente, con el criterio del profesional | Solo en readaptación, con `defined_by`. TrainPro no propone umbrales                                    |
| RIR alcanzado                 | RIR objetivo                                                    | El cliente                                  | «Para cuando creas que te quedan 2»                                                                     |
| Tope de tiempo o repeticiones | Segundos o repeticiones                                         | El temporizador o el cliente                | —                                                                                                       |

La pérdida de velocidad sirve para cuantificar la fatiga neuromuscular durante la serie (Sánchez-Medina y González-Badillo, 2011). Con 8 semanas de sentadilla, parar al 20 % de pérdida dio ganancias de fuerza similares a parar al 40 %, con un 40 % menos de repeticiones y más mejora en el salto; el 40 % produjo más hipertrofia del vasto lateral e intermedio (Pareja-Blanco et al., 2017). Son resultados en hombres jóvenes y en un ejercicio. **TrainPro solo registra el criterio y el resultado que el usuario introduce**: si en el futuro se importan datos de un dispositivo, se marcarán como `imported` tras verificar la integración.

Al registrar la serie, el cliente puede indicar **por qué paró** (completó, alcanzó el criterio, dolor, otro), como dato autodeclarado.

## 6. Lo que ve el cliente

La carga y el esfuerzo son los datos más visibles de la ficha del ejercicio durante el entrenamiento (ver los bocetos en `TRAINING_EXPERIENCE.md`):

```
SENTADILLA TRASERA
4 series × 6 repeticiones
Carga            80 kg
Esfuerzo         RIR 2  · ⓘ Para con unas 2 repeticiones de margen
Descanso         2 min
Tempo            2-0-1  · ⓘ Baja en 2 s, sin pausa, sube en 1 s
```

Textos en lenguaje claro (borrador para revisar):

- **RIR 2:** «Termina la serie cuando creas que podrías hacer **unas 2 repeticiones más** con buena técnica. No hace falta llegar al límite.»
- **RIR 0:** «Haz todas las repeticiones que puedas con buena técnica.» (Solo si el entrenador lo prescribe; nunca por defecto.)
- **Rango RIR 1–3:** «Para cuando te queden **entre 1 y 3** repeticiones de margen.»
- **RPE 8 (escala basada en RIR):** se muestra la escala completa con la marca en 8: «**Duro**: te quedarían unas 2 repeticiones.»
- **OMNI-RES 6:** se muestra la escala con sus anclas visuales y texto, sin traducirla a repeticiones.
- **Sin escala, con criterio de calidad:** «**Prioridad: técnica.** Para si notas que…» (texto del entrenador).
- **Peso corporal + 10 kg:** «Tu peso + **10 kg** de lastre.»
- **Asistencia de 20 kg:** «La máquina **te ayuda con 20 kg**. Menos ayuda = más difícil.»
- **Carga autoseleccionada:** «**Elige tú la carga**: la que te permita hacer 8 repeticiones dejando unas 2 de margen.»

La ayuda (ⓘ) se despliega en el sitio, sin cambiar de pantalla, y se ofrece siempre la primera vez. Los textos los revisa el responsable del producto antes de implementarlos (P-26).

## 7. Registro de lo realizado

### 7.1 Qué se registra en cada serie

- Carga realizada **en la misma modalidad** que la prescrita, rellena con el valor previsto para confirmarla con un toque: kg, kg añadidos, asistencia, banda o ajuste.
- Repeticiones (o segundos, o metros), por lado si procede.
- RIR o RPE reales, **opcionales** y en la misma escala que la prescripción. Si no se prescribió escala, no se piden.
- Motivo de parada (opcional) y observaciones.
- Hora del registro en el dispositivo y hora de recepción en el servidor.

Todo es `self_reported`, salvo lo que mide un instrumento (`direct`) o se importa (`imported`). Si el cliente cambia la carga, se guarda la suya. La desviación respecto a lo prescrito es un valor `calculated` (`training.load-deviation`), solo cuando ambos están en kg.

### 7.2 Correcciones e historial

- Cada serie tiene un **identificador generado en el dispositivo**: reenviar la misma serie, por ejemplo tras perder la conexión, no crea otra (idempotencia).
- Corregir una serie crea una **nueva versión** que sustituye a la anterior (`supersedes`), que se conserva en el historial. El cálculo usa la última versión válida por (ejercicio prescrito, número de serie), igual que hoy hace `effectiveSetRecords`.
- Restricción única en base de datos (ver `DATA_MODEL.md`).

### 7.3 Validaciones

Repeticiones de 0 a 100, kg de 0 a 500, RIR de 0 a 10, RPE de 1 a 10 en pasos de 0,5 (o 0–10 en OMNI-RES). Son límites de plausibilidad para evitar errores de escritura, no valores normativos.

## 8. Estimación del 1RM a partir de repeticiones y RIR

### 8.1 Situación y propuesta

TrainPro **no estima el 1RM** todavía (`SCIENTIFIC_RIGOR.md`). Para incorporarlo, el registro de fórmulas exige leer la fuente primaria. Esto es lo que se ha podido verificar:

| Ecuación               | Expresión                                                                         | Fuente                                                                   | Estado                                                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brzycki                | 1RM = carga ÷ (1,0278 − 0,0278 × reps) ≈ carga × 36 ÷ (37 − reps)                 | Brzycki (1993), _JOPERD_ 64(1):88–90, DOI 10.1080/07303084.1993.10606684 | **Fuente localizada, texto no leído.** No está en PubMed. Según fuentes secundarias, el artículo no describe los datos de los que sale la ecuación |
| Epley                  | 1RM = carga × (1 + reps ÷ 30)                                                     | Atribuida a Epley (1985), tabla publicada por su autor                   | **Fuente primaria no localizada.** No se puede registrar con las reglas del proyecto                                                               |
| Reynolds et al. (2006) | Prensa: 1RM = 1,0970 × 5RM + 14,2546; press de pecho: 1RM = 1,1307 × 5RM + 0,6999 | _J Strength Cond Res_ 20(3):584–592                                      | **Verificada en PubMed (resumen).** Solo para esas máquinas y a partir de 5RM. Recomienda no usar más de 10 repeticiones en ecuaciones lineales    |

**Propuesta (P-23):** registrar una ecuación general (Brzycki, si la lectura del original lo permite) como `estimation.1rm-brzycki` 1.0.0, con sus limitaciones. Mientras tanto, el entrenador puede **introducir a mano** un 1RM estimado, con procedencia `estimated` y el método en texto, para usarlo como referencia del %1RM.

### 8.2 Con RIR: fórmula, supuestos y condiciones

La forma habitual de incluir el RIR es sumar las repeticiones en reserva a las realizadas y aplicar la ecuación como si la serie hubiera llegado al fallo:

```
repeticiones hasta el fallo (estimadas) = repeticiones realizadas + RIR declarado
1RM estimado = ecuación(carga, repeticiones hasta el fallo)
```

**No se ha encontrado una validación publicada de esta combinación.** Si se aprueba, sería una fórmula propia (`estimation.1rm-from-rir`), con estas condiciones de aplicación:

| Condición                                                                   | Motivo                                                                                                                      |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Carga externa en kg (`external`, `percent_1rm`, `external_range` realizado) | Las ecuaciones parten de una carga conocida. Excluye peso corporal, asistencia, bandas y dispositivos sin calibrar          |
| Repeticiones hasta el fallo ≤ 10                                            | Reynolds et al. (2006) desaconsejan más de 10 en ecuaciones lineales                                                        |
| RIR declarado ≤ 3 (regla del producto, a validar)                           | El error del RIR crece lejos del fallo (Zourdos et al., 2021); el umbral es una decisión conservadora, no un valor validado |
| Persona familiarizada con el RIR                                            | Helms et al. (2016); el entrenador lo marca en la ficha del cliente                                                         |
| Mismo ejercicio y variante que el 1RM que se quiere estimar                 | La relación carga–repeticiones cambia entre ejercicios (Helms et al., 2016; Reynolds et al., 2006)                          |
| Técnica y rango de movimiento habituales                                    | Si no, la serie no es comparable                                                                                            |
| Serie de trabajo, no de calentamiento                                       | —                                                                                                                           |

Limitaciones que se mostrarán junto al resultado:

- Las personas tienden a **subestimar** sus repeticiones en reserva, con mucha variabilidad (Halperin et al., 2022). Si se subestima, el 1RM sale más bajo.
- Las ecuaciones se obtuvieron en poblaciones concretas. En otras, la precisión cambia y hace falta validarlas, como se hizo en hombres con lesión medular (Ribeiro Neto et al., 2017).
- **Ejemplo de sensibilidad** (no es un intervalo de confianza): 80 kg × 6 repeticiones con RIR 2 → 8 repeticiones hasta el fallo. Brzycki da 99,3 kg y Epley, 101,3 kg. Con ±1 repetición de error en el RIR, el resultado va de 96,0 a 102,9 kg con Brzycki y de 98,7 a 104,0 kg con Epley. Por eso **se mostrará como un valor aproximado con su margen**, nunca como un dato exacto.

### 8.3 Cómo se guarda

- Como medición `estimated` con la fórmula (id + versión), las series usadas (`set_log`), las condiciones comprobadas y la fecha.
- **Nunca sustituye** a un 1RM directo ni lo sobrescribe. Se muestran por separado.
- **No se calcula automáticamente** en cada serie. El entrenador lo pide para un ejercicio, o lo activa de forma explícita para un cliente y un ejercicio (P-24).

## 9. Automatismos: ninguno por defecto

- No se asigna RIR ni RPE por defecto.
- No se ajusta la carga de la siguiente serie ni de la siguiente sesión.
- No se recalcula el %1RM de las sesiones publicadas.
- Si en el futuro se añade una regla (por ejemplo, «si el RIR real es 2 más que el objetivo, proponer +2,5 kg»), será **opcional**, por cliente y ejercicio, documentada como fórmula versionada, y producirá **propuestas que el entrenador confirma**. Nunca se aplicará en readaptación sin el profesional responsable.

## 10. Integración con volumen y tonelaje (R6)

### 10.1 Métricas separadas

| Métrica                             | Definición                                                                                       | Modalidades incluidas                                                   | Fórmula (propuesta)                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------- |
| **Volumen prescrito**               | Series y repeticiones previstas (rangos como mín.–máx.); tiempo y distancia aparte               | Todas                                                                   | `training.prescribed-volume` 1.0.0                    |
| **Volumen ejecutado**               | Series y repeticiones **efectivas** (sin duplicados), de trabajo y de calentamiento por separado | Todas                                                                   | `training.completed-sets` / `total-reps` (ya existen) |
| **Tonelaje prescrito**              | Σ series × repeticiones × kg externos totales previstos                                          | `external`, `external_range` (mín.–máx.), `percent_1rm` (kg congelados) | `training.prescribed-volume-load` 1.0.0               |
| **Tonelaje ejecutado**              | Σ repeticiones × kg externos totales **realizados**, solo series de trabajo efectivas            | Las mismas, más `self_selected` con kg realizados                       | `training.volume-load` (pasa a 2.0.0, §10.2)          |
| **Carga externa añadida**           | Σ repeticiones × kg de lastre                                                                    | `bodyweight_plus`                                                       | `training.added-load-volume` 1.0.0                    |
| **Carga asistida**                  | Asistencia media y Σ repeticiones con asistencia                                                 | `assisted`                                                              | `training.assistance-summary` 1.0.0                   |
| **Intensidad relativa (% 1RM)**     | kg realizados ÷ 1RM de referencia del mismo ejercicio                                            | Con referencia de 1RM                                                   | `training.relative-intensity` 1.0.0                   |
| **Carga relativa al peso corporal** | kg externos ÷ peso corporal medido (con su fecha)                                                | Con peso corporal registrado                                            | `training.load-to-body-mass` 1.0.0                    |
| **Series sin carga externa**        | Recuento                                                                                         | `bodyweight`, `elastic`, `device` sin kg, `none`                        | Ya existe (`setsWithoutExternalLoad`)                 |

«Carga relativa» tiene dos significados habituales (respecto al 1RM y respecto al peso corporal). Se muestran como **dos métricas distintas y con su nombre completo**.

### 10.2 Cambios en el tonelaje actual

`training.volume-load` 1.0.0 suma repeticiones × kg. La versión 2.0.0 añadirá la base de la carga (total, por lado, por implemento), las repeticiones por lado y la exclusión de las series de calentamiento. Por las reglas del registro, los resultados antiguos conservan su versión.

### 10.3 Peso corporal × repeticiones

**No se calcula como tonelaje.** La parte del peso corporal que se mueve depende del ejercicio y de la postura: en las flexiones, el porcentaje de la masa corporal que soportan los brazos cambia entre la posición alta y la baja, y entre la flexión clásica y la de rodillas (Suprak et al., 2011). Multiplicar el peso corporal por las repeticiones mezclaría magnitudes distintas.

Si en el futuro se necesita, se definiría una métrica aparte y con nombre propio («masa del sistema», peso corporal + lastre) **solo en ejercicios en los que se desplaza todo el cuerpo** (dominadas, fondos), marcada por la administración del catálogo, con su justificación y sin sumarla al tonelaje externo (P-27).

### 10.4 Sin duplicados

Todas las métricas parten de las series efectivas (§7.2): una serie reenviada o corregida cuenta una sola vez. El volumen por patrón o por etiqueta sigue la regla ya documentada: cada serie suma una vez a cada patrón de su variante.

## 11. Riesgos científicos y limitaciones

| Riesgo                                                                     | Mitigación                                                                                    |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| El RIR y el RPE son estimaciones subjetivas con error                      | Mostrarlos siempre como `self_reported`; no usarlos solos para cálculos sin advertencia       |
| Mezclar escalas de RPE                                                     | Escala obligatoria en cada prescripción y registro; no se comparan datos de escalas distintas |
| Usar la equivalencia RPE ↔ RIR fuera de su escala                          | Solo dentro de `rir_based`; sin conversiones automáticas                                      |
| Interpretar tablas de %1RM–repeticiones–RIR como exactas                   | No se usan para calcular                                                                      |
| Estimar el 1RM fuera de sus condiciones                                    | Condiciones del §8.2 comprobadas antes de calcular; resultado como aproximación con margen    |
| Ecuaciones sin fuente primaria verificada                                  | No se implementan hasta verificarlas (Epley, Brzycki)                                         |
| Evidencia concentrada en adultos jóvenes, entrenados y en pocos ejercicios | Limitaciones visibles; el profesional decide en otras poblaciones                             |
| Criterios de velocidad sin dispositivo                                     | Solo como texto y dato introducido; sin integración supuesta                                  |
| Automatizar decisiones de entrenamiento                                    | Sin automatismos por defecto (§9)                                                             |
| Readaptación                                                               | Criterios definidos por el profesional; TrainPro no propone umbrales ni protocolos            |

## 12. Referencias

### Verificadas en PubMed (6 de noviembre de 2026)

- Borg GA. Psychophysical bases of perceived exertion. _Med Sci Sports Exerc_. 1982;14(5):377-81. PMID 7154893.
- Foster C, et al. A new approach to monitoring exercise training. _J Strength Cond Res_. 2001;15(1):109-15. PMID 11708692.
- Gearhart RF, et al. Safety of using the adult OMNI Resistance Exercise Scale to determine 1-RM in older men and women. _Percept Mot Skills_. 2011;113(2):671-6. doi:10.2466/10.15.PMS.113.5.671-676. PMID 22185081.
- Halperin I, et al. Accuracy in predicting repetitions to task failure in resistance exercise: a scoping review and exploratory meta-analysis. _Sports Med_. 2022;52(2):377-390. doi:10.1007/s40279-021-01559-x. PMID 34542869.
- Helms ER, Cronin J, Storey A, Zourdos MC. Application of the repetitions in reserve-based rating of perceived exertion scale for resistance training. _Strength Cond J_. 2016;38(4):42-49. doi:10.1519/SSC.0000000000000218. PMID 27531969. **Texto completo leído** (PMC4961270).
- Helms ER, et al. RPE and velocity relationships for the back squat, bench press, and deadlift in powerlifters. _J Strength Cond Res_. 2017;31(2):292-297. doi:10.1519/JSC.0000000000001517. PMID 27243918. (Helms et al., 2017a)
- Helms ER, et al. Self-rated accuracy of rating of perceived exertion-based load prescription in powerlifters. _J Strength Cond Res_. 2017;31(10):2938-2943. doi:10.1519/JSC.0000000000002097. PMID 28933716. (Helms et al., 2017b)
- Hermann T, et al. Without fail: muscular adaptations in single-set resistance training performed to failure or with repetitions-in-reserve. _Med Sci Sports Exerc_. 2025;57(9):2021-2031. doi:10.1249/MSS.0000000000003728. PMID 40249908.
- Lins-Filho OL, et al. Effects of exercise intensity on rating of perceived exertion during a multiple-set resistance exercise session. _J Strength Cond Res_. 2012;26(2):466-72. doi:10.1519/JSC.0b013e31822602fa. PMID 22233796.
- Pareja-Blanco F, et al. Effects of velocity loss during resistance training on athletic performance, strength gains and muscle adaptations. _Scand J Med Sci Sports_. 2017;27(7):724-735. doi:10.1111/sms.12678. PMID 27038416.
- Refalo MC, et al. Accuracy of intraset repetitions-in-reserve predictions during the bench press exercise in resistance-trained male and female subjects. _J Strength Cond Res_. 2024;38(3):e78-e85. doi:10.1519/JSC.0000000000004653. PMID 37967832.
- Reynolds JM, Gordon TJ, Robergs RA. Prediction of one repetition maximum strength from multiple repetition maximum testing and anthropometry. _J Strength Cond Res_. 2006;20(3):584-92. doi:10.1519/R-15304.1. PMID 16937972.
- Ribeiro Neto F, et al. Validity of one-repetition maximum predictive equations in men with spinal cord injury. _Spinal Cord_. 2017;55(10):950-956. doi:10.1038/sc.2017.49. PMID 28485383.
- Robertson RJ, et al. Concurrent validation of the OMNI perceived exertion scale for resistance exercise. _Med Sci Sports Exerc_. 2003;35(2):333-41. doi:10.1249/01.MSS.0000048831.15016.2A. PMID 12569225.
- Robertson RJ, et al. Validation of the Children's OMNI-Resistance Exercise Scale of perceived exertion. _Med Sci Sports Exerc_. 2005;37(5):819-26. doi:10.1249/01.mss.0000162619.33236.f1. PMID 15870636.
- Sánchez-Medina L, González-Badillo JJ. Velocity loss as an indicator of neuromuscular fatigue during resistance training. _Med Sci Sports Exerc_. 2011;43(9):1725-34. doi:10.1249/MSS.0b013e318213f880. PMID 21311352.
- Suprak DN, Dawes J, Stephenson MD. The effect of position on the percentage of body mass supported during traditional and modified push-up variants. _J Strength Cond Res_. 2011;25(2):497-503. doi:10.1519/JSC.0b013e3181bde2cf. PMID 20179649.
- Zourdos MC, et al. Novel resistance training-specific rating of perceived exertion scale measuring repetitions in reserve. _J Strength Cond Res_. 2016;30(1):267-75. doi:10.1519/JSC.0000000000001049. PMID 26049792.
- Zourdos MC, et al. Proximity to failure and total repetitions performed in a set influences accuracy of intraset repetitions in reserve-based rating of perceived exertion. _J Strength Cond Res_. 2021;35(Suppl 1):S158-S165. doi:10.1519/JSC.0000000000002995. PMID 30747900.

### Pendientes de verificar en la fuente primaria (no se usan para calcular)

- Brzycki M. Strength testing—predicting a one-rep max from reps-to-fatigue. _J Phys Educ Recreat Dance_. 1993;64(1):88-90. doi:10.1080/07303084.1993.10606684. Localizada mediante Scilit y la página del autor; no indexada en PubMed.
- Epley B. _Poundage chart_. 1985. Fuente original no localizada.
- LeSuer DA, et al. Precisión de las ecuaciones de predicción del 1RM en press de banca, sentadilla y peso muerto. _J Strength Cond Res_. 1997;11(4). No localizada en PubMed.
- Hackett DA, et al. (2012), citado por Helms et al. (2016) sobre la estimación de repeticiones restantes en culturistas. No consultado directamente.
