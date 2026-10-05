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
