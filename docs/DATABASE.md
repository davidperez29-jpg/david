# Base de datos

> Fase 2. La fuente de verdad del esquema está en `packages/db/src/schema/*.ts` (Drizzle) y `packages/db/drizzle/*.sql` (migraciones). Este documento explica el diseño, sus reglas y cómo mantenerlo. Diseño original: `MASTER_SPECIFICATION.md` §6.

## 1. Cifras

| Elemento | Cantidad |
|---|---|
| Tablas | 91 |
| Políticas RLS | 168 |
| Triggers de integridad | 32 (más el de auditoría *append-only*) |
| Restricciones `CHECK` | 53 |
| Migraciones | `0000_init`, `0001_audit_append_only`, `0002_extensions`, `0003_phase2_schema`, `0004_rls` |

## 2. Convenciones

1. **Identificadores** UUID v7 generados en la aplicación (`uuidv7()`); ordenables por tiempo.
2. **Tenant**:
   - Las tablas de negocio llevan `organization_id`.
   - Los catálogos usan `organization_id NULL` para el contenido **global** (solo lectura para las organizaciones) y un valor para el contenido propio. Un elemento derivado de uno global guarda `derived_from_id` cuando aplica.
3. **Cliente**: las tablas con datos de una persona llevan `client_id`. En la jerarquía de planificación, `client_id NULL` significa **plantilla**.
4. **Auditoría de columnas**: `created_at`, `updated_at`, `created_by`, `updated_by`; `version` (bloqueo optimista) en entidades editables por varias personas.
5. **Unidades SI** (kg, m, s, m/s, cm, °). La conversión se hace solo en presentación.
6. **Planificado ≠ realizado**:
   - La prescripción (`session_exercises`, `exercise_sets`) nunca se sobrescribe.
   - Lo realizado va en `set_logs`, `attendance`, `feedback`, `exercise_feedback`.
7. **Datos de salud** (marcados `[SALUD]`) en tablas separadas: `health_declarations`, `screening_responses`, `pain_logs`, `exercise_tolerances`. El texto libre va cifrado (`*_enc`, AES-256-GCM).
8. **Sin EAV genérico**:
   - Las variables de prescripción habituales son columnas tipadas.
   - Las raras van en `extra jsonb`, validado contra el catálogo `prescription_variables`.

## 3. Dominios y tablas

### 3.1 Identidad y acceso
| Tabla | Propósito |
|---|---|
| `organizations` | Tenant (centro / negocio). |
| `users` | Cuentas: email único global (en minúsculas), hash argon2id, estado, TOTP cifrado, contadores de bloqueo. |
| `roles`, `permissions`, `role_permissions` | Espejo de la matriz `ROLE_PERMISSIONS` del dominio (se siembra desde el código). |
| `user_roles` | Roles de un usuario en una organización. |
| `auth_sessions` | Sesiones opacas: solo el SHA-256 del token, caducidad por inactividad y absoluta, revocación. |
| `login_attempts`, `password_reset_tokens` | Seguridad. **Solo accesibles por el sistema**. |
| `invitations` | Invitaciones de un solo uso. `payload` guarda los datos del rol. |
| `audit_logs` | Auditoría *append-only*: trigger contra `UPDATE`, `DELETE` y `TRUNCATE`, más `REVOKE` al rol de ejecución. |

### 3.2 Clientes
`trainers`, `clients`, `trainer_client_assignments` (principal/colaborador; al menos una activa), `client_training_profiles`, `client_availability`, `client_equipment`, `client_goals` (índice único parcial: un objetivo principal activo), `client_history_entries`, `health_declarations` [SALUD], `screening_responses` [SALUD], `consents` (versionados y revocables).

### 3.3 Catálogos estructurales
| Tabla | Contenido global sembrado |
|---|---|
| `goals` | 17 objetivos (§2.2). |
| `sports` | 16 deportes. |
| `equipment` | 30 elementos de material (incluye dispositivos de medición). |
| `movement_patterns` | 17 patrones (los de la metodología del usuario). |
| `muscles` | 26 músculos con `group_slug` para contar series semanales por grupo. |
| `exercise_categories` | 24 categorías (§15), jerárquicas mediante `parent_id`. |
| `exercise_tags` | (vacío; para la organización). |
| `prescription_variables` | 28 variables (§12.4); `is_typed_column` indica si tienen columna propia. RIR 0–10. |
| `prescription_profiles` | 10 perfiles: qué variables se muestran por tipo de ejercicio (§12.5). |
| `populations` | 11 poblaciones para comprobar la aplicabilidad (§10.5). Son taxonomía, no afirmaciones. |
| `outcomes` | 21 desenlaces. |

