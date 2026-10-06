# Testing

> Estrategia completa en `MASTER_SPECIFICATION.md` §15. Estado tras la Fase 15.

## 1. Cómo ejecutar

| Comando | Qué ejecuta | Requisitos |
|---|---|---|
| `pnpm test:unit` | Dominio (incluidas propiedades con fast-check), contratos, auth, rutas y contrato de la API | — |
| `pnpm test:coverage` | Unidad + **umbral de cobertura**: ≥ 90 % de líneas y funciones en `packages/domain`, y ≥ 90 % de líneas en cada motor de cálculo | — |
| `pnpm test:integration` | Casos de uso y RLS contra PostgreSQL real | `TEST_DATABASE_URL` (se **borra y recrea**) |
| `pnpm test:security` | **Matriz RLS** de todas las tablas sobre los datos demo, en transacciones que se deshacen | `pnpm db:reset && pnpm db:seed:demo` |
| `pnpm test:e2e` | Playwright contra `next start`, en escritorio y móvil: flujos, accesibilidad, matriz de acceso cruzado de todas las rutas y rendimiento | `pnpm build`, datos demo; `pnpm db:seed:perf` para el rendimiento (si no, ese test se salta); Chromium (`PW_CHROMIUM` para usar uno ya instalado) |
| `pnpm contract:update` | Acepta el contrato actual de la API en `docs/api/contract.json` (`--breaking` acepta cambios rompientes) | — |
| `pnpm contract:responses` | Añade al contrato de respuestas (`docs/api/responses.json`) los campos nuevos de cada `GET` | `pnpm build`, datos demo |
| `pnpm lint` · `pnpm typecheck` · `pnpm format:check` · `pnpm depcruise` | Calidad y capas | — |

CI (`.github/workflows/ci.yml`) ejecuta, por este orden:

1. formato, lint, tipos y capas;
2. unidad con umbral de cobertura;
3. integración;
4. *build*;
5. datos demo;
6. suite de seguridad;
7. datos de carga (1 000 clientes);
8. E2E.

Los tests de integración no truncan tablas (la auditoría es *append-only*): cada test crea su **propia organización** (`buildOrg()` en `packages/application/test/fixtures.ts`), lo que además ejercita el aislamiento entre organizaciones.

## 2. Pirámide (§15.1)

| Nivel | Herramienta | Qué cubre | Umbral | Resultado (Fase 14) |
|---|---|---|---|---|
| Unidad (dominio) | Vitest + fast-check | Fórmulas, reglas, progresiones, explicaciones; **24 propiedades** (límites, monotonía, invariancias, ida y vuelta) | ≥ 90 % líneas en `packages/domain` y en cada motor | ✅ 94,7 % líneas, 96,2 % funciones; motores ≥ 90 % |
| Contrato | Zod → JSON Schema + diff propio | Rutas (método y acceso), esquema de entrada de cada petición y forma de la respuesta de cada `GET` | Sin cambios rompientes sin versión | ✅ `docs/api/contract.json`: 155 rutas y 113 esquemas; `docs/api/responses.json`: 68 respuestas (E2E `contract-responses.spec.ts`); los tests fallan ante cualquier cambio no aceptado |
| Integración | Vitest + PostgreSQL 16 real | Casos de uso, RLS, transacciones y auditoría, migraciones | Todas las políticas RLS con test positivo y negativo | ✅ 148 tests; **matriz RLS**: cada tabla del mapa, cada tipo de política y cada política a medida, con datos (560 comprobaciones) |
| Seguridad | Playwright (HTTP) | Acceso cruzado en **cada ruta**: sin sesión, ADMIN de otra organización, otro cliente, entrenador no asignado | 100 % de rutas | ✅ 180 *handlers* autenticados, 471 ataques con ids reales; ninguno pasa ni filtra datos |
| E2E | Playwright (escritorio + Pixel 7) | Flujos §8.4 y §9, incluido sin conexión | Flujos críticos en cada PR | ✅ 39 tests en CI |
| Accesibilidad | axe-core en E2E | WCAG 2.2 AA (`wcag2a/aa`, `wcag21a/aa`, `wcag22aa`), temas claro y oscuro | 0 infracciones graves | ✅ 44 páginas del entrenador y 7 del cliente, 0 graves o críticas |
| Rendimiento | Playwright | Listados con 1 000 clientes; TTI en móvil | < 300 ms p95; TTI < 2,5 s en 4G | ✅ máx. 147 ms p95; TTI ≈ 1,4–1,6 s (ver «Rendimiento») |
| Científico | Casos dorados | Salida del motor de decisiones y su explicación | Revisión humana en cambios de reglas | ✅ desde la Fase 10 (`decision.unit.test.ts`) |
| Datos | Validadores de *seed* | Referencias con fuente verificada; fuentes con DOI/PMID | CI bloquea si falla | ✅ `evidence.unit.test.ts`, `assessment-seed.unit.test.ts` |

## 3. Áreas obligatorias (§15.2, encargo §57)

| Área | Casos (resumen) | Archivos |
|---|---|---|
| Login | Credenciales, mismo mensaje ante usuario inexistente, bloqueo, límites por email e IP, 2FA con código TOTP de un solo uso y códigos de recuperación, sesiones visibles y revocables | `auth.int.test.ts`, `privacy.int.test.ts`, `auth.unit.test.ts`, `security13.unit.test.ts` |
| Permisos | Matriz pura (*deny by default*), RLS por tabla y por rol, acceso cruzado en cada ruta | `policy.unit.test.ts`, `rls.int.test.ts`, `rls-matrix.security.test.ts`, `e2e/security-routes.spec.ts` |
| Cliente | Alta transaccional, bloqueo optimista, auditoría por campo, autoservicio de contacto (también por trigger), archivado, asignaciones | `clients.int.test.ts`, `e2e/trainer.spec.ts` |
| Evaluación | Agregación de intentos, cambio frente al error de medida, referencias, tests por lado, baterías | `assessment.unit.test.ts`, `properties.unit.test.ts`, `assessments.int.test.ts`, `e2e/assessment.spec.ts` |
| Programa | Esqueleto y fechas, prescripción, progresiones, plantillas, revisiones, propuesta del motor | `planning.*`, `programming.*`, `e2e/planning.spec.ts`, `e2e/programming.spec.ts` |
| Sesión | Registro de series, sustituciones, finalización, sincronización idempotente sin conexión, modo sala | `sessions.*`, `e2e/sessions*.spec.ts` |
| Ejercicios | Búsqueda, filtros, publicación, vídeos, progresiones, banco importado | `library.*`, `exercise-bank.unit.test.ts`, `e2e/library.spec.ts` |
| Feedback | RPE, bienestar, molestias solo con consentimiento, feedback por ejercicio | `sessions.int.test.ts`, `monitoring.int.test.ts` |
| Adherencia | 24/21 = 87,5 %; propiedades (0 ≤ hechas ≤ planificadas, orden irrelevante, reprogramadas fuera) | `monitoring.unit.test.ts`, `properties.unit.test.ts` |
| Cálculos | sRPE, monotonía, SEM/MDC, asimetría, tendencia, plazos RGPD; cobertura ≥ 90 % | `*.unit.test.ts`, `properties.unit.test.ts` |
| Informes | 11 apartados, PDF idéntico byte a byte, CSV/XLSX, importación validada; CSV de ida y vuelta | `reports.*`, `imports.unit.test.ts`, `e2e/reports.spec.ts` |
| Filtros | Búsqueda sin tildes, por patrón, músculo y material; listados por ámbito; calendario por cliente y entrenador | `library.int.test.ts`, `clients.int.test.ts`, `e2e/monitoring.spec.ts` |
| Sustitución | Filtros duros con motivo, dolor → menos carga axial, tolerancias del cliente | `library.unit.test.ts`, `library.int.test.ts` |
| Seguridad | Cabeceras, CSRF, IDOR, cookies, sin trazas, RLS, rutas, supresión RGPD, auditoría inmutable | `security.int.test.ts`, `e2e/security*.spec.ts`, `PENTEST.md` |

