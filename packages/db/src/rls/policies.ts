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
  | {
      kind: 'client_optional';
      clientWrite: boolean;
      clientRead: boolean;
      /** Extra condition for the client's reads (staff read every row they can access). */
      clientReadWhere?: string;
    }
  /** Custom SQL policies (written verbatim). */
  | { kind: 'custom'; sql: string };

export const RLS_POLICIES: Record<string, PolicyKind> = {
  // ── Identity ────────────────────────────────────────────────────────────────
  roles: { kind: 'global_readonly' },
  permissions: { kind: 'global_readonly' },
  role_permissions: { kind: 'global_readonly' },
  login_attempts: { kind: 'system_only' },
  api_rate_limits: { kind: 'system_only' },
  scheduled_job_runs: { kind: 'system_only' },
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
    // Staff invitations: ADMIN only. Client invitations: staff who can access that client.
    sql: `CREATE POLICY invitations_all ON invitations FOR ALL
  USING (organization_id = app_org_id() AND app_is_staff() AND (CASE WHEN client_id IS NULL THEN app_has_role('ADMIN') ELSE app_can_access_client(client_id) END))
  WITH CHECK (organization_id = app_org_id() AND app_is_staff() AND (CASE WHEN client_id IS NULL THEN app_has_role('ADMIN') ELSE app_can_access_client(client_id) END));`,
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
    // ADMIN manages assignments (clients:assign); a trainer sees those of their own clients and
    // can only assign themselves to a client they have just created.
    sql: `CREATE POLICY tca_select ON trainer_client_assignments FOR SELECT USING (organization_id = app_org_id() AND (app_has_role('ADMIN') OR client_id = app_client_id() OR (app_has_role('TRAINER') AND app_trainer_assigned(client_id))));
CREATE POLICY tca_insert ON trainer_client_assignments FOR INSERT WITH CHECK (organization_id = app_org_id() AND (app_has_role('ADMIN') OR (app_has_role('TRAINER') AND trainer_id = app_trainer_id() AND app_new_client_of_mine(client_id))));
CREATE POLICY tca_update ON trainer_client_assignments FOR UPDATE USING (organization_id = app_org_id() AND app_has_role('ADMIN')) WITH CHECK (organization_id = app_org_id() AND app_has_role('ADMIN'));
CREATE POLICY tca_delete ON trainer_client_assignments FOR DELETE USING (organization_id = app_org_id() AND app_has_role('ADMIN'));`,
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
  programming_profiles: { kind: 'catalog' },
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
  // Restructure phase 9: log of specific searches (global from the seeds, or the centre's own).
  science_searches: { kind: 'catalog' },
  evidence_findings: { kind: 'catalog' },
  knowledge_claims: { kind: 'catalog' },
  claim_evidence: { kind: 'catalog_child', parent: 'knowledge_claims', fk: 'claim_id' },
  methods: { kind: 'catalog' },
  method_variables: { kind: 'catalog' },
  method_evidence: { kind: 'catalog_child', parent: 'methods', fk: 'method_id' },
  method_notes: { kind: 'catalog_child', parent: 'methods', fk: 'method_id' },
  evidence_reviews: { kind: 'catalog' },
  assessment_tests: { kind: 'catalog' },
  derived_formulas: { kind: 'catalog' },
  injury_conditions: { kind: 'catalog' },
  injury_protocols: { kind: 'catalog' },
  injury_protocol_phases: { kind: 'catalog_child', parent: 'injury_protocols', fk: 'protocol_id' },
  injury_protocol_criteria: {
    kind: 'catalog_child',
    parent: 'injury_protocols',
    fk: 'protocol_id',
  },
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
  // Phase 7 [SALUD]: injury cases and everything under them are staff-only health data (the
  // client never reads or writes them here; their session pain stays in pain_logs).
  injuries: { kind: 'client_owned', clientWrite: false, clientRead: false },
  injury_phase_history: { kind: 'client_owned', clientWrite: false, clientRead: false },
  injury_symptoms: { kind: 'client_owned', clientWrite: false, clientRead: false },
  injury_alerts: { kind: 'client_owned', clientWrite: false, clientRead: false },
  injury_criterion_checks: { kind: 'client_owned', clientWrite: false, clientRead: false },
  rtp_decisions: { kind: 'client_owned', clientWrite: false, clientRead: false },
  // Phase 4: groups/teams are staff-only; a trainer sees the members they can access and only
  // adds members to a group of their organization.
  client_groups: {
    kind: 'custom',
    sql: `CREATE POLICY client_groups_all ON client_groups FOR ALL USING (organization_id = app_org_id() AND app_is_staff()) WITH CHECK (organization_id = app_org_id() AND app_is_staff());`,
  },
  client_group_members: {
    kind: 'custom',
    sql: `CREATE POLICY client_group_members_all ON client_group_members FOR ALL
  USING (organization_id = app_org_id() AND (app_has_role('ADMIN') OR (app_has_role('TRAINER') AND app_trainer_assigned(client_id))))
  WITH CHECK (organization_id = app_org_id() AND (app_has_role('ADMIN') OR (app_has_role('TRAINER') AND app_trainer_assigned(client_id))) AND EXISTS (SELECT 1 FROM client_groups g WHERE g.id = client_group_members.group_id));`,
  },

  // ── Planning ────────────────────────────────────────────────────────────────
  plan_templates: { kind: 'catalog' },
  plan_template_versions: { kind: 'catalog' },
  training_plans: { kind: 'client_optional', clientWrite: false, clientRead: true },
  plan_revisions: { kind: 'client_optional', clientWrite: false, clientRead: false },
  phases: { kind: 'client_optional', clientWrite: false, clientRead: true },
  mesocycles: { kind: 'client_optional', clientWrite: false, clientRead: true },
  microcycles: { kind: 'client_optional', clientWrite: false, clientRead: true },
  // Restructure phase 8: the client reads only published sessions, and the blocks, exercises
  // and sets of a session they can read (the subquery runs under the sessions policy).
  sessions: {
    kind: 'client_optional',
    clientWrite: false,
    clientRead: true,
    clientReadWhere: 'published',
  },
  session_blocks: {
    kind: 'client_optional',
    clientWrite: false,
    clientRead: true,
    clientReadWhere: 'EXISTS (SELECT 1 FROM sessions s WHERE s.id = session_blocks.session_id)',
  },
  session_exercises: {
    kind: 'client_optional',
    clientWrite: false,
    clientRead: true,
    clientReadWhere:
      'EXISTS (SELECT 1 FROM session_blocks b WHERE b.id = session_exercises.block_id)',
  },
  exercise_sets: {
    kind: 'client_optional',
    clientWrite: false,
    clientRead: true,
    clientReadWhere:
      'EXISTS (SELECT 1 FROM session_exercises e WHERE e.id = exercise_sets.session_exercise_id)',
  },

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
  reports: {
    kind: 'custom',
    // Staff as client_optional; the client reads only their own reports the trainer shared
    // (shared_at), never writes. Same role rule as the generator's client_optional.
    sql: `CREATE POLICY reports_select ON reports FOR SELECT USING (organization_id = app_org_id() AND (CASE WHEN client_id IS NULL THEN app_is_staff() ELSE (app_has_role('ADMIN') OR (app_has_role('TRAINER') AND app_trainer_assigned(client_id)) OR (app_has_role('CLIENT') AND client_id = app_client_id() AND shared_at IS NOT NULL)) END));
CREATE POLICY reports_write ON reports FOR ALL USING (organization_id = app_org_id() AND app_is_staff() AND (CASE WHEN client_id IS NULL THEN true ELSE (app_has_role('ADMIN') OR (app_has_role('TRAINER') AND app_trainer_assigned(client_id))) END)) WITH CHECK (organization_id = app_org_id() AND app_is_staff() AND (CASE WHEN client_id IS NULL THEN true ELSE (app_has_role('ADMIN') OR (app_has_role('TRAINER') AND app_trainer_assigned(client_id))) END));`,
  },
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
  injury_phase_history: ['injuries', 'injury_id'],
  injury_symptoms: ['injuries', 'injury_id'],
  injury_alerts: ['injuries', 'injury_id'],
  injury_criterion_checks: ['injuries', 'injury_id'],
  rtp_decisions: ['injuries', 'injury_id'],
};

/**
 * Children of a catalogue row: copy organization_id from the parent, NULL included (global
 * catalogue rows have no organization). [parent table, fk column].
 */
export const INHERIT_ORG: Record<string, [string, string]> = {
  plan_template_versions: ['plan_templates', 'template_id'],
};

/** Tables with organization_id + client_id whose pair must be consistent (client belongs to org). */
export const CHECK_CLIENT_ORG = [
  'trainer_client_assignments',
  'training_plans',
  'assessments',
  'derived_metrics',
  'client_group_members',
  'injuries',
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
  'decision_runs',
  'client_trait_flags',
  'privacy_requests',
];
