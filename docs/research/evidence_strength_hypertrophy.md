# Fase 0 — Base de evidencia: entrenamiento de fuerza (S&C)

Fecha de elaboración: 2026-10-03
Agente: investigación científica (Claude)

## 0. Nota metodológica y limitaciones de verificación (LEER PRIMERO)

- **Entorno de red restringido.** En esta sesión, el proxy de salida bloqueó el acceso directo (WebFetch/curl) a pubmed.ncbi.nlm.nih.gov, pmc.ncbi.nlm.nih.gov, api.crossref.org, doi.org, Europe PMC, OpenAlex, Semantic Scholar, link.springer.com, tandfonline.com y sportrxiv.org. **No fue posible consultar Crossref ni leer abstracts completos directamente.**
- **Método de verificación realmente usado:** WebSearch (motor de búsqueda), con resultados restringidos a pubmed.ncbi.nlm.nih.gov cuando fue posible. Un dato se considera "verificado" sólo si la ficha de PubMed / editorial apareció en los resultados y el título, autores, revista, año y DOI/PMID coincidieron en los resultados devueltos. Los fragmentos numéricos proceden de los resúmenes devueltos por el buscador sobre esas páginas; **deben re-contrastarse con el abstract original antes de mostrarse a usuarios finales**.
- **Presupuesto de búsqueda agotado** (límite de sesión de 200 búsquedas alcanzado) antes de cubrir todos los temas. Las fuentes no verificadas se listan en la sección 9 como **[REQUIERE VERIFICACIÓN]**, sin datos, para no inventar nada.
- Ningún DOI/PMID de este documento ha sido escrito de memoria sin aparecer en un resultado de búsqueda; cuando un campo no apareció, se marca [REQUIERE VERIFICACIÓN].

Escala de nivel de evidencia: A fuerte / B moderada / C limitada / D contradictoria / E mecanismo / F recomendación práctica / G opinión.

---

## 1. Guías generales de entrenamiento de fuerza

### EV-STR-001 — ACSM Position Stand 2026 (overview of reviews)
- **Cita:** Phillips SM (chair), Currier BS, D'Souza AC, Fiatarone Singh MA, et al. [lista completa de autores: REQUIERE VERIFICACIÓN]. American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews. *Med Sci Sports Exerc*. 2026;58:851–872.
- **DOI:** 10.1249/MSS.0000000000003897 (obtenido de la URL de la editorial Ovid/LWW en resultados de búsqueda)
- **PMID:** [REQUIERE VERIFICACIÓN]
- **Tipo:** Position stand basado en *overview of reviews* (137 revisiones sistemáticas, >30.000 participantes).
- **Población:** adultos sanos.
- **Intervención/comparación:** entrenamiento de fuerza (RT) vs. no ejercicio, y comparaciones entre variables de programación.
- **Resultados clave (según comunicado ACSM/Science Spotlight recuperado por búsqueda):**
  - RT vs control mejoró fuerza, hipertrofia, potencia, resistencia muscular, velocidad de contracción, velocidad de marcha, equilibrio y múltiples resultados de función física.
  - Fuerza: mejor con cargas ≥80 % 1RM, rango de movimiento completo, 2–3 series, al inicio de la sesión y ≥2 sesiones/semana.
  - Hipertrofia: favorecida por volúmenes mayores (≥10 series/semana) y sobrecarga excéntrica.
  - Potencia: cargas moderadas (30–70 % 1RM), volumen bajo-moderado (≤24 repeticiones·series), halterofilia y RT de potencia (fase concéntrica rápida).
  - Entrenar hasta el fallo muscular momentáneo, tipo de equipamiento, complejidad del ejercicio, estructura de series, tiempo bajo tensión, restricción de flujo sanguíneo y periodización **no** influyeron de forma consistente en los resultados.
  - Mensaje práctico de ACSM: "el mejor programa es el que se mantiene" (adherencia).
