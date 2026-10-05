# Planificación

> Fase 6. Implementa `MASTER_SPECIFICATION.md` §12. **No se impone un modelo de periodización.** Las plantillas son **puntos de partida, no recetas**, y el entrenador decide. Ningún proceso automático modifica un plan activo.

## 1. Estructura

```
PLAN (3 | 6 | 9 | 12 meses; 1–7 sesiones/semana; borrador → activo → completado/archivado; revisiones)
 └─ FASES → MESOCICLOS (1–16 semanas) → SEMANAS (tipo: introducción, progresión, pico, descarga, evaluación, afinamiento, transición, competición)
     └─ SESIONES (día A/B/C…, fecha) → BLOQUES (tipo + organización: series rectas, superserie, cluster, contraste…) → EJERCICIOS (prescripción)
```

Detalles del modelo:
- Tablas: `training_plans`, `phases`, `mesocycles`, `microcycles`, `sessions`, `session_blocks`, `session_exercises` y `plan_revisions`. Cada nivel hereda la organización y el cliente mediante trigger.
- Las semanas disponibles dependen de la duración: 3/6/9/12 meses = 13/26/39/52 semanas. Un plan puede usar menos semanas (por ejemplo, 12 de las 13 de 3 meses).
- Las fechas se calculan desde la fecha de inicio: cada sesión cae en la primera aparición, a partir del inicio de esa semana, del día elegido por el cliente.

## 2. Prescripción (§12.4–12.6)

`packages/domain/src/planning/prescription.ts`.

**Variables:**
- Series, repeticiones mín.–máx., cluster y pausa, duración, distancia y contactos.
- Carga (kg) y % 1RM.
- **RIR** mín.–máx., **RPE** (pasos de 0,5) y carácter del esfuerzo: tres representaciones distintas que **no se mezclan** (RIR o RPE, no ambos).
- Velocidad objetivo, pérdida de velocidad, tempo (`3-1-X-0`), descanso, ROM, intensidad, bandas y cadenas.

**Validación** (en la API y en la BD):
- rangos;
- tempo;
- **VBT solo** si el ejercicio lo admite (`supports_vbt`) y el cliente no es principiante (criterio práctico, F).

**Textos:**

| Para quién | Ejemplo |
|---|---|
| Entrenador (`prescriptionShort`) | `4×8–10 · @ RIR 1–2 · 75 % 1RM · descanso 2 min` |
| Cliente (`prescriptionForClient`) | «4 series de 8 repeticiones dejando aproximadamente 2 repeticiones en reserva.» |

**Variables visibles:** el editor muestra por defecto las del **perfil de prescripción** del ejercicio (§12.5), las que ya tienen valor y el descanso. «＋ variable» muestra todas.

**% 1RM → kg:** solo a partir de un **1RM medido** (la última evaluación válida del test indicado en `load_basis_metric`, p. ej. `one_rm_back_squat`), redondeado a 2,5 kg. No se usa ninguna ecuación de estimación: la de O'Connor sigue en nivel H (§12.7) y no se aplica.

## 3. Plantillas (§12.2–12.3)

### 3.1 Tabla `plan_templates`
- Guarda **definiciones JSON** compactas:
  - fases y mesociclos con el tipo de cada semana;
  - patrón semanal de sesiones;
  - opcionalmente, semanas explícitas;
  - progresión declarativa por ejercicio.
- Las globales (`organization_id` nulo) son de la plataforma y vienen de `seed-data/templates/templates.json`, generado por `_build.py`.
- Las de la organización se crean con «Guardar como plantilla».
- Catálogo con RLS (`rls_v2`).

**Decisión (ADR-013).** No se usa `training_plans.kind = TEMPLATE`:
- Una plantilla global no pertenece a ninguna organización.
- Copiar cientos de filas en cada organización no escala.
- La plantilla se **expande** al crear el plan (`expandTemplate`).

### 3.2 Matriz inicial (17 plantillas de 12 semanas; las 85 generadas por perfil, nivel y días, en §6 ter)

