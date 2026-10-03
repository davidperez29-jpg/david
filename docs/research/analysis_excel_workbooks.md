# Fase 0 · Análisis de los 4 libros Excel de metodología (Rutinas Generales 1-4)

| Código | Libro | Semanas |
|---|---|---|
| WB1 | Rutina_General_1_Hipertrofia.xlsx | 36 |
| WB2 | Rutina_General_2_Salud_Fuerza_Funcional.xlsx | 36 |
| WB3 | Rutina_General_3_Rendimiento_Deporte_Equipo.xlsx | 20 |
| WB4 | Rutina_General_4_Hibrida_Futbol_Balonmano.xlsx | 36 |

Las 14 hojas son las mismas en los cuatro libros: Plani, Evaluación, Comparativa, Meso 1-5, Progresión, Volumen y cualidades, Banco de ejercicios, Batería preventiva, Listas y Referencias. "calc." = valor calculado por las fórmulas del propio libro; "texto" = valor declarado en una celda de texto.

## 1. Visión general

### 1.1 Rasgos comunes
- Los cuatro son **fullbody 3 días (L-X-V)** con 5 mesos de énfasis fijo:
  - M1 Adaptación (siempre 4 semanas).
  - M2 "Incremento de volumen muscular y capacidad de trabajo".
  - M3 "Absorción de fuerza, remodelación tendinosa y fuerza estructural" (FASE 1/FASE 2).
  - M4 "Reclutamiento de unidades motoras rápidas y RFD".
  - M5 "Máxima velocidad de ejecución".
- Plani contiene:
  - Perfil, Frecuencia, Material y Carga.
  - 9 prioridades (siempre las mismas 9 cualidades, en distinto orden).
  - Tabla de mesos: `Meso | Semanas | Énfasis del sistema | Adaptación a este perfil | Estructura de fuerza | Repeticiones | Carácter del esfuerzo · VBT | Pliometría | Progresión semanal | Evaluación | Cualidad dominante (calculada) | % tiempo | Contactos/sem`.
  - Microciclos: `Semana | Mesociclo | Cualidad dominante | Tipo de semana | Volumen relativo | Intensidad relativa`.
- K/L/M de la tabla de mesos son fórmulas sobre Volumen y cualidades (`L22=MAX('Volumen y cualidades'!B5:B13)`).
- **Ninguna fórmula referencia Plani**: volumen e intensidad relativos y prioridades son solo texto.

### 1.2 WB1 Hipertrofia
- **Perfil:** "Adulto de nivel intermedio que busca ganar masa muscular. Sin lesión activa".
- **Material:** barra, mancuernas, banco, poleas y bandas ("Sin kettlebells, cajones, TRX ni balón medicinal").
- **Volumen objetivo:** "Grupos grandes 12-20 series efectivas/semana (principal = 1, secundario = 0,5)".
- **Carga:** VL 20-30% en hipertrofia.
- **Calendario:** 36 semanas; E1 en S0, E2 en S12, E3 en S36.
- **Sesión:** 70-80 min declarados; 57-72 min calculados.

| Meso | Sem | Estructura | Reps | CE | Plio texto | Dominante calc. | % | Contactos calc. |
|---|---|---|---|---|---|---|---|---|
| 1 | S1-4 | Cluster técnico + triset (TI→tracción→core) + superseries | Cluster 6-8 (3+3→4+4) · 10-12/12-14/15-17 | RIR 3-4 · VL 15-20% | ≈40 | Hipertrofia | 40,4% | 42 |
| 2 | S5-12 | Cluster fuerza máx. + 3-4 superseries + analíticos | Cluster 4-6 · A 12-14/15-17 → B 8-10/10-12 | RIR 0-2 · VL 20-30% · cluster RIR 3 | ≈30 | Hipertrofia | 65,2% | 44 |
| 3 | S13-20 | Cluster + 1 par excéntrico + pares hipertrofia | Cluster 4-6 · A 8-10→B 6-8 · exc. 6-8→4-6 | RIR 1-3 | ≈40 | Hipertrofia | 41,8% | 52 |
| 4 | S21-28 | Global pesado ± contraste + superseries mecánicas | Global 4-6→3-5 · hip. 8-10→6-8 | Global VL<10-15% · hip. RIR 0-2 | ≈40 | Hipertrofia | 65,5% | 40 |
| 5 | S29-36 | Potenciación + global mantenimiento + rest-pause/drop sets | Potencia 3-5 · global 3-5→2-4 | Potencia VL<10% · hip. RIR 0-1 | ≈35 | Hipertrofia | 65,5% | 30 |

Normas: "tracción > empuje (ratio objetivo ≥1,2) · nunca 5 series · 4 series solo en el principal desde el Meso 2".

### 1.3 WB2 Salud
- **Perfil:** adulto de 35-65 años, principiante-intermedio.
- **Frecuencia:** 3 sesiones + 2-3 días aeróbicos ("mínimo eficaz 2 sesiones").
- **Material:** barra (también landmine), fitball, elásticos VERDE<AMARILLO<NARANJA y KB de 8-24 kg ("Mancuernas descartadas… Sin banco, poleas, cajón ni step").
- **Carga:** RIR 3-4, "nunca al fallo".
- **Sesión:** 45-50 min (calculado 45-49,5).
- **Plantilla manual**, sin autoprogresión.

| Meso | Estructura | Reps | CE | Dominante calc. | % | Contactos calc. |
|---|---|---|---|---|---|---|
| 1 | Circuito triset + tracción con elástico | 8-15 · unilat. 6-10 | RIR 4-5 | Adaptación/resistencia | 46,4% | 38 |
| 2 | Superseries TI+tracción · bisagra+empuje… | 10-15 | RIR 2-3 | Hipertrofia | 64,9% | 42 |
| 3 | Superseries con tempos e isometrías | 6-10 · isometrías 20-30'' | RIR 3 | Exc.-isométrica | 61,3% | 35 |
| 4 | Global principal (4 series) + fuerza/potencia | 5-8 / 5-10 | RIR 3 · potencia VL<10% | Fuerza máxima | 44,6% | 40 |
| 5 | Potencia ligera + mantenimiento + equilibrio | 4-8 | VL<10% · RIR ≥3 | Potencia | 37,1% | 81 |

Tipos de semana propios de WB2:
- M2: Técnica / Volumen / Densidad (−15'') / Descarga / Carga / Carga y volumen / Pico / Descarga + test.
- M3: Excéntrico 3'' / +pausa / 4'' / Descarga / Isometría / … / Pico excéntrico.
- M4: Base / Fuerza / Pico / Descarga / Potencia / …
- M5: Técnica rápida / Velocidad / Reactiva / Descarga / Multidirección / Contraste / Pico reactivo.

### 1.4 WB3 Deporte de equipo
- **Encaje en la temporada:** M1 transición, M2 fuera de temporada, M3 inicio de pretemporada, M4 pretemporada, M5 final de pretemporada.
- **Material:** gimnasio de club completo.
- **Calendario:** 5×4 = 20 semanas; E1 en S0, E2 en S8, E3 en S20. Plantilla manual.
- **Temporada (solo texto):** "MD-4 fuerza + potencia (3×3-5, VL<10%) y MD-2 neural (30-40 contactos + nórdico/Copenhague). Nada pesado en MD-1".

| Meso | Estructura | Reps | CE | Plio texto | Dominante | % | Contactos |
|---|---|---|---|---|---|---|---|
| 1 | Triset + superserie prevención | 10-15 | RIR 3-4 | ≈110 | Adaptación | 38,6% | 115 |
| 2 | Global + superseries fuerza-prevención | MET 10-12 → MEC 6-8 | RIR 1-2 · VL 20-30% | ≈105 | Hipertrofia | 56,3% | 105 |
| 3 | Tempos → sobrecarga excéntrica + frenadas | 4-8 | RIR 3 | ≈100 | Exc.-isom. | 57,5% | 97,5 |
| 4 | Olímpico + contraste + prevención | 2-5 | VL<10-15% · RIR 2-3 | ≈115 | Fuerza máx. | 36,5% | 114 |
| 5 | Pliometría continua + velocidad + potencia | 2-6 | VL<10% · RIR ≥4 | ≈125 | Potencia | 40,6% | 130 |

### 1.5 WB4 Híbrido
- **Perfil:** fútbol y balonmano + hipertrofia, "preservando rodilla, tobillo, sínfisis púbica y hombro".
- **Material:** completo, más oscilatorios (KB colgadas con bandas).
- **Plantilla:** auto (igual que WB1). 36 semanas.
- **Oscilatorios:** "50-70% del 1RM estable… su efecto sobre la RFD no está demostrado".
- **Norma:** "nórdico solo en sesión de fuerza".

| Meso | Estructura | Reps | CE | Plio texto | Dominante | % | Contactos |
|---|---|---|---|---|---|---|---|
| 1 | Isometría + cluster técnico + triset + superseries | iso 20-30'' · cluster 6-8 · 10-12/12-14 | RIR 3-4 | ≈50 | Hipertrofia | 23,8% | 42 |
| 2 | Lanzamientos + cluster + superseries + prevención | Cluster 4-6 · A 10-12→B 8-10 | RIR 1-2 · VL 20-30% | ≈45 | Hipertrofia | 49,0% | 50 |
| 3 | F1 tempos · F2 deceleración + exc. acentuado | 4-8 | RIR 2-3 | ≈60-90 | Exc.-isom. | 46,5% | 70 |
| 4 | Contraste + superseries (F2 oscilatoria) | 3-6 / 4-6 / 6-10 | VL<10-15% · RIR 1-3 | ≈40 | Fuerza máx. | 28,3% | 24 |
| 5 | Pliometría/sprint + mantenimiento + oscilatorios | 2-6 | VL<10% · RIR ≥2 | ≈90-110 | Potencia | 39,7% | 39 |