- **Limitaciones:** overview de revisiones (hereda sesgos de las RS primarias; solapamiento de estudios); cifras extraídas de material divulgativo de ACSM, no del abstract leído directamente; población mayoritariamente adultos sanos.
- **Nivel:** **F** (recomendación práctica de sociedad científica) apoyada en evidencia **A/B** según outcome. Criterio: posición oficial basada en síntesis de 137 RS; GRADE por outcome [REQUIERE VERIFICACIÓN].
- **Aplicación:** referencia principal para defaults: ≥2 sesiones/semana; fuerza con cargas pesadas; hipertrofia con ≥10 series/semana/músculo; el fallo no es obligatorio; la periodización no es un requisito.
- **Verificación:** WebSearch (acsm.org, ovid.com, newswise) — 2026-10-03. Abstract original no leído directamente.

### EV-STR-002 — ACSM Position Stand 2009 (progression models)
- **Cita:** American College of Sports Medicine. American College of Sports Medicine position stand. Progression models in resistance training for healthy adults. *Med Sci Sports Exerc*. 2009 Mar;41(3):687–708.
- **DOI:** 10.1249/MSS.0b013e3181915670
- **PMID:** 19204579
- **Tipo:** Position stand (revisión narrativa con graduación de evidencia).
- **Población:** adultos sanos (novatos, intermedios, avanzados).
- **Resultados/recomendaciones clave (verificadas en resultados de búsqueda sobre el texto):** novatos: cargas de 8–12 RM; 1–3 series; 2–3 días/semana. Para hipertrofia con cargas de 6–12 RM, descansos de 1–2 min a velocidad moderada.
- **Limitaciones:** antigua (17 años); sustituida en gran parte por EV-STR-001; muchas recomendaciones basadas en evidencia limitada en entrenados.
- **Nivel:** **F** (guía histórica). Criterio: consenso de sociedad; evidencia subyacente mixta.
- **Aplicación:** sirve como plantilla prudente para principiantes (8–12 RM, 1–3 series, 2–3 días/semana).
- **Verificación:** WebSearch (PubMed + PDFs del texto) — 2026-10-03.

### EV-STR-003 — OMS 2020
- **Cita:** Bull FC, et al. World Health Organization 2020 guidelines on physical activity and sedentary behaviour. *Br J Sports Med*. 2020;54:1451–1462.
- **DOI:** 10.1136/bjsports-2020-102955
- **PMID:** 33239350 (PMC7719906)
- **Tipo:** Guía internacional (OMS, metodología GRADE).
- **Población:** niños, adolescentes, adultos, mayores, embarazo/posparto, enfermedad crónica y discapacidad.
- **Recomendaciones clave:** adultos 150–300 min/semana de actividad moderada o 75–150 min vigorosa; actividades de fortalecimiento muscular a intensidad moderada o mayor que impliquen los grandes grupos musculares ≥2 días/semana. Mayores (≥65): además, ≥3 días/semana de actividad multicomponente con énfasis en equilibrio funcional y fuerza, a intensidad moderada o mayor; limitar el sedentarismo.
- **Limitaciones:** recomendación de salud pública (no de rendimiento); no especifica series/cargas.
- **Nivel:** **F** con respaldo **A/B** (guía GRADE de la OMS).
- **Aplicación:** mínimo de salud por defecto: 2 días/semana de fuerza de todo el cuerpo; en mayores añadir trabajo multicomponente/equilibrio ≥3 días/semana.
- **Verificación:** WebSearch (PubMed, repositorios institucionales) — 2026-10-03.