| Objetivo | Frecuencias | Métodos enlazados (dosis) |
|---|---|---|
| Hipertrofia | 2, 3, 4, 5 días | `hipertrofia` (descansos de más de 60–90 s; series cerca del fallo) |
| Fuerza | 2, 3, 4 días | `fuerza-maxima` (≥ 80 % 1RM) + `hipertrofia` en los accesorios |
| Salud y función | 2, 3, 4 días | `fuerza-mayores` (2–3 × 7–9) |
| Deporte de equipo | 2, 3, 4 días | fuerza, `potencia` (30–70 % 1RM, pérdida de velocidad ≤ 20 %), `pliometria`, `sprint-aceleracion`, `cod-agilidad`, `nordic-hamstring`, `calentamiento-preventivo` |
| Resistencia | 2, 3 días | `concurrente`, fuerza, pliometría |
| Iniciación | 2, 3 días | `dosis-minima` (técnica de patrones) |

**Estructura común:**
- Base: 4 semanas (introducción → progresión → progresión → descarga).
- Desarrollo: 2 mesociclos de 4 semanas; el último termina en semana de **evaluación** con reevaluación prevista.

Cada plantilla enlaza los métodos cuyas variables justifican sus dosis; desde la ficha se navega a su evidencia.

**Qué es recomendación práctica (nivel F), configurable:**
- la **ola de RIR**;
- la **descarga** (−1 serie y RIR +2);
- la selección concreta de ejercicios.

### 3.3 Ejercicios globales
- 92 ejercicios publicados con taxonomía completa (patrón, categorías, músculos, material obligatorio u opcional, perfil, nivel, complejidad e instrucciones técnicas).
- 63 relaciones de progresión, sin ciclos.
- Datos en `seed-data/exercises/global.json`.
- Sin vídeos: necesitan verificación humana (§28).

### 3.4 Crear un plan desde una plantilla
1. Se eligen la plantilla, el inicio y tantos días como sesiones semanales tenga.
2. Se expande con las fechas.
3. Se aplica la progresión de cada semana. Las semanas generadas por progresión se marcan como `derived`.
4. Se convierte % 1RM → kg si hay un 1RM medido; si no, una nota pide prescribir por RIR hasta evaluar.
5. Se **marcan conflictos** sin sustituir nada en silencio:
   - material que el cliente no tiene;
   - ejercicios o patrones no tolerados o con restricción. Las tolerancias son datos de salud y solo se consultan con consentimiento.

## 4. Edición, duplicación y revisiones

### 4.1 Edición de sesiones
- Bloques: añadir, editar, eliminar y reordenar.
- Ejercicios: añadir con buscador, editar, eliminar y reordenar.
- Editar un valor que viene de plantilla o de progresión es un **override**: pasa a `manual` y se audita con los valores anteriores y nuevos y el **motivo**.

### 4.2 Duplicación (copias profundas)
- **Sesión** a otra semana: la fecha se desplaza.
- **Semana** a otra semana: reemplaza las sesiones de destino.
- **Plan** completo: queda en borrador sin fechas. Para otro cliente, sin kg.
- **Guardar como plantilla**: anonimiza (sin cliente, sin fechas y con cargas relativas: el kg se elimina).

### 4.3 Estados y revisiones
- **Activar** exige fecha de inicio y que el cliente **no tenga otro plan activo**.
- Al activar se guarda la **revisión 1**, una instantánea completa.
- «Guardar revisión» (con motivo) crea la siguiente revisión con su diferencia: ejercicios añadidos, quitados y modificados.
- **Regla dura:** ningún proceso automático modifica un plan activo. Las funciones del dominio `doubleProgression` y `rirAdjustment` devuelven **propuestas** con su motivo (nivel F). Se usarán como recomendaciones aceptables con los registros de sesión (Fases 7–8).

## 5. Indicadores (§12.8)

Por semana (`weekIndicators`):
- series por grupo muscular (principal = 1, secundario = 0,5; configurable), sin contar dos veces un mismo músculo en un ejercicio;
- series por patrón y ratio tracción:empuje;
- contactos pliométricos y metros de sprint;
- duración estimada de cada sesión.

El aviso «más de 20 series semanales en un grupo» es un umbral **configurable** y muestra su nivel («F · recomendación práctica configurable»).

## 6. Interfaz

