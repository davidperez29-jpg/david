# Base de datos de tests de evaluación — Fase 0 (Assessment Engine)

Fecha de elaboración: 2026-10-03
Estado: borrador de investigación. **No usar en producción sin revisión por un profesional cualificado.**

---

## 0. Método de verificación y limitaciones de esta sesión (LEER PRIMERO)

- **Entorno:** en esta sesión el acceso directo (WebFetch/curl) a PubMed, PMC, Europe PMC, Crossref (api.crossref.org) y doi.org estaba **bloqueado por el proxy de red**. La única vía disponible fue **WebSearch** (resultados con URL + resumen). Además, el cupo de búsquedas se agotó antes de cubrir todos los tests.
- **Qué significa "verificado" aquí:**
  - **PMID verificado** = apareció una URL `pubmed.ncbi.nlm.nih.gov/<PMID>/` cuyo título coincidía con el artículo.
  - **DOI verificado** = apareció en un resultado (URL de editorial `link.springer.com/...`, `doi.org/...`, o metadato de un repositorio/editorial) para ese artículo.
  - **Datos numéricos (ICC, CV, SEM, MDC, valores de referencia)** = proceden del resumen (abstract) del artículo tal como lo devolvió la búsqueda. **No se han leído textos completos ni tablas.** Antes de producción, contrastar cada cifra con el PDF original.
- Todo lo no confirmado lleva **[REQUIERE VERIFICACIÓN]** o **Referencia insuficiente**. Valores "de dominio público" (p. ej., cortes de IMC de la OMS) se marcan igualmente como no verificados si no se confirmaron en esta sesión.
- Ninguna cifra de este documento procede de memoria sin marcar.

Leyenda: ✅ verificado en sesión · ⚠️ parcialmente verificado · ❌ [REQUIERE VERIFICACIÓN]

---

## 1. Registro de referencias (REF)

