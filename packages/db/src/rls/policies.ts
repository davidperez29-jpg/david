/**
 * Row Level Security map (MASTER_SPECIFICATION §14.3, defence in depth).
 *
 * Every table in `public` must appear here with a policy kind; a test fails otherwise.
 * `scripts/generate-rls.ts` turns this map into a SQL migration.
 *
 * Request-scoped work runs inside a transaction that sets `app.*` settings and
 * `SET LOCAL ROLE app_runtime` (see `bindActor` in @tp/db). System work (login, migrations,
 * worker) runs as the table owner, which bypasses RLS.
 */
export type PolicyKind =
  /** No RLS: global read-only reference data (roles/permissions). */
  | { kind: 'global_readonly' }
  /** RLS on, no policies, no grants: only system code may touch it. */
  | { kind: 'system_only' }
  /** Catalogue: organization_id NULL = global (read-only), otherwise own org. Staff write. */
  | { kind: 'catalog' }
  /** Child of a catalogue table without its own organization_id. */
  | { kind: 'catalog_child'; parent: string; fk: string }
  /** Child of a client (client_id, no organization_id). */
  | { kind: 'client_child'; clientWrite: boolean }
  /** organization_id + client_id NOT NULL. */
  | { kind: 'client_owned'; clientWrite: boolean; clientRead: boolean }
  /** organization_id + client_id NULL-able (NULL = template/org-level, staff only). */
  | { kind: 'client_optional'; clientWrite: boolean; clientRead: boolean }
  /** Custom SQL policies (written verbatim). */
  | { kind: 'custom'; sql: string };