| Dónde | Qué |
|---|---|
| Cliente › Planificación | Lista de planes y asistente «Desde plantilla» (plantilla agrupada por objetivo, inicio y días) o «En blanco» (meses, semanas y días). |
| `/app/plans/{id}` | Tres vistas: **Semanas** (fases, mesociclos, tipo de semana editable, copiar semana, sesiones e indicadores), **Calendario** (mes a mes) y **Gestión y revisiones** (activar, completar, archivar, revisión con motivo, duplicar, guardar como plantilla e historial de revisiones). |
| `/app/plans/{id}/sessions/{id}` | Editor de sesión: datos y nota para el cliente, duplicar en otra semana, bloques y ejercicios con las variables del perfil, texto para el cliente, avisos de validación, origen (plantilla o progresión automática) y enlace a los métodos. |
| `/app/plans/{id}` → **PDF (equipo)** · **PDF (cliente)** | El plan completo semana a semana (ver «PDF del plan»). |
| App del cliente › Calendario → «Descargar … en PDF» | Su plan: solo las sesiones publicadas, en lenguaje sencillo. |
| `/app/plans` y `/app/plans/templates/{id}` | Catálogo de plantillas y vista previa: estructura, sesiones con su prescripción y progresión, y métodos que justifican las dosis. |

**PDF del plan** (pendiente técnico 5; `planDocument`, dominio puro, y el mismo motor PDF que los informes):

- Un apartado por semana (fechas, tipo de semana y fase). En cada sesión: día, título, fecha, duración estimada, objetivo y una tabla **Bloque · Ejercicio · Prescripción · Notas** con las alternativas aprobadas.
- **Versión del equipo**: prescripción técnica (`4×6 @ RIR 2 · descanso 2 min`), notas de la semana, nota interna de la sesión y notas del entrenador por ejercicio. Archivo `plan-<nombre>.equipo.pdf`.
- **Versión del cliente**: prescripción en lenguaje sencillo («4 series de 6 repeticiones dejando…») y solo las notas escritas para el cliente; **nunca** las internas. El entrenador también puede descargarla para entregarla en papel.
- **El cliente** solo descarga sus planes activos o completados, solo con las sesiones **publicadas**, y siempre en su versión (aunque pida la del equipo).
- Cada descarga queda auditada como `export` con su versión. Cuenta como operación pesada en el límite por minuto.

Criterio de aceptación (§16.2): crear un plan de 12 semanas y 3 días desde plantilla en menos de 20 minutos. El test E2E crea el plan, edita una sesión y lo activa en unos segundos.

## 6 bis. Tabla de sesión y vista MES → SEMANA → SESIÓN (reestructuración, fase 2)

> Diseño en `UX_FLOW.md` §2.2–§2.3. Sustituye a los formularios por ejercicio, que quedan en «⋯ Más opciones» de cada fila (tempo, VBT, métodos, alternativas, notas internas).

**Pestaña Programa del cliente**: el plan activo (o el elegido) → meses → semanas (● actual, ✓ hecha, descarga) → sesiones de la semana → tabla de la sesión elegida. Abre en la semana actual y en la próxima sesión por hacer (`programView`, `currentWeekId`). Una semana pertenece al mes de su jueves.

**Tabla** (`SessionGrid`): columnas EJERCICIO · CAT. · SERIES · REPS · CARGA · RIR · RPE · DESC. · NOTAS.

| Celda | Acepta | Se guarda en |
|---|---|---|
| SERIES | `4` | `sets` |
| REPS | `8`, `6-8`, `6 a 8`, `30 s`, `1:30`, `20 m`, `10 contactos` | `repsMin/Max`, `durationS`, `distanceM` o `contacts` (uno sustituye a los otros) |
| CARGA | `80`, `82,5 kg`, `75 %`, `RPE 8`, `@8`, `banda roja`, `PC` | `loadKg`, `loadPct1rm`, `rpeTarget` o `intensityNote` (banda/peso corporal) |
| RIR | `2`, `1-2` | `rirMin/Max` (quita el RPE: uno u otro) |
| RPE | `8`, `8,5` | `rpeTarget` (quita el RIR) |
| DESC. | `90`, `90 s`, `2:30`, `2 min`, `2'30` | `restS` |
| NOTAS | texto | `notesForClient` (las ve el cliente) |

