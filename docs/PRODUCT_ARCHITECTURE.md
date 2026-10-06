# Arquitectura de producto (reestructuración)

> Documento de la **reestructuración definitiva** pedida tras probar la primera versión.
>
> **Regla del producto**: potente por dentro, sencillo por fuera. Si una función hace la aplicación más compleja sin aportar valor real, no se implementa. Si existe una forma más sencilla de conseguir lo mismo, se usa esa.
>
> Documentos hermanos: `DATABASE_SCHEMA.md`, `UX_FLOW.md`, `INJURY_MODULE.md`, `EVALUATION_SYSTEM.md`, `REPORT_SYSTEM.md`, `SCIENCE_SYSTEM.md`, `IMPLEMENTATION_ROADMAP.md`.

## 1. Auditoría del proyecto actual

### 1.1 Qué hay

| Capa | Tamaño | Estado |
|---|---|---|
| `packages/domain` (reglas puras: cálculos, prescripción, cambio frente al error de medida, informes) | 6 800 líneas | Bien probado: 403 tests unitarios, ≥ 90 % de cobertura, propiedades con fast-check |
| `packages/application` (casos de uso, autorización, auditoría) | 16 900 líneas | Bien probado: 160 tests de integración contra PostgreSQL real |
| `packages/db` (Drizzle, PostgreSQL 16, RLS) | 97 tablas, 33 migraciones | Matriz RLS: 566 comprobaciones |
| `packages/contracts` (validación zod) | 1 700 líneas | Contrato de API versionado (peticiones y respuestas) |
| `packages/auth` | 400 líneas | Sesiones en BD, argon2id, 2FA, cifrado AES-256-GCM |
| `apps/web` (Next.js: interfaz + API) | 18 500 líneas, 53 pantallas, 165 rutas API | Funciona, pero es la capa que falla: ver §1.3 |

### 1.2 Qué se conserva (código reutilizable)

| Pieza | Por qué se conserva |
|---|---|
| Autenticación, roles (ADMIN, TRAINER, CLIENT), 2FA, sesiones | Correcta y probada; no aporta nada rehacerla |
| RLS y aislamiento entre organizaciones | Es la segunda barrera de seguridad (§50 del encargo); la matriz la vigila |
| Clientes, consentimientos, RGPD (exportación, supresión, retención) | Obligatorio y ya resuelto |
| Biblioteca de ejercicios (patrones, músculos, material, siluetas, vídeo, progresiones) | Es exactamente el modelo del §11 |
| Prescripción (series, repeticiones, carga, %1RM, RIR, RPE, descanso, tempo, carácter del esfuerzo) y su texto para el cliente | Base de la tabla de sesión del §10 |
| Planificación jerárquica (plan → fase → mesociclo → semana → sesión → bloque → ejercicio) y revisiones | Soporta MES → SEMANA → SESIÓN y el historial (§49) |
| Plantillas (`plan_templates`, con objetivo, nivel, días y duración) | Base del §5–§8 |
| Evaluación: tests con dirección de mejora, agregación de intentos, fiabilidad (ICC, SEM, MDC), referencias normativas, baterías, cambio real | Base del §12–§15 |
| Seguimiento: asistencia, series registradas, RPE de sesión, bienestar, dolor, sustituciones | Base del §40–§41 |
| Informes con instantánea congelada y PDF/XLSX/CSV | Base del §16–§17 y del principio de historial (§49) |
| Ciencia: fuentes verificadas por DOI/PMID, afirmaciones graduadas, métodos | Base del §31–§34 |
| App del cliente (PWA, sin conexión, registro de un toque) | Base del §40 |
| Observabilidad, límites, CSP, Docker, almacenamiento S3 | Necesario para el despliegue online (§44) |

### 1.3 Qué falla (lo que la prueba real ha demostrado)

1. **Demasiadas puertas**. 13 entradas en el menú del entrenador y 13 pestañas en la ficha de cliente. Para programar una sesión hay que pasar por Planificación → plan → vista → sesión → formulario por ejercicio.
2. **Formularios donde el entrenador espera una hoja**. La sesión se edita ejercicio a ejercicio en formularios, no en una tabla editable como la de un Excel.
3. **Se ve el motor, no el resultado**. El motor de decisiones, las reglas, el control de calidad de la ciencia y las alertas están expuestos como módulos de gestión. El entrenador no los necesita delante; necesita sus conclusiones en el momento oportuno.
4. **Panel saturado**. «Hoy» llena la pantalla de tarjetas y alertas; el entrenador pide **Mis clientes** y **Entrenamientos de hoy**.
5. **Instalación imposible para el usuario final**. Docker, PowerShell y `localhost` no son aceptables (§44).
6. **Faltan módulos centrales**: lesiones/readaptación/RTP, radar normalizado, comparativa A/B con referencia de equipo, perfiles con 3 niveles, filtros de plantillas por población y material, edición tipo Excel.

