# Evaluación

> Fase 5. Implementa `MASTER_SPECIFICATION.md` §11. El sistema registra, compara e interpreta. **No diagnostica** y **no predice lesiones**. Ante cualquier señal clínica muestra: *Requiere valoración por profesional sanitario*.

## 1. Modelo

| Elemento | Tabla | Notas |
|---|---|---|
| Test | `assessment_tests` | Protocolo con versión, material, unidad, sentido de mejora, número de intentos, regla de agregación, si se mide por lados y si es una **estimación**. |
| Fiabilidad | `test_reliability_data` | Puede ser publicada (con fuente y población) o **propia del centro** (`is_local`). Incluye ICC, CV, SEM, MDC95 y SWC. |
| Referencia | `reference_values` | Siempre con población y fuente. Tipos: media ± DE, mediana, percentiles, punto de corte o bandas. |
| Batería | `assessment_batteries` + `battery_tests` | Plantilla por objetivo, con tests principales y opcionales. |
| Evaluación | `assessments` | Fecha, evaluador, contexto, condiciones, tests planificados y estado. |
| Resultado | `assessment_results` | Intentos brutos, mejor intento, media, **valor según la regla** y CV entre intentos. Guarda la versión del protocolo, el método o dispositivo y la validez. Hay un resultado por test y lado. |
| Métrica derivada | `derived_metrics` | Se recalcula al registrar o borrar un resultado. |

Los catálogos globales (con `organization_id` nulo) son de solo lectura. Cada organización puede añadir sus propios tests, baterías y fiabilidad local.

## 2. Reglas (paquete `packages/domain/src/assessment`)

### 2.1 Agregación de intentos
`aggregateAttempts` aplica la regla de cada test: mejor intento (respetando el sentido de mejora; en tiempos, el menor), media, media de los *n* mejores o último intento. También calcula el CV entre intentos.

En la UI se indica siempre qué valor se usa («se usa el mejor intento»).

### 2.2 Interpretación del cambio (§11.5)
```
error = fiabilidad propia del centro ▸ si no, publicada en población similar ▸ si no, desconocido
|Δ| < error típico              → Dentro del error de medida
error típico ≤ |Δ| < MDC95      → Posible cambio, no confirmado (conviene repetir)
|Δ| ≥ MDC95                     → Mejora / empeoramiento probable (según el sentido del test)
error desconocido               → se muestran Δ y Δ %, sin veredicto
SWC < error típico              → aviso: test poco sensible para esta persona
```

Cómo se obtiene el error:
- SEM publicado. Si no lo hay, el CV % multiplicado por el valor de partida. Si tampoco, el MDC95 publicado.
- Fórmulas: `MDC95 = 1,96 × √2 × SEM` y `SEM = DE × √(1 − ICC)`.
- **Un ICC sin DE no permite calcular un error absoluto**, así que no da veredicto.
- Conversión exacta entre N y kg (1 kgf = 9,80665 N) cuando la fuente usa otra unidad de fuerza.

Cuándo una fiabilidad publicada se considera de **población similar**: el rango de edad de esa población incluye al cliente y, si la población es de un deporte, coincide con el suyo.

**No se comparan** mediciones con distinto método o dispositivo, ni con distinta versión del protocolo: se indica «no comparable» y no hay veredicto. Cambiar el protocolo de un test crea una versión nueva.

La **tendencia** se calcula solo con 3 o más puntos (pendiente por mínimos cuadrados), con una tolerancia igual al error típico.

### 2.3 Métricas derivadas

| Métrica | Definición | Veredicto de cambio |
|---|---|---|
| IMC | masa / talla². Solo contexto. | No |
| Déficit de COD (por lado) | 505 − sprint de 10 m | Sí, con los errores de ambos tests combinados (√(a² + b²)) |
| Fuerza relativa en sentadilla | 1RM / masa | No |
| Relación CMJ/SJ | CMJ / SJ. Descriptiva. | No |
| Asimetría de cada test por lados | (lado mejor − lado peor) / lado mejor × 100. Descriptiva, **no predice lesiones**. | No |

### 2.4 Valores de referencia (§11.6)
Una referencia solo es **aplicable** si coinciden la edad (rango), el sexo, el deporte y el método de medida. Si no, la UI la muestra como «Referencia de población distinta… no comparable» y explica el motivo.