- Intérpretes puros en el dominio (`planning/grid.ts`: `parseCell`, `formatCell`), con pruebas de ida y vuelta (propiedades). Los rangos los valida `validatePrescription`, también en el servidor.
- **Ratón**: un clic selecciona la celda (escribir sustituye su valor, como en una hoja de cálculo); un segundo clic o doble clic la modifica.
- **Teclado**: flechas, Intro/F2 o escribir para editar, Intro guarda y baja, Tab guarda y pasa a la derecha, Esc cancela, Supr borra, Alt+↑/↓ mueve la fila, Mayús+Espacio selecciona, Ctrl+A todas, Ctrl+C copia filas (texto con tabuladores, se pega en Excel), Ctrl+V pega, Ctrl+Z deshace. Tab desde la última celda de la fila lleva a «⋯ Más opciones» de esa fila; la tabla no captura las teclas de los botones, enlaces y campos del panel de opciones.
- **Autoguardado por celda con bloqueo optimista** (`expectedVersion` de la fila). Los cambios de una fila se envían en orden. Si otra persona cambió la fila, el cambio no se aplica: se avisa, se recarga la fila y se puede volver a escribir. No se pierde nada sin avisar.
- **Pegar desde Excel o Google Sheets** (`parseSessionTsv`): con o sin fila de títulos (EJERCICIO, SERIES, REPS, CARGA, RIR, RPE, DESC., NOTAS; también «Carga (kg)», «Descanso», «Observaciones»). Vista previa con los ejercicios reconocidos por nombre (`exerciseNameMatcher`: exacto sin tildes ni mayúsculas, alias, o el claramente más parecido; si hay duda, el entrenador elige). Se añaden todas las filas en una transacción (`addSessionExercises`).
- **Deshacer**: cambios de celda, filas añadidas, pegadas o duplicadas y movimientos. Quitar filas pide confirmación.
- Pendiente: tarjetas por ejercicio en el móvil (hoy la tabla se desplaza en horizontal) y sugerencias del motor dentro de la celda.

## 6 ter. Biblioteca de plantillas (reestructuración, fase 3)

> Diseño en `UX_FLOW.md` §3 y `IMPLEMENTATION_ROADMAP.md` (fase 3). Decisiones A17–A20 en `PRODUCT_ARCHITECTURE.md`.

**Plantillas** (menú principal) es la biblioteca: las de la plataforma (solo lectura) y las del centro («Mis plantillas»), compartidas por su equipo.

- **Filtros** (`listPlanTemplates`, `GET /plan-templates`): texto (sin tildes ni mayúsculas), perfil, nivel 1–3, días por semana, población, tipo (entrenamiento · reducción de factores de riesgo · readaptación), origen y archivadas. Solo se leen los metadatos, nunca el contenido.
- **Para un cliente** (`?client=`): primero las que encajan con su perfil (8 puntos), su nivel (4; uno adyacente, 1), sus días (3) y su material (2); a igualdad, las del centro. «Solo con su material» deja fuera las que necesitan algo que no tiene; si no, se avisa de lo que falta («se puede adaptar»).
  - **Sin perfil o sin nivel** (decisión A21), se ordena con lo que sugieren sus datos:
    - el perfil, por su objetivo más importante que algún perfil proponga (`profileFromGoals`);
    - el nivel, por su experiencia (`suggestLevel`).
  - La página avisa y enlaza a «Asignar perfil». No se guarda nada.
- **Material**: se calcula solo, a partir del material no opcional de sus ejercicios (`equipment_slugs`); nadie lo escribe a mano.

**Usar una plantilla** (Programa → «Usar plantilla» → elegir → Crear: 3 clics y la fecha):
- crea un **plan independiente**: cambiar el plan no toca la plantilla, ni al revés;
- la **duración se elige al usarla** (3, 6, 9 o 12 meses, decisión A17): `fitToDuration` toma las fases en orden y, si la plantilla es más corta, las repite como nuevos ciclos («ciclo 2»). El último mesociclo se acorta para encajar, nunca por debajo de 3 semanas (el plan puede acabar hasta 2 semanas antes del final de la duración). Si no se elige otra duración, la plantilla se usa tal cual;
- las plantillas guardadas desde un plan real (con semanas explícitas) pueden acortarse, no alargarse;
- el plan guarda la plantilla y la **versión** de la que salió (`based_on_template_id`, `based_on_template_version`).