## Cobertura por área (Fase 1)

| Área (§57) | Tests | Archivo |
|---|---|---|
| Login | Credenciales correctas, email sin distinguir mayúsculas, mismo mensaje usuario inexistente / contraseña errónea, bloqueo tras 5 fallos, sesión caducada, logout, usuario desactivado pierde sesiones | `auth.int.test.ts` |
| 2FA | Alta TOTP, código incorrecto, login en dos pasos, secreto cifrado en BD | `auth.int.test.ts`, `auth.unit.test.ts` |
| Invitaciones y contraseñas | Un solo uso, política de contraseñas, email duplicado, recuperación de un solo uso que revoca sesiones, cambio con contraseña actual | `auth.int.test.ts` |
| Permisos | Matriz pura (deny by default, organizaciones, ámbitos, roles combinados) | `policy.unit.test.ts` |
| Seguridad / aislamiento | Entrenador ↛ cliente no asignado (lectura, edición, salud, auditoría, invitación), listados filtrados por ámbito, cliente ↛ otro cliente, cliente ↛ acciones de staff, cliente solo edita contacto/preferencias, ADMIN de otra organización ↛ nada, solo ADMIN invita a staff | `security.int.test.ts` |
| Cliente | Alta completa transaccional, objetivos inválidos sin alta parcial, bloqueo optimista, auditoría por campo, objetivos con historial, disponibilidad del propio cliente, búsqueda (con escape de comodines), archivado, asignaciones | `clients.int.test.ts` |
| Salud y RGPD | Consentimiento obligatorio, staff no puede fingir consentimiento en app, cifrado, aviso de derivación, auditoría de lectura sin texto de salud, cribado «derivar», revocación | `health.int.test.ts` |
| Auditoría | *Append-only* a nivel de BD (UPDATE/DELETE rechazados) | `health.int.test.ts` |
| RLS (Fase 2) | Todas las tablas de `public` mapeadas y con RLS; sin contexto no se ve nada; tablas de sistema inaccesibles; con SQL directo: entrenador solo asignados, cliente solo él mismo, ADMIN nunca otra organización, cliente no escribe salud ni planes, staff no escribe en otra organización ni en catálogo global, auditoría no modificable ni falsificable; triggers de herencia y de pareja cliente-organización; plantillas invisibles para clientes; seeds idempotentes | `rls.int.test.ts` |
| Ejercicios (Fase 3) | Normalización de nombres; vídeos válidos e inválidos (incluido `javascript:`); ciclos de progresión; sustituciones (filtros duros con motivo, dolor → menor carga axial, dificultad → regresión, patrones restringidos); requisitos de publicación; integración: búsqueda sin tildes y con errores, filtros por patrón/músculo/material, aislamiento entre organizaciones, cliente sin acceso, publicación y revisión, bloqueo optimista, taxonomía ajena rechazada, vídeo pendiente → verificado, silueta con detección de tipo (SVG rechazado) y sustitución, progresiones contradictorias, contenido global de solo lectura y copia, sustituciones con material y tolerancias del cliente, importación idempotente del banco; E2E: buscar en el banco importado, crear, completar y publicar, vídeo inválido y verificación, cliente sin acceso a la API | `library.unit.test.ts`, `exercise-bank.unit.test.ts`, `library.int.test.ts`, `e2e/library.spec.ts` |
| Límite por IP | 35 inicios de sesión correctos desde la misma IP no bloquean | `auth.int.test.ts` |
| Esquema (Fase 2) | Perfiles de prescripción solo con variables existentes, slugs únicos, RIR 0–10, mapa RLS coherente, salud y decisiones nunca escribibles por el cliente, migración RLS sin desviación respecto al generador | `packages/db/test/catalog.unit.test.ts` |
| Cálculos | Edad, validación de objetivos, consentimientos vigentes, diff y redacción | `clients.unit.test.ts` |
| Rutas | Todos los handlers usan `authedRoute`/`publicRoute`; lista cerrada de públicos | `apps/web/test/routes.unit.test.ts` |
| E2E | Alta de cliente en un formulario + consentimiento + cribado + historial; aislamiento entre entrenadores; cliente no accede al área de entrenador ni a la API de usuarios; CSRF; API sin sesión; experiencia móvil (consentimiento, perfil, objetivos táctiles ≥ 48 px) | `apps/web/e2e/*.spec.ts` |

Las áreas que entonces quedaban pendientes se cubrieron en las fases siguientes; el estado actual está en §3.

## Resultado de la Fase 3

- Unidad: 102 tests ✔ · Integración: 63 tests ✔ (todos bajo RLS) · E2E: 8 tests ✔ (Chromium, escritorio y Pixel 7); los E2E son repetibles sin reiniciar la base de datos.
- `lint`, `typecheck`, `format:check` y `depcruise` sin errores.

## Resultado de la Fase 4

- Unidad: 138 tests ✔ (incluye la gradación, el QA, la aplicabilidad y la coherencia de los archivos de evidencia) · Integración: 76 tests ✔ · E2E: 11 tests ✔.
- Integración científica (`science.int.test.ts`, `evidence-seed.int.test.ts`):
  - niveles recalculados al verificar y al editar;
  - una fuente sin verificar da nivel H;
  - el QA bloquea la publicación;
  - publicar es exclusivo de ADMIN;
  - la lista de control incompleta no permite aprobar;
  - las contradicciones dan nivel D;
  - un método no se publica con variables sin justificar;
  - aislamiento entre organizaciones;
  - el contenido global es de solo lectura;
  - DOI/PMID únicos;
  - la importación es idempotente;
  - la retracción queda registrada.
- La base de datos de integración se crea con la biblioteca científica global importada (`prepareTestDatabase`).
- `lint`, `typecheck`, `format:check` y `depcruise` sin errores.

## Resultado de la Fase 5

- Unidad: 176 tests ✔, entre ellos:
  - agregación, interpretación frente al MDC, errores combinados, tendencia, métricas derivadas, aplicabilidad de referencias, puntos de corte descriptivos y clínicos, y propuesta de batería;
  - coherencia de `seed-data/assessment`.
- Integración: 84 tests ✔. `assessments.int.test.ts` cubre:
  - catálogo global de solo lectura, tests propios, versión de protocolo y fiabilidad local;
  - propuesta sin cribado o con él, agregación, reemplazo del resultado y métricas por lado;
  - veredicto con fiabilidad publicada, sin veredicto con métodos distintos o error desconocido;
  - referencias por rango de edad sin derivar;
  - alcance entre entrenadores, organizaciones y clientes.
