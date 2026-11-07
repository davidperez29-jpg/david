# Rigor científico y trazabilidad

Principio: **TrainPro no inventa fórmulas, referencias, valores normativos ni integraciones.** Cada dato dice de dónde sale, y cada cálculo se puede rastrear hasta su definición exacta.

## Procedencia de cada dato (`src/domain/measurement.ts`)

Todo valor medible lleva una `Provenance` con uno de estos cinco orígenes, visibles en la interfaz:

| Origen          | Significado                                                      | Requisitos que se validan          |
| --------------- | ---------------------------------------------------------------- | ---------------------------------- |
| `direct`        | El instrumento mide esa magnitud directamente                    | Método; no puede citar una fórmula |
| `calculated`    | Resultado de aplicar una fórmula registrada a otros datos        | Fórmula registrada (id + versión)  |
| `estimated`     | Valor predicho con un modelo o ecuación, con error de estimación | Fórmula registrada (id + versión)  |
| `imported`      | Recibido de un dispositivo o archivo externo                     | Origen del dato (`importedFrom`)   |
| `self_reported` | Comunicado por la propia persona                                 | —                                  |

Además, siempre se guardan el **método**, el **instrumento** (si lo hay), la **unidad**, la **fecha de medición**, la **fecha de registro** y **quién lo registró**. `measurementIssues()` rechaza las combinaciones incoherentes, por ejemplo un valor calculado sin fórmula o una medición posterior a su registro.

Ejemplo de por qué importa: la altura de un CMJ que da una aplicación o una plataforma de contacto **no es una medición directa de la altura**, porque el dispositivo la calcula a partir de otras variables. En los datos demo se registra como `imported`, indicando que la cifra la ha calculado la aplicación. **No se deducen variables que el dispositivo no mide.**

## Registro de fórmulas (`src/domain/formulas.ts`)

Cada fórmula tiene `id`, `version` (semver), tipo, expresión legible, unidad de salida, **limitaciones** y **referencias**:

- `operational_definition`: definiciones aritméticas acordadas, que no dependen de un estudio. Se documentan igualmente.
- `scientific_formula`: ecuaciones de la literatura. **Exigen al menos una referencia verificada** (cita, DOI o PMID y fecha de verificación); el test `registryIssues` falla si falta.

### Fórmulas registradas en la Fase 1

| Id                         | Versión | Tipo                 | Definición                                                                         |
| -------------------------- | ------- | -------------------- | ---------------------------------------------------------------------------------- |
| `training.completed-sets`  | 1.0.0   | Definición operativa | Número de series registradas como completadas                                      |
| `training.total-reps`      | 1.0.0   | Definición operativa | Suma de repeticiones de las series completadas                                     |
| `training.volume-load`     | 1.0.0   | Definición operativa | Σ (repeticiones × carga externa en kg) de las series completadas con carga externa |
| `assessment.best-attempt`  | 1.0.0   | Definición operativa | Mejor intento válido según el sentido de la prueba (mayor o menor)                 |
| `assessment.mean-attempts` | 1.0.0   | Definición operativa | Media aritmética de los intentos válidos                                           |

Las limitaciones están escritas en el registro y se muestran en la pantalla «Carga y volumen». Por ejemplo, el tonelaje no es trabajo mecánico, excluye el peso corporal y las series por tiempo o distancia no suman repeticiones.

**No hay ninguna fórmula científica en la Fase 1.** Las estimaciones de RM, el RSI modificado, la altura de salto a partir del tiempo de vuelo, los valores de referencia, etc. se incorporarán en la fase de evaluación, **una a una y tras verificar la fuente primaria**.

### Cómo añadir una fórmula científica

