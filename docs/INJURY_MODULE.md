# Módulo de lesiones, readaptación y Return to Sport

> **Prioritario** (§18 del encargo). No es «cliente lesionado = rutina diferente»: es un sistema de
> LESIÓN → FASE → OBJETIVOS → CAPACIDADES → EVALUACIÓN → CRITERIOS → CARGA → PROGRESIÓN → RETURN TO SPORT → RETURN TO PERFORMANCE.
>
> Referencias verificadas en PubMed el 05/10/2026 (DOI y PMID en §9). Todo criterio numérico que no tenga fuente verificada se marca **«Evidencia insuficiente / criterio práctico»**.

## 1. Conceptos que el sistema distingue (§19)

| Concepto | Qué es | Quién decide | Cómo aparece en la aplicación |
|---|---|---|---|
| **Prevención** (reducción de la incidencia) | Una intervención que ha demostrado **reducir lesiones** en estudios de incidencia (ECA, metaanálisis) | — | Etiqueta «Reducción de incidencia demostrada» con su fuente y población |
| **Reducción de factores de riesgo** | Mejora una **variable asociada** al riesgo (fuerza, asimetría, ROM…), sin demostrar que reduzca lesiones | — | Etiqueta «Mejora un factor asociado; no demuestra reducción de lesiones» |
| **Rehabilitación** | Tratamiento clínico de la lesión | **Profesional sanitario** | Fuera del ámbito del entrenador. Se registra la información recibida, no se prescribe |
| **Readaptación** | Entrenamiento para recuperar capacidades tras la lesión, en coordinación con el equipo sanitario | Entrenador, dentro de las restricciones recibidas | Fases, criterios, cargas y ejercicios |
| **Return to Sport (RTS)** | Vuelta al deporte | **Equipo responsable** (decisión compartida) | Checklist y estado; la decisión la registra una persona |
| **Return to Performance (RTPerf)** | Vuelta al nivel de rendimiento previo o superior | Equipo responsable | Comparación con la línea base previa a la lesión |

**El continuo de vuelta al deporte**: el consenso de Berna (Ardern et al., 2016) propone entender la vuelta al deporte como un **continuo paralelo a la recuperación**, no como una decisión aislada al final. Distingue:
1. vuelta a la participación;
2. vuelta al deporte;
3. vuelta al rendimiento.

La aplicación modela esas tres etapas en `rtp_decisions.stage`.

**Marco de decisión**:
- para sintetizar la información de la decisión, el mismo consenso recomienda el marco StARRT (Shrier, 2015);
- la aplicación **ordena la información** para quien decide: estado de los criterios, síntomas, exposición, fase y comparativas;
- **la aplicación no decide**.

## 2. Límites de alcance (lo que el software nunca hace)

- **No diagnostica.** Se registra la «información recibida» (diagnóstico del profesional sanitario), cifrada.
- **No declara a nadie «APTO»** ni «médicamente apto para competir».
  - El estado máximo calculado es **«LISTO PARA VALORACIÓN»**.
  - La decisión de RTS/RTPerf la registra una persona con nombre y rol (`rtp_decisions`).
- **No avanza de fase solo.** Cuando se cumplen los criterios obligatorios, se habilita el botón **[Avanzar de fase]** para el entrenador.
- **No inventa criterios clínicos.** Cada criterio guarda su fuente, la población, la condición y sus limitaciones (§27 del encargo). Si no hay evidencia suficiente, se dice.
- **Ante señales de alarma, avisa: «Revisar antes de progresar»** (§3). Sugiere consultar al profesional sanitario cuando corresponda, sin diagnosticar.

## 3. Alertas de seguridad (§30)

Se evalúan con cada registro de síntomas, sea del entrenador o del cliente, y con cada sesión registrada.

| Señal | Regla por defecto (configurable por protocolo) | Mensaje |
|---|---|---|
| Dolor elevado | Dolor ≥ umbral del protocolo durante o después de la actividad | Revisar antes de progresar |
| Empeoramiento | Dolor o síntomas peores que el registro anterior, o que persisten al día siguiente | Revisar antes de progresar |
| Pérdida importante de función | Marcada por entrenador o cliente | Revisar antes de progresar · Consultar con el profesional sanitario |
| Síntomas neurológicos (hormigueo, pérdida de fuerza súbita, etc.) | Cualquier registro | **Detener la progresión** · Requiere valoración por profesional sanitario |
| Inflamación importante / inestabilidad | Cualquier registro | Revisar antes de progresar |
| Reacción adversa a la sesión | Marcada | Revisar antes de progresar |

