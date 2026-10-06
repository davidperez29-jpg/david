# Changelog

Formato: fecha · cambio · motivo · archivos · impacto.

## 2026-10-06 — Reestructuración, fase 7: lesiones, readaptación y vuelta al deporte

- **Cambio:** pestaña **Readaptación** en la ficha del cliente cuando tiene un caso de lesión. El primero se abre desde Ficha → Salud.
- **Cambio:** **página del caso**:
  - alertas de seguridad sin revisar;
  - fase actual con objetivos, ejercicios, dosis y criterios (automáticos por valor o por simetría del lado afectado, o marcados a mano);
  - [Avanzar de fase] manual, con los motivos si no se puede;
  - vuelta al deporte (checklist y decisiones del equipo responsable con nombre y rol);
  - síntomas, comparativa con solo las variables del protocolo, y protocolo con fuentes y limitaciones.
  - **Motivo:** LESIÓN → FASE → CRITERIOS → PROGRESIÓN → RETURN TO SPORT del encargo, sin diagnosticar ni decir nunca «apto».
- **Cambio:** catálogo inicial de **6 protocolos** (LCA, isquiosurales, aductores, esguince de tobillo, tendinopatía rotuliana y aquílea):
  - 18 fuentes verificadas en PubMed;
  - cada criterio dice si tiene evidencia, es consenso o es criterio práctico.
  - 4 tests nuevos por lados: salto unipodal, fuerza de extensores y flexores de rodilla, elevaciones de talón.
- **Cambio:** el **informe de readaptación** incluye el caso: fase, criterios, variables del protocolo, checklist y decisiones. No incluye el diagnóstico recibido.
- **Cambio:** la demo tiene el esguince de tobillo de Elena en la fase 2, con una alerta abierta y una decisión registrada.
- **Seguridad:**
  - datos de salud solo para el equipo y con consentimiento explícito;
  - diagnóstico y notas cifrados;
  - lecturas auditadas;
  - RLS de las 10 tablas en la matriz.
- **Archivos:** `packages/domain/src/injury/`, `packages/db/src/schema/injury.ts`, migraciones 0041–0042, `packages/db/src/seed/injury.ts`, `seed-data/injury/protocols.json`, `seed-data/evidence/injury.json`, `packages/application/src/injuries.ts`, `apps/web/src/components/injury/forms.tsx`, `apps/web/src/app/app/clients/[clientId]/{injury-tab.tsx,lesiones/[injuryId]/page.tsx}`, 13 rutas de API, `docs/INJURY_MODULE.md` §9–§10, `docs/PRODUCT_ARCHITECTURE.md` A35–A39.
- **Impacto:** 2 migraciones nuevas (tablas y RLS). Sin cambios en los datos existentes. Los informes de readaptación ya generados se siguen abriendo igual.

## 2026-10-06 — Reestructuración, fase 6: los 8 tipos de informe

- **Cambio:** en la ficha del cliente, Informes → **Tipo de informe**:
  - técnico, para el cliente, inicial, seguimiento, comparativo, final y readaptación / vuelta a la competición;
  - el comparativo se elige con evaluación A, evaluación B y referencia (media del grupo, normativa o ninguna).
- **Cambio:** **informe de rendimiento** de un grupo, desde el informe grupal de una fecha. Incluye el resumen, la Z con bandas y una ficha con radar por cada persona elegida.
- **Cambio:** el radar se dibuja **en el PDF** con vectores. Todos los tipos se descargan en PDF, Excel y CSV, y el PDF sale idéntico byte a byte.
- **Cambio:** **validador de frases prohibidas**. El informe no se genera si el texto del entrenador dice «previene lesiones» sin evidencia de incidencia, «apto», «alta deportiva» o un diagnóstico, y explica el motivo. El motor nunca las escribe.
- **Cambio:** fortalezas y aspectos a mejorar generados de la banda de cada resultado, así que el texto no puede contradecir el número.
- **Cambio:** al cliente solo se comparten los informes de periodo, en lenguaje sencillo. El comparativo, el de rendimiento y el de readaptación son del equipo.
- **Archivos:** `packages/domain/src/reports/{kinds,language,report}.ts`, `packages/application/src/{reports.ts,render/pdf.ts}`, `apps/web/src/components/reports/*`, `apps/web/src/app/app/groups/[groupId]/informes/[reportId]/page.tsx`, `docs/REPORT_SYSTEM.md` §6, `docs/PRODUCT_ARCHITECTURE.md` A32–A34.
- **Impacto:** sin migraciones. Los informes ya generados se siguen abriendo igual.

## 2026-10-06 — Reestructuración, fase 5: radar y comparativa

- **Cambio:** **Comparativa y radar** en la pestaña Evaluación del cliente.
  - Se eligen la evaluación A, la B, la escala (Z frente al grupo, Z frente a la referencia, percentil en el grupo o % de la referencia) y las dimensiones.
  - El radar dibuja A y B sobre la misma base. Debajo, la tabla por dimensión y la tabla test a test: valores reales, cambio absoluto y %, cambio real frente al error de medida y puntuación A → B.
  - **Motivo:** ver de un vistazo en qué ha cambiado el cliente sin mezclar unidades (§14 y §17 del encargo).
- **Cambio:** cadena de normalización en el dominio, con el sentido corregido (hacia fuera siempre es mejor) y sin dato = hueco.
  - Dimensiones de rendimiento y de salud con pesos.
- **Cambio:** en Progreso, cada test tiene la tabla «evaluación por evaluación» con el cambio respecto a la anterior.
- **Cambio:** la demo tiene dos evaluaciones del grupo separadas cinco semanas, para ver A frente a B.
- **Corrección:** la prueba de contrato de respuestas dependía del orden de las baterías según la base de datos (fallaba en CI). Se trata `testIds` como un mapa abierto.
- **Tests:** propiedades de la normalización, integración de la comparativa, E2E del radar y axe en las páginas nuevas.
- **Archivos:** `packages/domain/src/assessment/normalize.ts`, `packages/application/src/comparison.ts`, `apps/web/src/components/assessment/radar.tsx`, `apps/web/src/app/app/clients/[clientId]/assessments/comparativa/page.tsx`, `docs/EVALUATION_SYSTEM.md` §9, `docs/PRODUCT_ARCHITECTURE.md` A29–A31.
- **Impacto:** sin migraciones. Nada cambia en los datos guardados.

## 2026-10-05 — Reestructuración, fase 4: evaluaciones y referencias

- **Cambio:** **hoja de intentos** tipo Excel en cada evaluación y en la evaluación de grupo.
  - Se escribe o se pega un bloque de Excel; Intro baja de fila y cada fila se guarda al salir de ella.
  - **Motivo:** introducir 20 jugadores × 3 pliegues como en la hoja del club, sin formularios.
- **Cambio:** reglas de resultado nuevas: **mediana, mínimo y máximo**. Tests nuevos:
  - 6 pliegues (mediana de 3);
  - conducción de balón (mejor de 2);
  - DSI (descriptivo).
  - Cada test tiene ahora **límites plausibles**.
- **Cambio:** **fórmulas como datos**, con constantes editables por centro y fórmulas propias (Tests → «Fórmulas y constantes»).
  - Se incluyen Σ6/Σ4 pliegues, % graso de Faulkner y de Yuhasz (solo hombres), masa grasa y masa libre de grasa.
  - Las ecuaciones del documento del club llevan [REQUIERE VERIFICACIÓN].
  - Los valores calculados guardan la fórmula usada.
- **Cambio:** **grupos y equipos** (Mis clientes → «Grupos y equipos»).
  - Se crea el grupo, se marcan los miembros y se crea la evaluación de todo el grupo en una fecha.
  - **Informe grupal:** N, media, referencia, DT, máximo, mínimo, mejor, peor, Z frente al grupo con semáforo y asimetrías.
  - **«Confirmar medición»** marca los datos atípicos o fuera de límites; no se borran.
  - Los grupos son solo del equipo técnico.