- E2E: 14 tests ✔. Nuevos: el entrenador revisa el progreso, crea y registra una evaluación y la completa; otro entrenador no ve al cliente; el cliente ve su progreso en el móvil.

## Resultado de la Fase 6

- Unidad: 217 tests ✔, entre ellos:
  - textos y validación de la prescripción, fechas, expansión de plantillas, progresión por semana y descarga, propuestas post-sesión e indicadores;
  - coherencia de `seed-data/exercises` y `seed-data/templates`.
- Integración: 91 tests ✔. `planning.int.test.ts` cubre:
  - plantillas y su vista previa;
  - plan desde plantilla con fechas, kg desde un 1RM medido, conflictos de material, progresión por semana y descarga;
  - overrides auditados y prescripciones inválidas rechazadas;
  - bloques y ejercicios: añadir, mover y borrar;
  - duplicar sesión, semana y plan; plantilla anonimizada;
  - activación con revisión, plan activo único y diferencias entre revisiones;
  - esqueleto manual y alcance.
- E2E: 16 tests ✔. Nuevos: plan de 12 semanas y 3 días desde plantilla, editado y activado; el cliente no accede a la API de plantillas.

## Resultado de la Fase 7

- Unidad: 238 tests ✔. Nuevos: «hoy» y próxima sesión, validación de series (RIR o RPE), precarga, sustitución en vivo y dolor, conflictos de sincronización, cumplimiento y fecha local española.
- Integración: 100 tests ✔. `sessions.int.test.ts` cubre:
  - publicar solo en planes activos; el cliente no ve lo no publicado; aislamiento entre organizaciones y entrenadores;
  - registro idempotente; cola sin conexión reproducida dos veces sin duplicados; conflictos marcados para revisión; mutaciones inválidas rechazadas sin bloquear las demás;
  - modo sala (`logged_by_role = trainer`) y corrección de una serie sin duplicarla;
  - alternativas preaprobadas, sustitución pendiente con aviso solo a los entrenadores asignados, decisión del entrenador; un cliente no puede invocar `notify_client_trainers` para otro cliente;
  - cierre parcial con motivo obligatorio; dolor guardado solo con consentimiento y sin duplicarse; bienestar diario único.
- E2E: 20 tests ✔. Nuevos:
  - **criterio de aceptación §16.2**: el cliente registra series, una sustitución y el cierre **sin conexión** (`context.setOffline`); al volver la conexión se sincroniza sola; reenviar las mismas mutaciones devuelve `duplicate` y no crea registros;
  - calendario del cliente y API de personal cerrada para el cliente;
  - revisión del entrenador, decisión sobre una sustitución y modo sala;
  - publicación visible en el plan.

## Resultado de la Fase 8

- Unidad: 261 tests ✔. `monitoring.unit.test.ts` cubre:
  - **24 planificadas / 21 realizadas = 87,5 %** (criterio de aceptación);
  - exclusiones de la adherencia;
  - carga sRPE, monotonía y tensión semanales;
  - bienestar;
  - las 10 reglas, con sus casos que no deben disparar;
  - el dolor nunca usa lenguaje diagnóstico;
  - validación y valores por defecto de la configuración.
- Integración: 107 tests ✔. `monitoring.int.test.ts` cubre:
  - 87,5 % de extremo a extremo con 24 sesiones reales;
  - el cliente ve sus números y no las alertas; aislamiento entre organizaciones;
  - alertas tras los eventos, sin duplicados;
  - dolor solo con consentimiento; roja con derivación y notificación al entrenador asignado;
  - una alerta resuelta por una persona no reaparece; desactivar una regla para un cliente la resuelve;
  - trabajo diario;
  - reglas solo para ADMIN, validadas, versionadas y aplicadas (amarilla → roja en el mismo registro);
  - valoración por ejercicio idempotente desde la cola.
- E2E: 23 tests ✔. Nuevos:
  - Hoy con alertas de los tres colores;
  - la ficha de seguimiento con su evidencia;
  - resolver una alerta;
  - umbrales de solo lectura para el entrenador (y 403 en la API) y nueva versión guardada por ADMIN;
  - «Tu constancia» del cliente.

## Resultado de la Fase 9

- Unidad: 270 tests ✔. `dashboard.unit.test.ts` cubre:
  - racha: la sesión de hoy no la rompe; las reprogramadas no cuentan;
  - hitos: solo mejoras confirmadas;
  - cuadrícula de mes que empieza en lunes;
  - fases y descargas como intervalos.
- Integración: 110 tests ✔. `dashboard.int.test.ts` cubre:
  - calendario: alcance por RLS, filtro por cliente, intervalos, rango máximo, cliente rechazado;
  - dashboard del entrenador;
  - resumen con la semana del plan;
  - dashboard del cliente: vista previa, racha, hitos, próxima evaluación y tests visibles (máximo 5, solo personal asignado).
- E2E: 27 tests ✔. Nuevos:
  - calendario por cliente con fases y evaluaciones;
  - **3 tareas UX cronometradas** con umbrales de interacciones y tiempo (`UX_REVIEW.md`).
- Repetibilidad: la tarea UX 1 resuelve la alerta roja de dolor de la demo. Para repetirla en local, vuelve a cargar los datos (`pnpm db:reset && pnpm db:seed:demo`); CI siempre parte de datos nuevos.

## Resultado de la Fase 10

- Unidad: 288 tests ✔. `decision.unit.test.ts` cubre:
  - DSL: operadores, datos que faltan, operadores y parámetros desconocidos;
  - **futbolista de §69** con la explicación completa (datos, regla, evidencia con DOI, aplicabilidad, limitaciones, confianza);
  - sin umbral → aviso y valoración manual;
  - determinismo y regla desactivada;
  - derivación, principiante, avanzado (sin fase de introducción), mayor, adherencia baja con objetivos concurrentes y datos que faltan.
- Integración: 118 tests ✔. `decision.int.test.ts` cubre:
  - reglas: por defecto con umbrales pendientes, solo ADMIN, validación, versión nueva;
  - el futbolista de extremo a extremo desde la base de datos (consentimiento, cribado, evaluación, objetivo con deporte);
  - persistencia con evidencia enlazada;
  - determinismo y sustitución de pendientes;
  - aceptar, aceptar con cambios (`manual_overrides`), rechazar y posponer, con métricas por regla;
  - rasgos manuales; desactivar una regla para un cliente;
  - permisos y aislamiento.
- E2E: 28 tests ✔. Nuevo `decision.spec.ts`: la pestaña Necesidades con el «¿Por qué?» y su DOI, el rechazo con motivo y el editor de reglas con métricas. Modifica la demo (rechaza un método); en local, vuelve a cargar los datos para repetirlo.

## Resultado de la Fase 11

- Unidad: 310 tests ✔. `programming.unit.test.ts` cubre:
  - doble progresión (solo con rango de repeticiones) y ajuste por RIR (sube y baja), incremento por material;
  - desplazamiento de la carga planificada en los próximos 14 días; cambios recalculados al editar;
  - descarga en la primera semana que no ha empezado; reducción de volumen (mínimo 2 series);
  - sustitución por molestias con la alternativa preaprobada primero y sin diagnóstico;
  - determinismo;
  - adaptación de plantilla (semanas de introducción, sustituciones sin mutar la original).