### EV-STR-004 — NSCA, adultos mayores (Fragala 2019)
- **Cita:** Fragala MS, Cadore EL, Dorgo S, Izquierdo M, Kraemer WJ, Peterson MD, Ryan ED. Resistance Training for Older Adults: Position Statement From the National Strength and Conditioning Association. *J Strength Cond Res*. 2019;33(8):2019–2052.
- **DOI:** 10.1519/JSC.0000000000003230
- **PMID:** 31343601
- **Tipo:** Position statement.
- **Población:** adultos mayores (incluye fragilidad, sarcopenia, enfermedades crónicas).
- **Contenido clave:** 11 aplicaciones prácticas agrupadas en: variables de diseño del programa, adaptaciones fisiológicas, beneficios funcionales y consideraciones para fragilidad/sarcopenia/enfermedad crónica. Una fuente secundaria que cita el documento resume: progresión individualizada y periodizada, buscando 2–3 series por grupo muscular principal con ~2 min de descanso **[cifras REQUIERE VERIFICACIÓN en el texto completo]**.
- **Limitaciones:** documento de consenso; parámetros exactos no verificados en esta sesión.
- **Nivel:** **F**.
- **Aplicación:** justificar RT individualizado y progresivo en mayores, incluido en fragilidad.
- **Verificación:** WebSearch (PubMed 31343601, repositorio UTEP) — 2026-10-03.

### EV-STR-005 — Consenso internacional fuerza en jóvenes (Lloyd 2014)
- **Cita:** Lloyd RS, Faigenbaum AD, Stone MH, et al. Position statement on youth resistance training: the 2014 International Consensus. *Br J Sports Med*. 2014;48(7):498–505.
- **DOI:** 10.1136/bjsports-2013-092952
- **PMID:** 24055781
- **Tipo:** Consenso internacional (adaptado de la posición de la UKSCA; avalado por múltiples organizaciones).
- **Población:** niños y adolescentes.
- **Resultados clave:** [contenido específico REQUIERE VERIFICACIÓN — no se recuperó el abstract].
- **Nivel:** **F**.
- **Aplicación:** soporte para permitir programas juveniles supervisados; los parámetros concretos deben extraerse del texto antes de implementarlos.
- **Verificación:** WebSearch (PubMed) — 2026-10-03 (cita/DOI/PMID verificados; contenido no).

---

## 2. Hipertrofia

### EV-STR-006 — Volumen semanal (Schoenfeld 2017)
- **Cita:** Schoenfeld BJ, Ogborn D, Krieger JW. Dose-response relationship between weekly resistance training volume and increases in muscle mass: A systematic review and meta-analysis. *J Sports Sci*. 2017;35(11):1073–1082 [volumen/páginas: REQUIERE VERIFICACIÓN].
- **DOI:** [REQUIERE VERIFICACIÓN — 10.1080/02640414.2016.1210197 probable, no confirmado en resultados]
- **PMID:** 27433992
- **Tipo:** RS + metaanálisis/meta-regresión.
- **Población:** 15 estudios, 34 grupos de tratamiento.
- **Resultados (abstract vía búsqueda):** series semanales como variable continua: efecto significativo (P = 0,002); cada serie adicional ↑ ES 0,023, equivalente a +0,37 % de ganancia. Volumen mayor vs menor dentro de estudios: diferencia de ES 0,241 (P = 0,03), = 3,9 % de ganancia. Categorías <5, 5–9, 10+ series/músculo/semana: tendencia (P = 0,074).
- **Limitaciones:** pocos estudios; heterogeneidad metodológica; techo del dosis-respuesta no identificable.
- **Nivel:** **B**. Criterio: MA de ensayos controlados, efecto consistente pero pocos estudios y precisión limitada; GRADE no reportado.
- **Aplicación:** más series semanales → algo más de hipertrofia; 10+ series/músculo/semana como objetivo razonable para quien busca hipertrofia.
- **Verificación:** WebSearch (PubMed 27433992) — 2026-10-03.