1. Localizar y leer la **fuente primaria** (no un resumen ni un blog). Anotar la cita completa y el DOI o PMID.
2. Registrar la ecuación exacta, las unidades de entrada y salida, la población y el rango de validez, y el error de estimación si se publica.
3. Añadirla al registro con versión `1.0.0`, sus limitaciones y `verifiedOn`.
4. Implementar el cálculo en el dominio, con tests que reproduzcan **ejemplos numéricos publicados** cuando existan.
5. Si cambia la ecuación, se crea **una versión nueva**. Los resultados antiguos conservan la versión con la que se calcularon.

## Intentos y resultado de una prueba

Una evaluación puede registrar varios **intentos**. El resultado se obtiene con una regla explícita, el **mejor intento** o el **promedio**, y por eso es un valor `calculated` con la fórmula y la versión de esa regla. Cada intento conserva su procedencia original (por ejemplo, `imported` desde la aplicación de salto). `resultIssues()` comprueba que el resultado coincide con sus intentos y con la regla declarada.

## Lo que TrainPro no deduce

- **No se infieren variables que el instrumento no mide.** A partir de una altura de salto no se calculan fuerza pico, RFD, impulso, curvas fuerza-tiempo ni estrategia de aterrizaje.
- **No se atribuyen a una prueba capacidades que no mide.**
- **Estimación de RM**: el sistema está preparado para guardarla como `estimated`, con la fórmula versionada y su error, nunca como medición directa. **Ninguna ecuación está incorporada todavía**: se elegirá tras verificar su fuente primaria, su población y su rango de validez, y se documentarán sus limitaciones (por ejemplo, que pierde precisión con muchas repeticiones o con RIR declarado). El análisis de las ecuaciones candidatas, su estado de verificación y las condiciones para usarlas con RIR están en `EFFORT_AND_LOAD.md` §8.
- **Volumen**: series, repeticiones y tonelaje solo donde corresponde. Las series por tiempo o distancia no se convierten a tonelaje. El volumen por patrón o por etiqueta se definirá como fórmula registrada antes de mostrarse.

## Comparación de resultados

`compareResults()` solo compara dos resultados de la **misma prueba**, con la **misma unidad**, el **mismo método**, el **mismo instrumento** y la **misma regla de intentos**. Si no coinciden, la interfaz muestra «No comparable» y el motivo. Muestra el cambio absoluto y el porcentual, y si va en la dirección deseada según la prueba (en un sprint, menos tiempo es mejor).

**Lo que todavía no hace:** decidir si un cambio es **relevante**. Eso exige datos de fiabilidad del protocolo (como el error típico o el cambio mínimo detectable) que se incorporarán con su referencia en la fase de evaluación.

## Catálogo de pruebas

CMJ, SJ, CMJ unilateral, RSI modificado, sprint de 10/20/30 m, 505, 1RM directa, estimación de RM y levantarse de la silla en 30 s. Todas están en estado `protocol_pending`: aún no tienen protocolo, fórmulas ni valores de referencia verificados, y la interfaz lo indica.

## Convenciones de prescripción

Son notaciones de la aplicación, no afirmaciones científicas:

- **Tempo** en cuatro cifras: excéntrica – pausa – concéntrica – pausa (en segundos). `X` = concéntrica explosiva. Ejemplo: `3-1-X-0`.
- **RIR**: repeticiones en reserva (entero de 0 a 10).
- **RPE**: esfuerzo percibido de 1 a 10, en pasos de 0,5.
- **Carácter del esfuerzo**: repeticiones realizadas (realizables), por ejemplo `6 (12)`.
- **Esfuerzo percibido de la sesión** (pantalla final del cliente): de 0 a 10, marcado como autodeclarado. La escala y sus anclajes se definirán y documentarán en la fase de seguimiento de carga, antes de usarlo para cualquier cálculo de carga interna.

## Carga y carácter del esfuerzo (diseño pendiente de aprobación)

El análisis completo, con referencias verificadas en PubMed, está en `EFFORT_AND_LOAD.md`. Reglas que añade:

