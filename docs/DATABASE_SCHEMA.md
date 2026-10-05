# Esquema de base de datos (reestructuración)

> PostgreSQL 16 con Drizzle. **97 tablas existentes**, que se conservan. Este documento describe:
> - qué se reutiliza para cada módulo del nuevo producto;
> - qué columnas y tablas se añaden, y en qué fase (`IMPLEMENTATION_ROADMAP.md`).
>
> El detalle técnico de las tablas actuales sigue en `DATABASE.md`.

## 1. Reglas comunes

- **Organización**: toda fila de negocio lleva `organization_id`. Los catálogos globales tienen `organization_id = NULL` y son de solo lectura; cada organización puede añadir los suyos.
- **RLS**: cada tabla nueva entra en `packages/db/src/rls/policies.ts` y en la matriz `rls-matrix.security.test.ts`. Sin esa entrada, el test de cobertura falla.
- **Auditoría**: altas, cambios, borrados y exportaciones pasan por `audit_logs`, que es de solo inserción.
- **Datos de salud** (art. 9 RGPD): solo con consentimiento `health_data`. El texto libre de salud se cifra en columna (AES-256-GCM, rotación con `pnpm keys:rotate`).
- **Historial (§49)**: lo realizado o cerrado no se reescribe.

| Objeto | Cómo se protege |
|---|---|
| Plan | `plan_revisions` guarda una instantánea en cada cambio relevante |
| Sesión realizada | `set_logs` y `attendance` no se editan después de cerrarse: se corrigen con una fila nueva que referencia a la anterior |
| Evaluación | Al pasar a `completed` queda bloqueada; una corrección crea una versión con motivo |
| Informe | Instantánea congelada con hash (`reports.snapshot`/`hash`) |
| Plantilla | Cada edición crea una versión (`plan_template_versions`, fase 3) |
| Lesión | Cambios de fase y comprobaciones de criterios son filas nuevas, nunca actualizaciones |

## 2. Lo que ya existe, por módulo