### EV-STR-007 — Meta-regresiones de volumen y frecuencia (Pelland 2026)
- **Cita:** Pelland JC, Remmert JF, Robinson ZP, Hinson SR, Zourdos MC. The Resistance Training Dose Response: Meta-Regressions Exploring the Effects of Weekly Volume and Frequency on Muscle Hypertrophy and Strength Gains. *Sports Med*. 2026 (feb.) [vol./págs.: REQUIERE VERIFICACIÓN].
- **DOI:** 10.1007/s40279-025-02344-w
- **PMID:** 41343037
- **Tipo:** Meta-regresiones multinivel bayesianas.
- **Población:** 67 estudios, 2058 participantes (79,1 % hombres, 20,9 % mujeres; edad media 25,16 ± 5,22 años).
- **Método relevante:** series clasificadas como directas o indirectas; la cuantificación "fraccional" (serie indirecta = 0,5) tuvo mejor apoyo y se usó en los modelos primarios; ajustados por duración y estado de entrenamiento.
- **Resultados:** probabilidad posterior de pendiente >0 para volumen = 100 % tanto en hipertrofia como en fuerza; ambos modelos muestran rendimientos decrecientes, mucho más marcados para fuerza. Frecuencia: efecto consistentemente identificable sólo en fuerza; en hipertrofia la probabilidad posterior <100 % (compatible con efectos despreciables).
- **Limitaciones:** población joven y mayoritariamente masculina; intervenciones cortas; volumen "fraccional" es una convención.
- **Nivel:** **B** (posiblemente A para "más volumen → más hipertrofia con retornos decrecientes"). Criterio: MA grande, resultados direccionalmente consistentes con EV-STR-006; GRADE no reportado.
- **Aplicación:** contar series indirectas (p. ej., press para tríceps) como 0,5; para fuerza, el volumen extra rinde poco y la frecuencia/especificidad importa más; para hipertrofia la frecuencia es sobre todo una herramienta de distribución del volumen.
- **Verificación:** WebSearch (PubMed 41343037, Springer, Semantic Scholar) — 2026-10-03.

### EV-STR-008 — Frecuencia (Schoenfeld 2016)
- **Cita:** Schoenfeld BJ, Ogborn D, Krieger JW. Effects of Resistance Training Frequency on Measures of Muscle Hypertrophy: A Systematic Review and Meta-Analysis. *Sports Med*. 2016;46(11):1689–1697 [págs.: REQUIERE VERIFICACIÓN].
- **DOI:** 10.1007/s40279-016-0543-8
- **PMID:** 27102172
- **Tipo:** RS + MA (10 estudios).
- **Resultados:** efecto significativo de la frecuencia (P = 0,002): ES 0,49 ± 0,08 (mayor frecuencia) vs 0,30 ± 0,07 (menor). No se pudo analizar frecuencia de sesión con frecuencia por grupo muscular igualada (muestra insuficiente).
- **Limitaciones:** volumen no siempre igualado; pocos estudios; superado por EV-STR-009.
- **Nivel:** **C** (superado; resultados confundidos por volumen).
- **Aplicación:** ≥2 veces/semana por grupo muscular como default razonable.
- **Verificación:** WebSearch (PubMed) — 2026-10-03.

### EV-STR-009 — Frecuencia (Schoenfeld 2019)
- **Cita:** Schoenfeld BJ, Grgic J, Krieger J. How many times per week should a muscle be trained to maximize muscle hypertrophy? A systematic review and meta-analysis of studies examining the effects of resistance training frequency. *J Sports Sci*. 2019;37(11):1286–1295.
- **DOI:** 10.1080/02640414.2018.1555906 (confirmado en un resultado de búsqueda; no confirmado en Crossref)
- **PMID:** 30558493
- **Tipo:** RS + MA (25 estudios).
- **Resultados:** sin diferencia significativa entre frecuencias alta y baja con volumen igualado; en estudios sin volumen igualado, la meta-regresión favoreció frecuencias altas, pero la diferencia entre 1 y 3+ días/semana fue modesta. Conclusión: con un volumen dado, la frecuencia puede elegirse por preferencia.
- **Limitaciones:** mayoría de estudios cortos; heterogeneidad en medición de hipertrofia.
- **Nivel:** **B**. Criterio: MA de ECA con resultados consistentes con EV-STR-007.
- **Aplicación:** la frecuencia es configurable según la logística; repartir el volumen en ≥2 sesiones es práctico cuando el volumen es alto.
- **Verificación:** WebSearch (PubMed 30558493 + registro bibliográfico con DOI) — 2026-10-03.