- **Cada RPE lleva su escala** (basada en RIR, OMNI-RES o Borg CR10). No se comparan datos de escalas distintas ni se convierte entre ellas.
- La equivalencia **RPE 10 = RIR 0, RPE 9 = RIR 1…** solo vale dentro de la escala basada en RIR, que se define así; por debajo de 5 esa escala usa descriptores de esfuerzo.
- **Sin RIR ni RPE por defecto** y sin automatismos que ajusten cargas o esfuerzos.
- **Prescrito, realizado y calculado o estimado**, siempre separados.
- El **peso corporal × repeticiones no es tonelaje**.
- Los criterios de **pérdida de velocidad** se registran como datos introducidos; TrainPro no mide velocidad ni supone integraciones.
- **Tempo:** se propone admitir también tres cifras (excéntrica – pausa – concéntrica), como `2-0-1` (P-22).

### Fórmulas propuestas

| Id                                | Tipo                 | Estado                                                                                                        |
| --------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------- |
| `training.percent-1rm-load`       | Definición operativa | Propuesta: porcentaje × 1RM de referencia, redondeado                                                         |
| `training.load-deviation`         | Definición operativa | Propuesta: kg realizados − kg prescritos                                                                      |
| `training.prescribed-volume`      | Definición operativa | Propuesta                                                                                                     |
| `training.prescribed-volume-load` | Definición operativa | Propuesta                                                                                                     |
| `training.volume-load`            | Definición operativa | 1.0.0 implementada; **2.0.0 propuesta** (base de la carga, repeticiones por lado, sin series de aproximación) |
| `training.added-load-volume`      | Definición operativa | Propuesta (lastre)                                                                                            |
| `training.assistance-summary`     | Definición operativa | Propuesta                                                                                                     |
| `training.relative-intensity`     | Definición operativa | Propuesta (% 1RM)                                                                                             |
| `training.load-to-body-mass`      | Definición operativa | Propuesta (kg ÷ peso corporal)                                                                                |
| `estimation.1rm-brzycki`          | Fórmula científica   | **Pendiente de leer la fuente primaria** (P-23)                                                               |
| `estimation.1rm-from-rir`         | Fórmula propia       | Sin validación publicada encontrada; solo bajo demanda (P-24)                                                 |

## Estado de las sesiones y cálculos sin duplicados

Una sesión solo está **completada** si se han hecho todas las series prescritas. Terminarla antes la deja como **parcial o interrumpida**. Las series repetidas (por ejemplo, un reenvío) o ajenas a la prescripción **no cuentan**: series, repeticiones y tonelaje se calculan sobre las series efectivas (`effectiveSetRecords`). El esfuerzo percibido de la sesión se valida como entero de 0 a 10 y se marca como autodeclarado.

## Clasificación de los ejercicios

Las etiquetas se organizan en cuatro dimensiones independientes (ver `TAXONOMY.md`) y describen **usos de programación**, no propiedades fijas del ejercicio. No se asignan por el nombre: dependen de la variante, la carga, la intención, la velocidad, el rango y el tipo de contracción. Por eso cada variante tiene su propia clasificación y, cuando hace falta, una nota que explica por qué (`classificationNote`). Las asignaciones del catálogo demo son ejemplos editables, no afirmaciones científicas.

## Readaptación

Las fases y los criterios de progresión los define **el profesional responsable** (entrenador o fisioterapeuta, según conste en cada criterio). TrainPro registra si cada criterio se cumple y nunca propone criterios clínicos por su cuenta. El caso de la demo es ficticio y no constituye una recomendación clínica.

## Protocolo de evidencia (propuesta, P-61)

Pendiente de aprobación. Amplía las reglas anteriores para que la ciencia sea verificable en toda la plataforma, no solo en las fórmulas.

> **Indicación del responsable (6 de noviembre de 2026):** el protocolo será **obligatorio** para toda decisión científica y todo cálculo que se incorpore. El contenido concreto (jerarquía, campos y etiquetas) sigue pendiente de aprobación.

### Cómo se hace obligatorio