### 3.4 Biblioteca de ejercicios (capa B)
- **`exercises`**:
  - Patrón, región, lateralidad, planos, contracción, velocidad prevista, nivel, espacio, complejidad 1–5, carga axial, impacto.
  - Textos separados para el cliente y para el entrenador.
  - Perfil de prescripción, `supports_vbt`, `contacts_per_rep`, estado de publicación.
  - Índice trigram (`pg_trgm`) sobre el nombre.
- **Tablas puente**: `exercise_category_links`, `exercise_tag_links`, `exercise_muscles` (primario/secundario/estabilizador), `exercise_equipment` (opcional o no).
- **`exercise_method_links`**: el ejercicio enlaza con la capa científica solo por id.
- **`exercise_media`** (silueta, imagen, vídeo):
  - Estado `pending_verification` por defecto.
  - `CHECK`: un medio verificado exige `verified_at`.
- **`exercise_progressions`**: grafo dirigido de progresión, regresión y variante, con los ejes que cambian. Sin auto-referencias.
- **`exercise_instructions`**: cues, errores, precauciones y pasos, ordenados y por audiencia.

### 3.5 Biblioteca científica (capa A)
- **`evidence_sources`**:
  - Metadatos completos, diseño, `verification_status` y `access` (qué se leyó realmente).
  - `CHECK` de formato de DOI y PMID.
  - Una fuente marcada como verificada exige fecha y método de verificación.
  - DOI y PMID únicos por ámbito.
- **`evidence_findings`**: un resultado de un estudio, con su población y desenlace, efecto, IC, n, I², nivel A–H, `grading_rationale` y tipo epistémico.
- **`knowledge_claims`** (afirmaciones nuestras) y **`claim_evidence`** (apoya, contradice o da contexto).
- **`methods`**: método, tipo de contracción, organización, autorregulación.
- **`method_variables`**: rangos de dosis por población y objetivo, cada uno justificado por una afirmación (`claim_id`).
- **`method_evidence`**, **`method_notes`** (mecanismo, indicación, precaución, progresión, limitación) y **`evidence_reviews`** (QA científico).

### 3.6 Evaluación
- **`assessment_tests`**: protocolo versionado, unidad, dirección de mejora, intentos, agregación, lateralidad, fórmulas derivadas y fuentes.
- **`test_reliability_data`**:
  - Por población y método de medida: ICC, CV, SEM, MDC95, SWC.
  - Exige fuente, salvo que la fiabilidad sea **local** (test-retest propio).
- **`reference_values`**: **población y fuente obligatorias** (NOT NULL), estadístico y método de medida.
- **`assessment_batteries`** y **`battery_tests`**: plantillas por objetivo.
- **`assessments`**: el evento de evaluación.
- **`assessment_results`**: intentos brutos, mejor, media, valor de comparación, CV intra-sesión, dispositivo, validez y origen.
- **`derived_metrics`**: fórmula y versión, si es estimación y su error.

### 3.7 Planificación
`training_plans` (`kind` CLIENT_PLAN | TEMPLATE | PROPOSAL) → `phases` → `mesocycles` → `microcycles` → `sessions` → `session_blocks` → `session_exercises` → `exercise_sets`. Además, `plan_revisions` guarda una instantánea y el diff de cada revisión.

Restricciones relevantes:
- `duration_months ∈ {3, 6, 9, 12}` y sesiones por semana 1–7.
- `TEMPLATE ⇔ client_id IS NULL`.
- Repeticiones: mínimo ≤ máximo.
- RIR entre 0 y 10, con mínimo ≤ máximo.
- RPE entre 1 y 10 en pasos de 0,5.
- Pérdida de velocidad entre 0 y 60 %; %1RM entre 0 y 110.
- Tempo con formato `exc-pausa-con-pausa` (por ejemplo `3-1-X-0`).
- Posiciones únicas dentro de cada nivel.

### 3.8 Seguimiento
- **Por sesión**: `attendance` (una por sesión), `set_logs`, `feedback` y `exercise_feedback`.
  - `set_logs.rir_assumed` distingue un dato registrado de uno supuesto.
  - `client_mutation_id` es único, para la sincronización offline idempotente.
