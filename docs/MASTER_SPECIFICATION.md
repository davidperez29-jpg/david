# MASTER SPECIFICATION — Plataforma de evaluación, programación, entrenamiento y seguimiento

> **Estado:** Fases 0–15 completadas. Documento vivo; lo implementado se detalla en `ARCHITECTURE.md`.
> **Versión:** 0.1.0 · **Fecha:** 2026-10-03
> **Ámbito:** fuente única de verdad del diseño. Los documentos `/docs/ARCHITECTURE.md`, `/docs/DATABASE.md`, etc. se derivarán de este documento al inicio de cada fase (ver §16.4) para evitar dos versiones divergentes del mismo diseño.
> **Anexos de investigación (Fase 0):** `/docs/research/` — análisis de los documentos aportados, registro de evidencia verificada, base de tests y QA de referencias.

## Índice

0. [Cómo leer este documento](#0-cómo-leer-este-documento)
1. [Visión](#1-visión)
2. [Objetivos del producto](#2-objetivos-del-producto)
3. [Usuarios y roles](#3-usuarios-y-roles)
4. [Arquitectura](#4-arquitectura)
5. [Stack tecnológico](#5-stack-tecnológico)
6. [Base de datos](#6-base-de-datos)
7. [Módulos](#7-módulos)
8. [Flujo del entrenador](#8-flujo-del-entrenador)
9. [Flujo del cliente](#9-flujo-del-cliente)
10. [Sistema científico](#10-sistema-científico)
11. [Sistema de evaluación (Assessment Engine)](#11-sistema-de-evaluación-assessment-engine)
12. [Planificación (Programming Engine)](#12-planificación-programming-engine)
13. [Motor de decisiones (Decision Engine)](#13-motor-de-decisiones-decision-engine)
14. [Seguridad y privacidad](#14-seguridad-y-privacidad)
15. [Testing y calidad](#15-testing-y-calidad)
16. [Roadmap](#16-roadmap)
17. [Riesgos](#17-riesgos)
18. [Análisis de los documentos aportados](#18-análisis-de-los-documentos-aportados)
19. [Decisiones abiertas](#19-decisiones-abiertas)

---

## 0. Cómo leer este documento

### 0.1 Convenciones

| Marca | Significado |
|---|---|
| **DEBE** | Requisito obligatorio. |
| **DEBERÍA** | Recomendado; desviarse exige justificarlo. |
| **PUEDE** | Opcional. |
| `[REQUIERE VERIFICACIÓN]` | Dato que no se ha podido verificar en fuente primaria. No se presenta como hecho y no se carga en la base de evidencia como verificado. |
| `Referencia insuficiente` | No existe referencia robusta para ese valor/población. |
| `EV-…`, `TST-…`, `REF-…` | Identificadores del registro de evidencia (`/docs/research/`). |

### 0.2 Escala de evidencia usada en todo el sistema

La escala que pidió el usuario (A–H) se mantiene, pero **cada letra se asigna mediante criterios explícitos** (ver §10.4) y nunca se presenta sola: siempre va acompañada de población, aplicabilidad, limitaciones e incertidumbre.

| Código | Etiqueta | Criterio resumido |
|---|---|---|
| A | Evidencia fuerte | Guías/position stands basados en revisión sistemática, o ≥1 metaanálisis de ECA con resultados consistentes, precisión aceptable y población directamente aplicable. |
| B | Evidencia moderada | Metaanálisis con heterogeneidad/imprecisión relevante, o varios ECA consistentes sin síntesis formal, o población parcialmente aplicable. |
| C | Evidencia limitada | Pocos ECA pequeños, estudios no controlados, resultados en variables sustitutas, o población claramente distinta. |
| D | Evidencia contradictoria | Fuentes de calidad similar con conclusiones opuestas. |
| E | Mecanismo plausible | Apoyo fisiológico/biomecánico sin demostración de efecto sobre el resultado de interés. |
| F | Recomendación práctica | Práctica habitual o consenso profesional razonable sin demostración comparativa. |
| G | Opinión | Afirmación de un autor/entrenador sin apoyo. |
| H | No verificada | No se ha podido comprobar la fuente o la cifra. |

### 0.3 Tipo epistémico (independiente del nivel)

Toda afirmación del sistema lleva además: **HECHO** (lo que el estudio midió) · **INFERENCIA** (lo que razonablemente se deduce para nuestra población) · **HIPÓTESIS** (posible, no comprobado) · **OPINIÓN**.

---

## 1. Visión

Construir una **plataforma profesional de toma de decisiones en entrenamiento**, no una biblioteca de ejercicios ni un Excel en la web, que responda a la pregunta:

> *¿Qué necesita esta persona en este momento para acercarse a su objetivo de forma eficiente, razonable y segura?*

El sistema sigue el ciclo:

```
PERSONA → OBJETIVO → CONTEXTO → EVALUACIÓN → NECESIDADES → PRIORIZACIÓN
   → MÉTODOS → EJERCICIOS → DOSIS → PLANIFICACIÓN → ENTRENAMIENTO
   → FEEDBACK → REEVALUACIÓN → AJUSTE ─┐
        ▲                              │
        └──────────────────────────────┘
```

Principios no negociables (resumen de §0–§75 del encargo):

1. **Tres capas separadas:** Biblioteca científica · Biblioteca de ejercicios · Motor de decisiones. Nunca se mezclan en código ni en tablas.
2. **El entrenador tiene siempre la última palabra.** La automatización genera **propuestas**; nunca modifica un programa activo sin autorización explícita. Todo override queda auditado.
3. **Explicabilidad total:** "Se propone X porque…" con datos → regla → evidencia → limitaciones → confianza.
4. **No hay metodología universal.** Plantillas y reglas son puntos de partida configurables, evaluados contra el contexto de cada persona (p. ej., una fase de adaptación de tejidos se *evalúa*, no se impone).
5. **Rigor científico trazable:** recomendación → método → variable → evidencia → artículo. Nada inventado; la incertidumbre se conserva.
6. **No diagnosticar.** Ante cualquier cuestión médica: *"Requiere valoración por profesional sanitario."*
7. **Dos experiencias radicalmente distintas:** entrenador (densidad de información, análisis, control) y cliente (simplicidad extrema, móvil, entrenamiento de hoy).
8. **Excel no es el núcleo:** solo importación, exportación, respaldo y análisis externo.
9. **Crecer sin reconstruir:** de 1 entrenador + 10 clientes a varios entrenadores + miles de clientes, sin sobrearquitecturar hoy.

---

## 2. Objetivos del producto

### 2.1 Objetivos funcionales (qué debe permitir)

| # | Capacidad | Fase |
|---|---|---|
| F1 | Gestionar clientes (ficha completa, consentimiento, estado) | 1 |
| F2 | Seleccionar objetivo principal + secundarios con prioridad y fecha | 1–2 |
| F3 | Evaluar con baterías dependientes del objetivo; tests configurables | 5 |
| F4 | Obtener perfil y comparar evaluaciones (antes/después/referencia) con MDC | 5 |
| F5 | Identificar necesidades y prioridades razonadas | 10 |
| F6 | Planificar 3/6/9/12 meses: plan → fases → mesociclos → microciclos → sesiones → ejercicios → series | 6 |
| F7 | Prescribir series, reps, carga, %1RM, RIR, RPE, tempo, descanso, velocidad, pérdida de velocidad, tiempo, distancia, contactos… mostrando solo las variables relevantes | 6–7 |
| F8 | Biblioteca de ejercicios con media, siluetas, progresiones/regresiones, sustituciones | 3 |
| F9 | Biblioteca de métodos y evidencia con trazabilidad | 4 |
| F10 | Enviar entrenamiento al cliente; ejecución móvil; registro rápido | 7 |
| F11 | Feedback general y por ejercicio; dolor/molestias; readiness | 8 |
| F12 | Asistencia y adherencia (planificadas/completadas/%) | 8 |
| F13 | Alertas 🟢🟡🔴 no diagnósticas | 8–10 |
| F14 | Propuestas automáticas explicables (programa y ajustes) | 10–11 |
| F15 | Override manual con auditoría | 6+ (transversal) |
| F16 | Plantillas 2–5 días por objetivo como punto de partida | 11 |
| F17 | Informes PDF/XLSX/CSV; importación CSV/XLSX validada | 12 |
| F18 | Calendario (sesiones, evaluaciones, fases, descansos) | 7–9 |
| F19 | Multi-entrenador, multi-cliente, presencial y online | 1 (modelo) / 15 (escala) |

### 2.2 Objetivos de entrenamiento soportados (catálogo inicial configurable)

Hipertrofia · Iniciación a la fuerza · Salud general · Fuerza funcional · Fuerza máxima · Potencia · Rendimiento en deportes de equipo · Rendimiento en deportes de resistencia · Sprint · Aceleración · Cambio de dirección (COD) · Agilidad · Composición corporal · Movilidad · Capacidad neuromuscular · Reacondicionamiento · Preparación física general.

Cada cliente tiene **un objetivo principal + N secundarios**, cada uno con prioridad (peso), fecha objetivo opcional, deporte/nivel opcional. El catálogo es **dato** (tabla `goals`), no código.

> **Reacondicionamiento** se define estrictamente como *vuelta progresiva al entrenamiento tras un periodo de inactividad o tras el alta de un profesional sanitario*. El sistema no diseña tratamientos ni rehabilitación clínica.

### 2.3 Objetivos no funcionales

| Atributo | Objetivo medible |
|---|---|
| Mantenibilidad | Lógica de dominio 100 % en paquetes puros sin dependencias de UI/BD; cobertura ≥ 90 % en motores de cálculo. |
| Seguridad | OWASP ASVS nivel 2 como checklist; 0 endpoints sin autorización (test automático que enumera rutas). |
| Privacidad | RGPD: datos de salud (art. 9) con consentimiento explícito, minimización, exportación y supresión. |
| Rendimiento | Cliente: registrar una serie ≤ 2 toques tras abrir el ejercicio; TTI móvil < 2,5 s en 4G. Entrenador: listados < 300 ms p95 con 1 000 clientes. |
| Disponibilidad | 99,5 % (fase inicial); copias diarias, PITR 7 días. |
| Escalabilidad | 1 instancia sirve 10 entrenadores/1 000 clientes; escalado horizontal sin estado. |
| Accesibilidad | WCAG 2.2 AA en ambas experiencias. |
| Idioma | Español en UI y contenidos; código, identificadores y API en inglés; i18n preparado. |

---

## 3. Usuarios y roles

### 3.1 Personas

| Persona | Contexto | Necesidad principal |
|---|---|---|
| **Entrenador/a principal** (dueño del negocio) | Escritorio + tablet en sala; presencial y online | Ver de un vistazo qué cliente necesita atención; programar rápido con rigor; justificar decisiones. |
| **Entrenador/a colaborador/a** | Trabaja con un subconjunto de clientes | Acceso solo a sus clientes; usar bibliotecas comunes. |
| **Cliente presencial** | Entrena con el entrenador delante | Ver la sesión, registrar poco; el entrenador puede registrar por él. |
| **Cliente online** | Entrena solo, en gimnasio o casa, con el móvil | Saber exactamente qué hacer hoy, cómo, y registrar en segundos. |
| **Administrador/a** | Puede ser el mismo entrenador principal | Configuración, usuarios, catálogos, reglas, auditoría. |

### 3.2 Roles y alcance (RBAC + ámbito)

| Rol | Alcance | Puede |
|---|---|---|
| `ADMIN` | Organización completa | Todo, incluida gestión de usuarios, reglas, catálogos globales, auditoría, exportación/supresión RGPD. |
| `TRAINER` | Clientes asignados (`trainer_client_assignments`) + bibliotecas de su organización | Clientes, evaluaciones, programación, ejercicios propios, informes, seguimiento, aceptar/rechazar propuestas. |
| `CLIENT` | Exclusivamente su propio registro | Ver sus sesiones, registrar ejecución y feedback, ver la evolución que el entrenador haya hecho visible, gestionar consentimiento, exportar sus datos. |

Detalles de permisos en §14.2. Regla de oro: **un cliente nunca puede acceder a otro cliente**, y un entrenador nunca accede a clientes de otra organización ni a clientes no asignados (salvo `ADMIN`).

### 3.3 Modelo de organización (preparado para crecer)

```
Organization (tenant)
 ├── Users (ADMIN | TRAINER | CLIENT)
 ├── Trainers ──< TrainerClientAssignment >── Clients
 ├── Org-level libraries (ejercicios, métodos, tests, plantillas, reglas propias)
 └── Global libraries (contenido curado por la plataforma, solo lectura, "forkable")
```

Con 1 entrenador existe 1 organización y la complejidad es invisible en la UI.

---

## 4. Arquitectura

### 4.1 Estilo: monolito modular con dominio puro

Se descarta empezar con microservicios (coste operativo injustificado para 1 entrenador/10 clientes) y se descarta un monolito sin fronteras (impediría crecer). Se elige un **monolito modular**: un único despliegue, pero con módulos de dominio aislados por contratos explícitos, de forma que cualquier módulo (p. ej. informes o integraciones) pueda extraerse más tarde sin reescribir.

```
┌───────────────────────────────────────────────────────────────────────┐
│                         PRESENTACIÓN (apps/web)                       │
│   Trainer UI (escritorio/tablet)        Client UI (PWA móvil-first)   │
│   Solo composición de vistas · sin lógica científica ni de negocio    │
└───────────────▲───────────────────────────────────▲───────────────────┘
                │ HTTP (REST /api/v1, JSON, OpenAPI) │
┌───────────────┴───────────────────────────────────┴───────────────────┐
│                     CAPA DE APLICACIÓN (casos de uso)                  │
│  auth · clients · assessments · planning · sessions · tracking ·       │
│  library · science · decisions · reports · imports · notifications     │
│  - autorización (policy) · validación (zod) · transacciones · auditoría│
└──────┬──────────────────┬──────────────────────┬──────────────────────┘
       │                  │                      │
┌──────▼──────┐   ┌───────▼────────┐    ┌────────▼─────────────────────┐
│ DOMINIO PURO│   │ CONOCIMIENTO   │    │ INFRAESTRUCTURA              │
│ (packages/  │   │ (datos, no     │    │ PostgreSQL (Drizzle) · cola  │
│  domain)    │   │  código)       │    │ pg-boss · S3 · email · PDF   │
│ engines:    │   │ evidence,      │    │ adaptadores de integraciones │
│ assessment, │   │ methods,       │    │ (futuro: Garmin, encoders…)  │
│ programming,│   │ exercises,     │    └──────────────────────────────┘
│ decision,   │   │ tests, refs,   │
│ progression,│   │ rules (JSON    │
│ adherence,  │   │ versionadas)   │
│ metrics     │   └────────────────┘
└─────────────┘
```

**Reglas de dependencia (verificadas con `dependency-cruiser` en CI):**

1. `packages/domain` no importa nada de BD, HTTP, React ni Node APIs. Funciones puras: entrada tipada → salida tipada + explicación. Esto los hace testeables, deterministas y reutilizables (servidor, worker o incluso cliente offline).
2. La **biblioteca científica**, la **biblioteca de ejercicios** y las **reglas** son **datos** versionados en BD. El motor los recibe como parámetro (`KnowledgeSnapshot`); nunca están *hard-coded* en componentes.
3. La UI nunca calcula nada con significado científico (ni %1RM, ni adherencia, ni alertas). Pide resultados a la API.
4. Los módulos se comunican por servicios de aplicación (llamada interna) y eventos de dominio (`SessionCompleted`, `AssessmentRecorded`, `RecommendationAccepted`…) persistidos en una tabla *outbox* y procesados por el worker.

### 4.2 Separación de las tres capas pedidas

| Capa | Dónde vive | Qué contiene | Qué NO contiene |
|---|---|---|---|
| **A. Biblioteca científica** | Tablas `evidence_sources`, `evidence_findings`, `knowledge_claims`, `methods`, `method_*`, `populations`, `outcomes` + módulo `science` | Métodos, mecanismos, estudios, poblaciones, dosis, resultados, limitaciones, incertidumbres, gradación | Ejercicios concretos; reglas de decisión |
| **B. Biblioteca de ejercicios** | Tablas `exercises`, `exercise_*`, `movement_patterns`, `muscles`, `equipment` + módulo `library` | Ejercicios, media, siluetas, taxonomías, progresiones, cues, errores | Evidencia (solo enlaza a métodos/evidencia por id) |
| **C. Motor de decisiones** | `packages/domain/decision` + tablas `rules`, `recommendations`, `alerts`, `program_proposals` | Reglas que relacionan persona+objetivo+evaluación+contexto con A y B; salida explicada | Contenido científico duplicado; ejercicios embebidos |

### 4.3 Flujo de datos de una propuesta (ejemplo)

```
Trainer pulsa "Generar propuesta"
 → decisions.generateProposal(clientId)            [capa aplicación, autoriza]
   → ContextBuilder: ClientContext (perfil, objetivos, evaluaciones,
                     disponibilidad, equipo, tolerancias, adherencia, logs)
   → KnowledgeSnapshot (reglas activas vN, métodos, evidencias, ejercicios)
   → domain.decision.run(ctx, knowledge)  → { needs, priorities, methods,
                                               exercises, doses, plan_skeleton,
                                               explanations[], warnings[] }
   → persistir Proposal (status=PROPOSED) + Recommendation[] + snapshot inputs
 → UI muestra propuesta con "¿Por qué?" en cada elemento
 → Trainer acepta / edita / rechaza  → si acepta: se crea/actualiza TrainingPlan
                                        como borrador o nueva revisión; auditoría
```

### 4.4 Escalabilidad sin sobrearquitectura

| Hoy (1–10 clientes) | Cuando haga falta (cientos/miles) |
|---|---|
| 1 contenedor web + 1 worker + PostgreSQL gestionado | N réplicas web sin estado detrás de balanceador |
| Cola en PostgreSQL (pg-boss) | Misma cola; o migrar a Redis/SQS si el volumen lo exige |
| Informes generados en el worker | Worker dedicado de informes |
| Búsqueda con `pg_trgm` + `unaccent` | Índice externo (Meilisearch/OpenSearch) solo si hace falta |
| Multi-tenant por `organization_id` en todas las tablas + RLS | Igual; particionado de logs por fecha si crece |

### 4.5 Offline y conectividad (cliente)

Los gimnasios tienen mala cobertura. La PWA del cliente **DEBE** permitir completar una sesión sin conexión: la sesión del día se precarga (Service Worker + IndexedDB), los registros se encolan localmente con un `client_mutation_id` (idempotencia) y se sincronizan al recuperar red. Conflictos: el servidor es la verdad; si el entrenador editó la sesión mientras tanto, el registro se conserva y se marca para revisión.

### 4.6 Integraciones futuras (preparadas, no implementadas)

Puerto `ExternalDataSource` + tabla `external_measurements` (fuente, dispositivo, tipo, valor, unidad, timestamp, raw JSON) + `integration_connections` (OAuth tokens cifrados). Garmin, Polar, Apple Health (vía app nativa o exportación), Strava, Chronojump, encoders lineales y plataformas de fuerza entrarán como adaptadores que escriben en `external_measurements` o en `assessment_results`/`set_logs` con `source = device`. No se implementan hasta que exista necesidad (§16, Fase 15+).

---

## 5. Stack tecnológico

### 5.1 Alternativas comparadas

Criterios en orden de prioridad del encargo: mantenimiento, seguridad, escalabilidad, coste, velocidad de desarrollo, UX. Puntuación 1–5 (5 = mejor) — **juicio de diseño, no medida objetiva**.

| Criterio | **A. TypeScript full-stack** (Next.js + PostgreSQL + Drizzle) | B. Django + DRF + React SPA | C. NestJS API + React SPA | D. BaaS (Supabase/Firebase) + React |
|---|---|---|---|---|
| Mantenimiento (1 lenguaje, tipos de extremo a extremo) | 5 | 3 (2 lenguajes) | 4 | 3 (lógica repartida en reglas/funciones del proveedor) |
| Seguridad (control de autorización, auditoría) | 4 | 5 (muy maduro) | 4 | 3 (RLS potente pero fácil de configurar mal; lock-in) |
| Escalabilidad | 4 | 4 | 5 | 4 |
| Coste inicial | 5 | 4 | 4 | 5 |
| Velocidad de desarrollo | 5 | 4 | 3 | 5 |
| UX (PWA, móvil, interactividad del programador) | 5 | 3 | 4 | 4 |
| Motores de dominio compartibles con cliente offline | 5 | 2 | 4 | 3 |
| **Total** | **33** | 25 | 28 | 27 |

Python (B) sería preferible si el núcleo fuera ciencia de datos pesada; no es el caso: los cálculos son deterministas y ligeros (regresiones lineales, estadística descriptiva, reglas). Si en el futuro se necesitan modelos estadísticos avanzados, se añadirá un servicio Python aislado detrás de un puerto.

### 5.2 Stack elegido

| Capa | Elección | Motivo |
|---|---|---|
| Lenguaje | **TypeScript** (strict) en todo el monorepo | Tipos compartidos dominio ↔ API ↔ UI. |
| Monorepo | **pnpm workspaces** + Turborepo | Paquetes con fronteras claras. |
| Web (UI + API) | **Next.js (App Router)**; API REST en *route handlers* bajo `/api/v1` | Un solo despliegue; REST versionado utilizable por futuras apps nativas e integraciones. Las *server actions* no se usan para lógica de dominio (solo como fino adaptador si conviene). |
| Validación / contratos | **Zod** → OpenAPI 3.1 generado | Una sola definición para validar entrada, tipar y documentar (`/docs/API.md`). |
| Base de datos | **PostgreSQL 16+** | Relacional (dominio muy relacional), JSONB para reglas/configuración, RLS, `pg_trgm`, transacciones. |
| ORM / migraciones | **Drizzle ORM** + drizzle-kit | SQL explícito, migraciones versionadas en Git, compatible con RLS. |
| Autenticación | **Módulo propio** (`packages/auth`) sobre primitivas probadas: argon2id, sesiones opacas en BD, 2FA TOTP, reset seguro | Decidido en la Fase 1 (ADR-002 en `ARCHITECTURE.md`); se evaluaron Better Auth y Auth.js. Autohospedado (datos en la UE). |
| Autorización | Capa propia `policy` (RBAC + ámbito) + **RLS de PostgreSQL** como defensa en profundidad | Ver §14. |
| UI | **React** + **Tailwind CSS** + **shadcn/ui (Radix)** | Accesible, sobrio, sin dependencia visual de una librería pesada. |
| Estado servidor en cliente | TanStack Query | Caché, reintentos, soporte offline. |
| Formularios | React Hook Form + Zod | Mismo esquema que el servidor. |
| Gráficos | **Apache ECharts** (barras, líneas, radar) | Rendimiento y radar nativo. |
| PWA / offline | Service Worker (Serwist) + IndexedDB (Dexie) | Ver §4.5. |
| Cola / jobs | **pg-boss** (sobre PostgreSQL) | Sin infraestructura extra (Redis) al inicio. |
| Ficheros | Almacenamiento S3-compatible (UE) | Fotos, siluetas, informes. URLs firmadas de corta duración. |
| Informes | PDF: plantilla HTML → **Playwright/Chromium** en worker · XLSX: **ExcelJS** · CSV: streaming | Un solo diseño HTML para pantalla y PDF. |
| Importación | ExcelJS / Papaparse + validación Zod fila a fila | Previsualización + errores antes de confirmar. |
| Email | Proveedor SMTP/API con región UE | Invitaciones, recordatorios. |
| Tests | **Vitest** (unidad/integración), **Testcontainers** (PostgreSQL real), **Playwright** (E2E + móvil), **fast-check** (property-based en cálculos) | Ver §15. |
| Calidad | ESLint, Prettier, `tsc --noEmit`, dependency-cruiser, `pnpm audit`, Gitleaks | CI en GitHub Actions. |
| Observabilidad | Logs estructurados (pino) sin datos de salud; Sentry (región UE) con scrubbing | |
| Despliegue | Contenedores Docker; PaaS o VPS en región UE; PostgreSQL gestionado UE con PITR | RGPD: datos en el EEE. |

### 5.3 Estructura del repositorio

```
/apps
  /web                 Next.js: (trainer)/…, (client)/…, api/v1/…
  /worker              Jobs: informes, recálculos, notificaciones, importaciones, outbox
/packages
  /domain              Motores puros: assessment, programming, decision,
                       progression, adherence, metrics, explain, units
  /knowledge           Esquemas Zod de reglas/umbrales, DSL de condiciones, evaluador seguro
  /db                  Esquema Drizzle, migraciones, seeds (demo y catálogos), RLS
  /application         Casos de uso + policies + auditoría + eventos
  /contracts           DTOs Zod compartidos API ↔ UI, generación OpenAPI
  /ui                  Componentes de diseño (sistema de diseño)
  /reporting           Plantillas de informes y exportadores
  /config              tsconfig, eslint, etc.
/docs                  Especificación y documentación
/docs/research         Anexos de investigación de la Fase 0
/seed-data             Catálogos curados en JSON/CSV (ejercicios, tests, evidencias, reglas)
```

---

## 6. Base de datos

### 6.1 Principios de modelado

1. **Todas las tablas de negocio** llevan `id` (UUID v7, ordenable), `organization_id`, `created_at`, `updated_at`, `created_by`, `updated_by`; las editables llevan `version` (bloqueo optimista) y, cuando procede, `deleted_at` (borrado lógico) — salvo datos personales sujetos a supresión RGPD, que se **eliminan o anonimizan de verdad** (§14.6).
2. **Catálogos como datos** (objetivos, categorías, patrones, músculos, material, tests, variables, unidades, reglas). Contenido "global" (curado por la plataforma, `organization_id = NULL`, solo lectura) y contenido propio de la organización (puede derivar —*fork*— de uno global, con `derived_from_id`).
3. **Métodos ≠ ejercicios ≠ tipo de contracción**: tablas distintas, unidas por tablas puente (§16 del encargo). *Pliometría* es un `method`; *salto al cajón* es un `exercise`; *isométrico* es un valor de `contraction_types` y también un `method`; *wall sit* es un `exercise`.
4. **Planificado ≠ realizado**: la prescripción (`session_exercises`, `exercise_sets`) nunca se sobrescribe con lo realizado (`set_logs`, `exercise_feedback`). Así se calcula adherencia y respuesta.
5. **Plantilla y plan comparten estructura**: `training_plans.kind ∈ {CLIENT_PLAN, TEMPLATE, PROPOSAL}`; un `TEMPLATE` no tiene `client_id`. Duplicar/adaptar es copiar el árbol.
6. **Unidades SI** en BD (kg, m, s, m/s, cm, N, W); conversión solo en presentación.
7. **Datos de salud** (lesiones declaradas, dolor, cirugías, medicación si algún día se registrara —no previsto—) en tablas separadas con acceso y auditoría reforzados, para poder aplicar permisos, cifrado a nivel de columna y supresión de forma específica.
8. **Nada de EAV generalizado**: columnas tipadas para variables de uso común + JSONB validado por esquema (catálogo `prescription_variables`) para variables raras. Equilibrio entre consultabilidad y extensibilidad.

### 6.2 Mapa de dominios (ER resumido)

```
IDENTIDAD Y ACCESO
organizations 1─< users >─< user_roles >─ roles >─< role_permissions >─ permissions
users 1─1 trainers        users 1─1 clients (opcional: cliente sin cuenta = presencial)
trainers >─< trainer_client_assignments >─< clients
auth_sessions, auth_accounts, verification_tokens (gestionadas por la librería de auth)
consents (cliente × finalidad × versión de texto × fecha × revocación)

CLIENTE
clients 1─1 client_training_profiles (experiencia, años, frecuencia, duración, lugar, preferencias)
clients 1─< client_availability (día semana, franja, duración máx.)
clients >─< equipment  (client_equipment: casa/gimnasio/ambos)
clients 1─< client_goals >─ goals            (is_primary, priority_weight, target_date, sport_id, level)
clients 1─< client_history_entries           (tipo: deportivo | entrenamiento; periodo; descripción)
clients 1─< health_declarations   [SALUD]    (tipo: lesión | cirugía | limitación | otra; zona; fecha; estado
                                              declarado; "requiere_valoración_sanitaria"; texto libre)
clients 1─< exercise_tolerances   [SALUD]    (exercise_id | movement_pattern_id; tolera | no tolera | con restricción; motivo)
clients 1─< screening_responses   [SALUD]    (cuestionario pre-participación, versión, resultado = apto | derivar)

BIBLIOTECA CIENTÍFICA
evidence_sources 1─< evidence_findings >─ outcomes ; findings >─ populations
knowledge_claims >─< claim_evidence >─ evidence_findings      (afirmación ↔ hallazgos que la sostienen)
methods 1─< method_variables (variable + rango de dosis + población + claim_id)
methods >─< method_evidence >─ evidence_findings (rol: apoya | contradice | contexto)
methods >─< method_mechanisms >─ knowledge_claims (tipo epistémico = mecanismo)
methods 1─< method_indications / method_precautions (texto + claim_id opcional)
evidence_reviews (QA científico: revisor, checklist, resultado, fecha)

BIBLIOTECA DE EJERCICIOS
exercises >─< exercise_category_links >─ exercise_categories (jerárquicas: categoría/subcategoría)
exercises >─< exercise_tag_links >─ exercise_tags
exercises >─ movement_patterns ; exercises >─< exercise_muscles (rol: primario|secundario|estabilizador) >─ muscles
exercises >─< exercise_equipment >─ equipment
exercises 1─< exercise_media (tipo: silueta|imagen|vídeo; url/clave; título; canal; verificado_en; estado)
exercises 1─< exercise_progressions (from → to; tipo: progresión|regresión|variante; eje: carga|ROM|estabilidad|…)
exercises >─< exercise_method_links >─ methods
exercises 1─< exercise_cues / exercise_errors / exercise_precautions (ordenadas)
exercises 1─1 exercise_default_doses? (por método/objetivo; opcional)

EVALUACIÓN
assessment_tests (catálogo) 1─< test_reliability_data (población, ICC, CV, SEM, MDC, fuente)
assessment_tests 1─< reference_values (población, edad, sexo, nivel, deporte, n, estadístico, fuente)
assessment_batteries 1─< battery_tests >─ assessment_tests      (plantillas por objetivo)
assessments (evento: cliente, fecha, evaluador, batería, contexto, condiciones)
assessments 1─< assessment_results (test, lado, intentos[], valor_mejor, valor_medio, cv_intra, unidad,
                                     válido, notas, fuente = manual|dispositivo|importado)
assessment_results 1─< derived_metrics (p. ej. 1RM estimado, RSI, fuerza relativa, perfil F-V)

PLANIFICACIÓN (prescripción)
training_plans (kind, client_id?, goal snapshot, inicio, duración_meses 3|6|9|12, estado, revisión)
training_plans 1─< phases 1─< mesocycles 1─< microcycles 1─< sessions 1─< session_blocks
      1─< session_exercises 1─< exercise_sets
plan_revisions (snapshot JSON + diff + autor + motivo)

EJECUCIÓN Y SEGUIMIENTO (realizado)
sessions 1─1 attendance (estado: completada|parcial|no realizada|reprogramada; fecha/hora real; duración; motivo)
sessions 1─< set_logs (session_exercise_id, set_index, carga, reps, RIR, RPE, velocidad, tiempo, distancia, origen)
sessions 1─1 feedback (sesión: sensación, sRPE, fatiga, dolor, motivación, comentario)
session_exercises 1─< exercise_feedback (dificultad, dolor 0-10, comentario)
clients 1─< readiness (diario: sueño, energía, fatiga, estrés, dolor muscular, motivación)
clients 1─< pain_logs [SALUD] (zona, intensidad 0-10, contexto: durante|después|24 h, ejercicio?, comentario)
exercise_substitutions (sesión, ejercicio original, motivo, sugerencias[], elegido, decidido_por)

DECISIÓN
rules (clave, dominio, versión, condición JSON, acción JSON, umbrales, prioridad, evidencia, activa)
rule_sets (versión publicada de un conjunto de reglas; inmutable una vez publicada)
recommendations (cliente, tipo, payload, estado, explicación JSON, inputs_snapshot, rule_set_version, confianza)
recommendation_evidence (recommendation ↔ claims/findings)
alerts (cliente, severidad 🟢🟡🔴, tipo, datos, regla, estado: abierta|vista|resuelta, resuelta_por)
program_proposals (training_plan kind=PROPOSAL ↔ recommendation; estado)
manual_overrides (entidad, campo, valor_propuesto, valor_final, usuario, motivo, recommendation_id?)

TRANSVERSAL
notifications · reports · import_jobs/import_rows · exports · audit_logs (append-only) ·
domain_events (outbox) · external_measurements · integration_connections · files
```

### 6.3 Correspondencia con la lista mínima del encargo

| Tabla pedida | Tabla del diseño | Nota |
|---|---|---|
| users, roles, permissions | `users`, `roles`, `permissions`, `user_roles`, `role_permissions` | `user_roles` con `organization_id` (ámbito). |
| trainers, clients | `trainers`, `clients`, `trainer_client_assignments` | Un cliente puede tener varios entrenadores (principal + colaboradores). |
| goals, client_goals | idem | |
| assessments, assessment_tests, assessment_results | idem + `assessment_batteries`, `battery_tests`, `derived_metrics`, `test_reliability_data` | |
| reference_values | idem | Población explícita obligatoria (§11.6). |
| training_plans, phases, mesocycles, microcycles, sessions, session_exercises, exercise_sets | idem + `session_blocks`, `plan_revisions` | |
| exercise_library | `exercises` | Renombrado por convención; es la misma entidad. |
| exercise_categories, exercise_tags, exercise_media, exercise_progressions | idem + `*_links`, `movement_patterns`, `muscles`, `equipment` | |
| methods, method_evidence, evidence_sources | idem + `evidence_findings`, `knowledge_claims`, `claim_evidence`, `method_variables` | El hallazgo (*finding*) permite enlazar a un resultado concreto de un estudio en una población concreta, no al artículo entero. |
| recommendations, rules | idem + `rule_sets`, `recommendation_evidence`, `alerts`, `program_proposals`, `manual_overrides` | |
| feedback, attendance, readiness, pain_logs | idem + `exercise_feedback`, `set_logs` | |
| notifications, reports, audit_logs | idem | |

### 6.4 Tablas clave (columnas principales)

> Tipos abreviados: `uuid`, `text`, `int`, `num` (numeric), `bool`, `date`, `ts` (timestamptz), `jsonb`, `enum(...)`. Se omiten las columnas comunes de §6.1.

**clients**
| columna | tipo | nota |
|---|---|---|
| user_id | uuid? | Null = cliente sin cuenta (presencial). |
| first_name, last_name | text | |
| birth_date | date | Edad calculada; nunca se almacena edad. |
| sex | enum(female, male, other, undisclosed) | Se usa solo para seleccionar referencias; `undisclosed` desactiva comparaciones por sexo. |
| email, phone | text? | Cifrado de columna para phone. |
| photo_file_id | uuid? | Opcional; consentimiento específico. |
| joined_at | date | |
| status | enum(lead, active, paused, archived) | |
| modality | enum(in_person, online, hybrid) | |

**client_goals**: `client_id`, `goal_id`, `is_primary bool` (índice único parcial: 1 primario activo por cliente), `priority_weight num(0–1)`, `target_date date?`, `sport_id uuid?`, `competitive_level enum?`, `notes`, `status enum(active, achieved, dropped)`.

**evidence_sources** (requisito §6 del encargo)
| columna | tipo | nota |
|---|---|---|
| title, authors (jsonb lista ordenada), year, journal, volume, issue, pages | | |
| doi, pmid, pmcid, url | text? | Únicos cuando existen. |
| study_design | enum(guideline, position_stand, consensus, umbrella_review, systematic_review, meta_analysis, rct, non_randomized_trial, cohort, cross_sectional, case_series, mechanistic, narrative_review, expert_opinion, book, website) | |
| population_summary | text | Resumen; el detalle va en `evidence_findings`. |
| age_range, sex, training_status, sport | campos estructurados | |
| intervention, comparison, outcomes_measured | text | |
| results_summary, limitations | text | |
| practical_application | text | |
| verification_status | enum(verified, verified_with_corrections, unverified, retracted, non_scientific) | Solo `verified*` puede respaldar recomendaciones automáticas. |
| verified_at, verified_by, verification_method | ts, uuid, text | P. ej. "Crossref + resumen PubMed". |
| access | enum(full_text, abstract_only, secondary_source) | Qué se leyó realmente. |

**evidence_findings**: `source_id`, `outcome_id` (fuerza máxima, hipertrofia, CMJ, sprint 10 m…), `population_id`, `intervention`, `comparator`, `effect_metric` (SMD, MD, %Δ, r…), `effect_value`, `ci_low`, `ci_high`, `n_studies`, `n_participants`, `heterogeneity_i2`, `certainty_grade` (si el estudio usa GRADE), `evidence_level enum(A..H)`, `grading_rationale jsonb` (criterios de §10.4), `quote` (texto literal breve del resumen), `epistemic_type enum(fact, inference, hypothesis, opinion)`.

**knowledge_claims**: `statement` (es), `scope` (método/variable/población/objetivo), `epistemic_type`, `evidence_level`, `confidence enum(high, moderate, low, very_low)`, `limitations`, `applicability jsonb` (poblaciones donde aplica / no aplica), `status enum(draft, reviewed, published, deprecated)`, `reviewed_by/at`.

**methods**: `slug`, `name`, `kind enum(training_method, contraction_type, organization_method, autoregulation_method, conditioning_method)`, `definition`, `parent_method_id?` (p. ej. *contrast training* ⊂ *complex training*), `summary_for_trainer`, `summary_for_client` (lenguaje sencillo, opcional).
**method_variables**: `method_id`, `variable_key` (→ `prescription_variables`), `population_id?`, `goal_id?`, `min`, `max`, `typical`, `unit`, `claim_id` (por qué ese rango), `is_default_suggestion bool`.

**exercises**
| columna | tipo | nota |
|---|---|---|
| slug, name, alt_names (text[]) | | Búsqueda con `pg_trgm` + `unaccent`. |
| movement_pattern_id | uuid | Patrón principal (dominante de rodilla, de cadera, empuje H/V, tracción H/V, core antiextensión/antirrotación/antiflexión lateral, transporte, salto, lanzamiento, triple extensión, sprint/COD, locomoción, movilidad, aislamiento…). |
| body_region | enum(lower, upper, trunk, full_body) | |
| laterality | enum(bilateral, unilateral, alternating, asymmetric_load) | |
| planes | enum[] (sagittal, frontal, transverse) | |
| contraction_emphasis | enum[] (concentric, eccentric, isometric, reactive/SSC, mixed) | |
| intended_velocity | enum(slow_controlled, moderate, maximal_intent, ballistic) | |
| level | enum(beginner, intermediate, advanced) | |
| space_required | enum(minimal, small, large, track/field) | |
| technical_complexity | int 1–5 | |
| axial_load | enum(none, low, moderate, high) | Útil para sustituciones y restricciones declaradas. |
| impact_level | enum(none, low, moderate, high) | Pliometría/sprints. |
| description, setup, execution | text | Explicación para el cliente (corta) y para el entrenador (larga). |
| prescription_profile_id | uuid | Qué variables mostrar por defecto (§12.5). |
| supports_vbt | bool | Solo ejercicios donde la velocidad es medible y significativa (§12.6). |
| status | enum(draft, published, archived) | |

**exercise_media**: `exercise_id`, `type enum(silhouette, image, video)`, `provider enum(upload, youtube, vimeo, url)`, `url_or_key`, `title`, `channel`, `language`, `verified_at`, `verified_by`, `status enum(pending_verification, verified, broken, replaced)`, `is_primary`. Regla: si no hay vídeo verificado la UI muestra **"Vídeo pendiente de verificación"**.

**exercise_progressions**: `from_exercise_id`, `to_exercise_id`, `relation enum(progression, regression, variant)`, `axes enum[] (load, reps, volume, effort, rom, complexity, stability, unilaterality, velocity, impact)`, `notes`. Grafo dirigido; se impide crear ciclos de progresión/regresión inconsistentes.

**assessment_tests**: `slug`, `name`, `category enum(strength, power, speed, cod, agility, endurance, mobility, body_composition, functional, balance, questionnaire)`, `purpose`, `target_populations`, `protocol` (markdown estructurado: preparación, calentamiento, instrucciones, criterios de validez), `equipment[]`, `unit`, `value_type enum(number, time, distance, angle, count, scale)`, `better_direction enum(higher, lower, target_range)`, `default_attempts int`, `aggregation enum(best, mean, mean_of_best_n, last)`, `sided bool` (bilateral/izquierda/derecha), `derived_metric_formulas jsonb` (ids de fórmulas del dominio), `limitations`, `source_ids[]`, `status`.

**test_reliability_data**: `test_id`, `population_id`, `measurement_method` (plataforma, alfombra, app, células…), `icc`, `icc_model`, `cv_percent`, `sem`, `sem_unit`, `mdc95`, `swc`, `source_id`. Puede haber varias filas; la UI usa la más aplicable a la población del cliente y avisa si ninguna coincide.

**reference_values** (requisito §33)
| columna | nota |
|---|---|
| test_id, variable, unit | |
| population_id | Obligatorio. Población = {tipo (general, adultos mayores, atletas, futbolistas, resistencia…), país/región, nivel, deporte, posición?}. |
| age_min, age_max, sex | |
| sample_size | |
| statistic_type | enum(mean_sd, median_iqr, percentiles, cutoff, category_bands) |
| values jsonb | p. ej. `{mean: , sd: }` o `{p10:…, p50:…, p90:…}` o bandas. |
| measurement_method | Comparar solo si coincide (salto en alfombra ≠ plataforma). |
| source_id | Obligatorio; si no hay fuente verificada **no se crea la referencia**. |
| applicability_notes | |

**training_plans**: `kind enum(CLIENT_PLAN, TEMPLATE, PROPOSAL)`, `client_id?`, `name`, `primary_goal_id`, `secondary_goal_ids[]`, `start_date`, `duration_months enum(3,6,9,12)` + `end_date`, `sessions_per_week 2–5` (por defecto; las fases pueden variarlo), `periodization_model enum(linear, block, undulating_daily, undulating_weekly, concurrent, flexible, custom)` (*descriptivo, no impuesto*), `status enum(draft, proposed, active, completed, archived)`, `current_revision`, `based_on_template_id?`, `proposal_of_plan_id?`, `published_to_client_at?`.

**phases** (`name`, `objective`, `order`, `start_week`, `end_week`, `emphasis jsonb` = pesos por cualidad), **mesocycles** (`order`, `weeks`, `focus`, `notes`, `assessment_planned bool`), **microcycles** (`week_index`, `week_type enum(introduction, progression, peak, deload, test, taper, transition, competition)`, `relative_volume num?`, `relative_intensity num?`).

**sessions**: `microcycle_id`, `client_plan_id`, `day_label` (A/B/C…), `scheduled_date?`, `scheduled_time?`, `location enum(in_person, online, home, gym)`, `title`, `objective`, `estimated_duration_min`, `notes_for_client`, `notes_for_trainer`, `published bool`.

**session_blocks**: `session_id`, `order`, `type enum(warm_up, activation, power_potentiation, main_strength, hypertrophy, plyometric, sprint_cod, conditioning, core, mobility, cool_down, custom)`, `organization enum(straight_sets, superset, triset, circuit, cluster, contrast, complex, emom, amrap, intervals)`, `rounds?`, `rest_between_rounds_s?`, `notes`.

**session_exercises** (la **prescripción**): `block_id`, `exercise_id`, `order`, `pairing_label` (A1/A2…), `method_ids[]`, columnas tipadas: `sets`, `reps_min`, `reps_max`, `reps_per_cluster`, `intra_cluster_rest_s`, `duration_s`, `distance_m`, `contacts`, `load_kg`, `load_pct_1rm`, `load_basis_metric_id?` (qué 1RM/e1RM se usa), `rir_min`, `rir_max`, `rpe_target`, `effort_character` (texto/enum: p. ej. "8 de 12 posibles"), `velocity_target_mps`, `velocity_loss_pct`, `tempo` (`ecc-pause-con-pause`, p. ej. `3-1-X-0`), `rest_s`, `rom` (enum: full, partial_lengthened, partial_shortened, specified), `intensity_note`, `side enum(both, left, right, each)`, `band_tension jsonb?` / `chain_load_kg?` (resistencias acomodadas), `extra jsonb` (validado contra `prescription_variables`), `progression_rule_id?`, `notes_for_client`, `coach_notes`, `source enum(manual, template, proposal)`, `recommendation_id?`.

**exercise_sets** (opcional, cuando las series difieren entre sí): `session_exercise_id`, `set_index`, mismas variables que arriba en versión por serie (p. ej. pirámides, top set + back-off, clusters).

**set_logs** (lo **realizado**): `session_id`, `session_exercise_id`, `exercise_id_performed` (puede diferir por sustitución), `set_index`, `load_kg`, `reps`, `rir`, `rpe`, `mean_velocity_mps`, `peak_velocity_mps`, `duration_s`, `distance_m`, `side`, `completed bool`, `logged_by` (cliente/entrenador), `logged_at`, `client_mutation_id` (idempotencia offline), `source enum(manual, device, import)`.

**attendance**: `session_id` (único), `status enum(completed, partial, missed, rescheduled, cancelled_by_trainer)`, `performed_date`, `start_time`, `duration_min`, `reason_code enum(illness, injury_or_pain, work, travel, fatigue, motivation, schedule, other)?`, `reason_text?`, `recorded_by`.

**rules**: `key`, `domain enum(screening, needs, prioritization, method_selection, exercise_selection, dosing, progression, monitoring_alert, substitution)`, `version`, `description`, `condition jsonb` (DSL §13.4), `action jsonb`, `parameters jsonb` (umbrales editables), `priority`, `evidence_claim_ids[]`, `evidence_level`, `limitations`, `applies_to_populations`, `enabled`, `scope enum(global, organization)`, `rule_set_id`.

**recommendations**: `client_id`, `type enum(need, priority, method, exercise, dose, plan_proposal, progression, deload, substitution, reassessment, referral_notice)`, `payload jsonb`, `status enum(proposed, accepted, accepted_with_changes, rejected, superseded, expired)`, `explanation jsonb` (estructura §13.6), `inputs_snapshot jsonb`, `rule_set_version`, `confidence enum(high, moderate, low)`, `decided_by`, `decided_at`, `decision_reason?`.

**audit_logs** (append-only; sin UPDATE/DELETE por permisos de BD): `occurred_at`, `actor_user_id`, `actor_role`, `organization_id`, `action` (create/update/delete/view_sensitive/export/login/override/accept_recommendation…), `entity_type`, `entity_id`, `client_id?`, `changes jsonb` (`[{field, before, after}]`), `reason?`, `request_id`, `ip_hash`, `user_agent_hash`. Ejemplo exigido: *Entrenador · 12/10/2026 · Sentadilla: carga 80 kg → 82,5 kg*.

### 6.5 Índices y restricciones relevantes

- Únicos: `(organization_id, slug)` en catálogos; `evidence_sources(doi)`, `(pmid)`; `attendance(session_id)`; `set_logs(client_mutation_id)`; 1 objetivo primario activo por cliente (índice parcial).
- Búsqueda: GIN `pg_trgm` sobre `exercises.name`/`alt_names` (con `unaccent`).
- Consultas frecuentes: `sessions(client_plan_id, scheduled_date)`, `set_logs(session_id)`, `alerts(organization_id, status, severity)`, `audit_logs(entity_type, entity_id, occurred_at)`, `assessment_results(assessment_id, test_id)`.
- `CHECK`: RIR 0–10, RPE 1–10 (paso 0,5), dolor 0–10, `reps_min ≤ reps_max`, `duration_months ∈ {3,6,9,12}`, `sessions_per_week` 1–7 (UI propone 2–5).
- RLS en todas las tablas con `organization_id` + políticas específicas para `CLIENT` (§14.3).

### 6.6 Datos derivados y su recálculo

Las métricas (e1RM, adherencia, carga semanal, series efectivas por grupo muscular, ratio tracción/empuje, contactos semanales…) se **calculan en el dominio** y se materializan en tablas de lectura (`client_metrics_daily`, `plan_volume_summary`) por el worker tras eventos. La fuente de verdad son siempre los registros base; las tablas derivadas pueden regenerarse.

---

## 7. Módulos

| Módulo | Responsabilidad | Depende de | Fase |
|---|---|---|---|
| `auth` | Registro por invitación, login, sesiones, 2FA staff, recuperación, bloqueo por intentos | — | 1 |
| `iam` | Organizaciones, usuarios, roles, permisos, asignación entrenador↔cliente, políticas | auth | 1 |
| `clients` | Ficha, perfil de entrenamiento, disponibilidad, equipamiento, objetivos, historial, declaraciones de salud, cribado, consentimientos | iam | 1–2 |
| `library` | Ejercicios, taxonomías, media, progresiones, sustituciones (búsqueda de alternativas) | iam | 3 |
| `science` | Fuentes, hallazgos, afirmaciones, métodos, poblaciones, QA científico | iam | 4 |
| `assessments` | Catálogo de tests, fiabilidad, referencias, baterías, evaluaciones, resultados, métricas derivadas, comparación | library (material), science (fuentes) | 5 |
| `planning` | Planes, plantillas, fases→series, revisiones, publicación al cliente, calendario | library, clients | 6 |
| `sessions` | Sesión del día, ejecución, registro de series, sustituciones en vivo, offline | planning | 7 |
| `tracking` | Asistencia, adherencia, feedback, readiness, dolor, alertas de monitorización | sessions | 8 |
| `dashboards` | Vistas agregadas entrenador/cliente | tracking, assessments | 9 |
| `decisions` | Decision Engine: necesidades, prioridades, métodos, ejercicios, dosis, explicaciones; gestión de reglas | todos los de dominio + science | 10 |
| `programming` | Programming Engine: generar/adaptar propuestas de plan, progresión automática propuesta | decisions, planning | 11 |
| `reports` | Informes PDF/XLSX/CSV, exportaciones | todos (lectura) | 12 |
| `imports` | Importación validada CSV/XLSX (clientes, ejercicios, evaluaciones, referencias) | módulos destino | 12 |
| `notifications` | In-app, email; (push web más adelante) | — | 7–8 |
| `audit` | Auditoría append-only, overrides, consultas de historial | — | 1 (transversal) |
| `privacy` | Consentimientos, exportación de datos del interesado, supresión/anonimización, retención | iam, audit | 1 + 13 |
| `integrations` | Puertos para dispositivos/plataformas externas | — | Futuro |

Cada módulo expone: **casos de uso** (application), **contratos** (Zod/OpenAPI), **policies** (quién puede), **eventos** que emite/consume y **tests**. Ningún módulo lee tablas de otro directamente; usa su servicio de consulta.

---

## 8. Flujo del entrenador

### 8.1 Mapa de navegación (escritorio/tablet)

```
[Hoy] [Clientes] [Calendario] [Programas] [Bibliotecas ▾] [Alertas •3] [Informes]      [⚙]
                                            ├ Ejercicios
                                            ├ Métodos
                                            ├ Evidencia
                                            ├ Tests y referencias
                                            └ Reglas (ADMIN)
```

### 8.2 Dashboard "Hoy" (§24 del encargo)

```
┌ Clientes activos 10 ┐┌ Sesiones hoy 6 (2 hechas) ┐┌ Adherencia 28 d: 86 % ┐┌ Evaluaciones pendientes 2 ┐
└─────────────────────┘└───────────────────────────┘└────────────────────────┘└───────────────────────────┘
ALERTAS (ordenadas por severidad y antigüedad)
 🔴 Laura M. · dolor 6/10 en "Sentadilla búlgara" 2 sesiones seguidas → Ver · Sustituir · Marcar revisado
 🟡 Pablo R. · sRPE medio +2 sobre lo previsto (últimas 3) → Ver propuesta de ajuste
 🟡 Ana G. · adherencia 58 % (4 semanas)
SESIONES DE HOY                         FEEDBACK RECIENTE
 09:00 Carlos (presencial) ▶ Abrir      Marta · "Muy bien, el peso muerto más fácil" sRPE 6
 18:30 Laura (online) · pendiente        …
```

Principios: la información sale ordenada por **lo que requiere acción**; cada alerta lleva sus datos y un enlace a la acción; nada de gráficos decorativos.

### 8.3 Ficha de cliente (pestañas)

`Resumen` (objetivo, fase actual, próxima sesión, adherencia, alertas, últimas métricas clave con tendencia) · `Perfil` (datos, entrenamiento, disponibilidad, material, preferencias) · `Salud declarada` (acceso restringido y auditado) · `Objetivos` · `Evaluaciones` (lista, nueva, comparar) · `Necesidades` (salida del Decision Engine con "¿Por qué?") · `Programa` (plan activo, propuestas, histórico de revisiones) · `Registro` (sesiones realizadas, series, feedback) · `Evolución` (gráficos) · `Informes` · `Historial` (auditoría del cliente).

### 8.4 Flujo principal (§67 del encargo, pasos 1–26)

| Paso | Pantalla / acción | Sistema |
|---|---|---|
| 1 Crear cliente | Asistente en 4 pasos: datos → entrenamiento/disponibilidad/material → objetivos → historial y declaraciones + cuestionario de cribado | Valida; si cribado = derivar → banner permanente "Requiere valoración por profesional sanitario" y bloqueo de propuestas automáticas de intensidad alta hasta que el entrenador registre que se ha resuelto. Envía invitación al cliente (opcional). |
| 2 Objetivos | Elegir principal + secundarios, pesos, fecha, deporte | Sugiere batería de evaluación según objetivo(s). |
| 3 Evaluar | Batería sugerida editable; modo "en sala" (entrada rápida por intentos) | Calcula mejor/media/CV intra-sesión, métricas derivadas, avisos de validez (p. ej. CV alto entre intentos). |
| 4 Perfil | Vista de resultados vs. referencia aplicable (si existe) y vs. evaluación previa (con MDC) | Nunca muestra z-scores sin referencia de población coincidente. |
| 5 Necesidades | Lista priorizada de necesidades con "¿Por qué?" | Decision Engine (Fase 10); antes de la Fase 10, el entrenador las escribe a mano. |
| 6–9 Programa | Elegir: desde cero / desde plantilla / duplicar plan / generar propuesta. Línea temporal (fases y mesociclos) → semanas → sesiones | Programming Engine propone esqueleto; todo editable. |
| 10–12 Ejercicios y dosis | Editor de sesión: bloques, ejercicios (búsqueda con filtros), variables relevantes, explicación, silueta, vídeo, notas | Validaciones (p. ej. RIR fuera de rango, ejercicio no tolerado, material no disponible) como avisos no bloqueantes. |
| 13 Enviar | "Publicar al cliente" (por semana o plan) | Notificación al cliente; versión publicada congelada. |
| 17–20 Seguimiento | Registro en tiempo real, adherencia, alertas | Tracking + reglas de monitorización. |
| 21–23 Revisar y modificar | Alertas → propuesta de ajuste → aceptar/editar/rechazar | Override auditado; revisión de plan. |
| 24–26 Reevaluar, comparar, informe | Nueva evaluación → comparación antes/después/referencia → informe PDF | Cambios interpretados con MDC/SWC cuando existan. |

### 8.5 Editor de sesión (pieza crítica de UX)

- Tabla densa tipo hoja (navegable con teclado: Tab, flechas, Enter), **pero con significado**: cada fila es un ejercicio con su perfil de prescripción; solo se muestran las columnas del perfil (§12.5); botón "＋ variable" para añadir otras.
- Edición masiva: aplicar cambio a "todas las semanas del mesociclo" / "semanas 2–3" con previsualización.
- Progresión semanal declarativa: "+2,5 kg/semana si RIR registrado ≥ objetivo", "doble progresión 8–12", "−1 serie en descarga" → genera los valores de las semanas y los marca como *derivados* (editable individualmente).
- Panel lateral contextual: ficha del ejercicio, alternativas, evidencia del método, historial del cliente con ese ejercicio (última carga, e1RM, dolor reportado).
- Indicadores en vivo: duración estimada, series por grupo muscular/semana (primario 1, secundario 0,5 — **convención configurable**, ver §18), ratio tracción/empuje, contactos pliométricos, distribución por cualidad. Son **descriptivos**; los umbrales que generan avisos son configurables.

---

## 9. Flujo del cliente

### 9.1 Navegación (PWA móvil, 4 pestañas)

`Hoy` · `Calendario` · `Progreso` · `Perfil`

### 9.2 Pantalla "Hoy" (§25)

```
┌──────────────────────────────┐
│ Martes 14 oct                │
│ ENTRENAMIENTO DE HOY         │
│ Fuerza · Día B · ~55 min     │
│ ┌──────────────────────────┐ │
│ │      EMPEZAR  ▶          │ │  (botón grande, zona del pulgar)
│ └──────────────────────────┘ │
│ ¿Cómo estás hoy? 😴 sueño ▢▢▢ │  (readiness opcional, 3 toques)
│ 1 Calentamiento   8 min      │
│ 2 Sentadilla goblet 3×10 RIR2│
│ 3 Remo con mancuerna …       │
└──────────────────────────────┘
```

### 9.3 Reproductor de sesión

Un ejercicio por pantalla:

```
┌──────────────────────────────┐
│ 2/6  SENTADILLA GOBLET   ⓘ ▶ │ ← ⓘ explicación corta · ▶ vídeo/silueta (hoja inferior)
│ 3 series × 10 · deja 2 en    │
│ reserva · descanso 90 s      │ ← lenguaje natural: "4×8 dejando aprox. 2 repeticiones en reserva"
│ Última vez: 20 kg × 10       │
│ ┌────┬──────────┬────┬─────┐ │
│ │ S1 │ − 22 kg +│ 10 │ RIR │ │ ← carga precargada (prescrita o sugerida); ± incrementos configurables
│ │ ✓  │          │    │0 1 2 3 4+│ ← RIR con chips grandes; RPE si el entrenador lo eligió
│ ├────┼──────────┼────┼─────┤ │
│ │ S2 │ …                    │ │
│ └──────────────────────────┘ │
│ [ No puedo hacer este ejercicio ]│
│ ⏱ Descanso 1:30  (auto al ✓)  │
│ ┌──────────────────────────┐ │
│ │      SIGUIENTE  →        │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

- Registrar una serie como prescrita = **1 toque** (✓). Modificar carga/reps = 1–2 toques extra.
- "No puedo hacer este ejercicio" → motivo (dolor · falta de material · demasiado difícil · falta de espacio · prefiero otro · fatiga) → si hay alternativas **pre-aprobadas por el entrenador** se ofrecen; si no, se registra y se notifica al entrenador. Si el motivo es dolor: mensaje fijo "Si el dolor persiste o es intenso, consulta con un profesional sanitario" y alerta al entrenador.
- **El cliente nunca ve** niveles de evidencia, reglas, z-scores ni jerga; ve instrucciones, cues breves y su progreso.

### 9.4 Completar sesión (§22)

Botón **COMPLETAR SESIÓN** → hoja con 5 controles grandes: esfuerzo de la sesión (escala CR-10 con anclas verbales), fatiga, dolor/molestias (no / sí → zona en silueta corporal + 0–10), motivación, comentario (opcional, dictado por voz del teclado). Si quedó a medias: "Guardar como parcial" con motivo.

### 9.5 Progreso (cliente)

Solo lo que el entrenador marque como visible: adherencia (racha y %), evolución de 3–5 métricas elegidas (p. ej. carga en ejercicios clave, CMJ, perímetro), hitos. Mensajes en positivo, sin comparaciones con otras personas.

### 9.6 Experiencia presencial

En sesiones presenciales el entrenador abre el mismo reproductor en tablet ("modo sala") y registra por el cliente; el registro queda con `logged_by = trainer`.

### 9.7 Sistema visual

- Paleta sobria: neutros (blanco/gris carbón) + **un** color de acento deportivo; semáforo 🟢🟡🔴 reservado exclusivamente a estados/alertas.
- Tipografía sans de alta legibilidad, cifras tabulares en tablas y registros.
- Siluetas: fondo blanco, figura negra, minimalista, material visible, postura correcta; SVG reemplazable por ejercicio (`exercise_media.type = silhouette`).
- Modo oscuro opcional (útil en el gimnasio). Animaciones solo funcionales (feedback de guardado, temporizador).
- Objetivos táctiles ≥ 48 px en cliente; uso con una mano; contraste AA.

---

## 10. Sistema científico

### 10.1 Objetivo

Que **toda** recomendación importante pueda rastrearse:

```
RECOMENDACIÓN  "Priorizar fuerza máxima (2 sesiones/sem, sentadilla 3×4-6 @ RIR 2)"
   ↓ regla       needs.relative_strength_low.v3   (umbral configurable, nivel F)
   ↓ método      Entrenamiento de fuerza con cargas altas
   ↓ variable    carga ≥ 80 % 1RM · 2–3 series · ≥ 2 sesiones/sem
   ↓ afirmación  CLM-0xx "Las cargas altas producen mayores ganancias de 1RM que las bajas en adultos sanos" (HECHO/INFERENCIA)
   ↓ hallazgos   EV-STR-001 (ACSM 2026, overview of reviews) · EV-STR-012 (Schoenfeld 2017, MA)
   ↓ artículos   DOI / PMID / fecha de verificación / qué se leyó (resumen o texto completo)
```

### 10.2 Entidades y responsabilidades (Scientific Knowledge Base)

| Entidad | Qué es | Ejemplo |
|---|---|---|
| `evidence_sources` | Documento citado (artículo, guía, libro, web) con metadatos y **estado de verificación** | ACSM 2009 Position Stand |
| `evidence_findings` | Un resultado concreto de esa fuente, en una población y un desenlace concretos, con su tamaño de efecto e incertidumbre | "Halterofilia vs. fuerza tradicional en CMJ: ESdiff 0,72" (Berton 2018) |
| `knowledge_claims` | Afirmación del sistema, redactada por nosotros, con tipo epistémico, nivel, confianza, limitaciones y aplicabilidad; se apoya en 1..N hallazgos | "La halterofilia es una opción eficaz pero no imprescindible para mejorar el salto; la pliometría da resultados similares" |
| `methods` | Método/categoría de entrenamiento con definición, mecanismos (claims tipo E), indicaciones, precauciones, variables y rangos de dosis | Pliometría · Isométricos · Contrast training · Resistencias acomodadas |
| `populations` | Taxonomía de poblaciones para aplicabilidad | adultos sanos no entrenados; adultos entrenados en fuerza; mayores ≥ 65; jóvenes (por maduración); futbolistas masculinos adultos; corredores de fondo… |
| `outcomes` | Desenlaces | 1RM, hipertrofia (CSA/grosor), CMJ, sprint 10 m, COD, VO₂max, economía de carrera, función física, dolor tendinoso… |
| `evidence_reviews` | Registro del QA científico de una fuente/afirmación | revisor, checklist, resultado, fecha |

**Hecho / inferencia / hipótesis / opinión**: el hallazgo es siempre HECHO (lo medido). La afirmación que aplica el hallazgo a nuestra población es INFERENCIA, salvo que la población coincida. Mecanismos sin desenlace → HIPÓTESIS (nivel E). Lo del entrenador → OPINIÓN (G) y se muestra como tal.

### 10.3 Ciclo de vida del conocimiento

```
borrador → verificación de fuente (DOI/PMID/metadatos/quién lo leyó y qué leyó)
        → extracción de hallazgos (población, desenlace, efecto, IC, n)
        → redacción de afirmación + gradación con criterios (§10.4)
        → QA científico (§10.6)  → publicada  → (revisión periódica / obsoleta)
```

Solo afirmaciones **publicadas** basadas en fuentes `verified*` pueden alimentar reglas automáticas. Las de nivel F/G pueden usarse si la regla lo declara y la UI lo muestra.

### 10.4 Gradación con criterios explícitos (no puntuación arbitraria)

El nivel no se teclea: se **deriva** de un formulario estructurado inspirado en GRADE (Guyatt et al.; *la fuente de GRADE debe cargarse verificada en Fase 4* `[REQUIERE VERIFICACIÓN]`), guardado en `grading_rationale`:

| Dimensión | Pregunta | Efecto |
|---|---|---|
| Diseño de partida | ¿Guía/consenso basado en RS? ¿MA de ECA? ¿ECA? ¿observacional? ¿mecanístico? ¿opinión? | Nivel inicial: MA/RS de ECA o guía basada en RS → A; ECA → B; no aleatorizado/observacional → C; mecanístico → E; práctica/consenso sin RS → F; opinión → G |
| Riesgo de sesgo | ¿Limitaciones serias declaradas (sin grupo control, ciego imposible, abandono)? | Baja un nivel |
| Inconsistencia | ¿Heterogeneidad alta (I² > 50 % o resultados divergentes)? | Baja un nivel; si hay fuentes de calidad similar con resultados opuestos → **D** |
| Indirección (aplicabilidad) | ¿Población/intervención/desenlace distintos a los del uso previsto? | Baja un nivel **para esa población** (se calcula por población, ver §10.5) |
| Imprecisión | ¿IC amplio que cruza el no-efecto, n pequeño? | Baja un nivel |
| Sesgo de publicación | ¿Detectado/declarado? | Baja un nivel |
| Verificación | ¿Fuente verificada? ¿Qué se leyó (texto completo / resumen / secundaria)? | Si no verificada → **H** sin excepción |

La UI muestra siempre la letra **junto con** población, aplicabilidad, limitaciones e incertidumbre (requisito §66).

### 10.5 Aplicabilidad poblacional (anti-extrapolación)

Cada hallazgo tiene `population_id`; cada cliente se mapea a un vector de población (edad, sexo, estado de entrenamiento, deporte, nivel, estado madurativo si < 18). Para cada recomendación se calcula **coincidencia** por dimensión:

| Dimensión | Coincide | Parcial | No coincide |
|---|---|---|---|
| Edad | dentro del rango del estudio | ±10 años | fuera (p. ej. estudio en ≥ 65, cliente 22) |
| Estado de entrenamiento | igual | adyacente | opuesto |
| Deporte/contexto | igual | familia (deporte de equipo) | distinto |
| Sexo | incluido | estudio mayoritariamente de otro sexo | excluido |

Si alguna dimensión "no coincide", la recomendación muestra el aviso: *"Este estudio se realizó en adultos mayores, pero se está aplicando a un atleta joven"* y la confianza baja. El Scientific QA (§10.6) lo detecta automáticamente.

### 10.6 Scientific QA (agente/revisión)

Implementación en dos partes:

1. **Validadores automáticos** (CI + al publicar): DOI con formato válido y único; PMID numérico; metadatos completos; fuente `verified` para cualquier afirmación usada por reglas; hallazgos con población y desenlace; ninguna `reference_value` sin fuente ni población; detección de extrapolación (§10.5) en cada regla publicada; afirmaciones que contengan verbos causales ("previene", "causa", "garantiza") sobre desenlaces clínicos → bloqueo hasta revisión; detección de afirmaciones con número sin hallazgo enlazado.
2. **Checklist humano** (`evidence_reviews`): ¿la cifra coincide con el resumen/texto? ¿la interpretación respeta población y diseño? ¿se convierte una correlación en causalidad? ¿un mecanismo en resultado clínico? ¿se presenta prevención de lesiones como hecho? ¿hay evidencia contraria registrada?

Una **verificación automática por API** (Crossref/PubMed) se añadirá cuando la red lo permita; en Fase 0 no fue posible (§18.5).

### 10.7 Biblioteca de métodos (contenido inicial)

Cada método: definición · mecanismos (E) · evidencia (hallazgos enlazados) · población · indicaciones · precauciones · variables y dosis (rangos configurables por población/objetivo) · progresión · ejemplos (ejercicios enlazados) · bibliografía. Estado de la evidencia **verificada en Fase 0** (detalle y IDs en `/docs/research/`):

| Método | Síntesis (resumen de los anexos) | Nivel orientativo | Notas de aplicabilidad |
|---|---|---|---|
| Fuerza (cargas altas) | Mayores ganancias de 1RM con cargas altas; ≥ 2 sesiones/sem; 2–3 series; rendimientos decrecientes del volumen más marcados que en hipertrofia (EV-STR-001, -007, -012) | A/B | Adultos sanos; muchos estudios en hombres jóvenes. |
| Hipertrofia | Dosis-respuesta positiva del volumen con rendimientos decrecientes; con volumen igualado la frecuencia apenas importa; el fallo no es necesario pero la proximidad al fallo importa; amplio espectro de cargas válido si el esfuerzo es alto (EV-STR-006…012) | A/B | Muestras mayoritariamente hombres jóvenes (EV-STR-007: 79 % hombres). |
| Pliometría | Mejora salto, con transferencia a sprint/COD en sanos y deportistas (EV-PWR-001…005); dosis óptima incierta | A/B (salto), B/C (otras) | Pocos datos en mujeres fuera del fútbol, mayores y clínicos. |
| PAPE / complex / contrast | Efecto agudo pequeño en salto (ES ≈ 0,29) y moderado en sprint (≈ 0,51), mayor en sujetos fuertes (EV-PWR-007); efecto crónico complex vs. contrast sin cifras verificadas | B (agudo), C (crónico) | Desactivado por defecto en principiantes. |
| Halterofilia y derivados | Mejor que fuerza tradicional para CMJ (ESdiff 0,72), similar a pliometría (EV-PWR-011…013) | B | Opcional, condicionada a competencia técnica. |
| Isométricos | Mejoran fuerza e hipertrofia; adaptación tendinosa con cargas altas ≥ 8 semanas (EV-PWR-014…016). Analgesia en tendinopatía: **contradictoria** (EV-PWR-017 vs -018) | B / **D** (dolor) | La tendinopatía es ámbito clínico: fuera de prescripción automática. |
| Excéntricos / sobrecarga excéntrica / flywheel | Estímulo potente de fuerza y arquitectura (EV-PWR-019); superioridad del flywheel no verificada (EV-PWR-020) | B / C | — |
| Nordic hamstring | Reducción de riesgo estimada RR 0,49 (EV-PWR-021) frente a reanálisis "inconcluso" (EV-PWR-022) | **D** (magnitud) | Comunicar "puede reducir", nunca "reduce a la mitad". |
| Sprint / aceleración | Sprint libre como núcleo; resistido no supera al libre con volumen igualado (EV-PWR-027); fuerza del tren inferior asociada a mejora de sprint (EV-PWR-024) | B | Mayoría hombres jóvenes de deportes de equipo. |
| COD / agilidad | COD preplanificado ≠ agilidad reactiva (EV-PWR-028); déficit de COD (EV-PWR-029) | B (conceptual) | — |
| Resistencias acomodadas (bandas/cadenas) | Ver §18.3: superioridad para fuerza máxima como **añadido** a la barra con cargas ≥ 80 % en entrenados; sin superioridad como medio aislado; buen respaldo en mayores | B/C | Según el manual aportado; pendiente verificación directa de sus fuentes (QA §18.4). |
| Core, movilidad/estiramientos, resistencia + fuerza (concurrente), perfil F-V, RSA, fuerza en deportes de equipo | **No verificados en Fase 0** (límite de búsqueda y bloqueo de red) | H hasta verificar | No se implementan reglas numéricas basadas en ellos hasta verificarlos (§19). |

### 10.8 Lo que el sistema nunca dirá

- "El algoritmo dice que debes hacer X" → siempre "Se propone X porque…".
- "Este ejercicio previene lesiones" como hecho.
- Un mecanismo ("aumenta la rigidez del tendón") presentado como resultado clínico ("evita tendinopatías").
- Una correlación ("más fuerza se asocia a más velocidad") presentada como causa garantizada.
- Un valor normativo de una población aplicado a otra.

---

## 11. Sistema de evaluación (Assessment Engine)

### 11.1 Principios

1. **La evaluación depende del objetivo** (y del contexto): no existe una batería universal. El motor propone una batería a partir de objetivo(s), población, material, tiempo y experiencia; el entrenador la edita.
2. **Cribado antes de evaluar**: cuestionario pre-participación (p. ej. PAR-Q+ y/o algoritmo ACSM de cribado — fuentes en `/docs/research/research_assessment.md`, verificación parcial) antes de cualquier test máximo.
3. **Trazabilidad de cada dato**: test, versión del protocolo, dispositivo/método, evaluador, condiciones, intentos brutos, regla de agregación.
4. **Las estimaciones se etiquetan como estimaciones con su error** (p. ej. 1RM estimado por perfil carga-velocidad: error típico de estimación ≈ 9,8 % y tendencia a sobreestimar — Greig 2023, verificado vía resumen).
5. **El cambio se interpreta contra el error de medida** (TE/SWC/MDC), no a ojo.
6. **Nunca z-scores ni percentiles sin referencia de población y protocolo coincidentes.**
7. **Nada de predicción de lesión** a partir de cargas, ACWR o asimetrías.
8. **Extensible sin código**: un test nuevo es una fila de `assessment_tests` + (opcional) fórmula derivada registrada en el dominio.

### 11.2 Modelo de un test (ficha)

`nombre · categoría · objetivo · poblaciones · protocolo (versión) · material · unidad · nº intentos · agregación (mejor/media/media de los n mejores) · lateralidad · variabilidad intra-sesión (CV de intentos) · fiabilidad (ICC, CV, SEM, MDC por población y método) · valores de referencia (con población) · fórmulas derivadas · fuente(s) · limitaciones`.

Si no hay fiabilidad publicada aplicable → el sistema muestra **"Error de medida desconocido"** y no emite veredicto de cambio (sí muestra la diferencia). Si no hay referencia → **"Referencia insuficiente"**.

### 11.3 Catálogo inicial (Fase 5)

44 fichas preparadas en el anexo (`TST-001…TST-044`), con estado de verificación por campo. Resumen:

| Categoría | Tests |
|---|---|
| Fuerza | 1RM directo · 1RM estimado por repeticiones (ecuaciones Brzycki/Epley/O'Connor — **coeficientes pendientes de verificación en fuente primaria**) · 1RM estimado por perfil carga-velocidad · IMTP · dinamometría de prensión · dinamometría manual (HHD) · fuerza relativa (1RM/masa) · fuerza unilateral |
| Potencia | CMJ · SJ · CMJ unilateral · Drop jump RSI · RSI modificado · potencia/potencia relativa (estimada) · perfil F-V en salto (*opcional, avanzado; ver §18.2 sobre su controversia*) |
| Velocidad | 5/10/20/30 m con splits · velocidad máxima (lanzado) |
| COD/agilidad | 505 y 505 modificado · déficit de COD · T-test y Modified Agility T-test · Illinois (*fuente pendiente*) · pruebas específicas configurables |
| Resistencia | Yo-Yo IR1 · 30-15 IFT · Cooper (*fuente pendiente*) · 6MWT |
| Funcional/salud | 30-s chair stand · 5× sit-to-stand · TUG · SPPB · apoyo monopodal · velocidad de marcha |
| Movilidad | Lunge test en carga (dorsiflexión) · ROM de cadera y hombro con goniómetro/inclinómetro (*fuentes pendientes*) · sit-and-reach (*pendiente*) |
| Composición corporal | Peso · talla · IMC · perímetros · pliegues (protocolo ISAK *pendiente*; ecuaciones Jackson-Pollock *coeficientes pendientes*) · bioimpedancia (con limitaciones ESPEN) |
| Monitorización | sRPE (Foster 2001) · cuestionarios de bienestar (Hooper/McLean) · ACWR **solo descriptivo, nunca como predictor de riesgo** |

Valores de fiabilidad localizados vía resumen (✔ = cita, DOI y PMID verificados; ◐ = cita verificada, identificadores pendientes) que se cargarán con su población: 1RM ICC mediana 0,97 / CV mediana 4,2 % (Grgic 2020 ✔) · IMTP ICC mediana 0,96 / CV 4,9 % (Grgic 2022 ✔) · CMJ/SJ α 0,97–0,98, CV 2,4–4,6 % (Markovic 2004 ◐) · My Jump vs plataforma ICC 0,997 (Balsalobre-Fernández 2015 ✔) · Modified Agility T-test ICC 0,92 (mujeres) / 0,95 (hombres) (Sassi 2009 ◐) · lunge test MDC 1,6–1,9 cm / 4,6–4,7° (Powden 2015 ✔) · apoyo monopodal ICC inter-evaluador 0,994/0,998 (Springer 2007 ◐).

Criterios clínicos localizados vía resumen (EWGSOP2, Cruz-Jentoft 2019 ◐ — PMID en conflicto, pendiente): baja fuerza: prensión < 27 kg (H) / < 16 kg (M); 5×STS > 15 s → mensaje "Requiere valoración por profesional sanitario" (posible baja fuerza; **el sistema no diagnostica sarcopenia**). Normas de prensión del Reino Unido (Dodds 2014 ✔: pico mediano 51 kg H / 31 kg M) solo aplicables a población británica de edades equivalentes.

### 11.4 Baterías por objetivo (plantillas iniciales, editables)

| Objetivo | Núcleo | Opcional | Evitar / condicionar |
|---|---|---|---|
| Hipertrofia | 1RM o estimación por repeticiones en ejercicios clave · perímetros · pliegues | VBT · IMC como contexto | %grasa por BIA como único indicador |
| Salud / mayores | Prensión + 5×STS · 30-s chair stand · SPPB · velocidad de marcha · apoyo monopodal · 6MWT | TUG · lunge test | 1RM directo sin familiarización ni cribado; tests máximos de campo |
| Deporte de equipo | CMJ · sprint 10/20/30 m (células) · 505 + déficit de COD · Yo-Yo IR1 o 30-15 IFT | IMTP · MAT · RSI · sRPE + bienestar | ACWR como indicador de riesgo |
| Resistencia | Test de campo (30-15 IFT u otro; VO₂max siempre "estimado") · sRPE | CMJ (fatiga neuromuscular) · lunge test | Comparar velocidades entre protocolos distintos |
| Sprint / potencia | Sprint 5–30 m + vmax · CMJ y SJ · RSI/RSImod · IMTP | 1RM/VBT en sentadilla | Cronometraje manual |
| Iniciación | Cribado · prensión · chair stand o 5×STS · CMJ (app) · 1RM estimado con cargas moderadas · perímetro de cintura | Test de campo submáximo | 1RM directo en primeras semanas; tests máximos sin supervisión |

Fuente: anexo de evaluación §3.2 (propuesta basada en las fichas; pendiente de validación por expertos). Las baterías de los Excel aportados se incorporan como plantillas adicionales (§18.1).

### 11.5 Interpretación del cambio (algoritmo del dominio)

```
Δ = post − pre;  Δ% = Δ / pre × 100
error = fiabilidad propia del centro (test-retest) ▸ si no, publicada en población similar ▸ si no, "desconocido"
si error desconocido            → mostrar Δ y Δ%, sin veredicto
si |Δ| < TE                     → "Dentro del error de medida"
si TE ≤ |Δ| < MDC95             → "Posible cambio, no confirmado" (sugerir repetir)
si |Δ| ≥ MDC95                  → "Cambio probable" (mejora o empeora según better_direction)
si SWC < TE                     → aviso "Test poco sensible para detectar cambios relevantes en esta persona"
medidas derivadas (déficit COD, asimetrías, % predicho) → propagar error; su MDC es mayor
agregación coherente en toda la serie (misma regla mejor/media; mismo método/dispositivo)
```

Fórmulas estándar: `SEM = SD × √(1 − ICC)`; `MDC95 = 1,96 × √2 × SEM`; `SWC = 0,2 × SD entre sujetos` (convención atribuida a Hopkins; **atribución exacta pendiente de verificación**). Las fórmulas son estadística estándar; los parámetros (ICC, SD) proceden de `test_reliability_data`.

### 11.6 Valores de referencia y comparación

- Una referencia solo se usa si `población`, `edad`, `sexo`, `nivel/deporte` y **método de medida** coinciden con el cliente y la evaluación. Si no, la UI muestra la referencia como **contexto** ("Referencia de población distinta: futbolistas profesionales; no comparable") o no la muestra.
- **z-scores** solo si: referencia aplicable, `statistic_type = mean_sd`, distribución aproximadamente normal declarada y n suficiente. Para escalas discretas o con techo (SPPB, chair stand, apoyo monopodal con tope) → percentiles o puntos de corte; en menores, la maduración invalida la comparación por edad cronológica.
- Comparación (§32): cliente + evaluación 1 + evaluación 2 (+ referencia) → valor, Δ absoluto, Δ%, tendencia (≥ 3 puntos), veredicto vs MDC, referencia. Gráficos: barras (antes/después), líneas (serie temporal con banda de error), radar **solo** cuando las métricas están normalizadas contra una referencia común aplicable o contra la línea base del propio cliente (% de cambio), nunca mezclando unidades crudas.

### 11.7 Banderas rojas → "Requiere valoración por profesional sanitario"

Cribado positivo · síntomas durante un test (dolor torácico, disnea desproporcionada, mareo/síncope, palpitaciones…) → **detener** · caídas en tests de equilibrio/marcha o caídas recientes · resultados en criterios clínicos de baja fuerza · dolor persistente, inflamación, inestabilidad o pérdida marcada y nueva de movilidad · pérdida de peso no intencionada · bienestar persistentemente muy bajo (sugerir apoyo profesional; el sistema no evalúa salud mental). Lista y textos **pendientes de revisión por un profesional sanitario** antes de producción.

---

## 12. Planificación (Programming Engine)

### 12.1 Jerarquía

```
PLAN (3 | 6 | 9 | 12 meses; objetivo principal + secundarios; estado; revisión)
 └─ FASES (p. ej. "Base", "Desarrollo", "Específica"; pesos por cualidad)
     └─ MESOCICLOS (2–8 semanas; foco; evaluación prevista)
         └─ MICROCICLOS (semana; tipo: introducción | progresión | pico | descarga | test | tapering | transición | competición;
                         volumen e intensidad relativos opcionales)
             └─ SESIONES (día A/B/C; fecha; lugar; duración estimada)
                 └─ BLOQUES (calentamiento, activación, potenciación, fuerza, hipertrofia, pliometría,
                             sprint/COD, acondicionamiento, core, movilidad, vuelta a la calma;
                             organización: series rectas, superserie, triserie, circuito, cluster, contraste…)
                     └─ EJERCICIOS (prescripción)
                         └─ SERIES (opcional, si difieren entre sí)
```

**No se impone un modelo de periodización.** `periodization_model` es descriptivo; la estructura se adapta al objetivo (el overview ACSM 2026 —EV-STR-001— no encontró efecto consistente de la periodización per se, lo que respalda la flexibilidad). Las fases pueden cambiar la frecuencia (p. ej. temporada vs. pretemporada).

### 12.2 Capacidades (requisito §38)

1. **Crear manual**: desde cero, con el editor de §8.5.
2. **Duplicar**: plan completo, fase, mesociclo, semana o sesión (copia profunda, nuevo id, `derived_from`).
3. **Crear plantilla**: "Guardar como plantilla" anonimiza (sin cliente, sin fechas absolutas; semanas relativas; cargas como %1RM/RIR en lugar de kg).
4. **Adaptar plantilla**: asistente que pide cliente, fecha de inicio, días disponibles, material; resuelve sustituciones por material/tolerancias; convierte %1RM → kg si existe 1RM/e1RM; marca conflictos.
5. **Generar propuesta**: usa el Decision Engine (§13) para elegir plantilla/esqueleto, métodos, ejercicios y dosis → `training_plans.kind = PROPOSAL`.
6. **Ajustar propuesta**: el entrenador edita libremente; al aceptar, la propuesta se convierte en `CLIENT_PLAN` borrador o en **nueva revisión** del plan activo.

**Regla dura:** ningún proceso automático modifica un plan `active`. Los ajustes automáticos se crean como `recommendations` (p. ej. "subir 2,5 kg en sentadilla semana 6") que el entrenador acepta individualmente o en bloque. Opción configurable por cliente: "aplicar progresiones de carga rutinarias sin confirmación" (desactivada por defecto; si se activa, cada cambio igualmente se audita y es reversible).

### 12.3 Plantillas iniciales (§39)

Matriz objetivo × frecuencia (2, 3, 4, 5 días) para: hipertrofia, fuerza, salud, rendimiento (deporte de equipo), resistencia (fuerza para deportistas de resistencia), iniciación. Ejemplos de estructura **(puntos de partida, no recetas)**:

| Objetivo | 2 días | 3 días | 4 días | 5 días |
|---|---|---|---|---|
| Hipertrofia | Full body ×2 | Full body ×3 (como el Excel 1) | Torso/pierna ×2 | Torso/pierna + full body o push/pull/legs |
| Fuerza | Full body con 2 básicos por sesión | Full body A/B/C con énfasis rotatorio | Torso/pierna pesado/ligero | Básicos + accesorios por días |
| Salud / funcional | Full body ×2 (patrones + equilibrio) | Full body ×3 + acondicionamiento | Full body ×2 + 2 aeróbico/multicomponente | — (sugerir actividad aeróbica) |
| Rendimiento deporte de equipo | Fuerza+potencia ×2 (en temporada) | Fuerza / potencia / mixto | Fuerza tren inf. / sup. + velocidad/COD | Según calendario competitivo |
| Resistencia | Fuerza full body ×2 | Fuerza ×2 + pliometría/técnica ×1 | — | — |
| Iniciación | Full body ×2 (técnica de patrones) | Full body ×3 | — | — |

Las plantillas se cargan como **datos** (`seed-data/templates/*.json`) y son editables por organización. Las cuatro rutinas Excel aportadas se normalizarán como plantillas adicionales "3 días / 5 mesociclos / 36 semanas" tras su revisión (§18.1).

### 12.4 Variables de prescripción (catálogo `prescription_variables`)

| Clave | Unidad | Rango/validación | Notas |
|---|---|---|---|
| sets | n | 1–20 | |
| reps (min–max) | n | 1–100 | Rango → doble progresión |
| reps_per_cluster + intra_rest | n, s | | Cluster sets |
| duration | s | | Isométricos, intervalos, movilidad |
| distance | m | | Sprints, carries, carrera |
| contacts | n | | Pliometría (control de dosis por contactos) |
| load | kg | ≥ 0 | |
| %1RM | % | 0–110 | Requiere métrica base (1RM/e1RM) elegida |
| RIR | rep | **0–10** | Rango permitido (p. ej. 1–3) |
| RPE | 1–10 | paso 0,5 | Escala RPE basada en RIR o CR-10 de sesión: **no se mezclan** |
| effort_character | texto | | "8 de 12 posibles" (carácter del esfuerzo, González-Badillo) |
| velocity_target | m/s | | Solo `supports_vbt` |
| velocity_loss | % | 0–60 | Solo con medición de velocidad |
| tempo | ecc-pausa-con-pausa | patrón `\d|X` | p. ej. `3-1-X-0` |
| rest | s | 0–900 | |
| ROM | enum | completo, parcial en longitud larga, parcial en longitud corta, especificado | |
| intensity (other) | texto/enum | | %CVM isométrica, %vmax en sprint, zona aeróbica… |
| band_tension / chain_load | kg o color+elongación / kg | | Resistencias acomodadas (§18.3) |
| volume, density, frequency | derivados | | Calculados, no introducidos |

**RIR vs RPE vs carácter del esfuerzo**: tres representaciones distintas que se almacenan por separado. El texto para el cliente se genera desde la prescripción: `4×8 @ RIR 2` → *"4 series de 8 dejando aproximadamente 2 repeticiones en reserva"*. Los registros de RIR/RPE se muestran como **autoinforme** (su precisión depende de la experiencia y de la cercanía al fallo — fuentes en verificación, §19).

### 12.5 Perfiles de prescripción (mostrar solo lo relevante)

Cada ejercicio/bloque tiene un `prescription_profile` que define qué variables se muestran por defecto:

| Perfil | Variables visibles por defecto |
|---|---|
| Fuerza/hipertrofia (dinámico con carga) | series, reps, carga o %1RM, RIR, descanso (tempo opcional) |
| Fuerza con VBT | series, reps, carga, velocidad objetivo, pérdida de velocidad, descanso |
| Isométrico | series, duración, intensidad (%CVM/percepción), ángulo/ROM, descanso |
| Pliometría | series, contactos/reps, altura/distancia, descanso, calidad (RSI opcional) |
| Sprint/aceleración | repeticiones, distancia, %vmax/intención, descanso, (resistencia del trineo) |
| COD/agilidad | repeticiones, patrón/ángulo, distancia, descanso |
| Resistencia/acondicionamiento | duración o distancia, intensidad (zona, %FCmax, RPE), intervalos, recuperación |
| Movilidad / control motor | series, reps o duración, ROM/posición, notas |
| Core/estabilidad | series, reps o duración, carga opcional, descanso |
| Resistencias acomodadas | series, reps, carga de barra, tensión de banda/cadena, % del total acomodado, descanso |

El entrenador puede añadir cualquier variable ("＋ variable").

### 12.6 Autorregulación (RIR, RPE, VBT)

- RIR/RPE disponibles en cualquier ejercicio dinámico.
- VBT **solo** si `exercise.supports_vbt` (multiarticulares con trayectoria medible: sentadilla, press, peso muerto, remo tumbado, saltos cargados…) **y** el cliente tiene dispositivo y experiencia técnica estable. No se ofrece VBT en isométricos, ejercicios de aislamiento con poco recorrido, movilidad, core, pliometría de contacto, ni a principiantes sin técnica consolidada (criterio práctico, nivel F).
- Pérdida de velocidad como criterio de fin de serie solo cuando hay medición por repetición.

### 12.7 Progresión (motor de progresión del dominio)

Reglas declarativas por ejercicio/bloque (configurables, evaluadas tras cada sesión registrada):

| Regla | Lógica | Origen |
|---|---|---|
| Doble progresión | Si todas las series alcanzan `reps_max` con RIR ≥ objetivo → +carga (incremento configurable por ejercicio: p. ej. 2,5 kg en barra, 1–2 kg en mancuerna) y volver a `reps_min` | Práctica (F) presente en los Excel |
| Ajuste por RIR | Si RIR registrado > objetivo + 1 en ≥ 2 sesiones → proponer +carga; si < objetivo − 1 → proponer −carga o mantener | Práctica (F); base en autorregulación (verificación pendiente) |
| %1RM ↔ reps+RIR | Conversión por ecuación configurable. Los Excel usan **O'Connor**: `%1RM = 1 / (1 + 0,025 × (reps + RIR))` y `e1RM = carga × (1 + 0,025 × (reps + RIR))` | Ecuación clásica (libro 1989, cita estándar no reconsultada → **H** hasta verificar); precisión menor con muchas reps posibles |
| e1RM por velocidad | Perfil carga-velocidad individual; V1RM configurable por ejercicio | Error ≈ 9,8 % (Greig 2023) → mostrar como estimación |
| Descarga | Semana de descarga: −series (p. ej. −1 serie, ≈ −30-40 % volumen) y RIR +2, configurable | Práctica (F) de los Excel; consenso sobre *deload* pendiente de verificar |
| Lineal por semanas | +x kg o +y % por semana con techo | F |

Toda progresión aplicada genera valores **derivados** que el entrenador puede sobrescribir (override auditado).

### 12.8 Indicadores del plan (descriptivos)

Calculados en el dominio para cada semana/mesociclo: series efectivas por grupo muscular (convención **primario = 1, secundario = 0,5**, configurable — la convención de 0,5 para series indirectas es un criterio práctico usado también en la literatura de volumen, pendiente de anclar a fuente verificada), series por patrón de movimiento, ratio tracción/empuje, contactos pliométricos/semana, metros de sprint, duración estimada, % de tiempo/series por cualidad (como en la hoja "Volumen y cualidades" de los Excel). Los avisos (p. ej. "> 20 series/semana en pectoral") son umbrales **configurables** con su nivel de evidencia visible.

---

## 13. Motor de decisiones (Decision Engine)

### 13.1 Propósito y límites

Ayudar al entrenador a responder *"¿qué necesita esta persona ahora?"* con propuestas **razonadas, trazables, modificables, desactivables y sobrescribibles**. No sustituye al entrenador, no diagnostica, no prescribe tratamiento, no modifica planes activos.

Es un **sistema basado en reglas versionadas y deterministas** (mismas entradas + misma versión de reglas → misma salida), no un modelo opaco de aprendizaje automático. Motivos: explicabilidad (§36, §70), auditabilidad, pocos datos iniciales, responsabilidad. El diseño permite añadir más adelante modelos estadísticos como **entradas** (p. ej. tendencia de rendimiento), nunca como caja negra que decida.

### 13.2 Entrada y salida

```
ENTRADA  ClientContext {
  persona: edad, sexo (opc.), estado de entrenamiento, años, historial
  objetivos: principal + secundarios con pesos, fecha, deporte, nivel, calendario competitivo
  evaluaciones: resultados + métricas derivadas + cambios vs MDC + referencias aplicables
  disponibilidad: días/sem, minutos/sesión, días concretos, lugar
  equipamiento; tolerancias/no tolerancias; declaraciones de salud (solo flags, nunca diagnóstico)
  respuesta: adherencia, sRPE vs previsto, RIR registrado vs objetivo, tendencias de e1RM, dolor, readiness
  contexto: modalidad presencial/online, fase de temporada, preferencias
}
+ KnowledgeSnapshot { rule_set vN, métodos, claims, hallazgos, ejercicios, plantillas, umbrales }

SALIDA   DecisionResult {
  screening: { status: clear | caution | refer, reasons[] }
  needs[]: { quality, score 0–1, direction (desarrollar | mantener | no prioritario), explanation }
  priorities[]: orden + reparto del tiempo por cualidad
  methods[]: { method, rationale, evidence, applicability }
  exercise_candidates[]: por patrón/slot, con score y motivos de inclusión/exclusión
  doses[]: rangos por método/población + valor sugerido
  plan_skeleton: fases/mesociclos/semanas/sesiones (desde plantilla)
  warnings[]: extrapolaciones, datos faltantes, conflictos de objetivos
  explanations: grafo DATOS → INTERPRETACIÓN → RECOMENDACIÓN → EVIDENCIA
}
```

### 13.3 Pipeline (etapas puras y testeables)

| # | Etapa | Qué hace | Ejemplo de regla (configurable) |
|---|---|---|---|
| 1 | **Context builder** | Ensambla y normaliza datos; marca faltantes | "Sin evaluación de fuerza en 90 días → dato faltante" |
| 2 | **Screening gate** | Aplica flags de cribado/salud. Si `refer` → solo propuestas de baja intensidad o ninguna en la zona afectada + texto "Requiere valoración por profesional sanitario" | Cribado positivo; dolor declarado ≥ umbral persistente |
| 3 | **Profiler** | Interpreta resultados: vs. referencia aplicable (si existe) y vs. evaluación previa (MDC). Genera "rasgos" con confianza | `relative_strength_back_squat` bajo **para su objetivo/deporte** según umbral configurado y su fuente |
| 4 | **Needs analysis** | Objetivo × rasgos × historial → necesidades con puntuación | Matriz objetivo→cualidades (pesos configurables) + modificadores por rasgo |
| 5 | **Prioritization** | Ordena y reparte el tiempo disponible (min/sem) entre cualidades; detecta conflictos (p. ej. hipertrofia + maratón) | "Máx. 3 prioridades de desarrollo; el resto en mantenimiento" |
| 6 | **Method selection** | Filtra métodos por objetivo, población (aplicabilidad), experiencia, material, precauciones; ordena por evidencia y adecuación | "PAPE desactivado si estado = principiante" (nivel B/F) |
| 7 | **Exercise selection** | Para cada *slot* (patrón × método × nivel), puntúa ejercicios: patrón, músculos, nivel, material, espacio, tolerancias, complejidad, preferencias, variedad | Excluir no tolerados; penalizar complejidad > nivel |
| 8 | **Dosing** | Asigna rangos de `method_variables` aplicables a la población + ajuste por experiencia, tolerancia y respuesta | Iniciación: series bajas al principio, RIR alto |
| 9 | **Plan assembly** | Selecciona plantilla por objetivo × frecuencia × duración y la rellena; inserta evaluaciones/reevaluaciones | Reevaluación al final de cada mesociclo o cada 6–12 semanas (configurable) |
| 10 | **Explain** | Construye la explicación de cada elemento | §13.6 |

### 13.4 Reglas como datos (DSL)

Las reglas viven en `rules` (versionadas en `rule_sets`). Condición en JSON con un DSL acotado (operadores: `and, or, not, ==, !=, <, <=, >, >=, in, between, exists, trend, count_in_window`), evaluado por un intérprete propio (sin `eval`), con **umbrales como parámetros editables** desde la UI de administración.

```json
{
  "key": "needs.max_strength.relative_strength_low",
  "version": 3,
  "domain": "needs",
  "description": "Fuerza relativa baja para su objetivo → priorizar fuerza máxima",
  "condition": { "and": [
    { "in": [ { "var": "goal.primary.family" }, ["team_sport", "sprint", "power", "max_strength"] ] },
    { "<": [ { "var": "metrics.relative_strength.back_squat" }, { "param": "threshold_rel_strength" } ] },
    { "exists": { "var": "metrics.relative_strength.back_squat" } }
  ]},
  "parameters": { "threshold_rel_strength": { "value": null, "unit": "xBW",
                  "source": "Configurable por organización/deporte; sin umbral universal verificado",
                  "evidence_level": "F" } },
  "action": { "type": "raise_need", "quality": "max_strength", "delta": 0.3 },
  "evidence_claim_ids": ["CLM-strength-sprint-association", "CLM-heavy-load-1rm"],
  "limitations": "Asociación fuerza–rendimiento (no causalidad garantizada); muestras mayoritariamente hombres jóvenes",
  "enabled": true
}
```

> Nota: el umbral `null` por defecto obliga a la organización a fijarlo conscientemente (no se inventa un valor normativo). Las reglas sin parámetros completos no se ejecutan y aparecen como "pendientes de configurar".

### 13.5 Ejemplo: ¿hace falta una fase de adaptación? (principio §7)

No hay regla "todos necesitan adaptación de tejidos". La regla calcula una **puntuación de necesidad de fase introductoria** a partir de: experiencia con el tipo de carga previsto (p. ej. nunca pliometría), semanas sin entrenar, edad, tolerancias/dolor declarados, salto de carga previsto vs. carga reciente, respuesta en las primeras sesiones. Resultado posible: *ninguna*, *introducción de 1–2 semanas solo para los métodos nuevos* (p. ej. pliometría de bajo impacto antes de saltos reactivos) o *fase de 3–6 semanas*. Métodos candidatos según el caso: altas repeticiones con RIR alto, isométricos, diferentes longitudes musculares, excéntricos controlados, pliometría de baja intensidad, control motor/movilidad — **ninguno obligatorio**. Nivel de la regla: F (práctica razonable) apoyada en E (adaptación del tendón a carga alta en ≥ 8 semanas, EV-PWR-016) — mostrado así en la explicación.

### 13.6 Explicación ("¿Por qué?") — estructura obligatoria

```
Se propone: PRIORIDAD 1 — Fuerza máxima (2 sesiones/sem; sentadilla 3–4 × 4–6 @ RIR 2)
DATOS        Fuerza relativa sentadilla 1,1×PC (e1RM por reps, 12/09/2026; error típico conocido)
             CMJ 31,2 cm (sin referencia aplicable: "Referencia insuficiente")
             Sprint 10 m sin cambio vs. evaluación anterior (Δ < MDC)
             Adherencia 92 %
INTERPRETACIÓN Fuerza relativa por debajo del umbral fijado por el entrenador para futbolistas (1,5×PC)
REGLA        needs.max_strength.relative_strength_low v3 (umbral editable)
EVIDENCIA    La fuerza del tren inferior se asocia a mejoras de sprint (EV-PWR-024, B; asociación, no causalidad)
             Cargas altas → más 1RM que cargas bajas (EV-STR-012, A/B)
APLICABILIDAD Mayoría de estudios en hombres jóvenes de deportes de equipo → coincide (edad, deporte); sexo: coincide
LIMITACIONES  Umbral no normativo; e1RM con error; CMJ sin referencia
CONFIANZA    Moderada
[Aceptar] [Editar] [Rechazar] [Desactivar esta regla para este cliente]
```

### 13.7 Monitorización y alertas (§21)

Reglas del dominio `monitoring_alert`, evaluadas tras cada evento (sesión registrada, feedback, readiness, evaluación) y en un job diario. Todos los umbrales son **parámetros configurables** con origen documentado (la mayoría F: práctica).

| Señal | Regla por defecto (editable) | Severidad |
|---|---|---|
| Adherencia baja | < 80 % en 4 semanas → 🟡; < 60 % → 🔴 | 🟡/🔴 |
| Sesiones no realizadas | 2 seguidas sin motivo → 🟡 | 🟡 |
| Sesiones incompletas | ≥ 3 parciales en 2 semanas → 🟡 | 🟡 |
| sRPE elevado | sRPE ≥ previsto + 2 en 3 sesiones → 🟡 | 🟡 |
| RIR sistemáticamente distinto | RIR registrado vs objetivo ±2 en ≥ 2 sesiones del mismo ejercicio → propuesta de ajuste de carga | 🟢 (propuesta) |
| Descenso de rendimiento | e1RM o test con Δ negativo ≥ MDC, o tendencia descendente en 3 puntos → 🟡 | 🟡 |
| Dolor/molestias | Dolor ≥ 4/10 en un ejercicio → 🟡 y propuesta de sustitución; ≥ 7/10, o ≥ 4/10 en 2 sesiones seguidas en la misma zona → 🔴 + "Requiere valoración por profesional sanitario" | 🟡/🔴 |
| Fatiga/readiness | Bienestar bajo ≥ 3 días seguidos → 🟡 | 🟡 |
| Sin feedback | Sesión completada sin feedback → recordatorio | 🟢 |
| Reevaluación vencida | Fecha prevista superada → 🟡 | 🟡 |

Las alertas **describen** ("dolor 6/10 declarado en sentadilla búlgara dos sesiones seguidas"), **nunca diagnostican** ("posible tendinopatía" está prohibido).

### 13.8 Sustitución de ejercicios (§29)

```
entrada: ejercicio original, motivo (dolor | material | dificultad | espacio | preferencia | fatiga), cliente, sesión
candidatos = ejercicios con mismo patrón ∪ variantes/regresiones del grafo de progresiones
filtrar:   material disponible en el lugar · no tolerados · restricciones declaradas · espacio
puntuar:   + mismo objetivo/método · + músculos primarios coincidentes · + nivel adecuado
           + ROM/impacto/carga axial menor si motivo = dolor · + menor complejidad si motivo = dificultad
           − usado recientemente si se busca variedad
salida:    top N con explicación de por qué cada uno ("mismo patrón, sin carga axial, material disponible")
decisión:  el entrenador elige (o pre-aprueba alternativas para que el cliente elija en sesión)
```

### 13.9 Override y desactivación (§37, §64)

- Cualquier recomendación: aceptar, aceptar con cambios (se registra `manual_override` por campo), rechazar (motivo opcional), posponer.
- Cualquier regla: desactivar globalmente (ADMIN), por organización o **por cliente**.
- Las métricas de overrides por regla (tasa de rechazo) se muestran al ADMIN para revisar reglas mal calibradas.

### 13.10 Ejemplo del encargo (§69)

Futbolista, 22 años, 3 días, objetivo rendimiento, CMJ bajo, sprint correcto, fuerza relativa baja, buena adherencia → **Prioridad 1: fuerza; Prioridad 2: potencia; Mantener: sprint**, con la explicación de §13.6. *Condición*: que la organización haya configurado los umbrales de "bajo" para su población (futbolistas), o que exista referencia aplicable verificada; si no, el motor dice explícitamente "No hay referencia aplicable para valorar el CMJ como bajo; se usa la valoración del entrenador" y ofrece marcarlo manualmente. Este caso será un *golden test*.

---

## 14. Seguridad y privacidad

### 14.1 Modelo de amenazas (resumen)

| Amenaza | Control |
|---|---|
| Cliente accede a datos de otro cliente (IDOR) | Policy en cada caso de uso + RLS + tests automáticos de acceso cruzado para **todas** las rutas. |
| Entrenador accede a clientes no asignados u otra organización | Ámbito por `trainer_client_assignments` + `organization_id` en RLS. |
| Robo de credenciales / fuerza bruta | argon2id, límite de intentos y *rate limiting*, 2FA TOTP obligatorio para ADMIN y recomendado para TRAINER, contraseñas comprobadas contra listas filtradas (k-anonymity) y longitud mínima 12. |
| Secuestro de sesión | Cookies `HttpOnly`, `Secure`, `SameSite=Lax`, rotación al login, expiración por inactividad (staff 12 h, cliente 30 días con renovación), revocación desde ajustes. |
| CSRF / XSS | SameSite + token CSRF en mutaciones; CSP estricta con nonces; escape por defecto de React; sanitización de Markdown (lista blanca). |
| Inyección | Consultas parametrizadas (Drizzle), validación Zod de toda entrada, DSL de reglas evaluado por intérprete propio sin `eval`. |
| Ficheros maliciosos | Tipos permitidos, tamaño máximo, re-codificación de imágenes, nombres aleatorios, URLs firmadas de corta duración. |
| Importaciones maliciosas (CSV injection) | Al exportar, prefijar celdas que empiezan por `= + - @`; al importar, validar tipos. |
| Fugas por logs | Logger con lista de campos prohibidos (salud, notas, contacto); errores sin datos personales. |
| Abuso de la API | Rate limiting por usuario/IP; paginación obligatoria; tamaño máximo de petición. |
| Pérdida de datos | Copias cifradas diarias, PITR 7 días, prueba de restauración trimestral documentada. |
| Insider / error humano | Auditoría append-only, mínimo privilegio, confirmación en acciones destructivas, papelera para borrados lógicos. |

### 14.2 Matriz de permisos (extracto)

Permisos con forma `recurso:acción[:ámbito]`.

| Permiso | ADMIN | TRAINER | CLIENT |
|---|---|---|---|
| `clients:read` | org | asignados | propio |
| `clients:write` | org | asignados | propio (campos limitados: contacto, disponibilidad, preferencias) |
| `health_declarations:read` | org (auditado) | asignados (auditado) | propio |
| `assessments:write` | org | asignados | ✗ (salvo autoevaluaciones habilitadas) |
| `plans:write` / `plans:publish` | org | asignados | ✗ |
| `sessions:read` | org | asignados | propio y **solo publicadas** |
| `set_logs:write` | org | asignados | propio, solo sesiones publicadas, ventana de edición configurable (p. ej. 72 h) |
| `feedback:write` | — | asignados (nota de entrenador) | propio |
| `recommendations:decide` | org | asignados | ✗ |
| `library:write` (ejercicios/métodos/tests de la org) | ✓ | ✓ (configurable) | ✗ |
| `evidence:publish` / `rules:publish` | ✓ | ✗ (puede proponer) | ✗ |
| `reports:generate` | org | asignados | propio (si habilitado) |
| `users:manage`, `roles:manage` | ✓ | ✗ | ✗ |
| `audit:read` | ✓ | sus clientes | ✗ |
| `privacy:export_subject` | ✓ | ✗ | propio |
| `privacy:erase_subject` | ✓ (con doble confirmación) | ✗ | solicitar |

### 14.3 Aplicación de la autorización (defensa en profundidad)

1. **Capa de aplicación**: cada caso de uso declara su permiso; un *wrapper* lo comprueba antes de ejecutar. Un test de CI recorre todas las rutas registradas y falla si alguna no declara permiso.
2. **Consultas con ámbito**: los repositorios reciben un `Actor` y filtran siempre por organización y ámbito.
3. **PostgreSQL RLS**: la conexión fija `app.org_id`, `app.user_id`, `app.role` por transacción; políticas por tabla. Para `CLIENT`, las políticas restringen a `client_id = current_client_id()`.
4. **Respuestas**: DTOs explícitos por rol (el cliente nunca recibe `coach_notes`, reglas ni evidencia).

### 14.4 RGPD

| Aspecto | Diseño |
|---|---|
| Roles RGPD | El entrenador/negocio es **responsable del tratamiento**; la plataforma, si se ofrece a terceros, **encargada** (contrato art. 28). |
| Base jurídica | Ejecución del contrato (datos de entrenamiento) + **consentimiento explícito** (art. 9.2.a) para datos de salud declarados, dolor y fotografías. Consentimientos granulares, versionados y revocables (`consents`). |
| Minimización | Solo se recogen datos con finalidad en el flujo. No se piden diagnósticos, medicación ni historia clínica. Texto libre de salud con aviso de "no incluya información médica innecesaria". |
| Transparencia | Aviso de privacidad en el alta; explicación de qué hace el motor de recomendaciones (no hay decisiones automatizadas con efectos jurídicos; el entrenador decide — art. 22). |
| Derechos | Acceso/portabilidad (exportación JSON + CSV/PDF), rectificación, supresión (borrado o anonimización irreversible de datos personales; se conservan agregados anónimos), limitación, oposición. Plazo 1 mes. |
| Retención | Configurable; por defecto: cliente archivado → datos personales conservados X años según obligación contractual/fiscal del negocio, después anonimización automática. `[Decisión del responsable]` |
| Seguridad | Cifrado en tránsito (TLS 1.2+), en reposo (disco/BD gestionada) y cifrado de columna para campos de salud de texto libre y teléfono. |
| Localización | Proveedores en el EEE o con garantías adecuadas. |
| EIPD/DPIA | Probablemente necesaria (datos de salud, seguimiento sistemático); plantilla en `/docs/DPIA.md` (Fase 13). `[REQUIERE VALIDACIÓN LEGAL]` |
| Menores | Si se admiten clientes < 14 años (España, LOPDGDD art. 7) consentimiento de tutores; desactivado por defecto. `[REQUIERE VALIDACIÓN LEGAL]` |

### 14.5 Responsabilidad sanitaria (no diagnóstico)

- Vocabulario controlado: "dolor/molestia declarada", nunca "lesión diagnosticada" salvo que el cliente declare un diagnóstico hecho por un profesional.
- Las alertas por dolor generan avisos al entrenador y el texto fijo **"Requiere valoración por profesional sanitario"** cuando se cumplen reglas de derivación (p. ej. dolor ≥ umbral, persistente, o signos del cuestionario de cribado). Los umbrales son configurables y su origen se documenta (en su mayoría **F: recomendación práctica**).
- Ninguna salida del sistema afirma prevenir lesiones como hecho; si se menciona reducción de riesgo, se cita la evidencia y su nivel.

### 14.6 Auditoría

- Todo `create/update/delete` sobre entidades de cliente, plan, prescripción, evaluaciones, reglas, evidencia y usuarios genera entrada en `audit_logs` con diff de campos (dentro de la misma transacción).
- Lecturas de datos de salud y exportaciones se auditan (`view_sensitive`, `export`).
- Overrides: si un valor proviene de una recomendación y el entrenador lo cambia, se registra además en `manual_overrides` (valor propuesto, valor final, motivo opcional) — sirve para mejorar reglas.
- Vista de historial legible: "Entrenador X · 12/10/2026 10:41 · Sentadilla trasera · Carga 80 kg → 82,5 kg · Motivo: RIR registrado 4 (objetivo 2)".

---

## 15. Testing y calidad

### 15.1 Pirámide

| Nivel | Herramienta | Qué cubre | Umbral |
|---|---|---|---|
| Unidad (dominio) | Vitest + fast-check | Fórmulas (e1RM, %1RM, RSI, perfil F-V, adherencia, cambios vs MDC, series efectivas…), reglas, progresiones, explicaciones | ≥ 90 % líneas en `packages/domain`; tests de propiedades (p. ej. monotonía, límites, idempotencia) |
| Contrato | Zod + OpenAPI diff | Compatibilidad de API | Sin cambios rompientes sin versión |
| Integración | Vitest + Testcontainers (PostgreSQL real) | Repositorios, RLS, transacciones + auditoría, migraciones | Todas las políticas RLS con test positivo y negativo |
| Seguridad | Suite específica | Acceso cruzado (cliente→cliente, entrenador→no asignado, org→org) para **cada** ruta; rate limiting; sesiones | 100 % rutas |
| E2E | Playwright (escritorio + móvil emulado) | Flujos §8.4 y §9 completos, incluido offline | Flujos críticos en cada PR |
| Accesibilidad | axe-core en E2E | WCAG 2.2 AA | 0 violaciones serias |
| Científico | "Golden cases" revisados | Casos de cliente con salida esperada del Decision Engine y explicación; verificación de que cada recomendación tiene evidencia `verified` o se marca como F/G | Revisión humana en cambios de reglas |
| Datos | Validadores de seed | Cada `reference_value` tiene fuente verificada y población; cada `evidence_source` verificado tiene DOI/PMID o justificación | CI bloquea si falla |

### 15.2 Áreas obligatorias (§57 del encargo)

login · permisos · cliente · evaluación · programa · sesión · ejercicios · feedback · adherencia · cálculos · informes · filtros · sustitución · seguridad. Cada una tendrá su lista de casos en `/docs/TESTING.md`.

### 15.3 Definición de "hecho" por fase (§63)

Una fase se cierra solo si: funcionalidad completa según criterios de aceptación · UX revisada en móvil y escritorio · permisos y tests de seguridad · tests en verde en CI · documentación actualizada (doc del módulo + CHANGELOG) · manejo de errores y estados vacíos · datos demo que ejercitan la funcionalidad.

### 15.4 Datos demo (§58)

3 entrenadores ficticios y 10 clientes ficticios (nombres generados, emails `@example.com`), con edades 17–72, objetivos variados (hipertrofia, salud en adulto mayor, futbolista, jugadora de balonmano, corredor de fondo, iniciación, reacondicionamiento tras inactividad, composición corporal, sprint, fuerza máxima), niveles distintos, 1–3 evaluaciones cada uno, planes en distintos estados y adherencias del 45 % al 100 %, incluidas alertas de cada color. Generados con semilla fija (reproducibles). **Ningún dato real.**

---

## 16. Roadmap

### 16.1 Estrategia

Las fases del encargo (§62) se respetan, pero se agrupan en **hitos utilizables**: el entrenador debe poder trabajar con clientes reales (gestión manual) **antes** de que existan los motores automáticos. Así los motores se diseñan con datos de uso real y el producto aporta valor pronto.

| Hito | Fases | Resultado utilizable |
|---|---|---|
| **H0 — Fundamentos** | 0 | Esta especificación + anexos de investigación. ✅ |
| **H1 — Base segura** | 1, 2 | Monorepo, CI, auth, organizaciones, roles, clientes, objetivos, auditoría, consentimientos, esquema completo de BD con RLS, seeds de catálogos. |
| **H2 — Bibliotecas** | 3, 4 | Biblioteca de ejercicios (CRUD, búsqueda, filtros, media, progresiones, sustituciones) y biblioteca científica (fuentes, hallazgos, afirmaciones, métodos, QA). Carga inicial de contenido verificado. |
| **H3 — Evaluar y programar a mano** | 5, 6, 7 | Evaluaciones con baterías y comparación; planificador completo manual (plan→series), plantillas manuales, publicación; PWA cliente con reproductor y registro offline. **Primer uso real.** |
| **H4 — Seguimiento** | 8, 9 | Feedback, readiness, dolor, asistencia, adherencia, alertas por reglas simples, dashboards entrenador/cliente, calendario. |
| **H5 — Inteligencia explicable** | 10, 11 | Decision Engine (necesidades, prioridades, métodos, ejercicios, dosis) y Programming Engine (propuestas, progresión propuesta, ajustes) con explicaciones y overrides. |
| **H6 — Informes y robustez** | 12, 13, 14 | Informes PDF/XLSX/CSV, importación/exportación, endurecimiento de seguridad, DPIA, suite de pruebas completa, auditoría externa opcional. |
| **H7 — Optimización y escala** | 15 | Rendimiento, observabilidad, multi-entrenador avanzado, preparación de integraciones. |

### 16.2 Fases detalladas

| Fase | Contenido | Criterios de aceptación principales |
|---|---|---|
| 0 Investigación + arquitectura | Análisis de documentos, investigación, especificación | Este documento + `/docs/research/*`; decisiones abiertas listadas (§19). |
| 1 Auth + usuarios + clientes | Monorepo, CI, Better Auth, organizaciones, roles/permisos, invitaciones, ficha de cliente, objetivos, consentimientos, auditoría base | Login/2FA, test de acceso cruzado en todas las rutas, alta de cliente en < 3 min, auditoría de cada cambio. |
| 2 Base de datos + estructura | Esquema completo (§6), RLS, migraciones, seeds de catálogos (objetivos, patrones, músculos, material, variables, unidades) y datos demo | Migración desde cero reproducible; tests RLS positivos/negativos; demo cargable con un comando. |
| 3 Biblioteca de ejercicios | CRUD, taxonomías, media (silueta/vídeo con verificación), progresiones (grafo), cues/errores, buscador con filtros, motor de sustitución (sugerencias) | Importación de ejercicios de los Excel aportados tras normalización y revisión; ≥ 150 ejercicios publicados con taxonomía completa; vídeos sin verificar marcados como tales. |
| 4 Biblioteca científica | Fuentes, hallazgos, afirmaciones, métodos, poblaciones, QA científico (checklist + detección de extrapolación), vistas de trazabilidad | Solo fuentes `verified` habilitan recomendaciones; cada método inicial con definición, variables y evidencia enlazada o marcada F/G. |
| 5 Evaluaciones | Catálogo de tests con protocolo y fiabilidad, referencias con población, baterías por objetivo, registro por intentos, métricas derivadas, comparación con MDC, gráficos | Comparación antes/después con interpretación correcta; sin z-score si no hay referencia aplicable (test). |
| 6 Planificación | Planes 3/6/9/12 meses, fases→series, perfiles de prescripción, editor de sesión, progresiones declarativas, plantillas manuales, revisiones, calendario de plan | Crear un plan de 12 semanas 3 días/sem en < 20 min desde plantilla; overrides auditados. |
| 7 Sesiones | Publicación, PWA cliente, reproductor, registro rápido, sustitución en vivo, offline, modo sala | Registrar sesión completa offline y sincronizar sin duplicados (test E2E). |
| 8 Feedback + adherencia | Feedback sesión/ejercicio, readiness, dolor, asistencia, adherencia, reglas de alerta 🟢🟡🔴 configurables | Ejemplo exigido: 24 planificadas / 21 realizadas = 87,5 % (test). |
| 9 Dashboard | Dashboard entrenador y cliente, calendario global | Revisión UX con 3 tareas cronometradas. |
| 10 Motor de decisiones | Context builder, cribado, perfilado, necesidades, priorización, selección de métodos/ejercicios/dosis, explicación, editor de reglas | Golden cases (incluido el futbolista de §69 del encargo) con explicación completa y evidencia trazable. |
| 11 Motor de programación | Generación de propuesta de plan desde plantilla+contexto, progresión propuesta semana a semana, propuestas de ajuste por respuesta | Nunca modifica un plan activo sin aceptación (test). |
| 12 Informes | Informe de cliente (11 secciones de §34), exportaciones, importaciones validadas | PDF reproducible; CSV/XLSX con validación previa y errores por fila. |
| 13 Seguridad | Revisión ASVS L2, DPIA, retención, exportación/supresión RGPD, pentest ligero | Checklist completo; derechos ejercitables desde UI. |
| 14 Testing | Completar pirámide, E2E móvil, accesibilidad, rendimiento | Umbrales de §15. |
| 15 Optimización | Rendimiento, caché, índices, observabilidad, preparación integraciones | p95 objetivos de §2.3 con 1 000 clientes simulados. |

### 16.3 Gobierno de cambios

- Commits pequeños con Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`).
- `CHANGELOG.md` con fecha, cambio, motivo, archivos, impacto.
- Cada cambio de reglas o evidencia publicada genera nueva versión de `rule_set` y entrada en CHANGELOG científico.

### 16.4 Documentación

Al inicio de cada fase se crea o actualiza el documento específico derivado de esta especificación:

| Documento | Se crea en |
|---|---|
| `/docs/ARCHITECTURE.md`, `/docs/SECURITY.md` (base), `/docs/TESTING.md` (base), `/docs/ROADMAP.md` | Fase 1 |
| `/docs/DATABASE.md` | Fase 2 |
| `/docs/EXERCISE_LIBRARY.md` | Fase 3 |
| `/docs/SCIENTIFIC_FRAMEWORK.md` | Fase 4 |
| `/docs/ASSESSMENT_SYSTEM.md` | Fase 5 |
| `/docs/PROGRAMMING_ENGINE.md` | Fase 6/11 |
| `/docs/DECISION_ENGINE.md` | Fase 10 |
| `/docs/API.md` (generado desde OpenAPI + guía) | Fase 1 en adelante |

---

## 17. Riesgos

| # | Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|---|
| R1 | **Sobreextensión científica**: el motor convierte evidencia contextual en reglas universales o extrapola poblaciones | Alta | Alto | Población obligatoria en hallazgos y referencias; QA científico automático de aplicabilidad; reglas con nivel de evidencia y limitaciones visibles; propuestas, nunca imposiciones. |
| R2 | **Referencias erróneas o inventadas** en contenidos importados (Excel/PDF) o generados | Media | Alto | Estado de verificación por fuente; solo `verified` alimenta recomendaciones; QA de referencias (§18.4). En esta Fase 0 la política de red bloqueó Crossref/PubMed, por lo que la verificación se hizo vía buscador y queda **pendiente una segunda verificación directa** (§19). |
| R3 | **Responsabilidad sanitaria** (dolor, lesiones, población clínica) | Media | Alto | No diagnóstico; cribado pre-participación; textos de derivación; reacondicionamiento solo post-alta; avisos legales revisados. |
| R4 | **RGPD / datos de salud** | Media | Alto | §14.4; DPIA; consentimiento explícito; cifrado; minimización. |
| R5 | **Complejidad del motor** retrasa el valor | Alta | Medio | Roadmap con uso manual primero (H3); motor por etapas con golden cases. |
| R6 | **Alcance excesivo** (objetivos, tests, métodos) | Alta | Medio | Catálogos como datos: se amplían sin código; priorizar 4 perfiles de los Excel en H3. |
| R7 | **UX del cliente** demasiado compleja → baja adherencia de registro | Media | Alto | Registro en 1 toque; pruebas con usuarios reales en H3; métricas de abandono del registro. |
| R8 | **Editor del entrenador lento** comparado con Excel | Alta | Alto | Editor tipo hoja con teclado, edición masiva, plantillas y progresiones declarativas; medir tiempo de creación de plan. |
| R9 | **Escasez de valores de referencia** válidos por población | Alta | Medio | Mostrar "Referencia insuficiente"; comparar intra-individuo (vs. evaluación previa con MDC) como vía principal. |
| R10 | **Enlaces de vídeo rotos o no verificados** | Alta | Bajo | Estado y fecha de verificación; job periódico que comprueba disponibilidad; siluetas propias como respaldo. |
| R11 | **Dependencia de un desarrollador** / mantenimiento | Media | Alto | TypeScript único, documentación, tests, arquitectura simple. |
| R12 | **Precisión de autoinformes** (RIR, dolor, cargas) | Alta | Medio | Mostrar como autoinforme; la evidencia indica que la precisión del RIR mejora con experiencia y cerca del fallo (ver anexo); usar tendencias, no valores aislados. |
| R13 | **Conectividad en gimnasio** | Media | Medio | Offline-first del reproductor (§4.5). |
| R14 | **Lock-in de librería de auth** | Baja | Medio | Spike en Fase 1; tablas de usuario propias; adaptadores. |

---

## 18. Análisis de los documentos aportados

Informes completos en `/docs/research/`:
- `analysis_excel_workbooks.md`: los 4 Excel.
- `analysis_accommodating_resistance_pdf.md`: el manual en PDF.
- `qa_references_user_documents.md`: verificación de las 90 referencias citadas.
- `evidence_strength_hypertrophy.md`, `evidence_power_speed_methods.md` y `assessment_tests_database.md`: investigación propia.

### 18.1 Los 4 Excel ("Rutinas Generales 1–4")

| Libro | Perfil | Estructura |
|---|---|---|
| WB1 | Hipertrofia, adulto intermedio | Fullbody 3 días/sem, 5 mesociclos, 36 semanas |
| WB2 | Salud y fuerza funcional | Fullbody 3 días/sem, 5 mesociclos, 36 semanas |
| WB3 | Rendimiento en deporte de equipo | Fullbody 3 días/sem, 5 mesociclos, 20 semanas |
| WB4 | Híbrido fútbol/balonmano | Fullbody 3 días/sem, 5 mesociclos, 36 semanas |

**Conocimiento útil que se conserva, como plantillas y reglas configurables:**
- Secuencia de énfasis por mesociclo (adaptación → volumen → excéntrico/tendón → RFD → velocidad), con todas las cualidades mantenidas en cada sesión.
- Microciclo 3:1 (introducción, progresión, pico, descarga) con volumen e intensidad relativos.
- Orden de la sesión: activación → pliometría/neural → fuerza principal → superseries/accesorios → acondicionamiento.
- Doble progresión con O'Connor, con estas reglas:
  - Sube la carga si todas las series llegan al tope.
  - Baja la carga como máximo 2 escalones.
  - Descarga: −1 serie y RIR +2.
  - Cambio de rango: recálculo desde el e1RM.
- Métodos usados: cluster, triserie, superserie, contraste, rest-pause, drop set, excéntrico acentuado e isometría con progresión tiempo → carga.
- Indicadores de la hoja "Volumen y cualidades", que inspiran §12.8: % de tiempo y de series por cualidad, series efectivas por músculo (1/0,5), series por patrón, ratio tracción/empuje, contactos y duración.
- Evaluación:
  - 1RM por tres vías.
  - Perfil F-V de Samozino.
  - Batería de fútbol (CMJ, SJ, RSImod, sprints, 505, déficit COD, 30-15 IFT).
  - Escalado alométrico.
- Una batería preventiva de 93 fichas.
- Un banco de 591 a 1 129 ejercicios con silueta, vídeo y fuente.

**Lo que no se traslada tal cual (incoherencias detectadas):**

| # | Problema | Decisión en la plataforma |
|---|---|---|
| 1 | Se piden 12-20 series por músculo, pero el cálculo da 9-10 en cuádriceps frente a 15-23 en bíceps/espalda (WB1) | El indicador de §12.8 avisa al entrenador en vivo; el umbral es configurable |
| 2 | Ratio tracción/empuje: "≥1,2" en una hoja, ">1" en otra; no hay evidencia de que prevenga lesiones (G/E) | Indicador descriptivo, sin aviso por defecto |
| 3 | Los contactos declarados no coinciden con los calculados (WB4 M5: ≈90-110 frente a 39) | Los contactos siempre se calculan desde la prescripción |
| 4 | Textos de carga que no coinciden con lo que da la fórmula (cluster "~70 %" que sale al 78 %; M4 "80-83 %" que sale ≈85 %) | Un único origen: la prescripción genera el texto, nunca al revés |
| 5 | "Tips" de plantilla que no cuadran con la fila | Los textos se generan desde los datos |
| 6 | Dos estimadores de 1RM (Epley/Brzycki para evaluar, O'Connor para entrenar), que difieren +6,7 % con 10 reps | Ecuación configurable por organización y la misma en toda la serie; se muestra cuál se usó |
| 7 | Dos sistemas normativos: van den Hoek (powerlifters de competición) y Strength Level (web colaborativa, sin revisión por pares → H) | No se usan como referencia de población general; Strength Level no se carga |
| 8 | Comparativa con z-scores y σ estimada como (P80−P20)/1,683, suponiendo normalidad | Prohibido por §11.6 salvo referencia aplicable con media±DE |
| 9 | Si falta el RIR registrado, se toma el objetivo como si fuera un dato | Se distingue `observado` de `asumido`; nunca se inventa el dato |
| 10 | La herencia del 1RM se hace por **nombre** del ejercicio | Por **ID** |
| 11 | Material declarado frente a ejercicios usados (p. ej. "sin cajones" con Box Jump) | Validador de material en el editor de sesión |
| 12 | Siluetas de la batería mal asignadas; tests anunciados que no existen | Revisión manual en la migración (D11) |
| 13 | Contar como "efectivas" series de activación, preventivas o con RIR 4-6 (D) | Definición de serie efectiva configurable por umbral de RIR |
| 14 | Contraste/PAPE con 20-30'' antes del salto (D: la literatura verificada sugiere ≈3-7 min, EV-PWR-008) | Valor por defecto de 3-7 min, editable |
| 15 | Isometría "analgésica" (Rio 2015, n = 6) | Nivel D (EV-PWR-017 frente a EV-PWR-018); no se presenta como analgésico |
| 16 | Entrenar según el desequilibrio F-V | D: ensayos posteriores sin ventaja clara (fuente pendiente de verificar); módulo opcional y "avanzado", sin reglas automáticas |
| 17 | La ecuación de O'Connor invertida con reps + RIR para prescribir es una construcción propia, no de la fuente | Se documenta como F (práctica) y se muestra como estimación |

**Lagunas de los Excel que la plataforma cubre:**
- Cribado y dolor.
- sRPE y bienestar.
- Registro por serie de velocidad, lado, tempo, descanso y elástico.
- Tests de balonmano.
- Reglas evaluación → programación.
- Ajuste por asistencia.
- Regresiones y sustituciones.
- Calendario competitivo (MD-x).

**Migración (Fase 3/6):**
- Las 4 rutinas pasan a ser **4 plantillas de datos sobre el mismo motor**.
- Las plantillas "manuales" (WB2/WB3, sin autoprogresión) se convierten en reglas explícitas.
- El banco de ejercicios se deduplica y normaliza: nombre, patrón, músculos, material y nivel.
- Los vídeos se importan como `pending_verification`.

### 18.2 Afirmaciones metodológicas de los Excel: clasificación (extracto)

| Afirmación | Nivel | Comentario |
|---|---|---|
| Volumen de 12-20 series/semana para hipertrofia | B | Coherente con la dosis-respuesta (EV-STR-006/007); techo incierto |
| Fullbody 3×/semana | B | A igual volumen, la frecuencia apenas influye (EV-STR-009) |
| RIR para autorregular | B (pendiente) | Fuentes Zourdos/Helms citadas como "cita estándar" y no reverificadas |
| "Más pérdida de velocidad → más hipertrofia" | B/D | Pareja-Blanco 2017 frente a síntesis posteriores; **no verificado en Fase 0** |
| "La sobrecarga excéntrica es un estímulo hipertrófico potente / protege el tendón" | C / C-E | El tendón responde a la magnitud de la carga (EV-PWR-016) |
| Nordic para reducir lesiones de isquios | **B/D** | Resolución del conflicto entre agentes: el análisis de los Excel lo daba como A, pero el reanálisis de Impellizzeri 2021 (EV-PWR-022) declara la magnitud inconclusa. Se adopta "puede reducir el riesgo; magnitud incierta" |
| FIFA 11+ y programas de aterrizaje | B (pendiente) | Solo verificado en la QA de referencias (población: chicas de 13-17 años); no extrapolar a otras poblaciones |
| Ratio tracción/empuje ≥ 1,2 | G/E | Sin evidencia de resultado |
| Microciclo 3:1 con descarga | F | Práctica estándar |
| Progresión metabólica → mecánica | E/D | Hipertrofia similar en un amplio rango de cargas cerca del fallo (EV-STR-012) |
| "Nunca 5 series; 4 solo en el principal" | G | Criterio del entrenador (declarado como tal) |
| Escalado alométrico ^0,67 | B | Folland 2008: válido en poblaciones magras; con >20 % de grasa se propone ≈0,45. Relevante para el perfil de salud |

La tabla completa (56 afirmaciones) está en el anexo §9.

### 18.3 Manual de resistencias acomodadas (PDF, 77 págs.)

**Contenido:**
- 29 capítulos y 50 fichas de ejercicio.
- Matriz de decisión.
- Sistema de etiquetas propio:
  - Nivel: SÓLIDA / MODERADA / LIMITADA / CONTRADICTORIA / INSUFICIENTE / PRÁCTICA.
  - Tipo: [EVIDENCIA DIRECTA] / [INDIRECTA] / [PRINCIPIO BIOMECÁNICO] / [INFERENCIA] / [PROPUESTA PRÁCTICA].
- Ese sistema es compatible con el nuestro y se mapea a A–H y a hecho/inferencia/hipótesis.

**Hallazgos útiles:** son cifras del manual; sus fuentes **siguen sin verificar** en la QA (§18.4).
- **Bandas o cadenas añadidas a la barra frente a carga constante, para fuerza máxima: TE 0,80.** Interactúa con la carga y el nivel de entrenamiento:

  | Grupo | Carga ≥ 80 % 1RM | Carga < 80 % 1RM |
  |---|---|---|
  | Entrenados | TE 0,76 | TE 0,00 |
  | No entrenados | TE −0,04 | TE 2,38 |

- **Banda como único medio frente a pesas o máquinas:** sin diferencia (DME −0,11 y −0,011).
- **Personas mayores:** el manual lo califica de respaldo amplio (25 ECA, 1 318 participantes), pero el comparador es "sin intervención".
- **Hipertrofia, core y prevención:** evidencia INSUFICIENTE según el propio manual.
- **Dosis:**
  - 20-35 % de la carga total en lo alto del recorrido: es una PROPUESTA, y el manual da otros valores contradictorios (5-30 %; barra ≥ 40-60 %).
  - Ninguna fila de la tabla de dosis tiene origen "demostrado".
- **Medición de la tensión:** el color de la banda por sí solo no sirve. Hay que prescribir **banda + posición marcada + RIR**, o mejor un dinamómetro o célula de carga.

**Problemas detectados:**
1. **Numeración de citas desplazada:**
   - Las citas [2]–[6] del texto apuntan a las referencias 3–7 de la lista, y las [17]–[21] a las 15–19.
   - Las referencias 20 y 21 no tienen ninguna cita correcta.
   - Hay que remapear antes de importar nada.
2. **La autoauditoría del manual no cuadra:** dice "8 de 12" referencias verificadas, pero hay 21, y dice "40 fichas", pero hay 50.
3. **Fichas 14, 18, 28 y 43:** dan datos etiquetados como [EVIDENCIA DIRECTA] sin ninguna cita.
4. **Sobreafirmaciones:**
   - La rehabilitación aparece como MODERADA con referencias que no son de rehabilitación.
   - La matriz da el veredicto máximo a usos que solo tienen respaldo biomecánico.
   - La matriz mezcla nivel de evidencia y adecuación al contexto en un único veredicto.
5. **Faltan contraindicaciones** (látex, embarazo, osteoporosis, hipertensión), curvas de tensión de bandas comerciales y un protocolo de calibración.

**Implicaciones de diseño, ya incorporadas:**
- Separar método (*resistencia acomodada*), implemento (banda o cadena) y modo de uso de la banda (resistencia, asistencia o perturbación).
- La matriz se guarda con **dos campos**: fuerza de la evidencia y adecuación al contexto.
- Inventario de bandas por organización, con tensión calibrada frente a elongación (opcional).
- `band_tension` registra banda + posición/elongación + RIR; `chain_load_kg` registra la carga de la cadena y su longitud colgante.
- Campo de plano en el ejercicio, que las fichas del manual no tienen.
- Las 50 fichas se importarán como ejercicios con el método "resistencias acomodadas" enlazado, sus niveles de evidencia mapeados y los vídeos como `pending_verification`.

### 18.4 QA de referencias de los documentos aportados

90 referencias únicas: 69 de los Excel y 21 del PDF.

| Estado | n | Detalle |
|---|---|---|
| Verificada | 49 | |
| Verificada con correcciones | 8 | Títulos, DOI o PMID corregidos: Folland 2008, van den Hoek 2024, Sánchez-Medina 2017, Greig 2023, Flanagan 2008, McGuigan 2006, Compton 2025 y remo tumbado 2014 |
| No verificada | 23 | Las 21 del PDF (agotado el cupo de búsquedas), más 2 de los Excel |
| No científica | 10 | strengthlevel.com, strengthcalculator.org, libros con ecuaciones clásicas, documentos internos y criterios del entrenador |

**Afirmación atribuida frente al resumen,** en las 57 verificadas:
- Coincide: 34.
- Coincide en parte: 13.
- No comprobada: 10.
- No se encontró ninguna cifra que contradiga el resumen.

**Afirmaciones que van más allá de lo que dice la fuente:**
- Folland: el exponente 0,67 se presenta como universal y no lo es.
- Suchomel: "sentadilla ≈ 2×MC" no aparece en el resumen.
- Sáez de Villarreal: el resumen habla de saltos por sesión, no de contactos semanales.
- Zourdos: el resumen no dice que el RIR sea más preciso cerca del fallo.
- LeSuer: no se menciona que todas las ecuaciones infraestimaron el 1RM en peso muerto.
- Samozino 2012: la solución analítica la dedujo el autor del Excel.
- van den Hoek: los percentiles P25/P75 proceden de una fuente secundaria.

**Avisos de extrapolación:**
- V1RM, pérdida de velocidad y perfil F-V proceden de hombres entrenados o de élite y se aplican a población general, mujeres y mayores.
- Rio 2015: n = 6.
- NSCA y el test de sentarse-levantarse: solo ≥ 60 años.
- FIFA 11+: chicas de 13 a 17 años.
- Nordic y Copenhague: futbolistas varones, y se aplican al balonmano.
- Ningún dato de tensión de banda procede de un estudio verificado.

### 18.5 Limitaciones de la investigación de la Fase 0 (transparencia)

- **Sin acceso directo a las bases de datos:** la política de red del entorno bloqueó PubMed, PMC, Crossref, doi.org, Europe PMC y las webs de las editoriales. La verificación se hizo **solo con el buscador web**, cotejando fichas de PubMed y de editoriales en los resultados.
- **Ningún DOI se resolvió contra Crossref.**
- **Las cifras proceden de resúmenes tal como los muestra el buscador.** No se leyeron textos completos.
- **Cupo de búsquedas agotado:** el límite de la sesión (200) se agotó. Quedaron sin cubrir varios temas (§10.7, §19 D2) y las 21 referencias del PDF.

| Ámbito | Verificadas | Parciales | Sin verificar |
|---|---|---|---|
| Fuerza e hipertrofia | 12 | 11 | 17 |
| Potencia, velocidad y métodos | 22 | 7 | ≈16 |
| Tests | 13 | 24 | ≈16 |

- **Consecuencia:** el contenido de `/docs/research/` es un **registro de partida**, no una base de evidencia de producción. En la Fase 4 se repetirá la verificación con acceso directo (D1) antes de cargar nada con estado `verified`.

---

## 19. Decisiones abiertas

| # | Decisión | Opciones | Recomendación | Quién decide |
|---|---|---|---|---|
| D1 | **Segunda verificación científica** con acceso directo a Crossref/PubMed (bloqueados por la política de red del entorno en la Fase 0) | Habilitar `api.crossref.org`, `eutils.ncbi.nlm.nih.gov`, `pubmed.ncbi.nlm.nih.gov`, `doi.org` en la red del entorno · o ampliar el límite de búsquedas · o verificación manual | Habilitar dominios y ejecutar una pasada automática al inicio de la Fase 4 | Usuario |
| D2 | Temas sin evidencia verificada: core, movilidad/estiramientos, concurrente, perfil F-V, RSA, fuerza en deportes de equipo, RIR/VBT (precisión y pérdida de velocidad), periodización y *deload* | Verificar antes de la Fase 4 · o lanzar Fases 1–3 en paralelo | Paralelo: las Fases 1–3 no dependen de esa evidencia | Usuario |
| D3 | ~~Librería de autenticación~~ **Resuelta en Fase 1**: módulo propio (ADR-002) | — | — | — |
| D4 | Hosting UE | PaaS (p. ej. con PostgreSQL gestionado en UE) · VPS gestionado | PaaS al inicio (menos operación) | Usuario (coste) |
| D5 | Umbrales por defecto de alertas y de necesidades | Valores sugeridos (F) · dejar vacíos hasta que el entrenador los fije | Sugeridos para alertas de adherencia/dolor (seguridad); **vacíos** para umbrales normativos (fuerza relativa, CMJ…) | Usuario |
| D6 | ¿Aplicar progresiones rutinarias sin confirmación? | Nunca · opcional por cliente | Opcional por cliente, desactivado por defecto | Usuario |
| D7 | Retención de datos y DPIA | — | Requiere asesoramiento legal | Usuario + asesor |
| D8 | ¿Admitir menores? | No · sí con tutores | No en la primera versión | Usuario |
| D9 | Revisión sanitaria de banderas rojas y textos de derivación | — | Obligatoria antes de producción | Profesional sanitario |
| D10 | Siluetas: encargar set propio o generar SVG | Ilustrador · generación + revisión | Set propio SVG para los ~150 ejercicios iniciales | Usuario |
| D11 | Migración de los Excel | Importar tal cual · normalizar y revisar | Normalizar (§18.1) y revisar con el entrenador ejercicio a ejercicio | Usuario |