| Módulo | Tablas |
|---|---|
| Identidad y acceso | `organizations`, `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `auth_sessions`, `invitations`, `password_reset_tokens`, `login_attempts`, `api_rate_limits`, `user_recovery_codes` |
| Clientes | `clients`, `trainers`, `trainer_client_assignments`, `client_training_profiles` (experiencia, días/semana, minutos, notas), `client_availability`, `client_equipment`, `client_goals`, `client_history_entries`, `health_declarations`, `screening_responses`, `consents` |
| Catálogos | `goals`, `sports`, `equipment` |
| Ejercicios | `exercises`, `movement_patterns`, `muscles`, `exercise_categories`, `exercise_tags`, `exercise_*_links`, `exercise_muscles`, `exercise_equipment`, `exercise_media` (silueta, vídeo), `exercise_progressions` (progresión/regresión/variante), `exercise_instructions`, `prescription_variables`, `prescription_profiles` |
| Planificación | `training_plans`, `plan_revisions`, `phases`, `mesocycles`, `microcycles` (semana), `sessions`, `session_blocks`, `session_exercises` (series, reps, carga, %1RM, RIR, RPE, descanso, tempo, método, alternativas, notas), `exercise_sets`, `plan_templates` |
| Evaluación | `assessment_tests` (unidad, dirección de mejora `higher`/`lower`/`target_range`, agregación `best`/`mean`/`mean_of_best_n`/`last`, protocolo), `test_reliability_data` (ICC, SEM, MDC), `reference_values`, `assessment_batteries`, `battery_tests`, `assessments`, `assessment_results` (intentos y valor agregado), `derived_metrics` |
| Seguimiento | `attendance` (completada, parcial, no realizada, reprogramada, cancelada), `set_logs`, `feedback` (RPE de sesión, fatiga, motivación, dolor), `exercise_feedback`, `readiness`, `pain_logs`, `exercise_substitutions`, `exercise_tolerances` |
| Decisión (oculto) | `rule_sets`, `rules`, `client_rule_overrides`, `recommendations`, `recommendation_evidence`, `alerts`, `manual_overrides`, `decision_runs`, `client_trait_flags` |
| Ciencia | `evidence_sources` (DOI/PMID verificados), `evidence_findings`, `knowledge_claims`, `claim_evidence`, `methods`, `method_variables`, `method_evidence`, `method_notes`, `evidence_reviews`, `populations`, `outcomes` |
| Plataforma | `reports`, `files`, `notifications`, `import_jobs`, `import_rows`, `domain_events`, `integration_connections`, `external_measurements`, `privacy_requests`, `audit_logs` |

## 3. Cambios por fase

### Fase 1 · Clientes y perfiles ✅

**`programming_profiles`** (catálogo; §3; migraciones `0035`/`0036`). Añadir un perfil es añadir una fila. Se siembran 16 perfiles globales (`packages/db/src/seed/profiles.ts`).

| Columna | Tipo | Nota |
|---|---|---|
| `id`, `organization_id` | uuid | `NULL` = global; si no, propio de la organización |
| `slug`, `name` | text | p. ej. `deportes-equipo`, «Deportes de equipo». Único por organización |
| `family` | text | `rendimiento` · `salud` · `fuerza_hipertrofia` · `readaptacion` · `poblacion_especifica` · `personalizado` |
| `description` | text | Para quién es y qué prioriza |
| `levels` | jsonb | `{"1": {"name", "summary"}, "2": {…}, "3": {…}}`: qué cambia en cada nivel para este perfil |
| `default_goal_slug` | text | Objetivo que el alta propone al elegir el perfil |
| `default_battery_slug` | text | Batería de evaluación sugerida (fase 4) |
| `radar_dimensions` | text[] | Dimensiones sugeridas del radar (fase 5) |
| `sort_order`, `archived_at` | | |

**RLS**: tipo `catalog` (lectura de los globales y de los propios; escritura solo de los propios). Está en la matriz de seguridad.

Las 10 dimensiones del §4 (complejidad, intensidad, volumen, densidad, especificidad, velocidad, demanda neuromuscular, control técnico, tolerancia y experiencia) son comunes a todos los perfiles: están en el dominio (`LEVEL_DIMENSIONS`, `packages/domain/src/clients/levels.ts`), no repetidas en cada fila.

**`clients`**: nuevas columnas.

| Columna | Tipo | Nota |
|---|---|---|
| `programming_profile_id` | uuid → `programming_profiles` | Perfil principal (selector) |
| `programming_level` | smallint 1–3 (`CHECK`) | Nivel de programación. Lo decide el entrenador; el alta lo sugiere por la experiencia y la evaluación lo ajustará |
| `sport_id` | uuid → `sports` | Deporte principal |

- El perfil y el deporte deben ser globales o de la misma organización: si no, error de validación (`not_found`).
- El trigger `clients_client_self_update` usa una lista de campos permitidos: el cliente no puede cambiar su perfil ni su nivel desde su app.

El resto de campos del §2 ya existían y se escriben desde el alta rápida:
- objetivo → `client_goals` principal;
- experiencia, frecuencia, lugar y observaciones → `client_training_profiles`;
- material → `client_equipment`;
- sexo y fecha de nacimiento (la edad se calcula) → `clients`.

**`scheduled_job_runs`** (fase 0, `0033`/`0034`): una fila por trabajo y día para que los trabajos diarios se ejecuten una sola vez. RLS `system_only`.

### Fase 2 · Ejercicios, sesiones y planificación ✅

- **`exercise_categories`**: las categorías del §11 en su orden (fuerza, hipertrofia, potencia, velocidad, pliometría, isométricos, excéntricos, core, movilidad, coordinación, equilibrio, reducción de factores de riesgo, readaptación) seguidas de las específicas. El arranque las mantiene alineadas (nombre y orden); se añadieron `speed` y `risk_reduction`, y `reconditioning` se llama «Readaptación». Sin migración: solo datos.
- **`session_exercises.position`** se usa para ordenar, mover, duplicar debajo y pegar (reordenación en dos pasos por la restricción única por bloque).
- **`session_exercises.version`** es el bloqueo optimista de cada fila de la tabla: cada celda se guarda con `expectedVersion`.
- Sin tablas nuevas en esta fase.
- **`set_logs.corrects_id`** (uuid, nullable): una corrección de una serie registrada referencia la original en lugar de sobrescribirla.

### Fase 3 · Plantillas, objetivos y niveles

**`plan_templates`**: nuevas columnas.

| Columna | Tipo | Nota |
|---|---|---|
| `profile_slug` | text | Objetivo/perfil |
| `level_n` | smallint 1–3 | Nivel |
| `population` | text[] | `adultos`, `adulto_mayor`, `deportistas`, `jovenes`, `pc_leve`… |
| `equipment_slugs` | text[] | Material necesario (filtro) |
| `kind` | text | `training` · `risk_reduction` · `readaptation` |
| `archived_at` | timestamptz | Archivar sin borrar |

**`plan_template_versions`** (nueva):
- `template_id`, `version`, `definition` (jsonb), `note`, `created_by`, `created_at`;
- cada edición guarda la versión anterior;
- los planes creados desde una plantilla guardan `template_id` y `template_version` (copia independiente, §6).

### Fase 4 · Evaluaciones y referencias

- **`assessment_tests`**: nuevas columnas.
  - `attempts_default` (smallint);
  - `aggregation` admite además `median`, `min` y `max`, como la mediana ISAK de los pliegues o el mejor tiempo de sprint;
  - `bilateral` (bool), que genera derecha/izquierda y asimetría;
  - `material` (text).
- **`reference_values`**: además de media y DT, guarda `population`, `condition`, `source_id`, `limitations` y `kind`:
  - `normative` (media ± DT);
  - `cutoff` (punto de corte);
  - `range` (rango orientativo);
  - `custom` (referencia propia del entrenador).
- **`client_groups`** y **`client_group_members`** (nuevas): un equipo o grupo, para comparar con «la media del equipo» (Z frente al propio grupo).
- **`derived_formulas`** (nueva): fórmulas derivadas con constantes editables (Faulkner, Yuhasz, IMC, fuerza relativa…), con su fuente.

### Fase 5 · Radares y evolución

**`radar_dimensions`** (catálogo):
- columnas `slug`, `name` (Fuerza, Potencia, Velocidad, Aceleración, COD, Resistencia, Reactividad, Movilidad, Equilibrio, Capacidad funcional…) y `family`;
- **`radar_dimension_tests`**: `dimension_id`, `test_id` y `weight`. La dirección la aporta el test.

### Fase 6 · Informes

`reports.type` admite los 8 tipos del §16:
- técnico, cliente, inicial, seguimiento, comparativo, final, rendimiento y readaptación/RTP.

`parameters` guarda la selección: evaluaciones A/B, referencia, dimensiones y secciones. No hay tablas nuevas.

### Fase 7 · Lesiones, readaptación y RTP

```
injury_regions ─< injury_conditions ─< rehab_protocols ─< rehab_phases ─< rehab_criteria
                                            │