### 1.4 Deuda técnica detectada

| Deuda | Impacto | Tratamiento |
|---|---|---|
| Pantallas enormes (`clients/[clientId]/page.tsx` con 13 pestañas; editor de sesión por formularios) | Difícil de cambiar sin romper | Se sustituyen por pantallas nuevas, más pequeñas |
| `planning.ts` (≈ 2 000 líneas en un archivo) | Mantenimiento | Se divide al tocarlo (plantillas, editor, copia) |
| Datos del cliente repartidos en `clients`, `client_training_profiles`, `client_goals` y `client_equipment` | El alta de cliente necesita 4 escrituras | Un caso de uso «alta rápida» que escribe todo en una transacción |
| El filtro «solo publicadas» de `sessions` está en la aplicación, no en la RLS | Segunda barrera incompleta | Se añade a la RLS en la fase 8 |
| E2E acoplados a la interfaz antigua | Cada cambio de pantalla rompe tests | Se reescriben por flujo, no por pantalla |
| Motor de decisiones y reglas muy elaborados para el valor que aportan hoy | Complejidad visible | Se conserva el código y se oculta; solo aflora como sugerencias |
| Despliegue solo con Docker | El usuario no puede usarlo | Despliegue online gestionado (§5) |

## 2. Principios de diseño

1. **Una pantalla, un trabajo**. Cliente → semana → sesión. Máximo 2–3 clics para lo habitual (`UX_FLOW.md` §3 mide cada acción).
2. **Tablas antes que formularios**. Donde el entrenador piensa en filas y columnas (sesión, evaluación, comparativa), la pantalla es una tabla editable, con teclado y pegado desde Excel.
3. **Valores por defecto inteligentes**. El perfil y el nivel del cliente preseleccionan plantilla, batería de tests y dimensiones del radar; el entrenador solo confirma o cambia.
4. **El motor sugiere, el entrenador decide**. Sugerencias discretas («Sugerencia: subir 2,5 kg») junto al dato, nunca módulos de reglas en el menú.
5. **Revelación progresiva**. Lo avanzado (reglas, control de calidad de fuentes, auditoría, retención) vive en **Ajustes**, no en el día a día.
6. **Nunca se reescribe la historia** (§49). Sesiones realizadas, evaluaciones cerradas, informes y planes antiguos son inmutables; un cambio crea una versión nueva.
7. **Seguridad invisible**. Separación entrenador/cliente por permisos y por RLS; el usuario no la ve, pero está.

## 3. Mapa del producto

### 3.1 Entrenador / administrador

| Zona (menú) | Qué contiene | Sustituye a |
|---|---|---|
| **Clientes** (inicio) | Mis clientes + Entrenamientos de hoy; ficha de cliente | Hoy, Clientes, Calendario, Alertas |
| **Plantillas** | Biblioteca con filtros (objetivo, nivel, días, duración, población, material); Mis plantillas; protocolos de readaptación | Planificación (catálogo) |
| **Ejercicios** | Biblioteca con silueta, vídeo, progresiones y referencias | Ejercicios |
| **Tests** | Tests, baterías por objetivo, referencias normativas, grupos (equipos) | Evaluación (catálogo) |
| Menú de usuario | Calendario, Alertas, Informes (importar/exportar), Ciencia (consulta), Ajustes, Usuarios, Privacidad, Salir | Calendario, Alertas, Ciencia, Informes, Usuarios, Privacidad, Ajustes |

**Ficha de cliente** (todo lo de un cliente, sin salir de ella):

| Pestaña | Contenido |
|---|---|
| **Programa** (por defecto) | MES → SEMANA → SESIÓN; tabla de sesión editable |
| **Evaluación** | Hoja de resultados, radar, evolución, comparativa |
| **Readaptación** | Solo si hay una lesión abierta: fase, criterios, comparativa, RTP |
| **Seguimiento** | Fichaje (asistencia), adherencia, feedback, molestias |
| **Informes** | Generar, ver, compartir, descargar |
| **Ficha** | Datos, perfil y nivel, material, consentimientos, historial |

### 3.2 Cliente (móvil primero)