- **Diarios y de salud**: `readiness` (una por día), `pain_logs` [SALUD], `exercise_substitutions`, `exercise_tolerances` [SALUD].
- Escalas de 0 a 10 con `CHECK`.

### 3.9 Motor de decisiones
- **Reglas**:
  - `rule_sets`: versiones; una versión publicada es inmutable.
  - `rules`: condición y acción en JSON, parámetros editables, nivel de evidencia, afirmaciones que la sostienen, poblaciones.
  - `client_rule_overrides`: desactivar una regla para un cliente concreto.
- **`recommendations`**:
  - Guarda la explicación, la instantánea de entradas y la versión de reglas.
  - `CHECK`: una recomendación decidida exige `decided_at`.
  - Se completa con `recommendation_evidence`.
- **`alerts`** (verde, amarillo, rojo; abierta, vista, resuelta) y **`manual_overrides`** (valor propuesto frente a final).
- Las propuestas de programa son `training_plans` con `kind = PROPOSAL`.

### 3.10 Plataforma
- `notifications`, `files`, `reports`, `import_jobs` e `import_rows`.
- `domain_events`: *outbox* que procesa el worker.
- `integration_connections` (credenciales cifradas) y `external_measurements` (con deduplicación por `source` + `external_id`).

## 4. Integridad entre organización y cliente

| Mecanismo | Tablas | Efecto |
|---|---|---|
| `inherit_scope(parent, fk)` (trigger BEFORE INSERT/UPDATE) | Jerarquía de planificación, `attendance`, `set_logs`, `feedback`, `exercise_feedback`, `assessment_results`, `import_rows` | Copia `organization_id` y `client_id` del padre. Un hijo **no puede** apuntar a otro tenant ni a otro cliente, aunque la aplicación envíe valores erróneos. Si el padre no es visible, falla. |
| `check_client_org()` (trigger) | 16 tablas con `organization_id` + `client_id` | Rechaza un `client_id` que no pertenezca a `organization_id`. |

## 5. Row Level Security (defensa en profundidad)

### 5.1 Modelo
- **Peticiones de usuario**: cada caso de uso de `@tp/application` se envuelve en `secured()`, que abre una transacción y ejecuta `bindActor()`:
  ```sql
  SELECT set_config('app.org_id', …, true), set_config('app.user_id', …, true),
         set_config('app.roles', 'ADMIN,TRAINER', true), set_config('app.trainer_id', …, true),
         set_config('app.client_id', …, true), set_config('role', 'app_runtime', true)
  ```
  A partir de ahí la transacción se ejecuta como el rol `app_runtime` (NOLOGIN, NOBYPASSRLS) y PostgreSQL aplica las políticas.
- **Trabajo de sistema** (login, aceptar invitación, resolver la sesión, migraciones, seeds, worker): se ejecuta como propietario de las tablas, que no está sujeto a RLS.
- **Denegación por defecto**: sin variables de sesión, las funciones auxiliares devuelven `NULL` y toda comparación falla, así que no se ve ninguna fila.

### 5.2 Funciones auxiliares
`app_org_id()`, `app_user_id()`, `app_client_id()`, `app_trainer_id()`, `app_has_role(r)`, `app_is_staff()`, `app_client_visible(id, org)`, `app_can_access_client(id)` (que pasa a su vez por la RLS de `clients`) y `email_in_use(email)` (SECURITY DEFINER: comprueba un email en todas las organizaciones sin revelar cuál lo usa).

### 5.3 Tipos de política (`packages/db/src/rls/policies.ts`)
| Tipo | Lectura | Escritura |
|---|---|---|
| `catalog` | Global (`organization_id NULL`) o de la propia organización | Staff, solo en su organización (lo global no es editable) |
| `catalog_child` | Si el padre es visible | Staff, si el padre es de su organización |
| `client_child` | Si el cliente es visible | Staff; el cliente solo en `client_availability` y `consents` |
| `client_owned` | Organización + cliente visible (algunas tablas solo staff) | Según la tabla: seguimiento sí para el cliente; evaluación, decisiones y salud no |
| `client_optional` | Como `client_owned`; `client_id NULL` (plantillas) solo staff | Staff |
| `system_only` | — | — (sin privilegios) |
| `global_readonly` | Todos (sin RLS) | — |
| `custom` | Ver el mapa (`users`, `clients`, `auth_sessions`, `audit_logs`…) | |

