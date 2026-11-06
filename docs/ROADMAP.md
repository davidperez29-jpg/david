# Hoja de ruta

Fases definidas en la especificación maestra (`MASTER_SPEC.md`). Cada fase empieza solo con **aprobación explícita** y termina con un informe de revisión.

| Fase   | Contenido                                                                                                                                                                                                                                                                                                             | Estado                                                                           |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1      | **Fundamentos**: entorno, proyecto limpio, tecnologías, arquitectura, configuración, identidad visual, primera interfaz navegable del entrenador y del cliente, modelo conceptual de datos (incluida la biblioteca multidimensional)                                                                                  | Hecha y revisada (`PHASE1_REPORT.md`)                                            |
| **1B** | **Ciclo funcional completo con datos ficticios**, sin infraestructura externa: crear cliente → evaluar → planificar → prescribir → ejecutar desde el móvil → registrar → analizar (ver abajo)                                                                                                                         | **Acuerdo conceptual (6 de noviembre de 2026); alcance pendiente de aprobación** |
| 2      | **Autenticación y usuarios**: registro e inicio de sesión, roles, entrenadores, clientes, permisos y aislamiento de datos (con base de datos y RLS). El esquema incluye ya el modelo de la 1B                                                                                                                         | Pendiente de aprobación (requiere decidir P-01, P-02)                            |
| 3      | **Clientes**: gestión, fichas individuales, pestañas, información y objetivos. _La 1B adelanta el alta y la edición básica con datos ficticios._                                                                                                                                                                      | Pendiente                                                                        |
| 4      | **Biblioteca**: modelo de datos completo, catálogo, etiquetas multidimensionales, patrones, variantes, progresiones y regresiones, filtros Y/O, buscador avanzado, favoritos. _Añade siluetas y vídeos reales con almacenamiento y la administración del catálogo; la 1B solo usa material sintético._                | Pendiente (P-10, P-32, P-33)                                                     |
| 5      | **Evaluaciones**: registro de pruebas e intentos, historial, gráficos, comparaciones. _La 1B adelanta el registro con datos ficticios; quedan protocolos y fiabilidad verificados._                                                                                                                                   | Pendiente                                                                        |
| 6      | **Planificación**: planes, semanas, sesiones, programación de ejercicios, integración con la biblioteca. _La 1B adelanta sesiones, prescripción por serie, plantillas y duplicados; quedan planes, semanas y persistencia real._                                                                                      | Pendiente                                                                        |
| 7      | **Portal del cliente**: entrenamiento diario protagonista, consulta de ejercicios, registro de ejecución, comunicación con el entrenador, progreso en un apartado independiente. _La 1B adelanta el reproductor guiado y el registro sin conexión; quedan persistencia real, comunicación y pruebas en dispositivos._ | Pendiente                                                                        |
| 8      | **Carga y volumen**: cálculos, seguimiento, resúmenes y análisis. _La 1B adelanta prescrito frente a ejecutado; quedan carga interna, pérdida de velocidad calculada y estimación del 1RM (P-23, P-24)._                                                                                                              | Pendiente                                                                        |
| 9      | **Readaptación e informes**: procesos, fases, criterios, informes                                                                                                                                                                                                                                                     | Pendiente                                                                        |
| 10     | **Validación y despliegue**: seguridad, pruebas, rendimiento, accesibilidad, PWA (incluido iOS real) y despliegue (solo tras autorización)                                                                                                                                                                            | Pendiente                                                                        |

Algunas pantallas de fases posteriores ya existen como **propuesta visual con datos ficticios**. Su lógica de dominio está probada, pero no tienen persistencia ni edición. `PHASE1_REPORT.md` detalla qué funciona de verdad y qué no.

---

## Fase 1B · Propuesta definitiva

> **Pendiente de aprobación. No hay código.** Esta propuesta aplica las decisiones que figuran como «propuesta» en `DECISIONS.md`; ninguna se da por aprobada. Si cambias alguna, el alcance se ajusta antes de empezar.

### 1. Objetivo y límites

Probar **el ciclo funcional completo de TrainPro** con datos ficticios: **crear cliente → evaluar → planificar → prescribir → ejecutar desde el móvil → registrar → analizar**.