### 1.6 Prioridades (orden)
| Cualidad | WB1 | WB2 | WB3 | WB4 |
|---|---|---|---|---|
| Hipertrofia | 1 | 7 | 7 | 1 |
| Fuerza máxima | 2 | 5 | 4 | 2 |
| Exc.-isométrica | 3 | 9 | 5 | 3 |
| Adaptación/resistencia | 4 | 1 | 6 | 8 |
| Core y prevención | 5 | 2 | 3 | 5 |
| Movilidad y activación | 6 | 3 | 8 | 7 |
| Potencia/fuerza rápida | 7 | 6 | 2 | 4 |
| Pliometría/reactiva | 8 | 8 | 1 | 6 |
| Acondicionamiento | 9 | 4 | 9 | 9 |

## 2. Metodología común
- **Periodización:** bloques secuenciales de énfasis con mantenimiento de todas las cualidades en cada sesión. Microciclo 3:1, que en los mesos de 8 semanas se repite dos veces: S1-3 rango A, S4 descarga, S5-7 rango B, S8 descarga + test.
- **Orden de la sesión:** "A activación → B pliometría/neural → C fuerza principal → D-G superseries y accesorios → acondicionamiento".
- **Alternancia de patrones** ("nunca dos ejercicios seguidos del mismo patrón"): solo texto, ninguna fórmula la valida.
- **Valores relativos de microciclo:**

| Perfil | Volumen intro / progresión / pico / descarga | Intensidad relativa |
|---|---|---|
| WB1 | 0,85 / 0,95 / 1 / 0,6 | 0,60→0,88 |
| WB2 | 0,8 / 0,9 / 0,95-1 / 0,6 | 0,45→0,75 |
| WB3 | 0,8 / 0,9 / 1 / 0,6 | 0,55→0,88 |
| WB4 | 0,85 / 0,95 / 1 / 0,6 | 0,60→0,88 |

  Texto: "descarga ≈ −40% de volumen". En las hojas Meso la descarga es −1 serie y RIR +2 (WB1/WB4).
- **Carácter del esfuerzo** (González-Badillo vía Bautista): "ligero VL 5-10% · medio 15-30% · alto 25-30% · máximo 50-70% (fallo)".
- **VL:** solo texto (hipertrofia 20-30%, cluster <10%, potencia <10%). No hay campos de velocidad.
- **Tempo:** notación "bajada-pausa-subida-pausa", X = intención máxima. Solo texto.
- **Descansos (Bautista):** triset 30''/90''; superserie 45-60'' y 2' tras el par; global 2-3'; potencia con recuperación completa; pliometría 3-5'' entre reps y 1-2' entre series; cluster 20'' intra-serie y 3' entre series.
- **Métodos:**
  - Cluster técnico ("2 bloques con 20''… 6-8 reps (3+3→4+4) al ~70% · RIR 4 · VL<10%").
  - Cluster de fuerza máxima (2+2→3+3, ~80-85%, RIR 3).
  - Triset, superserie agonista-antagonista.
  - Contraste/PAPE ("20-30'' hasta el salto").
  - Potenciación ("≈10% del peso corporal").
  - Rest-pause (15'') y drop set en la última serie.
  - Excéntrico acentuado, 2:1 y Ex-Ac.
  - Isometría "estructural-analgésica" ("20-30'' a ~70-80% del esfuerzo máximo percibido, 60'' de pausa").
  - Isometría de rodilla con doble progresión ("TIEMPO 30''→35''→40'' y después 30'' AÑADIENDO CARGA", alternando vectores).
  - Oscilatorios (WB4) y olímpicos (WB3/WB4).
- **Doble progresión (literal):** "1) si TODAS las series llegaron al tope → sube (mínimo +kg o lo que indique O'Connor); 2) si alguna quedó por debajo → baja lo que indique O'Connor (máximo 2 escalones); 3) mantiene. Descargas: misma carga, −1 serie y RIR +2. Cambio de rango (S5): recálculo con O'Connor desde el 1RM estimado de S3".
  - Modificadores: S1 RIR A+1; S2-3 RIR A; S4 S−1 y RIR A+2; S5 rango B y RIR B+1; S6-7 RIR B; S8 S−1 y RIR B+2.
- **Diferencias por perfil:**
  - Sesión: 70-80 / 45-50 / 60-75 / 55-70 min.
  - Contactos calculados: 30-52 / 35-81 / 97,5-130 / 24-70.
  - Ratio tracción/empuje calculado: 1,38-1,67 / 1,67-2,17 / 1,22-2,00 / 1,38-1,67.
  - Series/semana: 101-110 / 69-91 / 87-105 / 94-107.
  - RIR mínimo: 0 / 2 / 1 / 1.
  - Referencia de fuerza: van den Hoek P10-P75 elegible / P10 fijo / 1,66×MC (Styles) / 1,66×MC.

## 3. Hojas Meso (modelo de datos)

### 3.1 Cabeceras exactas
- **Plantilla auto (WB1, WB4):** `BLOQUE | EJERCICIO (escribe y abre ▼ para buscar) | Silueta | Vídeo | S | r | R | r B | RIR A | RIR B | +kg | 1RM inicial |`
  - Por cada semana: `Objetivo | Kg obj. | Kg | S1 | S2 | S3 | S4 | RIR | 1RM est. |`
  - Al final: `1RM final | Δ % | Tips | Cualidad | Patrón de movimiento | Grupo 1º (×1) | Grupo 2º (×0,5) | Min | Contactos | Fase activa | Peso semanal | S × peso | Min × peso | Cont. × peso`.
- **Plantilla manual (WB2, WB3):** `BLOQUE | EJERCICIO | Silueta | Vídeo | S | r | R |`
  - Por cada semana: `Objetivo | Kg | S1..S4 | RIR | 1RM est. |`
  - Al final, las mismas columnas de clasificación.

Semántica de los campos:
- S1..S4 son las repeticiones o segundos de cada serie (máximo 4 series).
- Kg es **una sola carga por semana**; RIR es el de la última serie.
- r/R pueden ser reps, segundos ("20''"), metros ("15 m") o minutos ("4'"). La unidad va implícita en el texto.
- BLOQUE = código + emoji (♟️ Global, 🏃 Unilateral, 🎯 Analítico, ⚡ Neural/plio, 🛡️ Preventivo/core, 🔥 Acondicionamiento).
- Fase activa: 0/1/2. Peso semanal: 1 o 0,5. La fase inactiva muestra "— otra fase —".
- Min y Contactos son constantes manuales: activación 2; plio 3; cluster 9,5 (3 series) / 12,5 (4 series); 1.º de superserie 7, 2.º 5; triset 5/5/4,5; contraste 6.
- Pie de cada día: duración y contactos.
- Tabla de adherencia `ENTRENAMIENTOS | % | S1..S8` (1 = hecha; `C66=SUM(D66:G66)/4`), que no se usa en ningún otro cálculo.

### 3.2 Fórmulas clave (WB1)
```
G =$F+2
L (Meso 1) =IFERROR(1/(1/Evaluación!$R$22),"")
L (Meso 2+) =IFERROR(1/(1/INDEX('Meso 1'!$AW:$AW,MATCH($B19,'Meso 1'!$B:$B,0))),"")  [básicos: fallback Evaluación R24→R23→R22]
Objetivo S1 =MAX(1,$E-0)&"×"&$F&"-"&($F+2)&" · RIR "&MAX(0,$I+1)
Kg obj S1 =MROUND($L/(1+0.025*($F+MAX(0,$I+1))),$K)
1RM est =O*(1+0.025*(MIN(P:S)+IF(ISNUMBER(T),T,MAX(0,$I+1))))   [la plantilla auto asume el RIR objetivo si no se registra; la manual lo exige]
Kg obj S2 =IF(no Kg,N, IF(sin reps,O, IF(COUNTIF(P:S,">="&($F+2))>=E, MAX(O+K, MROUND(U/(1+0.025*($F+I)),K)),
            IF(COUNTIF(P:S,"<"&$F)>0, MAX(O-2*K, MIN(O, MROUND(U/(1+0.025*($F+I)),K))), O))))
Descarga: Objetivo =MAX(1,E-1)&… RIR I+2 ; Kg obj = Kg de S3
S5 rango B: Kg obj =MROUND(1RM_S3/(1+0.025*($H+$J+1)),$K)
1RM final = último 1RM est.; Δ% = final/inicial − 1
S×peso = E·peso; Min×peso; Cont×peso; Duración = MAX(SUMIFS(min, fase<>2), SUMIFS(min, fase<>1))
```
- **Carga:** %1RM = 1/(1+0,025·(reps+RIR)).
  - Ejemplos: cluster M1 S1 (6+5) = 78,4%; S2 = 80%; cluster M2 (4+4) = 83,3%; M4 rango B (3+2) = 88,9%; hipertrofia 12+3 = 72,7%.
  - Redondeo al incremento: 2,5 kg (barra y poleas) o 2 kg (mancuernas).