export const RLS_POLICIES: Record<string, PolicyKind> = {
  // ── Identity ────────────────────────────────────────────────────────────────
  roles: { kind: 'global_readonly' },
  permissions: { kind: 'global_readonly' },
  role_permissions: { kind: 'global_readonly' },
  login_attempts: { kind: 'system_only' },
  password_reset_tokens: { kind: 'system_only' },
  organizations: {
    kind: 'custom',
    sql: `CREATE POLICY organizations_select ON organizations FOR SELECT USING (id = app_org_id());
CREATE POLICY organizations_update ON organizations FOR UPDATE USING (id = app_org_id() AND app_has_role('ADMIN')) WITH CHECK (id = app_org_id());`,
  },
  users: {
    kind: 'custom',
    sql: `CREATE POLICY users_select ON users FOR SELECT USING (organization_id = app_org_id() AND (app_is_staff() OR id = app_user_id()));
CREATE POLICY users_update ON users FOR UPDATE USING (organization_id = app_org_id() AND (app_has_role('ADMIN') OR id = app_user_id())) WITH CHECK (organization_id = app_org_id());`,
  },
  user_roles: {
    kind: 'custom',
    sql: `CREATE POLICY user_roles_select ON user_roles FOR SELECT USING (organization_id = app_org_id() AND (app_is_staff() OR user_id = app_user_id()));
CREATE POLICY user_roles_write ON user_roles FOR ALL USING (organization_id = app_org_id() AND app_has_role('ADMIN')) WITH CHECK (organization_id = app_org_id() AND app_has_role('ADMIN'));`,
  },
  auth_sessions: {
    kind: 'custom',
    sql: `CREATE POLICY auth_sessions_all ON auth_sessions FOR ALL
  USING (user_id = app_user_id() OR (app_has_role('ADMIN') AND EXISTS (SELECT 1 FROM users u WHERE u.id = auth_sessions.user_id)))
  WITH CHECK (user_id = app_user_id() OR (app_has_role('ADMIN') AND EXISTS (SELECT 1 FROM users u WHERE u.id = auth_sessions.user_id)));`,
  },
  invitations: {
    kind: 'custom',
    sql: `CREATE POLICY invitations_all ON invitations FOR ALL USING (organization_id = app_org_id() AND app_is_staff()) WITH CHECK (organization_id = app_org_id() AND app_is_staff());`,
  },
  trainers: {
    kind: 'custom',
    sql: `CREATE POLICY trainers_select ON trainers FOR SELECT USING (organization_id = app_org_id());
CREATE POLICY trainers_write ON trainers FOR ALL USING (organization_id = app_org_id() AND app_has_role('ADMIN')) WITH CHECK (organization_id = app_org_id() AND app_has_role('ADMIN'));`,
  },
  audit_logs: {
    kind: 'custom',
    sql: `CREATE POLICY audit_logs_select ON audit_logs FOR SELECT USING (organization_id = app_org_id() AND app_is_staff() AND (client_id IS NULL OR app_can_access_client(client_id)));
CREATE POLICY audit_logs_insert ON audit_logs FOR INSERT WITH CHECK (organization_id = app_org_id() AND actor_user_id = app_user_id());`,
  },

  // ── Clients ─────────────────────────────────────────────────────────────────
  clients: {
    kind: 'custom',
    sql: `CREATE POLICY clients_select ON clients FOR SELECT USING (app_client_visible(id, organization_id));
CREATE POLICY clients_insert ON clients FOR INSERT WITH CHECK (organization_id = app_org_id() AND app_is_staff());
CREATE POLICY clients_update ON clients FOR UPDATE USING (app_client_visible(id, organization_id)) WITH CHECK (organization_id = app_org_id());
CREATE POLICY clients_delete ON clients FOR DELETE USING (organization_id = app_org_id() AND app_has_role('ADMIN'));`,
  },
  trainer_client_assignments: {
    kind: 'custom',
    sql: `CREATE POLICY tca_select ON trainer_client_assignments FOR SELECT USING (organization_id = app_org_id() AND (app_is_staff() OR client_id = app_client_id()));
CREATE POLICY tca_write ON trainer_client_assignments FOR ALL USING (organization_id = app_org_id() AND app_is_staff()) WITH CHECK (organization_id = app_org_id() AND app_is_staff());`,
  },
  client_training_profiles: { kind: 'client_child', clientWrite: false },
  client_availability: { kind: 'client_child', clientWrite: true },
  client_equipment: { kind: 'client_child', clientWrite: false },
  client_goals: { kind: 'client_child', clientWrite: false },
  client_history_entries: { kind: 'client_child', clientWrite: false },
  health_declarations: { kind: 'client_child', clientWrite: false },
  screening_responses: { kind: 'client_child', clientWrite: false },
  consents: { kind: 'client_child', clientWrite: true },

  // ── Catalogues ──────────────────────────────────────────────────────────────
  goals: { kind: 'catalog' },
  sports: { kind: 'catalog' },
  equipment: { kind: 'catalog' },
  movement_patterns: { kind: 'catalog' },
  muscles: { kind: 'catalog' },
  exercise_categories: { kind: 'catalog' },
  exercise_tags: { kind: 'catalog' },
  prescription_variables: { kind: 'catalog' },
  prescription_profiles: { kind: 'catalog' },
  exercises: { kind: 'catalog' },
  exercise_progressions: { kind: 'catalog' },
  exercise_category_links: { kind: 'catalog_child', parent: 'exercises', fk: 'exercise_id' },
  exercise_tag_links: { kind: 'catalog_child', parent: 'exercises', fk: 'exercise_id' },
  exercise_muscles: { kind: 'catalog_child', parent: 'exercises', fk: 'exercise_id' },
  exercise_equipment: { kind: 'catalog_child', parent: 'exercises', fk: 'exercise_id' },
  exercise_media: { kind: 'catalog_child', parent: 'exercises', fk: 'exercise_id' },
  exercise_instructions: { kind: 'catalog_child', parent: 'exercises', fk: 'exercise_id' },
  exercise_method_links: { kind: 'catalog_child', parent: 'exercises', fk: 'exercise_id' },
  populations: { kind: 'catalog' },
  outcomes: { kind: 'catalog' },
  evidence_sources: { kind: 'catalog' },
  evidence_findings: { kind: 'catalog' },
  knowledge_claims: { kind: 'catalog' },
  claim_evidence: { kind: 'catalog_child', parent: 'knowledge_claims', fk: 'claim_id' },
  methods: { kind: 'catalog' },
  method_variables: { kind: 'catalog' },
  method_evidence: { kind: 'catalog_child', parent: 'methods', fk: 'method_id' },
  method_notes: { kind: 'catalog_child', parent: 'methods', fk: 'method_id' },
  evidence_reviews: { kind: 'catalog' },
  assessment_tests: { kind: 'catalog' },
  test_reliability_data: { kind: 'catalog' },
  reference_values: { kind: 'catalog' },
  assessment_batteries: { kind: 'catalog' },
  battery_tests: { kind: 'catalog_child', parent: 'assessment_batteries', fk: 'battery_id' },
  rule_sets: { kind: 'catalog' },
  rules: { kind: 'catalog' },

  // ── Assessment (client data) ────────────────────────────────────────────────
  assessments: { kind: 'client_owned', clientWrite: false, clientRead: true },
  assessment_results: { kind: 'client_owned', clientWrite: false, clientRead: true },
  derived_metrics: { kind: 'client_owned', clientWrite: false, clientRead: true },

  // ── Planning ────────────────────────────────────────────────────────────────
  plan_templates: { kind: 'catalog' },
  training_plans: { kind: 'client_optional', clientWrite: false, clientRead: true },
  plan_revisions: { kind: 'client_optional', clientWrite: false, clientRead: false },
  phases: { kind: 'client_optional', clientWrite: false, clientRead: true },
  mesocycles: { kind: 'client_optional', clientWrite: false, clientRead: true },
  microcycles: { kind: 'client_optional', clientWrite: false, clientRead: true },
  sessions: { kind: 'client_optional', clientWrite: false, clientRead: true },
  session_blocks: { kind: 'client_optional', clientWrite: false, clientRead: true },
  session_exercises: { kind: 'client_optional', clientWrite: false, clientRead: true },
  exercise_sets: { kind: 'client_optional', clientWrite: false, clientRead: true },

  // ── Tracking ────────────────────────────────────────────────────────────────
  attendance: { kind: 'client_owned', clientWrite: true, clientRead: true },
  set_logs: { kind: 'client_owned', clientWrite: true, clientRead: true },
  feedback: { kind: 'client_owned', clientWrite: true, clientRead: true },
  exercise_feedback: { kind: 'client_owned', clientWrite: true, clientRead: true },
  readiness: { kind: 'client_owned', clientWrite: true, clientRead: true },
  pain_logs: { kind: 'client_owned', clientWrite: true, clientRead: true },
  exercise_substitutions: { kind: 'client_owned', clientWrite: true, clientRead: true },
  exercise_tolerances: { kind: 'client_owned', clientWrite: false, clientRead: true },

  // ── Decision ────────────────────────────────────────────────────────────────
  recommendations: { kind: 'client_owned', clientWrite: false, clientRead: false },
  recommendation_evidence: {
    kind: 'custom',
    sql: `CREATE POLICY recommendation_evidence_all ON recommendation_evidence FOR ALL
  USING (EXISTS (SELECT 1 FROM recommendations r WHERE r.id = recommendation_evidence.recommendation_id))
  WITH CHECK (EXISTS (SELECT 1 FROM recommendations r WHERE r.id = recommendation_evidence.recommendation_id));`,
  },
  alerts: { kind: 'client_owned', clientWrite: false, clientRead: false },
  manual_overrides: { kind: 'client_optional', clientWrite: false, clientRead: false },
  client_rule_overrides: { kind: 'client_owned', clientWrite: false, clientRead: false },
  decision_runs: { kind: 'client_owned', clientWrite: false, clientRead: false },
  client_trait_flags: { kind: 'client_owned', clientWrite: false, clientRead: false },

  // ── Platform ────────────────────────────────────────────────────────────────
  notifications: {
    kind: 'custom',
    sql: `CREATE POLICY notifications_select ON notifications FOR SELECT USING (organization_id = app_org_id() AND user_id = app_user_id());
CREATE POLICY notifications_update ON notifications FOR UPDATE USING (organization_id = app_org_id() AND user_id = app_user_id()) WITH CHECK (organization_id = app_org_id() AND user_id = app_user_id());
CREATE POLICY notifications_insert ON notifications FOR INSERT WITH CHECK (organization_id = app_org_id() AND app_is_staff());`,
  },
  files: { kind: 'client_optional', clientWrite: true, clientRead: true },
  reports: { kind: 'client_optional', clientWrite: false, clientRead: false },
  // Phase 13: the client files and reads their own rights requests; staff handle them.
  privacy_requests: { kind: 'client_owned', clientWrite: true, clientRead: true },
  user_recovery_codes: {
    kind: 'custom',
    // Own codes only; ADMIN may delete them when erasing a client of the organization.
    sql: `CREATE POLICY user_recovery_codes_own ON user_recovery_codes FOR ALL USING (user_id = app_user_id()) WITH CHECK (user_id = app_user_id());
CREATE POLICY user_recovery_codes_admin_delete ON user_recovery_codes FOR DELETE USING (app_has_role('ADMIN') AND EXISTS (SELECT 1 FROM users u WHERE u.id = user_recovery_codes.user_id));`,
  },
  import_jobs: {
    kind: 'custom',
    sql: `CREATE POLICY import_jobs_all ON import_jobs FOR ALL USING (organization_id = app_org_id() AND app_is_staff()) WITH CHECK (organization_id = app_org_id() AND app_is_staff());`,
  },
  import_rows: {
    kind: 'custom',
    sql: `CREATE POLICY import_rows_all ON import_rows FOR ALL USING (organization_id = app_org_id() AND app_is_staff()) WITH CHECK (organization_id = app_org_id() AND app_is_staff());`,
  },
  domain_events: {
    kind: 'custom',
    sql: `CREATE POLICY domain_events_insert ON domain_events FOR INSERT WITH CHECK (organization_id = app_org_id());`,
  },
  integration_connections: { kind: 'client_optional', clientWrite: false, clientRead: false },
  external_measurements: { kind: 'client_owned', clientWrite: false, clientRead: true },
};

