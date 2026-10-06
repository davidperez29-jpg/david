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

## 8. Implementación (reestructuración, fase 4)

### 8.1 Hoja de intentos

- En cada evaluación, **«Hoja de intentos»**: una fila por test y lado, una columna por intento.
  - Se escribe o se **pega un bloque copiado de Excel** (tabuladores y saltos de línea).
  - Intro baja a la fila siguiente. Cada fila se guarda al salir de ella; vaciarla borra el resultado.
- El resultado aplica la **regla del test**:
  - `median`: pliegues, 3 medidas como en ISAK;
  - `best` o `min`: el menor tiempo de los sprints;
  - también `mean`, `mean_of_best_n`, `last` y `max`.
- Las **métricas derivadas** se recalculan al guardar. El formulario detallado (método, notas, intento no válido) sigue disponible.

### 8.2 Fórmulas como datos

- Tabla `derived_formulas`. Su lenguaje lo interpreta el dominio (`formulas.ts`) **sin `eval`**:
  - nombres de tests, `test.left` y `test.right`, y otras fórmulas;
  - constantes de una letra;
  - operaciones + − × / ^ y las funciones sum, mean, min, max, abs y sqrt.
- Si falta un dato, la fórmula **no da valor** (nunca un cero). Una división por cero tampoco da valor.
- El catálogo de la plataforma sale de `DEFAULT_FORMULAS`:
  - IMC, déficit COD, fuerza relativa, CMJ/SJ, IMTP relativo;
  - Σ6 y Σ4 pliegues;
  - % graso de Faulkner (a = 0,153; b = 5,783) y de Yuhasz (solo hombres; a = 0,1051; b = 2,585);
  - masa grasa y masa libre de grasa.
  - Las ecuaciones del documento del club llevan **[REQUIERE VERIFICACIÓN]**.
- Un centro **edita las constantes** o crea fórmulas propias en Tests → «Fórmulas y constantes». Su copia sustituye a la global con el mismo identificador; «Volver a las de la plataforma» la borra.
- Al guardar una fórmula se compila con todas las demás. Se rechazan los nombres desconocidos y las **dependencias circulares**.
- El valor guardado lleva el texto de la fórmula con sus constantes. Los valores ya calculados no cambian.

### 8.3 Grupos y equipos

- Tablas `client_groups` y `client_group_members`, solo para el equipo técnico. La RLS hace que un entrenador vea solo a los miembros que tiene asignados.
- **Evaluación de grupo**: en una fecha, una evaluación por miembro con los mismos tests (`assessments.group_id`).
  - Repetirla no duplica: se salta a quien ya la tiene.
  - La hoja de grupo muestra un test cada vez, con una fila por persona y lado.
- **Informe grupal** para cada prueba, fórmula y asimetría:
  - N, media, referencia (población, fuente, condición y limitaciones), DT muestral (n − 1), máximo y mínimo;
  - mejor y peor según el sentido de la prueba; en las descriptivas no procede;
  - Z frente al grupo con el signo corregido y su banda (verde, amarillo, rojo);
  - asimetría con semáforo orientativo: < 10 %, 10–15 %, ≥ 15 %;
  - aviso con menos de 5 personas.
- **«Confirmar medición»**: aparece si el valor está fuera de los **límites plausibles** del test (`plausible_min`/`plausible_max`) o a más de 3 DT de la media del **resto** del grupo. Se excluye a la propia persona para que un valor extremo no se esconda inflando la DT. El dato original se conserva.
- Para llegar al informe: Mis clientes → Grupos y equipos → «Último informe» (2 clics).

### 8.4 Test de oro frente al documento del club

`packages/domain/test/club-golden.unit.test.ts` compara el motor con la hoja del club, recalculada por LibreOffice con sus propias fórmulas. Coinciden en todo:
- mediana de 3 pliegues y mínimo de 2 sprints;
- Σ6, Σ4, Faulkner, Yuhasz, masa grasa, MLG e IMC;
- asimetría del CMJ unipodal;
- N, media, DT, máximo, mínimo, mejor y peor de las 30 filas del «Informe grupal»;
- las 7 columnas de Z.

Los jugadores son **sintéticos**. `scripts/golden/make_club_fixture.py` toma el libro original solo como estructura: borra las hojas individuales y sustituye nombres y datos. Ni el libro ni nombres reales entran en el repositorio.

Hallazgos en el libro original, que la plataforma no reproduce:
- la celda «Mejor» de la talla mezcla nombres de función en español e inglés (`=SI(CONTAR(…)`), así que fuera de un Excel en español da error;
- algunas celdas de resultado eran valores tecleados y no fórmulas;
- el DSI aparece como «más es mejor». En la plataforma es un cociente **descriptivo**: orienta el entrenamiento y sus puntos de corte están [REQUIERE VERIFICACIÓN].

## 9. Implementación (reestructuración, fase 5): radar y comparativa

- **Dominio** (`packages/domain/src/assessment/normalize.ts`):
  - `scoreOf(valor, sentido, base)` da la puntuación en las cuatro escalas con el sentido corregido. Sin dato, sin sentido (descriptivos) o sin base útil da `null`.
  - `dimensionScore` hace la media ponderada de los tests con dato e informa de los que faltan.
  - `radius` recorta la puntuación al rango de dibujo: Z a ±3, percentil de 0 a 100, % de 50 a 150.
  - `DIMENSION_SETS` define dos juegos de dimensiones:
    - rendimiento: fuerza, potencia, reactividad, aceleración, velocidad, COD, resistencia y composición corporal;
    - salud: fuerza funcional, potencia, movilidad, equilibrio, resistencia y capacidad funcional.
- **Comparativa** (`clientComparison`, `GET /clients/{id}/comparison`):
  - B es, por defecto, la última evaluación con resultados. A es la anterior con más tests en común con B (la más reciente si hay empate).
  - **A y B se puntúan con la misma base**, la del momento B: la sesión de grupo de B, o la más reciente del cliente, o las referencias aplicables a su edad, sexo, deporte y población. Así el radar muestra el cambio del cliente y no el de la base.
  - Escala «automática»: Z frente al grupo si el cliente tiene grupo evaluado; si no, Z frente a la referencia.
  - Si no se eligen dimensiones, se usa el juego con más dimensiones con dato en B.
  - Los tests unilaterales usan la media de los dos lados; la asimetría sigue en cada evaluación.
  - Cada test lleva su cambio real frente al MDC, como en la evolución.
- **Radar** (`components/assessment/radar.tsx`):
  - SVG generado en el servidor, sin JavaScript.
  - B es una línea sólida con relleno suave y A una línea discontinua, así que no depende solo del color. Hay leyenda.
  - El anillo neutro se dibuja algo más grueso y lleva etiqueta.
  - Donde falta un dato, la línea se corta y el eje dice «sin dato».
  - Cada punto muestra su valor al pasar el cursor.
  - Lleva título y descripción para lectores de pantalla y la tabla de dimensiones debajo.
  - Con menos de 3 dimensiones con dato no hay radar: solo la tabla.
- **Evolución**: cada test tiene la tabla «evaluación por evaluación» con el cambio absoluto y % respecto a la anterior.
- Para llegar: ficha del cliente → Evaluación → «Comparativa y radar» (2 clics).
