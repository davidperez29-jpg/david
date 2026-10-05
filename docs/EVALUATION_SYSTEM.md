# Sistema de evaluación, normalización y radares

> Cubre los §12–§15 y §17 del encargo. Se apoya en lo que ya existe (`ASSESSMENT.md`):
> - 43 tests globales con dirección de mejora y fiabilidad publicada;
> - 7 baterías;
> - referencias con población y fuente;
> - cambio real frente al error de medida.
>
> Toma la **estructura de trabajo** de los documentos del usuario:
> - informe de rendimiento de un club, con datos brutos, Z-scores, comparativa y radar;
> - hoja de evaluación de un programa de fuerza para una persona con PC leve, con referencias por clase y umbrales de cambio real.

## 1. Definición de un test (§12)

| Campo | Ya existe | Nota |
|---|---|---|
| Nombre, categoría, unidad | ✅ | |
| Protocolo y material | ✅ protocolo · ➕ `material` | Texto para el evaluador; el cliente ve una versión breve |
| Número de intentos | ➕ `attempts_default` | La hoja muestra tantas columnas como intentos |
| Regla del resultado | ✅ `best`, `mean`, `mean_of_best_n`, `last` · ➕ `median`, `min`, `max` | Ejemplos del informe del club: pliegues = **mediana** de 3 (criterio ISAK); sprint = **mejor** (mínimo) de 2 |
| Dirección de mejora | ✅ `higher` / `lower` / `target_range` | Clave para normalizar y para el radar (§3) |
| Bilateral | ➕ `bilateral` | Registra derecha e izquierda y calcula la asimetría |
| Referencias (media, DT, población, fuente) | ✅ `reference_values` · ➕ `kind`, `condition`, `limitations` | `normative` (media ± DT) · `cutoff` · `range` · `custom` |
| Fiabilidad (ICC, SEM, MDC) | ✅ `test_reliability_data` | Decide si un cambio es real |
| Fuente | ✅ | Siempre verificada o marcada (`SCIENCE_SYSTEM.md`) |

**Fórmulas derivadas** (`derived_formulas`, fase 4): métricas calculadas con **constantes editables**, como en el informe del club.

| Métrica | Fórmula | Fuente o criterio |
|---|---|---|
| IMC | peso / talla² | Definición |
| Σ6 pliegues | tríceps + subescapular + cresta ilíaca + abdominal + muslo anterior + gemelo medial | Protocolo ISAK *[referencia del documento del usuario; verificar en fase 9]* |
| % grasa (Faulkner) | Σ4 × 0,153 + 5,783 | Documento del usuario *[verificar]* |
| % grasa (Yuhasz, ♂) | Σ6 × 0,1051 + 2,585 | Documento del usuario *[verificar]* |
| Masa grasa / masa libre de grasa | peso × %grasa/100 · peso − masa grasa | La masa libre de grasa **no** es masa muscular |
| Fuerza relativa | fuerza (N) / peso (kg) | Definición |
| Asimetría (%) | \|D − I\| / máx(D, I) × 100 | La usa el documento del usuario |
| LSI (%) | lado afectado / lado sano × 100 | Para readaptación (`INJURY_MODULE.md`) |

## 2. Baterías según objetivo (§13)

No hay una batería universal. Cada perfil (`training_profiles.default_battery_id`) propone la suya, y el entrenador puede crear baterías personalizadas.

| Perfil | Batería de partida | Tests (existentes en negrita; ➕ = añadir en la fase 4) |
|---|---|---|
| Salud · mejora funcional | `health` | **prensión manual, 5×STS, 30 s STS, SPPB, velocidad de marcha, apoyo unipodal, 6MWT, TUG, lunge en carga** |
| Adulto mayor | `health` + equilibrio | lo anterior + **apoyo unipodal ojos cerrados** |
| Hipertrofia · fuerza | `hypertrophy_strength` | **1RM sentadilla, 1RM press banca, 1RM estimado por velocidad, peso, perímetro de cintura, talla** |
| Iniciación a la fuerza | `initiation` | **prensión, 30 s STS, CMJ, peso, cintura, talla** |
| Rendimiento general / deportes individuales | `sprint_power` | **sprint 5–30 m, velocidad máxima, CMJ, SJ, RSI, IMTP, 1RM** |
| Deportes de equipo | `team_sport` | **CMJ, sprint 10/20/30 m, 505, 30-15 IFT, Yo-Yo IR1, IMTP, T modificado, RSI** · ➕ CMJ unipodal D/I, dribbling, Σ6 pliegues |
| Deportes de resistencia | `endurance` | **30-15 IFT, Cooper, CMJ, lunge** |
| Función muscular / coordinativa · PC leve | ➕ `pc_function` | **CMJ, TUG, 5×STS, 30 s STS, apoyo unipodal** · ➕ asimetrías por lado |
| Readaptación / RTS | La define cada protocolo de lesión | Ver `INJURY_MODULE.md` |

## 3. Normalización: del dato bruto al radar (§14)