- **Cambio:** las referencias guardan la **condición** de medida y las **limitaciones**, además de la población y la fuente.
- **Cambio:** batería de equipo ampliada (talla, masa, pliegues, 5 m, CMJ unipodal, conducción, DSI). Batería nueva «Función y fuerza (parálisis cerebral y discapacidad motora)».
- **Tests:**
  - **test de oro** frente al informe del club: el motor reproduce medianas, mínimos, fórmulas, estadísticos de grupo y Z de la hoja original, recalculada por LibreOffice con jugadores sintéticos (`packages/domain/test/club-golden.unit.test.ts`; el generador no guarda nombres ni datos reales);
  - unitarias del lenguaje de fórmulas (sin ejecución de código, ciclos, nombres desconocidos), de estadísticas y Z (propiedades) y de los datos atípicos;
  - integración de grupos, hoja e informe, constantes del centro y fórmula propia;
  - matriz RLS con las tablas nuevas;
  - E2E: informe en 2 clics, pegar desde Excel, cambiar y restaurar constantes.
- **Archivos:** `packages/domain/src/assessment/{formulas,group,derived,aggregate}.ts`, `packages/application/src/{formulas,groups}.ts`, migraciones `0039`/`0040`, `seed-data/assessment/*`, `apps/web/src/app/app/groups/**`, `apps/web/src/components/assessment/attempts-sheet.tsx`, `docs/EVALUATION_SYSTEM.md` §8, `docs/PRODUCT_ARCHITECTURE.md` A23–A28.
- **Impacto:** al desplegar se aplican las migraciones y se cargan las fórmulas y los tests nuevos. Los datos existentes no cambian. Las métricas derivadas de evaluaciones antiguas se recalculan con el catálogo nuevo la próxima vez que se edite su evaluación.

## 2026-10-05 — Reestructuración, fase 3 (segunda parte): plantillas iniciales por perfil, nivel y días

- **Cambio:** la plataforma trae **102 plantillas** (antes 17). Se generan las combinaciones perfil × nivel × días que faltaban:
  - **76 plantillas** de los 13 perfiles con plantillas genéricas, en 3 niveles y con 2–5 días según el nivel (`packages/db/src/seed/profile-templates.ts`);
  - **9 rutinas de reducción de factores de riesgo**: aductores, isquiosurales y cuádriceps, en 3 niveles, dos veces por semana y unos 15 min;
  - cada plantilla es un bloque de 13 semanas (4 + 4 + 5, descargas y reevaluación) que se repite en ciclos para 6–12 meses.
  - **Motivo:** §6 del encargo y hoja de ruta (fase 3). Readaptación y retorno al deporte se programan por protocolo de lesión (fase 7); el perfil personalizado, el entrenador.