| REF | Cita (autores, año, título, revista, vol(n):págs) | DOI | PMID | Estado |
|---|---|---|---|---|
| REF-001 | Hopkins WG (2000). Measures of reliability in sports medicine and science. *Sports Med* 30(1):1-15 | 10.2165/00007256-200030010-00001 ✅ | 10907753 ✅ | ✅ |
| REF-002 | Weir JP (2005). Quantifying test-retest reliability using the intraclass correlation coefficient and the SEM. *J Strength Cond Res* 19(1):231-240 | 10.1519/15184.1 ✅ | 15705040 ✅ | ✅ |
| REF-003 | Grgic J, Lazinica B, Schoenfeld BJ, Pedisic Z (2020). Test-retest reliability of the one-repetition maximum (1RM) strength assessment: a systematic review. *Sports Med Open* | 10.1186/s40798-020-00260-z ✅ | 32681399 ✅ | ✅ |
| REF-004 | LeSuer DA, McCormick JH, Mayhew JL, Wasserstein RL, Arnold MD (1997). The accuracy of prediction equations for estimating 1-RM performance in the bench press, squat, and deadlift. *J Strength Cond Res* 11(4):211-213 | ❌ [REQUIERE VERIFICACIÓN] | ❌ [REQUIERE VERIFICACIÓN] | ⚠️ (cita y hallazgos vía fuente secundaria) |
| REF-005 | Greig L, et al. (2023). The predictive validity of individualised load-velocity relationships for predicting 1RM: a systematic review and individual participant data meta-analysis. *Sports Med* | 10.1007/s40279-023-01854-9 ✅ | 37493929 ✅ | ✅ |
| REF-006 | Grgic J, Scapec B, Mikulic P, Pedisic Z (2022). Test-retest reliability of isometric mid-thigh pull maximum strength assessment: a systematic review. *Biol Sport* 39(2):407-414 | 10.5114/biolsport.2022.106149 ✅ | 35309521 ✅ | ✅ |
| REF-007 | Dodds RM, et al. (2014). Grip strength across the life course: normative data from twelve British studies. *PLoS One* 9(12):e113637 | 10.1371/journal.pone.0113637 ✅ | 25474696 ✅ | ✅ |
| REF-008 | Cruz-Jentoft AJ, Bahat G, Bauer J, et al. (2019). Sarcopenia: revised European consensus on definition and diagnosis (EWGSOP2). *Age Ageing* 48(1):16-31 | 10.1093/ageing/afy169 ✅ | ❌ [REQUIERE VERIFICACIÓN] (una fuente secundaria indicó 31081853, que podría corresponder a una fe de erratas; no confirmado) | ⚠️ |
| REF-009 | Ebben WP, Petushek EJ (2010). Using the reactive strength index modified to evaluate plyometric performance. *J Strength Cond Res* 24(8):1983-1987 | 10.1519/JSC.0b013e3181e72466 ✅ | 20634740 ✅ | ✅ |
| REF-010 | Balsalobre-Fernández C, Glaister M, Lockey RA (2015). The validity and reliability of an iPhone app for measuring vertical jump performance. *J Sports Sci* 33(15):1574-1579 | 10.1080/02640414.2014.996184 ✅ | 25555023 ✅ | ✅ |
| REF-011 | Marković G, Dizdar D, Jukić I, Cardinale M (2004). Reliability and factorial validity of squat and countermovement jump tests. *J Strength Cond Res* 18(3):551-555 | ❌ [REQUIERE VERIFICACIÓN] | 15320660 ✅ | ⚠️ |
| REF-012 | Bishop C, Turner A, Read P (2018). Effects of inter-limb asymmetries on physical and sports performance: a systematic review. *J Sports Sci* | 10.1080/02640414.2017.1361894 ✅ | ❌ [REQUIERE VERIFICACIÓN] | ⚠️ |
| REF-013 | Haugen T, Buchheit M (2016). Sprint running performance monitoring: methodological and practical considerations. *Sports Med* 46(5):641-656 | 10.1007/s40279-015-0446-0 ✅ | ❌ [REQUIERE VERIFICACIÓN] | ⚠️ |
| REF-014 | Nimphius S, Callaghan SJ, Spiteri T, Lockie RG (2016). Change of direction deficit: a more isolated measure of change of direction performance than total 505 time. *J Strength Cond Res* 30(11):3024-3032 | 10.1519/JSC.0000000000001421 ✅ | ❌ [REQUIERE VERIFICACIÓN] | ⚠️ |
| REF-015 | Haj Sassi R, Dardouri W, Haj Yahmed M, Gmada N, Mahfoudhi ME, Gharbi Z (2009). Relative and absolute reliability of a modified agility T-test and its relationship with vertical jump and straight sprint. *J Strength Cond Res* 23(6):1644-1651 | ❌ [REQUIERE VERIFICACIÓN] | 19675502 ✅ | ⚠️ |
| REF-016 | Bangsbo J, Iaia FM, Krustrup P (2008). The Yo-Yo intermittent recovery test: a useful tool for evaluation of physical performance in intermittent sports. *Sports Med* 38(1):37-51 | 10.2165/00007256-200838010-00004 ✅ | ❌ [REQUIERE VERIFICACIÓN] | ⚠️ |
| REF-017 | Buchheit M (2008). The 30-15 intermittent fitness test: accuracy for individualizing interval training of young intermittent sport players. *J Strength Cond Res* 22(2):365-374 | 10.1519/JSC.0b013e3181635b2e ✅ | 18550949 ✅ | ✅ |
| REF-018 | ATS Committee on Proficiency Standards for Clinical Pulmonary Function Laboratories (2002). ATS statement: guidelines for the six-minute walk test. *Am J Respir Crit Care Med* 166(1):111-117 | ❌ [REQUIERE VERIFICACIÓN] (existe una corrección en 10.1164/ajrccm.167.9.950 según atsjournals.org) | ❌ [REQUIERE VERIFICACIÓN] | ⚠️ |
| REF-019 | Enright PL, Sherrill DL (1998). Reference equations for the six-minute walk in healthy adults. *Am J Respir Crit Care Med* 158(5):1384-1387 | 10.1164/ajrccm.158.5.9710086 ✅ | 9817683 ✅ | ✅ |
| REF-020 | Rikli RE, Jones CJ (2013). Development and validation of criterion-referenced clinically relevant fitness standards for maintaining physical independence in later years. *Gerontologist* 53(2):255-267 | ❌ [REQUIERE VERIFICACIÓN] | 22613940 ✅ | ⚠️ |
| REF-021 | Rikli RE, Jones CJ (1999). Functional fitness normative scores for community-residing older adults, ages 60-94. *J Aging Phys Act* | ❌ [REQUIERE VERIFICACIÓN] | ❌ [REQUIERE VERIFICACIÓN] | ⚠️ (vol/págs no verificados) |
| REF-022 | Guralnik JM, Simonsick EM, Ferrucci L, et al. (1994). A short physical performance battery assessing lower extremity function: association with self-reported disability and prediction of mortality and nursing home admission. *J Gerontol* 49(2):M85-M94 | 10.1093/geronj/49.2.M85 ✅ | 8126356 ✅ | ✅ |
| REF-023 | Springer BA, Marin R, Cyhan T, Roberts H, Gill NW (2007). Normative values for the unipedal stance test with eyes open and closed. *J Geriatr Phys Ther* 30(1):8-15 | ❌ [REQUIERE VERIFICACIÓN] | 19839175 ✅ | ⚠️ (coautores tras Springer no verificados) |
| REF-024 | Powden CJ, Hoch JM, Hoch MC (2015). Reliability and minimal detectable change of the weight-bearing lunge test: a systematic review. *Man Ther* 20(4):524-532 | 10.1016/j.math.2015.01.004 ✅ | 25704110 ✅ | ✅ |
| REF-025 | Foster C, Florhaug JA, Franklin J, et al. (2001). A new approach to monitoring exercise training. *J Strength Cond Res* 15(1):109-115 | ❌ [REQUIERE VERIFICACIÓN] | 11708692 ✅ | ⚠️ |
| REF-026 | McLean BD, Coutts AJ, Kelly V, McGuigan MR, Cormack SJ (2010). Neuromuscular, endocrine, and perceptual fatigue responses during different length between-match microcycles in professional rugby league players. *Int J Sports Physiol Perform* 5(3):367-383 | ❌ [REQUIERE VERIFICACIÓN] | 20861526 ✅ | ⚠️ |
| REF-027 | Hooper SL, Mackinnon LT (1995). Monitoring overtraining in athletes. Recommendations. *Sports Med* 20(5):321-327 | ❌ [REQUIERE VERIFICACIÓN] | 8571005 ✅ | ⚠️ |
| REF-028 | Impellizzeri FM, Tenan MS, Kempton T, Novak A, Coutts AJ (2020). Acute:chronic workload ratio: conceptual issues and fundamental pitfalls. *Int J Sports Physiol Perform* 15(6):907-913 | ❌ [REQUIERE VERIFICACIÓN] | ❌ [REQUIERE VERIFICACIÓN] | ⚠️ |
| REF-029 | Lolli L, Batterham AM, Hawkins R, Kelly DM, Strudwick AJ, Thorpe R, et al. (2019). Mathematical coupling causes spurious correlation within the conventional acute-to-chronic workload ratio calculations. *Br J Sports Med* | ❌ [REQUIERE VERIFICACIÓN] | 29101104 ✅ | ⚠️ |
| REF-030 | Warburton DER, Jamnik VK, Bredin SSD, Gledhill N (2011). The Physical Activity Readiness Questionnaire for Everyone (PAR-Q+) and electronic Physical Activity Readiness Medical Examination (ePARmed-X+). *Health Fit J Can* 4(2):3-17 | ❌ [REQUIERE VERIFICACIÓN] | ❌ (probablemente no indexado; REQUIERE VERIFICACIÓN) | ⚠️ |
| REF-031 | Riebe D, et al. (2015). Updating ACSM's recommendations for exercise preparticipation health screening. *Med Sci Sports Exerc* 47(11):2473-2479 | ❌ [REQUIERE VERIFICACIÓN] | 26473759 ✅ | ⚠️ |
| REF-032 | Kyle UG, et al. (ESPEN) (2004). Bioelectrical impedance analysis—part II: utilization in clinical practice. *Clin Nutr* | 10.1016/j.clnu.2004.09.012 ✅ | 15556267 ✅ | ✅ |
| REF-033 | Kyle UG, et al. (2004). Bioelectrical impedance analysis—part I: review of principles and methods. *Clin Nutr* | ❌ [REQUIERE VERIFICACIÓN] | 15380917 ✅ (solo título) | ⚠️ |
| REF-034 | Jackson AS, Pollock ML (1978). Generalized equations for predicting body density of men. *Br J Nutr* (reimpresión indexada como "1978") | ❌ [REQUIERE VERIFICACIÓN] | 14748950 ✅ (registro de la reimpresión; PMID del original 1978 [REQUIERE VERIFICACIÓN]) | ⚠️ |
| REF-035 | Jackson AS, Pollock ML, Ward A (1980). Generalized equations for predicting body density of women. *Med Sci Sports Exerc* 12(3):175-181 | ❌ [REQUIERE VERIFICACIÓN] | 7402053 ✅ | ⚠️ |
| REF-036 | Podsiadlo D, Richardson S (1991). The timed "Up & Go": a test of basic functional mobility for frail elderly persons. *J Am Geriatr Soc* 39:142-148 | ❌ [REQUIERE VERIFICACIÓN] | ❌ [REQUIERE VERIFICACIÓN] | ⚠️ |
| REF-037 | Studenski S, et al. (2011). Gait speed and survival in older adults. *JAMA* 305(1):50-58 | ❌ [REQUIERE VERIFICACIÓN] | ❌ [REQUIERE VERIFICACIÓN] | ⚠️ |

**Registros localizados solo por título (autores/año/DOI no verificados; útiles para la siguiente iteración):**

| REF | Título (tal como aparece en PubMed) | PMID |
|---|---|---|
| REF-038 | Test-retest reliability of the 30-15 Intermittent Fitness Test: a systematic review | 32422345 |
| REF-039 | Reliability of the 505 change-of-direction test in netball players | 26309330 |
| REF-040 | Reliability of the reactive strength index and time to stabilization during depth jumps | 18714215 |
| REF-041 | Statistical methods for assessing measurement error (reliability) in variables relevant to sports medicine | 9820922 |
| REF-042 | Cutoff points for grip strength in screening for sarcopenia in community-dwelling older adults: a systematic review | 35587757 |
| REF-043 | The psychometric properties of the Short Physical Performance Battery to assess physical performance in older adults: a systematic review | 35442231 |
| REF-044 | Timed Up and Go test and risk of falls in older adults: a systematic review | 22159785 |
| REF-045 | Modified 30-second sit-to-stand test: reliability and validity in older adults unable to complete traditional sit-to-stand testing | 30807554 |
| REF-046 | Intersession and intrasession reliability and validity of the My Jump app for measuring different jump actions in trained male and female athletes | 27328276 |
| REF-047 | The validity and reliability of the "My Jump App" for measuring jump height of the elderly | 30356977 |
| REF-048 | When reliability is not reliable: meaningful errors despite large reliability values | 39969550 |
| REF-049 | Intra-rater and inter-rater reliability of a weight-bearing lunge measure of ankle dorsiflexion | 11676731 |