**Nunca se dibujan juntas variables con unidades distintas.** La cadena es siempre la misma, en funciones puras del dominio con tests de propiedades:

```
DATO BRUTO (intentos)
  → RESULTADO (regla del test: mejor, media, mediana, mín, máx)
  → DERIVADO (fórmulas con constantes editables, si aplica)
  → DIRECCIÓN DE MEJORA (lower → se invierte el signo)
  → ESTANDARIZACIÓN (una de las cuatro escalas)
  → BANDA (lectura)
  → RADAR
```

**Escalas disponibles**:

| Escala | Cálculo | Cuándo usarla |
|---|---|---|
| **Z frente a referencia** | (valor − media_ref) / DT_ref × signo | Hay referencia normativa con media y DT de una población aplicable |
| **Z frente al equipo/grupo** | (valor − media_grupo) / DT_grupo × signo, con DT muestral (n − 1), como en el informe del club | Comparar dentro de una plantilla; mínimo 5 personas con dato (si no, se avisa) |
| **Percentil** | Posición en la distribución de la referencia o del grupo | Hay distribución (tabla de percentiles o suficientes datos de grupo) |
| **% de la referencia** | valor / ref × 100; en «menos es mejor», ref / valor × 100 | Referencias de corte o de clase (p. ej. FT2/FT3 en fútbol PC del documento del usuario) |

- **Signo**: `higher` → +1; `lower` → −1. Así «hacia fuera» siempre significa mejor.
- **`target_range`**: la puntuación es la distancia al rango objetivo, con penalización simétrica. Esos tests no se usan en el radar por defecto.
- **Bandas por defecto**, configurables:

| Banda | Condición |
|---|---|
| **Destacado** | Z > +1 |
| **En la media** | Z entre −1 y +1 |
| **A mejorar** | Z < −1 |

  El documento del usuario apoya este modelo de bandas en McMahon et al. (2022) *[verificar en fase 9]*.

- **Coherencia del texto**: el texto automático de fortalezas y aspectos a mejorar se **genera de la banda**, nunca por separado, para que no se contradigan. En la hoja del documento del usuario un Z de +2,3 aparecía descrito como «sin superar +1 DT».
- **Calidad del dato**: un valor a más de 3 DT del grupo, o fuera de los límites técnicos del test, se marca **«confirmar medición»**, como la talla atípica que detecta el documento del usuario. Se conserva el dato original.

## 4. Radar (§14)

- **Dimensiones seleccionables**: por ejemplo, rendimiento (Fuerza, Potencia, Velocidad, Aceleración, COD, Resistencia, Reactividad) o salud (Fuerza funcional, Potencia, Movilidad, Equilibrio, Resistencia, Capacidad funcional).
  - Cada dimensión agrupa tests con un peso (`radar_dimension_tests`).
  - El perfil del cliente propone las dimensiones y el entrenador las cambia.
- **Puntuación de una dimensión**: media ponderada de las puntuaciones estandarizadas de sus tests, ya con la dirección corregida.
- **Sin dato = hueco**, nunca cero. El eje se muestra «sin dato» y la línea no lo atraviesa como si fuera la media.
- **Escala visual**: Z recortado a [−3, +3]. El valor real se ve al pasar el cursor y en la tabla.
- **Comparaciones** (se superponen como capas):

| Comparación | Capas |
|---|---|
| Evaluación 1 vs evaluación 2 | Dos evaluaciones del mismo cliente |
| Cliente vs referencia | Cliente frente a una referencia normativa (Z = 0 es la referencia) |
| Cliente vs media del equipo | Z frente al grupo (0 = media) |
| Cliente vs referencia personalizada | Una referencia propia creada por el entrenador, por ejemplo el objetivo de la temporada |

- **Accesibilidad**: el radar va siempre acompañado de su tabla. El SVG lleva título y descripción, y los colores cumplen el contraste.

## 5. Evolución (§15)

Para cada variable:
- evaluación por evaluación;
- cambio absoluto y %;
- tendencia (pendiente con al menos 3 puntos);
- **cambio real**: el cambio se compara con el MDC del test cuando se conoce. Si no se conoce, se muestra la diferencia sin veredicto.

Ya existe en `domain/assessment/change.ts` y se mantiene.

## 6. Comparativa (§17)

Selector: **CLIENTE ▾ · EVALUACIÓN A ▾ · EVALUACIÓN B ▾ · REFERENCIA ▾**.

Genera:
- tabla comparativa (A, B, cambio, %, cambio real sí/no, banda en B);
- radar superpuesto;
- gráficos de evolución de las variables elegidas;
- interpretación generada de las bandas y del cambio real, nunca un diagnóstico.

Para grupos, **informe grupal** con lo que ya hace el documento del usuario: N, media, referencia, DT, máximo, mínimo, mejor y peor.

## 7. Historial (§49)

- Una evaluación **completada** queda bloqueada.
- Corregirla crea una nueva versión con motivo y autor; los informes anteriores siguen mostrando lo que se sabía entonces (instantánea congelada).
- Las referencias del equipo se calculan **en el momento**, pero el informe congela los valores usados.
