CREATE TABLE "plan_templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"goal_slug" text,
	"level" text,
	"sessions_per_week" smallint NOT NULL,
	"duration_months" smallint NOT NULL,
	"definition" jsonb NOT NULL,
	"method_slugs" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" "publication_status" DEFAULT 'published' NOT NULL,
	"derived_from_plan_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "plan_templates_org_slug_uq" UNIQUE NULLS NOT DISTINCT("organization_id","slug"),
	CONSTRAINT "plan_templates_duration_ck" CHECK ("plan_templates"."duration_months" IN (3, 6, 9, 12)),
	CONSTRAINT "plan_templates_spw_ck" CHECK ("plan_templates"."sessions_per_week" BETWEEN 1 AND 7)
);
--> statement-breakpoint
ALTER TABLE "plan_templates" ADD CONSTRAINT "plan_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;