### EV-STR-010 — Proximidad al fallo e hipertrofia (Refalo 2023)
- **Cita:** Refalo MC, Helms ER, Trexler ET, Hamilton DL, Fyfe JJ. Influence of Resistance Training Proximity-to-Failure on Skeletal Muscle Hypertrophy: A Systematic Review with Meta-analysis. *Sports Med*. 2023;53(3):649–665 (online 5 nov. 2022).
- **DOI:** 10.1007/s40279-022-01784-y
- **PMID:** [REQUIERE VERIFICACIÓN] (PMCID: PMC9935748)
- **Tipo:** RS + MA (15 estudios).
- **Población:** adultos sanos.
- **Comparaciones:** (A) fallo muscular momentáneo vs no-fallo; (B) fallo de serie vs no-fallo; (C) distintos umbrales de pérdida de velocidad.
- **Resultados:** ventaja trivial del fallo de serie vs no-fallo: ES 0,19 (IC95 % 0,00–0,37), sin moderación por volume load ni carga relativa. Sin ventaja del fallo momentáneo vs no-fallo; umbrales altos de pérdida de velocidad no siempre producen más hipertrofia → posible relación no lineal.
- **Limitaciones:** definiciones heterogéneas de "fallo"; pocos estudios por comparación; mayoría con no entrenados.
- **Nivel:** **B**. Criterio: MA de ECA; efecto pequeño/impreciso.
- **Aplicación:** no es necesario entrenar al fallo para hipertrofia; acercarse (pocas RIR) es suficiente.
- **Verificación:** WebSearch (PMC, repositorios AUT/Deakin) — 2026-10-03.

### EV-STR-011 — Dosis-respuesta de RIR estimado (Robinson 2024)
- **Cita:** Robinson ZP, Pelland JC, Remmert JF, Refalo MC, Jukic I, Steele J, et al. Exploring the Dose–Response Relationship Between Estimated Resistance Training Proximity to Failure, Strength Gain, and Muscle Hypertrophy: A Series of Meta-Regressions. *Sports Med*. 2024;54(9):2209–2231.
- **DOI:** 10.1007/s40279-024-02069-2
- **PMID:** [REQUIERE VERIFICACIÓN]
- **Tipo:** Serie de meta-regresiones.
- **Resultados:** hipertrofia: pendientes marginales de RIR estimado negativas y con IC que no incluían el nulo → más hipertrofia cuanto más cerca del fallo. Fuerza: IC incluían el nulo → relación despreciable con el RIR.
- **Limitaciones:** RIR **estimado** a posteriori por los autores (no medido); materiales abiertos en OSF.
- **Nivel:** **B** (hipertrofia) / **C** (fuerza, ausencia de efecto). Criterio: meta-regresión con exposición estimada.
- **Aplicación:** para hipertrofia, RIR bajo (≈0–3) es preferible; para fuerza se puede dejar más margen sin pérdida aparente.
- **Verificación:** WebSearch (Springer, repositorio Abertay) — 2026-10-03.