- **Sin infraestructura externa:** sin base de datos, sin Supabase, sin autenticación real, sin almacenamiento en la nube, sin despliegue y sin costes.
- **Sin dependencias nuevas** (P-11). Se usan APIs del navegador (IndexedDB, `<video>`, Wake Lock) y lo que ya tiene el proyecto.
- **Se conserva todo lo que funciona.** Las 110 pruebas unitarias y las 85 E2E actuales siguen pasando. Las que cambien porque cambia el comportamiento (por ejemplo, «nada se guarda» o la suma de repeticiones de P-36) se actualizarán con su justificación en el informe.
- **Arquitectura intacta:** dominio puro, casos de uso con permisos y puertos de repositorio. Lo nuevo entra por los mismos puntos.
- **Datos ficticios:** los datos se guardan en la memoria del servidor (P-39) y la identidad del cliente se elige en modo demostración (P-40). Los formularios avisan de que no se introduzcan datos personales reales.

### 2. Funcionalidades (lista cerrada)

| Id   | Funcionalidad                         | Incluye                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-01 | Datos demo con escritura              | Adaptador en memoria que admite altas y cambios mediante los casos de uso; vuelve a los datos iniciales al reiniciar; botón «Restablecer datos demo»; espacios aislados para E2E; aviso en los formularios                                                                                                                                                                                                                                                                        |
| F-02 | Identidad demo del cliente            | «Entrar como…» en el portal, solo entre los clientes ficticios de Alex, con la etiqueta «Modo demostración»; validado en el servidor                                                                                                                                                                                                                                                                                                                                              |
| F-03 | Crear cliente                         | Alta y edición de los datos básicos (nombre, objetivo, población, deporte), con validación y minimización (sin fecha de nacimiento, teléfono ni dirección)                                                                                                                                                                                                                                                                                                                        |
| F-04 | Evaluar                               | Registrar un resultado de una prueba del catálogo con intentos, regla de agregación, método, instrumento, fecha y procedencia; 1RM directo; 1RM estimado **introducido a mano** (`estimated`, con el método); peso corporal con fecha. Sin valores normativos ni «cambio relevante»                                                                                                                                                                                               |
| F-05 | Indicaciones y restricciones          | Por cliente (generales o para una variante) y por sesión; visibles para el cliente en los ejercicios afectados; las de origen sanitario, sin diagnóstico                                                                                                                                                                                                                                                                                                                          |
| F-06 | Planificar sesiones                   | Crear y editar sesiones (fecha, título, objetivo, duración estimada, nota, calentamiento, orden y etiqueta del día), borrador y publicación, versiones, duplicar (al mismo cliente y a otro, P-19) y plantillas (guardar y aplicar)                                                                                                                                                                                                                                               |
| F-07 | Prescribir                            | Editor por ejercicio con prescripción común y **por serie** (P-41): repeticiones o rango (y por lado), 10 modalidades de carga, esfuerzo (RIR, RPE con la escala basada en RIR, carácter, intención o ninguno), descanso, tempo de 3 o 4 cifras, observaciones visibles y privadas, criterios de finalización, series de aproximación, medición opcional (P-25), bloques y su modo; %1RM con la referencia del cliente, redondeo y congelación al publicar; validaciones y avisos |
| F-08 | Ficha del ejercicio y material visual | Ficha completa del §2 de `TRAINING_EXPERIENCE.md`; tres huecos por variante con su estado; vista «Material pendiente»; alternativa cuando falta o falla un recurso; 2–3 clips sintéticos y siluetas propias para las variantes de las sesiones demo (P-38)                                                                                                                                                                                                                        |
| F-09 | Pantalla «Hoy»                        | Sesión del día con objetivo, duración y número de ejercicios; dos sesiones el mismo día (P-21); «Continuar entrenamiento»; día sin sesión con la próxima                                                                                                                                                                                                                                                                                                                          |
| F-10 | Reproductor guiado                    | Vista previa, calentamiento (hacer o saltar), ejercicio actual con la tarjeta de prescripción, silueta, vídeo, indicaciones y restricciones, registro de series con un toque, descanso, siguiente ejercicio, panel «Tu sesión», saltar un ejercicio con motivo, terminar (con confirmación si faltan series), RPE de la sesión si el entrenador lo pide, mensaje y resumen                                                                                                        |
| F-11 | Registro sin conexión y reanudación   | Cada serie se guarda primero en el dispositivo con su identificador; cola de envío idempotente; «Guardado en el móvil» frente a «Enviado»; correcciones como versiones; reanudación tras cerrar o recargar (P-17, P-42); borrado de los datos locales al salir                                                                                                                                                                                                                    |
| F-12 | Textos claros para el cliente         | Ayudas de RIR, RPE (escala basada en RIR), tempo, carga autoseleccionada, lastre, asistencia, intención y calidad, con el texto aprobado (P-26)                                                                                                                                                                                                                                                                                                                                   |
| F-13 | Analizar                              | En la ficha del cliente: lo realizado serie a serie frente a lo prescrito, con la versión; volumen y tonelaje prescritos frente a ejecutados según P-36; lastre, asistencia, intensidad relativa (con referencia) y carga respecto al peso corporal (con peso medido); anotaciones del entrenador; panel con las sesiones del día (también dos por día)                                                                                                                           |
| F-14 | Progreso del cliente                  | Solo lo compartido por el entrenador, con las métricas nuevas                                                                                                                                                                                                                                                                                                                                                                                                                     |
| F-15 | Permisos                              | Políticas `canLogExecution`, `canEditPrescription`, `canAnnotateExecution`, `canViewMedia` y las de clientes y evaluaciones, con tests de acceso no autorizado                                                                                                                                                                                                                                                                                                                    |

