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
- **Estimación de RM**: el sistema está preparado para guardarla como `estimated`, con la fórmula versionada y su error, nunca como medición directa. **Ninguna ecuación está incorporada todavía**: se elegirá tras verificar su fuente primaria, su población y su rango de validez, y se documentarán sus limitaciones (por ejemplo, que pierde precisión con muchas repeticiones o con RIR declarado).
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

## Estado de las sesiones y cálculos sin duplicados

Una sesión solo está **completada** si se han hecho todas las series prescritas. Terminarla antes la deja como **parcial o interrumpida**. Las series repetidas (por ejemplo, un reenvío) o ajenas a la prescripción **no cuentan**: series, repeticiones y tonelaje se calculan sobre las series efectivas (`effectiveSetRecords`). El esfuerzo percibido de la sesión se valida como entero de 0 a 10 y se marca como autodeclarado.

## Clasificación de los ejercicios

Las etiquetas se organizan en cuatro dimensiones independientes (ver `TAXONOMY.md`) y describen **usos de programación**, no propiedades fijas del ejercicio. No se asignan por el nombre: dependen de la variante, la carga, la intención, la velocidad, el rango y el tipo de contracción. Por eso cada variante tiene su propia clasificación y, cuando hace falta, una nota que explica por qué (`classificationNote`). Las asignaciones del catálogo demo son ejemplos editables, no afirmaciones científicas.

## Readaptación

Las fases y los criterios de progresión los define **el profesional responsable** (entrenador o fisioterapeuta, según conste en cada criterio). TrainPro registra si cada criterio se cumple y nunca propone criterios clínicos por su cuenta. El caso de la demo es ficticio y no constituye una recomendación clínica.