**Hoy** (entrenamiento del día: ejercicio → silueta → vídeo → series → reps → carga → RIR → completar → feedback) · **Calendario** · **Progreso** (evolución e informes compartidos) · **Perfil**.

### 3.3 Qué pasa con cada módulo existente

| Módulo | Decisión | Motivo |
|---|---|---|
| Motor de decisiones (perfil, necesidades, prioridades) | **Oculto**; aflora como sugerencias al crear plan | Valor real, pero no como pantalla de gestión |
| Motor de programación (ajustes semana a semana) | **Oculto**; sugerencias junto a la celda | El entrenador decide en la tabla |
| Reglas de decisión y de alertas | **Ajustes avanzados** (ADMIN) | Configuración, no trabajo diario |
| Alertas | **Reducidas** a un punto de color en la lista de clientes y a «Revisar antes de progresar» en readaptación | Panel saturado (§42) |
| Calendario global | **Retirado del menú principal**: en el menú de usuario y como enlace «Ver calendario» de «Entrenamientos de hoy» | Menos puertas |
| Ciencia (fuentes, afirmaciones, control de calidad) | **Consulta** desde el menú de usuario; las referencias aparecen junto al ejercicio, el test o el criterio que respaldan | La ciencia sirve en contexto |
| Importación/exportación | **Dentro** de cada zona (importar clientes en Clientes, tests en Tests) | Menos puertas |
| Modo sala, sustituciones, sincronización sin conexión | **Se conservan** | Ya son sencillos y útiles |

## 4. Arquitectura técnica

Se mantiene la arquitectura por capas, que está probada y es segura:

```
Navegador (entrenador: escritorio/tablet · cliente: móvil, PWA)
   │  HTTPS
Next.js (apps/web): pantallas React + API /api/v1 (rutas finas, sin lógica)
   │
application: casos de uso con autorización, auditoría y transacciones
   │
domain: reglas puras (prescripción, normalización, radar, criterios, informes)
   │
db: Drizzle + PostgreSQL 16 con RLS por organización, cliente y rol
```

- **Lo nuevo vive en las mismas capas**. Normalización, radar y criterios de fase son funciones puras del dominio, con tests de propiedades. La persistencia nueva va a `db` con su RLS y su entrada en la matriz.
- **La interfaz nueva sustituye a la antigua por zonas**, no convive con ella. Cada fase retira las pantallas que reemplaza, para no mantener dos interfaces.
- **Componentes base nuevos**:
  - `DataGrid`: tabla editable con teclado, autoguardado por celda, pegado desde Excel y deshacer;
  - `RadarChart` (SVG accesible);
  - `Comparator` (selector A/B/referencia);
  - `CriteriaChecklist`.

## 5. Despliegue online (§44)

**Decisión: Render, región Frankfurt (UE).** Una sola aplicación web y una base de datos PostgreSQL gestionada.

| Requisito | Cómo se cumple |
|---|---|
| El usuario final solo necesita navegador + URL + login | Render publica la app con HTTPS en `https://<nombre>.onrender.com` (dominio propio opcional) |
| Sin comandos, ni para el administrador | Se crea desde el panel web de Render con el archivo `render.yaml` del repositorio («Blueprint»). Render pide en un formulario el email y la contraseña del primer administrador (variables `sync: false`) y genera la clave de cifrado (`generateValue`). |
| Migraciones y datos iniciales | El contenedor, al arrancar, aplica las migraciones, carga los catálogos y crea el administrador si la base está vacía. Todo es idempotente: no depende del comando previo al despliegue, que el plan gratuito no ofrece. |
| Trabajos diarios (alertas, retención) | Se ejecutan dentro de la app la primera vez que hay actividad cada día, con un bloqueo en BD; no requieren un *cron* de pago |
| Datos en la UE (RGPD) | Región Frankfurt para web y base de datos |
| Copias de seguridad | Las bases de pago de Render incluyen copias y recuperación a un instante *[verificar el detalle de cada plan en el panel de Render]* |

**Coste orientativo** (búsqueda del 05/10/2026):
- **Prueba gratuita**: web Free y Postgres Free. La web se duerme tras 15 min sin uso (≈ 30 s en despertar). La base gratuita **caduca a los 30 días** (14 días de gracia para pasar a pago; después se borra). Solo sirve para probar.
- **Uso real**: web Starter (≈ 7 $/mes) + Postgres Basic-256mb (≈ 6 $/mes) ≈ **13 $/mes**.

**Alternativas valoradas**:

| Opción | Motivo para no elegirla |
|---|---|
| Railway | Cómodo, pero no pide los datos del primer administrador en un formulario: requiere más pasos manuales |
| Fly.io | Exige herramienta de línea de comandos |
| Vercel + Neon | Dos proveedores; los trabajos y el PDF del servidor encajan peor |
| Scaleway / OVH | Más control y 100 % UE, pero requieren administración de sistemas |

La imagen Docker y `docker-compose.yml` siguen sirviendo para desarrollo, CI y para quien quiera alojarlo en su propio servidor.

## 6. Usuarios y permisos

| Rol | Ve | Hace |
|---|---|---|
| **ADMIN** (entrenador administrador) | Toda su organización | Todo lo del entrenador + usuarios, ajustes, privacidad, catálogos de la organización |
| **TRAINER** | Sus clientes asignados | Clientes, evaluaciones, planes, plantillas, ejercicios, tests, lesiones, informes |
| **CLIENT** | Solo lo suyo y solo lo publicado o compartido | Entrena, registra cargas/reps/RIR/RPE/molestias/feedback, ve su evolución e informes compartidos |

Un cliente **nunca** accede a otros clientes, referencias privadas, notas internas, informes de otros ni datos administrativos (§50). Se comprueba en dos barreras, aplicación y RLS, y lo vigilan la matriz RLS y la matriz de acceso cruzado de todas las rutas.

## 7. Decisiones de arquitectura