- Las alertas **bloquean el botón [Avanzar de fase]** hasta que el entrenador las revisa (queda auditado).
- Los umbrales de dolor **no son universales**:
  - **ejemplo con evidencia**: el modelo de monitorización del dolor (Silbernagel et al., 2007) permitió seguir cargando el tendón dentro de unos límites de dolor en tendinopatía aquílea, en un ensayo aleatorizado con 38 pacientes;
  - su uso fuera de esa condición es **criterio práctico** y así se etiqueta.

## 4. Estructura: región → condición → protocolo → fases → criterios

```
REGIÓN          Rodilla
 └ CONDICIÓN    Reconstrucción de LCA
    └ PROTOCOLO "LCA · retorno a deporte de pivote" v3 (estado: revisado)
       ├ FASE 1  Control de síntomas / movilidad / activación
       │   criterios de entrada · objetivos · ejercicios · dosis · tests
       │   criterios de éxito · de progresión · de regresión · de parada
       ├ FASE 2  …
       └ FASE n  (cada protocolo define su propio árbol de fases)
```

**Andamiaje por defecto** (§22): las 8 fases conceptuales del encargo se ofrecen como **plantilla de partida** al crear un protocolo nuevo, nunca como protocolo universal. Cada protocolo puede:
- quitar, fusionar o renombrar fases;
- definir criterios propios por fase;
- versionarse; una lesión abierta conserva la versión con la que empezó.

**Criterios de cada fase** (§23):

| Papel | Ejemplo de redacción | Efecto |
|---|---|---|
| Entrada | «Alta clínica recibida para iniciar carga» | Se comprueba al entrar |
| Objetivo / éxito | «Recuperar fuerza de cuádriceps» | Qué se persigue |
| Progresión | «Asimetría de fuerza de cuádriceps dentro del umbral del protocolo» | Todos los obligatorios cumplidos → habilita [Avanzar de fase] |
| Regresión | «Aumento de dolor tras dos sesiones seguidas» | Sugiere volver a la fase anterior |
| Parada | «Síntomas neurológicos» | Detiene la progresión y pide valoración profesional |

**Comprobación de un criterio**:
- **automática** cuando está ligado a un test: por ejemplo, el índice de simetría entre miembros (LSI) de un hop test se calcula de la evaluación y se compara con el umbral;
- **manual** cuando es cualitativo: por ejemplo, «criterios clínicos recibidos».

Cada comprobación es una fila nueva (`injury_criterion_checks`), con fecha, valor, quién y de qué evaluación sale.

**Estado del caso** (calculado):

| Estado | Condición |
|---|---|
| NO INICIADO | Lesión registrada sin fase iniciada |
| EN PROGRESO | En una fase, con criterios de progresión pendientes |
| CRITERIOS PARCIALES | Algún criterio obligatorio cumplido y alguno pendiente |
| LISTO PARA VALORACIÓN | Todos los obligatorios de la última fase cumplidos y sin alertas abiertas |
| DECISIÓN PENDIENTE | Listo y con una decisión de RTS solicitada al equipo, todavía sin registrar |

## 5. Ficha de lesión (§24)

Contiene:
- cliente, lesión (región y condición), lado, fecha, mecanismo;
- diagnóstico / información recibida (cifrada), profesional sanitario, fecha de alta clínica;
- protocolo y versión, fase actual, objetivos de la fase, restricciones;
- cargas actuales (enlazadas al plan de readaptación del cliente), últimos síntomas y feedback, tests;
- criterios con su estado, observaciones.

**Plan de readaptación**:
- es un plan normal del cliente, de tipo `readaptation`, creado desde las sugerencias de ejercicios y dosis de la fase;
- se edita en la misma tabla de sesión;
- el cliente lo entrena en su app como cualquier otro, y sus registros alimentan síntomas y carga tolerada.

## 6. Comparativas de readaptación (§25–§26)

**Selector**: CLIENTE ▾ · LESIÓN ▾ · FASE ▾ · EVALUACIÓN A ▾ · EVALUACIÓN B ▾.