### 3.3 Variables de programación
- **Programa:** perfil, frecuencia, días, duración objetivo, material, calendario de evaluaciones, normas (máximo de series, ratio, alternancia), prioridades.
- **Meso:** énfasis, adaptación, estructura, rangos, CE, tempo, plio objetivo, progresión, fases.
- **Semana:** tipo, volumen e intensidad relativos, fase, ΔSeries, ΔRIR, rango A/B, Δdescanso.
- **Sesión:** día, título, duración, contactos.
- **Bloque:** letra, tipo, agrupación, descansos.
- **Ejercicio prescrito:** series, rango A y B, RIR A y B, +kg, 1RM inicial, unidad, por lado, tempo, descanso, VL, %1RM, método (cluster con bloques e intra-descanso, rest-pause, drop, 2:1, excéntrico acentuado, oscilatorio, contraste), cualidad, patrón, músculos 1.º y 2.º, minutos, contactos, fase, peso, tips.
- **Registro:** Kg/semana, reps por serie (×4), RIR de la última serie, sesión hecha.
- **Mencionados sin campo:** velocidad/VL, DOMS 0-10, color del elástico.

## 4. Evaluación y Comparativa

### 4.1 Datos del evaluado
- Campos: Nombre, Sexo, Edad, Franja de edad, Fecha, Masa, Talla, Longitud de la pierna, Altura de la cresta ilíaca a 90º y hpo (= longitud − altura). Tres columnas: E1, E2 y E3.
- **Franja de edad:** calculada (12-17 / 18-35 / 36-59 / 60-79 / 80+).
- **Nivel de referencia:** en WB1 se elige (P10/P25/P50/P75); en WB2 está fijado en P10.
- **Condiciones:** misma hora, calentamiento y material, y 48 h sin entrenamiento intenso de piernas.

### 4.2 1RM
- **Cabeceras:** `Ejercicio | Evaluación | Carga serie | Reps + RIR (≤12) [WB1/4] / Reps (≤10) a RIR 0-1 [WB2/3] | 1RM O'Connor/Epley | Epley (control)/Brzycki | 1RM por reps | Carga 1-4 | Vel. 1-4 | V1RM | 1RM por velocidad | 1RM final | Método | Fuerza relativa | Referencia | % ref. | Δ% vs E1 | ¿Cambio > error (≈10%)?`.
- **Ejercicios por libro:**
  - WB1: sentadilla (V1RM 0,32), banca (0,16), PM (0,24), press militar, remo inclinado.
  - WB2: PM, sentadilla (o frontal doble KB), press de suelo, militar, remo.
  - WB3: sentadilla, banca, PM, remo, dominada lastrada.
  - WB4: los 7 anteriores más PM rumano.
- **Fórmulas:**
  - O'Connor `C*(1+0.025*D)` (D = 1-12).
  - Epley `C*(1+D/30)`.
  - Brzycki `C*36/(37-D)` (D ≤ 10). En WB2/WB3, 1RM por reps = media de Epley y Brzycki.
  - Velocidad: `(V1RM−INTERCEPT(v,carga))/SLOPE(v,carga)`, con ≥3 cargas.
  - Método preferente: directo > velocidad > repeticiones.
  - Fuerza relativa = 1RM / masa.
  - `X = |Δ|>0,1 → "Sí"`.
  - Ratio remo/banca: "descriptivo".
- **Tabla van den Hoek 2024 (WB1/WB2, 120 filas):** sentadilla, banca y PM × H/M × 5 franjas × P10/P25/P50/P75.
  - Ejemplos: sentadilla H 18-35 = 1,75/2,00/2,28/2,57; banca M 36-59 = 0,62/0,74/0,90/1,09.
  - "P25/P75 estimados como punto medio de los deciles (FitnessNorms)… No son normas de población general".
- **WB3/WB4:** `U = IF(H,1.66,"")` (Styles 2016); sin referencia para mujeres.

### 4.3 Perfil F-V (los 4 libros)
- **Protocolo:** CMJ con manos sobre la barra, carga 0 + 3-4 cargas (≈25/50/75% MC), 2 intentos, 2' entre intentos y 4-5' entre cargas.
  - WB2: opcional y con cargas ligeras (≈10/20/30%).
- **Fórmulas:**
  - F = (m+carga)·9,81·(h/hpo+1); v = √(9,81·h/2); P = F·v.
  - SFV = SLOPE (n ≥ 2); F0 = INTERCEPT; V0 = −F0/SFV; Pmax = F0·V0/4; R² con n ≥ 3.
  - Valores relativos por kg.
  - SFVopt por Cardano: b = −9,81/√Pmaxrel; d = −2√Pmaxrel/hpo; p = −b²/3; q = 2b³/27 + d; Δ = (q/2)²+(p/3)³; t = ∛(−q/2+√Δ)+∛(−q/2−√Δ); x = t−b/3; SFVopt = −x².
  - FV% = SFVrel/SFVopt·100; FVimb = |100−FV%|.
- **Categorías:** <60 Déficit de fuerza alto · <90 bajo · ≤110 Equilibrado · ≤140 Déficit de velocidad bajo · >140 alto.
- **Proporción de trabajo** (sobre 6 ejercicios × 3 series): 3F·2FP·1P / 2·2·2 / 1F·1FP·2P·1PV·1V / 2V·2PV·2P / 3V·2PV·1P. **No alimenta las hojas Meso.**

### 4.4 Tests complementarios
- **WB2:** sentarse-levantarse 30 s (silla ≈43 cm, Jones 1999), equilibrio monopodal (máx. 60 s, mejor de 2), plancha (s), flexiones (reps). Solo Δ%, sin referencias.
- **WB3/WB4:** `Prueba | E1-E3 | Δ% | Error típico (CV %) | ¿Cambio real E3? | Referencia | % ref. | Fuente`.

| Prueba | Fórmula | CV | Ref. H / M |
|---|---|---|---|
| CMJ (cm) | — | 4,3 | 38,6 / 31,0 |
| SJ | — | 3,7 | 33,9 / — |
| EUR | CMJ/SJ | — | descriptivo |
| RSImod | (CMJ/100)/t despegue | 5,6 | 0,419 / 0,308 "PROVISIONAL" (Sole 2018) |
| RSI DJ 30 cm | (h/100)/(tc/1000) | 8,2 | sin norma |
| Sprint 10/20/30 m | Δ invertido | introducir | 1,83/3,09/4,00 · 2,139/3,58/— |
| 505 D / ND | invertido | 2,2 H / 1,9 M | 2,373/2,453 · 2,615/2,724 |
| Déficit COD | 505D − 10 m | — | 0,441 / 0,476 |
| Asimetría 505 | (D−ND)/D·100 | — | descriptivo |
| 30-15 IFT | — | 1,8 | 19,0 / 17,1 |
| Pmax F-V | enlace | — | — |

- Regla de cambio real: `|Δ%E3|·100 > CV`.
- Radar 1: % de la referencia de fútbol. Radar 2: % respecto a E1.
- **Anunciados en Plani pero sin campo en Evaluación:** CMJ unilateral, ángulo del nórdico, Copenhague (s), sentadilla en pared (s), DOMS 0-10, salto horizontal.

### 4.5 Comparativa (idéntica en los 4 libros)
- **Entradas:**
  - Sexo, forzado a `Evaluación!B7`.
  - Nivel de referencia para Z=0: Principiante / Novato / Intermedio / Avanzado / Élite.
  - Hasta 3 evaluaciones de 6.
  - Peso de referencia: masa de A, o 80 kg H / 60 kg M.
- **Tabla de datos:** masa, %grasa, MLG = masa·(1−%/100), 1RM de sentadilla, PM, PMR, banca, remo, militar y dominada (lastre; carga total = masa + lastre).
- **Base normativa:** Strength Level y Strength Calculator; ratio por sexo × ejercicio × masa (H 50-100, M 40-80; dominadas H 60-100, M 50-70) × 5 niveles ("más fuerte que el 5, 20, 50, 80 y 95% de sus usuarios").
- **Cálculos:**
  - μ por interpolación lineal cada 10 kg.
  - σ = (Avanzado−Novato)/(2·NORMSINV(0,8)).
  - Z = (ratio−μ)/σ.
  - Percentil = NORMSDIST((ratio−Intermedio)/σ).
  - Nivel alcanzado = mayor umbral superado.
  - ΔZ entre evaluaciones; radares.
  - Nota alométrica (masa^0,67).

## 5. Progresión
- **Sección 1:** 1RM est. semanal de los básicos (S1-S36, o S1-S20 en WB3), con columnas espejo #N/A para el gráfico.
  - Fórmula: `=IFERROR(1/(1/INDEX('Meso 2'!$BE:$BE,MATCH("Sentadilla",'Meso 2'!$B:$B,0))),"")`.
  - Busca **nombres literales** con alternativas codificadas ("Press Banca Plano" o "…- clusters"; "Remo Inclinado con Barra" o "…, parada") y toma la primera aparición.
  - Básicos por libro:
    - WB1/WB4: sentadilla, banca, PM, PMR, remo, hip thrust.
    - WB2: PM, sentadilla frontal doble KB, remo, press de suelo, puente con barra.
    - WB3: sentadilla, PM, hip thrust, búlgara, banca.
- **Sección 2:** `Meso | Día · bloque | Ejercicio | 1RM inicial | 1RM final | Δ % | Semanas`, con referencias directas a celdas Meso. En WB2 incluye ejercicios isométricos y con elástico.

## 6. Volumen y cualidades
- **Base:** "ponderadas por las semanas en que cada ejercicio está activo (un ejercicio de una sola fase cuenta al 50%)".
- **Métricas:**
  1. % por cualidad según tiempo: `SUMIFS(Min×peso,Cualidad)/total`. La cualidad máxima alimenta Plani.
  2. % por cualidad según series.
  3. Series efectivas por músculo: `SUMIFS(S×peso,1º=G) + 0,5·SUMIFS(S×peso,2º=G)`.
  4. Series por patrón.
  5. Contactos, duración A/B/C, series totales, tracción (H+V), empuje (H+V) y ratio "(objetivo > 1)".