/** Inherit organization_id/client_id from the parent row (child table → [parent table, fk column]). */
export const INHERIT_SCOPE: Record<string, [string, string]> = {
  plan_revisions: ['training_plans', 'plan_id'],
  phases: ['training_plans', 'plan_id'],
  mesocycles: ['phases', 'phase_id'],
  microcycles: ['mesocycles', 'mesocycle_id'],
  sessions: ['microcycles', 'microcycle_id'],
  session_blocks: ['sessions', 'session_id'],
  session_exercises: ['session_blocks', 'block_id'],
  exercise_sets: ['session_exercises', 'session_exercise_id'],
  attendance: ['sessions', 'session_id'],
  set_logs: ['sessions', 'session_id'],
  feedback: ['sessions', 'session_id'],
  exercise_feedback: ['sessions', 'session_id'],
  assessment_results: ['assessments', 'assessment_id'],
  import_rows: ['import_jobs', 'job_id'],
};

/** Tables with organization_id + client_id whose pair must be consistent (client belongs to org). */
export const CHECK_CLIENT_ORG = [
  'trainer_client_assignments',
  'training_plans',
  'assessments',
  'derived_metrics',
  'readiness',
  'pain_logs',
  'exercise_substitutions',
  'exercise_tolerances',
  'recommendations',
  'alerts',
  'manual_overrides',
  'client_rule_overrides',
  'files',
  'reports',
  'integration_connections',
  'external_measurements',
];
