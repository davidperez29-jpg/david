# Catálogo de evaluación: referencias no localizadas y datos no verificados

> Fase 5. Generado a partir de `seed-data/assessment/catalog.json`. Las comprobaciones se hicieron contra PubMed (conector NCBI). Lo que figura aquí **no** se ha cargado como dato de fiabilidad ni de referencia: queda **[REQUIERE VERIFICACIÓN]**.

## 1. Referencias no localizadas en PubMed

| Citada como | Motivo |
|---|---|
| REF-004 LeSuer DA et al. (1997) J Strength Cond Res 11(4):211-213 | Sin resultado en PubMed por cita (revista/año/volumen/página) ni por autor; probablemente no indexado. Excluido. |
| REF-021 Rikli RE, Jones CJ (1999) Functional fitness normative scores for community-residing older adults, ages 60-94. J Aging Phys Act | La búsqueda por título devolvió otro artículo (Gouveia et al., normas portuguesas, PMID 22715032); no se localizó el original de 1999. |
| REF-030 Warburton DER et al. (2011) PAR-Q+ y ePARmed-X+. Health Fit J Can 4(2):3-17 | Revista no indexada en PubMed; no localizado. Además, el cribado se gestiona fuera de este catálogo. |
| Pauole K et al. (2000) T-test, J Strength Cond Res 14:443 | Sin coincidencia en PubMed por cita ni por autor. |
| Semenick (1990) T-test original; protocolo NSCA de 1RM; ecuaciones Brzycki/Epley/O'Connor; protocolo ISAK; documentos OMS/IDF de IMC y perímetro de cintura | No localizados en esta sesión (publicaciones profesionales/institucionales no indexadas o no buscadas específicamente). |

## 2. Datos no verificados o no aplicables

| Dato | Motivo |
|---|---|
| Puntos de corte EWGSOP2 (prensión < 27 kg H / < 16 kg M; 5×STS > 15 s; velocidad de marcha ≤ 0,8 m/s; SPPB ≤ 8; TUG) | El resumen de Cruz-Jentoft 2019 (PMID 30312372) indica que el consenso proporciona puntos de corte pero no los enumera. Texto completo disponible en PMC6322506, no leído. No se cargan filas de referencia. |
| PMID 31081853 propuesto para EWGSOP2 | Corresponde a la fe de erratas (Age Ageing 48(4):601). El artículo original es PMID 30312372. |
| Normas del apoyo monopodal por edad (≈44, 41, 41, 32, 21, 9 s, ojos abiertos) | No aparecen en el resumen de Springer 2007; solo en tablas del texto completo. |
| Estándares criterio del 30-s chair stand (Rikli y Jones) | El resumen no incluye los puntos de corte; los indicadores 0,79–0,97 se refieren a la fiabilidad/validez de los estándares, no del test. |
| Normas de percentiles del Senior Fitness Test (Rikli y Jones 1999, n = 7183) | Artículo no localizado en PubMed. |
| Ecuaciones de referencia del 6MWT (Enright y Sherrill 1998) | Verificadas literalmente en el resumen, pero son ecuaciones, no filas de referencia; recogidas en resultsSummary de la fuente y en las limitaciones del test. |
| Prevalencia de prensión débil (≥ 2,5 DE bajo la media pico: 23 % H / 27 % M a los 80 años) | Verificado en el resumen de Dodds 2014, pero es una definición relativa sin valor absoluto; no se carga como punto de corte. |
| MDC del lunge test: el anexo asignaba 4,6°/1,6 cm a intraevaluador y 4,7°/1,9 cm a interevaluador | El resumen de Powden 2015 indica lo contrario (4,6°/1,6 cm interevaluador; 4,7°/1,9 cm intraevaluador). Se sigue el resumen. |
| ICC/CV del RSImod (Ebben y Petushek 2010) | El resumen solo afirma que es 'muy fiable', sin valores. |
| Fiabilidad del RSI en drop jump (Flanagan 2008) | El resumen solo da umbrales (alfa > 0,95; ICC > 0,9), no valores exactos; no se carga fila. |
| Fiabilidad de la goniometría de cadera (Nussbaumer 2010) | El resumen indica ICC superiores a 0,90 sin valor exacto y en muestra con pacientes; no se carga fila. |
| Fiabilidad del T-test e Illinois en militares (Raya 2013) | El resumen describe fiabilidad test-retest moderada-buena sin valores numéricos. |
| Fiabilidad numérica del sprint 5, 10 y 30 m y de la velocidad máxima por distancia (Haugen y Buchheit 2016) | El resumen no incluye valores de error típico ni de SWC por distancia. |
| SEE% 9,8 % del 1RM por perfil carga-velocidad (Greig 2023) | Verificado, pero es error de estimación (validez), no fiabilidad: recogido en limitaciones del test, no como fila de fiabilidad. |
| MDC90 0,70 del 30-s sit-to-stand modificado (McAllister 2020) | Verificado, pero corresponde a la variante modificada, no al test tradicional; no se carga. |
| SWC 0,20 s del Illinois (Hachana 2013) | Verificado en el resumen, pero el campo swc se deja nulo según la especificación; consta en notas. |
| Punto de corte TUG para caídas | Beauchet 2011 informa cortes muy variables (10–32,6 s) y capacidad predictiva limitada; no se carga referencia. |
| Puntuación 0–12 y corte de la SPPB | La tabla de puntuación no figura en el resumen de Guralnik 1994; la escala 0–12 se usa como dato de protocolo estándar, sin punto de corte. |
| Escalas e ítems del índice de Hooper; contenido de la guía ATS del 6MWT; ecuaciones del test de Cooper | Los registros PubMed no tienen resumen (Hooper 1995, ATS 2002, Cooper 1968). |
| Cortes OMS de IMC y OMS/IDF de perímetro de cintura; protocolo ISAK | No verificados en esta sesión; IMC excluido por ser derivado. |
| Diferencias de año respecto al anexo | Se usa la fecha del registro PubMed (publicación electrónica): Grgic IMTP 2021 (anexo 2022), Rikli y Jones 2012 (anexo 2013), Bishop 2017 (anexo 2018), Lolli 2017 (anexo 2019). |
| DOI de REF-011 (Markovic 2004) | Ahora verificado en PubMed: 10.1519/1533-4287(2004)18<551:RAFVOS>2.0.CO;2. Otros identificadores antes pendientes también resueltos (Sassi 2009 PMID 19675502, DOI 10.1519/JSC.0b013e3181b425d2; Haugen 2016 PMID 26660758; Nimphius 2016 PMID 26982972; Bangsbo 2008 PMID 18081366; ATS 2002 PMID 12091180; Podsiadlo 1991 PMID 1991946; Studenski 2011 PMID 21205966; Impellizzeri 2020 PMID 32502973; Bishop 2017 PMID 28767317). |
| Fuentes verificadas pero no incluidas: Riebe 2015 (PMID 26473759, cribado ACSM), Jackson y Pollock 1978/2004 (PMID 14748950) y Jackson, Pollock y Ward 1980 (PMID 7402053) | Fuera del alcance de este catálogo (cribado gestionado aparte; pliegues TST-037 excluidos). |
| Balsalobre-Fernández 2015, ICC 0,997 | Verificado, pero es concordancia entre métodos (app vs plataforma), no fiabilidad test-retest; cargado con iccModel explícito para no usarlo en el cálculo del MDC. |