**Mis plantillas**:
- **Crear desde cero**: nombre, sesiones por semana, perfil y nivel → una fase con mesociclos de 4 semanas y las sesiones A, B, C… vacías, listas para rellenar en la tabla;
- **Duplicar** (también una de la plataforma: «Duplicar en mis plantillas») crea una copia independiente;
- **Editar** en la misma tabla que una sesión (decisión A19): mismas teclas, pegar desde Excel, duplicar, mover, quitar y deshacer. La plantilla se guarda entera con su versión (bloqueo optimista): si otra persona la guardó entretanto, no se pisa nada, se avisa y se recarga;
- **Versiones** (decisión A18): cada edición guardada es una versión (`plan_template_versions`). Las ediciones seguidas de la misma persona (menos de 30 minutos) se agrupan en una, salvo que ya se haya creado un plan con ella (`used_at`): una versión usada no cambia nunca. **Restaurar** una versión anterior crea una versión nueva con su contenido: no se pierde nada;
- **Archivar** la oculta de la biblioteca sin borrarla (los planes siguen apuntando a ella); se puede recuperar. Una plantilla archivada no se edita ni se usa.

**Seguridad**: permiso `plans:templates`; las de otra organización no existen para ti (404). RLS de catálogo en `plan_template_versions`, cuya organización copia un disparador desde la plantilla (`inherit_org`), así que una versión nunca puede quedar en otra organización. Todo cambio queda auditado.

### Plantillas iniciales (perfil × nivel × días)

La plataforma trae **102 plantillas**:
- **17 escritas a mano** (`seed-data/templates`);
- **76 generadas** para los 13 perfiles con plantillas genéricas, en sus 3 niveles y con los días que tienen sentido en cada nivel (`packages/db/src/seed/profile-templates.ts`). Las combinaciones que ya cubre una plantilla escrita a mano no se generan;
- **9 rutinas de reducción de factores de riesgo**.

Se cargan con el catálogo y, como las demás de la plataforma, un cambio de contenido es una versión nueva. Volver a cargarlas (en cada arranque) no crea versiones: el contenido se compara sin tener en cuenta el orden de las claves, que `jsonb` no conserva.

| Perfil | Nivel 1 | Nivel 2 | Nivel 3 |
|---|---|---|---|
| Rendimiento deportivo | 2, 3 | 2, 3, 4 | 3, 4, 5 |
| Deportes de equipo | 2, 3 | 2, 3, 4 | 2, 3, 4 |
| Deportes individuales | 2, 3 | 2, 3, 4 | 3, 4, 5 |
| Deportes de resistencia | 2 | 2, 3 | 2, 3 |
| Hipertrofia | 2, 3, 4 | 3, 4, 5 | 3, 4, 5 |
| Fuerza | 2, 3 | 2, 3, 4 | 3, 4 |
| Iniciación a la fuerza | 2, 3 | 2, 3 | 2, 3 |
| Salud | 2, 3, 4 | 2, 3, 4 | 2, 3, 4 |
| Mejora de la funcionalidad · Función muscular · Adulto mayor | 2, 3 | 2, 3 | 2, 3, 4 |
| Función coordinativa · Parálisis cerebral leve | 2, 3 | 2, 3 | 2, 3 |

Recuperación/readaptación y retorno al deporte no tienen plantillas genéricas: se programan por el protocolo de la lesión (fase 7). El perfil personalizado tampoco: lo define el entrenador.

**Estructura común.** Un bloque de 13 semanas, que es la duración de 3 meses:
- tres mesociclos de 4, 4 y 5 semanas;
- descargas en las semanas 4 y 8 y reevaluación en la semana 13;
- en rendimiento y fuerza, una semana de pico antes de la evaluación.

Para 6–12 meses el bloque se repite como nuevos ciclos (A17).

**Ejercicios y niveles:**
- el nivel 1 usa variantes estables y sencillas, y el 3 pesos libres y variantes más exigentes;
- los ejercicios unilaterales se marcan «cada lado».

**Identificadores.** Los slugs son `perfil-<perfil>-n<nivel>-<días>d` y `riesgo-<rutina>-n<nivel>`. El motor de decisiones sigue eligiendo plantilla por la familia del objetivo (`hipertrofia-`, `fuerza-`…), así que estas plantillas no cambian sus propuestas.

**Evidencia de las dosis** (métodos enlazados en cada plantilla). La elección de ejercicios, la ola de RIR y las descargas son recomendaciones prácticas (F).