- **Cambio:** **evidencia verificada en PubMed** para las poblaciones nuevas (`seed-data/evidence/templates_profiles.json`):
  - equilibrio en mayores: Lesinski 2015 ([10.1007/s40279-015-0375-y](https://doi.org/10.1007/s40279-015-0375-y));
  - caídas: Sherrington 2019, Cochrane ([10.1002/14651858.CD012424.pub2](https://doi.org/10.1002/14651858.CD012424.pub2));
  - parálisis cerebral: Verschuren 2016 ([10.1111/dmcn.13053](https://doi.org/10.1111/dmcn.13053)), Merino-Andrés 2021 ([10.1177/02692155211040199](https://doi.org/10.1177/02692155211040199)) y Ryan 2017, Cochrane ([10.1002/14651858.CD011660.pub2](https://doi.org/10.1002/14651858.CD011660.pub2)). Su evidencia es contradictoria y así se dice.
  - **Métodos nuevos:** `equilibrio-mayores`, `fuerza-paralisis-cerebral` y `actividad-fisica-oms` (guías OMS 2020, ya verificadas).
  - **Catálogo:** población `cerebral_palsy` (solo contexto clínico) y resultado `falls`.
- **Cambio:** cada plantilla cita solo la evidencia que encaja con su población y su dosis:
  - `fuerza-maxima` (> 80 % 1RM) solo desde el nivel 2;
  - la evidencia de mayores no se usa para otros adultos;
  - las rutinas nunca presentan la prevención como un hecho; la de cuádriceps dice que no hay evidencia verificada sobre lesiones.
- **Cambio:** en la biblioteca, las plantillas sin perfil se agrupan por tipo («Reducción de factores de riesgo») y se ordenan por nombre.
  - La tabla de una plantilla muestra la categoría de cada ejercicio, como la de una sesión.
  - La tarjeta de evidencia recuerda qué es criterio práctico (F).
  - El material «Gimnasio completo» incluye el entrenador en suspensión.
- **Tests:**
  - unitarias de las plantillas generadas: combinaciones, validez, nivel de los ejercicios, impacto en mayores y parálisis cerebral, evidencia por población;
  - contrato de edición de todas las plantillas de la plataforma;
  - latencia de los filtros con la biblioteca completa: p95 ≤ 81 ms (criterio < 300 ms).
- **Cambio:** para un cliente **sin perfil o sin nivel**, la biblioteca ordena con el perfil que sugieren sus objetivos y el nivel que sugiere su experiencia (decisión A21). Avisa y enlaza a «Asignar perfil»; no se guarda nada.
  - **Motivo:** con 102 plantillas, a un cliente sin perfil se le ofrecían primero las de rendimiento (las primeras del catálogo). Lo detectó el E2E «UX 5»: la cliente de la demo, sin perfil y con objetivo de hipertrofia, ya no veía una plantilla adecuada entre las primeras.
- **Corrección:** cargar el catálogo otra vez (lo hace cada arranque, también en Render) **subía de versión todas las plantillas de la plataforma** y añadía una versión «Actualizada por la plataforma» sin cambios reales.
  - La causa: se comparaba el texto JSON y `jsonb` no conserva el orden de las claves.
  - Ahora se compara el contenido (`sameJson`, claves ordenadas a todos los niveles).
  - Esto también evita versiones vacías al guardar una plantilla sin cambios, y cambios inexistentes en la auditoría de campos JSON.
  - Lo detectó una comprobación manual de la carga repetida; ahora hay un test de integración.
- **Corrección:** en producción, los filtros **«Tipo» y «Población» de la biblioteca no tenían opciones**, y la lista y la ficha mostraban «risk_reduction» o «adulto_mayor» en lugar de su nombre.
  - La causa: las páginas del servidor importaban los textos desde un módulo de cliente (`'use client'`), y en el servidor eso no es el objeto sino una referencia.
  - Los textos pasan a `lib/labels.ts`; el script del tema, a `lib/theme.ts`.
  - Un test nuevo (`client-boundary.unit.test.ts`) recorre lo que importa el servidor y falla si toma algo que no sea un componente de un módulo de cliente.
  - Lo detectó el E2E nuevo de las plantillas iniciales, al filtrar por tipo.
- **Tests:** dos E2E recargaban la página justo después de editar una celda y podían cancelar el guardado, que va en segundo plano. Ahora esperan a la respuesta del guardado.
- **Impacto:** al desplegar, la carga del catálogo añade las plantillas nuevas y sus versiones; los planes existentes no cambian.

## 2026-10-05 — Reestructuración, fase 3 (primera parte): biblioteca de plantillas con versiones

- **Cambio:** **Plantillas** es una biblioteca con **filtros** (perfil, nivel, días, población, tipo, origen y texto).
  - Desde un cliente («Usar plantilla» en Programa), primero las que encajan con su perfil, nivel, días y material; avisa del material que le falta o deja fuera las que no puede hacer.
  - El material necesario se calcula solo a partir de los ejercicios.
  - **Motivo:** §6 del encargo; antes era una lista sin filtros y el plan se creaba desde un desplegable.
- **Cambio:** **usar una plantilla** crea un plan independiente con la **duración elegida** (3, 6, 9 o 12 meses): se toman sus fases en orden y, si hace falta, se repiten como nuevos ciclos, sin «colas» de 1–2 semanas. El plan guarda la plantilla y la versión de la que salió. En 3 clics y la fecha.
- **Cambio:** **Mis plantillas**:
  - **crear desde cero** (sesiones vacías de una semana), **duplicar** (también las de la plataforma, que son de solo lectura), **archivar** y recuperar;
  - **editar en la misma tabla que una sesión** (teclas, pegar desde Excel, duplicar, mover, quitar, deshacer), con bloqueo optimista de la plantilla entera;
  - **versiones**: cada edición guardada es una versión; las seguidas de la misma persona se agrupan hasta que un plan la usa, y una versión usada no cambia nunca. **Restaurar** crea una versión nueva con el contenido anterior.
- **Cambio:** la tabla de sesión guarda a través de un «almacén» intercambiable (`GridStore`): el mismo componente edita sesiones de cliente y plantillas.
- **Cambio:** en la tabla, el primer clic selecciona la celda y lo que se escribe sustituye su valor; un segundo clic, Intro o F2 la modifican.
  - **Motivo:** la celda activa por defecto entraba en edición al primer clic y lo tecleado se añadía al valor («1» + «4» = «14»). Lo detectó una prueba E2E.
- **Corrección:** un identificador mal formado en la ruta (`/api/v1/clients/abc`, `/app/clients/abc`) devolvía 500 desde la base de datos; ahora es «no encontrado» (404), en la API y en las páginas.
- **Esquema:** migraciones `0037` (columnas de filtro y versión en `plan_templates`, tabla `plan_template_versions` con `used_at`, `training_plans.based_on_template_version`, versión 1 de las existentes) y `0038` (RLS de catálogo y disparador `inherit_org`).
- **API:** `GET /plan-templates` con filtros, `POST /plan-templates`, `PATCH /plan-templates/{id}`, `POST /plan-templates/{id}/duplicate`, `/archive`, `/restore`; `durationMonths` en `POST /clients/{id}/plans/from-template`. Contratos actualizados (solo añadidos).
- **Decisiones:** A17–A20 en `PRODUCT_ARCHITECTURE.md`.
- **Pendiente de esta fase:** las plantillas iniciales por perfil × nivel × días (hecho en la segunda parte).

## 2026-10-05 — Reestructuración, fase 2: tabla de sesión tipo Excel y Programa por meses

- **Cambio:** la sesión se edita en una **tabla tipo hoja de cálculo** (EJERCICIO · CAT. · SERIES · REPS · CARGA · RIR · RPE · DESC. · NOTAS).
  - Se escribe encima de la celda; Intro guarda y baja, Tab guarda y pasa a la derecha; flechas, Esc, Supr, Ctrl+Z.
  - CARGA entiende kg, % de 1RM, RPE, «banda roja» y «PC»; REPS, repeticiones, rangos, tiempo, distancia o contactos; DESC., «90», «2:30» o «2 min».
  - Cada celda se guarda sola con **bloqueo optimista**: si otra persona cambió la fila, no se pisa; se avisa y se recarga.
  - **Pegar desde Excel o Google Sheets**, con o sin títulos: vista previa con los ejercicios reconocidos por nombre (sin tildes ni mayúsculas, alias o el claramente más parecido; si hay duda, se elige). Todas las filas en una transacción.
  - Filas: seleccionar, copiar (se pegan en Excel), duplicar debajo, mover, quitar; deshacer.
  - Lo avanzado (tempo, VBT, métodos, alternativas) en «⋯» de cada fila.
  - **Motivo:** §10 del encargo; «formularios en lugar de tablas» era uno de los fallos de la versión anterior.
- **Cambio:** pestaña **Programa = MES → SEMANA → SESIÓN** con la tabla de la sesión debajo. Abre en la semana actual y la próxima sesión; duplicar semana y sesión. Otros planes y la propuesta del motor, plegados.
- **Cambio:** el registro de sesiones hechas y pendientes pasa a **Seguimiento**, debajo de las alertas y la carga (lo que pide atención, primero).
- **Cambio:** ficha de ejercicio con resumen: **silueta de músculos** (principales y secundarios, delante y detrás) o la imagen subida, categorías, vídeo, progresiones, regresiones y referencias.
- **Cambio:** categorías de ejercicio alineadas con el §11 (nuevas: Velocidad y Reducción de factores de riesgo; «Reacondicionamiento» pasa a «Readaptación»).
- **API:** `POST /plan-sessions/{id}/exercises`, `POST /session-exercises/duplicate`, `POST /session-exercises/delete`, `POST /exercises/resolve`, `GET /clients/{id}/program`. Contratos actualizados (solo añadidos).
- **Accesibilidad:**
  - el botón principal al pasar el ratón ya no baja de 4,5:1 de contraste (antes, 4,48:1 por la opacidad): ahora usa un tono del acento más oscuro en claro y más claro en oscuro (`--accent-hover`); el botón de peligro al pasar el ratón usa el fondo de la página como texto (en oscuro, el blanco no llegaba);
  - «⋯ Más opciones» de cada fila se alcanza con Tab desde la última celda y se abre con Intro.
- **Pruebas:** unitarias de celdas, pegado y reconocimiento de nombres (con propiedades) y de meses y semanas; integración de pegado atómico, duplicar, quitar, reconocer nombres y permisos; E2E de cambiar una carga desde el inicio (4 interacciones), pegar 5 filas, dos editores a la vez, deshacer y abrir las opciones de una fila con el teclado.

## 2026-10-05 — Reestructuración, fase 1: clientes, perfiles y navegación

- **Cambio:** navegación de **4 entradas** (Clientes · Plantillas · Ejercicios · Tests) y un menú de usuario con el resto (Calendario, Alertas, Informes, Ciencia, Ajustes, Usuarios, Privacidad, Cerrar sesión). Las alertas urgentes se cuentan junto al menú.
  - **Antes:** 13 entradas. **Motivo:** §42 del encargo («dashboard saturado»).
- **Cambio:** el inicio pasa a ser **Mis clientes + Entrenamientos de hoy**.
  - Una fila por cliente: estado (verde · ámbar · rojo), perfil y nivel, próxima sesión y adherencia de 4 semanas. Si algo requiere atención, el motivo aparece en la fila con un enlace a donde se resuelve. Primero, las filas en rojo.
  - Sustituye a los seis bloques del antiguo «Hoy». Caso de uso `trainerHome`; `GET /api/v1/dashboard/home`.
- **Cambio:** **perfiles de programación** como catálogo (`programming_profiles`, migraciones `0035`–`0036`, RLS de catálogo): 16 perfiles globales con 3 niveles cada uno, objetivo y batería sugeridos.
  - Cliente: `programming_profile_id`, `programming_level` (1–3) y `sport_id`, validados contra el catálogo de la organización. El cliente no puede cambiarlos desde su app.
  - Las 10 dimensiones de los niveles (complejidad, intensidad, volumen…) están en el dominio (`LEVEL_DIMENSIONS`) y se explican en la ficha.
  - `GET /api/v1/programming-profiles`.
- **Cambio:** **alta de cliente en un solo formulario** (antes, un asistente de 4 pasos).
  - Obligatorios: nombre, apellidos y perfil. El perfil propone el objetivo y la experiencia propone el nivel; ambos se pueden cambiar.
  - Material con atajos (gimnasio completo, casa básica, sin material). «Guardar e invitar a la app» crea también la invitación.
  - Al guardar se abre la Ficha en Salud (consentimiento y cribado antes de entrenar).
- **Cambio:** **ficha de cliente con 5 pestañas** (Programa · Evaluación · Seguimiento · Informes · Ficha); Readaptación llegará en la fase 7.
  - Antes había 13 pestañas. Programa reúne planificación y sesiones; Ficha reúne perfil y nivel, datos, objetivos, entrenamiento y material, salud, consentimientos, entrenadores y acceso, con un índice.
  - El motor de decisiones («Necesidades») y el historial de cambios se abren desde enlaces. Los enlaces antiguos (`?tab=salud`, `?tab=planificacion`…) siguen funcionando.
- **Cambio:** en el cribado, «Apto» pasa a «Sin derivación».
  - **Motivo:** el software nunca muestra «apto»; el cuestionario indica si derivar, no autoriza a entrenar.
- **Datos de ejemplo:** los clientes de demostración tienen perfil, nivel y deporte (Noelia, sin perfil, muestra el aviso «Elegir perfil»).
- **Pruebas:**
  - unitarias de niveles;
  - integración de perfiles (catálogo, visibilidad entre organizaciones, validación, auditoría, bloqueo al cliente) y del inicio (filas, motivos, orden, ámbito por entrenador);
  - E2E del alta en un formulario, del menú de usuario, de los recorridos de UX (2 clics desde el inicio) y de accesibilidad de las pestañas nuevas;
  - contratos de API actualizados (solo campos y rutas nuevos).

## 2026-10-05 — Reestructuración, fase 0: despliegue online

- **Cambio:** la aplicación se puede publicar en Render (UE, Frankfurt) sin comandos (`DEPLOY_RENDER.md`).
  - **Incluye:**
    - `render.yaml` con web y PostgreSQL en Frankfurt; la clave de cifrado la genera Render;
    - el email y la contraseña del primer administrador se piden en un formulario;
    - `Dockerfile.render` (imagen todo en uno) y `deploy/start.sh`, idempotente: migraciones → catálogos → administrador → datos de ejemplo opcionales → servidor;
    - trabajos diarios dentro de la app (`DAILY_JOBS=in-app`, `scheduled_job_runs`, migraciones `0033`–`0034`);
    - aviso en el inicio de sesión si falta el administrador;
    - CI arranca la imagen dos veces sobre una base vacía con propietario sin privilegios de superusuario (`deploy/smoke-test.sh`).
  - **Motivo:** el usuario no puede usar Docker ni PowerShell; el producto final es una URL.
- **Cambio:** corrección de la adherencia.
  - **Error:** una sesión programada para **hoy** y aún sin hacer contaba como no realizada. Bajaba la adherencia y podía disparar una alerta por la mañana, antes de que el cliente entrenara.
  - **Corrección:** ahora cuenta solo cuando hay registro (`dueSessions`).
  - Además, «Hoy» en la app del cliente pasa a la siguiente sesión pendiente cuando la de hoy ya está hecha.
  - **Cómo se encontró:** al ejecutar los tests en lunes, día con sesión. Se arreglaron también tests que dependían del día de la semana.
- **Cambio:** el contrato de respuestas trata los mapas por fecha o id (p. ej. totales por día) como mapas, no como campos.

## 2026-10-05 — Reestructuración: auditoría y diseño

- **Cambio:** auditoría del proyecto y diseño de la reestructuración.
  - **Incluye:** `PRODUCT_ARCHITECTURE.md`, `DATABASE_SCHEMA.md`, `UX_FLOW.md`, `INJURY_MODULE.md`, `EVALUATION_SYSTEM.md`, `REPORT_SYSTEM.md`, `SCIENCE_SYSTEM.md` e `IMPLEMENTATION_ROADMAP.md`.
  - **Motivo:** la prueba real mostró que el problema no eran las funciones, sino la complejidad (13 menús, 13 pestañas, formularios en lugar de tablas) y la instalación con Docker.
  - **Decisiones:**
    - conservar backend, seguridad y dominio; rehacer la interfaz por zonas;
    - desplegar online primero (Render, Frankfurt);
    - perfiles como catálogo;
    - fases de readaptación por protocolo;
    - el software nunca declara «apto».
  - **Referencias:** las del módulo de lesiones se verificaron en PubMed (14 artículos con DOI y PMID). Los documentos del usuario se usan como fuente de estructura, anonimizados.

## 2026-10-04 — Pendientes técnicos tras la Fase 15

- **Cambio:** imagen Docker mínima (`web`, servidor autónomo de Next, ≈ 480 MB) e imagen `jobs` para migraciones y trabajos.
  - **Motivo:** la imagen única pesaba 1,7 GB. **Archivos:** `Dockerfile`, `docker-compose.yml`, `next.config.ts`.
- **Cambio:** almacenamiento de objetos S3 compatible para los archivos subidos (firma SigV4, sin SDK), probado contra un servidor real en CI.
  - **Impacto:** variables `S3_*`; sin ellas, disco local como antes.
- **Cambio:** contrato de respuestas de la API: forma de cada `GET` en `docs/api/responses.json`; un campo eliminado o un tipo cambiado hace fallar el E2E.
- **Cambio:** informe compartido con el cliente.
  - **Incluye:**
    - el entrenador comparte o deja de compartir un informe (auditado) y ve antes la versión del cliente;
    - el cliente lo ve en Progreso, en 7 apartados en lenguaje sencillo, y lo descarga en PDF;
    - permiso `reports:read_shared`;
    - columnas `reports.shared_at`/`shared_by` (`0031`) y RLS v10 (`0032`): el cliente solo lee sus informes compartidos.
  - **Motivo:** §9 (el cliente ve su progreso sin jerga) y la especificación de permisos («propio, si habilitado»).
- **Cambio:** PDF del plan, semana a semana, con la prescripción de cada ejercicio.
  - **Incluye:** versión del equipo (técnica, con notas internas) y del cliente (lenguaje sencillo, sin notas internas); el cliente solo descarga planes activos o completados y solo lo publicado; descargas auditadas. `GET /plans/{id}/pdf`.

## 2026-10-04 — Fase 15: optimización y escala

- **Cambio:** observabilidad.
  - **Incluye:**
    - logs JSON por línea (`http_request` con ruta sin ids, estado y ms; `unexpected_error`; `subject_erased`), con redacción de claves sensibles y depuración del texto libre;
    - `X-Request-Id`;
    - _webhook_ opcional para errores;
    - `GET /api/health` y `GET /api/ready`.
- **Cambio:** presupuesto de peticiones por usuario y minuto (1 000 lecturas, 120 escrituras, 30 operaciones pesadas), en BD (migraciones `0028` y `0029`); `429` con `Retry-After`.
  - **Motivo:** PENTEST P-3.
- **Cambio:** CSP con _nonce_ por petición y `'strict-dynamic'`, sin `'unsafe-inline'` en scripts (`src/proxy.ts`).
  - **Motivo:** PENTEST P-2.
- **Cambio:** rendimiento.
  - **Incluye:**
    - crear un plan escribe por niveles: ≈ 900 → ≈ 240 ms;
    - 14 índices tras revisar `pg_stat` bajo carga (migración `0030`);
    - sin caché en proceso (no hace falta y dificultaría escalar).
- **Cambio:** integraciones.
  - **Incluye:** puerto `ExternalDataSource`; adaptadores CSV/JSON; mediciones por cliente con límites técnicos y consentimiento para datos de salud; permiso `integrations:import`; tarjeta «Datos de dispositivos».
- **Cambio:** equipo. Carga por entrenador y traspaso auditado de clientes entre entrenadores (ADMIN).
- **Cambio:** operación.
  - **Incluye:**
    - `Dockerfile` y `docker-compose.yml`, probados;
    - CI construye la imagen;
    - `OPERATIONS.md`: despliegue, escalado, vigilancia, copias y restauración;
    - `pnpm privacy:reapply-erasures` para que una restauración no devuelva a personas suprimidas (probado con un simulacro).
- **Corrige:**
  - los datos de dispositivos no estaban en la exportación del interesado ni se borraban al suprimir;
  - el cuerpo de las peticiones se limitaba a 256 KB, así que la importación nunca aceptó los archivos de hasta 2 MB documentados en la Fase 12.
- **Cambio:** tests: 390 unitarios, 155 de integración, 566 comprobaciones RLS y 41 E2E.
- **Cambio:** documentación: `OPERATIONS.md` e `INTEGRATIONS.md` (nuevos); `API.md`, `DATABASE.md`, `SECURITY.md`, `ASVS_L2.md`, `PENTEST.md`, `TESTING.md`, `ROADMAP.md`, `MASTER_SPECIFICATION.md`, `README.md` y `.env.example`.

## 2026-10-04 — Fase 14: pruebas

- **Cambio:** cobertura con umbral en CI (`pnpm test:coverage`): ≥ 90 % de líneas y funciones en `packages/domain` y ≥ 90 % de líneas en cada motor.
  - **Resultado:** 94,7 % de líneas.
- **Cambio:** 24 propiedades con fast-check sobre los motores de cálculo.
  - **Incluye:** agregación, SD, SEM/MDC, cambio frente al error, tendencia, asimetría, adherencia, carga y monotonía, bienestar, progresiones, fechas, plazos RGPD, retención, CSV.
  - **Corrige:** la detección del separador CSV contaba separadores entre comillas (encontrado por una propiedad). Las celdas con tabulador ahora se entrecomillan.
- **Cambio:** contrato de la API (`docs/api/contract.json`, `pnpm contract:update`) con reglas de cambio rompiente.
- **Cambio:** suite de seguridad.
  - **Incluye:**
    - matriz RLS de todas las tablas, positiva y negativa (`pnpm test:security`);
    - acceso cruzado en las 180 rutas autenticadas con tres atacantes (`e2e/security-routes.spec.ts`).
  - **Corrige** (RLS v7, migración `0026`):
    - un entrenador podía, con SQL directo, leer todas las asignaciones y asignarse clientes;
    - un entrenador podía leer invitaciones de staff y de clientes no asignados;
    - un cliente podía cambiar cualquier columna de su ficha (ahora lo impide un trigger).
- **Cambio:** accesibilidad (axe-core, WCAG 2.2 AA) en 51 páginas, temas claro y oscuro.
  - **Corrige:** tamaño de los enlaces del calendario; enlace dentro de `<summary>`.
- **Cambio:** rendimiento.
  - **Incluye:** `pnpm db:seed:perf` (1 000 clientes); `e2e/perf.spec.ts` (listados < 300 ms p95); `e2e/perf.mobile.spec.ts` (TTI < 2,5 s).
  - **Corrige:**
    - las políticas por cliente reentraban en la RLS de `clients` en cada fila. Ahora usan un acceso por rol (RLS v8, migración `0027`): el resumen de seguimiento pasa de 1 185 a 36 ms y las páginas del entrenador, de ≈ 1,2 s a menos de 150 ms;
    - límite de sesiones por día en el calendario (`perDay`): el mes del ADMIN pasa de 340 a 147 ms.
  - **Nota:** el commit decía que la respuesta del calendario bajaba a «unos KB». Medido: 41 KB en la API y 281 KB de HTML con 100 planes activos (antes, 1,8 y 1,9 MB con 300).
- **Cambio:** auditoría de dependencias en CI (`pnpm audit --prod --audit-level high`).
- **Cambio:** demo.
  - **Incluye:** organización de aislamiento (ADMIN `ane.urrutia@example.com`); Elena con declaración de salud, historial, tolerancia e informe; importación pendiente.
- **Cambio:** tests: 379 unitarios, 148 de integración, 560 comprobaciones RLS y 39 E2E.
- **Cambio:** documentación: `TESTING.md` (pirámide, áreas obligatorias, rendimiento), `API.md`, `DATABASE.md`, `SECURITY.md`, `ASVS_L2.md`, `PENTEST.md`, `ROADMAP.md`, `MASTER_SPECIFICATION.md` y `README.md`.

## 2026-10-04 — Fase 13: seguridad y RGPD

- **Cambio:** derechos del interesado desde la interfaz.
  - **Incluye:**
    - `/me/privacidad`: descarga JSON de sus datos, solicitudes de los 6 derechos con plazo de un mes, estado y cancelación;
    - menú **Privacidad** de ADMIN: bandeja con «Fuera de plazo» y respuesta obligatoria;
    - ficha → Privacidad: exportar y **suprimir** con doble confirmación.
  - **Motivo:** criterio de aceptación «derechos ejercitables desde UI» (RGPD arts. 12–21).
  - **Archivos:** `packages/application/src/privacy.ts`, `components/privacy/*`, `app/app/admin/privacidad`.
- **Cambio:** supresión por **anonimización** irreversible.
  - **Incluye:** borra salud, molestias, comentarios, archivos y la cuenta; sustituye los identificadores; redacta la auditoría del cliente con una función `SECURITY DEFINER` que conserva quién y cuándo (migración `0023`); mantiene el entrenamiento como dato anónimo.
- **Cambio:** retención.
  - **Incluye:** plazo para clientes archivados que fija ADMIN (sin valor por defecto, [REQUIERE VALIDACIÓN LEGAL]); `pnpm privacy:daily` anonimiza los vencidos y depura sesiones, intentos de inicio de sesión, tokens y filas de importación.
- **Cambio:** autenticación.
  - **Incluye:**
    - 2FA obligatorio para ADMIN (ajuste de la organización, activo por defecto; la demo lo desactiva);
    - 10 códigos de recuperación de un solo uso;
    - sesiones abiertas visibles y revocables;
    - contraseñas filtradas por k-anonimato (`PWNED_PASSWORDS_CHECK=on`).
- **Cambio:** **códigos TOTP de un solo uso** (`users.totp_last_step`, migración `0025`).
  - **Motivo:** hallazgo P-1 del pentest ligero: un código interceptado podía reutilizarse durante su ventana.
- **Cambio:** rotación de la clave de cifrado.
  - **Incluye:** `APP_ENCRYPTION_KEYS_PREVIOUS` para leer y `pnpm keys:rotate` para re-cifrar.
- **Cambio:** migraciones `0021`–`0025`; permisos `privacy:request`, `privacy:manage` y `privacy:erase_subject`.
- **Cambio:** tests: 348 unitarios, 146 de integración y 34 E2E (nuevos `privacy.spec.ts` y `security.spec.ts`).
- **Cambio:** documentación: `ASVS_L2.md`, `DPIA.md` (plantilla), `PENTEST.md`; `SECURITY.md`, `API.md`, `DATABASE.md`, `TESTING.md`, `ROADMAP.md`, `MASTER_SPECIFICATION.md`, `README.md` y `.env.example` actualizados.

## 2026-10-04 — Fase 12: informes, exportación e importación

- **Cambio:** informe de cliente con los 11 apartados del encargo §34.
  - **Incluye:** la interpretación de cambios es frente al error de medida y nunca un diagnóstico; los datos de salud solo aparecen con consentimiento; las recomendaciones son solo las aceptadas por el entrenador, más las suyas, con DOI.
  - **Archivos:** `packages/domain/src/reports/report.ts`, `packages/application/src/reports.ts`.
- **Cambio:** instantánea congelada con sha256 (migración `0020`). Pantalla, PDF, Excel y CSV salen del mismo modelo de bloques.
  - **Motivo:** el informe es reproducible; el PDF es idéntico byte a byte.
- **Cambio:** PDF con **pdfkit**, sin navegador en el servidor.
  - **Motivo:** es una desviación de §5 (Playwright/Chromium): evita depender de Chromium en el despliegue y da bytes reproducibles. Está documentada en `REPORTS.md`.
- **Cambio:** exportación CSV/XLSX de clientes, evaluaciones, planificación, sesiones y evolución.
  - **Incluye:** RLS; auditoría; protección contra inyección de fórmulas; CSV para Excel en español.
- **Cambio:** importación validada de clientes, ejercicios, evaluaciones y referencias desde CSV/XLSX.
  - **Incluye:**
    - vista previa con errores por fila y columna antes de escribir nada;
    - alta por los casos de uso normales;
    - ejercicios como borrador para revisar y referencias no verificadas;
    - plantillas con ayuda.
- **Cambio:** permisos `reports:generate`, `data:export` y `data:import`.
- **Cambio:** interfaz.
  - **Incluye:** menú «Informes» (exportar, importaciones); asistente de importación; pestaña «Informes» de la ficha; página del informe con descargas.
- **Cambio:** demo con un informe de Iker.
- **Cambio:** tests: 330 unitarios, 136 de integración y 30 E2E.
- **Cambio:** documentación: `REPORTS.md`; `API.md`, `TESTING.md`, `DATABASE.md`, `SECURITY.md`, `ROADMAP.md`, `MASTER_SPECIFICATION.md` y `README.md` actualizados.

## 2026-10-04 — Fase 11: motor de programación

- **Cambio:** dominio de programación.
  - **Incluye:**
    - progresión de carga semana a semana: ajuste por RIR, y doble progresión solo con rango de repeticiones; incremento por material;
    - descarga y reducción de volumen por respuesta;
    - sustitución por molestias, sin diagnóstico;
    - cambios recalculables al editar;
    - adaptación de plantilla al motor de decisiones: semanas de introducción y sustituciones.
  - **Archivos:** `packages/domain/src/programming/*`.
- **Cambio:** propuestas de plan `PROPOSAL` desde la última ejecución del motor de decisiones.
  - **Incluye:** se aceptan como plan en borrador o se descartan. Nunca se activan directamente; con cribado positivo no se generan.
- **Cambio:** propuestas de ajuste calculadas tras cada sesión cerrada, cada día y bajo demanda.
  - **Incluye:** aceptar, editar, rechazar o posponer; en bloque; deshacer.
  - **Motivo:** la regla dura de §12.2. Solo se aplican al aceptar, a sesiones futuras sin registrar, sin pisar cambios manuales, con revisión del plan y auditoría.
- **Cambio:** opción por cliente para aplicar progresiones de carga sin confirmación (desactivada por defecto, auditada como `SYSTEM`, reversible).
- **Cambio:** API y datos.
  - **Archivos:** `packages/application/src/programming.ts`, migración `0019`, rutas `/plan-proposals`, `/plans/{id}/proposal/*`, `/adjustments*` y `/auto-apply`.
  - **Impacto:** el trabajo diario también evalúa ajustes. El motor de decisiones ya no sustituye los ajustes al recalcular.
- **Cambio:** interfaz.
  - **Incluye:** «Ajustes propuestos» y «Propuesta de plan del motor» en Planificación; aviso en la propuesta de plan; «Ver propuesta de ajuste» en Seguimiento.
- **Cambio:** demo: el 1RM de Iker se registra antes de su plan, así sus cargas están en kg y tiene progresiones propuestas; también tiene una propuesta de plan.
- **Cambio:** tests: 310 unitarios, 126 de integración y 29 E2E.
- **Cambio:** documentación: `PROGRAMMING_ENGINE.md`; `API.md`, `TESTING.md`, `DATABASE.md`, `MONITORING.md`, `DECISION_ENGINE.md`, `ROADMAP.md`, `MASTER_SPECIFICATION.md` y `README.md` actualizados.

## 2026-10-03 — Fase 10: motor de decisiones

- **Cambio:** dominio del motor (§13).
  - **Incluye:** DSL de condiciones en JSON sin `eval`; 10 etapas puras y deterministas (hechos, cribado, perfil, necesidades, priorización, métodos, ejercicios, dosis, plan y explicación); fase de introducción por puntuación; 24 reglas por defecto como datos (nivel F) enlazadas a afirmaciones.
  - **Archivos:** `packages/domain/src/decision/*`.
- **Cambio:** umbrales del perfil sin valor por defecto.
  - **Motivo:** no inventar números. El motor avisa y usa una referencia verificada aplicable o la valoración del entrenador.
- **Cambio:** contexto desde la base de datos, con datos de salud solo con consentimiento.
  - **Incluye:** ejecuciones guardadas con su huella y versión de reglas; propuestas con evidencia enlazada; decisiones (aceptar, aceptar con cambios auditados en `manual_overrides`, rechazar, posponer); rasgos manuales; editor de reglas versionado (ADMIN) con métricas de rechazo por regla; desactivación por cliente.
  - **Archivos:** `packages/application/src/decision.ts`, migraciones `0017` y `0018`, rutas `/api/v1/clients/{id}/decision*`, `/recommendations/{id}/decision`, `/clients/{id}/trait-flags` y `/decision/rules`.
  - **Impacto:** permisos `decision:read`, `decision:run`, `decision:decide` y `decision:rules`.
- **Cambio:** interfaz.
  - **Incluye:** pestaña «Necesidades» con «¿Por qué?» (DATOS / INTERPRETACIÓN / REGLA / EVIDENCIA con DOI / APLICABILIDAD / LIMITACIONES / CONFIANZA) y acciones en cada propuesta; «Ajustes → Reglas del motor de decisión».
- **Cambio:** demo con umbrales de futbolista en el centro, 1RM reciente de Iker y propuestas para todos los clientes.
- **Cambio:** tests: 288 unitarios (golden case del futbolista de §69 y otros 8), 118 de integración y 28 E2E.
- **Cambio:** documentación: `DECISION_ENGINE.md`; `API.md`, `TESTING.md`, `DATABASE.md`, `ROADMAP.md`, `SCIENTIFIC_FRAMEWORK.md`, `MASTER_SPECIFICATION.md` y `README.md` actualizados.

## 2026-10-03 — Fase 9: dashboards y calendario

- **Cambio:** dominio de dashboards: racha, hitos positivos (solo mejoras confirmadas), cuadrícula de mes, fases y descargas como intervalos.
  - **Archivos:** `packages/domain/src/dashboard`.
- **Cambio:** casos de uso: calendario global (alcance por RLS, filtro por entrenador para ADMIN), dashboard del entrenador, Resumen del cliente, dashboard del cliente, tests visibles en el Progreso del cliente; la agenda del cliente incluye evaluaciones.
  - **Archivos:** `packages/application/src/dashboard.ts`, migración `0016`.
- **Cambio:** interfaz del entrenador.
  - **Incluye:** «Calendario» (mes y semana, filtros, estados con icono y texto, evaluaciones, fases y descargas, agenda en el móvil); Hoy según §8.2 (feedback reciente, evaluaciones pendientes); Resumen del cliente; selector de tests visibles.
- **Cambio:** interfaz del cliente: Hoy con los ejercicios de la sesión, racha y próxima evaluación; Progreso con hitos y los tests elegidos; Calendario con evaluaciones.
- **Cambio:** tema claro, oscuro o del sistema en Ajustes, aplicado antes de pintar (§9.7).
- **Cambio:** revisión UX con 3 tareas cronometradas en E2E (`UX_REVIEW.md`); 4 problemas detectados y corregidos.
- **Cambio:** tests: 270 unitarios, 110 de integración y 27 E2E.
- **Cambio:** documentación: `DASHBOARD.md` y `UX_REVIEW.md`; `API.md`, `TESTING.md`, `DATABASE.md`, `ROADMAP.md`, `MASTER_SPECIFICATION.md` y `README.md` actualizados.

## 2026-10-03 — Fase 8: seguimiento y alertas

- **Cambio:** dominio de seguimiento (§13.7).
  - **Incluye:** adherencia (24/21 = 87,5 %), carga interna sRPE, monotonía y tensión descriptivas (sin ACWR), bienestar y 10 reglas de alerta configurables que describen y nunca diagnostican.
  - **Archivos:** `packages/domain/src/monitoring/*`.
- **Cambio:** evidencia nueva verificada en PubMed.
  - **Datos:** Foster 2001, Haddad 2017, Foster 1998 e Impellizzeri 2020; 3 afirmaciones.
  - **Archivos:** `seed-data/evidence/monitoring.json`.
- **Cambio:** evaluación de alertas como código de sistema tras confirmar (`afterCommit`) y en el trabajo diario (`pnpm monitor:daily`).
  - **Incluye:** una alerta viva por situación, escalado en el mismo registro, resolución automática, 7 días de espera tras resolver una persona, notificación de las rojas.
  - **Archivos:** `packages/application/src/monitoring.ts`, migración `0015`.
- **Cambio:** reglas por centro versionadas y auditadas (solo ADMIN); desactivación por cliente; valoración por ejercicio (también sin conexión); RPE previsto de la sesión.
  - **Impacto:** permisos `monitoring:read`, `alerts:manage` y `monitoring:rules`.
- **Cambio:** interfaz.
  - **Incluye:** menú «Alertas •N», página de alertas, Hoy con adherencia y alertas, pestaña Seguimiento con gráfico, tabla y evidencia, editor de reglas y «Tu constancia» en la app del cliente.
- **Cambio:** demo con adherencias del 45 % al 100 % y alertas de cada color.
- **Cambio:** tests: 261 unitarios, 107 de integración y 23 E2E.
- **Cambio:** documentación: `MONITORING.md`; `API.md`, `TESTING.md`, `DATABASE.md`, `ROADMAP.md`, `SCIENTIFIC_FRAMEWORK.md`, `SESSIONS.md`, `MASTER_SPECIFICATION.md` y `README.md` actualizados.

## 2026-10-03 — Fase 7: sesiones y app del cliente

- **Cambio:** esquema y dominio de ejecución (§9, §4.5).
  - **Incluye:** alternativas preaprobadas, marcas de revisión en registros, idempotencia de sustituciones, función acotada `notify_client_trainers` y reglas puras (hoy, precarga, validación de series, sustitución en vivo, conflictos de sincronización, cumplimiento).
  - **Archivos:** migraciones `0013` y `0014_rls_v3`, `packages/domain/src/sessions`.
- **Cambio:** casos de uso y API.
  - **Incluye:** publicación (solo planes activos), agenda, reproductor, registro idempotente, `/sync` con _savepoint_ por mutación, sustituciones, cierre con dolor solo con consentimiento, bienestar, modo sala, revisión y bandeja.
  - **Archivos:** `packages/application/src/sessions.ts`, `apps/web/src/app/api/v1/{sessions,set-logs,substitutions,sync,review-inbox}`.
  - **Impacto:** permisos `sessions:read/log/publish/review`.
- **Cambio:** app del cliente como PWA.
  - **Incluye:** manifiesto, service worker propio, cola en IndexedDB, reproductor de una página, Hoy, Calendario y bienestar.
  - **Impacto:** el menú inferior pasa a Hoy · Calendario · Progreso · Perfil; Privacidad y Ajustes se abren desde Perfil.
- **Cambio:** vistas del entrenador: publicar en el plan y en el editor, alternativas en el editor, pestaña Sesiones, revisión de sesión, modo sala y «Sesiones de hoy» y revisión en Hoy.
- **Cambio:** demo: los clientes con app tienen un plan activo relativo a la fecha, publicado y con las sesiones pasadas registradas.
- **Cambio:** tests: 238 unitarios, 100 de integración y 20 E2E, incluido el criterio de aceptación sin conexión.
- **Cambio:** documentación: `SESSIONS.md`; `API.md`, `TESTING.md`, `DATABASE.md`, `ROADMAP.md`, `PLANNING.md`, `MASTER_SPECIFICATION.md` y `README.md` actualizados.

## 2026-10-03 — Fase 6: planificación

- **Cambio:** dominio de planificación (§12).
  - Validación de la prescripción: VBT solo en ejercicios compatibles y no para principiantes; RIR o RPE, nunca ambos.
  - Texto para el cliente.
  - Expansión de plantillas con fechas y progresión declarativa por semana: ola de RIR, carga lineal, +serie, descarga.
  - Propuestas post-sesión: doble progresión y ajuste por RIR. Solo proponen.
  - Indicadores semanales.
  - **Archivos:** `packages/domain/src/planning/*`.
- **Cambio:** tabla `plan_templates` (ADR-013), 17 plantillas por objetivo y frecuencia (12 semanas, métodos enlazados) y 92 ejercicios globales publicados.
  - **Archivos:** `seed-data/templates/*`, `seed-data/exercises/global.json`, migraciones `0011` y `0012_rls_v2`.
- **Cambio:** casos de uso, API y UI.
  - **Incluye:** planes desde plantilla (con % 1RM → kg desde un 1RM medido y conflictos de material y tolerancias) o en blanco; árbol, calendario e indicadores; editor de sesión; overrides auditados con motivo; duplicar sesión, semana y plan; guardar como plantilla anonimizada; activación con revisión y un solo plan activo; revisiones con diferencias.
  - **Archivos:** `packages/application/src/planning.ts`, `apps/web/src/app/app/plans/*`.
  - **Impacto:** permisos `plans:read/write/templates`.
- **Cambio:** demo con 8 planes; tests: 217 unitarios, 91 de integración y 16 E2E.
- **Cambio:** documentación: `PLANNING.md`; `API.md`, `TESTING.md`, `ROADMAP.md`, `DATABASE.md`, `ARCHITECTURE.md`, `EXERCISE_LIBRARY.md` y `README.md` actualizados.

## 2026-10-03 — Fase 5: evaluación

- **Cambio:** dominio de evaluación (§11).
  - Agregación de intentos.
  - Interpretación del cambio frente al error típico y al MDC95: primero la fiabilidad local, después la publicada en población similar y, si no hay, sin veredicto.
  - Errores combinados para las métricas de diferencia y tendencia con 3 o más puntos.
  - Métricas derivadas: IMC, déficit de COD por lado, fuerza relativa, CMJ/SJ y asimetrías descriptivas.
  - Aplicabilidad de referencias, con z-score solo si son aplicables.
  - Puntos de corte descriptivos frente a clínicos (solo los clínicos derivan).
  - Propuesta de batería con exclusiones de seguridad.
  - **Archivos:** `packages/domain/src/assessment/*`.
- **Cambio:** casos de uso, API y UI.
  - **Incluye:** catálogo y fichas, fiabilidad del centro, baterías, evaluaciones por intentos y lados, progreso con gráficos SVG con banda de error y la pantalla «Progreso» del cliente.
  - **Archivos:** `packages/application/src/assessments.ts`, `apps/web/src/app/app/assessments/*`, `apps/web/src/app/me/progreso`.
  - **Impacto:** permisos `assessments:read/write/catalog`.
- **Cambio:** catálogo global verificado en PubMed.
  - **Datos:** 43 tests, 38 filas de fiabilidad, 10 de referencia y 57 fuentes. Cada fila incluye la cita literal del resumen que contiene sus cifras.
  - **Comprobación:** 8 fuentes contrastadas de nuevo con PubMed antes de importar.
  - **Archivos:** `seed-data/assessment/*`, `packages/db/src/seed/{assessment,knowledge}.ts`.
  - **Impacto:** 3 poblaciones nuevas.
- **Cambio:** 5 referencias no localizadas y 24 datos no verificados **[REQUIERE VERIFICACIÓN]**, entre ellos los cortes EWGSOP2, que no figuran en el resumen.
  - **Archivos:** `docs/research/assessment_seed_report.md`.
- **Corrección:** el anexo de la Fase 0 tenía invertidos los MDC del lunge test (intra/inter); se sigue el resumen de Powden 2015. El PMID 31081853 propuesto para EWGSOP2 es una fe de erratas; el correcto es 30312372.
- **Cambio:** migraciones `0009` y `0010`; demo con 2–3 evaluaciones por cliente.
- **Cambio:** tests: 176 unitarios, 84 de integración y 14 E2E.
- **Cambio:** documentación: `ASSESSMENT.md`; `API.md`, `TESTING.md`, `ROADMAP.md`, `DATABASE.md` y `README.md` actualizados.

## 2026-10-03 — Fase 4: biblioteca científica

- **Cambio:** dominio científico.
  - `gradeFinding` calcula el nivel A–H a partir de la justificación guardada (diseño y motivos para bajar).
  - `claimLevel` calcula el nivel de las afirmaciones y da D ante contradicciones comparables.
  - `assessApplicability` compara a una persona con la población estudiada.
  - Validadores de QA científico para fuentes, hallazgos y afirmaciones.
  - **Motivo:** §10.4 y §10.6.
  - **Archivos:** `packages/domain/src/science/*`.
- **Cambio:** casos de uso, API y UI de la biblioteca científica.
  - **Incluye:** fuentes, verificación, hallazgos, afirmaciones, revisiones con lista de control, métodos con variables de dosis, informe de QA y enlace ejercicio ↔ método.
  - **Archivos:** `packages/application/src/science.ts`, `apps/web/src/app/app/science/*`, `apps/web/src/app/api/v1/science/*`.
  - **Impacto:** permisos `science:read/write` para ADMIN y TRAINER, y `science:publish` solo para ADMIN.
- **Cambio:** semilla global de evidencia verificada en PubMed (conector NCBI).
  - **Datos:** 135 fuentes, 218 hallazgos con cita literal, 80 afirmaciones y 23 métodos.
  - **Importación:** idempotente, en `db:seed` y `db:reset`.
  - **Comprobación:** muestra aleatoria de 12 fuentes contrastada con PubMed, con coincidencia total.
  - **Archivos:** `seed-data/evidence/*`, `packages/db/src/seed/evidence.ts`.
  - **Impacto:** 8 desenlaces y 4 poblaciones nuevos en el catálogo.
- **Cambio:** 28 correcciones a referencias de los documentos aportados y 19 referencias no localizables en PubMed **[REQUIERE VERIFICACIÓN]**.
  - **Archivos:** `docs/research/evidence_seed_report.md`.
- **Corrección:** las restricciones únicas de DOI, PMID y claves de semilla trataban `NULL` como igual, así que una organización no podía tener dos fuentes sin DOI ni dos hallazgos sin clave. Ahora son índices únicos parciales.
  - **Archivos:** `drizzle/0008_science_unique_identifiers.sql`.
- **Corrección:** los esquemas de actualización de fuentes y afirmaciones aplicaban los valores por defecto de creación. Una edición parcial vaciaba los autores (y anulaba la verificación) o los hallazgos enlazados. Hay tests de regresión.
- **Cambio:** tests: 138 unitarios, 76 de integración y 11 E2E.
- **Cambio:** documentación: `SCIENTIFIC_FRAMEWORK.md`; `API.md`, `TESTING.md`, `ROADMAP.md`, `DATABASE.md`, `EXERCISE_LIBRARY.md` y `README.md` actualizados.

## 2026-10-03 — Fase 3: biblioteca de ejercicios

- **Cambio:** dominio de la biblioteca: sustituciones con filtros y motivos explicados, detección de contradicciones en progresiones, validación de vídeos, requisitos de publicación.
  - **Motivo:** §14, §27–§30.
  - **Archivos:** `packages/domain/src/library/*`.
- **Cambio:** casos de uso, API y UI de la biblioteca.
  - **Incluye:** búsqueda sin tildes (`immutable_unaccent` + trigram), filtros, edición con bloqueo optimista, copia de contenido global, vídeos con verificación humana, siluetas, progresiones, sustituciones y tolerancias del cliente.
  - **Archivos:** `packages/application/src/library.ts`, `apps/web/src/app/app/library/*`, migraciones `0005` y `0006`.
  - **Impacto:** nuevo permiso `library:*` para el staff.
- **Cambio:** almacenamiento de archivos (puerto `FileStorage`, disco local) y descarga autorizada.
  - **Impacto:** nueva variable `FILE_STORAGE_DIR`.
- **Cambio:** normalización e importación del banco de ejercicios de los 4 Excel.
  - **Datos:** 1 141 ejercicios y 1 011 vídeos.
  - **Estado:** importados como borradores pendientes de revisión y con los vídeos sin verificar; incluidos en la demo.
  - **Archivos:** `seed-data/exercise-bank/bank.json`, `packages/application/scripts/exercise-bank/*`, `src/library-import.ts`.
- **Corrección:** el límite de intentos de login por IP contaba también los accesos correctos, de modo que un gimnasio con IP compartida podía quedar bloqueado. Ahora cuenta solo los fallos (50 en 15 min).
  - **Archivos:** `packages/auth/src/rate-limit.ts`.
- **Cambio:** tests: 102 unitarios, 63 de integración y 8 E2E, ahora repetibles sin reiniciar la base de datos.
- **Cambio:** documentación: `EXERCISE_LIBRARY.md`; `API.md`, `TESTING.md`, `SECURITY.md`, `ARCHITECTURE.md` y `ROADMAP.md` actualizados.

## 2026-10-03 — Fase 2: base de datos y estructura

- **Cambio:** esquema completo de §6.
  - **Tablas:** 66 nuevas para biblioteca de ejercicios, biblioteca científica, evaluación, planificación, seguimiento, motor de decisiones y plataforma.
  - **Restricciones:** 53 `CHECK` (RIR 0–10, RPE en pasos de 0,5, tempo, duración 3/6/9/12 meses, fuente obligatoria en valores de referencia…).
  - **Motivo:** preparar las Fases 3–12 sin rehacer el modelo.
  - **Archivos:** `packages/db/src/schema/{library,science,assessment,planning,tracking,decision,platform}.ts`, `drizzle/0002`, `drizzle/0003`.
  - **Impacto:** 91 tablas en total.
- **Cambio:** triggers `inherit_scope` y `check_client_org`.
  - **Motivo:** imposibilitar que un dato apunte a otra organización u otro cliente.
- **Cambio:** Row Level Security en todas las tablas (168 políticas), generada desde un mapa declarativo; `secured()` ejecuta cada caso de uso como `app_runtime` con el actor ligado.
  - **Motivo:** defensa en profundidad (§14.3).
  - **Archivos:** `packages/db/src/rls/*`, `drizzle/0004_rls.sql`, `packages/application/src/rls.ts`.
  - **Impacto:** el usuario de BD de la aplicación debe ser miembro de `app_runtime`.
- **Cambio:** `email_in_use()` (SECURITY DEFINER) para comprobar emails en todas las organizaciones sin revelarlas.
- **Cambio:** catálogos estructurales: 17 patrones, 26 músculos, 24 categorías, 28 variables y 10 perfiles de prescripción, 11 poblaciones y 21 desenlaces.
- **Cambio:** tests de RLS con SQL directo, de cobertura de tablas y de desviación de la migración: 66 unitarios, 49 de integración y 6 E2E.
- **Cambio:** `docs/DATABASE.md` y actualización de la arquitectura, la seguridad, los tests y el roadmap.

## 2026-10-03 — Fase 1: autenticación, usuarios y clientes

- **Cambio:** monorepo TypeScript (`apps/web`, `packages/{domain,contracts,db,auth,application}`) con CI, lint, formato y reglas de capas.
  - **Motivo:** arquitectura de §4–§5.
  - **Archivos:** raíz, `.github/workflows/ci.yml`, `.dependency-cruiser.cjs`.
  - **Impacto:** base de todo el desarrollo posterior.
- **Cambio:** esquema y migraciones de identidad, clientes, catálogos y auditoría _append-only_ (trigger).
  - **Archivos:** `packages/db`.
  - **Impacto:** 25 tablas; catálogos de 17 objetivos, deportes y material.
- **Cambio:** autenticación propia en lugar de Better Auth (ADR-002).
  - **Motivo:** flujo solo por invitación, roles por organización, auditoría transaccional.
  - **Archivos:** `packages/auth`, `packages/application/src/{auth-service,invitations}.ts`.
  - **Impacto:** argon2id, sesiones revocables, 2FA TOTP, bloqueo y rate limiting.
- **Cambio:** casos de uso de cliente (alta, ficha, objetivos, disponibilidad, material, historial, salud declarada, cribado, consentimientos, asignaciones, auditoría).
  - **Motivo:** §10 y §14 del encargo.
  - **Impacto:** el consentimiento explícito es obligatorio para los datos de salud; aviso de derivación no diagnóstico.
- **Cambio:** aplicación web, con API REST v1 (32 rutas), área de entrenador y área móvil de cliente.
  - **Archivos:** `apps/web`.
  - **Impacto:** primer uso real posible: gestión de clientes.
- **Cambio:** datos demo (3 entrenadores, 10 clientes ficticios) y CLI `create-org`.
- **Cambio:** tests: 60 unitarios, 34 de integración y 6 E2E.
- **Cambio:** documentación: `ARCHITECTURE.md`, `SECURITY.md`, `TESTING.md`, `API.md` y `ROADMAP.md`; decisión D3 cerrada en la especificación.

## 2026-10-03 — Fase 0: investigación y arquitectura

- **Cambio:** especificación maestra del sistema.
  - **Motivo:** el encargo exige pensar antes de programar.
  - **Archivos:** `docs/MASTER_SPECIFICATION.md`.
  - **Impacto:** define la arquitectura (monolito modular TypeScript, PostgreSQL), el modelo de datos, los motores, la seguridad, el roadmap y los riesgos. Todavía no hay código.
- **Cambio:** anexos de investigación.
  - **Motivo:** trazabilidad científica.
  - **Archivos:** `docs/research/*`.
  - **Impacto:** registro de evidencia de partida, con estado de verificación por dato.
  - **Limitación:** sin acceso a Crossref/PubMed (política de red); verificación solo con el buscador web, con el cupo de búsquedas agotado.
- **Cambio:** README y .gitignore.
  - **Motivo:** base del repositorio.
  - **Archivos:** `README.md`, `.gitignore`.
  - **Impacto:** ninguno funcional.
