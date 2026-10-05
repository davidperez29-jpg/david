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

### 3.2 Matriz inicial (17 plantillas de 12 semanas)

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
- **Teclado**: flechas, Intro/F2 o escribir para editar, Intro guarda y baja, Tab guarda y pasa a la derecha, Esc cancela, Supr borra, Alt+↑/↓ mueve la fila, Mayús+Espacio selecciona, Ctrl+A todas, Ctrl+C copia filas (texto con tabuladores, se pega en Excel), Ctrl+V pega, Ctrl+Z deshace. Tab desde la última celda de la fila lleva a «⋯ Más opciones» de esa fila; la tabla no captura las teclas de los botones, enlaces y campos del panel de opciones.
- **Autoguardado por celda con bloqueo optimista** (`expectedVersion` de la fila). Los cambios de una fila se envían en orden. Si otra persona cambió la fila, el cambio no se aplica: se avisa, se recarga la fila y se puede volver a escribir. No se pierde nada sin avisar.
- **Pegar desde Excel o Google Sheets** (`parseSessionTsv`): con o sin fila de títulos (EJERCICIO, SERIES, REPS, CARGA, RIR, RPE, DESC., NOTAS; también «Carga (kg)», «Descanso», «Observaciones»). Vista previa con los ejercicios reconocidos por nombre (`exerciseNameMatcher`: exacto sin tildes ni mayúsculas, alias, o el claramente más parecido; si hay duda, el entrenador elige). Se añaden todas las filas en una transacción (`addSessionExercises`).
- **Deshacer**: cambios de celda, filas añadidas, pegadas o duplicadas y movimientos. Quitar filas pide confirmación.
- Pendiente: tarjetas por ejercicio en el móvil (hoy la tabla se desplaza en horizontal) y sugerencias del motor dentro de la celda.

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