**Referencias solicitadas que NO pudieron verificarse en esta sesión (Referencia insuficiente):** Cooper (1968) test de 12 min; Jones, Rikli & Beam (1999) 30-s chair stand; referencia primaria del 5×sit-to-stand; test de Illinois; T-test original (Semenick 1990); dinamometría manual portátil (HHD) fiabilidad; goniometría de cadera y hombro; sit-and-reach; OMS (IMC y perímetro de cintura); IDF (perímetro de cintura); ISAK (protocolo de pliegues); fiabilidad numérica del Yo-Yo IR1; velocidad máxima de sprint (fiabilidad); single-leg CMJ; NSCA (protocolo 1RM); ecuaciones Brzycki/Epley/O'Connor (fuente primaria).

---

## 2. Fichas de tests

Formato de cada ficha: ID | Nombre | Categoría | Propósito | Población | Protocolo | Equipamiento | Unidad | Intentos | Mejor/Media | Fiabilidad | Valores de referencia | Fuentes | Limitaciones.

> Nota de protocolo: las descripciones de protocolo son **operativas** (estándar de práctica) y deben alinearse con el documento fuente antes de producción. Cuando el número de intentos o la regla mejor/media no se verificó en una fuente, se indica.

### 2.1 Fuerza

#### TST-001 | Test de 1RM (repetición máxima directa)
- **Categoría:** Fuerza máxima dinámica.
- **Propósito:** cuantificar la carga máxima levantada una vez con técnica válida; base para prescribir %1RM.
- **Población:** adultos con experiencia y técnica estable en el ejercicio; no recomendado como primera evaluación en principiantes sin técnica ni en personas con contraindicaciones (ver cribado TST-040/041).
- **Protocolo (operativo):** calentamiento progresivo con cargas submáximas → intentos únicos con incrementos decrecientes, descanso de varios minutos entre intentos, criterios técnicos predefinidos (profundidad, pausa, rango). Protocolo NSCA: **Referencia insuficiente** (no verificado en esta sesión).
- **Equipamiento:** barra, discos calibrados, rack con seguros, ayudantes.
- **Unidad:** kg (absoluto) y kg/kg de masa corporal (relativo).
- **Intentos:** típicamente ≤5 intentos máximos tras calentamiento [REQUIERE VERIFICACIÓN de fuente].
- **Mejor/Media:** mejor intento válido.
- **Fiabilidad (REF-003, revisión sistemática, 32 estudios, n agregado = 1595):** ICC 0,64–0,99 (mediana 0,97; 92 % de ICC ≥ 0,90); CV 0,5–12,1 % (mediana 4,2 %). Conclusión de los autores: fiabilidad buena-excelente con independencia de experiencia, nº de familiarizaciones, ejercicio, tren superior/inferior, sexo o edad. SEM/MDC agregados: no reportados en el resumen [REQUIERE VERIFICACIÓN].
- **Valores de referencia:** no se incluyen (no verificados).
- **Fuentes:** REF-003; REF-001 y REF-002 para estadística.
- **Limitaciones:** específico del ejercicio y del equipamiento; requiere familiarización; riesgo y fatiga; el CV de hasta ~12 % en algunos estudios implica que cambios pequeños pueden ser ruido.

#### TST-002 | Estimación de 1RM por ecuaciones de repeticiones (Brzycki, Epley, O'Connor, etc.)
- **Categoría:** Fuerza máxima (estimación indirecta).
- **Propósito:** estimar 1RM a partir de una serie submáxima hasta el fallo.
- **Población:** principiantes/intermedios cuando el 1RM directo no es apropiado.
- **Protocolo (operativo):** serie con carga conocida hasta el fallo técnico; aplicar ecuación. **Fórmulas de Brzycki, Epley y O'Connor: Referencia insuficiente (fuente primaria no verificada; no se transcriben para no introducir errores).**
- **Equipamiento:** barra/máquina, discos.
- **Unidad:** kg.
- **Intentos:** 1 serie.
- **Exactitud (REF-004, ⚠️ verificado vía fuente secundaria):** 7 ecuaciones en 67 estudiantes universitarios no entrenados (40 H, 27 M) en press banca, sentadilla y peso muerto; correlaciones predicho-real altas (r > 0,95) pero exactitud absoluta variable según ejercicio; **todas las ecuaciones infraestimaron el 1RM de peso muerto**.
- **Valores de referencia:** no aplica.
- **Limitaciones:** la exactitud disminuye con más repeticiones [REQUIERE VERIFICACIÓN]; depende del ejercicio (REF-004); correlación alta ≠ acuerdo individual. Mostrar siempre como "estimación" con incertidumbre.

#### TST-003 | Estimación de 1RM por perfil carga-velocidad (VBT)
- **Categoría:** Fuerza máxima (estimación indirecta).
- **Propósito:** predecir 1RM a partir de la velocidad de la barra con cargas submáximas.
- **Población:** practicantes con técnica estable; ejercicios estudiados: sentadilla, press banca, peso muerto, cargada, arrancada (REF-005).
- **Protocolo (operativo):** 3–5+ cargas crecientes, máxima intención de velocidad, regresión individual carga-velocidad, extrapolación a la velocidad mínima (MVT).
- **Equipamiento:** transductor lineal de posición, IMU o cámara validada.
- **Unidad:** kg (predicho); m/s (velocidad).
- **Validez (REF-005, MA de datos individuales; 137 modelos de 26 estudios; 20 estudios con 434 participantes en metaanálisis):** validez predictiva moderada, **SEE% 9,8 % (IC95 % 7,4–12,2 %)**; los modelos **tienden a sobreestimar** el 1RM independientemente del enfoque. Recomendación de los autores: incorporar la evaluación directa del 1RM siempre que sea posible.
- **Limitaciones:** error ~10 % a nivel individual; dependencia del dispositivo y de la MVT elegida; no sustituye al 1RM directo para decisiones críticas.

#### TST-004 | Tirón isométrico a medio muslo (IMTP)
- **Categoría:** Fuerza máxima isométrica.
- **Propósito:** fuerza pico isométrica (y opcionalmente RFD) de la cadena posterior/triple extensión.
- **Población:** deportistas, adultos entrenados; menor carga técnica que 1RM.
- **Protocolo (operativo):** barra fija a altura de medio muslo, ángulos de rodilla/cadera estandarizados, empuje máximo ~3–5 s, varios intentos con descanso. [Ángulos y duración: REQUIERE VERIFICACIÓN]
- **Equipamiento:** plataforma de fuerza (o células de carga), rack/barra isométrica.
- **Unidad:** N; N/kg.
- **Fiabilidad (REF-006, RS de 16 estudios):** ICC 0,73–0,99 (mediana 0,96; 78 % ≥ 0,90; 98 % ≥ 0,75); CV 0,7–11,1 % (mediana 4,9 %; 58 % ≤ 5 %). Buena-excelente para fuerza pico absoluta y relativa, bilateral y unilateral.
- **Limitaciones:** la RFD y métricas tempranas suelen ser menos fiables que la fuerza pico [REQUIERE VERIFICACIÓN]; dependiente de la posición; coste del equipo.

