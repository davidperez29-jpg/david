CREATE TYPE "public"."injury_criterion_evidence" AS ENUM('evidence', 'consensus', 'practical');--> statement-breakpoint
CREATE TYPE "public"."injury_criterion_role" AS ENUM('entry', 'success', 'progression', 'regression', 'stop');--> statement-breakpoint
CREATE TYPE "public"."injury_alert_severity" AS ENUM('review', 'stop');--> statement-breakpoint
CREATE TYPE "public"."injury_side" AS ENUM('left', 'right', 'both', 'none');--> statement-breakpoint
CREATE TYPE "public"."injury_status" AS ENUM('active', 'closed');--> statement-breakpoint
CREATE TYPE "public"."rtp_outcome" AS ENUM('authorized', 'not_yet', 'deferred');--> statement-breakpoint
CREATE TYPE "public"."rtp_stage" AS ENUM('return_to_participation', 'return_to_sport', 'return_to_performance');--> statement-breakpoint
CREATE TABLE "injuries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"condition_id" uuid NOT NULL,
	"protocol_id" uuid,
	"side" "injury_side" DEFAULT 'none' NOT NULL,
	"occurred_on" date NOT NULL,
	"mechanism" text,
	"diagnosis_enc" text,
	"professional" text,
	"clinical_clearance_on" date,
	"current_phase_id" uuid,
	"phase_started_on" date,
	"status" "injury_status" DEFAULT 'active' NOT NULL,
	"restrictions" text,
	"notes" text,
	"decision_requested_at" timestamp with time zone,
	"health_declaration_id" uuid,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "injury_alerts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"injury_id" uuid NOT NULL,
	"symptom_id" uuid,
	"kind" text NOT NULL,
	"severity" "injury_alert_severity" NOT NULL,
	"message" text NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "injury_conditions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"slug" text NOT NULL,
	"region" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "publication_status" DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "injury_conditions_org_slug_uq" UNIQUE NULLS NOT DISTINCT("organization_id","slug")
);
--> statement-breakpoint
CREATE TABLE "injury_criterion_checks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"injury_id" uuid NOT NULL,
	"criterion_id" uuid NOT NULL,
	"met" boolean NOT NULL,
	"value" numeric,
	"source" text NOT NULL,
	"assessment_id" uuid,
	"checked_by" uuid,
	"note" text,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "injury_criterion_checks_source_ck" CHECK ("injury_criterion_checks"."source" IN ('auto', 'manual'))
);
--> statement-breakpoint
CREATE TABLE "injury_phase_history" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"injury_id" uuid NOT NULL,
	"phase_id" uuid NOT NULL,
	"started_on" date NOT NULL,
	"ended_on" date,
	"advanced_by" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "injury_protocol_criteria" (
	"id" uuid PRIMARY KEY NOT NULL,
	"protocol_id" uuid NOT NULL,
	"phase_id" uuid NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"role" "injury_criterion_role" NOT NULL,
	"text" text NOT NULL,
	"mandatory" boolean DEFAULT true NOT NULL,
	"test_slug" text,
	"metric" text,
	"operator" text,
	"threshold" numeric,
	"rtp_item" text,
	"evidence" "injury_criterion_evidence" DEFAULT 'practical' NOT NULL,
	"source_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"limitations" text,
	CONSTRAINT "injury_protocol_criteria_auto_ck" CHECK ("injury_protocol_criteria"."test_slug" IS NULL OR ("injury_protocol_criteria"."metric" IN ('value', 'lsi') AND "injury_protocol_criteria"."operator" IN ('>=', '<=') AND "injury_protocol_criteria"."threshold" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "injury_protocol_phases" (
	"id" uuid PRIMARY KEY NOT NULL,
	"protocol_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"name" text NOT NULL,
	"goals" text[] DEFAULT '{}'::text[] NOT NULL,
	"restrictions" text,
	"exercises" text[] DEFAULT '{}'::text[] NOT NULL,
	"dosage" text,
	"recommended_tests" text[] DEFAULT '{}'::text[] NOT NULL,
	CONSTRAINT "injury_protocol_phases_uq" UNIQUE("protocol_id","position")
);
--> statement-breakpoint
CREATE TABLE "injury_protocols" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"slug" text NOT NULL,
	"condition_id" uuid NOT NULL,
	"name" text NOT NULL,
	"protocol_version" integer DEFAULT 1 NOT NULL,
	"status" "publication_status" DEFAULT 'published' NOT NULL,
	"description" text,
	"pain_threshold" smallint DEFAULT 5 NOT NULL,
	"pain_threshold_basis" text,
	"source_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"limitations" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "injury_protocols_uq" UNIQUE NULLS NOT DISTINCT("organization_id","slug","protocol_version"),
	CONSTRAINT "injury_protocols_pain_ck" CHECK ("injury_protocols"."pain_threshold" BETWEEN 1 AND 10)
);
--> statement-breakpoint
CREATE TABLE "injury_symptoms" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"injury_id" uuid NOT NULL,
	"recorded_on" date NOT NULL,
	"pain" smallint NOT NULL,
	"worse_than_before" boolean DEFAULT false NOT NULL,
	"persists_next_day" boolean DEFAULT false NOT NULL,
	"function_loss" boolean DEFAULT false NOT NULL,
	"neurological" boolean DEFAULT false NOT NULL,
	"swelling" boolean DEFAULT false NOT NULL,
	"instability" boolean DEFAULT false NOT NULL,
	"adverse_reaction" boolean DEFAULT false NOT NULL,
	"note_enc" text,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "injury_symptoms_pain_ck" CHECK ("injury_symptoms"."pain" BETWEEN 0 AND 10)
);
--> statement-breakpoint
CREATE TABLE "rtp_decisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"injury_id" uuid NOT NULL,
	"stage" "rtp_stage" NOT NULL,
	"outcome" "rtp_outcome" NOT NULL,
	"decided_by_name" text NOT NULL,
	"decided_by_role" text NOT NULL,
	"decided_on" date NOT NULL,
	"rationale" text,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "injuries" ADD CONSTRAINT "injuries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injuries" ADD CONSTRAINT "injuries_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injuries" ADD CONSTRAINT "injuries_condition_id_injury_conditions_id_fk" FOREIGN KEY ("condition_id") REFERENCES "public"."injury_conditions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injuries" ADD CONSTRAINT "injuries_protocol_id_injury_protocols_id_fk" FOREIGN KEY ("protocol_id") REFERENCES "public"."injury_protocols"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injuries" ADD CONSTRAINT "injuries_current_phase_id_injury_protocol_phases_id_fk" FOREIGN KEY ("current_phase_id") REFERENCES "public"."injury_protocol_phases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injuries" ADD CONSTRAINT "injuries_health_declaration_id_health_declarations_id_fk" FOREIGN KEY ("health_declaration_id") REFERENCES "public"."health_declarations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injury_alerts" ADD CONSTRAINT "injury_alerts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injury_alerts" ADD CONSTRAINT "injury_alerts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injury_alerts" ADD CONSTRAINT "injury_alerts_injury_id_injuries_id_fk" FOREIGN KEY ("injury_id") REFERENCES "public"."injuries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injury_alerts" ADD CONSTRAINT "injury_alerts_symptom_id_injury_symptoms_id_fk" FOREIGN KEY ("symptom_id") REFERENCES "public"."injury_symptoms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injury_conditions" ADD CONSTRAINT "injury_conditions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injury_criterion_checks" ADD CONSTRAINT "injury_criterion_checks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injury_criterion_checks" ADD CONSTRAINT "injury_criterion_checks_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injury_criterion_checks" ADD CONSTRAINT "injury_criterion_checks_injury_id_injuries_id_fk" FOREIGN KEY ("injury_id") REFERENCES "public"."injuries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injury_criterion_checks" ADD CONSTRAINT "injury_criterion_checks_criterion_id_injury_protocol_criteria_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."injury_protocol_criteria"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injury_phase_history" ADD CONSTRAINT "injury_phase_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injury_phase_history" ADD CONSTRAINT "injury_phase_history_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injury_phase_history" ADD CONSTRAINT "injury_phase_history_injury_id_injuries_id_fk" FOREIGN KEY ("injury_id") REFERENCES "public"."injuries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injury_phase_history" ADD CONSTRAINT "injury_phase_history_phase_id_injury_protocol_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."injury_protocol_phases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injury_protocol_criteria" ADD CONSTRAINT "injury_protocol_criteria_protocol_id_injury_protocols_id_fk" FOREIGN KEY ("protocol_id") REFERENCES "public"."injury_protocols"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injury_protocol_criteria" ADD CONSTRAINT "injury_protocol_criteria_phase_id_injury_protocol_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."injury_protocol_phases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injury_protocol_phases" ADD CONSTRAINT "injury_protocol_phases_protocol_id_injury_protocols_id_fk" FOREIGN KEY ("protocol_id") REFERENCES "public"."injury_protocols"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injury_protocols" ADD CONSTRAINT "injury_protocols_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injury_protocols" ADD CONSTRAINT "injury_protocols_condition_id_injury_conditions_id_fk" FOREIGN KEY ("condition_id") REFERENCES "public"."injury_conditions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injury_symptoms" ADD CONSTRAINT "injury_symptoms_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injury_symptoms" ADD CONSTRAINT "injury_symptoms_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injury_symptoms" ADD CONSTRAINT "injury_symptoms_injury_id_injuries_id_fk" FOREIGN KEY ("injury_id") REFERENCES "public"."injuries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rtp_decisions" ADD CONSTRAINT "rtp_decisions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rtp_decisions" ADD CONSTRAINT "rtp_decisions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rtp_decisions" ADD CONSTRAINT "rtp_decisions_injury_id_injuries_id_fk" FOREIGN KEY ("injury_id") REFERENCES "public"."injuries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "injuries_client_idx" ON "injuries" USING btree ("client_id","status");--> statement-breakpoint
CREATE INDEX "injury_alerts_injury_idx" ON "injury_alerts" USING btree ("injury_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "injury_criterion_checks_idx" ON "injury_criterion_checks" USING btree ("injury_id","criterion_id","checked_at");--> statement-breakpoint
CREATE INDEX "injury_phase_history_injury_idx" ON "injury_phase_history" USING btree ("injury_id");--> statement-breakpoint
CREATE INDEX "injury_protocol_criteria_phase_idx" ON "injury_protocol_criteria" USING btree ("phase_id");--> statement-breakpoint
CREATE INDEX "injury_symptoms_injury_idx" ON "injury_symptoms" USING btree ("injury_id","recorded_on");--> statement-breakpoint
CREATE INDEX "rtp_decisions_injury_idx" ON "rtp_decisions" USING btree ("injury_id");