- Integración: 126 tests ✔. `programming.int.test.ts` cubre:
  - **regla dura**: el plan activo no cambia sin aceptación;
  - aceptar solo afecta a sesiones futuras (las pasadas conservan lo prescrito), con revisión; deshacer;
  - descarga por alerta abierta: aceptar con cambios (`manual_overrides`), posponer, validación;
  - sustitución por molestias con consentimiento, aceptación en bloque;
  - aplicación automática auditada como `SYSTEM` y reversible;
  - propuesta de plan: no aparece entre los planes, no se activa, se acepta como borrador o se descarta;
  - cribado positivo bloquea la propuesta;
  - permisos y aislamiento.
- E2E: 29 tests ✔. Nuevo `programming.spec.ts`: desde Seguimiento → ajuste con «¿Por qué?» y cambios → aceptar → deshacer → aceptar la propuesta de plan como borrador. `planning.spec.ts` se limita ahora a la tarjeta «Nuevo plan», porque la pestaña tiene dos formularios. Modifica la demo: en local, vuelve a cargar los datos para repetirlo.

## Resultado de la Fase 12

- Unidad: 330 tests ✔.
  - `reports.unit.test.ts` cubre:
    - CSV con protección contra inyección (sin tocar los números negativos), coma decimal, comillas, BOM y lectura con `;` o `,`;
    - los 11 apartados en orden;
    - la interpretación frente al MDC;
    - sin molestias sin consentimiento y aviso con cribado positivo;
    - mensajes explícitos cuando faltan datos;
    - determinismo.
  - `contracts/test/imports.unit.test.ts` cubre la conversión de la entrada en español: fechas reales, enumeraciones, intentos con coma decimal, DOI y diseño.
- Integración: 136 tests ✔. `reports.int.test.ts` cubre:
  - informe con los 11 apartados, con y sin consentimiento;
  - **instantánea congelada** (datos posteriores no lo cambian);
  - **PDF idéntico byte a byte**; XLSX y CSV con los mismos apartados;
  - descargas auditadas; permisos y aislamiento;
  - exportación de clientes (ADMIN frente a entrenador, por RLS) con fórmula neutralizada; evaluaciones, evolución y XLSX;
  - importación de clientes (CSV, errores por columna, duplicados, catálogo, nada escrito antes de confirmar, doble confirmación `409`, cancelación);
  - evaluaciones (solo asignados, agrupadas, tests por lado);
  - referencias desde XLSX (no verificadas, duplicados de DOI);
  - ejercicios (borrador para revisar, patrón y material desconocidos);
  - columnas obligatorias, formato no admitido y plantillas.
- E2E: 30 tests ✔. Nuevo `reports.spec.ts`: generar el informe, comprobar sus apartados y descargar el PDF; importar un CSV con una fila errónea (errores visibles, solo la válida importada); exportar a XLSX.

## Resultado de la Fase 13

- Unidad: 348 tests ✔.
  - `security13.unit.test.ts`:
    - códigos de recuperación (formato, normalización, hash);
    - k-anonimato de contraseñas filtradas (solo sale el prefijo de 5 caracteres; si falla, no bloquea);
    - anillo de claves con claves anteriores.
  - `privacy.unit.test.ts`: plazo de un mes (con fin de mes), caducidad de la retención y campos anonimizados.
  - `auth.unit.test.ts`: paso de tiempo del código TOTP (±1 paso).
- Integración: 146 tests ✔.
  - `privacy.int.test.ts`:
    - exportación del interesado (descifrada, auditada, registrada) y quién no puede exportarla;
    - solicitudes y su resolución (la supresión no se cierra sin ejecutarla);
    - supresión: solo ADMIN, con el nombre completo; se borran salud, cuenta e identificadores y se conservan los datos de entrenamiento; auditoría redactada;
    - auditoría *append-only* para todo lo demás;
    - retención: nada sin plazo; con plazo, se anonimizan los archivados vencidos;
    - rotación de claves;
    - códigos de recuperación de un solo uso;
    - sesiones y 2FA obligatorio para ADMIN;
    - contraseñas filtradas.
  - `auth.int.test.ts`: un código TOTP no se acepta dos veces.
- E2E: 34 tests ✔.
  - Nuevo `privacy.spec.ts`:
    - el cliente descarga sus datos y presenta una solicitud;
    - ADMIN la atiende desde la bandeja;
    - ADMIN suprime un cliente con doble confirmación.
  - Nuevo `security.spec.ts`, el pentest ligero repetible (`PENTEST.md`):
    - cabeceras;
    - 401 sin trazas;
    - flags de la cookie;
    - CSRF;
    - IDOR → 404;
    - supresión fuera de rol;
    - descargas sin caché.
  - Modifica la demo: en local, vuelve a cargar los datos para repetirlo.

## Resultado de la Fase 14

- **Unidad: 379 tests ✔**, con umbral de cobertura.
  - `properties.unit.test.ts`: 24 propiedades con fast-check.
  - **Fallo encontrado por las propiedades y corregido**: la detección del separador CSV contaba separadores dentro de comillas, de modo que un `;` entre comillas en una cabecera separada por `,` se leía mal. Ahora solo cuenta fuera de comillas, y las celdas con tabulador se entrecomillan.
  - `contract.unit.test.ts`: contrato de la API y reglas de cambio rompiente.
  - `response-shape.unit.test.ts`: reglas del contrato de respuestas (campo eliminado o tipo cambiado rompe; campo nuevo, `null`, lista vacía o mapa libre no).
- **Integración: 148 tests ✔.** Nuevos en `rls.int.test.ts`: asignaciones e invitaciones.
- **Seguridad (`pnpm test:security`): 560 comprobaciones ✔.**
  - **Hallazgos corregidos** (RLS v7, migración `0026`):
    - un entrenador podía leer todas las asignaciones de la organización y, con SQL directo, asignarse cualquier cliente o terminar asignaciones ajenas;
    - un entrenador podía leer las invitaciones de staff y las de clientes no asignados;
    - un cliente podía cambiar cualquier columna de su ficha con SQL directo (la aplicación ya lo impedía); ahora lo impide también un trigger.
- **E2E: 39 tests ✔.** Nuevos:
  - `security-routes.spec.ts`: todas las rutas;
  - `a11y.spec.ts` y `a11y.mobile.spec.ts`: 51 páginas, temas claro y oscuro;
  - `perf.spec.ts` y `perf.mobile.spec.ts`.
- **Accesibilidad**: corregidos el tamaño de los enlaces del calendario (≥ 24 px, WCAG 2.2) y un enlace dentro de `<summary>` en la página de método.

## Rendimiento (§2.3)

**Cómo se mide**:

```bash
pnpm db:reset && pnpm db:seed:demo && pnpm db:seed:perf && pnpm build
pnpm --filter @tp/web test:e2e -- e2e/perf.spec.ts e2e/perf.mobile.spec.ts
```

