CREATE TYPE "public"."body_region" AS ENUM('lower', 'upper', 'trunk', 'full_body');--> statement-breakpoint
CREATE TYPE "public"."contraction_type" AS ENUM('concentric', 'eccentric', 'isometric', 'reactive_ssc', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."instruction_kind" AS ENUM('cue', 'common_error', 'precaution', 'setup', 'execution');--> statement-breakpoint
CREATE TYPE "public"."intended_velocity" AS ENUM('slow_controlled', 'moderate', 'maximal_intent', 'ballistic');--> statement-breakpoint
CREATE TYPE "public"."laterality" AS ENUM('bilateral', 'unilateral', 'alternating', 'asymmetric_load');--> statement-breakpoint
CREATE TYPE "public"."exercise_level" AS ENUM('beginner', 'intermediate', 'advanced');--> statement-breakpoint
CREATE TYPE "public"."load_level" AS ENUM('none', 'low', 'moderate', 'high');--> statement-breakpoint
CREATE TYPE "public"."media_provider" AS ENUM('upload', 'youtube', 'vimeo', 'url');--> statement-breakpoint
CREATE TYPE "public"."media_status" AS ENUM('pending_verification', 'verified', 'broken', 'replaced');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('silhouette', 'image', 'video');--> statement-breakpoint
CREATE TYPE "public"."muscle_role" AS ENUM('primary', 'secondary', 'stabilizer');--> statement-breakpoint
CREATE TYPE "public"."movement_plane" AS ENUM('sagittal', 'frontal', 'transverse');--> statement-breakpoint
CREATE TYPE "public"."progression_relation" AS ENUM('progression', 'regression', 'variant');--> statement-breakpoint
CREATE TYPE "public"."publication_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."space_required" AS ENUM('minimal', 'small', 'large', 'track_field');--> statement-breakpoint
CREATE TYPE "public"."variable_value_type" AS ENUM('integer', 'number', 'range', 'text', 'enum', 'tempo', 'json');--> statement-breakpoint
CREATE TYPE "public"."claim_status" AS ENUM('draft', 'reviewed', 'published', 'deprecated');--> statement-breakpoint
CREATE TYPE "public"."confidence" AS ENUM('high', 'moderate', 'low', 'very_low');--> statement-breakpoint
CREATE TYPE "public"."epistemic_type" AS ENUM('fact', 'inference', 'hypothesis', 'opinion');--> statement-breakpoint
CREATE TYPE "public"."evidence_level" AS ENUM('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H');--> statement-breakpoint
CREATE TYPE "public"."evidence_role" AS ENUM('supports', 'contradicts', 'context');--> statement-breakpoint
CREATE TYPE "public"."method_kind" AS ENUM('training_method', 'contraction_type', 'organization_method', 'autoregulation_method', 'conditioning_method');--> statement-breakpoint
CREATE TYPE "public"."method_note_kind" AS ENUM('mechanism', 'indication', 'precaution', 'progression', 'limitation');--> statement-breakpoint
CREATE TYPE "public"."sex_scope" AS ENUM('female', 'male', 'mixed', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."source_access" AS ENUM('full_text', 'abstract_only', 'secondary_source', 'not_accessed');--> statement-breakpoint
CREATE TYPE "public"."study_design" AS ENUM('guideline', 'position_stand', 'consensus', 'umbrella_review', 'systematic_review', 'meta_analysis', 'rct', 'non_randomized_trial', 'cohort', 'cross_sectional', 'case_series', 'mechanistic', 'narrative_review', 'expert_opinion', 'book', 'website');--> statement-breakpoint
CREATE TYPE "public"."training_status" AS ENUM('untrained', 'recreational', 'trained', 'highly_trained', 'elite', 'mixed', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('verified', 'verified_with_corrections', 'unverified', 'retracted', 'non_scientific');--> statement-breakpoint
CREATE TYPE "public"."aggregation" AS ENUM('best', 'mean', 'mean_of_best_n', 'last');--> statement-breakpoint
CREATE TYPE "public"."assessment_status" AS ENUM('planned', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."better_direction" AS ENUM('higher', 'lower', 'target_range');--> statement-breakpoint
CREATE TYPE "public"."result_source" AS ENUM('manual', 'device', 'import');--> statement-breakpoint
CREATE TYPE "public"."side" AS ENUM('both', 'left', 'right');--> statement-breakpoint
CREATE TYPE "public"."statistic_type" AS ENUM('mean_sd', 'median_iqr', 'percentiles', 'cutoff', 'category_bands');--> statement-breakpoint
CREATE TYPE "public"."test_category" AS ENUM('strength', 'power', 'speed', 'cod', 'agility', 'endurance', 'mobility', 'body_composition', 'functional', 'balance', 'questionnaire');--> statement-breakpoint
CREATE TYPE "public"."test_value_type" AS ENUM('number', 'time', 'distance', 'angle', 'count', 'scale');--> statement-breakpoint
CREATE TYPE "public"."block_organization" AS ENUM('straight_sets', 'superset', 'triset', 'circuit', 'cluster', 'contrast', 'complex', 'emom', 'amrap', 'intervals');--> statement-breakpoint
CREATE TYPE "public"."block_type" AS ENUM('warm_up', 'activation', 'power_potentiation', 'main_strength', 'hypertrophy', 'plyometric', 'sprint_cod', 'conditioning', 'core', 'mobility', 'cool_down', 'custom');--> statement-breakpoint
CREATE TYPE "public"."periodization_model" AS ENUM('linear', 'block', 'undulating_daily', 'undulating_weekly', 'concurrent', 'flexible', 'custom');--> statement-breakpoint
CREATE TYPE "public"."plan_kind" AS ENUM('CLIENT_PLAN', 'TEMPLATE', 'PROPOSAL');--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('draft', 'proposed', 'active', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."prescription_source" AS ENUM('manual', 'template', 'proposal', 'progression_rule');--> statement-breakpoint
CREATE TYPE "public"."rom_spec" AS ENUM('full', 'partial_lengthened', 'partial_shortened', 'specified');--> statement-breakpoint
CREATE TYPE "public"."session_location" AS ENUM('in_person', 'online', 'home', 'gym', 'outdoor');--> statement-breakpoint
CREATE TYPE "public"."side_spec" AS ENUM('both', 'left', 'right', 'each');--> statement-breakpoint
CREATE TYPE "public"."week_type" AS ENUM('introduction', 'progression', 'peak', 'deload', 'test', 'taper', 'transition', 'competition');--> statement-breakpoint
CREATE TYPE "public"."absence_reason" AS ENUM('illness', 'injury_or_pain', 'work', 'travel', 'fatigue', 'motivation', 'schedule', 'other');--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('completed', 'partial', 'missed', 'rescheduled', 'cancelled_by_trainer');--> statement-breakpoint
CREATE TYPE "public"."log_source" AS ENUM('manual', 'device', 'import');--> statement-breakpoint
CREATE TYPE "public"."logged_by_role" AS ENUM('client', 'trainer');--> statement-breakpoint
CREATE TYPE "public"."pain_context" AS ENUM('during', 'after', 'next_day', 'at_rest');--> statement-breakpoint
CREATE TYPE "public"."substitution_reason" AS ENUM('pain', 'missing_equipment', 'too_difficult', 'space', 'preference', 'fatigue');--> statement-breakpoint
CREATE TYPE "public"."tolerance_kind" AS ENUM('tolerated', 'not_tolerated', 'restricted');--> statement-breakpoint
CREATE TYPE "public"."alert_severity" AS ENUM('green', 'yellow', 'red');--> statement-breakpoint
CREATE TYPE "public"."alert_status" AS ENUM('open', 'seen', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."recommendation_confidence" AS ENUM('high', 'moderate', 'low');--> statement-breakpoint
CREATE TYPE "public"."recommendation_status" AS ENUM('proposed', 'accepted', 'accepted_with_changes', 'rejected', 'superseded', 'expired');--> statement-breakpoint
CREATE TYPE "public"."recommendation_type" AS ENUM('need', 'priority', 'method', 'exercise', 'dose', 'plan_proposal', 'progression', 'deload', 'substitution', 'reassessment', 'referral_notice');--> statement-breakpoint
CREATE TYPE "public"."rule_domain" AS ENUM('screening', 'needs', 'prioritization', 'method_selection', 'exercise_selection', 'dosing', 'progression', 'monitoring_alert', 'substitution');--> statement-breakpoint
CREATE TYPE "public"."rule_set_status" AS ENUM('draft', 'published', 'retired');--> statement-breakpoint
CREATE TYPE "public"."import_row_status" AS ENUM('valid', 'invalid', 'imported', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('pending', 'running', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('in_app', 'email', 'push');--> statement-breakpoint
CREATE TYPE "public"."report_format" AS ENUM('pdf', 'xlsx', 'csv', 'json');--> statement-breakpoint
CREATE TABLE "exercise_categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"parent_id" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exercise_categories_org_slug_uq" UNIQUE NULLS NOT DISTINCT("organization_id","slug")
);
--> statement-breakpoint
CREATE TABLE "exercise_category_links" (
	"exercise_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	CONSTRAINT "exercise_category_links_exercise_id_category_id_pk" PRIMARY KEY("exercise_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "exercise_equipment" (
	"exercise_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	"optional" boolean DEFAULT false NOT NULL,
	CONSTRAINT "exercise_equipment_exercise_id_equipment_id_pk" PRIMARY KEY("exercise_id","equipment_id")
);
--> statement-breakpoint
CREATE TABLE "exercise_instructions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"exercise_id" uuid NOT NULL,
	"kind" "instruction_kind" NOT NULL,
	"position" smallint NOT NULL,
	"text" text NOT NULL,
	"audience" text DEFAULT 'both' NOT NULL,
	CONSTRAINT "exercise_instructions_pos_uq" UNIQUE("exercise_id","kind","position"),
	CONSTRAINT "exercise_instructions_audience_ck" CHECK ("exercise_instructions"."audience" IN ('client','trainer','both'))
);
--> statement-breakpoint
CREATE TABLE "exercise_media" (
	"id" uuid PRIMARY KEY NOT NULL,
	"exercise_id" uuid NOT NULL,
	"type" "media_type" NOT NULL,
	"provider" "media_provider" NOT NULL,
	"url_or_key" text NOT NULL,
	"title" text,
	"channel" text,
	"language" text,
	"status" "media_status" DEFAULT 'pending_verification' NOT NULL,
	"verified_at" timestamp with time zone,
	"verified_by" uuid,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exercise_media_verified_ck" CHECK ("exercise_media"."status" <> 'verified' OR "exercise_media"."verified_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "exercise_method_links" (
	"exercise_id" uuid NOT NULL,
	"method_id" uuid NOT NULL,
	"notes" text,
	"extra" jsonb,
	CONSTRAINT "exercise_method_links_exercise_id_method_id_pk" PRIMARY KEY("exercise_id","method_id")
);
--> statement-breakpoint
CREATE TABLE "exercise_muscles" (
	"exercise_id" uuid NOT NULL,
	"muscle_id" uuid NOT NULL,
	"role" "muscle_role" NOT NULL,
	CONSTRAINT "exercise_muscles_exercise_id_muscle_id_pk" PRIMARY KEY("exercise_id","muscle_id")
);
--> statement-breakpoint
CREATE TABLE "exercise_progressions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"from_exercise_id" uuid NOT NULL,
	"to_exercise_id" uuid NOT NULL,
	"relation" "progression_relation" NOT NULL,
	"axes" text[] DEFAULT '{}'::text[] NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exercise_progressions_uq" UNIQUE("from_exercise_id","to_exercise_id","relation"),
	CONSTRAINT "exercise_progressions_no_self_ck" CHECK ("exercise_progressions"."from_exercise_id" <> "exercise_progressions"."to_exercise_id")
);
--> statement-breakpoint
CREATE TABLE "exercise_tag_links" (
	"exercise_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "exercise_tag_links_exercise_id_tag_id_pk" PRIMARY KEY("exercise_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "exercise_tags" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exercise_tags_org_slug_uq" UNIQUE NULLS NOT DISTINCT("organization_id","slug")
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"derived_from_id" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"alt_names" text[] DEFAULT '{}'::text[] NOT NULL,
	"movement_pattern_id" uuid,
	"body_region" "body_region",
	"laterality" "laterality",
	"planes" "movement_plane"[] DEFAULT '{}' NOT NULL,
	"contraction_emphasis" "contraction_type"[] DEFAULT '{}' NOT NULL,
	"intended_velocity" "intended_velocity",
	"level" "exercise_level",
	"space_required" "space_required",
	"technical_complexity" smallint,
	"axial_load" "load_level",
	"impact_level" "load_level",
	"client_description" text,
	"trainer_description" text,
	"prescription_profile_id" uuid,
	"supports_vbt" boolean DEFAULT false NOT NULL,
	"contacts_per_rep" smallint,
	"status" "publication_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "exercises_org_slug_uq" UNIQUE NULLS NOT DISTINCT("organization_id","slug"),
	CONSTRAINT "exercises_complexity_ck" CHECK ("exercises"."technical_complexity" IS NULL OR "exercises"."technical_complexity" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "movement_patterns" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"family" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "movement_patterns_org_slug_uq" UNIQUE NULLS NOT DISTINCT("organization_id","slug")
);
--> statement-breakpoint
CREATE TABLE "muscles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"group_slug" text NOT NULL,
	"region" "body_region" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "muscles_org_slug_uq" UNIQUE NULLS NOT DISTINCT("organization_id","slug")
);
--> statement-breakpoint
CREATE TABLE "prescription_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"variable_keys" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prescription_profiles_org_slug_uq" UNIQUE NULLS NOT DISTINCT("organization_id","slug")
);
--> statement-breakpoint
CREATE TABLE "prescription_variables" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"unit" text,
	"value_type" "variable_value_type" NOT NULL,
	"min_value" text,
	"max_value" text,
	"enum_values" text[],
	"description" text,
	"is_typed_column" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prescription_variables_org_key_uq" UNIQUE NULLS NOT DISTINCT("organization_id","key")
);
--> statement-breakpoint
CREATE TABLE "claim_evidence" (
	"claim_id" uuid NOT NULL,
	"finding_id" uuid NOT NULL,
	"role" "evidence_role" DEFAULT 'supports' NOT NULL,
	CONSTRAINT "claim_evidence_claim_id_finding_id_pk" PRIMARY KEY("claim_id","finding_id")
);
--> statement-breakpoint
CREATE TABLE "evidence_findings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"source_id" uuid NOT NULL,
	"outcome_id" uuid NOT NULL,
	"population_id" uuid NOT NULL,
	"intervention" text,
	"comparator" text,
	"effect_metric" text,
	"effect_value" numeric,
	"ci_low" numeric,
	"ci_high" numeric,
	"n_studies" integer,
	"n_participants" integer,
	"heterogeneity_i2" numeric,
	"certainty_grade" text,
	"evidence_level" "evidence_level" DEFAULT 'H' NOT NULL,
	"grading_rationale" jsonb,
	"quote" text,
	"epistemic_type" "epistemic_type" DEFAULT 'fact' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "evidence_reviews" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"source_id" uuid,
	"claim_id" uuid,
	"reviewer_id" uuid NOT NULL,
	"reviewed_on" date NOT NULL,
	"checklist" jsonb NOT NULL,
	"outcome" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_reviews_target_ck" CHECK ("evidence_reviews"."source_id" IS NOT NULL OR "evidence_reviews"."claim_id" IS NOT NULL),
	CONSTRAINT "evidence_reviews_outcome_ck" CHECK ("evidence_reviews"."outcome" IN ('approved','changes_requested','rejected'))
);
--> statement-breakpoint
CREATE TABLE "evidence_sources" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"title" text NOT NULL,
	"authors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"year" smallint,
	"journal" text,
	"volume" text,
	"issue" text,
	"pages" text,
	"doi" text,
	"pmid" text,
	"pmcid" text,
	"url" text,
	"study_design" "study_design" NOT NULL,
	"population_summary" text,
	"age_range" text,
	"sex" "sex_scope",
	"training_status" "training_status",
	"sport" text,
	"intervention" text,
	"comparison" text,
	"outcomes_measured" text,
	"results_summary" text,
	"limitations" text,
	"practical_application" text,
	"verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"access" "source_access" DEFAULT 'not_accessed' NOT NULL,
	"verified_at" timestamp with time zone,
	"verified_by" uuid,
	"verification_method" text,
	"corrections" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "evidence_sources_doi_uq" UNIQUE NULLS NOT DISTINCT("organization_id","doi"),
	CONSTRAINT "evidence_sources_pmid_uq" UNIQUE NULLS NOT DISTINCT("organization_id","pmid"),
	CONSTRAINT "evidence_sources_doi_ck" CHECK ("evidence_sources"."doi" IS NULL OR "evidence_sources"."doi" ~ '^10\.[0-9]{4,9}/\S+$'),
	CONSTRAINT "evidence_sources_pmid_ck" CHECK ("evidence_sources"."pmid" IS NULL OR "evidence_sources"."pmid" ~ '^[0-9]{1,9}$'),
	CONSTRAINT "evidence_sources_verified_ck" CHECK ("evidence_sources"."verification_status" NOT IN ('verified','verified_with_corrections') OR ("evidence_sources"."verified_at" IS NOT NULL AND "evidence_sources"."verification_method" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "knowledge_claims" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"key" text NOT NULL,
	"statement" text NOT NULL,
	"scope" text,
	"epistemic_type" "epistemic_type" NOT NULL,
	"evidence_level" "evidence_level" DEFAULT 'H' NOT NULL,
	"confidence" "confidence" DEFAULT 'very_low' NOT NULL,
	"limitations" text,
	"applicability" jsonb,
	"status" "claim_status" DEFAULT 'draft' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "knowledge_claims_org_key_uq" UNIQUE NULLS NOT DISTINCT("organization_id","key")
);
--> statement-breakpoint
CREATE TABLE "method_evidence" (
	"method_id" uuid NOT NULL,
	"finding_id" uuid NOT NULL,
	"role" "evidence_role" DEFAULT 'supports' NOT NULL,
	CONSTRAINT "method_evidence_method_id_finding_id_pk" PRIMARY KEY("method_id","finding_id")
);
--> statement-breakpoint
CREATE TABLE "method_notes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"method_id" uuid NOT NULL,
	"kind" "method_note_kind" NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"text" text NOT NULL,
	"claim_id" uuid
);
--> statement-breakpoint
CREATE TABLE "method_variables" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"method_id" uuid NOT NULL,
	"variable_key" text NOT NULL,
	"population_id" uuid,
	"goal_id" uuid,
	"min_value" numeric,
	"max_value" numeric,
	"typical_value" numeric,
	"unit" text,
	"claim_id" uuid,
	"is_default_suggestion" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "method_variables_range_ck" CHECK ("method_variables"."min_value" IS NULL OR "method_variables"."max_value" IS NULL OR "method_variables"."min_value" <= "method_variables"."max_value")
);
--> statement-breakpoint
CREATE TABLE "methods" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"parent_method_id" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"kind" "method_kind" NOT NULL,
	"definition" text,
	"summary_for_trainer" text,
	"summary_for_client" text,
	"status" "claim_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "methods_org_slug_uq" UNIQUE NULLS NOT DISTINCT("organization_id","slug")
);
--> statement-breakpoint
CREATE TABLE "outcomes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"domain" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outcomes_org_slug_uq" UNIQUE NULLS NOT DISTINCT("organization_id","slug")
);
--> statement-breakpoint
CREATE TABLE "populations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"age_min" smallint,
	"age_max" smallint,
	"sex" "sex_scope" DEFAULT 'mixed' NOT NULL,
	"training_status" "training_status" DEFAULT 'unknown' NOT NULL,
	"sport_slug" text,
	"clinical" text,
	"region" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "populations_org_slug_uq" UNIQUE NULLS NOT DISTINCT("organization_id","slug")
);
--> statement-breakpoint
CREATE TABLE "assessment_batteries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"goal_family" text,
	"description" text,
	"status" "publication_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "assessment_batteries_org_slug_uq" UNIQUE NULLS NOT DISTINCT("organization_id","slug")
);
--> statement-breakpoint
CREATE TABLE "assessment_results" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"assessment_id" uuid NOT NULL,
	"test_id" uuid NOT NULL,
	"protocol_version" text,
	"side" "side" DEFAULT 'both' NOT NULL,
	"attempts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"value_best" numeric,
	"value_mean" numeric,
	"value" numeric,
	"cv_intra_percent" numeric,
	"unit" text NOT NULL,
	"measurement_method" text,
	"device" text,
	"valid" boolean DEFAULT true NOT NULL,
	"source" "result_source" DEFAULT 'manual' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "assessment_tests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" "test_category" NOT NULL,
	"purpose" text,
	"target_populations" text,
	"protocol" text,
	"protocol_version" text DEFAULT '1' NOT NULL,
	"equipment" text[] DEFAULT '{}'::text[] NOT NULL,
	"unit" text NOT NULL,
	"value_type" "test_value_type" NOT NULL,
	"better_direction" "better_direction" NOT NULL,
	"default_attempts" smallint DEFAULT 1 NOT NULL,
	"aggregation" "aggregation" DEFAULT 'best' NOT NULL,
	"aggregation_n" smallint,
	"sided" boolean DEFAULT false NOT NULL,
	"derived_formulas" text[] DEFAULT '{}'::text[] NOT NULL,
	"limitations" text,
	"source_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"status" "publication_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "assessment_tests_org_slug_uq" UNIQUE NULLS NOT DISTINCT("organization_id","slug"),
	CONSTRAINT "assessment_tests_attempts_ck" CHECK ("assessment_tests"."default_attempts" BETWEEN 1 AND 20)
);
--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"battery_id" uuid,
	"assessed_on" date NOT NULL,
	"start_time" time,
	"assessor_user_id" uuid,
	"status" "assessment_status" DEFAULT 'planned' NOT NULL,
	"context" text,
	"conditions" jsonb,
	"plan_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "assessments_id_client_uq" UNIQUE("id","client_id")
);
--> statement-breakpoint
CREATE TABLE "battery_tests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"battery_id" uuid NOT NULL,
	"test_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"is_core" boolean DEFAULT true NOT NULL,
	"notes" text,
	CONSTRAINT "battery_tests_uq" UNIQUE("battery_id","test_id")
);
--> statement-breakpoint
CREATE TABLE "derived_metrics" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"result_id" uuid,
	"assessment_id" uuid,
	"metric" text NOT NULL,
	"formula" text NOT NULL,
	"formula_version" text DEFAULT '1' NOT NULL,
	"value" numeric NOT NULL,
	"unit" text NOT NULL,
	"is_estimate" boolean DEFAULT false NOT NULL,
	"error_estimate" text,
	"inputs" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reference_values" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"test_id" uuid NOT NULL,
	"variable" text NOT NULL,
	"unit" text NOT NULL,
	"population_id" uuid NOT NULL,
	"age_min" smallint,
	"age_max" smallint,
	"sex" text,
	"level" text,
	"sport" text,
	"sample_size" smallint,
	"statistic_type" "statistic_type" NOT NULL,
	"values" jsonb NOT NULL,
	"measurement_method" text,
	"source_id" uuid NOT NULL,
	"applicability_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "test_reliability_data" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"test_id" uuid NOT NULL,
	"population_id" uuid,
	"measurement_method" text,
	"icc" numeric,
	"icc_model" text,
	"cv_percent" numeric,
	"sem" numeric,
	"sem_unit" text,
	"mdc95" numeric,
	"swc" numeric,
	"source_id" uuid,
	"is_local" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "test_reliability_icc_ck" CHECK ("test_reliability_data"."icc" IS NULL OR ("test_reliability_data"."icc" >= 0 AND "test_reliability_data"."icc" <= 1)),
	CONSTRAINT "test_reliability_source_ck" CHECK ("test_reliability_data"."is_local" OR "test_reliability_data"."source_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "exercise_sets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid,
	"session_exercise_id" uuid NOT NULL,
	"set_index" smallint NOT NULL,
	"sets" smallint,
	"reps_min" smallint,
	"reps_max" smallint,
	"reps_per_cluster" smallint,
	"intra_cluster_rest_s" smallint,
	"duration_s" integer,
	"distance_m" numeric,
	"contacts" smallint,
	"load_kg" numeric(6, 2),
	"load_pct_1rm" numeric(5, 2),
	"rir_min" smallint,
	"rir_max" smallint,
	"rpe_target" numeric(3, 1),
	"effort_character" text,
	"velocity_target_mps" numeric(4, 2),
	"velocity_loss_pct" smallint,
	"tempo" text,
	"rest_s" smallint,
	"rom" "rom_spec",
	"intensity_note" text,
	"band_tension" jsonb,
	"chain_load_kg" numeric(6, 2),
	"extra" jsonb,
	"set_type" text,
	CONSTRAINT "exercise_sets_idx_uq" UNIQUE("session_exercise_id","set_index"),
	CONSTRAINT "exercise_sets_reps_ck" CHECK ("exercise_sets"."reps_min" IS NULL OR "exercise_sets"."reps_max" IS NULL OR "exercise_sets"."reps_min" <= "exercise_sets"."reps_max"),
	CONSTRAINT "exercise_sets_rir_ck" CHECK (("exercise_sets"."rir_min" IS NULL OR "exercise_sets"."rir_min" BETWEEN 0 AND 10) AND ("exercise_sets"."rir_max" IS NULL OR "exercise_sets"."rir_max" BETWEEN 0 AND 10) AND ("exercise_sets"."rir_min" IS NULL OR "exercise_sets"."rir_max" IS NULL OR "exercise_sets"."rir_min" <= "exercise_sets"."rir_max")),
	CONSTRAINT "exercise_sets_rpe_ck" CHECK ("exercise_sets"."rpe_target" IS NULL OR ("exercise_sets"."rpe_target" BETWEEN 1 AND 10 AND ("exercise_sets"."rpe_target" * 2) = trunc("exercise_sets"."rpe_target" * 2))),
	CONSTRAINT "exercise_sets_vl_ck" CHECK ("exercise_sets"."velocity_loss_pct" IS NULL OR "exercise_sets"."velocity_loss_pct" BETWEEN 0 AND 60),
	CONSTRAINT "exercise_sets_pct_ck" CHECK ("exercise_sets"."load_pct_1rm" IS NULL OR "exercise_sets"."load_pct_1rm" BETWEEN 0 AND 110),
	CONSTRAINT "exercise_sets_tempo_ck" CHECK ("exercise_sets"."tempo" IS NULL OR "exercise_sets"."tempo" ~ '^[0-9X]{1,2}-[0-9X]{1,2}-[0-9X]{1,2}-[0-9X]{1,2}$'),
	CONSTRAINT "exercise_sets_nonneg_ck" CHECK (coalesce("exercise_sets"."sets",0) >= 0 AND coalesce("exercise_sets"."load_kg",0) >= 0 AND coalesce("exercise_sets"."rest_s",0) >= 0)
);
--> statement-breakpoint
CREATE TABLE "mesocycles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid,
	"phase_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"name" text NOT NULL,
	"weeks" smallint NOT NULL,
	"focus" text,
	"assessment_planned" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mesocycles_pos_uq" UNIQUE("phase_id","position"),
	CONSTRAINT "mesocycles_weeks_ck" CHECK ("mesocycles"."weeks" BETWEEN 1 AND 16)
);
--> statement-breakpoint
CREATE TABLE "microcycles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid,
	"mesocycle_id" uuid NOT NULL,
	"week_index" smallint NOT NULL,
	"week_type" "week_type" DEFAULT 'progression' NOT NULL,
	"relative_volume" numeric(4, 2),
	"relative_intensity" numeric(4, 2),
	"start_date" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "microcycles_week_uq" UNIQUE("mesocycle_id","week_index")
);
--> statement-breakpoint
CREATE TABLE "phases" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid,
	"plan_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"name" text NOT NULL,
	"objective" text,
	"start_week" smallint NOT NULL,
	"end_week" smallint NOT NULL,
	"emphasis" jsonb,
	"sessions_per_week" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "phases_pos_uq" UNIQUE("plan_id","position"),
	CONSTRAINT "phases_weeks_ck" CHECK ("phases"."start_week" >= 1 AND "phases"."end_week" >= "phases"."start_week")
);
--> statement-breakpoint
CREATE TABLE "plan_revisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid,
	"plan_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"diff" jsonb,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "plan_revisions_uq" UNIQUE("plan_id","revision")
);
--> statement-breakpoint
CREATE TABLE "session_blocks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid,
	"session_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"label" text,
	"type" "block_type" NOT NULL,
	"organization" "block_organization" DEFAULT 'straight_sets' NOT NULL,
	"rounds" smallint,
	"rest_between_rounds_s" smallint,
	"notes" text,
	CONSTRAINT "session_blocks_pos_uq" UNIQUE("session_id","position")
);
--> statement-breakpoint
CREATE TABLE "session_exercises" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid,
	"block_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"pairing_label" text,
	"method_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"sets" smallint,
	"reps_min" smallint,
	"reps_max" smallint,
	"reps_per_cluster" smallint,
	"intra_cluster_rest_s" smallint,
	"duration_s" integer,
	"distance_m" numeric,
	"contacts" smallint,
	"load_kg" numeric(6, 2),
	"load_pct_1rm" numeric(5, 2),
	"rir_min" smallint,
	"rir_max" smallint,
	"rpe_target" numeric(3, 1),
	"effort_character" text,
	"velocity_target_mps" numeric(4, 2),
	"velocity_loss_pct" smallint,
	"tempo" text,
	"rest_s" smallint,
	"rom" "rom_spec",
	"intensity_note" text,
	"band_tension" jsonb,
	"chain_load_kg" numeric(6, 2),
	"extra" jsonb,
	"load_basis_metric" text,
	"side" "side_spec" DEFAULT 'both' NOT NULL,
	"progression_rule_id" uuid,
	"notes_for_client" text,
	"coach_notes" text,
	"source" "prescription_source" DEFAULT 'manual' NOT NULL,
	"recommendation_id" uuid,
	"derived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "session_exercises_pos_uq" UNIQUE("block_id","position"),
	CONSTRAINT "session_exercises_reps_ck" CHECK ("session_exercises"."reps_min" IS NULL OR "session_exercises"."reps_max" IS NULL OR "session_exercises"."reps_min" <= "session_exercises"."reps_max"),
	CONSTRAINT "session_exercises_rir_ck" CHECK (("session_exercises"."rir_min" IS NULL OR "session_exercises"."rir_min" BETWEEN 0 AND 10) AND ("session_exercises"."rir_max" IS NULL OR "session_exercises"."rir_max" BETWEEN 0 AND 10) AND ("session_exercises"."rir_min" IS NULL OR "session_exercises"."rir_max" IS NULL OR "session_exercises"."rir_min" <= "session_exercises"."rir_max")),
	CONSTRAINT "session_exercises_rpe_ck" CHECK ("session_exercises"."rpe_target" IS NULL OR ("session_exercises"."rpe_target" BETWEEN 1 AND 10 AND ("session_exercises"."rpe_target" * 2) = trunc("session_exercises"."rpe_target" * 2))),
	CONSTRAINT "session_exercises_vl_ck" CHECK ("session_exercises"."velocity_loss_pct" IS NULL OR "session_exercises"."velocity_loss_pct" BETWEEN 0 AND 60),
	CONSTRAINT "session_exercises_pct_ck" CHECK ("session_exercises"."load_pct_1rm" IS NULL OR "session_exercises"."load_pct_1rm" BETWEEN 0 AND 110),
	CONSTRAINT "session_exercises_tempo_ck" CHECK ("session_exercises"."tempo" IS NULL OR "session_exercises"."tempo" ~ '^[0-9X]{1,2}-[0-9X]{1,2}-[0-9X]{1,2}-[0-9X]{1,2}$'),
	CONSTRAINT "session_exercises_nonneg_ck" CHECK (coalesce("session_exercises"."sets",0) >= 0 AND coalesce("session_exercises"."load_kg",0) >= 0 AND coalesce("session_exercises"."rest_s",0) >= 0)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid,
	"microcycle_id" uuid NOT NULL,
	"day_label" text NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"scheduled_date" date,
	"scheduled_time" time,
	"location" "session_location",
	"title" text,
	"objective" text,
	"estimated_duration_min" smallint,
	"notes_for_client" text,
	"notes_for_trainer" text,
	"published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_plans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid,
	"kind" "plan_kind" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"primary_goal_id" uuid,
	"secondary_goal_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"start_date" date,
	"duration_months" smallint NOT NULL,
	"end_date" date,
	"sessions_per_week" smallint,
	"periodization_model" "periodization_model",
	"status" "plan_status" DEFAULT 'draft' NOT NULL,
	"current_revision" integer DEFAULT 1 NOT NULL,
	"based_on_template_id" uuid,
	"proposal_of_plan_id" uuid,
	"recommendation_id" uuid,
	"published_to_client_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "training_plans_duration_ck" CHECK ("training_plans"."duration_months" IN (3, 6, 9, 12)),
	CONSTRAINT "training_plans_spw_ck" CHECK ("training_plans"."sessions_per_week" IS NULL OR "training_plans"."sessions_per_week" BETWEEN 1 AND 7),
	CONSTRAINT "training_plans_kind_client_ck" CHECK (("training_plans"."kind" = 'TEMPLATE') = ("training_plans"."client_id" IS NULL)),
	CONSTRAINT "training_plans_dates_ck" CHECK ("training_plans"."end_date" IS NULL OR "training_plans"."start_date" IS NULL OR "training_plans"."end_date" >= "training_plans"."start_date")
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"status" "attendance_status" NOT NULL,
	"performed_date" date,
	"start_time" time,
	"duration_min" smallint,
	"reason_code" "absence_reason",
	"reason_text" text,
	"recorded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "exercise_feedback" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"session_exercise_id" uuid NOT NULL,
	"difficulty" smallint,
	"pain" smallint,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exercise_feedback_uq" UNIQUE("session_exercise_id"),
	CONSTRAINT "exercise_feedback_difficulty_ck" CHECK ("exercise_feedback"."difficulty" IS NULL OR "exercise_feedback"."difficulty" BETWEEN 0 AND 10),
	CONSTRAINT "exercise_feedback_pain_ck" CHECK ("exercise_feedback"."pain" IS NULL OR "exercise_feedback"."pain" BETWEEN 0 AND 10)
);
--> statement-breakpoint
CREATE TABLE "exercise_substitutions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"session_id" uuid,
	"session_exercise_id" uuid,
	"original_exercise_id" uuid NOT NULL,
	"reason" "substitution_reason" NOT NULL,
	"suggestions" jsonb,
	"chosen_exercise_id" uuid,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercise_tolerances" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"exercise_id" uuid,
	"movement_pattern_id" uuid,
	"kind" "tolerance_kind" NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exercise_tolerances_target_ck" CHECK (("exercise_tolerances"."exercise_id" IS NULL) <> ("exercise_tolerances"."movement_pattern_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"feeling" smallint,
	"session_rpe" numeric(3, 1),
	"fatigue" smallint,
	"pain" smallint,
	"motivation" smallint,
	"comment" text,
	"trainer_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_session_id_unique" UNIQUE("session_id"),
	CONSTRAINT "feedback_feeling_ck" CHECK ("feedback"."feeling" IS NULL OR "feedback"."feeling" BETWEEN 0 AND 10),
	CONSTRAINT "feedback_fatigue_ck" CHECK ("feedback"."fatigue" IS NULL OR "feedback"."fatigue" BETWEEN 0 AND 10),
	CONSTRAINT "feedback_pain_ck" CHECK ("feedback"."pain" IS NULL OR "feedback"."pain" BETWEEN 0 AND 10),
	CONSTRAINT "feedback_motivation_ck" CHECK ("feedback"."motivation" IS NULL OR "feedback"."motivation" BETWEEN 0 AND 10),
	CONSTRAINT "feedback_srpe_ck" CHECK ("feedback"."session_rpe" IS NULL OR "feedback"."session_rpe" BETWEEN 0 AND 10)
);
--> statement-breakpoint
CREATE TABLE "pain_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"occurred_on" date NOT NULL,
	"body_region" text NOT NULL,
	"intensity" smallint NOT NULL,
	"context" "pain_context" NOT NULL,
	"session_id" uuid,
	"exercise_id" uuid,
	"comment_enc" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pain_logs_intensity_ck" CHECK ("pain_logs"."intensity" IS NULL OR "pain_logs"."intensity" BETWEEN 0 AND 10)
);
--> statement-breakpoint
CREATE TABLE "readiness" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"recorded_on" date NOT NULL,
	"sleep_quality" smallint,
	"sleep_hours" numeric(3, 1),
	"energy" smallint,
	"fatigue" smallint,
	"stress" smallint,
	"soreness" smallint,
	"motivation" smallint,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "readiness_day_uq" UNIQUE("client_id","recorded_on"),
	CONSTRAINT "readiness_sleep_ck" CHECK ("readiness"."sleep_quality" IS NULL OR "readiness"."sleep_quality" BETWEEN 0 AND 10),
	CONSTRAINT "readiness_energy_ck" CHECK ("readiness"."energy" IS NULL OR "readiness"."energy" BETWEEN 0 AND 10),
	CONSTRAINT "readiness_fatigue_ck" CHECK ("readiness"."fatigue" IS NULL OR "readiness"."fatigue" BETWEEN 0 AND 10),
	CONSTRAINT "readiness_stress_ck" CHECK ("readiness"."stress" IS NULL OR "readiness"."stress" BETWEEN 0 AND 10),
	CONSTRAINT "readiness_soreness_ck" CHECK ("readiness"."soreness" IS NULL OR "readiness"."soreness" BETWEEN 0 AND 10),
	CONSTRAINT "readiness_motivation_ck" CHECK ("readiness"."motivation" IS NULL OR "readiness"."motivation" BETWEEN 0 AND 10)
);
--> statement-breakpoint
CREATE TABLE "set_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"session_exercise_id" uuid,
	"exercise_id_performed" uuid NOT NULL,
	"set_index" smallint NOT NULL,
	"load_kg" numeric(6, 2),
	"reps" smallint,
	"rir" smallint,
	"rir_assumed" boolean DEFAULT false NOT NULL,
	"rpe" numeric(3, 1),
	"mean_velocity_mps" numeric(4, 2),
	"peak_velocity_mps" numeric(4, 2),
	"duration_s" integer,
	"distance_m" numeric,
	"side" text,
	"band_tension" jsonb,
	"completed" boolean DEFAULT true NOT NULL,
	"logged_by_role" "logged_by_role" NOT NULL,
	"logged_by" uuid NOT NULL,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"client_mutation_id" text,
	"source" "log_source" DEFAULT 'manual' NOT NULL,
	CONSTRAINT "set_logs_client_mutation_id_unique" UNIQUE("client_mutation_id"),
	CONSTRAINT "set_logs_rir_ck" CHECK ("set_logs"."rir" IS NULL OR "set_logs"."rir" BETWEEN 0 AND 10),
	CONSTRAINT "set_logs_rpe_ck" CHECK ("set_logs"."rpe" IS NULL OR "set_logs"."rpe" BETWEEN 1 AND 10),
	CONSTRAINT "set_logs_nonneg_ck" CHECK (coalesce("set_logs"."load_kg",0) >= 0 AND coalesce("set_logs"."reps",0) >= 0)
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"severity" "alert_severity" NOT NULL,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"data" jsonb,
	"rule_key" text,
	"rule_set_version" integer,
	"status" "alert_status" DEFAULT 'open' NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_rule_overrides" (
	"client_id" uuid NOT NULL,
	"rule_key" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"enabled" boolean NOT NULL,
	"reason" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_rule_overrides_client_id_rule_key_pk" PRIMARY KEY("client_id","rule_key")
);
--> statement-breakpoint
CREATE TABLE "manual_overrides" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"field" text NOT NULL,
	"proposed_value" jsonb,
	"final_value" jsonb,
	"recommendation_id" uuid,
	"reason" text,
	"user_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendation_evidence" (
	"recommendation_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	"applicability" jsonb,
	CONSTRAINT "recommendation_evidence_recommendation_id_claim_id_pk" PRIMARY KEY("recommendation_id","claim_id")
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"type" "recommendation_type" NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "recommendation_status" DEFAULT 'proposed' NOT NULL,
	"explanation" jsonb NOT NULL,
	"inputs_snapshot" jsonb NOT NULL,
	"rule_set_version" integer NOT NULL,
	"rule_keys" text[] DEFAULT '{}'::text[] NOT NULL,
	"confidence" "recommendation_confidence" NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"decision_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recommendations_decided_ck" CHECK ("recommendations"."status" = 'proposed' OR "recommendations"."status" = 'superseded' OR "recommendations"."status" = 'expired' OR "recommendations"."decided_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "rule_sets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"version" integer NOT NULL,
	"status" "rule_set_status" DEFAULT 'draft' NOT NULL,
	"notes" text,
	"published_at" timestamp with time zone,
	"published_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rule_sets_org_version_uq" UNIQUE NULLS NOT DISTINCT("organization_id","version")
);
--> statement-breakpoint
CREATE TABLE "rules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"rule_set_id" uuid NOT NULL,
	"key" text NOT NULL,
	"domain" "rule_domain" NOT NULL,
	"description" text NOT NULL,
	"condition" jsonb NOT NULL,
	"action" jsonb NOT NULL,
	"parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"evidence_claim_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"evidence_level" "evidence_level" DEFAULT 'F' NOT NULL,
	"limitations" text,
	"applies_to_populations" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rules_set_key_uq" UNIQUE("rule_set_id","key")
);
--> statement-breakpoint
CREATE TABLE "domain_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "external_measurements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"connection_id" uuid,
	"source" text NOT NULL,
	"device" text,
	"type" text NOT NULL,
	"value" text,
	"unit" text,
	"measured_at" timestamp with time zone NOT NULL,
	"raw" jsonb,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "external_measurements_dedupe_uq" UNIQUE("source","external_id")
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text,
	"purpose" text NOT NULL,
	"client_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "files_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"entity" text NOT NULL,
	"file_id" uuid,
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"total_rows" integer,
	"valid_rows" integer,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_rows" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"data" jsonb NOT NULL,
	"errors" jsonb,
	"status" "import_row_status" NOT NULL,
	"created_entity_id" uuid,
	CONSTRAINT "import_rows_uq" UNIQUE("job_id","row_number")
);
--> statement-breakpoint
CREATE TABLE "integration_connections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid,
	"provider" text NOT NULL,
	"credentials_enc" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_connections_status_ck" CHECK ("integration_connections"."status" IN ('active','revoked','error'))
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"channel" "notification_channel" DEFAULT 'in_app' NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"read_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid,
	"type" text NOT NULL,
	"format" "report_format" NOT NULL,
	"parameters" jsonb,
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"file_id" uuid,
	"error" text,
	"generated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exercise_categories" ADD CONSTRAINT "exercise_categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_category_links" ADD CONSTRAINT "exercise_category_links_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_category_links" ADD CONSTRAINT "exercise_category_links_category_id_exercise_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."exercise_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_equipment" ADD CONSTRAINT "exercise_equipment_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_equipment" ADD CONSTRAINT "exercise_equipment_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_instructions" ADD CONSTRAINT "exercise_instructions_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_media" ADD CONSTRAINT "exercise_media_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_method_links" ADD CONSTRAINT "exercise_method_links_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_method_links" ADD CONSTRAINT "exercise_method_links_method_id_methods_id_fk" FOREIGN KEY ("method_id") REFERENCES "public"."methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_muscles" ADD CONSTRAINT "exercise_muscles_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_muscles" ADD CONSTRAINT "exercise_muscles_muscle_id_muscles_id_fk" FOREIGN KEY ("muscle_id") REFERENCES "public"."muscles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_progressions" ADD CONSTRAINT "exercise_progressions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_progressions" ADD CONSTRAINT "exercise_progressions_from_exercise_id_exercises_id_fk" FOREIGN KEY ("from_exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_progressions" ADD CONSTRAINT "exercise_progressions_to_exercise_id_exercises_id_fk" FOREIGN KEY ("to_exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_tag_links" ADD CONSTRAINT "exercise_tag_links_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_tag_links" ADD CONSTRAINT "exercise_tag_links_tag_id_exercise_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."exercise_tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_tags" ADD CONSTRAINT "exercise_tags_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_movement_pattern_id_movement_patterns_id_fk" FOREIGN KEY ("movement_pattern_id") REFERENCES "public"."movement_patterns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_prescription_profile_id_prescription_profiles_id_fk" FOREIGN KEY ("prescription_profile_id") REFERENCES "public"."prescription_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement_patterns" ADD CONSTRAINT "movement_patterns_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "muscles" ADD CONSTRAINT "muscles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescription_profiles" ADD CONSTRAINT "prescription_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescription_variables" ADD CONSTRAINT "prescription_variables_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_evidence" ADD CONSTRAINT "claim_evidence_claim_id_knowledge_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."knowledge_claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_evidence" ADD CONSTRAINT "claim_evidence_finding_id_evidence_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."evidence_findings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_findings" ADD CONSTRAINT "evidence_findings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_findings" ADD CONSTRAINT "evidence_findings_source_id_evidence_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."evidence_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_findings" ADD CONSTRAINT "evidence_findings_outcome_id_outcomes_id_fk" FOREIGN KEY ("outcome_id") REFERENCES "public"."outcomes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_findings" ADD CONSTRAINT "evidence_findings_population_id_populations_id_fk" FOREIGN KEY ("population_id") REFERENCES "public"."populations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_reviews" ADD CONSTRAINT "evidence_reviews_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_reviews" ADD CONSTRAINT "evidence_reviews_source_id_evidence_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."evidence_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_reviews" ADD CONSTRAINT "evidence_reviews_claim_id_knowledge_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."knowledge_claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_sources" ADD CONSTRAINT "evidence_sources_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_claims" ADD CONSTRAINT "knowledge_claims_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "method_evidence" ADD CONSTRAINT "method_evidence_method_id_methods_id_fk" FOREIGN KEY ("method_id") REFERENCES "public"."methods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "method_evidence" ADD CONSTRAINT "method_evidence_finding_id_evidence_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."evidence_findings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "method_notes" ADD CONSTRAINT "method_notes_method_id_methods_id_fk" FOREIGN KEY ("method_id") REFERENCES "public"."methods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "method_notes" ADD CONSTRAINT "method_notes_claim_id_knowledge_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."knowledge_claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "method_variables" ADD CONSTRAINT "method_variables_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "method_variables" ADD CONSTRAINT "method_variables_method_id_methods_id_fk" FOREIGN KEY ("method_id") REFERENCES "public"."methods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "method_variables" ADD CONSTRAINT "method_variables_population_id_populations_id_fk" FOREIGN KEY ("population_id") REFERENCES "public"."populations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "method_variables" ADD CONSTRAINT "method_variables_claim_id_knowledge_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."knowledge_claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "methods" ADD CONSTRAINT "methods_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "populations" ADD CONSTRAINT "populations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_batteries" ADD CONSTRAINT "assessment_batteries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_results" ADD CONSTRAINT "assessment_results_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_results" ADD CONSTRAINT "assessment_results_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_results" ADD CONSTRAINT "assessment_results_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_results" ADD CONSTRAINT "assessment_results_test_id_assessment_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."assessment_tests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_tests" ADD CONSTRAINT "assessment_tests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_battery_id_assessment_batteries_id_fk" FOREIGN KEY ("battery_id") REFERENCES "public"."assessment_batteries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_assessor_user_id_users_id_fk" FOREIGN KEY ("assessor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battery_tests" ADD CONSTRAINT "battery_tests_battery_id_assessment_batteries_id_fk" FOREIGN KEY ("battery_id") REFERENCES "public"."assessment_batteries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battery_tests" ADD CONSTRAINT "battery_tests_test_id_assessment_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."assessment_tests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "derived_metrics" ADD CONSTRAINT "derived_metrics_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "derived_metrics" ADD CONSTRAINT "derived_metrics_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "derived_metrics" ADD CONSTRAINT "derived_metrics_result_id_assessment_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."assessment_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "derived_metrics" ADD CONSTRAINT "derived_metrics_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_values" ADD CONSTRAINT "reference_values_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_values" ADD CONSTRAINT "reference_values_test_id_assessment_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."assessment_tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_values" ADD CONSTRAINT "reference_values_population_id_populations_id_fk" FOREIGN KEY ("population_id") REFERENCES "public"."populations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_values" ADD CONSTRAINT "reference_values_source_id_evidence_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."evidence_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_reliability_data" ADD CONSTRAINT "test_reliability_data_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_reliability_data" ADD CONSTRAINT "test_reliability_data_test_id_assessment_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."assessment_tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_reliability_data" ADD CONSTRAINT "test_reliability_data_population_id_populations_id_fk" FOREIGN KEY ("population_id") REFERENCES "public"."populations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_reliability_data" ADD CONSTRAINT "test_reliability_data_source_id_evidence_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."evidence_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_sets" ADD CONSTRAINT "exercise_sets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_sets" ADD CONSTRAINT "exercise_sets_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_sets" ADD CONSTRAINT "exercise_sets_session_exercise_id_session_exercises_id_fk" FOREIGN KEY ("session_exercise_id") REFERENCES "public"."session_exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mesocycles" ADD CONSTRAINT "mesocycles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mesocycles" ADD CONSTRAINT "mesocycles_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mesocycles" ADD CONSTRAINT "mesocycles_phase_id_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."phases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "microcycles" ADD CONSTRAINT "microcycles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "microcycles" ADD CONSTRAINT "microcycles_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "microcycles" ADD CONSTRAINT "microcycles_mesocycle_id_mesocycles_id_fk" FOREIGN KEY ("mesocycle_id") REFERENCES "public"."mesocycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phases" ADD CONSTRAINT "phases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phases" ADD CONSTRAINT "phases_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phases" ADD CONSTRAINT "phases_plan_id_training_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."training_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_revisions" ADD CONSTRAINT "plan_revisions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_revisions" ADD CONSTRAINT "plan_revisions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_revisions" ADD CONSTRAINT "plan_revisions_plan_id_training_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."training_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_blocks" ADD CONSTRAINT "session_blocks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_blocks" ADD CONSTRAINT "session_blocks_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_blocks" ADD CONSTRAINT "session_blocks_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_exercises" ADD CONSTRAINT "session_exercises_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_exercises" ADD CONSTRAINT "session_exercises_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_exercises" ADD CONSTRAINT "session_exercises_block_id_session_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."session_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_exercises" ADD CONSTRAINT "session_exercises_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_microcycle_id_microcycles_id_fk" FOREIGN KEY ("microcycle_id") REFERENCES "public"."microcycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_primary_goal_id_goals_id_fk" FOREIGN KEY ("primary_goal_id") REFERENCES "public"."goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_feedback" ADD CONSTRAINT "exercise_feedback_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_feedback" ADD CONSTRAINT "exercise_feedback_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_feedback" ADD CONSTRAINT "exercise_feedback_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_feedback" ADD CONSTRAINT "exercise_feedback_session_exercise_id_session_exercises_id_fk" FOREIGN KEY ("session_exercise_id") REFERENCES "public"."session_exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_substitutions" ADD CONSTRAINT "exercise_substitutions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_substitutions" ADD CONSTRAINT "exercise_substitutions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_substitutions" ADD CONSTRAINT "exercise_substitutions_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_substitutions" ADD CONSTRAINT "exercise_substitutions_session_exercise_id_session_exercises_id_fk" FOREIGN KEY ("session_exercise_id") REFERENCES "public"."session_exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_substitutions" ADD CONSTRAINT "exercise_substitutions_original_exercise_id_exercises_id_fk" FOREIGN KEY ("original_exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_substitutions" ADD CONSTRAINT "exercise_substitutions_chosen_exercise_id_exercises_id_fk" FOREIGN KEY ("chosen_exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_tolerances" ADD CONSTRAINT "exercise_tolerances_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_tolerances" ADD CONSTRAINT "exercise_tolerances_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_tolerances" ADD CONSTRAINT "exercise_tolerances_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_tolerances" ADD CONSTRAINT "exercise_tolerances_movement_pattern_id_movement_patterns_id_fk" FOREIGN KEY ("movement_pattern_id") REFERENCES "public"."movement_patterns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pain_logs" ADD CONSTRAINT "pain_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pain_logs" ADD CONSTRAINT "pain_logs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pain_logs" ADD CONSTRAINT "pain_logs_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pain_logs" ADD CONSTRAINT "pain_logs_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readiness" ADD CONSTRAINT "readiness_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readiness" ADD CONSTRAINT "readiness_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_logs" ADD CONSTRAINT "set_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_logs" ADD CONSTRAINT "set_logs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_logs" ADD CONSTRAINT "set_logs_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_logs" ADD CONSTRAINT "set_logs_session_exercise_id_session_exercises_id_fk" FOREIGN KEY ("session_exercise_id") REFERENCES "public"."session_exercises"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_logs" ADD CONSTRAINT "set_logs_exercise_id_performed_exercises_id_fk" FOREIGN KEY ("exercise_id_performed") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_rule_overrides" ADD CONSTRAINT "client_rule_overrides_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_rule_overrides" ADD CONSTRAINT "client_rule_overrides_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_overrides" ADD CONSTRAINT "manual_overrides_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_overrides" ADD CONSTRAINT "manual_overrides_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_overrides" ADD CONSTRAINT "manual_overrides_recommendation_id_recommendations_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."recommendations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_evidence" ADD CONSTRAINT "recommendation_evidence_recommendation_id_recommendations_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."recommendations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_evidence" ADD CONSTRAINT "recommendation_evidence_claim_id_knowledge_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."knowledge_claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_sets" ADD CONSTRAINT "rule_sets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules" ADD CONSTRAINT "rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules" ADD CONSTRAINT "rules_rule_set_id_rule_sets_id_fk" FOREIGN KEY ("rule_set_id") REFERENCES "public"."rule_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_measurements" ADD CONSTRAINT "external_measurements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_measurements" ADD CONSTRAINT "external_measurements_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_measurements" ADD CONSTRAINT "external_measurements_connection_id_integration_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."integration_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_job_id_import_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."import_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exercise_media_exercise_idx" ON "exercise_media" USING btree ("exercise_id");--> statement-breakpoint
CREATE INDEX "exercises_name_trgm_idx" ON "exercises" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "exercises_pattern_idx" ON "exercises" USING btree ("movement_pattern_id");--> statement-breakpoint
CREATE INDEX "evidence_findings_source_idx" ON "evidence_findings" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "evidence_findings_outcome_idx" ON "evidence_findings" USING btree ("outcome_id");--> statement-breakpoint
CREATE INDEX "method_notes_method_idx" ON "method_notes" USING btree ("method_id");--> statement-breakpoint
CREATE INDEX "method_variables_method_idx" ON "method_variables" USING btree ("method_id");--> statement-breakpoint
CREATE INDEX "assessment_results_assessment_idx" ON "assessment_results" USING btree ("assessment_id","test_id");--> statement-breakpoint
CREATE INDEX "assessment_results_client_test_idx" ON "assessment_results" USING btree ("client_id","test_id");--> statement-breakpoint
CREATE INDEX "assessments_client_idx" ON "assessments" USING btree ("client_id","assessed_on");--> statement-breakpoint
CREATE INDEX "derived_metrics_client_idx" ON "derived_metrics" USING btree ("client_id","metric");--> statement-breakpoint
CREATE INDEX "reference_values_test_idx" ON "reference_values" USING btree ("test_id");--> statement-breakpoint
CREATE INDEX "test_reliability_test_idx" ON "test_reliability_data" USING btree ("test_id");--> statement-breakpoint
CREATE INDEX "sessions_client_date_idx" ON "sessions" USING btree ("client_id","scheduled_date");--> statement-breakpoint
CREATE INDEX "sessions_microcycle_idx" ON "sessions" USING btree ("microcycle_id");--> statement-breakpoint
CREATE INDEX "training_plans_client_idx" ON "training_plans" USING btree ("client_id","status");--> statement-breakpoint
CREATE INDEX "attendance_client_idx" ON "attendance" USING btree ("client_id","performed_date");--> statement-breakpoint
CREATE INDEX "exercise_substitutions_client_idx" ON "exercise_substitutions" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "pain_logs_client_idx" ON "pain_logs" USING btree ("client_id","occurred_on");--> statement-breakpoint
CREATE INDEX "set_logs_session_idx" ON "set_logs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "set_logs_client_exercise_idx" ON "set_logs" USING btree ("client_id","exercise_id_performed","logged_at");--> statement-breakpoint
CREATE INDEX "alerts_org_status_idx" ON "alerts" USING btree ("organization_id","status","severity");--> statement-breakpoint
CREATE INDEX "alerts_client_idx" ON "alerts" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "manual_overrides_entity_idx" ON "manual_overrides" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "recommendations_client_idx" ON "recommendations" USING btree ("client_id","status");--> statement-breakpoint
CREATE INDEX "domain_events_pending_idx" ON "domain_events" USING btree ("occurred_at") WHERE "domain_events"."processed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "external_measurements_client_idx" ON "external_measurements" USING btree ("client_id","type","measured_at");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "reports_client_idx" ON "reports" USING btree ("client_id");