- "Saltos, sprints y lanzamientos no suman series de grupo muscular".
- **Es una semana tipo:** series base, sin descargas.
- **Valores calculados (series efectivas M1→M5):**
  - WB1: cuádriceps 15/10/10/10/9; glúteo 12/11,5/11,5/11,5/10,5; isquios 7,5/11,5…; pectoral 12-16; espalda 19,5-23; bíceps 12-15.
  - WB2: cuádriceps 13/7,5/11,75/8,5/6; pectoral 6→2.
  - WB3: cuádriceps 13,5→3; core 24 en M1.
  - WB4: espalda 18-21,5; glúteo 7,75-11,5.
- **Texto de dosis plio:** WB1 "≈20-50/sem; principiante 40-80/sesión (McNeely)"; WB3 "de Villarreal 80-120/sem; Chu & Shiner 100-150 / 150-300".

## 7. Banco de ejercicios y Batería preventiva

### 7.1 Banco
- **Cabeceras:** `Bloque de sesión | Ejercicio | Silueta | Vídeo (URL) | Fuente`.
- **Listas:** copia alfabética que alimenta el buscador por prefijo (`OFFSET(LE1,MATCH($B&"*",LE,0)-1,0,COUNTIF(LE,$B&"*"),1)`). Nombres definidos: BancoEjercicios, LE, LE1.
- **No incluye** patrón, músculos, cualidad, material ni nivel: esa taxonomía se asigna por fila en las hojas Meso.

| Libro | Ejercicios | Con vídeo | MPE-Vitafit / Personalizado / MPE_Vitafit-Audiofit.xls |
|---|---|---|---|
| WB1 | 886 | 780 | 820 / 64 / 2 |
| WB2 | 591 | 474 | 514 / 76 / 1 |
| WB3 | 1.126 | 1.010 | 1.051 / 73 / 2 |
| WB4 | 1.129 | 1.009 | 1.049 / 78 / 2 |