#### TST-005 | Dinamometría de prensión manual (handgrip)
- **Categoría:** Fuerza / salud (biomarcador).
- **Propósito:** fuerza de prensión; cribado de baja fuerza muscular (sarcopenia).
- **Población:** desde adolescentes hasta mayores; clave en salud/personas mayores.
- **Protocolo (operativo):** protocolo estandarizado (posición sentada, codo a 90°) [REQUIERE VERIFICACIÓN del protocolo exacto de Dodds/Southampton].
- **Equipamiento:** dinamómetro hidráulico (p. ej. Jamar) o equivalente calibrado.
- **Unidad:** kg.
- **Intentos / Mejor-Media:** [REQUIERE VERIFICACIÓN] (comúnmente se usa el máximo de varios intentos por mano).
- **Fiabilidad:** **Referencia insuficiente** (no verificada en esta sesión).
- **Valores de referencia verificados (REF-007):** 12 estudios británicos, 60 803 observaciones de 49 964 participantes (26 687 mujeres). Pico de la **mediana**: **hombres 51 kg (29–39 años)**; **mujeres 31 kg (26–42 años)**. Fuerza baja definida como ≥ 2,5 DE por debajo de la media pico del sexo; prevalencia a los 80 años: 23 % (H) y 27 % (M). Tablas de centiles completas: consultar el artículo (no transcritas).
- **Puntos de corte clínicos verificados (REF-008, EWGSOP2):** baja fuerza de prensión **< 27 kg (hombres)** y **< 16 kg (mujeres)**.
- **Limitaciones:** normas británicas (validez externa limitada en otras poblaciones); depende del dinamómetro y del protocolo; indicador de fuerza global, no de fuerza de miembro inferior.

#### TST-006 | Dinamometría manual portátil (hand-held dynamometry, HHD)
- **Categoría:** Fuerza isométrica segmentaria.
- **Propósito:** fuerza isométrica de grupos musculares específicos (p. ej., aductores, abductores, cuádriceps, isquios, rotadores de hombro).
- **Protocolo:** make-test vs break-test; fijación externa (cinturón) recomendada para grupos fuertes [REQUIERE VERIFICACIÓN].
- **Unidad:** N, N·m (con brazo de palanca), N·m/kg.
- **Fiabilidad y referencias:** **Referencia insuficiente** (no verificado en esta sesión).
- **Limitaciones:** fuerza del evaluador puede limitar la medición en grupos fuertes; alta dependencia de posición y brazo de palanca.

### 2.2 Saltos

#### TST-007 | Salto con contramovimiento (CMJ)
- **Categoría:** Potencia / capacidad de salto.
- **Propósito:** potencia de miembros inferiores; monitorización neuromuscular.
- **Población:** general, deportistas, mayores (con app validada en mayores, REF-047, por verificar).
- **Protocolo (operativo):** manos en caderas (sin brazos), contramovimiento hasta profundidad autoseleccionada, aterrizaje con piernas extendidas en el mismo punto (si se usa tiempo de vuelo).
- **Equipamiento:** plataforma de fuerza (referencia), plataforma de contacto, app de vídeo (My Jump).
- **Unidad:** cm (altura); también W, W/kg, RSImod (con plataforma).
- **Intentos / Mejor-Media:** [REQUIERE VERIFICACIÓN] (práctica habitual: 3 intentos; la media suele preferirse para monitorización y el mejor para rendimiento).
- **Fiabilidad (REF-011, n = 93 estudiantes de Educación Física):** alfa de Cronbach 0,98 (SJ y CMJ, 0,97–0,98); CV intra-sujeto de los saltos 2,4–4,6 %, entre los más bajos para CMJ. CMJ con la mayor validez factorial (r = 0,87 con el factor "potencia explosiva").
- **Validez de métodos (REF-010):** My Jump vs plataforma de fuerza: **ICC = 0,997**.
- **Valores de referencia:** no verificados.
- **Limitaciones:** el tiempo de vuelo sobreestima si se flexionan piernas al aterrizar; no intercambiar alturas entre métodos (fuerza vs contacto vs app) sin calibrar; valores de REF-011 obtenidos en hombres físicamente activos.

#### TST-008 | Squat jump (SJ)
- **Categoría:** Potencia concéntrica.
- **Protocolo (operativo):** posición estática (~90° de rodilla [REQUIERE VERIFICACIÓN]) ~2–3 s, salto sin contramovimiento.
- **Fiabilidad (REF-011):** alfa de Cronbach 0,97–0,98 (SJ y CMJ); CV en el rango de 2,4–4,6 % de los saltos.
- **Uso derivado:** diferencia/razón CMJ-SJ (uso del ciclo estiramiento-acortamiento) [interpretación: REQUIERE VERIFICACIÓN].
- **Limitaciones:** difícil eliminar el contramovimiento sin plataforma de fuerza.

#### TST-009 | CMJ unipodal (single-leg CMJ)
- **Categoría:** Potencia unilateral / asimetría.
- **Fiabilidad y valores:** **Referencia insuficiente**.
- **Interpretación de asimetría (REF-012):** revisión sistemática sobre efectos de las asimetrías interextremidades en el rendimiento. **Cautela:** la asimetría es específica de la tarea y de la métrica; no existe en esta base un umbral verificado (p. ej., "10–15 %") — **[REQUIERE VERIFICACIÓN]**. El sistema no debe presentar la asimetría como predictor de lesión.

#### TST-010 | Drop jump y RSI
- **Categoría:** Fuerza reactiva (CEA rápido).
- **Propósito:** RSI = altura de salto / tiempo de contacto (definición recogida en REF-009).
- **Protocolo:** caída desde cajón de altura estandarizada; "mínimo contacto, máxima altura".
- **Unidad:** m/s o adimensional (según unidades).
- **Fiabilidad:** existe un estudio sobre fiabilidad del RSI en drop jumps (REF-040, PMID 18714215) — **cifras no verificadas**.
- **Limitaciones:** muy sensible a la altura de caída y a las instrucciones; requiere plataforma de contacto/fuerza.

#### TST-011 | RSI modificado (RSImod)
- **Fuente:** REF-009. RSImod propuesto para evaluar la potencia explosiva de cualquier ejercicio pliométrico vertical; 3 repeticiones por cada uno de 5 ejercicios (CMJ, tuck jump, salto unipodal, SJ, CMJ con mancuernas); se evaluaron fiabilidad y diferencias por sexo. **Cifras de ICC/CV: [REQUIERE VERIFICACIÓN].**
- **Fórmula operativa:** altura de salto / tiempo hasta el despegue (o tiempo de contracción) [definición exacta: REQUIERE VERIFICACIÓN en el artículo].
- **Equipamiento:** plataforma de fuerza.

#### TST-012 | Métodos de medida del salto (comparativa)
- **Plataforma de fuerza:** referencia (criterio en REF-010).
- **Plataforma de contacto + cronómetro digital:** fiable y válida para CMJ/SJ en hombres activos (REF-011).
- **App My Jump (iPhone):** ICC 0,997 vs plataforma de fuerza (REF-010). Validaciones adicionales en atletas entrenados (REF-046) y en mayores (REF-047) — cifras no verificadas.
- **Regla del motor:** no mezclar métodos en la serie temporal de un usuario; registrar `método` y `dispositivo` con cada medición.

### 2.3 Sprint