**Fuera de la 1B:** autenticación real, base de datos, almacenamiento en la nube, subida de vídeos, vídeos con personas, vídeos sin conexión, ecuaciones de estimación del 1RM, cálculo de pérdida de velocidad, integración de dispositivos, carga interna (RPE de la sesión × duración), planes, semanas y mesociclos, mensajería, notificaciones, informes, edición de la readaptación, interfaz de administración del catálogo, CI y despliegue.

### 3. Definiciones que fija la 1B

#### 3.1 Prescripción por serie (P-41)

El entrenador elige entre **prescripción común** («4 × 6, 80 kg, RIR 2, 120 s, 2-0-1») o **configuración por serie**, en la que cualquier campo de una serie concreta sustituye al común:

| Serie | Repeticiones | Carga | Esfuerzo | Descanso | Tempo | Observación          |
| ----- | ------------ | ----- | -------- | -------- | ----- | -------------------- |
| 1     | 8            | 70 kg | RIR 3    | 120 s    | 3-0-1 | —                    |
| 2     | 6            | 80 kg | RIR 2    | 150 s    | 2-0-1 | —                    |
| 3     | 6            | 80 kg | RIR 2    | 150 s    | 2-0-1 | —                    |
| 4     | 4–6          | 85 kg | RIR 1    | —        | 2-1-1 | «Pausa de 1 s abajo» |

Se pueden variar por serie: repeticiones o rango, **modalidad de carga** y carga (por ejemplo, serie 1 con peso corporal y las demás con lastre), objetivo de esfuerzo (RIR o RPE, o ninguno), descanso, tempo, observación visible, nota privada y criterios de finalización. Si se reduce el número de series, las configuraciones de las series que desaparecen se eliminan con aviso. El cliente ve el objetivo de **la serie actual** y la lista de todas.

#### 3.2 Potencia, pliometría, velocidad y técnica (P-35, P-25, P-37)