1. **Puerta automática.** El test `registryIssues` se amplía: una fórmula científica, una escala, un esquema de progresión o una regla con etiqueta «Evidencia» o «Consenso» sin fuente registrada (DOI o PMID, fecha de verificación y población) **hace fallar `pnpm check`**.
2. **Lista de comprobación en cada cambio** que añada ciencia:
   - fuente original leída;
   - población y limitaciones anotadas;
   - etiqueta asignada;
   - ejemplo numérico publicado reproducido en un test, si existe.
3. **Sin fuente original leída, no se implementa**: queda como `PendingFeature` (como el 1RM por ecuación y los anclajes del RPE de la sesión).
4. **Revisión periódica:** cada fuente lleva la fecha de su última revisión, y una fuente sin revisar en más de 12 meses aparece como aviso en el registro.

### Jerarquía de fuentes

1. **Revisiones sistemáticas y metaanálisis**, con su protocolo registrado cuando exista.
2. **Estudios de validación** del instrumento, la prueba, la escala o la ecuación, en la población de interés.
3. **Estudios originales** relevantes (ensayos aleatorizados y observacionales).
4. **Declaraciones de consenso** de sociedades o grupos de expertos.
5. **Manuales y textos profesionales**: solo para definiciones y prácticas, nunca como prueba de eficacia.

### Datos obligatorios de cada fuente (`evidence_source`)

- Cita completa con DOI o PMID **verificado en la base de datos**, y fecha de verificación.
- Tipo de estudio y **población** (edad, sexo, nivel de entrenamiento, condición clínica).
- Hallazgo concreto que se usa, con su magnitud e incertidumbre si se publican.
- **Limitaciones**: tamaño de la muestra, duración, conflictos de interés (por ejemplo, autores vinculados a la empresa que comercializa el producto evaluado).
- **Aplicabilidad**: alta, media, baja o no aplicable a la población del cliente.
- **Fecha de la última revisión** y quién la hizo. Las fuentes se revisan cada 12 meses o cuando se publica una revisión sistemática nueva.

### Etiquetas visibles en la interfaz

| Etiqueta               | Significado                                                             | Ejemplo                                              |
| ---------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------- |
| **Medición directa**   | Lo mide el instrumento                                                  | 1RM levantado en una prueba                          |
| **Cálculo**            | Resultado de una fórmula operativa registrada                           | Tonelaje, carga interna                              |
| **Estimación**         | Predicción con un modelo, con su error                                  | 1RM estimado                                         |
| **Evidencia**          | Respaldado por fuentes de los niveles 1 a 3, aplicables a esa población | RPE de la sesión como método de carga interna        |
| **Consenso**           | Respaldado por una declaración de consenso                              | Retorno al deporte como un continuo                  |
| **Heurística**         | Práctica profesional razonable, sin evidencia directa                   | Doble progresión                                     |
| **Decisión de diseño** | Elección del producto o del profesional, sin pretensión científica      | Umbrales de una regla, ítems de la valoración previa |

- La etiqueta «basado en evidencia» **solo** se usa para elementos con la etiqueta «Evidencia» y su fuente visible.
- **No se vincula evidencia automáticamente.** Toda relación entre una fuente y un ejercicio, un método, una regla o un objetivo la propone una persona, la revisa otra (la administración del catálogo) y queda con estado `borrador`, `revisada` o `aprobada`.

### Ecuaciones cuya fuente original es un libro

Varias ecuaciones de estimación del 1RM proceden de libros o revistas profesionales no indexadas (`PROGRESSION_AND_AUTOREGULATION.md` §3). Por tu indicación (P-50), **solo hay una vía: obtener y leer el original**. La vía alternativa que se propuso (cotejar la expresión en al menos dos estudios de validación indexados) **queda descartada**. Si no se consigue el original, la ecuación no se implementa y se muestra `PendingFeature`.

Aun con el original, solo se ofrece para los ejercicios y las poblaciones en que se ha validado.