clients ─< injury_cases ─────────────────── ┘ (protocolo y versión usados)
              ├─< injury_phase_history      (entradas y salidas de fase: quién y por qué)
              ├─< injury_criterion_checks   (estado de cada criterio en cada momento; solo inserción)
              ├─< injury_symptom_logs       (dolor, inflamación, inestabilidad, síntomas neurológicos…)
              └─< rtp_decisions             (decisión humana registrada: RTS / RTPerf)
```

| Tabla | Columnas clave |
|---|---|
| `injury_regions` (catálogo) | `slug`, `name`. Tobillo/pie, rodilla, cadera, isquiosurales, aductores/ingle, cuádriceps, gemelo-sóleo-Aquiles, hombro, codo, columna/zona lumbar |
| `injury_conditions` (catálogo) | `region_id`, `slug`, `name`, `tissue` (`ligamento`, `musculo`, `tendon`, `articular`, `oseo`, `otro`), `description` |
| `rehab_protocols` (catálogo versionado) | `condition_id`, `name`, `version`, `scope_note` (qué cubre el entrenador y qué no), `evidence_summary`, `status` (`borrador`, `revisado`) |
| `rehab_phases` | `protocol_id`, `position`, `name`, `purpose`, `goals` text[], `exercise_guidance` jsonb, `dose_guidance`, `recommended_test_ids` uuid[] |
| `rehab_criteria` | `phase_id`, `kind`; `role` (`entry`, `success`, `progression`, `regression`, `stop`); `label`; `test_id`, `operator`, `threshold`, `unit`; `required`; `source_id` / `origin`; `population`; `limitations` |
| `injury_cases` | Ver lista debajo |
| `injury_phase_history` | `case_id`, `phase_id`, `entered_at`, `exited_at`, `transition` (`avance`, `regresion`, `mantener`), `decided_by`, `reason` |
| `injury_criterion_checks` | `case_id`, `criterion_id`, `status` (`cumple`, `no_cumple`, `no_aplica`, `pendiente`), `value`, `assessment_result_id`, `checked_by`, `checked_at`, `note` |
| `injury_symptom_logs` | `case_id`, `logged_on`, `source` (entrenador/cliente); `pain_rest`, `pain_activity` y `pain_next_day` (0–10); `swelling`, `instability`, `neuro_symptoms`, `function_loss` y `adverse_reaction` (bool); `note` (cifrada) |
| `rtp_decisions` | `case_id`, `stage` (`return_to_participation`, `return_to_sport`, `return_to_performance`), `decision` (`autorizado`, `no_autorizado`, `aplazado`), `responsible_name`, `responsible_role`, `team` (text), `decided_at`, `notes` |

Columnas de `injury_cases`:
- `client_id`, `condition_id`, `side`;
- `injury_date`, `mechanism`;
- `diagnosis_info_enc` (información recibida, **cifrada**);
- `clinician_name`, `clinician_contact_enc`;
- `clinical_discharge_date`;
- `status` (`abierta`, `cerrada`);
- `protocol_id`, `protocol_version`, `current_phase_id`;
- `restrictions`, `notes`.

Kinds de criterio (`kind`): `clinico_recibido`, `sintomas`, `rom`, `fuerza`, `fuerza_relativa`, `asimetria`, `funcional`, `salto`, `hop`, `carrera`, `aceleracion`, `desaceleracion`, `cod`, `potencia`, `especifico`, `carga_tolerada`, `exposicion`, `psicologico`, `equipo`.

**Seguridad de datos**:
- `injury_*` y `rtp_*` son datos de salud: requieren consentimiento, permiso `injuries:read`/`injuries:write` (personal asignado) y RLS de cliente;
- el cliente ve su fase, sus objetivos y sus ejercicios, nunca las notas internas;
- el estado RTP se **calcula** a partir de los criterios y no se guarda como «apto».

### Fase 8 · Cliente móvil, feedback y adherencia

- **`attendance`**: nuevos estados `iniciada` y `no_realizada_automatica` (fichaje del §41). Una sesión publicada cuya fecha pasa sin registro se marca no realizada al día siguiente, en el trabajo diario.
- **RLS de `sessions`**: el cliente solo lee las sesiones con `published = true`.

### Fase 9 · Ciencia y referencias

**`knowledge_claims`**: nuevas columnas.

| Columna | Valores |
|---|---|
| `evidence_kind` | `reduccion_incidencia` · `cambio_factor_riesgo` · `rendimiento` · `mecanismo` · `criterio_practico` · `insuficiente` |
| `origin` | `documento_usuario` · `literatura_externa` · `propuesta_practica` |

Además:
- **`evidence_sources.verification`**:
  - `verificada` (metadatos obtenidos de PubMed o DOI);
  - `citada_en_documento` (pendiente);
  - `no_verificable`.
- **`science_searches`** (nueva): registro de cada búsqueda específica, con objetivo, población, lesión, fase, método, test, criterio, consulta, fecha y resultados.

## 4. Relaciones principales del nuevo flujo

```
programming_profiles ─< clients >─ sports
clients ─< client_goals, client_equipment, client_training_profiles
clients ─< training_plans ─< phases ─< mesocycles ─< microcycles ─< sessions ─< session_blocks ─< session_exercises >─ exercises
plan_templates ─< plan_template_versions ;  training_plans >─ plan_templates (template_id + versión)
clients ─< assessments ─< assessment_results >─ assessment_tests ─< reference_values
assessment_tests ─< radar_dimension_tests >─ radar_dimensions
client_groups ─< client_group_members >─ clients
clients ─< injury_cases (ver fase 7)
clients ─< reports (instantánea congelada)
```