| Ejercicio                      | Carga externa             | Repeticiones       | Intención  | Calidad técnica                                          | Velocidad medida                                               | Valoración sin instrumento | RIR/RPE                             |
| ------------------------------ | ------------------------- | ------------------ | ---------- | -------------------------------------------------------- | -------------------------------------------------------------- | -------------------------- | ----------------------------------- |
| Salto con contramovimiento     | Sin carga (peso corporal) | 4 × 5 saltos       | Máxima     | «Para si el aterrizaje deja de ser estable y silencioso» | Solo si el entrenador indica un instrumento; si no, no se pide | Buena, aceptable o baja    | No                                  |
| Sentadilla con salto           | 20 kg (barra)             | 4 × 4              | Máxima     | Texto del entrenador                                     | Opcional, transcrita del instrumento indicado (`imported`)     | Sí                         | No                                  |
| Lanzamiento de balón medicinal | 4 kg (implemento)         | 3 × 6 lanzamientos | Máxima     | Texto del entrenador                                     | —                                                              | Sí                         | No                                  |
| Sprint de 20 m                 | Sin carga                 | 6 × 20 m           | Máxima     | «Para si pierdes la postura»                             | Tiempo solo si se indica el cronometraje                       | Sí                         | No                                  |
| Ejercicio técnico              | Ligera (autoseleccionada) | 3 × 5              | Controlada | Criterio técnico                                         | —                                                              | Sí                         | No                                  |
| Potencia con cargas altas      | kg o %1RM                 | 5 × 2              | Máxima     | Texto del entrenador                                     | Opcional                                                       | Opcional                   | Opcional, si el entrenador lo añade |

- **Carga externa, repeticiones, intención, calidad técnica, medición y valoración son datos distintos** y se guardan por separado.
- En estos ejercicios, la tarjeta de prescripción muestra **«Intención: máxima velocidad en cada repetición»** en el lugar del esfuerzo.
- **La velocidad nunca se inventa.** El campo solo aparece si el entrenador indica el instrumento. El valor lo introduce una persona y se guarda como `imported` («transcrito a mano»). La 1B **no calcula pérdidas de velocidad ni propone umbrales**, y los datos demo **no contienen valores de velocidad**. Si el entrenador escribe un umbral, es una prescripción suya, visible como tal.
- La **valoración cualitativa** es una escala operativa no validada, marcada como valoración personal y excluida de los cálculos.
- Una serie terminada por su criterio de calidad **cuenta como hecha**, porque cumple lo prescrito; la diferencia de repeticiones aparece en el resumen.

#### 3.3 Material visual (P-28, P-38)

Cada variante tiene **tres huecos propios**: silueta, vídeo breve (< 15 s) y vídeo ampliado (≤ 45 s).

| Situación          | Lo que ve el cliente                                            | Lo que ve el entrenador       |
| ------------------ | --------------------------------------------------------------- | ----------------------------- |
| Sin silueta propia | Pictograma del tipo con «Imagen orientativa»                    | «Silueta pendiente»           |
| Sin vídeo breve    | Silueta e instrucciones, sin reproductor vacío                  | «Vídeo breve pendiente»       |
| Sin vídeo ampliado | No aparece el botón                                             | «Ampliado: no hay» (opcional) |
| Ampliado sin breve | No ocurre: el ampliado no se publica sin el breve               | Aviso al intentarlo           |
| El vídeo no carga  | Silueta, instrucciones, «No se ha podido cargar» y «Reintentar» | Igual                         |

**Material pendiente:** cada hueco tiene un estado (publicado, pendiente o genérico). La biblioteca muestra insignias («Sin vídeo breve») y un filtro «Material pendiente». Una vista lista las variantes incompletas, ordenadas por cuántas veces están prescritas en sesiones próximas, para priorizar la producción. En la 1B no se suben archivos: los huecos con material son los clips sintéticos y las siluetas propias incluidas en el proyecto.

#### 3.4 Dos sesiones el mismo día y reanudación (P-21, P-17, P-42)

- Cada sesión tiene **orden** (obligatorio si hay dos ese día) y **etiqueta** opcional. «Hoy» destaca la sesión en curso o, si no hay, la primera pendiente; la otra aparece debajo con su estado.
- Empezar la segunda con la primera en curso pide confirmación y deja la primera **en pausa**. Solo una se ejecuta en el reproductor.
- Cada sesión tiene su registro, su estado y su resumen. El panel del entrenador y la semana muestran las dos.
- **Abandonar no termina la sesión.** Salir del reproductor, cerrar la app, bloquear el móvil o perder la conexión la deja en curso. Solo «Terminar» la finaliza.
- **Se conserva todo:** cada serie (con sus correcciones), las valoraciones y observaciones (también los borradores), el calentamiento hecho o saltado, los ejercicios saltados con motivo, las horas y la versión de la prescripción. Primero en el dispositivo y después en el servidor.
- **Al volver:** «Continuar entrenamiento» abre el último ejercicio visitado con series pendientes o, si no queda ninguno, la primera serie pendiente. Un descanso en curso se recalcula con su hora de fin.
- Se puede retomar **hasta el final del día programado**. Después la sesión queda como parcial (o no realizada) y sus registros se conservan.