- **Solo variables relevantes para esa lesión**: el protocolo declara sus tests (`recommended_test_ids` de cada fase) y la comparativa muestra solo esos.
  - Ejemplo: en un esguince de tobillo no aparecen los isocinéticos de rodilla.
- **Para cada variable**: valor A, valor B, cambio absoluto y %, LSI cuando hay lados, y una lectura:
  - **MEJORA**: cambio favorable que supera el error de medida (MDC) cuando se conoce;
  - **EMPEORA**;
  - **SE MANTIENE**: cambio dentro del error de medida;
  - **SIN DATOS**: falta una de las dos mediciones; nunca se rellena con cero.
- **Comparación por fases**: inicial vs intermedia, intermedia vs avanzada, avanzada vs RTS, RTS vs RTPerf. Cada fase toma su evaluación de cierre.
- **Línea base previa a la lesión** (si existe una evaluación anterior): referencia natural para el RTPerf.

## 7. Pantalla Return to Play (§28–§29)

Checklist con estado por ítem: cumple, pendiente, no aplica, más su evidencia.

- [ ] criterios clínicos recibidos
- [ ] tolerancia a carga
- [ ] ROM
- [ ] fuerza
- [ ] capacidad funcional
- [ ] tareas específicas
- [ ] carrera
- [ ] aceleración
- [ ] desaceleración
- [ ] COD
- [ ] exposición deportiva
- [ ] entrenamiento completo
- [ ] feedback del deportista
- [ ] valoración del equipo responsable

**Return to Performance**: además, compara fuerza, potencia, velocidad, capacidad específica, tolerancia de carga y exposición con la línea base previa o con la referencia elegida.

## 8. Contenido inicial por región (fase 7)

En la fase 7 se buscará la evidencia **específica de cada condición y fase** (`SCIENCE_SYSTEM.md` §4). Estado de partida:

| Región · condición | Evidencia de partida verificada | Qué respalda | Limitaciones |
|---|---|---|---|
| Rodilla · reconstrucción de LCA | Kyritsis et al., 2016 | No cumplir 6 criterios de alta antes de volver se asoció a un riesgo de rotura del injerto unas 4 veces mayor | 158 deportistas profesionales varones; estudio de cohortes |
| Rodilla · reconstrucción de LCA | Grindem et al., 2016 | Volver 9 meses o más tras la cirugía y con fuerza de cuádriceps más simétrica redujo las relesiones; los criterios exigían puntuaciones > 90 en todas las pruebas | 106 pacientes de deportes de pivote; cohorte |
| Isquiosurales · lesión muscular | van der Horst et al., 2017 | Consenso Delphi sobre la definición de RTP y los criterios: alta médica, ausencia de dolor a la palpación y en tests, flexibilidad similar, tests de campo, preparación psicológica; decisión compartida | Opinión de expertos (Delphi), fútbol |
| Isquiosurales · prevención | van Dyk et al., 2019 | Los programas con ejercicio nórdico **reducen la incidencia** de lesiones de isquiosurales hasta un 51 % | Metaanálisis de 15 estudios y 8 459 deportistas |
| Aductores / ingle · prevención | Harøy et al., 2019 | El Adductor Strengthening Programme (Copenhagen) **redujo la prevalencia** de problemas inguinales un 41 % | Ensayo aleatorizado por clusters en futbolistas varones semiprofesionales |
| Aductores · lesión aguda | Serner et al., 2020 | Los hallazgos de la exploración inicial se asociaron al tiempo de vuelta en tres hitos: sin dolor, entrenamiento controlado y entrenamiento completo | 81 deportistas varones; cohorte pronóstica |
| Tobillo · esguince lateral | Smith et al., 2021 (PAASS) | Consenso de los dominios a valorar para la vuelta: dolor, alteraciones del tobillo, percepción del deportista, control sensoriomotor y rendimiento deportivo | Delphi; **no fija umbrales numéricos** |
| Tendón rotuliano | Rio et al., 2015 frente a Holden et al., 2020 | El efecto analgésico inmediato de los isométricos se observó en 6 voleibolistas, pero no se replicó como superior a la contracción dinámica en un ensayo con 21 participantes | **Evidencia contradictoria**: se etiqueta así |
| Gemelo/Aquiles · tendinopatía | Silbernagel et al., 2007 | Seguir cargando con un modelo de monitorización del dolor no empeoró el resultado | Ensayo aleatorizado con 38 pacientes |
| Cuádriceps, hombro, codo, columna lumbar, cadera (flexor, glúteo) | — | Pendiente de búsqueda específica en la fase 7 | Hasta entonces: **criterio práctico**, marcado como tal |