### EV-STR-012 — Carga baja vs alta (Schoenfeld 2017)
- **Cita:** Schoenfeld BJ, Grgic J, Ogborn D, Krieger JW. Strength and Hypertrophy Adaptations Between Low- vs. High-Load Resistance Training: A Systematic Review and Meta-analysis. *J Strength Cond Res*. 2017;31(12):3508–3523.
- **DOI:** 10.1519/JSC.0000000000002200
- **PMID:** 28834797
- **Tipo:** RS + MA.
- **Resultados:** conclusión general (verificada sólo de forma cualitativa): mayores ganancias de 1RM con cargas altas; hipertrofia similar entre cargas bajas y altas cuando las series se llevan cerca del fallo. **Cifras del abstract: REQUIERE VERIFICACIÓN** (no se recuperaron con fiabilidad).
- **Limitaciones:** mayoría de estudios hasta el fallo; pocos en entrenados.
- **Nivel:** **B**.
- **Aplicación:** para hipertrofia el sistema puede ofrecer un amplio rango de cargas (si el esfuerzo es alto); para fuerza máxima priorizar cargas altas (coherente con EV-STR-001: ≥80 % 1RM).
- **Verificación:** WebSearch (PubMed) — 2026-10-03.

---

## 3–7. Temas con verificación incompleta

Por las restricciones descritas en §0 no se pudieron verificar las fuentes específicas de: fuerza máxima (Currier 2023, Androulakis-Korakakis, Moesgaard 2022, Williams 2017, Bell 2023 deload), autorregulación (Zourdos 2016, Helms 2016, Halperin 2022, Pareja-Blanco 2017, Jukic 2023, Weakley 2021, Greig 2023), entrenamiento concurrente (Wilson 2012, Schumann 2022), sarcopenia (Izquierdo 2021 ICFSR) y lesiones (Lauersen 2014). Véase §9.

### Fuentes parcialmente verificadas (título + PMID vistos en un listado de PubMed; resto de campos sin verificar)
No usar datos de estas fuentes hasta completar la verificación.

| ID | Título (tal como apareció en PubMed) | PMID | Campos pendientes |
|---|---|---|---|
| EV-STR-P01 | Give it a rest: a systematic review with Bayesian meta-analysis on the effect of inter-set rest interval duration on muscle hypertrophy (probablemente Singer et al. 2024) | 39205815 | autores, revista, año, DOI, resultados |
| EV-STR-P02 | Influence of resistance training load on measures of skeletal muscle hypertrophy and improvements in maximal strength and neuromuscular task performance: A systematic review and meta-analysis (probablemente Lopez et al. 2021) | 33874848 | autores, revista, año, DOI, resultados |
| EV-STR-P03 | One Velocity Loss Threshold Does Not Fit All: Consideration of Sex, Training Status, History, and Personality Traits When Monitoring and Controlling Fatigue During Resistance Training | 37668949 | todo salvo título/PMID |
| EV-STR-P04 | Effects of Resistance Training Volume on Physical Function, Lean Body Mass and Lower-Body Muscle Hypertrophy and Strength in Older Adults: A Systematic Review and Network Meta-analysis of 151 Randomised Trials | 39405023 | todo salvo título/PMID |
| EV-STR-P05 | Methods for Controlling and Reporting Resistance Training Proximity to Failure: Current Issues and Future Directions | 35247203 | todo salvo título/PMID |
| EV-STR-P06 | Dose-Response Relationship of Weekly Resistance-Training Volume and Frequency on Muscular Adaptations in Trained Men | 30160627 | todo salvo título/PMID |
| EV-STR-P07 | A meta-regression of the effects of resistance training frequency on muscular strength and hypertrophy in adults over 60 years of age | 32948100 | todo salvo título/PMID |
| EV-STR-P08 | The Effects of Advanced Resistance Training Prescription Methods on Strength, Power, Hypertrophy, and Performance Adaptations in Healthy Adults: A Systematic Review and Bayesian Network Meta-analysis | 41951916 | todo salvo título/PMID |
| EV-STR-P09 | Reliability, Device Agreement and Validity of Load-Velocity Profiles: A Systematic Review with Meta-analysis | 42690493 | todo salvo título/PMID |
| EV-STR-P10 | Effects of Resistance Training on Physical Fitness in Healthy Children and Adolescents: An Umbrella Review | 32757164 | todo salvo título/PMID |
| EV-STR-P11 | Effects and dose-response relationships of resistance training on physical performance in youth athletes: a systematic review and meta-analysis | 26851290 | todo salvo título/PMID |