### 4. Ejemplos de cálculo (P-20, P-36)

Estos ejemplos se convertirán en **pruebas unitarias con los valores exactos**. Peso corporal del cliente ficticio: 72 kg.

| Ejercicio                                  | Prescrito                                                                | Ejecutado                                                                                      | Volumen prescrito → ejecutado             | Tonelaje externo                 | Magnitud propia                                                                                                          | No se calcula                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ----------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| **Sentadilla trasera** (carga externa)     | Aproximación 5 × 40 kg y 3 × 60 kg; trabajo 4 × 6 × 80 kg, RIR 2         | 6 × 80 · 6 × 80 (+ un reenvío de esa serie, ignorado) · 6 × 77,5 · 5 × 80                      | 4 series, 24 rep. → 4 series, 23 rep.     | 1.920 kg → **1.825 kg** (−95 kg) | Aproximación aparte: 2 series, 8 rep., 380 kg                                                                            | —                                                             |
| **Dominadas con peso corporal y lastre**   | Serie 1: 8 × peso corporal; series 2–4: 5 × peso corporal + 10 kg; RIR 2 | 8 sin lastre · 5 × +10 · 4 × +10 · 5 × +7,5                                                    | 4 series, 23 rep. → 4 series, 22 rep.     | No aplica                        | Carga externa añadida: 150 kg → **127,5 kg**                                                                             | 72 kg × 22 = 1.584 kg (peso corporal × repeticiones)          |
| **Dominadas asistidas**                    | 3 × 8, asistencia de 20 kg (máquina), RIR 2                              | 8 × 20 · 8 × 20 · 6 × 25 kg de asistencia                                                      | 3 series, 24 rep. → 3 series, 22 rep.     | No aplica                        | Asistencia por serie 20 / 20 / 25 kg; media ponderada **21,4 kg** (470 ÷ 22); serie 3 marcada «más ayuda de la prevista» | 72 − 20 = 52 kg como «carga movida»                           |
| **Remo con banda elástica**                | 3 × 12, banda roja doble, RIR 3                                          | 12 roja doble · 12 roja doble · 10 roja simple                                                 | 3 series, 36 rep. → 3 series, 34 rep.     | No aplica                        | 2 series con la configuración prescrita y 1 distinta (marcada)                                                           | Kg o tonelaje de la banda; comparación entre bandas distintas |
| **Salto con contramovimiento** (sin carga) | 4 × 5 saltos, intención máxima, criterio de calidad, sin RIR/RPE         | 5 · 5 · 5 · 4 (la última, terminada por el criterio); valoración buena, buena, aceptable, baja | 4 series, 20 saltos → 4 series, 19 saltos | No aplica                        | Contactos; todas las series cuentan como hechas                                                                          | Altura de salto (no hay instrumento)                          |

Con la sentadilla al **75 % de un 1RM directo de 107 kg**: 0,75 × 107 = 80,25 → **80 kg** (múltiplo de 2,5 kg más cercano), congelado al publicar. La intensidad relativa de la tercera serie es 77,5 ÷ 107 = **72,4 %**.

**Totales de esa sesión, sin mezclar magnitudes:**

| Magnitud                        | Prescrito           | Ejecutado           |
| ------------------------------- | ------------------- | ------------------- |
| Series de trabajo (todas)       | 18                  | 18                  |
| Repeticiones de fuerza          | 107                 | 101                 |
| Saltos (contactos)              | 20                  | 19                  |
| Tonelaje externo                | 1.920 kg            | 1.825 kg            |
| Carga externa añadida (lastre)  | 150 kg              | 127,5 kg            |
| Asistencia media                | 20 kg               | 21,4 kg             |
| Series de aproximación (aparte) | 2 · 8 rep. · 380 kg | 2 · 8 rep. · 380 kg |