- Organización «Centro Escala»: 10 entrenadores y 1 000 clientes (100 por entrenador), con 300 planes activos en local (100 en CI).
- **Listados**: cada `GET` de la API sin parámetros de ruta y las páginas principales del entrenador. 20 peticiones tras 2 de calentamiento; se mide el p95.
- **Móvil**:
  - emulación de Pixel 7, caché fría;
  - perfil de Lighthouse para móvil (RTT 150 ms, 1,6 Mbps de bajada, 750 kbps de subida, CPU 4× más lenta), más exigente que un 4G medio;
  - TTI aproximado como Lighthouse: fin de la última tarea larga antes de una ventana tranquila, nunca antes de `DOMContentLoaded`.

**Resultados** (máquina de desarrollo, 300 planes activos):

| Medida | Antes | Después | Objetivo |
|---|---|---|---|
| `GET /monitoring/overview` (ADMIN, 1 000 clientes) | 1 185 ms | 36 ms | < 300 ms |
| Cualquier página del entrenador (la cabecera muestra las alertas) | ≈ 1 100–1 300 ms | 43–128 ms | < 300 ms |
| Calendario, mes (ADMIN) | 1 941 ms → 340 ms tras la RLS | 147 ms | < 300 ms |
| Peor listado de la API (calendario del mes, ADMIN) | — | 128 ms | < 300 ms |
| TTI móvil (`/login`, `/me`, `/me/calendario`, `/me/progreso`) | — | 1,4–1,6 s (≈ 150 KB) | < 2,5 s |

**Qué se cambió**:

1. **RLS sin políticas anidadas** (RLS v8, migración `0027`).
   - Las tablas por cliente comprobaban `app_can_access_client()`, que vuelve a pasar por las políticas de `clients` y de asignaciones en **cada fila de cada tabla unida**: unos 0,15 ms por fila.
   - Ahora comprueban el rol directamente: ADMIN, entrenador asignado (`app_trainer_assigned`, con índice) o el propio cliente. Se mantiene la condición de organización, y un trigger garantiza que el cliente de la fila es de esa organización (lo exige un test unitario).
   - La matriz RLS y los tests de integración confirman que la semántica no cambia.
2. **Calendario con límite por día** (`perDay`):
   - el mes pide 4 sesiones por día y la semana 40, con los totales reales para el «+N más»;
   - con 100 planes activos, la respuesta del mes pasa a 41 KB en la API y 281 KB de HTML; antes eran 1,8 MB y 1,9 MB con 300 planes.

**No incluido en el umbral**: `GET /exports` genera un archivo, no es un listado (≈ 210 ms con 1 000 clientes).

**Fase 15**: crear un plan desde una plantilla pasa de ≈ 0,9 s a ≈ 240 ms, porque se escribe por niveles. Los datos de carga se generan en 42 s en lugar de 102 s.

## Resultado de la Fase 15

- **Unidad: 390 tests ✔**, con umbral de cobertura (94,8 % de líneas en el dominio).
  - `observability.unit.test.ts`: redacción de claves sensibles, depuración de emails, teléfonos y tokens, UUID conservados, una línea JSON por evento, nivel de log, errores sin datos.
  - Validación de mediciones externas.
- **Integración: 155 tests ✔.** Nuevos:
  - `integrations.int.test.ts`: CSV con coma decimal, errores por fila, salud solo con consentimiento, sin duplicados al reimportar, permisos, exportación y supresión;
  - `team.int.test.ts`: carga por entrenador, traspaso con el rol de principal, solo ADMIN, nunca entre organizaciones;
  - presupuestos de la API, en `privacy.int.test.ts`.
- **Seguridad: 566 comprobaciones RLS ✔**, incluidas las mediciones externas, que ya tienen datos demo.
- **E2E: 41 tests ✔.**
  - `security.spec.ts`: CSP con *nonce* distinto por petición y sin `'unsafe-inline'`; 429 con `Retry-After`; límites de tamaño del cuerpo.
  - La nueva ruta de mediciones entra sola en la matriz de acceso cruzado y en las pruebas de rendimiento.
- **Rendimiento** (con todas las páginas dinámicas por el *nonce*):
  - todos los listados ≤ 135 ms p95 con 1 000 clientes (`/trainers/workload`, 24 ms);
  - TTI en móvil ≈ 1,47–1,58 s.
- **Operación**: imagen Docker y `docker compose` probados; simulacro de copia, supresión, restauración y reaplicación (`OPERATIONS.md` §7).

## Resultado de los pendientes técnicos (tras la Fase 15)

- **Unidad: 403 tests ✔**, con umbral de cobertura.
  - `response-shape.unit.test.ts`: reglas del contrato de respuestas.
  - `reports.unit.test.ts`: versión del cliente del informe (lenguaje sencillo, sin jerga técnica, aviso de derivación).
  - `plan-document.unit.test.ts`: PDF del plan, versión del equipo y del cliente (sin notas internas).
- **Integración: 160 tests ✔.** Nuevos:
  - `storage.int.test.ts`: subir, leer y borrar contra un servidor S3 real (SeaweedFS en CI); una clave errónea se rechaza;
  - `reports.int.test.ts`: compartir un informe, el cliente lo ve solo mientras está compartido, nunca el informe técnico; PDF auditado;
  - `plan-pdf.int.test.ts`: versiones del PDF del plan; el cliente solo con su plan activo y lo publicado; ajenos, 404.
- **Seguridad: 566 comprobaciones RLS ✔.** `reports` comprueba que el cliente lee sus informes compartidos y no los demás.
- **E2E: 43 tests ✔** (1 omitido sin datos de carga).
  - `contract-responses.spec.ts`: contrato de respuestas de cada `GET`.
  - Compartir el informe y verlo en la app del cliente, con su PDF; descargar el PDF del plan como entrenador (dos versiones) y como cliente.
  - Accesibilidad: la versión del cliente del informe, en escritorio y en móvil.

## Resultado de la reestructuración, fase 1 (clientes, perfiles y navegación)

- **Unidad: 409 tests ✔.** Nuevo `levels.unit.test.ts`: tres niveles, diez dimensiones con descriptores distintos y sugerencia de nivel solo por la experiencia.
- **Integración: 168 tests ✔.** Nuevos:
  - `profiles.int.test.ts`: los 16 perfiles globales con sus niveles, objetivo y batería que existen; un perfil propio solo lo ve y lo usa su organización; perfil o deporte de otra organización y nivel fuera de 1–3, rechazados; cambios auditados; el cliente no puede cambiar su nivel;
  - `home.int.test.ts`: filas de «Mis clientes» (adherencia, próxima sesión, estado y motivo), orden con lo urgente primero, sesiones de hoy, ámbito del entrenador y acceso denegado al cliente.
- **Seguridad: 578 comprobaciones RLS ✔** (incluye `programming_profiles`, de tipo catálogo).
- **E2E: 43 tests ✔** (1 omitido sin datos de carga).
  - Alta en un formulario: perfil obligatorio, objetivo propuesto por el perfil, nivel propuesto por la experiencia, atajos de material; la ficha se abre en Salud.
  - Menú principal de 4 entradas y menú de usuario; recorridos de UX desde el inicio sin más interacciones que antes.
  - Accesibilidad de las pestañas nuevas (claro y oscuro): 0 infracciones graves.