| Familia | Métodos | Qué respaldan |
|---|---|---|
| Hipertrofia | `hipertrofia`, `rir-rpe` | Descansos ≥ 60–90 s, volumen, proximidad al fallo |
| Fuerza · rendimiento · resistencia | `fuerza-maxima` solo desde el nivel 2; `rir-rpe`; `concurrente` en resistencia | `fuerza-maxima` es > 80 % 1RM; el nivel 1 (6–8 a RIR 3) queda por debajo |
| Iniciación | `dosis-minima`, `rir-rpe` | Poco volumen, mucha técnica |
| Salud · funcionalidad · función muscular | `actividad-fisica-oms`, `rir-rpe` | OMS 2020: 150–300 min/semana de aeróbico moderado y fuerza regular |
| Adulto mayor | `fuerza-mayores`, `equilibrio-mayores`, `potencia` (desde el nivel 2) | 2–3 × 7–9; equilibrio en todas las sesiones: en mayores sanos, las mayores mejoras se asociaron a 3 sesiones/semana durante 11–12 semanas. El ejercicio de equilibrio y funcional reduce la tasa de caídas, y combinado con fuerza probablemente más |
| Parálisis cerebral leve | `fuerza-paralisis-cerebral` | Evidencia contradictoria y de baja calidad, casi toda en niños y adolescentes; recomendaciones específicas de 2016; coordinar con el equipo sanitario |
| Rendimiento y deportes | `pliometria`, `potencia`, `halterofilia-derivados` (nivel 3), `sprint-aceleracion`, `cod-agilidad`, `nordic-hamstring` y `calentamiento-preventivo` | — |
| Función coordinativa | `core`, `pliometria`, `potencia`, `cod-agilidad` | En adultos no hay evidencia verificada de equilibrio: criterio práctico, sin reutilizar la de mayores |

**Rutinas de reducción de factores de riesgo** (tipo «Reducción de factores de riesgo», población deportistas). Dos veces por semana, unos 15 minutos, una plantilla por nivel. Sus textos nunca presentan la prevención como un hecho.
- **Aductores**, con el Copenhagen de palanca corta → palanca larga → con movimiento: en futbolistas se asoció a menos problemas inguinales.
- **Isquiosurales**, con puente y peso muerto a una pierna, y nórdico desde el nivel 2: «puede reducir», con una magnitud incierta.
- **Cuádriceps**, con isométricos → bajada lenta → frenadas y aterrizajes: sin evidencia verificada sobre lesiones (F).

**Comprobado por tests.**
- `packages/db/test/profile-templates.unit.test.ts`:
  - cada combinación ofrecida existe exactamente una vez;
  - definiciones, ejercicios, métodos y prescripciones son válidos y cada ejercicio dice cuánto;
  - no hay ejercicios avanzados en el nivel 1, ni de impacto alto para mayores o parálisis cerebral en los niveles 1–2;
  - la evidencia de mayores no se reutiliza en otros adultos, y el nivel 1 no cita `fuerza-maxima`.
- `packages/application/test/seed-templates-contract.unit.test.ts`: toda plantilla de la plataforma, duplicada, se puede guardar desde la tabla.

## 7. Permisos

| Permiso | ADMIN | TRAINER | CLIENT |
|---|---|---|---|
| `plans:read` / `plans:write` | Organización | Clientes asignados | ✗ (ve sus sesiones publicadas: `sessions:read`, ver `SESSIONS.md`) |
| `plans:templates` | Organización | Organización | ✗ |

Además, RLS: las tablas de planificación son de tipo `client_optional` y las plantillas de tipo `catalog`. Lo que queda fuera de ámbito devuelve 404.

## 8. Pendiente

| Elemento | Fase |
|---|---|
| ~~Publicar sesiones al cliente, reproductor, registro y sustitución en vivo~~ Hecho: ver `SESSIONS.md` | 7 |
| Propuestas de progresión a partir de los registros (doble progresión, ajuste por RIR) como recomendaciones | 8/11 |
| Opción por cliente «aplicar progresiones rutinarias sin confirmación» (desactivada por defecto) | 11 |
| Normalizar las 4 rutinas Excel aportadas como plantillas «3 días / 5 mesociclos / 36 semanas» tras su revisión | Operación (§18.1) |
| Propuesta de plan por el motor de decisiones (`PROPOSAL`) | 10–11 |
| ~~PDF del plan~~ Hecho: versión del equipo y del cliente | Pendientes técnicos |