#### TST-013 | Sprint lineal 5/10/20/30 m
- **Categoría:** Velocidad / aceleración.
- **Protocolo (operativo):** salida estandarizada (p. ej., parado a 0,5 m de la primera célula) y siempre la misma; células dobles a altura de cadera.
- **Equipamiento:** células fotoeléctricas (preferiblemente dobles), radar/láser, vídeo de alta velocidad.
- **Unidad:** s; m/s.
- **Evidencia metodológica (REF-013):** la combinación de distintos procedimientos de salida y dispositivos de disparo puede causar diferencias de tiempo **muy grandes, muchas veces mayores que los cambios producidos por años de entrenamiento**; viento, altitud, temperatura, presión y humedad pueden producir diferencias moderadas; los sistemas más exactos: cronometraje totalmente automático, **células de doble haz**, pistolas láser y vídeo de alta velocidad.
- **Fiabilidad numérica (CV/ICC por distancia):** [REQUIERE VERIFICACIÓN].
- **Limitaciones:** el cronometraje manual no es aceptable para detectar cambios pequeños; superficie y calzado deben constar.

#### TST-014 | Velocidad máxima de sprint
- **Protocolo:** tramo lanzado (p. ej., 10 m lanzados tras 20–30 m de aceleración) o radar/láser.
- **Unidad:** m/s.
- **Fiabilidad/valores:** **Referencia insuficiente**. Aplicar las consideraciones de REF-013.

### 2.4 Cambio de dirección (COD)

#### TST-015 | Test 505 (y 505 modificado)
- **Protocolo (operativo):** 505 tradicional: 10 m de aproximación + 5 m hasta línea de giro de 180° + 5 m de vuelta; se cronometran los 5+5 m. 505 modificado: salida desde 5 m antes de la línea (sin aproximación de 10 m) [detalle exacto: REQUIERE VERIFICACIÓN].
- **Unidad:** s (por pierna de giro).
- **Fiabilidad:** existe un estudio en jugadoras de netball (REF-039, PMID 26309330) — cifras no verificadas.
- **Fuente:** REF-014.

#### TST-016 | Déficit de COD (COD deficit)
- **Fórmula:** COD deficit = tiempo 505 − tiempo de sprint lineal en la misma distancia (10 m) (REF-014).
- **Hallazgo (REF-014):** el COD deficit se correlaciona con el tiempo del 505 pero no con el tiempo de sprint, mientras que el 505 sí se correlaciona con el sprint → el déficit aísla mejor la capacidad de cambiar de dirección.
- **Limitaciones:** al ser una diferencia de dos medidas con error, su error de medida es mayor que el de cada test por separado (propagación del error, ver §3).

#### TST-017 | T-test y Modified Agility T-test (MAT)
- **T-test original:** protocolo y fiabilidad **Referencia insuficiente** (Semenick 1990 no verificado).
- **MAT (REF-015):** mantiene el patrón de desplazamiento del T-test con distancia total reducida.
  - Fiabilidad: ICC **0,92 (mujeres)** y **0,95 (hombres)**; sesgo ± límites de acuerdo 95 %: **0,03 ± 0,37 s (M)** y **0,03 ± 0,33 s (H)**.
  - Relaciones: correlaciones débiles con CMJ y sprint 10 m (en mujeres r = −0,47 y 0,34; en hombres no significativas).
- **Unidad:** s.
- **Limitaciones:** COD preplanificado, no "agilidad" reactiva; los LoA (~±0,33–0,37 s) indican que cambios individuales menores pueden ser ruido.

#### TST-018 | Illinois Agility Test
- **Referencia insuficiente** (protocolo, fiabilidad y normas no verificados).

### 2.5 Resistencia

#### TST-019 | Estimación del VO2máx (general)
- Los tests de campo (Cooper, 30-15 IFT, 6MWT) **estiman**; el VO2máx medido por análisis de gases es el criterio. Ecuaciones de estimación: **Referencia insuficiente** en esta sesión. El motor debe etiquetar siempre como "VO2máx estimado" y almacenar ecuación y versión.

#### TST-020 | Yo-Yo Intermittent Recovery Test nivel 1 (Yo-Yo IR1)
- **Fuente:** REF-016.
- **Protocolo (según resumen verificado):** carreras de ida y vuelta de 2 × 20 m a velocidad creciente con 10 s de recuperación activa en una zona de 5 m, hasta el agotamiento.
- **Unidad:** m recorridos (nivel alcanzado).
- **Fiabilidad numérica:** [REQUIERE VERIFICACIÓN].
- **Población:** deportes intermitentes (fútbol, etc.).
- **Limitaciones:** maximal; motivación; superficie; requiere audio estandarizado.

#### TST-021 | 30-15 Intermittent Fitness Test (30-15 IFT)
- **Fuente:** REF-017 (n = 59 jugadores jóvenes de deportes intermitentes, edad 16,2 ± 2,3 años). La velocidad final (VIFT/MRS) se relacionó con VO2máx, potencia de miembros inferiores y capacidad de repetir esfuerzos; útil para individualizar distancias de entrenamiento interválico frente a tests continuos.
- **Unidad:** km/h (VIFT).
- **Fiabilidad:** revisión sistemática existente (REF-038, PMID 32422345) — **cifras no verificadas**.
- **Limitaciones:** maximal; resultados específicos del protocolo (no intercambiables con velocidades de tests continuos).

#### TST-022 | Test de Cooper (12 min)
- **Referencia insuficiente** (Cooper 1968 no verificado; no se incluyen ecuaciones de VO2máx).

#### TST-023 | Test de marcha de 6 minutos (6MWT)
- **Fuente de protocolo:** REF-018 (ATS 2002): requiere un pasillo de 100 pies (~30 m) y no requiere equipo de ejercicio; mide la distancia recorrida caminando lo más rápido posible en superficie plana y dura durante 6 min; el documento incluye indicaciones, contraindicaciones, seguridad, preparación y criterios de interpretación (detalles a extraer del original).
- **Unidad:** m.
- **Intentos:** [REQUIERE VERIFICACIÓN] (efecto aprendizaje conocido; ver documento ATS).
- **Ecuaciones de referencia verificadas (REF-019; 117 hombres y 173 mujeres sanos, 40–80 años; explican ~40 % de la varianza; mediana de distancia 576 m hombres y 494 m mujeres):**
  - Hombres: 6MWD (m) = (7,57 × talla_cm) − (5,02 × edad) − (1,76 × peso_kg) − 309
  - Mujeres: 6MWD (m) = (2,11 × talla_cm) − (2,29 × peso_kg) − (5,78 × edad) + 667
  - Uso: % del predicho en adultos que realizan el test por primera vez con protocolo estandarizado. Límite inferior de normalidad: [REQUIERE VERIFICACIÓN].
- **Limitaciones:** las ecuaciones solo aplican a 40–80 años y a la población de origen (EE. UU.); el pasillo (longitud) y la motivación estandarizada influyen; test clínico submáximo: requiere supervisión y criterios de detención.

### 2.6 Funcional / salud