---

## 8. Síntesis por tema

### 8.1 Guías generales
- **Razonablemente establecido:** el RT mejora fuerza, masa muscular, potencia y función física en adultos sanos (EV-STR-001). Mínimo de salud pública: fortalecimiento muscular de grandes grupos ≥2 días/semana (EV-STR-003). Mayores: añadir actividad multicomponente ≥3 días/semana (EV-STR-003); RT individualizado y progresivo también en fragilidad (EV-STR-004).
- **Incierto:** utilidad diferencial de la periodización, la estructura de series y el tiempo bajo tensión (sin efecto consistente según EV-STR-001).
- **Defaults configurables (no reglas universales):** frecuencia 2–3 sesiones/semana de cuerpo completo para principiantes; 8–12 RM, 1–3 series por ejercicio al inicio (EV-STR-002); progresión gradual.
- **Matices poblacionales:** jóvenes → programas supervisados según consenso (EV-STR-005; parámetros pendientes); mayores y personas con enfermedad crónica → cribado y supervisión.

### 8.2 Hipertrofia
- **Establecido:** relación dosis-respuesta positiva del volumen con rendimientos decrecientes (EV-STR-006, -007, -001: ≥10 series/semana). Con volumen igualado, la frecuencia apenas importa (EV-STR-009, -007). El fallo no es necesario; acercarse a él sí parece importar (EV-STR-010, -011). Hipertrofia similar con un amplio espectro de cargas si el esfuerzo es alto (EV-STR-012).
- **Incierto:** techo del volumen útil; volumen por sesión; tiempo de descanso (EV-STR-P01 pendiente); entrenamiento a longitudes musculares largas (no verificado).
- **Defaults configurables:** 10–20 series directas/músculo/semana para usuarios orientados a hipertrofia con experiencia (empezar más bajo, p. ej. ~6–10, en principiantes — extrapolación, nivel F); series indirectas contadas como 0,5; RIR objetivo 0–3 (fallo opcional, mejor evitarlo en ejercicios multiarticulares complejos — criterio práctico, nivel G); frecuencia ≥2/semana por grupo muscular cuando el volumen sea alto; rango de carga amplio (p. ej., 5–30 repeticiones) siempre que el RIR sea bajo — rango concreto no verificado en esta sesión, nivel F/G.
- **Matices:** la evidencia procede sobre todo de hombres jóvenes (EV-STR-007: 79 % hombres, ~25 años).

### 8.3 Fuerza máxima
- **Establecido (parcial):** cargas ≥80 % 1RM, 2–3 series, ≥2 sesiones/semana, rango completo, ejercicios prioritarios al inicio (EV-STR-001). Rendimientos decrecientes del volumen mucho más marcados que para hipertrofia; la frecuencia sí muestra efecto (EV-STR-007). La proximidad al fallo apenas influye en la fuerza (EV-STR-011). Cargas altas > bajas para 1RM (EV-STR-012).
- **Incierto:** periodización y tapering/deload (fuentes no verificadas; EV-STR-001 no halla efecto consistente de la periodización).
- **Defaults configurables:** ejercicio principal 2–3 series a ≥80 % 1RM (≈1–6 rep), RIR 1–3, 2–3 exposiciones/semana del patrón.

### 8.4 Esfuerzo/autorregulación (RIR, VBT)
- Sin fuentes verificadas en esta sesión más allá de EV-STR-010/011 (umbrales de pérdida de velocidad no siempre dan más hipertrofia). Precisión de las estimaciones de RIR, validez de predicción de 1RM por velocidad y umbrales de pérdida de velocidad: **[REQUIERE VERIFICACIÓN]**. Recomendación de diseño: tratar RIR/VBT como entradas opcionales con margen de error, no como medidas exactas.