No se muestran un total de «repeticiones» que sume fuerza y saltos (120), ni un total de «kg» que sume tonelaje, lastre y asistencia.

### 5. Criterios de aceptación y pruebas

**U** = prueba unitaria o de integración (Vitest) · **E** = E2E (Playwright, escritorio y móvil Pixel 7) · **M** = revisión manual documentada en el informe. Los identificadores CA-xx remiten a `TRAINING_EXPERIENCE.md` §12.

| Func. | Id    | Criterio verificable                                                                                                                                                              | Prueba  |
| ----- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| F-01  | 1B-01 | Clientes, evaluaciones, sesiones y registros creados persisten entre páginas y recargas mientras el servidor sigue en marcha                                                      | E       |
| F-01  | 1B-02 | «Restablecer datos demo» devuelve exactamente el conjunto inicial                                                                                                                 | U, E    |
| F-01  | 1B-03 | Todos los formularios muestran el aviso de no introducir datos personales reales                                                                                                  | E       |
| F-01  | 1B-04 | Las pruebas E2E con escritura se ejecutan en paralelo en espacios aislados, sin interferir entre sí                                                                               | E       |
| F-02  | 1B-05 | «Entrar como…» solo ofrece clientes ficticios de Alex, se identifica como «Modo demostración» y el servidor rechaza un identificador ajeno                                        | U, E    |
| F-03  | 1B-06 | Un cliente creado aparece en la lista y en la búsqueda sin tildes; faltan campos obligatorios → error explicado                                                                   | U, E    |
| F-03  | 1B-07 | Un entrenador no puede ver, editar ni planificar clientes de otro (acceso no autorizado probado)                                                                                  | U       |
| F-04  | 1B-08 | Un resultado con varios intentos se guarda como `calculated` con su regla, y cada intento conserva su procedencia                                                                 | U, E    |
| F-04  | 1B-09 | 1RM directo y 1RM estimado manual se muestran separados; el estimado no sustituye al directo; no hay ninguna ecuación de estimación                                               | U       |
| F-04  | 1B-10 | El peso corporal se registra con fecha; sin él, no se calcula la carga respecto al peso corporal                                                                                  | U       |
| F-05  | 1B-11 | CA-07 y CA-35: las indicaciones y restricciones de un cliente aparecen en sus ejercicios afectados, en los de ningún otro cliente y sin diagnóstico                               | U, E    |
| F-06  | 1B-12 | El cliente solo ve sesiones publicadas (CA-41)                                                                                                                                    | U       |
| F-06  | 1B-13 | Dos sesiones el mismo día exigen orden y se muestran con su etiqueta                                                                                                              | U, E    |
| F-06  | 1B-14 | Duplicar a otro cliente sigue P-19 (CA-38); los kg solo se copian si se marca la opción                                                                                           | U       |
| F-06  | 1B-15 | Aplicar una plantilla resuelve el %1RM con la referencia del cliente o lo marca para revisar; cambiar la plantilla no altera sesiones creadas (CA-39, CA-40)                      | U       |
| F-06  | 1B-16 | Editar una sesión publicada crea una versión nueva; si está en curso, el cliente ve el aviso y lo registrado conserva su versión (CA-34)                                          | U, E    |
| F-07  | 1B-17 | Prescripción común y por serie de repeticiones o rango, modalidad y carga, esfuerzo, descanso, tempo y observaciones; el cliente ve el objetivo de la serie actual (CA-14, CA-37) | U, E    |
| F-07  | 1B-18 | Los seis ejemplos de carga del requisito se prescriben y se muestran con su texto; el formulario solo muestra los campos de la modalidad (CA-09, CA-10)                           | U, E    |
| F-07  | 1B-19 | %1RM: kg calculados con la referencia y el redondeo, con fórmula y versión, congelados al publicar; sin referencia no se publica (CA-11, CA-12)                                   | U       |
| F-07  | 1B-20 | El esfuerzo empieza vacío; RIR + RPE exige justificación; RPE solo con la escala basada en RIR; RIR en series por tiempo o distancia, rechazado (CA-13, CA-15, CA-16)             | U       |
| F-07  | 1B-21 | Potencia y técnica: intención, criterio de calidad y valoración sin RIR/RPE; el campo de velocidad solo aparece con instrumento indicado y no hay valores ni umbrales por defecto | U, E    |
| F-07  | 1B-22 | Tempo de 3 y 4 cifras, con su explicación                                                                                                                                         | U       |
| F-08  | 1B-23 | Cada variante muestra sus tres huecos con estado; la vista «Material pendiente» lista las incompletas y el filtro funciona                                                        | U, E    |
| F-08  | 1B-24 | Sin recurso o con fallo de carga se aplica la tabla del §3.3; el ampliado no se publica sin el breve (CA-04, CA-05, CA-06)                                                        | U, E    |
| F-08  | 1B-25 | El clip sintético se reproduce silenciado y en bucle, con botón de pausa, y no se reproduce solo con `prefers-reduced-motion` (CA-50)                                             | E       |
| F-09  | 1B-26 | «Hoy» muestra objetivo, duración, número de ejercicios y el botón sin desplazarse; dos sesiones, continuar y día de descanso (CA-22, CA-30, CA-31)                                | E       |
| F-10  | 1B-27 | Calentamiento opcional, ejercicio con todos sus datos en una pantalla, serie prevista con un toque, descanso con ±15 s y saltar, siguiente, «Tu sesión» y resumen (CA-23 a CA-28) | E       |
| F-10  | 1B-28 | Saltar un ejercicio guarda el motivo y no cuenta como hecho; terminar con series pendientes pide confirmación                                                                     | U, E    |
| F-11  | 1B-29 | Sin conexión se registran series; al recuperarla se envían y cambia el estado visible (CA-32)                                                                                     | E       |
| F-11  | 1B-30 | Un reenvío con el mismo identificador o una corrección no aumentan series, repeticiones ni tonelaje (CA-33)                                                                       | U, E    |
| F-11  | 1B-31 | Tras recargar o cerrar, «Continuar» abre el punto de P-42 con todo lo registrado; el descanso en curso es correcto                                                                | E       |
| F-11  | 1B-32 | Al salir del modo demostración se borran los datos del dispositivo, avisando si hay series sin enviar (CA-36)                                                                     | E       |
| F-12  | 1B-33 | Las ayudas se abren en la misma pantalla con el texto aprobado (CA-18)                                                                                                            | E       |
| F-13  | 1B-34 | La ficha del cliente muestra lo realizado serie a serie frente a lo prescrito, con la versión y las diferencias marcadas con icono y texto                                        | E       |
| F-13  | 1B-35 | Los cinco ejemplos y los totales del §4 se reproducen con los valores exactos (CA-43 a CA-46)                                                                                     | U       |
| F-13  | 1B-36 | El entrenador anota una serie sin poder modificar lo registrado por el cliente                                                                                                    | U       |
| F-14  | 1B-37 | El progreso del cliente solo muestra lo compartido                                                                                                                                | U, E    |
| F-15  | 1B-38 | Cada política nueva tiene un test de acceso permitido y otro no autorizado                                                                                                        | U       |
| Todas | 1B-39 | Ciclo completo del §6 en escritorio (entrenador) y móvil (cliente)                                                                                                                | E       |
| Todas | 1B-40 | Sin incidencias graves de axe ni desplazamiento horizontal en las pantallas nuevas (CA-49); carga y esfuerzo, los textos más grandes de la ficha del ejercicio (CA-48)            | E, M    |
| Todas | 1B-41 | `pnpm check` y `pnpm test:e2e` pasan; `package.json` no tiene dependencias nuevas; lo simulado se marca con `PendingFeature` o `Notice` (CA-52)                                   | U, E, M |