- **Rendimiento** (1 000 clientes): inicio `/app` 145–162 ms p95; `GET /api/v1/dashboard/home` 80 ms p95.

## Resultado de la reestructuración, fase 2 (tabla de sesión y Programa por meses)

- **Unidad: 434 tests ✔**; cobertura del dominio, 95,26 % de líneas (`planning/grid.ts`, 97,9 %). Nuevos:
  - `grid.unit.test.ts` (17): lo que acepta cada celda (series, reps, carga, RIR, RPE, descanso) y el error que explica la notación; RIR y RPE excluyentes; pegado con y sin títulos y por prefijos («Carga (kg)», «Descanso»); reconocimiento de nombres sin tildes, con alias o con erratas, sin adivinar entre parecidos; ida y vuelta celda → texto → celda (propiedad, fast-check) y lo que la tabla copia, la tabla lo vuelve a pegar;
  - `program-view.unit.test.ts` (3): semanas → meses (por su jueves) y semana actual (la de hoy, si no la siguiente, si no la última).
- **Integración: 174 tests ✔** (2 más de almacenamiento S3 solo corren en CI). Nuevo `session-grid.int.test.ts` (6):
  - reconocer nombres entre los ejercicios visibles de la organización;
  - pegar 5 filas en una transacción, con auditoría por fila;
  - una fila no válida no añade ninguna y el error dice la fila y el campo;
  - ejercicio de otra organización, bloque de otra sesión y entrenadores sin acceso al cliente, rechazados;
  - duplicar debajo del original y quitar varias filas a la vez;
  - quitar filas de la sesión de otro cliente no quita nada.
- **Seguridad: 578 comprobaciones RLS ✔** (sin tablas nuevas en esta fase).
- **E2E: 48 tests ✔** (1 omitido sin datos de carga): batería completa (47) y, tras el último arreglo de teclado, otra vez las pruebas de la tabla, la planificación, la UX y la accesibilidad. Nuevas (`session-grid.spec.ts`):
  - «UX 4»: cambiar una carga desde el inicio en 4 interacciones;
  - errores de notación que se quedan en la celda, RIR/RPE excluyentes y Ctrl+Z;
  - «⋯ Más opciones» con el teclado (Tab desde la última celda e Intro);
  - pegar 5 filas desde Excel reconocidas por nombre, y deshacer;
  - dos entrenadores en la misma fila: no se pisa nada y el segundo recibe aviso.
- **Accesibilidad**: la pestaña Programa con la tabla y la ficha de ejercicio con la silueta, en claro y oscuro. Corregido: el botón principal al pasar el ratón bajaba a 4,48:1 de contraste (la prueba lo detectó porque el ratón quedaba encima de «Copiar a mi organización»).

## Resultado de la reestructuración, fase 3 (primera parte: biblioteca de plantillas)

- **Unidad: 455 tests ✔**; cobertura del dominio, 95,5 % de líneas (`planning/templates.ts`, 100 %). Nuevo `templates.unit.test.ts` (16):
  - filtros (perfil, nivel, días, población, tipo, origen, archivadas, material, texto sin tildes);
  - orden de encaje con el cliente (perfil, nivel, días, material; a igualdad, las del centro);
  - versiones: se agrupan las ediciones seguidas de la misma persona; nueva versión si edita otra persona, pasa el tiempo o un plan ya la usó;
  - ids de edición estables y patrón semanal por fase;
  - duración elegida al usarla: 3 meses toma la primera fase, 12 meses repite como «ciclo 2»; un mesociclo recortado conserva su descarga; las guardadas desde un plan real se acortan pero no se alargan; propiedad (fast-check): para cualquier duración el plan cubre la duración (como mucho 2 semanas menos), nunca recorta un mesociclo por debajo de 3 semanas y sigue siendo válido.
- **Integración: 185 tests ✔** (2 más de almacenamiento S3 solo corren en CI). Nuevo `templates.int.test.ts` (10):
  - filtros por días, nivel, origen y texto; parámetros fuera de rango rechazados;
  - para un cliente, primero las de su perfil; «solo con su material» deja fuera las que no puede hacer; otra organización no puede usar a sus clientes para listar;
  - usar una plantilla crea un plan independiente con la duración elegida (24 semanas a 6 meses), guarda plantilla y versión, y **no modifica la plantilla**;
  - crear desde cero (versión 1), duplicar una de la plataforma (las de la plataforma no se editan: 403);
  - **cada edición guardada es una versión**: las seguidas de la misma persona se agrupan; otra persona crea la siguiente; una versión desactualizada da conflicto y no se pisa nada;
  - una versión usada por un plan no cambia; restaurar crea una versión nueva; contenido no válido, rechazado;
  - archivar la saca de la biblioteca y no deja editarla ni usarla; otra organización no puede archivar, editar ni duplicar las del centro; el cliente no accede a la biblioteca.
  - `security.int.test.ts`: un identificador mal formado es «no encontrado», nunca un error interno.
- **Seguridad: 584 comprobaciones RLS ✔** (+6: `plan_template_versions`, catálogo).
- **E2E: 51 tests ✔** (1 omitido sin datos de carga). Nuevas (`templates.spec.ts`):
  - «UX 5»: plan desde plantilla para un cliente sin plan en 4 interacciones (3 clics y la fecha);
  - duplicar una de la plataforma, usarla con un cliente, editar una celda (versión 2; la 1 queda «usada en planes») y restaurar (versión 3 con el contenido de la 1);
  - las de la plataforma son de solo lectura también por la API (403, no por CSRF).
  - `planning.spec.ts` sigue el flujo nuevo («Usar plantilla» desde Programa); `security.spec.ts` comprueba el 404 de ids mal formados; la matriz de rutas cubre las rutas nuevas con la plantilla propia del centro de la demo.
- **Corregido durante las pruebas**: la celda activa por defecto entraba en edición al primer clic y lo tecleado se añadía al valor («1» + «4» = «14»): ahora el primer clic selecciona y escribir sustituye.

## Resultado de la reestructuración, fase 3 (segunda parte: plantillas iniciales)

- **Unidad: 468 tests ✔**; cobertura del dominio, 95,6 % de líneas. Nuevo `apps/web/test/client-boundary.unit.test.ts`: desde las páginas del servidor, nada importa valores (solo componentes y tipos) de un módulo `'use client'`. Comprobado con una mutación: importar `DEFAULT_DAYS` en la página de plantillas lo hace fallar.
- Nuevo `packages/db/test/profile-templates.unit.test.ts` (6), sobre las 85 plantillas generadas junto a las 17 escritas a mano:
  - cada combinación perfil × nivel × días ofrecida existe exactamente una vez, y los slugs (`perfil-`, `riesgo-`) no entran en la elección del motor de decisiones;
  - solo hay plantillas genéricas para los perfiles que las admiten (no readaptación ni personalizado);
  - definiciones válidas, ejercicios y métodos existentes, prescripciones válidas, y cada ejercicio dice cuánto (repeticiones, tiempo, distancia o contactos);
  - sin ejercicios avanzados en el nivel 1, ni de impacto alto para mayores o parálisis cerebral en los niveles 1–2;
  - evidencia por población: la de mayores no se usa en otros adultos, y `fuerza-maxima` no aparece con dosis de nivel 1;
  - las rutinas de reducción de factores de riesgo tienen 3 niveles, sin perfil, y su texto nunca presenta la prevención como un hecho.