Visibilidad de `clients`:
- **ADMIN**: toda su organización.
- **TRAINER**: solo los clientes con asignación activa.
- **CLIENT**: solo su propia ficha.

Auditoría:
- Solo se puede insertar con `actor_user_id = app_user_id()`; no se puede suplantar a otro actor.
- La leen el staff y únicamente para clientes visibles.

### 5.4 Mantenimiento
1. Cada tabla nueva **debe** añadirse a `RLS_POLICIES`; el test `RLS coverage` falla si alguna tabla de `public` no aparece.
2. Si cambia el mapa:
   ```bash
   pnpm --filter @tp/db exec drizzle-kit generate --custom --name rls_v2
   pnpm --filter @tp/db rls:generate > packages/db/drizzle/<nuevo>_rls_v2.sql
   ```
   El SQL generado es **idempotente**: borra y recrea las políticas y los triggers de las tablas mapeadas. Un test comprueba que la última migración `*_rls*.sql` coincide con la salida del generador.
3. **Despliegue**:
   - El usuario con el que la aplicación conecta a PostgreSQL debe ser **miembro de `app_runtime`**; la migración ejecuta `GRANT app_runtime TO CURRENT_USER`.
   - Si la app usa un usuario distinto del de las migraciones: `GRANT app_runtime TO <usuario_app>`.
   - Crear el rol requiere `CREATEROLE`; en PostgreSQL gestionado, el rol administrador suele tenerlo.

## 6. Comandos

| Comando | Acción |
|---|---|
| `pnpm db:generate` | Genera una migración a partir de cambios en el esquema Drizzle. |
| `pnpm db:migrate` | Aplica las migraciones pendientes. |
| `pnpm db:seed` | Catálogos y biblioteca científica global verificada (`seed-data/evidence`); idempotente. |
| `pnpm db:reset` | **Solo desarrollo**: borra el esquema, migra y siembra. |
| `pnpm db:seed:demo` | Datos ficticios. |
| `pnpm --filter @tp/db rls:generate` | Imprime el SQL de RLS. |

## 7. Pendiente

| Elemento | Fase |
|---|---|
| Tablas de lectura materializadas (`client_metrics_daily`, `plan_volume_summary`) | Cuando existan los cálculos (6–9) |
| Particionado de `audit_logs` y `set_logs` por fecha | 15, si el volumen lo exige |
| Validación de `extra` contra `prescription_variables` en la capa de aplicación | 6 |
| Detección de ciclos en el grafo de progresiones (aplicación) | 3 |

## Biblioteca científica (Fase 4)

- `evidence_sources`: DOI, PMID y `source_key` son únicos **por ámbito** (organización o global) solo cuando tienen valor. Son índices únicos parciales sobre `coalesce(organization_id, 0…0)` (migración `0008`), así que pueden convivir varias fuentes sin DOI.
- `evidence_findings.finding_key` (`tema:clave`) y `evidence_sources.source_key` (migración `0007`) son las claves de la importación idempotente de `seed-data/evidence`.
- Los niveles (`evidence_level`) se **calculan** desde `grading_rationale`; no se editan a mano. Ver `SCIENTIFIC_FRAMEWORK.md`.

## Evaluación (Fase 5)

- Migración `0009`:
  - `assessment_tests.is_estimate`;
  - `assessments.planned_test_ids`;
  - un resultado por evaluación, test y lado (`assessment_results_one_per_side_uq`);
  - una métrica por evaluación (`derived_metrics_assessment_metric_uq`).
- Migración `0010`: `reference_values.sample_size` pasa a `integer` (hay normas con más de 32 767 personas).
- `pnpm db:seed` importa también `seed-data/assessment`: tests, fiabilidad, referencias y baterías globales. Sus fuentes se importan como evidencia verificada.

## Planificación (Fase 6)

- Migración `0011`: tabla `plan_templates` (globales u organizativas), con definición JSON, métodos enlazados y slug único por ámbito.
- Migración `0012_rls_v2`: RLS de tipo `catalog` para `plan_templates`, regenerada desde el mapa.
- `pnpm db:seed` importa además `seed-data/exercises/global.json` (ejercicios globales publicados, progresiones y enlaces a métodos) y `seed-data/templates/*.json`.