#### TST-024 | 30-s Chair Stand (Senior Fitness Test, SFT)
- **Población:** mayores 60–94 años (REF-021, REF-020).
- **Protocolo (operativo):** número de levantamientos completos de una silla (altura estándar) en 30 s con brazos cruzados.
- **Unidad:** repeticiones.
- **Fiabilidad:** artículo de validación original (Jones, Rikli & Beam 1999): **Referencia insuficiente**.
- **Valores de referencia:**
  - REF-021 (1999): normas en percentiles (p10, p50, p90) por grupos de edad, **n = 7183** (EE. UU.) — **valores concretos no transcritos [REQUIERE VERIFICACIÓN]**.
  - REF-020 (2013): estándares criterio (puntos de corte) asociados a mantener la independencia física, derivados de 2140 mayores de "función moderada"; indicadores de fiabilidad/validez de los estándares 0,79–0,97. **Puntos de corte concretos: [REQUIERE VERIFICACIÓN]**.
- **Variante:** 30-s STS modificado para quien no puede hacer el test tradicional (REF-045, cifras no verificadas).

#### TST-025 | Senior Fitness Test (batería completa)
- **Componentes (según resumen verificado):** IMC; flexiones de brazo y 30-s chair stand (fuerza superior/inferior); chair sit-and-reach y back scratch (flexibilidad); 6-min walk y 2-min step (resistencia aeróbica); 8-foot up-and-go (equilibrio dinámico/agilidad).
- **Normas:** REF-021 (percentiles), REF-020 (estándares criterio). Valores: [REQUIERE VERIFICACIÓN].
- **Limitaciones:** normas de EE. UU. (1999); considerar normas locales cuando existan.

#### TST-026 | 5 × sit-to-stand (5×STS)
- **Punto de corte verificado (REF-008, EWGSOP2):** **> 15 s para 5 levantamientos** = baja fuerza (criterio de sarcopenia probable junto con prensión).
- **Fiabilidad:** **Referencia insuficiente**.
- **Unidad:** s.

#### TST-027 | Timed Up and Go (TUG)
- **Fuente original:** REF-036 (Podsiadlo & Richardson 1991, JAGS 39:142-148) — PMID/DOI no verificados.
- **Protocolo (operativo):** levantarse de una silla, caminar 3 m, girar, volver y sentarse; tiempo en s.
- **Fiabilidad/normas:** [REQUIERE VERIFICACIÓN]. Revisión sobre TUG y riesgo de caídas (REF-044) — cifras no verificadas.
- **Punto de corte EWGSOP2 (rendimiento físico bajo):** [REQUIERE VERIFICACIÓN] (no confirmado en esta sesión).
- **Limitaciones:** capacidad predictiva de caídas limitada como test aislado [REQUIERE VERIFICACIÓN — ver REF-044].

#### TST-028 | Short Physical Performance Battery (SPPB)
- **Fuente:** REF-022. Batería en > 5000 personas ≥ 71 años de tres comunidades: equilibrio (pies juntos, semitándem, tándem), marcha de 8 pies (~2,4 m) y 5 levantamientos de silla. Predijo fuertemente mortalidad a corto plazo, ingreso en residencia y discapacidad.
- **Puntuación:** 0–12 [REQUIERE VERIFICACIÓN de la tabla de puntuación].
- **Corte EWGSOP2 (≤ 8 puntos):** [REQUIERE VERIFICACIÓN].
- **Psicometría:** revisión sistemática disponible (REF-043) — cifras no verificadas.

#### TST-029 | Apoyo monopodal (unipedal stance test, UPST)
- **Fuente:** REF-023. n = 549 sanos ≥ 18 años; UPST ojos abiertos (OA) y cerrados (OC); media y mejor de 3 intentos por sexo y 6 grupos de edad (18–39, 40–49, 50–59, 60–69, 70–79, 80+). Disminución significativa con la edad en ambas condiciones.
- **Intentos:** 3; registrar media y mejor.
- **Fiabilidad (REF-023):** interevaluador para el mejor de 3: **ICC 0,994 (IC95 % 0,989–0,996) OA** y **0,998 (0,996–0,999) OC**.
- **Valores normativos:** una fuente secundaria (resumen de búsqueda) indica, para OA mejor de 3, aprox. 44 s (18–39), 41 s (40–49), 41 s (50–59), 32 s (60–69), 21 s (70–79), 9 s (80+) — **[REQUIERE VERIFICACIÓN en la tabla original; desglose por sexo y DE no verificados; no usar hasta confirmar]**.
- **Unidad:** s (tope de tiempo del protocolo: [REQUIERE VERIFICACIÓN]).

#### TST-030 | Velocidad de la marcha (gait speed)
- **Fuentes:** REF-037 (Studenski 2011, JAMA 305(1):50-58 — PMID/DOI no verificados); componente de REF-022.
- **Protocolo:** 4 m (o distancia estandarizada) a velocidad habitual; salida parada o lanzada (el protocolo cambia el resultado; registrar).
- **Unidad:** m/s.
- **Corte EWGSOP2 (≤ 0,8 m/s):** [REQUIERE VERIFICACIÓN].
- **Fiabilidad/MDC:** **Referencia insuficiente**.

### 2.7 Movilidad

#### TST-031 | Weight-bearing lunge test (WBLT; dorsiflexión de tobillo en carga)
- **Fuente:** REF-024 (RS, 12 estudios).
- **Unidad:** cm (distancia dedo-pared) o grados (inclinómetro).
- **Fiabilidad:** ICC intraevaluador **0,65–0,99**; interevaluador **0,80–0,99**.
- **MDC:** intraevaluador **4,6° / 1,6 cm**; interevaluador **4,7° / 1,9 cm**.
- **Uso en el motor:** un cambio < 1,6–1,9 cm (o < ~4,6–4,7°) no debe presentarse como mejora real.
- **Valores normativos:** no verificados.

#### TST-032 | Goniometría de cadera (flexión, extensión, rotaciones)
- **Referencia insuficiente** (fiabilidad, SEM, MDC y valores normativos no verificados).

#### TST-033 | Rango de movimiento de hombro (rotación interna/externa, flexión)
- **Referencia insuficiente**.

#### TST-034 | Sit-and-reach (y chair sit-and-reach del SFT)
- **Referencia insuficiente** para fiabilidad y normas. Chair sit-and-reach forma parte del SFT (REF-021).

### 2.8 Composición corporal

#### TST-035 | Índice de masa corporal (IMC)
- **Fórmula:** IMC = masa (kg) / talla (m)².
- **Cortes OMS (bajo peso, normopeso, sobrepeso, obesidad):** **[REQUIERE VERIFICACIÓN]** (documento OMS no consultado en esta sesión).
- **Limitaciones:** no distingue masa grasa de masa magra; inadecuado como indicador de adiposidad en deportistas musculados; no aplicar cortes de adultos a menores.

#### TST-036 | Perímetro de cintura
- **Cortes OMS / IDF por sexo y etnia:** **[REQUIERE VERIFICACIÓN]**.
- **Protocolo (sitio anatómico):** [REQUIERE VERIFICACIÓN] (OMS e ISAK usan puntos distintos; registrar cuál se usa).

#### TST-037 | Pliegues cutáneos (ISAK) y ecuaciones de Jackson-Pollock
- **Protocolo ISAK:** **Referencia insuficiente** (no verificado).
- **Ecuaciones de densidad corporal:**
  - Hombres (REF-034): muestras de 308 y 95 hombres de 18–61 años; ecuaciones con suma de pliegues (forma cuadrática o logarítmica) + edad (± circunferencias de cintura y antebrazo); R > 0,90; error estándar ≈ ±0,0073 g/ml.
  - Mujeres (REF-035): 249 mujeres de 18–55 años (4–44 % de grasa); suma de 3, 4 y 7 pliegues (forma cuadrática) + edad + perímetro glúteo; R 0,842–0,867; error estándar 3,6–3,8 % de grasa; **precaución en mujeres > 40 años**.
  - **Coeficientes concretos: no transcritos [REQUIERE VERIFICACIÓN]**. La conversión densidad → % grasa (Siri/Brozek) tampoco se verificó.