- Nuevo `packages/application/test/seed-templates-contract.unit.test.ts`: toda plantilla de la plataforma, duplicada, se puede guardar desde la tabla (contrato `templateDefinitionSchema`).
- `evidence.unit.test.ts` cubre el fichero nuevo `templates_profiles.json`: 5 fuentes de PubMed, 9 hallazgos con cita literal y 4 afirmaciones.
- Nuevo `json.unit.test.ts`:
  - `canonicalJson` ordena las claves a todos los niveles y conserva el orden de las listas;
  - propiedad (fast-check): mismo contenido con otro orden de claves es igual.
- `diffFields` ya no ve cambios donde solo cambia el orden de las claves.
- `profileFromGoals` (A21): primero el objetivo principal y luego el de más peso; el primer perfil del catálogo; ninguno sin objetivos.
- **Integración: 187 tests ✔**. La siembra carga 102 plantillas, y 26/26 métodos y 86/87 afirmaciones publicadas (la que falta es la de ecuaciones sin verificar, como antes). Nuevos:
  - **cargar el catálogo otra vez no cambia ninguna versión** de las 102 plantillas. Antes subían todas, porque `jsonb` no conserva el orden de las claves;
  - un cliente sin perfil, con objetivo de hipertrofia, ve primero las de hipertrofia, y no se le guarda perfil.
- **Seguridad: 584 comprobaciones RLS ✔**.
- **E2E: 52 tests ✔** (1 omitido sin datos de carga).
  - Nuevo en `templates.spec.ts`:
    - el filtro «Tipo» muestra las 9 rutinas agrupadas, cada rutina con sus 3 niveles seguidos;
    - la rutina de isquiosurales de nivel 2 enlaza su evidencia, dice «puede reducir» y muestra la categoría de cada ejercicio;
    - la plantilla generada para mayores cita la evidencia de equilibrio y tiene equilibrio en sus 3 sesiones.
  - «UX 5» se hace con la biblioteca completa: la clienta sin perfil ve primero una plantilla de hipertrofia, por su objetivo, y aparece el aviso «no tiene perfil de programación».
  - `planning.spec.ts` y «UX 4» esperan a que la celda se guarde antes de recargar. Recargar justo después de Intro podía cancelar el guardado en segundo plano; falló una vez en esta fase.
- **Latencia de los filtros con la biblioteca completa** (103 plantillas; build de producción; 20 repeticiones):
  - `GET /plan-templates`, con y sin filtros: p95 ≤ 33 ms;
  - página Plantillas: p95 ≤ 60 ms;
  - para un cliente, ordenada por encaje: p95 ≤ 81 ms.
  - Criterio de la fase: < 300 ms.

## Resultado de la reestructuración, fase 4 (evaluaciones y referencias)

- **Test de oro** (`packages/domain/test/club-golden.unit.test.ts`): reproduce el informe del club con 20 jugadores sintéticos.
  - Compara mediana de 3 pliegues, mínimo de 2 sprints, Σ6/Σ4, Faulkner, Yuhasz, masa grasa, MLG, IMC y asimetría.
  - También las 30 filas del «Informe grupal» (N, media, DT, máx., mín., mejor, peor) y las 7 columnas de Z.
  - La fixture se regenera con `python3 scripts/golden/make_club_fixture.py <libro.xlsx>` (requiere LibreOffice Calc); el libro no está en el repositorio.
- **Unitarias** (`evaluation.unit.test.ts`):
  - el lenguaje de fórmulas rechaza lo que no es aritmética (sin ejecución de código), detecta ciclos y nombres desconocidos, y sin dato no da valor;
  - estadísticas y Z con propiedades: la media de Z es 0, sumar una constante no cambia Z, invertir el sentido invierte Z;
  - bandas y datos atípicos (sin la propia persona).
- **Integración** (`groups.int.test.ts`):
  - grupos solo para el equipo técnico; un entrenador ve solo a sus miembros;
  - la evaluación de grupo no duplica;
  - el informe da medianas, mínimos, Σ, Faulkner, mejor, peor, Z, «confirmar medición» y asimetría;
  - las constantes del centro se usan en los cálculos nuevos y no afectan a otros centros;
  - se rechazan fórmulas inválidas y circulares; una fórmula propia se calcula.
- **Seguridad:** la matriz RLS cubre `derived_formulas`, `client_groups` y `client_group_members` con datos de la demo (positivo y negativo).
- **E2E** (`groups.spec.ts`): Mis clientes → Grupos y equipos → «Último informe» (2 clics); pegar un bloque de Excel en la hoja guarda las filas y aplica la mediana; cambiar y restaurar las constantes de Faulkner.

## Resultado de la reestructuración, fase 5 (radar y comparativa)

- **Propiedades** (`normalize.unit.test.ts`):
  - un resultado mejor nunca puntúa menos, en ninguna escala;
  - invertir el sentido invierte el eje;
  - sin dato = hueco;
  - toda puntuación cae dentro del radar;
  - la puntuación de una dimensión queda entre la de sus tests.
- **Catálogo:** todas las dimensiones usan tests o fórmulas que existen (`assessment-seed.unit.test.ts`).
- **Integración** (`comparison.int.test.ts`):
  - A y B por defecto, y la Z de A igual a la del informe grupal;
  - B se puntúa con la misma base que A;
  - dimensiones con huecos, percentil y dimensiones elegidas;
  - acceso de otra organización: no encontrado.
- **E2E** (`radar.spec.ts`): desde la ficha, el radar accesible con su leyenda y su tabla, la tabla test a test y el cambio de escala.
- **Accesibilidad:** axe (WCAG 2.2 AA) también en la comparativa, en grupos y en fórmulas.

## Resultado de la reestructuración, fase 6 (informes)

- **Unitarias** (`report-kinds.unit.test.ts`):
  - los 8 tipos se construyen de forma determinista y sin frases prohibidas;
  - el validador de lenguaje rechaza lo prohibido y no da falsos positivos («No es un diagnóstico», «adaptado», «Procura»);
  - radar y filas de Excel/CSV del comparativo y del final;
  - fortalezas según la banda, con test de propiedades;
  - el informe de readaptación nunca dice «apto» y, sin consentimiento, no muestra datos de salud.
- **Integración** (`report-kinds.int.test.ts`):
  - cada tipo se descarga en PDF, XLSX y CSV, y el PDF sale idéntico en cada descarga y tras cambiar los datos;
  - comparativo con y sin referencia;
  - readaptación con lesión, molestias y tests antes y después;
  - se rechaza el texto «previene lesiones» o «apto»;
  - solo se comparten los tipos de periodo;
  - informe de rendimiento solo para el equipo de la organización.
- **E2E** (`report-kinds.spec.ts`):
  - comparativo desde la ficha, con radar y PDF;
  - rechazo de «previene lesiones» con su motivo;
  - informe de rendimiento con fichas y descargas.

## Resultado de la reestructuración, fase 7 (lesiones y readaptación)