### 8.5 Entrenamiento concurrente
- **[REQUIERE VERIFICACIÓN]** — no se verificó ninguna fuente. No implementar penalizaciones de "interferencia" con valores numéricos hasta verificarlo.

### 8.6 Principiantes / mayores / desentrenados
- **Establecido:** OMS ≥2 días/semana fuerza; mayores ≥3 días/semana multicomponente (EV-STR-003); NSCA respalda RT individualizado incluso en fragilidad (EV-STR-004); ACSM 2009 novatos 8–12 RM, 1–3 series, 2–3 días/semana (EV-STR-002).
- **Pendiente:** dosis mínima eficaz, recomendaciones ICFSR para sarcopenia/fragilidad, metaanálisis en red de volumen en mayores (EV-STR-P04).
- **Defaults configurables:** 2 sesiones/semana, cuerpo completo, 1–2 series por ejercicio al inicio, RIR 3–4 en las primeras semanas (criterio práctico, nivel G), progresión gradual.

### 8.7 Lesiones
- **No se verificó ninguna fuente** (Lauersen 2014 incluido). **Regla de producto:** la plataforma **no debe afirmar que el entrenamiento de fuerza "previene lesiones"** como hecho; como máximo, tras verificar las fuentes, se podrá decir que la evidencia sugiere una asociación con menor riesgo en algunos contextos deportivos, con limitaciones.

---

## 9. Fuentes solicitadas NO verificadas en esta sesión [REQUIERE VERIFICACIÓN]
No se incluyen datos, DOI ni PMID para no inventarlos.
- Wolf et al. 2023 / Pedrosa et al. — entrenamiento a longitudes musculares largas.
- Singer et al. 2024 — descansos entre series (ver EV-STR-P01).
- Lopez et al. 2021 — carga e hipertrofia/fuerza (ver EV-STR-P02).
- Currier et al. 2023 (BJSM, metaanálisis en red de prescripción de fuerza).
- Androulakis-Korakakis et al. — dosis mínima para fuerza máxima.
- Moesgaard et al. 2022; Williams et al. 2017 — periodización.
- Bell et al. 2023 — consenso sobre deload.
- Zourdos et al. 2016; Helms et al. 2016 — escala RPE basada en RIR.
- Halperin et al. 2022 — precisión de las predicciones de RIR.
- Pareja-Blanco et al. 2017 — pérdida de velocidad 20 % vs 40 %.
- Jukic et al. 2023 — metaanálisis sobre pérdida de velocidad.
- Weakley et al. 2021 — revisión sobre VBT.
- Greig et al. 2023 — predicción de 1RM por perfil carga-velocidad (IPD).
- Wilson et al. 2012; Schumann et al. 2022 — entrenamiento concurrente.
- Izquierdo et al. 2021 (ICFSR) — recomendaciones de ejercicio en sarcopenia/fragilidad.
- Lauersen et al. 2014 — entrenamiento y prevención de lesiones deportivas.

## 10. Recuento
- **Verificadas (cita + DOI y/o PMID confirmados en resultados de búsqueda):** 12 (EV-STR-001 a EV-STR-012). Campos pendientes dentro de ellas: PMID de 001, 010 y 011; DOI de 006; contenido detallado de 005 y cifras de 004 y 012.
- **Parcialmente verificadas (sólo título + PMID):** 11 (EV-STR-P01 a P11).
- **No verificadas:** 17 fuentes solicitadas (§9).
- **Siguiente paso recomendado:** repetir la verificación con acceso a PubMed E-utilities y a Crossref habilitado (o con un presupuesto de búsqueda mayor) para completar los temas 3–7.