**Asimetrías**: no hay un umbral único válido para todos los tests.
- En futbolistas profesionales, las asimetrías variaron entre el 5,2 % y el 14,5 % según la prueba (Read et al., 2021).
- La revisión sistemática de Bishop et al. (2018) encontró asociaciones con el rendimiento, pero sin ensayos controlados.
- Por eso la aplicación guarda el umbral **por test y por protocolo**, con su fuente, y lo etiqueta como orientativo.

**Los documentos aportados por el usuario** (`SCIENCE_SYSTEM.md` §2) se usan así:
- **Rutinas de aductores y de cuádriceps**: estructura en bloques (movilidad dinámica, reeducación postural, fortalecimiento isométrico/excéntrico, integración específica), con dosis y errores a evitar. Pasan a ser plantillas de tipo `risk_reduction`, etiquetadas según su evidencia: solo el componente Copenhagen tiene respaldo de reducción de prevalencia (Harøy et al., 2019).
- **Hoja de prevención individual**: sesiones por zona según las molestias del jugador y tres niveles por ejercicio (N1/N2/N3). Inspira el plan individual de reducción de factores de riesgo y la progresión por niveles dentro de un ejercicio.

## 9. Referencias verificadas (PubMed, 05–06/10/2026)

| Referencia | DOI | PMID |
|---|---|---|
| Ardern CL et al. 2016 Consensus statement on return to sport from the First World Congress in Sports Physical Therapy, Bern. *Br J Sports Med* 50(14):853-64 | [10.1136/bjsports-2016-096278](https://doi.org/10.1136/bjsports-2016-096278) | 27226389 |
| Shrier I. Strategic Assessment of Risk and Risk Tolerance (StARRT) framework for return-to-play decision-making. *Br J Sports Med* 2015;49(20):1311-5 | [10.1136/bjsports-2014-094569](https://doi.org/10.1136/bjsports-2014-094569) | 26036678 |
| Kyritsis P et al. Likelihood of ACL graft rupture: not meeting six clinical discharge criteria… *Br J Sports Med* 2016;50(15):946-51 | [10.1136/bjsports-2015-095908](https://doi.org/10.1136/bjsports-2015-095908) | 27215935 |
| Grindem H et al. Simple decision rules can reduce reinjury risk by 84% after ACL reconstruction. *Br J Sports Med* 2016;50(13):804-8 | [10.1136/bjsports-2016-096031](https://doi.org/10.1136/bjsports-2016-096031) | 27162233 |
| van der Horst N et al. Return to play after hamstring injuries in football: a worldwide Delphi procedure. *Br J Sports Med* 2017;51(22):1583-91 | [10.1136/bjsports-2016-097206](https://doi.org/10.1136/bjsports-2016-097206) | 28360143 |
| van Dyk N et al. Including the Nordic hamstring exercise in injury prevention programmes halves the rate of hamstring injuries. *Br J Sports Med* 2019;53(21):1362-70 | [10.1136/bjsports-2018-100045](https://doi.org/10.1136/bjsports-2018-100045) | 30808663 |
| Harøy J et al. The Adductor Strengthening Programme prevents groin problems among male football players. *Br J Sports Med* 2019;53(3):150-7 | [10.1136/bjsports-2017-098937](https://doi.org/10.1136/bjsports-2017-098937) | 29891614 |
| Serner A et al. Associations between initial clinical examination and imaging findings and return-to-sport in male athletes with acute adductor injuries. *Am J Sports Med* 2020;48(5):1151-9 | [10.1177/0363546520908610](https://doi.org/10.1177/0363546520908610) | 32182099 |
| Smith MD et al. Return to sport decisions after an acute lateral ankle sprain injury: introducing the PAASS framework. *Br J Sports Med* 2021;55(22):1270-6 | [10.1136/bjsports-2021-104087](https://doi.org/10.1136/bjsports-2021-104087) | 34158354 |
| Silbernagel KG et al. Continued sports activity, using a pain-monitoring model, during rehabilitation in patients with Achilles tendinopathy. *Am J Sports Med* 2007;35(6):897-906 | [10.1177/0363546506298279](https://doi.org/10.1177/0363546506298279) | 17307888 |
| Rio E et al. Isometric exercise induces analgesia and reduces inhibition in patellar tendinopathy. *Br J Sports Med* 2015;49(19):1277-83 | [10.1136/bjsports-2014-094386](https://doi.org/10.1136/bjsports-2014-094386) | 25979840 |
| Holden S et al. Isometric exercise and pain in patellar tendinopathy: a randomized crossover trial. *J Sci Med Sport* 2020;23(3):208-14 | [10.1016/j.jsams.2019.09.015](https://doi.org/10.1016/j.jsams.2019.09.015) | 31735531 |
| Bishop C et al. Effects of inter-limb asymmetries on physical and sports performance: a systematic review. *J Sports Sci* 2018;36(10):1135-44 | [10.1080/02640414.2017.1361894](https://doi.org/10.1080/02640414.2017.1361894) | 28767317 |
| Read PJ et al. Asymmetry thresholds for common screening tests and their effects on jump performance in professional soccer players. *J Athl Train* 2021;56(1):46-53 | [10.4085/1062-6050-0013.20](https://doi.org/10.4085/1062-6050-0013.20) | 33264407 |
| Serner A et al. Return to Sport After Criteria-Based Rehabilitation of Acute Adductor Injuries in Male Athletes: A Prospective Cohort Study. *Orthopaedic journal of sports medicine* 2020;8(1):2325967119897247 | [10.1177/2325967119897247](https://doi.org/10.1177/2325967119897247) | 32064292 |
| Serner A et al. Progression of Strength, Flexibility, and Palpation Pain During Rehabilitation of Athletes With Acute Adductor Injuries: A Prospective Cohort Study. *The Journal of orthopaedic and sports physical therapy* 2021;51(3):126-134 | [10.2519/jospt.2021.9951](https://doi.org/10.2519/jospt.2021.9951) | 33115342 |
| Doherty C et al. Treatment and prevention of acute and recurrent ankle sprain: an overview of systematic reviews with meta-analysis. *British journal of sports medicine* 2017;51(2):113-125 | [10.1136/bjsports-2016-096178](https://doi.org/10.1136/bjsports-2016-096178) | 28053200 |
| Kongsgaard M et al. Corticosteroid injections, eccentric decline squat training and heavy slow resistance training in patellar tendinopathy. *Scandinavian journal of medicine & science in sports* 2009;19(6):790-802 | [10.1111/j.1600-0838.2009.00949.x](https://doi.org/10.1111/j.1600-0838.2009.00949.x) | 19793213 |
| Askling CM et al. Acute hamstring injuries in Swedish elite football: a prospective randomised controlled clinical trial comparing two rehabilitation protocols. *British journal of sports medicine* 2013;47(15):953-9 | [10.1136/bjsports-2013-092165](https://doi.org/10.1136/bjsports-2013-092165) | 23536466 |
| Askling CM et al. Acute hamstring injuries in Swedish elite sprinters and jumpers: a prospective randomised controlled clinical trial comparing two rehabilitation protocols. *British journal of sports medicine* 2014;48(7):532-9 | [10.1136/bjsports-2013-093214](https://doi.org/10.1136/bjsports-2013-093214) | 24620041 |
| van Melick N et al. Evidence-based clinical practice update: practice guidelines for anterior cruciate ligament rehabilitation based on a systematic review and multidisciplinary consensus. *British journal of sports medicine* 2016;50(24):1506-1515 | [10.1136/bjsports-2015-095898](https://doi.org/10.1136/bjsports-2015-095898) | 27539507 |
| Knapik DM et al. Isolated, Full-Thickness Proximal Rectus Femoris Injury in Competitive Athletes: A Systematic Review of Injury Characteristics and Return to Play. *Orthopaedic journal of sports medicine* 2023;11(1):23259671221144984 | [10.1177/23259671221144984](https://doi.org/10.1177/23259671221144984) | 36743725 |

## 10. Implementación (reestructuración, fase 7)

**Dónde está.**
- Ficha del cliente → pestaña **Readaptación**. Aparece cuando el cliente tiene algún caso; para abrir el primero, Ficha → Salud → «Lesiones y readaptación →».
- Página del caso: `/app/clients/[id]/lesiones/[injuryId]`. Se llega en dos clics desde la ficha.
- Orden de la página:
  1. alertas sin revisar, porque bloquean el avance;
  2. fase actual con sus criterios y [Avanzar de fase];
  3. vuelta al deporte (checklist y decisiones);
  4. síntomas;
  5. comparativa de readaptación;
  6. información del caso y protocolo con sus fuentes.

**Modelo de datos** (`packages/db/src/schema/injury.ts`, migraciones 0041–0042).

Catálogo, global o del centro:
- `injury_conditions` → `injury_protocols`, versionados. Un caso abierto conserva la versión con la que empezó.
- Cada protocolo tiene `injury_protocol_phases` y `injury_protocol_criteria`, con rol, obligatorio, test y umbral si es automático, nivel de evidencia, fuentes y limitaciones.

Datos del cliente:
- `injuries` lleva el diagnóstico recibido cifrado.
- Tablas hijas: `injury_phase_history`, `injury_symptoms` (nota cifrada), `injury_alerts`, `injury_criterion_checks` y `rtp_decisions`.
- RLS: solo el equipo, nunca la app del cliente. Los hijos heredan organización y cliente del caso. Todo está en la matriz de seguridad.

**Reglas** (`packages/domain/src/injury/index.ts`):
- **Alertas** (§3):
  - dolor ≥ umbral del protocolo (5/10 por defecto, práctico);
  - empeoramiento o síntomas que persisten al día siguiente;
  - inflamación, inestabilidad, pérdida de función o reacción adversa → «Revisar antes de progresar»;
  - síntomas neurológicos → «Detener la progresión · Requiere valoración por profesional sanitario».
- **Criterios automáticos**:
  - valor de un test, o su **índice de simetría** (lado afectado / sano × 100), de la última evaluación posterior a la lesión;
  - sin dato no se cumplen; se pueden marcar a mano si se midieron fuera.
- **[Avanzar de fase]** lo pulsa el entrenador. Solo se activa con todos los criterios obligatorios cumplidos, sin alertas abiertas y sin criterio de parada; si no, la página dice por qué. Al avanzar se guarda el estado que lo permitió.
- **Estados**: No iniciado · En progreso · Criterios parciales · Listo para valoración · Decisión pendiente · Cerrado. **No existe «apto».**
- **Decisión de vuelta** (participación, deporte, rendimiento): la registra una persona con nombre, rol y fecha. El texto pasa el validador de lenguaje.
- **Comparativa**:
  - solo las variables del protocolo, con la línea base previa a la lesión y la fase en que cayó cada evaluación;
  - lectura «mejora / empeora» solo si el cambio supera el error de medida conocido.
- **Informe de readaptación**: congela fase, criterios, variables del protocolo, checklist y decisiones. El diagnóstico recibido no se incluye.

**Contenido inicial** (`seed-data/injury/protocols.json`, fuentes en `seed-data/evidence/injury.json`). Seis protocolos:
- LCA;
- isquiosurales;
- aductores;
- esguince lateral de tobillo;
- tendinopatía rotuliana;
- tendinopatía aquílea.

Cada criterio dice si es **con evidencia**, **consenso** o **criterio práctico**.

Umbrales con evidencia: solo los de los estudios de LCA (simetría > 90 % en Grindem 2016, con su limitación, p = 0,075) y los ≥ 9 meses tras la reconstrucción. El resto de umbrales numéricos son prácticos y así se muestran.

Tests nuevos (sin error de medida verificado, lo dicen sus limitaciones):
- salto unipodal a distancia;
- fuerza isométrica de extensores y de flexores de rodilla;
- elevaciones de talón unipodales.

**No encontrado** (queda como criterio práctico): revisión sistemática de vuelta tras lesión de cuádriceps no completa; metaanálisis específico ejercicio/recidiva de tobillo (se usa la revisión de revisiones de Doherty 2017). El valor exacto 5/10 del modelo de Silbernagel figura como [REQUIERE VERIFICACIÓN] en el texto completo.
