# Sistema de informes

> Cubre los §16–§17 del encargo. Reutiliza el motor actual (`REPORTS.md`):
> - **instantánea congelada** con hash: el informe no cambia aunque cambien los datos;
> - un único **modelo de bloques** (texto, lista, tabla, gráfico) que dibujan igual la pantalla, el PDF, el Excel y el CSV;
> - descargas auditadas;
> - versión para el cliente en lenguaje sencillo.

## 1. Tipos de informe

| Tipo | Para quién | Contenido principal |
|---|---|---|
| **Técnico** | Equipo | Todo: datos, resultados, referencias, Z, radar, evolución, interpretación, recomendaciones, fuentes |
| **Para cliente** | Cliente | Lenguaje sencillo, sin tablas técnicas (ya existe; se comparte desde la app) |
| **Inicial** | Equipo / cliente | Primera evaluación: punto de partida, fortalezas, aspectos a mejorar, objetivo y plan propuesto |
| **Seguimiento** | Equipo / cliente | Periodo: adherencia, feedback, cambios desde la evaluación anterior, ajustes del plan |
| **Comparativo** | Equipo | Evaluación A vs B (vs referencia): tabla, %, cambio real, radar superpuesto, evolución |
| **Final** | Equipo / cliente | Cierre de un programa: inicio vs final, objetivos cumplidos, recomendaciones de continuidad |
| **Rendimiento** | Equipo / club | Z frente al equipo o la referencia, bandas y radar. Con selección de jugadores: informe grupal (N, media, DT, máx., mín., mejor, peor) |
| **Readaptación / RTP** | Equipo responsable | Lesión, fases y fechas, criterios con estado y evidencia, comparativa por fases, síntomas, exposición. **Nunca dice «apto»**: el estado máximo es «Listo para valoración», más la decisión registrada si existe |

## 2. Bloques disponibles

Cada tipo combina estos bloques; el entrenador puede quitar o añadir secciones antes de generar.

| Bloque | Origen |
|---|---|
| Datos | Ficha del cliente, perfil y nivel |
| Resultados | Evaluaciones (resultado según la regla del test) |
| Referencias | `reference_values` usadas, con población y fuente |
| Z-scores y bandas | `EVALUATION_SYSTEM.md` §3 |
| Radar | SVG en pantalla; dibujo vectorial en el PDF (pdfkit) |
| Evolución | Gráfico por variable y cambio real |
| Fortalezas / aspectos a mejorar | Generados de las bandas, coherentes con el Z |
| Interpretación | Reglas: cambio frente al error, bandas, asimetrías con su umbral orientativo. Sin diagnóstico |
| Recomendaciones | Las escribe el entrenador; las sugerencias aceptadas del motor aparecen con su fuente |
| Observaciones | Texto libre del entrenador |

## 3. Formatos

| Formato | Uso |
|---|---|
| PDF | Reproducible byte a byte; con radar y gráficos vectoriales; estilo de ficha (cabecera, bloques, tablas) inspirado en los documentos del usuario |
| XLSX | Una hoja por sección y una hoja de datos con los valores numéricos; fórmulas neutralizadas frente a inyección |
| CSV | Tabla plana de resultados |

## 4. Informe comparativo (§17)

Selector: **CLIENTE ▾ · EVALUACIÓN A ▾ · EVALUACIÓN B ▾ · REFERENCIA ▾**.

Referencias posibles:
- **Ninguna**;
- **media del equipo** (grupo elegido);
- **referencia normativa** del test;
- **referencia personalizada**.

Resultado: tabla comparativa, cambios absolutos y %, cambio real (MDC), radar A/B/referencia, gráficos de evolución e interpretación.

## 5. Reglas

- **Frases prohibidas**: el informe nunca escribe «previene lesiones» si la fuente solo respalda un cambio en un factor de riesgo (`SCIENCE_SYSTEM.md` §3). Tampoco escribe «apto» ni diagnósticos.
- **Datos de salud** (dolor, lesiones, cribado): solo con consentimiento. Si no lo hay, el bloque lo dice.
- **Historial**: un informe generado no se modifica. Si los datos cambian, se genera otro.