- **Recomendación del motor:** priorizar el seguimiento de la **suma de pliegues (mm)** frente a % grasa estimado, que añade error de ecuación.
- **Limitaciones:** dependiente del evaluador (formación/acreditación), del plicómetro y de la población de derivación de la ecuación.

#### TST-038 | Bioimpedancia (BIA)
- **Fuentes:** REF-033 (principios), REF-032 (uso clínico, ESPEN).
- **Hallazgos verificados (REF-032):** BIA funciona bien en sanos y en pacientes con balance hidroelectrolítico estable **si se usa una ecuación validada apropiada para edad, sexo y etnia**; **no se recomienda** su uso clínico rutinario en sujetos con IMC extremos o hidratación anormal hasta disponer de validación adicional.
- **Unidad:** kg (MLG, MG), % grasa, L (agua).
- **Limitaciones:** sensibilidad a hidratación, ingesta, ejercicio previo; ecuaciones propietarias de dispositivos comerciales a menudo no publicadas; no intercambiar dispositivos.

### 2.9 Readiness / monitorización

#### TST-039 | Session-RPE (sRPE)
- **Fuente:** REF-025. Método validado frente a un estándar basado en frecuencia cardíaca para cuantificar el entrenamiento durante ejercicio no estable y prolongado; útil para evaluar planes de periodización.
- **Cálculo (operativo):** carga = RPE de sesión (escala CR-10) × duración (min) → UA. [Tiempo tras la sesión para preguntar: REQUIERE VERIFICACIÓN].
- **Limitaciones:** medida de carga interna percibida; no es un predictor de lesión.

#### TST-040 | Cuestionarios de bienestar (Hooper; McLean)
- **Hooper (REF-027):** recomendaciones para monitorizar el sobreentrenamiento; el índice de Hooper agrupa sueño, dolor muscular, estrés y fatiga (escalas: [REQUIERE VERIFICACIÓN]).
- **McLean 2010 (REF-026):** respuestas neuromusculares, endocrinas y perceptivas en microciclos de distinta longitud en rugby league profesional (detalles del cuestionario: [REQUIERE VERIFICACIÓN]).
- **Psicometría (fiabilidad/validez de constructo):** **Referencia insuficiente**.
- **Regla del motor:** interpretar respecto a la línea base individual, no respecto a normas poblacionales.

#### TST-041 | Ratio carga aguda:crónica (ACWR) — **USO RESTRINGIDO**
- **Críticas verificadas:**
  - REF-028: el uso del ACWR puede conducir a recomendaciones inapropiadas porque **no se ha establecido su relación causal con la lesión**, es una métrica **inexacta**, carece de fundamento teórico que apoye un papel causal, es **ambigua** y **no se relaciona de forma consistente y unidireccional con el riesgo de lesión**.
  - REF-029: el **acoplamiento matemático** (la carga aguda está incluida en la crónica) produce **correlaciones espurias** en el cálculo convencional.
- **Regla obligatoria del sistema:** el Assessment Engine **NO** debe afirmar, sugerir ni puntuar "riesgo de lesión" a partir del ACWR ni de ninguna métrica de carga. Como mucho, mostrar la carga y su variación como información descriptiva.

### 2.10 Cribado previo a la participación

#### TST-042 | PAR-Q+
- **Fuente:** REF-030. Desarrollado mediante un proceso de consenso basado en la evidencia para sustituir al PAR-Q/PARmed-X originales (desarrollados sin soporte de evidencia), reduciendo barreras a la actividad física, incluidas personas con enfermedades crónicas; se complementa con el ePARmed-X+ online.
- **Uso en el motor:** obligatorio antes de cualquier test maximal; respuestas afirmativas → seguir el flujo del propio PAR-Q+ / ePARmed-X+ (contenido de ítems: [REQUIERE VERIFICACIÓN con la versión vigente del formulario]).

#### TST-043 | Algoritmo de cribado ACSM 2015
- **Fuente:** REF-031. Objetivo: identificar personas con riesgo elevado de muerte súbita cardíaca y/o infarto agudo de miocardio relacionados con el ejercicio. Modelo basado en **tres factores**: (1) nivel actual de actividad física, (2) signos o síntomas y/o enfermedad cardiovascular, metabólica o renal conocida, y (3) intensidad de ejercicio deseada.
- **Detalle de ramas y lista de signos/síntomas:** [REQUIERE VERIFICACIÓN en el artículo].

### 2.11 Estadística del cambio

#### TST-044 | Error típico, CV, SWC, SEM y MDC
- **Fuentes:** REF-001, REF-002 (complementarias: REF-041, REF-048).
- **Verificado (REF-001):** las medidas principales de fiabilidad son la variación aleatoria intra-sujeto (error típico), el cambio sistemático de la media y la correlación test-retest; para muchas medidas el error típico se expresa mejor como **CV (% de la media)**.
- **Verificado (REF-002):** el ICC tiene varias formas; la distinción clave es si el **error sistemático** se incluye o no en el denominador; el **SEM** puede calcularse a partir del ICC y su utilidad suele infravalorarse.
- **Fórmulas operativas (definiciones estadísticas estándar; la página/ecuación exacta en cada artículo está [REQUIERE VERIFICACIÓN]):**
  - Error típico (TE) = DE de las diferencias test-retest / √2.
  - SEM = DE_agrupada × √(1 − ICC).
  - MDC95 = 1,96 × √2 × SEM (≈ 2,77 × SEM).
  - SWC = 0,2 × DE entre sujetos (umbral "pequeño" de Hopkins) — **atribución exacta [REQUIERE VERIFICACIÓN]** (no confirmada en REF-001 en esta sesión).
  - Error de una diferencia de dos tests (p. ej., COD deficit): √(TE_A² + TE_B²) si los errores son independientes.

---

## 3. Diseño del Assessment Engine — recomendaciones

### 3.1 Principios
1. **Cribado antes de evaluar:** PAR-Q+ (TST-042) y/o algoritmo ACSM (TST-043) antes de cualquier test maximal (1RM, IMTP, Yo-Yo, 30-15 IFT, sprints).
2. **Trazabilidad de cada dato:** `test_id`, `protocolo_version`, `dispositivo`, `método` (p. ej., plataforma de fuerza vs app), `evaluador`, `condiciones` (hora, superficie, calzado, temperatura si es exterior), `intentos_brutos[]`, `regla_agregación` (mejor/media).
3. **Nunca mezclar métodos** en una misma serie temporal sin una ecuación de conversión validada (REF-010, REF-013).
4. **Estimaciones etiquetadas como tales** con su error (p. ej., 1RM por VBT: SEE ≈ 9,8 %, tendencia a sobreestimar, REF-005).
5. **Sin predicción de lesión** a partir de carga, ACWR o asimetrías (REF-028, REF-029, REF-012).

### 3.2 Baterías por objetivo (propuesta; selección basada en las fichas, pendiente de validación por expertos)