| # | Decisión | Motivo |
|---|---|---|
| A1 | Reutilizar backend, BD, seguridad y dominio; rehacer la interfaz por zonas | El problema demostrado es de UX, no de modelo ni de seguridad |
| A2 | Desplegar online **al principio** (fase 0) y no al final | Cada fase se prueba en la URL real; la fase 10 queda para el endurecimiento final (copias, seguridad, rendimiento) |
| A3 | Render (Frankfurt) con Blueprint | Despliegue sin comandos y datos del primer administrador por formulario |
| A4 | Migrar y sembrar al arrancar (idempotente) | Funciona también en el plan gratuito, que no tiene comando previo al despliegue |
| A5 | Perfiles de entrenamiento como **catálogo** (tabla), no como código | §3: añadir perfiles sin cambiar la estructura |
| A6 | Fases de readaptación **por protocolo** (árbol propio de cada lesión), con la estructura de 8 fases solo como andamiaje por defecto | §22: nada de protocolo universal |
| A7 | La decisión de RTP/RTPerf la registra una persona responsable; el software solo informa del estado de los criterios | §23 y §28: nunca «APTO» automático |
| A8 | Normalización en el dominio, con la dirección de mejora aplicada antes de cualquier radar | §14: nunca mezclar unidades |
| A9 | Tabla editable propia (`DataGrid`) en lugar de una librería de hojas de cálculo | Control total de accesibilidad, permisos por celda y autoguardado con bloqueo optimista; sin dependencias pesadas |
| A10 | Los documentos del usuario se usan como fuente de estructura, **anonimizados** (sin nombres de jugadores ni datos de salud reales) | RGPD |
| A11 | Nombres de tabla `programming_profiles` y columnas `clients.programming_profile_id` / `programming_level` | Ya existía `client_training_profiles` (experiencia, días…): «perfil de programación» evita la confusión |
| A12 | Las 10 dimensiones de los niveles viven en el dominio (`LEVEL_DIMENSIONS`), iguales para todos los perfiles; cada perfil solo añade su resumen por nivel | Una sola escala que se explica igual en todas partes; añadir un perfil no exige redactar 30 descriptores |
| A13 | El perfil propone el objetivo (`default_goal_slug`) y la experiencia propone el nivel; ambos se ven y se cambian en el formulario | Alta en 2 clics sin decisiones ocultas: el entrenador tiene la última palabra |
| A14 | «Mis clientes» muestra los clientes **accesibles** (el entrenador, los suyos; la administración, todos los del centro), primero los que requieren revisión | Mismo criterio de acceso que el resto de la aplicación (RLS); lo urgente, arriba |
| A15 | La edad se guarda como fecha de nacimiento y se calcula | Se mantiene al día y permite elegir referencias por edad |
| A16 | En el cribado, el resultado «apto» se muestra como «Sin derivación» | Coherencia con la regla de no mostrar nunca «apto»: el cuestionario indica si derivar, no autoriza a entrenar |
| A17 | La **duración se elige al usar la plantilla** (3, 6, 9 o 12 meses): se toman sus fases en orden y, si hace falta, se repiten como nuevos ciclos | Evita cuatro copias casi iguales de cada plantilla; el entrenador decide el horizonte con el cliente delante |
| A18 | **Versiones de plantilla**: cada edición guardada es una versión; las seguidas de la misma persona se agrupan hasta que un plan la usa (`used_at`); restaurar crea una versión nueva | Historial útil sin cientos de versiones por celda, y cada plan apunta exactamente a lo que se usó. `used_at` se marca al crear el plan porque, con RLS, un entrenador no ve los planes de otros y no podría contarlos |
| A19 | Las plantillas se editan en la **misma tabla** que las sesiones, guardando a través de un «almacén» intercambiable (`GridStore`): filas por API en los planes, la plantilla entera con su versión en las plantillas | Una sola forma de trabajar (§10); la plantilla sigue siendo declarativa (patrón semanal + reglas de progresión), en lugar de un plan sin cliente que perdería las reglas |
| A20 | Las plantillas de la plataforma son de **solo lectura**: para cambiarlas, «Duplicar en mis plantillas» | Las actualizaciones de la plataforma no pisan el trabajo del centro, y viceversa |
| A21 | Para un cliente **sin perfil o sin nivel**, la biblioteca ordena con el perfil que sugieren sus objetivos y el nivel que sugiere su experiencia. El perfil es el que propone su objetivo más importante: el principal y, si no, el de más peso. La página lo dice y enlaza a «Asignar perfil»; no se guarda nada | Sin esto, el orden caía en las plantillas de rendimiento (las primeras del catálogo) para cualquier cliente sin perfil. El entrenador sigue decidiendo: la sugerencia solo ordena |
| A22 | Las plantillas iniciales se **generan** desde bloques comunes (`profile-templates.ts`) en lugar de escribirse una a una; las escritas a mano tienen prioridad para su combinación | 85 plantillas coherentes entre sí (mismas reglas de dosis, niveles y evidencia) que se corrigen en un solo sitio; un cambio de contenido llega como versión nueva |
| A23 | Las **fórmulas derivadas son datos** (`derived_formulas`) en un lenguaje propio que el dominio interpreta sin `eval`. Un centro tiene su copia por identificador, que sustituye a la global | Las constantes del documento del club (Faulkner, Yuhasz) deben poder cambiarse sin programar, y sin ejecutar código de nadie. Una copia por centro deja intacto el catálogo de la plataforma y se deshace borrándola |
| A24 | El valor derivado guarda el **texto de la fórmula con sus constantes**. Cambiar una constante solo afecta a los cálculos nuevos | Un informe anterior no puede cambiar en silencio; el historial explica cada número |
| A25 | Un **grupo** se evalúa como una evaluación por miembro, con `group_id` y la misma fecha. No hay una «evaluación de grupo» aparte | Cada persona conserva su historial, su cambio real y sus permisos (RLS) sin duplicar datos. El informe grupal se calcula al pedirlo |
| A26 | Los grupos y sus miembros son **solo del equipo técnico**. Un entrenador ve únicamente a los miembros que tiene asignados | Un cliente nunca debe ver a otros (RGPD). Comparar con el equipo es una herramienta del entrenador |
| A27 | «Confirmar medición» usa los límites plausibles del test y un criterio **sin la propia persona** (> 3 DT de la media del resto, con ≥ 5 valores) | Con la DT de todo el grupo, un valor extremo infla la DT y se esconde (la talla de 161,3 del documento del club). El dato nunca se borra |
| A28 | El **DSI** se trata como cociente descriptivo, no como «más es mejor» | Orienta el tipo de fuerza a entrenar; tratarlo como un ranking (como hacía la hoja original) induce a error. Sus puntos de corte están [REQUIERE VERIFICACIÓN] |
| A29 | En la comparativa, **A y B se puntúan con la misma base** (la del momento B) | Si cada evaluación usara su propio grupo, una mejora del cliente podría verse como un empeoramiento solo porque el grupo mejoró más. Con una base común, el radar enseña el cambio del cliente |
| A30 | Las **dimensiones del radar son datos del dominio** (`DIMENSION_SETS`) con pesos. El entrenador elige cuáles ver; no se guardan por cliente todavía | Cubre el «el perfil propone y el entrenador cambia» sin una tabla nueva. Si hace falta guardar juegos propios del centro, se añadirá `radar_dimension_tests` |
| A31 | El radar es **SVG generado en el servidor** (sin librería de gráficos ni JavaScript), con la tabla al lado | Funciona con la CSP estricta, en móvil y en el PDF de la fase 6, y es accesible por construcción |