- El **z-score** solo se calcula con una referencia aplicable de media ± DE. Nunca con escalas de techo ni con percentiles.
- Los **puntos de corte** se dividen en dos tipos:
  - **Descriptivos** (p. ej., 5×STS «peor que la media para su edad»): solo informan.
  - **Criterios clínicos de cribado** (marcados `referral: true`): muestran *Requiere valoración por profesional sanitario* y avisan de que no es un diagnóstico.
  - Los cortes EWGSOP2 **no se cargaron** porque no figuran en el resumen de PubMed (ver anexo).

#### Normas propias del centro (fase 16 de la reestructuración)

- Se importan desde **Informes → Importar → Valores de referencia**, o con «Importar normas del centro» en la ficha del test (CSV o XLSX, con vista previa).
- Cada fila es un grupo de referencia de un test:
  - población del catálogo, edad, sexo, nivel, deporte, N y método;
  - estadístico **media y DE**, **mediana** (con Q1 y Q3 opcionales), **percentiles** (`P10=21|P50=29|P90=37`) o **punto de corte** (valor, dirección y significado);
  - condición, limitaciones y notas de aplicabilidad.
- La **fuente es obligatoria y debe existir ya** (DOI o PMID), del catálogo o del centro. Nunca se inventa: si falta, se registra antes en Ciencia o con la importación de referencias (A59).
- Se validan en la vista previa:
  - test, población y deporte desconocidos;
  - valores que faltan para el estadístico y DE ≤ 0;
  - edad mínima mayor que la máxima;
  - el mismo grupo repetido en el archivo o ya presente en el centro (mismo test, variable, población, sexo, edades y fuente).
- Son **del centro** (RLS de catálogo): otro centro no las ve. La ficha del test las marca «Del centro» y permite eliminarlas; las de la plataforma no se pueden borrar.
- Un **punto de corte importado es siempre descriptivo** (`referral: false`): nunca muestra «Requiere valoración por profesional sanitario» (A60). Ese aviso solo lo dan los criterios clínicos revisados de la plataforma.
- Se usan igual que las de la plataforma: misma comprobación de aplicabilidad (edad, sexo, deporte, población, método) y z-score solo con media y DE aplicable.

### 2.5 Seguridad
- **Síntomas que detienen el test** (§11.7). Se muestran en la pantalla de registro: dolor torácico, disnea desproporcionada, mareo o desmayo, palpitaciones, y dolor agudo, inestabilidad o caída. El intento se marca como **no válido** y no entra en las comparaciones.
- **Propuesta de batería.** El objetivo principal decide la plantilla; a partir de los 65 años se propone la batería de salud.
  - Sin un cribado sin incidencias **no se proponen tests máximos**: 1RM, IMTP, sprints, tests de campo y COD.
  - El cribado se lee **solo con consentimiento de datos de salud**. Sin él cuenta como «sin cribado».
  - No se propone el 1RM directo a principiantes ni a mayores.
  - Cada exclusión lleva su motivo. El entrenador edita la propuesta.

## 3. Catálogo inicial verificado

Las fuentes se buscaron en **PubMed** (conector NCBI):
- Cada fila de fiabilidad o de referencia guarda el **fragmento literal del resumen** que contiene sus cifras.
- Una muestra de 8 fuentes se volvió a contrastar con PubMed antes de importar. Coincidieron en título, DOI y cifras.

| Elemento | Cantidad |
|---|---|
| Tests | 43, con el 1RM separado por ejercicio (sentadilla, banca y peso muerto) para no mezclar series |
| Filas de fiabilidad publicadas | 38 |
| Filas de referencia | 10 |
| Fuentes (como evidencia verificada) | 57 |
| Baterías | 7: hipertrofia y fuerza, salud y función, deporte de equipo, resistencia, sprint y potencia, iniciación, composición corporal |

Ejemplos de datos, según PubMed:

| Dato | Fuente |
|---|---|
| 1RM: ICC mediana 0,97 y CV mediana 4,2 % | Grgic et al., 2020 · [doi:10.1186/s40798-020-00260-z](https://doi.org/10.1186/s40798-020-00260-z) |
| IMTP: ICC mediana 0,96 y CV mediana 4,9 % | Grgic et al., 2021 · [doi:10.5114/biolsport.2022.106149](https://doi.org/10.5114/biolsport.2022.106149) |
| 505: diferencia mínima detectable del 3,97 % (salida lanzada) | Barber et al., 2015 · [doi:10.1123/ijspp.2015-0215](https://doi.org/10.1123/ijspp.2015-0215) |
| Prensión en mayores: error técnico de 15,8 y 21,3 N | Bohannon y Schaubert, 2005 · [doi:10.1197/j.jht.2005.07.003](https://doi.org/10.1197/j.jht.2005.07.003) |
| Referencias descriptivas de 5×STS por edad (11,4 / 12,6 / 14,8 s) | Bohannon, 2006 · [doi:10.2466/pms.103.1.215-222](https://doi.org/10.2466/pms.103.1.215-222) |
| Lunge test: MDC 1,6–1,9 cm y 4,6–4,7° | Powden et al., 2015 |
| SPPB: ICC 0,82–0,92 | Kameniar et al., 2022 · [doi:10.1519/JPT.0000000000000337](https://doi.org/10.1519/JPT.0000000000000337) |

Estado de los tests:
- **Sin fiabilidad que permita un error absoluto** (se muestra «Error de medida desconocido»): composición corporal, sRPE, Hooper, RSI, sprints de 5, 10 y 30 m, T-test, Cooper, ROM de cadera y los tests cuyas fuentes solo dan ICC.
- **Solución recomendada:** registrar el **test-retest del centro** en la ficha del test.
- **Sin referencia aplicable:** se muestra «Referencia insuficiente».

Lo no localizado o no verificado está en `docs/research/assessment_seed_report.md`:
- 5 referencias no localizadas;
- 24 datos no verificados o no aplicables, entre ellos los cortes EWGSOP2, las normas del apoyo monopodal y los estándares de Rikli y Jones.

## 4. Interfaz

| Dónde | Qué |
|---|---|
| `/app/assessments` | Baterías y catálogo por categoría. Cada test indica si tiene fiabilidad y referencias, o «Error de medida desconocido» y «Referencia insuficiente». Formulario para un test propio. |
| `/app/assessments/tests/{id}` | Ficha completa, fiabilidad con DOI/PMID, referencias con población, fuentes y formulario de **test-retest del centro**. |
| Cliente › Evaluaciones | Lista de evaluaciones, **progreso** por test y métricas derivadas, y nueva evaluación con la **propuesta de batería** y sus motivos. |
| `/app/clients/{id}/assessments/{id}` | Registro por intentos (lado, método o dispositivo, validez). Cambio respecto a la evaluación anterior con su veredicto, comparación con referencias, métricas derivadas, banderas y síntomas que detienen el test. |
| App del cliente › Progreso | Lenguaje sencillo («Has mejorado: el cambio supera el margen de error del test»), barras antes/después y línea temporal. |

Gráficos (SVG propio, sin librerías):
- **Barras** para antes y después.
- **Línea temporal** con banda de error alrededor del valor inicial.
- No hay gráficos de radar, porque mezclarían unidades.

## 5. Permisos

| Permiso | ADMIN | TRAINER | CLIENT |
|---|---|---|---|
| `assessments:read` | Organización | Clientes asignados | Solo los suyos (lectura) |
| `assessments:write` | Organización | Clientes asignados | ✗ |
| `assessments:catalog` (tests, baterías, fiabilidad local) | Organización | Organización | ✗ |

Además, RLS: las tablas `assessments`, `assessment_results` y `derived_metrics` son de tipo `client_owned` (el cliente solo lee las suyas) y el catálogo es de tipo `catalog`. Todo cambio queda auditado.

## 6. Pendiente

| Elemento | Fase |
|---|---|
| Revisión de las baterías por personas expertas (propuesta basada en las fichas) | Operación |
| Lectura del texto completo para cargar normas por edad (apoyo monopodal, Rikli y Jones) y los cortes EWGSOP2 | Operación |
| Reevaluaciones planificadas en el plan de entrenamiento | 6 |
| Importación desde dispositivos (plataformas, células, encoders) | 12/15 |
| Informe de evaluación en PDF | 12 |