| Objetivo | Batería núcleo | Opcional | Evitar/condicionar |
|---|---|---|---|
| **Hipertrofia** | 1RM o estimación por repeticiones en ejercicios clave (TST-001/002); perímetros (TST-036); suma de pliegues (TST-037) | VBT (TST-003); IMC solo como contexto | % grasa por BIA como único indicador (TST-038) |
| **Salud / personas mayores** | Prensión (TST-005) + 5×STS (TST-026) [criterios EWGSOP2]; 30-s chair stand / SFT (TST-024/025); SPPB (TST-028); velocidad de marcha (TST-030); apoyo monopodal (TST-029); 6MWT (TST-023) | TUG (TST-027); WBLT (TST-031) | 1RM directo sin familiarización ni cribado; tests maximales de campo |
| **Deporte de equipo** | CMJ (TST-007); sprint 10/20/30 m con células dobles (TST-013); 505 + COD deficit (TST-015/016); Yo-Yo IR1 o 30-15 IFT (TST-020/021) | IMTP (TST-004); MAT (TST-017); RSI (TST-010); sRPE + wellness (TST-039/040) | ACWR como indicador de riesgo (TST-041) |
| **Resistencia** | Test de campo de resistencia (30-15 IFT o equivalente; VO2máx etiquetado como estimado, TST-019); sRPE (TST-039) | CMJ como indicador de fatiga neuromuscular; WBLT | Comparar velocidades entre protocolos distintos |
| **Sprint / potencia** | Sprint 5/10/20/30 m + velocidad máxima (TST-013/014); CMJ y SJ (TST-007/008); RSI / RSImod (TST-010/011); IMTP (TST-004) | 1RM/VBT en sentadilla (TST-001/003) | Cronometraje manual |
| **Principiantes** | Cribado (TST-042/043); prensión (TST-005); 30-s chair stand o 5×STS; CMJ con app (TST-007/012); estimación de 1RM por repeticiones con cargas moderadas (TST-002); perímetro de cintura | 6MWT o test de campo submáximo | 1RM directo en las primeras semanas; tests maximales sin supervisión |

### 3.3 Cómo calcular el cambio frente a MDC/SWC
1. **Obtener el error de medida específico:** priorizar (a) fiabilidad propia del centro/dispositivo (test-retest en ≥ 2 sesiones), (b) valores publicados en población similar (p. ej., WBLT MDC 1,6–1,9 cm, REF-024; 1RM CV mediana 4,2 %, REF-003; IMTP CV mediana 4,9 %, REF-006; CMJ CV 2,4–4,6 %, REF-011), (c) si no existe, marcar "error desconocido" y **no** emitir veredicto de cambio.
2. **Calcular Δ = post − pre** (absoluto y %).
3. **Clasificar:**
   - |Δ| < TE (o CV): "dentro del ruido de medida".
   - |Δ| ≥ SWC pero < MDC95: "posible cambio, no confirmado" (repetir medición).
   - |Δ| ≥ MDC95: "cambio real probable (≥ 95 % de confianza de que supera el error)".
   - Opcional: probabilidad de que el cambio verdadero > SWC usando TE (enfoque de Hopkins; implementación concreta [REQUIERE VERIFICACIÓN]).
4. **Si SWC < TE** (prueba "ruidosa" respecto al cambio relevante): avisar de que el test no es sensible para ese usuario/objetivo; usar promedio de varios intentos o de varias sesiones.
5. **Medidas derivadas** (COD deficit, asimetrías, % del predicho): propagar error; su MDC es mayor que el de las medidas que las componen.
6. **Agregación:** para monitorización, preferir la **media** de intentos (reduce error aleatorio); para rendimiento máximo, el **mejor**; mantener la misma regla en toda la serie.

### 3.4 Cuándo NO usar z-scores / percentiles
- Cuando la población normativa **no coincide** con el usuario (edad, sexo, país, nivel deportivo; p. ej., Dodds = Reino Unido; Rikli & Jones = EE. UU.; Enright = 40–80 años).
- Cuando el **protocolo o dispositivo difiere** del usado en la norma (salto con plataforma vs app; sprint con salida distinta; dinamómetro distinto).
- Cuando la distribución es **asimétrica, con efecto techo/suelo o discreta** (p. ej., SPPB 0–12, apoyo monopodal con tope de tiempo, repeticiones de chair stand): usar percentiles empíricos o puntos de corte criterio, no z.
- Con **muestras normativas pequeñas** o de un solo equipo (z inestables).
- En **menores**: la maduración biológica confunde la comparación por edad cronológica.
- Para **seguimiento individual**: usar el cambio frente a TE/SWC/MDC (§3.3) en lugar de z respecto a la población.
- Para métricas cuyo significado es **criterio clínico** (EWGSOP2: prensión < 27/16 kg; 5×STS > 15 s), mostrar el criterio, no un z.

### 3.5 Banderas rojas → derivación a profesional sanitario (detener evaluación)
> Lista operativa de seguridad; los umbrales clínicos específicos y la formulación exacta deben tomarse de REF-018 (ATS 6MWT), REF-030 (PAR-Q+) y REF-031 (ACSM) — **[REQUIERE VERIFICACIÓN de los textos]**.

- **Cribado positivo** en PAR-Q+ / algoritmo ACSM (signos o síntomas de enfermedad cardiovascular, metabólica o renal; enfermedad conocida sin autorización para la intensidad prevista) → no realizar tests maximales; derivar.
- **Durante cualquier test:** dolor/opresión torácica, disnea desproporcionada, mareo/síncope o presíncope, palpitaciones, confusión, palidez o sudoración anómala, claudicación o calambres intensos, dolor articular agudo → detener y derivar.
- **Caídas** durante tests de equilibrio/marcha, o historia de caídas recientes → derivar a valoración (fisioterapia/geriatría).
- **Resultados de rendimiento en rango de riesgo** (p. ej., criterios EWGSOP2 de baja fuerza: prensión < 27 kg H / < 16 kg M o 5×STS > 15 s; rendimiento físico bajo) → recomendar valoración clínica de sarcopenia; el sistema **no diagnostica**.
- **Composición corporal:** IMC o perímetro de cintura en rangos de riesgo (cortes OMS/IDF [REQUIERE VERIFICACIÓN]) → recomendar valoración sanitaria; pérdida de peso no intencionada → derivar.
- **Dolor persistente**, inflamación, inestabilidad articular o déficit marcado y nuevo de rango de movimiento → derivar.
- **Wellness:** puntuaciones persistentemente muy bajas de sueño/estado de ánimo/estrés → sugerir apoyo profesional; el sistema no evalúa salud mental.
- El sistema **no** debe interpretar ninguna métrica de carga, asimetría o readiness como diagnóstico o predicción de lesión.

---

## 4. Lista de tareas para la siguiente iteración (cuando haya acceso a PubMed/Crossref)
1. Confirmar PMIDs/DOIs marcados ❌ (REF-004, 008, 011–016, 018, 020, 021, 023, 025–031, 033–037).
2. Extraer de textos completos: tablas normativas (Dodds centiles, Springer por sexo, Rikli & Jones 1999/2013), cortes EWGSOP2 de rendimiento (marcha, SPPB, TUG), cifras de fiabilidad de REF-038/039/040/043/044/046.
3. Localizar y verificar: Cooper 1968; Jones, Rikli & Beam 1999; fiabilidad 5×STS; Illinois; T-test; HHD; goniometría; sit-and-reach; OMS/IDF; ISAK; fiabilidad Yo-Yo IR1; ecuaciones Brzycki/Epley/O'Connor; protocolo NSCA de 1RM.
4. Revisión por un profesional sanitario de §3.5 antes de cualquier despliegue.