- **Unitarias**:
  - `injury.unit.test.ts`: alertas por síntomas, criterio por valor y por simetría del lado afectado (sin dato no se cumple), estados sin «apto», [Avanzar de fase] con motivos, checklist de vuelta y lectura del cambio frente al error de medida;
  - `injury-seed.unit.test.ts`: las 6 lesiones iniciales con protocolo, tests existentes, criterios con evidencia o consenso siempre con fuente verificada del seed, simetría solo en tests por lados y decisión del equipo al final de cada protocolo;
  - `report-kinds.unit.test.ts`: informe de readaptación con el caso (fase, criterios, variables, decisiones), sin frases prohibidas y sin datos de salud sin consentimiento.
- **Integración** (`injuries.int.test.ts`):
  - consentimiento obligatorio y diagnóstico cifrado en reposo;
  - el avance exige los criterios obligatorios y lo pulsa el entrenador;
  - una alerta bloquea hasta revisarla y una página antigua no puede avanzar dos veces;
  - simetría automática desde evaluaciones;
  - comparativa solo con las variables del protocolo, con línea base y fase;
  - la decisión con «apto» se rechaza;
  - otro entrenador y la app del cliente no ven nada, y la lectura queda auditada;
  - informe de readaptación congelado sin el diagnóstico;
  - cierre del caso.
- **Seguridad**:
  - la matriz RLS cubre las 10 tablas nuevas (catálogo y datos de salud);
  - las 13 rutas nuevas pasan la matriz por ruta (otra organización, otro cliente, entrenador no asignado).
- **E2E** (`injury.spec.ts`):
  - la alerta abierta bloquea [Avanzar de fase] y se revisa;
  - un registro de dolor sobre el umbral genera alerta;
  - decisión con «apta» rechazada y luego registrada con nombre y rol;
  - abrir un caso desde Ficha → Salud, marcar criterios y avanzar a mano.
- **Accesibilidad**: pestaña Readaptación y página del caso en `a11y.spec.ts` (claro y oscuro), sin infracciones.

## Resultado de la reestructuración, fase 8 (cliente móvil, fichaje y feedback)

- **Unitarias** (`sessions.unit.test.ts`):
  - fichaje automático: una sesión iniciada y pasada queda incompleta; una pasada sin registro, no realizada;
  - nunca toca hoy, el futuro, las no publicadas ni las ya cerradas;
  - los cinco estados que ve el cliente;
  - una sesión iniciada cuenta como realizada en la adherencia.
- **Integración** (`fichaje.int.test.ts`):
  - RLS «solo publicadas» con SQL directo como cliente: no lee sesiones sin publicar, ni sus bloques ni sus ejercicios; el equipo sí;
  - la primera serie marca «Iniciada» y el cierre la sustituye;
  - el trabajo diario cierra lo pasado como incompleta o no realizada (automática), es idempotente y el cliente puede cerrarla después;
  - «¿Cómo fue?» se guarda siempre; «¿Molestias?» solo con consentimiento.
- **E2E móvil** (`player.mobile.spec.ts`, Pixel 7):
  - silueta accesible en la tarjeta;
  - sin conexión: primera serie → «Iniciada»;
  - Normal y Algo + 3/10 con el mensaje de seguridad, y botones de 48 px como mínimo;
  - cierre con «Difícil» y sincronización al volver la conexión, con una sola serie registrada.
- La prueba existente de sesión completa sin conexión y sin duplicados (`sessions.mobile.spec.ts`) sigue pasando.
- **Rendimiento móvil** (`perf.mobile.spec.ts`): TTI de 1,38 a 1,49 s en `/login`, `/me`, `/me/calendario` y `/me/progreso` (objetivo < 2,5 s en 4G).
- **Suite E2E completa**: 61 pruebas, 60 pasan y 1 se omite; WCAG 2.2 AA sin infracciones en escritorio y móvil.

## Resultado de la reestructuración, fase 9 (ciencia y referencias)

- **Unitarias**:
  - `evidence-kind.unit.test.ts`:
    - deducción del tipo de evidencia;
    - «reduce el riesgo de lesiones» solo con evidencia de incidencia;
    - solo las fuentes verificadas respaldan;
    - el control de calidad detecta tanto el tipo incorrecto como el respaldo no verificado.
  - `evidence.unit.test.ts`:
    - las referencias no verificables no tienen DOI ni PMID y nunca las cita un hallazgo;
    - las búsquedas seleccionan fuentes existentes.
- **Integración** (`science-traceability.int.test.ts`):
  - ficha con DOI, PMID, población, qué respalda y limitaciones;
  - la referencia no verificable del documento del club no aparece como respaldo;
  - fichas a partir de los métodos;
  - el cliente no accede;
  - todas las afirmaciones publicadas tienen tipo y solo fuentes verificadas;
  - se rechaza «reduce el riesgo de lesiones» sin incidencia;
  - registro de búsquedas, también las del centro.
- **E2E** (`fuente.spec.ts`):
  - «Fuente» junto a un criterio de readaptación y en el protocolo;
  - Ciencia → Búsquedas;
  - una referencia no verificable, marcada como tal.
- **Accesibilidad**: `/app/science/busquedas` en `a11y.spec.ts`.

## Resultado de la reestructuración, fase 10 (endurecimiento final)

- **Bloqueo de planes** (`planning.int.test.ts`, `sessions.int.test.ts`):
  - completado y archivado: añadir bloques, cambiar semanas y crear revisiones responden `409` (`plan: locked`);
  - leer, duplicar y reabrir siguen permitidos;
  - aprobar una sustitución con «añadir como alternativa» sobre un plan archivado también se rechaza; sin añadirla, se puede decidir.
- **Cola sin conexión** (`apps/web/test/offline-queue.unit.test.ts`):
  - nada se envía hasta saber quién es el usuario;
  - al entrar otra cuenta se borran las entradas ajenas;
  - cerrar sesión vacía la cola.
- **RGPD** (`privacy.int.test.ts`):
  - la exportación del propio cliente incluye su caso de lesión (información recibida descifrada), síntomas, avisos y fases;
  - la supresión borra lesiones, síntomas, avisos, fases, ejecuciones del motor y rasgos;
  - prueba de guardia: toda tabla con `client_id` se exporta o figura en `SUBJECT_EXPORT_EXCLUDED` con su motivo.
- **Rendimiento** (`perf.spec.ts`, ahora también con grupos, biblioteca, evaluaciones, fuentes y búsquedas): todo < 300 ms p95 con 1 000 clientes. El máximo es el calendario como ADMIN, con 226 ms.
- **Seguridad**:
  - `security-routes.spec.ts`: 229 rutas autenticadas y 597 ataques, sin un solo 2xx;
  - matriz RLS en verde;
  - `pnpm audit --prod`: 0 altas.
- **Restauración**: `scripts/restore-drill.sh --app`. Copia y comparación en la misma instantánea, base nueva y app arrancada sobre ella (`OPERATIONS.md` §6).
- **Orden de las E2E**: la prueba de límite de operaciones pesadas de `security.spec.ts` agota el presupuesto del minuto de Iker. Si se ejecuta justo antes de `sessions.mobile.spec.ts` (descarga de PDF), esta recibe un 429. En la suite completa las separa más de un minuto. Para un subconjunto, ejecútalas por separado.