## 6. Implementación (reestructuración, fase 6)

- **Tipos** (`packages/domain/src/reports/kinds.ts`). Cada tipo es una función pura de su instantánea congelada y devuelve el mismo modelo de bloques, ahora con el bloque `radar`. Así la pantalla, el PDF, el Excel y el CSV muestran lo mismo y el PDF sale idéntico byte a byte.

  | Tipo | Instantánea | Secciones |
  |---|---|---|
  | Técnico | Periodo (`ReportInput`) | Las 11 de `REPORTS.md` |
  | Para el cliente | Periodo | Versión en lenguaje sencillo |
  | Inicial | Periodo + perfil en la primera evaluación del periodo | Datos, objetivos, evaluación inicial, perfil (radar), fortalezas y aspectos a mejorar, plan propuesto, recomendaciones, reevaluación |
  | Seguimiento | Periodo + última evaluación del periodo frente a la anterior | Datos, adherencia, feedback, cambios, interpretación, plan y ajustes, recomendaciones, reevaluación |
  | Comparativo | Comparación A/B con referencia (grupo, normativa o ninguna) y evolución | Qué se compara, resultados A y B (radar y tablas), evolución, interpretación, observaciones |
  | Final | Periodo + primera frente a última evaluación + estado de los objetivos | Datos, objetivos, inicio frente a final, evolución, interpretación, adherencia, continuidad |
  | Rendimiento (grupo) | Informe grupal de una fecha + personas elegidas | Grupo, resumen (N, media, referencia, DT, máx., mín., mejor, peor), Z con bandas, una ficha por persona (radar de dimensiones frente al grupo, fortalezas, aspectos a mejorar) y notas |
  | Readaptación / vuelta a la competición | Consentimiento, lesión declarada, molestias de los últimos 6 meses y tests antes y después de la lesión | Lesión, síntomas, tests, estado («Listo para valoración» como máximo; la decisión es del profesional) y observaciones |

- **Fortalezas y aspectos a mejorar** salen de la banda de cada puntuación: Z > +1, o percentil > 84, es una fortaleza; Z < −1 es un aspecto a mejorar. Un mismo número nunca aparece en las dos listas (test de propiedades).
- **Frases prohibidas** (`language.ts`):
  - no se puede decir «previene / evita lesiones» ni «reduce el riesgo de lesión» si la evidencia no midió la incidencia de lesiones;
  - nunca «apto», «alta deportiva» ni «alta médica»;
  - nada de diagnósticos ni de promesas («diagnóstico de», «padece», «cura», «garantiza»).

  El motor nunca las escribe: un test recorre todos los tipos. Si el texto libre del entrenador las usa, el informe no se genera y se explica el motivo.
- **Radar en el PDF**: dibujado con vectores (pdfkit), con las mismas reglas que en pantalla:
  - A en línea discontinua y B en línea continua con relleno suave;
  - el anillo neutro destacado;
  - un hueco donde falta un dato;
  - la leyenda.

  En pantalla se usa el mismo componente SVG que la comparativa.
- **Compartir**: solo los tipos de periodo (técnico, para el cliente, inicial, seguimiento y final), y el cliente los ve en lenguaje sencillo. El comparativo, el de rendimiento y el de readaptación son solo para el equipo.
- **Rendimiento**: es un informe sin cliente (`client_id` nulo), así que por la RLS solo lo ve el equipo técnico de la organización.
  - Además, como contiene datos de varias personas, solo lo abre (y lo ve en la lista) un ADMIN o un entrenador que tenga acceso a **todas** ellas.
  - El listado no devuelve los identificadores de esas personas. Se genera desde el informe grupal de la fecha: «Generar informe de rendimiento».
- **Pendiente para la fase 7**: el informe de readaptación tendrá fases, criterios con su estado y evidencia, y exposición, cuando exista el módulo de lesiones. Hoy recoge lo que ya se registra: lesión declarada, molestias y tests.
- **Referencia personalizada** en el comparativo (por ejemplo, el objetivo de la temporada): pendiente; hoy hay grupo, normativa o ninguna.