- **Diferencias de nombres:** WB1−WB2 = 331; WB3−WB1 = 242; WB4−WB3 = 5. Es un banco maestro filtrado por material.
- **Valores de "Bloque de sesión" (unión):** Acondicionamiento · Activación · Calentamiento dinámico MBSC · Activación · Movilidad dinámica · Activación · Movilidad dinámica de cadera (Rusin) · Activación · Técnica de carrera y coordinación · Agilidad reactiva · Batería preventiva · Tipo 1 · Movilidad dinámica · Batería preventiva · Tipo 2 · Reeducación postural / control motor · Batería preventiva · Tipo 3 · Fortalecimiento · Batería preventiva · Tipo 4 · Ejercicio integrado específico de fútbol · Calentamiento completo · Cambio de dirección / deceleración · Core · Lateral (antiflexión) · Core · Pilar (antiextensión) · Core · Rotación / antirrotación · Fuerza · Dominante de cadera · Fuerza · Dominante de rodilla · Fuerza · Empuje · Fuerza · Tracción · Hipertrofia · Bíceps / Cuádriceps / Espalda / Glúteos / Hombro / Pecho / Tríceps · Personalizado · Activación · Personalizado · Activación · Escápula (MBSC) · Personalizado · Bisagra de cadera · Personalizado · Core · Personalizado · Desaceleración · Personalizado · Isometría (Batería #47) · Personalizado · Isometría de rodilla · Personalizado · Oscilatorio (carga inestable) [WB4] · Personalizado · Pre-pliometría (Bautista) · Personalizado · Salud / Salud · Elástico [WB2] · Pliometría · Stiffness · Potencia · Explosivos y olímpicos · Velocidad y aceleración [WB3/4].
- **Recuentos WB1:** Fuerza·Empuje 100, Dominante de cadera 92, Acondicionamiento 84, Tracción 76, Core Pilar 74…
- **Silueta:** "#n" solo en ≈91-104 filas.
- **Taxonomía de las hojas Meso:**
  - Cualidad (9): Movilidad y activación, Core y prevención, Pliometría/reactiva, Potencia/fuerza rápida, Fuerza máxima, Hipertrofia, Fuerza excéntrica-isométrica, Adaptación/resistencia de fuerza, Acondicionamiento.
  - Patrón (17): Dominante de rodilla, Dominante de cadera, Empuje H, Empuje V, Tracción H, Tracción V, Core antiextensión, Core antirrotación/rotación, Core antiflexión lateral, Transporte (carry), Salto/pliometría, Lanzamiento, Triple extensión (olímpicos), Sprint/cambio de dirección, Movilidad/activación, Aislamiento, Acondicionamiento.
  - Músculos (11): Cuádriceps, Glúteo, Isquiosurales, Aductores, Gemelo-sóleo, Pectoral, Espalda (dorsal-trapecio), Deltoides, Bíceps, Tríceps, Core.

**Muestra de 15 filas (WB1):**

| Bloque | Ejercicio | Silueta | Vídeo | Fuente |
|---|---|---|---|---|
| Acondicionamiento | Box Jump | | youtu.be/vzIA5Wd9wTU | MPE-Vitafit |
| Activación · Calentamiento dinámico MBSC | Andar con piernas rectas | | | MPE-Vitafit |
| Activación · Movilidad dinámica | Cruce por delante, por encima y por detrás | | | MPE-Vitafit |
| Activación · Movilidad dinámica de cadera (Rusin) | Deep Squat to Hamstring Dynamic Stretch | | | MPE-Vitafit |
| Activación · Técnica de carrera | A-Skips | #19 | youtu.be/-Z6VRjHywwI | MPE-Vitafit |
| Batería · Tipo 1 | Balanceo de pierna lateral con apoyo | #3 | | Personalizado |
| Batería · Tipo 2 | Aeroplano de cadera | #23 | | Personalizado |
| Batería · Tipo 3 | Aducción de cadera de pie con banda (excéntrico) | #59 | | Personalizado |
| Batería · Tipo 4 | Aterrizaje asimétrico desde cajón bajo | #73 | | Personalizado |
| Calentamiento completo | Calentamiento Velocidad | | youtu.be/ElOLfiGw44U | MPE-Vitafit |
| Cambio de dirección / deceleración | Progresión deceleraciones | | youtu.be/UnNHV4PyUmQ | MPE-Vitafit |
| Core · Lateral | Crunch 2D en plancha lateral | | youtu.be/Cdsq0tatpYU | MPE-Vitafit |
| Core · Pilar | Alcances V en Hollow | | youtu.be/nUi6RK17kT8 | MPE-Vitafit |
| Core · Rotación | Anti Rotación arrodillado en polea | | youtu.be/7wZ0lv3RUlY | MPE-Vitafit |
| Fuerza · Dominante de cadera | Abducción de cadera en polea KC | | youtu.be/srayTxTnfwI | MPE-Vitafit |

### 7.2 Batería preventiva (93 fichas, igual en los 4 libros)
- **Cabeceras:** `Nº | Tipo | Ejercicio (nombre en el Banco) | Silueta | Modo | Zona objetivo | Dosis | Ejecución y justificación | Error a evitar | Vídeo | Uso en esta rutina`.
- **Tipos:** Tipo 1 Movilidad dinámica 22 (#1-22) · Tipo 2 Reeducación postural/control motor 23 (#23-45) · Tipo 3 Fortalecimiento 26 (#46-71) · Tipo 4 Integrado específico de fútbol 22 (#72-93).
- **Modo:** "—" 67, Excéntrico 18, Isométrico 5, Concéntrico controlado 1, Excéntrico progresivo 1, Concéntrico-excéntrico 1.
- **Fichas usadas en cada rutina:** 21 / 27 / 27 / 37.
- **Regla:** "máximo 2 series por ejercicio, nunca al fallo… Excepción: el curl nórdico (niveles 1-3) va en la sesión de fuerza".
- **Fuente:** documento del cuerpo técnico del Crevillente Deportivo.

## 8. Referencias
- **Volumen:** 69 únicas (WB1 41 · WB2 34 · WB3 58 · WB4 67).
- **Columnas:** `Nº | Referencia | DOI / enlace | Qué se ha tomado | Dónde se aplica | Verificación | Aplicabilidad y limitaciones`.
- **Verificación:** Resumen consultado 22 · Cita estándar (no reconsultada) 19 · Indirecta (citada en otra fuente) 8 (+2 combinadas con documento) · Texto completo 8 · Documento aportado 7 · Fuente secundaria 2 (van den Hoek 2024 vía FitnessNorms, con P25/P75 estimados; Greig 2023) · Criterio del entrenador 1.
- Detalle completo en la sección REFERENCE LIST al final.

## 9. Clasificación de la evidencia
Escala: A fuerte · B moderada · C limitada · D contradictoria · E mecanismo plausible · F recomendación práctica · G opinión · H no verificada. Lo marcado "fuera del Excel" debe verificarse antes de usarlo en el producto.

| # | Afirmación | Grado | Justificación |
|---|---|---|---|
| 1 | %1RM = 1/(1+0,025·(reps+RIR)) | C/F | Ecuación poblacional que pierde precisión >10 reps; sumar el RIR es una extensión no validada |
| 2 | 1RM est. = serie con menos reps + RIR de la última | F/C | Pragmático; mezcla series distintas |
| 3 | RIR para autorregular | B | Válido sobre todo en entrenados y cerca del fallo (Zourdos, Helms) |
| 4 | Doble progresión con rangos de 2 reps | F | Práctica extendida, sin comparativas directas |
| 5 | "más VL → más hipertrofia" (VL 20-30%) | B/D | Pareja-Blanco 2017: VL40 > VL20 en hipertrofia; síntesis posteriores muestran efectos pequeños o inconsistentes (fuera del Excel) |
| 6 | VL <10% en potencia/fuerza | B | Ganancias similares con menos fatiga |
| 7 | Tabla de CE (5-10 / 15-30 / 25-30 / 50-70) | G | Clasificación de escuela con rangos solapados |
| 8 | 12-20 series/semana | B | Dosis-respuesta (Schoenfeld 2017); techo incierto |
| 9 | Conteo fraccional 1/0,5 | C/F | Convención práctica; el músculo 2.º es arbitrario |
| 10 | Contar como "efectivas" las series de activación, preventivas y RIR 4-6 | D | Contradice la definición de serie efectiva |
| 11 | El cluster "preserva adaptaciones neurales y permite más carga en hipertrofia" | E | Especulativo |
| 12 | Los clusters mantienen la velocidad | B | Agudo sólido; crónico pequeño |
| 13 | Superseries sin pérdida de rendimiento | B | Ahorran tiempo; rendimiento similar |
| 14 | Trisets/circuitos de adaptación | F | Organización práctica |
| 15 | Contraste con 20-30'' antes del salto | D | El PAPE suele requerir ≈4-10'; con 20-30'' domina la fatiga |
| 16 | Potencia "solo como PAPE" antes de los globales | C/E | Beneficio crónico no demostrado |
| 17 | "La sobrecarga excéntrica es un estímulo hipertrófico potente" | C | Excéntrico ≈ concéntrico en hipertrofia |
| 18 | "…protege el tendón" | C/E | El tendón responde a la magnitud de la carga, no al tipo de contracción |
| 19 | Isometría 20-30'' → rigidez (Kubo 2001) | B/C | Kubo usó 70% de la CVM medida, no "esfuerzo percibido" |
| 20 | Isometría "analgésica" (Rio 2015) | D | n = 6, 5×45 s; ensayos posteriores no la replican (fuera del Excel) |
| 21 | Doble progresión isométrica (tiempo → carga) | F | Regla práctica |
| 22 | Nórdico previene lesiones de isquios | A | ECA y meta-análisis (~50%) |
| 23 | Copenhague | B | 1 ECA grande (Harøy 2019) |
| 24 | FIFA 11+ / aterrizaje (LCA) | A | ECAs consistentes |
| 25 | OSTRC de hombro | B | 1 ECA (Andersson 2017) |
| 26 | Batería genérica en perfiles no deportivos | C/F | El paquete no está evaluado; el Tipo 4 es de fútbol |
| 27 | Ratio tracción/empuje ≥1,2 | G/E | Sin evidencia de que el ratio prevenga lesiones; umbral arbitrario |
| 28 | Nunca 5 series; 4 solo en el principal | G | Criterio del entrenador, declarado |
| 29 | Microciclo 3:1 con descarga −40% | F | Práctica estándar; evidencia de descargas limitada |
| 30 | Progresión metabólica → mecánica | E/D | Hipertrofia similar en todos los rangos cerca del fallo |
| 31 | Tempos lentos de 3-4'' | C | Sin beneficio añadido entre ~0,5 y 8 s por repetición |
| 32 | Rest-pause / drop sets | B | Igual de eficaces, más eficientes en tiempo |
| 33 | ROM completo / longitud larga | B/C | Evidencia creciente pero heterogénea |
| 34 | ≈40 contactos "salud tendinosa" | F/G | Sin dosis mínima conocida |
| 35 | Contactos como métrica de carga | F | Ignora la intensidad |
| 36 | Método simple de Samozino | B | Validado; pendiente sensible a hpo |
| 37 | Entrenar según el desequilibrio F-V | D | Ensayos posteriores no muestran ventaja (fuera del Excel) |
| 38 | 1RM por L-V con V1RM fija | B | Error ≈10% (Greig 2023, vía fuente secundaria) |
| 39 | Umbral "cambio > 10%" aplicado a cualquier 1RM | E/F | Confunde error de predicción con error de medida |
| 40 | "Cambio real" si \|Δ%\| > CV | F | Simplifica a Hopkins (falta el SWC y el factor 1,5-2) |
| 41 | Strength Level / Strength Calculator | H | Datos de colaboración abierta, no revisados por pares |
| 42 | σ derivada suponiendo normalidad local | E | Supuesto no verificable |
| 43 | van den Hoek como referencia | B dato / G uso | Población de powerlifting; P25/P75 estimados (H) |
| 44 | P10 de powerlifters para salud | G | Elección arbitraria (el propio libro la llama "exigente") |
| 45 | Sentadilla ≥2×MC → rendimiento | C | Asociación transversal, revisión narrativa |
| 46 | Referencias de fútbol (CMJ, sprint, 505, IFT) | B | Datos publicados pero específicos de la muestra |
| 47 | RSImod NCAA como referencia | C | "PROVISIONAL" |
| 48 | Escalado alométrico ^0,67 | B | Bien establecido |
| 49 | Potencia/RFD contra las caídas | B | NSCA (Fragala 2019) |
| 50 | Test de silla de 30 s | A | Validado (Jones 1999) |
| 51 | Oscilatorios | C | Solo EMG aguda |
| 52 | Deceleración como "vacuna" | E/G | Artículo de opinión |
| 53 | Fullbody 3×/semana | B | A igual volumen la frecuencia influye poco |
| 54 | Descansos de 45-60'' en superseries | F | Práctico; en hipertrofia tienden a favorecer los descansos largos |
| 55 | Oscilatorios al "50-70% 1RM" | H | Sin fuente |
| 56 | Encaje MD-4 / MD-2 / MD-1 | F | Práctica de campo |

## 10. Contradicciones y lagunas

### Internas
1. **Volumen objetivo (WB1):** 12-20 series pedidas, pero en M2-M5 cuádriceps 9-10, glúteo e isquios 10,5-11,5, frente a bíceps 15 y espalda 19,5-23.
2. **Ratio tracción/empuje:** "≥1,2" en Plani y "objetivo > 1" en Volumen.
3. **% de hipertrofia (WB1):** "≈45-60% del tiempo", pero M1 = 40,4%, M3 = 41,8% y el resto ≈65%.
4. **Contactos declarados frente a calculados:**
   - WB1: M2 ≈30 frente a 44; M3 ≈40 frente a 52; M5 ≈35 frente a 30.
   - WB4: M1 ≈50 frente a 42; M4 ≈40 frente a 24; M5 ≈90-110 frente a 39.
   - WB2: M5 calculado 81, por encima de la norma "40-80".
5. **Duración (WB1):** 70-80 min declarados frente a 57-72 calculados.
6. **Cluster M1:** texto "~70% · RIR 4", fórmula 78,4% en S1 (6+5) y objetivo mostrado "RIR 5" (descarga "RIR 6").
7. **M4 (WB1):** "~80-83% RIR 3" y "~85-88% RIR 2" en texto; por O'Connor salen ≈85% y ≈89%.
8. **Intensidad relativa del microciclo:** no está conectada a las fórmulas y no coincide con las cargas que generan.
9. **Tips de plantilla erróneos:**
   - Sentadilla isométrica en pared: "Doble progresión en 12-14 reps".
   - Flexión de brazos: rango 10-12, tip 12-14.
   - Leg curl: rango 8-10, tip "A 15-17 → B 10-12".
   - Press Out: tip con rangos de hipertrofia.
   - M3 WB1: "A 8-10" en filas de 6-8.
   - WB3: Hang Power Clean "contacto <250 ms"; press de 3 series con "S1 4×5".
   - WB4: dominadas 3-5 reps con tip "A 6-8".
10. **WB3:** el objetivo es idéntico en S1-S3; la progresión solo existe en los tips.
11. **Estimadores de 1RM:**
    - WB2/WB3 evalúan con la media de Epley y Brzycki y entrenan con O'Connor: con 10 reps hay un +6,7% de diferencia.
    - WB1/WB4 dicen "Epley y Brzycki" en el texto pero usan O'Connor + Epley.
    - Límite de reps: "≤12" en la fórmula, "≤10" en el texto.
12. **WB2:** la cabecera pide "Reps a RIR 0-1"; el texto dice "no se busca el fallo… reps + RIR (máx. 2)".
13. **Dos sistemas normativos:** van den Hoek (powerlifting, P10-P75) en Evaluación y Strength Level (P5-P95 de usuarios) en Comparativa.
14. **Siluetas de la Batería mal asignadas:**
    - Sentadilla en pared → #46 (que es "Sentadilla española con goma").
    - Zancada isométrica lateral → #14 (que es movilidad).
    - WB4 zancada isométrica frontal → #52 (que es "Sentadilla dividida excéntrica").
    - #57: la batería dice "3×10-12 repeticiones" y el Meso usa 20-30''.
15. **Batería:** "20 de 26 excéntricos" declarados, frente a 18 + 1 excéntrico progresivo (+1 concéntrico-excéntrico).
16. **Material:**
    - WB1 se declara "sin cajones", pero el banco tiene Box Jump, Box Thruster y 7 dominadas (sin barra de dominadas en el material).
    - WB2 se declara "sin cajón ni step", pero M3 usa "Aterrizaje unipodal desde cajón bajo" y "Step Down lateral".
17. **Progresión WB2:** O'Connor aplicado a ejercicios con elástico e isométricos.
18. **Prioridades frente a lo calculado:**
    - WB3: Pliometría es la prioridad 1 pero ocupa solo un 12-14% del tiempo.
    - WB2: Hipertrofia es la prioridad 7 y domina M2 con un 65%.
    - WB4: M1 dominante con solo un 23,8%.
19. **WB4:** Plani pone E1 en "S4"; Evaluación la pone en S0.
20. **Tests anunciados en Plani que no existen** (ver §4.4).
21. **Volumen = semana tipo:** usa las series base, sin descargas, y pondera las fases al 50%.
22. **El ratio de tracción** excluye face pulls y vuelos posteriores.
23. **Herencia del 1RM por nombre (MATCH):** toma la primera aparición; renombrar o repetir el ejercicio la rompe. Además, si falta el RIR se asume el objetivo como dato.
24. **WB3/WB4:** sin referencia de SJ ni de sentadilla para mujeres; WB3 no tiene fila de nivel de referencia.
25. **Cita:** McGuigan se apoya en "Kozinc 2024", pero la referencia listada de Kozinc es de 2022.
26. **Tabla de CE** con rangos solapados.

### Entre libros
- Dos plantillas de Meso distintas para la misma metodología.
- Tres variantes de 1RM por reps y tres de referencia de fuerza.
- 36 semanas frente a 20; E2 en S12 frente a S8.
- Tipos de semana propios en WB2.

### Lagunas
- Cribado de salud, historial de lesiones y escala de dolor.
- Bienestar, RPE de sesión y sRPE; carga de campo.
- Velocidad, tempo, descanso, lado y carga por serie; color del elástico; segundos y carga de las isometrías por separado.
- Tests de balonmano (velocidad de lanzamiento, RI/RE de hombro, CKCUEST).
- Reglas que conviertan la evaluación (F-V, déficits, nivel) en programación.
- Módulo de temporada (MD-x); ajuste por asistencia.
- Acondicionamiento casi sin prescribir.
- Niveles, regresiones y sustituciones de ejercicios.

## 11. Implicaciones para el software (motor de reglas, no clon de Excel)

### Entidades
- **Organization / Trainer / Client:** sexo, fecha de nacimiento, masa, talla, longitud de pierna, altura de cresta → hpo, deporte, nivel, lesiones, material, días disponibles, calendario de competición.
- **Exercise:** catálogo maestro; categoría (39), patrón, cualidad por defecto, músculos con peso, material, lateralidad, tipo de carga (externa / peso corporal / elástico / isométrica / distancia / tiempo), contactos por rep, minutos por serie, vídeo, fuente, ficha de batería, nivel, regresiones y sustitutos.
- **PreventiveCard.**
- **Jerarquía de plantilla:** ProgramTemplate → Mesocycle (fases) → WeekTemplate (tipo, volumen e intensidad relativos, modificadores) → SessionTemplate → Block (letra, tipo, agrupación, descansos) → ExercisePrescription (series, unidad, rangos A/B, RIR A/B, %1RM/VL, tempo, método parametrizado, incremento, por lado, fase, overrides semanales, clasificación heredable).
- **ProgramInstance** versionada.
- **SessionLog / SetLog:** carga, reps/s/m, RIR, RPE, velocidad, VL, lado, elástico, dolor y la marca de dato **observado frente a asumido**.
- **Evaluación:** Assessment → TestDefinition (unidad, dirección, protocolo, CV, SWC, fórmula) → TestResult.
- **NormativeDataset:** fuente, población, sexo, edad/masa, percentil o nivel, verificación, método de interpolación.
- **Reference ↔ Rule/Claim** con EvidenceGrade A-H visible.

### Enumeraciones
Cualidades (9), patrones (17), músculos (11), tipo de bloque (6), categorías del banco (39), tipos de semana, fase 0/1/2, unidad, método de serie, método de 1RM, franja de edad, nivel normativo, categoría F-V (5), tipo de batería (1-4), modo de contracción, color de elástico y estado de verificación.

### Cálculos del motor
1. **1RM:** O'Connor, Epley, Brzycki, media y L-V con V1RM configurable; precedencia configurable.
2. **Prescripción:** %1RM según una ecuación configurable, con redondeo al material disponible del cliente.
3. **Reglas de progresión:**
   - Doble progresión.
   - Descarga.
   - Cambio de rango con recálculo.
   - Isometría tiempo → carga.
   - Progresión por tipo de semana (WB2) y lineal por % (WB3).
   - Herencia del 1RM por **ID**, no por nombre.
4. **Volumen por semana real:** por cualidad (tiempo y series), por músculo con pesos configurables, por patrón, ratio, contactos y duración; "efectivas" según un umbral de RIR.
5. **Evaluación:** fuerza relativa, % de referencia, Δ, cambio real (TE + SWC + factor), F-V completo, RSI/RSImod/EUR, déficit COD, asimetrías, Z y percentiles interpolados, alometría.
6. **Linter del programa:**
   - Alternancia de patrones.
   - Máximo de series por ejercicio.
   - Ratio tracción/empuje.
   - Rangos de series por músculo, de contactos y de duración.
   - Material disponible.
   - No estimar 1RM en ejercicios elásticos o isométricos.
   - Generar los tips desde los datos para evitar los errores de plantilla.

### Datos configurables frente a código
- **Datos:** catálogo, batería, plantillas, tipos de semana y modificadores, umbrales de las normas, pesos de músculo, constantes (0,025, V1RM), tablas normativas, CV de los tests, categorías F-V, textos y grados de evidencia.
- **Código:** evaluador de reglas (DSL/parametrizado), calculadoras, agregadores, validador, versionado y trazabilidad (qué regla y qué referencia produjo cada carga), adaptadores de VBT, plataforma y fotocélulas.
- **Recomendación:** las 4 rutinas deben ser 4 plantillas de datos sobre un mismo motor. Las plantillas "manuales" (WB2/WB3) deben convertirse en reglas explícitas.

## REFERENCE LIST
Formato: autores | año | título | revista | DOI/URL | afirmación [libros; verificación]. El signo ¦ sustituye a | dentro de los campos.

Samozino P, Morin JB, Hintzy F, Belli A. | 2008 | A simple method for measuring force, velocity and power output during squat jump | Journal of Biomechanics, 41(14), 2940–2945 | https://doi.org/10.1016/j.jbiomech.2008.07.028 | Ecuaciones F = m·g·(h/hpo+1), v = √(g·h/2), P = F·v; definición de hpo [WB1234; Indirecta]
Jiménez-Reyes P, Samozino P, Pareja-Blanco F, Conceição F, Cuadrado-Peñafiel V, González-Badillo JJ, Morin JB. | 2017 | Validity of a simple method for measuring force-velocity-power profile in countermovement jump | IJSPP, 12(1), 36–43 | https://doi.org/10.1123/ijspp.2015-0484 | Validez del método simple en CMJ [WB1234; Resumen]
Samozino P, Rejc E, Di Prampero PE, Belli A, Morin JB. | 2012 | Optimal force–velocity profile in ballistic movements—Altius: citius or fortius? | MSSE, 44(2), 313–322 | https://doi.org/10.1249/MSS.0b013e31822d757a | Modelo del perfil óptimo SFVopt; Pmax = F0·V0/4 [WB1234; Resumen]
Samozino P, Edouard P, Sangnier S, Brughelli M, Gimenez P, Morin JB. | 2014 | Force-velocity profile: imbalance determination and effect on lower limb ballistic performance | Int J Sports Med, 35(6), 505–510 | https://doi.org/10.1055/s-0033-1354382 | FVimb = 100·¦1 − SFV/SFVopt¦ [WB1234; Indirecta]
Jiménez-Reyes P, Samozino P, Brughelli M, Morin JB. | 2017 | Effectiveness of an individualized training based on force-velocity profiling during jumping | Frontiers in Physiology, 7, 677 | https://doi.org/10.3389/fphys.2016.00677 | Categorías de desequilibrio (<60…>140%), proporción de trabajo, hpo y protocolo de saltos cargados [WB1234; Texto completo]
Jiménez-Reyes P, Samozino P, Morin JB. | 2019 | Optimized training for jumping performance using the force-velocity imbalance: individual adaptation kinetics | PLoS ONE, 14(5), e0216681 | https://doi.org/10.1371/journal.pone.0216681 | Óptimo = FVimb ±10%; reevaluar cada 3 semanas; 12,6 ± 4,6 semanas hasta el óptimo [WB1234; Texto completo]
Morin JB, Samozino P. | 2016 | Interpreting power-force-velocity profiles for individualized and specific training | IJSPP, 11(2), 267–272 | https://doi.org/10.1123/ijspp.2015-0638 | Marco de interpretación del perfil F-V [WB1234; Indirecta]
González-Badillo JJ, Sánchez-Medina L. | 2010 | Movement velocity as a measure of loading intensity in resistance training | Int J Sports Med, 31(5), 347–352 | https://doi.org/10.1055/s-0030-1248333 | Relación velocidad-%1RM (R² = 0,98) en banca; V1RM 0,16 ± 0,04 m/s [WB1234; Resumen]
Sánchez-Medina L, et al. | 2017 | Estimation of relative load from bar velocity in the full back squat exercise | Sports Med Int Open, 1, E80–E88 | Sports Med Int Open 2017;1:E80–E88 | V1RM sentadilla completa 0,32 ± 0,03 m/s [WB1234; Resumen]
Morán-Navarro R, Martínez-Cava A, Escribano-Peñas P, Courel-Ibáñez J. | 2021 | Load-velocity relationship of the deadlift exercise | Eur J Sport Sci, 21(5), 678–684 | https://doi.org/10.1080/17461391.2020.1785017 | V1RM peso muerto 0,24 ± 0,03 m/s [WB1234; Resumen]
Greig L, et al. | 2023 | The predictive validity of individualised load–velocity relationships for predicting 1RM: a systematic review and IPD meta-analysis | Sports Medicine, 53, 1693–1708 | Sports Med 2023;53:1693–1708 | Error típico ≈9,8% del 1RM con perfiles L-V individuales [WB1234; Fuente secundaria]
Sánchez-Medina L, González-Badillo JJ, Pérez CE, Pallarés JG. | 2014 | Velocity- and power-load relationships of the bench pull vs. bench press exercises | Int J Sports Med, 35(3), 209–216 | https://pubmed.ncbi.nlm.nih.gov/23900903/ | Remo tumbado: relación L-V (R² = 0,94), más velocidad que la banca al mismo %1RM [WB134; Resumen]
O'Connor B, Simmons J, O'Shea P. | 1989 | Weight training today | West Publishing | — | 1RM = carga × (1+0,025·reps); en el sistema reps+RIR y %1RM = 1/(1+0,025·(reps+RIR)) [WB14; Cita estándar]
Zourdos MC, Klemp A, Dolan C, et al. | 2016 | Novel resistance training–specific RPE scale measuring repetitions in reserve | JSCR, 30(1), 267–275 | https://doi.org/10.1519/JSC.0000000000001049 | Escala RIR y su validez [WB14; Cita estándar]
Helms ER, Cronin J, Storey A, Zourdos MC. | 2016 | Application of the repetitions in reserve-based RPE scale for resistance training | Strength Cond J, 38(4), 42–49 | https://doi.org/10.1519/SSC.0000000000000218 | Uso práctico del RIR para autorregular y progresar [WB14; Cita estándar]
Strength Level | 2014-2026 | Weightlifting strength standards (squat, bench, deadlift, RDL, OHP, bent-over row) | base de datos colaborativa | https://strengthlevel.com/strength-standards | Ratios 1RM/MC por sexo, peso y nivel (P5/P20/P50/P80/P95 de los usuarios) [WB1234; Indirecta + Documento aportado]
Strength Calculator | s.f. | Pull-up standards: added weight by bodyweight and sex | web | https://strengthcalculator.org/pull-up-calculator | Carga total relativa en dominadas lastradas por nivel [WB1234; Documento aportado]
Folland JP, Mc Cauley TM, Williams AG. | 2008 | Allometric scaling of strength measurements to body mass | Eur J Appl Physiol, 102(6), 739-745 | https://pubmed.ncbi.nlm.nih.gov/18172672 | Fuerza ∝ masa^0,67 [WB1234; Documento aportado]
Cuerpo técnico del Crevillente Deportivo | s.f. | Batería preventiva completa · 93 ejercicios por tipología | documento aportado | Archivo: Bateria_Preventiva_Completa.pdf | 93 fichas con silueta, dosis, ejecución, justificación y error [WB1234; Documento aportado]
Kubo K, Kanehisa H, Fukunaga T. | 2001 | Effects of different duration isometric contractions on tendon elasticity in human quadriceps muscles | J Physiol, 536(2), 649-655 | https://doi.org/10.1111/j.1469-7793.2001.0649c.xd | 12 sem al 70% CVM: contracciones largas (4×20 s) aumentan la rigidez, las cortas no [WB1234; Resumen]
Rio E, Kidgell D, Purdam C, Gaida J, Moseley GL, Pearce AJ, Cook J. | 2015 | Isometric exercise induces analgesia and reduces inhibition in patellar tendinopathy | Br J Sports Med, 49(19), 1277-1283 | https://doi.org/10.1136/bjsports-2014-094386 | 5×45 s al 70% CVM: analgesia ≥45 min [WB1234; Resumen]
McBurnie AJ, Harper DJ, Jones PA, Dos'Santos T. | 2022 | Deceleration training in team sports: another potential 'vaccine' for sports-related injury? | Sports Medicine, 52(1), 1-12 | https://doi.org/10.1007/s40279-021-01583-x | Entrenar la deceleración como estrategia de mitigación de lesiones [WB1234; Resumen]
Brzycki M. | 1993 | Strength testing—predicting a one-rep max from reps-to-fatigue | JOPERD, 64(1), 88–90 | https://doi.org/10.1080/07303084.1993.10606684 | 1RM = carga·36/(37−reps) [WB1234; Cita estándar]
Epley B. | 1985 | Poundage chart | Boyd Epley Workout, Body Enterprises | — | 1RM = carga·(1+reps/30) [WB1234; Cita estándar]
LeSuer DA, McCormick JH, Mayhew JL, Wasserstein RL, Arnold MD. | 1997 | The accuracy of prediction equations for estimating 1-RM performance in the bench press, squat, and deadlift | JSCR, 11(4), 211–213 | — | Menor precisión con >10 reps [WB1234; Cita estándar]
van den Hoek D, et al. | 2024 | Normative data for relative strength in drug-tested, unequipped powerlifting across the lifespan (título abreviado) | J Sci Med Sport | https://doi.org/10.1016/j.jsams.2024.07.005 | Percentiles ×MC en sentadilla, banca y PM por sexo y edad (n = 809.986) [WB124; Fuente secundaria]
Suchomel TJ, Nimphius S, Stone MH. | 2016 | The importance of muscular strength in athletic performance | Sports Medicine, 46(10), 1419–1449 | https://doi.org/10.1007/s40279-016-0486-0 | Fuerza relativa ↔ rendimiento; sentadilla ≈2×MC [WB134; Resumen]
Suchomel TJ, Nimphius S, Bellon CR, Stone MH. | 2018 | The importance of muscular strength: training considerations | Sports Medicine, 48(4), 765–785 | https://doi.org/10.1007/s40279-018-0862-z | Consideraciones de entrenamiento (bilateral, excéntrico, resistencia variable) [WB134; Resumen]
Hopkins WG. | 2004 | How to interpret changes in an athletic performance test | Sportscience, 8, 1–7 | http://www.sportsci.org/jour/04/wghtests.htm | Error típico y cambio mínimo relevante [WB1234; Indirecta]
Balsalobre-Fernández C, Glaister M, Lockey RA. | 2015 | The validity and reliability of an iPhone app for measuring vertical jump performance | J Sports Sci, 33(15), 1574–1579 | https://doi.org/10.1080/02640414.2014.996184 | Validez de My Jump [WB1234; Cita estándar]
Sánchez-Medina L, González-Badillo JJ. | 2011 | Velocity loss as an indicator of neuromuscular fatigue during resistance training | MSSE, 43(9), 1725–1734 | https://doi.org/10.1249/MSS.0b013e318213f880 | VL como indicador del carácter del esfuerzo [WB1234; Cita estándar]
Pareja-Blanco F, Rodríguez-Rosell D, Sánchez-Medina L, et al. | 2017 | Effects of velocity loss during resistance training on athletic performance, strength gains and muscle adaptations | Scand J Med Sci Sports, 27(7), 724–735 | https://doi.org/10.1111/sms.12678 | VL40 → más hipertrofia; VL20 → mejor CMJ [WB134; Cita estándar]
Schoenfeld BJ, Ogborn D, Krieger JW. | 2017 | Dose-response relationship between weekly resistance training volume and increases in muscle mass | J Sports Sci, 35(11), 1073–1082 | https://doi.org/10.1080/02640414.2016.1210197 | Dosis-respuesta; ≥10 series/semana [WB14; Cita estándar]
Tufano JJ, Brown LE, Haff GG. | 2017 | Theoretical and practical aspects of different cluster set structures: a systematic review | JSCR, 31(3), 848–867 | https://doi.org/10.1519/JSC.0000000000001581 | Los clusters mantienen velocidad y potencia [WB134; Cita estándar]
Sáez de Villarreal E, Kellis E, Kraemer WJ, Izquierdo M. | 2009 | Determining variables of plyometric training for improving vertical jump height performance: a meta-analysis | JSCR, 23(2), 495–506 | https://doi.org/10.1519/JSC.0b013e318196b7c6 | Volumen de contactos eficaz [WB1234; Indirecta (documento Bautista)]
American College of Sports Medicine | 2009 | Progression models in resistance training for healthy adults | MSSE, 41(3), 687–708 | https://doi.org/10.1249/MSS.0b013e3181915670 | Principios de progresión [WB1234; Cita estándar]
Bautista D. | s.f. | Pliometría | documento aportado | Archivo: Pliometría.pdf | Fases pre-plyo/I/II/III, aterrizaje, planos, contactos/semana [WB1234; Documento aportado]
González-Badillo JJ, Ribas-Serna J. | s.f. | Bases de la programación del entrenamiento de fuerza | documento aportado | Archivo: BASES_D_LA_PROGRAMACION_DL_ENTTO_D_FUERZA.pdf | Carácter del esfuerzo, VL, recuperación [WB1234; Documento aportado]
González-Badillo JJ, Gorostiaga Ayestarán E. | s.f. | Fundamentos del entrenamiento de la fuerza (2ª ed.) | documento aportado | Archivo PDF | Principios de fuerza y velocidad de ejecución [WB1234; Documento aportado]
Montero JM. | s.f. | Modelo de programación MPE Vitafit / Audiofit | documento aportado | Archivos: MPE-Vitafit.xlsx y MPE_Vitafit-Audiofit.xls | Banco de ejercicios con vídeos y progresiones [WB1234; Documento aportado]
Criterios del entrenador (sin cita) | s.f. | Tracción > empuje; nunca 5 series; 4 solo en principales; salud 45-50 min; mesos de 8 semanas; doble progresión con rangos de 2 reps | — | — | Normas de diseño [WB1234; Criterio del entrenador]
Jones CJ, Rikli RE, Beam WC. | 1999 | A 30-s chair-stand test as a measure of lower body strength in community-residing older adults | Res Q Exerc Sport, 70(2), 113–119 | https://doi.org/10.1080/02701367.1999.10608028 | Protocolo del test de silla de 30 s [WB2; Cita estándar]
Fragala MS, Cadore EL, Dorgo S, et al. | 2019 | Resistance training for older adults: NSCA position statement | JSCR, 33(8), 2019–2052 | https://doi.org/10.1519/JSC.0000000000003230 | Fuerza y potencia en mayores; prevención de caídas [WB2; Cita estándar]
Asimakidis ND, Mukandi IN, Beato M, Bishop C, Turner AN. | 2024 | Assessment of strength and power capacities in elite male soccer: a systematic review of test protocols | Sports Medicine, 54(10), 2607–2644 | https://doi.org/10.1007/s40279-024-02071-8 | CMJ 33,6-57,2 cm; SJ 29,8-44,1; CV CMJ 4,3% y SJ 3,7%; pocos estudios con DJ/RSI [WB34; Texto completo]
Styles WJ, Matthews MJ, Comfort P. | 2016 | Effects of strength training on squat and sprint performance in soccer players | JSCR, 30(6), 1534–1539 | https://doi.org/10.1519/JSC.0000000000001243 | Sentadilla 1,66 → 1,96×MC; 10 m 1,83 s; 20 m 3,09 s [WB34; Resumen]
Wisløff U, Castagna C, Helgerud J, Jones R, Hoff J. | 2004 | Strong correlation of maximal squat strength with sprint performance and vertical jump height in elite soccer players | Br J Sports Med, 38(3), 285–288 | https://doi.org/10.1136/bjsm.2002.002071 | Sentadilla ≈2,2×MC; 10 m 1,82 s; 30 m 4,00 s [WB34; Resumen]
Ruiz-Rios M, Setuain I, Cadore EL, Izquierdo M, Garcia-Tabar I. | 2024 | Physical conditioning and functional injury-screening profile of elite female soccer players: a systematic review | IJSPP, 19(12) | https://doi.org/10.1123/ijspp.2023-0463 | Mujeres élite: CMJ 31,0 cm; 20 m 3,58 s [WB34; Resumen]
Badby AJ, Comfort P, Ripley NJ, Mundy PD, Soriano MA, Robles-Palazón FJ, Fahey J, Sindall P, Bramah C, McMahon JJ. | 2025 | Normative data and objective benchmarks for selected force plate tests for professional and youth soccer players | J Sports Sci, 43(20), 2306–2323 | https://doi.org/10.1080/02640414.2025.2523671 | Existen benchmarks; CV RSImod 5,6% y RSI DJ 8,2% [WB34; Resumen]
Dos'Santos T, Thomas C, Comfort P, Jones PA. | 2018 | Comparison of change of direction speed performance and asymmetries between team-sport athletes | Sports, 6(4), 174 | https://doi.org/10.3390/sports6040174 | 505 D/ND, déficit COD, 10 m en mujeres, asimetrías y CV [WB34; Texto completo]
Asimakidis ND, Bishop C, Beato M, Turner AN. | 2025 | Assessment of aerobic fitness and repeated sprint ability in elite male soccer: a systematic review | Sports Medicine, 55(5), 1233–1264 | https://doi.org/10.1007/s40279-025-02188-4 | VIFT 19,0-20,1 km/h en senior [WB34; Texto completo]
Čović N, Jelešković E, Alić H, Rađo I, Kafedžić E, Sporiš G, McMaster DT, Milanović Z. | 2016 | Reliability, validity and usefulness of 30–15 IFT in female soccer players | Frontiers in Physiology, 7, 510 | https://doi.org/10.3389/fphys.2016.00510 | VIFT mujeres 17,1 km/h; CV 1,8%; SWC 0,5 km/h [WB34; Texto completo]
Buchheit M. | 2008 | The 30–15 intermittent fitness test: accuracy for individualizing interval training of young intermittent sport players | JSCR, 22(2), 365–374 | https://doi.org/10.1519/JSC.0b013e3181635b2e | Protocolo del 30-15 IFT [WB34; Indirecta]
Nimphius S, Callaghan SJ, Spiteri T, Lockie RG. | 2016 | Change of direction deficit: a more isolated measure of change of direction performance than total 505 time | JSCR, 30(11), 3024–3032 | https://doi.org/10.1519/JSC.0000000000001421 | Déficit COD = 505 − 10 m [WB34; Indirecta]
Compton HR, Lovell R, Scott D, Clubb J, Shushan T. | 2025 | Benchmarking the physical performance qualities in women's football: a systematic review and meta-analysis | Sports Medicine, 56, 127–155 | https://doi.org/10.1007/s40279-025-02251-0 | El 30 m y el 30-15 IFT discriminan niveles [WB34; Texto completo]
Sole CJ, Suchomel TJ, Stone MH. | 2018 | Preliminary scale of reference values for evaluating RSImod in male and female NCAA Division I athletes | Sports, 6(4), 133 | https://doi.org/10.3390/sports6040133 | Percentiles RSImod H 0,352/0,419/0,492, M 0,248/0,308/0,379 [WB34; Texto completo]
Ebben WP, Petushek EJ. | 2010 | Using the reactive strength index modified to evaluate plyometric performance | JSCR, 24(8), 1983–1987 | https://doi.org/10.1519/JSC.0b013e3181e72466 | Definición del RSImod [WB34; Indirecta]
Suchomel TJ, Bailey CA, Sole CJ, Grazer JL, Beckham GK. | 2015 | Using RSImod as an explosive performance measurement tool in Division I athletes | JSCR, 29(4), 899–904 | https://doi.org/10.1519/JSC.0000000000000743 | Fiabilidad del RSImod [WB34; Indirecta]
Petridis L, Utczás K, Tróznai Z, Kalabiska I, Pálinkás G, Szabó T. | 2019 | Vertical jump performance in Hungarian male elite junior soccer players | Res Q Exerc Sport, 90(2), 251–257 | https://doi.org/10.1080/02701367.2019.1588934 | U18: CMJ 38,6 y SJ 33,9 cm [WB34; Resumen]
Haugen TA, Breitschädel F, Wiig H, Seiler S. | 2021 | Countermovement jump height in national-team athletes of various sports | IJSPP, 16(2) | https://doi.org/10.1123/ijspp.2019-0964 | Variación del CMJ entre deportes [WB34; Resumen]
McGuigan MR, Doyle TLA, Newton M, Edwards DJ, Nimphius S, Newton RU. | 2006 | Eccentric utilization ratio: effect of sport and phase of training | JSCR, 20(4), 992–995 | — | Concepto de EUR [WB34; Cita estándar]
Kozinc Ž, Žitnik J, Smajla D, Šarabon N. | 2022 | The difference between squat jump and countermovement jump in 770 participants from different sports | Eur J Sport Sci, 22(7), 985–993 | https://doi.org/10.1080/17461391.2021.1936654 | EUR alto no implica mejor rendimiento [WB34; Resumen]
Flanagan EP, Comyns TM. | 2008 | The use of contact time and the reactive strength index to optimize fast SSC training | Strength Cond J, 30(5), 32–38 | — | RSI en drop jump [WB34; Cita estándar]
van der Horst N, Smits DW, Petersen J, Goedhart EA, Backx FJ. | 2015 | The preventive effect of the Nordic hamstring exercise on hamstring injuries in amateur soccer players: an RCT | Am J Sports Med, 43(6), 1316–1323 | https://doi.org/10.1177/0363546515574057 | Eficacia preventiva del nórdico [WB34; Cita estándar]
Harøy J, Clarsen B, Wiger EG, et al. | 2019 | The Adductor Strengthening Programme prevents groin problems among male football players | Br J Sports Med, 53(3), 150–157 | https://doi.org/10.1136/bjsports-2017-098937 | Eficacia del Copenhague [WB34; Cita estándar]
Soligard T, Myklebust G, Steffen K, et al. | 2008 | Comprehensive warm-up programme to prevent injuries in young female footballers | BMJ, 337, a2469 | https://doi.org/10.1136/bmj.a2469 | FIFA 11+ [WB34; Cita estándar]
Andersson SH, Bahr R, Clarsen B, Myklebust G. | 2017 | Preventing overuse shoulder injuries among throwing athletes: a cluster-RCT in 660 elite handball players | Br J Sports Med, 51(14), 1073-1080 | https://doi.org/10.1136/bjsports-2016-096226 | El programa OSTRC reduce problemas de hombro [WB4; Resumen]
Dunnick DD, Brown LE, Coburn JW, Lynn SK, Barillas SR. | 2015 | Bench press upper-body muscle activation between stable and unstable loads | JSCR, 29(12), 3279-3283 | https://doi.org/10.1519/JSC.0000000000001198 | KB colgantes: activación similar al 60-80% 1RM [WB4; Resumen]
Saeterbakken AH, Solstad TEJ, Stien N, Shaw MP, Pedersen H, Andersen V. | 2020 | Muscle activation with swinging loads in bench press | PLoS ONE, 15(9), e0239202 | https://doi.org/10.1371/journal.pone.0239202 | Cargas pendulares: más actividad de pectoral y oblicuo [WB4; Resumen]
Lawrence MA, Leib DJ, Ostrowski SJ, Carlson LA. | 2017 | Nonlinear analysis of an unstable bench press bar path and muscle activation | JSCR, 31(5), 1206-1211 | https://doi.org/10.1519/JSC.0000000000001610 | La carga inestable hace la trayectoria menos predecible [WB4; Resumen]