### 6. Prueba del ciclo completo (1B-39)

Una prueba E2E recorre el ciclo con valores comprobables:

1. **Crear cliente:** Alex da de alta a «Lucía (ficticia)».
2. **Evaluar:** registra un 1RM directo de sentadilla de 100 kg y un peso corporal de 65 kg.
3. **Planificar y prescribir** una sesión para hoy, y publicarla:
   - A1 · Sentadilla trasera, 4 × 6 al 75 % del 1RM (→ **75 kg**), RIR 2, 120 s, tempo 2-0-1.
   - B1 · Dominadas, 3 × 5, peso corporal + 5 kg, RIR 2.
   - C1 · Salto con contramovimiento, 3 × 5, sin carga, intención máxima y criterio de calidad.
4. **Ejecutar desde el móvil** como Lucía:
   - Sentadilla: dos series de 6 × 75 kg. **Sin conexión**: 6 × 72,5 kg y 5 × 75 kg.
   - Recarga la página → «Continuar» abre las dominadas.
   - **Vuelve la conexión** y se envía la cola. Se fuerza el reenvío de una serie, que no debe contar.
   - Dominadas: 5, 5 y 4 con +5 kg. Saltos: 5, 5 y 5, con su valoración.
   - Termina.
5. **Registrar:** el resumen muestra 10 de 10 series y la sesión completada.
6. **Analizar** como Alex:
   - Sentadilla: 24 → 23 repeticiones, tonelaje 1.800 → **1.710 kg**; intensidad relativa de la tercera serie, 72,5 %.
   - Dominadas: 15 → 14 repeticiones; lastre 75 → **70 kg**.
   - Saltos: 15 → 15 contactos.
   - Repeticiones de fuerza: 39 → 37.

### 7. Etapas, dependencias y riesgos

| Etapa | Contenido                                                                                                                                                     | Termina con                                    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1B.1  | Dominio: prescripción y registro v2, validaciones, métricas y los ejemplos del §4 como tests; datos demo adaptados; las pantallas actuales siguen funcionando | **Revisión intermedia (P-43)**, si la apruebas |
| 1B.2  | Datos demo con escritura, identidad demo, crear cliente, evaluar, indicaciones (F-01 a F-05)                                                                  | Commit y pruebas                               |
| 1B.3  | Planificar y prescribir (F-06, F-07)                                                                                                                          | Commit y pruebas                               |
| 1B.4  | Portal: Hoy, reproductor, registro sin conexión, reanudación, textos (F-09 a F-12)                                                                            | Commit y pruebas                               |
| 1B.5  | Ficha y material visual, análisis, progreso, ciclo completo e informe (F-08, F-13 a F-15)                                                                     | **Informe de la Fase 1B y parada**             |

**Dependencias:**

- **Tu aprobación** del alcance y de las decisiones marcadas «Sí» en `DECISIONS.md`: P-11, P-16 a P-23, P-25, P-26, P-28 y P-34 a P-43.
- **Textos aprobados** para el cliente (P-26) antes de la etapa 1B.4.
- **Documentación de Next.js 16** incluida en `node_modules` (acciones de servidor, manejadores de rutas, cookies), que hay que leer antes de programar, como pide `AGENTS.md`.
- **ffmpeg en local**, solo para generar los clips sintéticos una vez (está disponible en este entorno; no es una dependencia del proyecto).
- **Navegador:** Chromium preinstalado (escritorio y emulación de Pixel 7). **No hay Safari ni iPhone en este entorno**: la reproducción automática, Wake Lock y el borrado del almacenamiento en iOS quedan para la Fase 10.

**Riesgos:**

| Riesgo                                                                 | Mitigación                                                                         |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Alcance grande                                                         | Lista cerrada, etapas con commit y revisión tras 1B.1                              |
| Estado compartido en memoria entre pruebas                             | Espacios aislados solo para E2E (1B-04)                                            |
| Sincronización sin conexión probada solo en Chromium                   | Pruebas de reenvío e idempotencia; validación en dispositivos reales en la Fase 10 |
| El modo demostración parece un inicio de sesión                        | Etiqueta permanente; un único punto de cambio (`getClientContext`)                 |
| Introducción de datos reales en los formularios                        | Aviso visible; los datos se pierden al reiniciar; sin envío a terceros             |
| Cambios en pruebas existentes (repeticiones totales, «nada se guarda») | Justificación de cada cambio en el informe; fórmulas con versión nueva             |
| Servidor sin autenticación accesible en la red local                   | Ejecutarlo solo en local; no desplegar                                             |
