CREATE TYPE "public"."plan_template_kind" AS ENUM('training', 'risk_reduction', 'readaptation');--> statement-breakpoint
CREATE TABLE "plan_template_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"template_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"name" text NOT NULL,
	"definition" jsonb NOT NULL,
	"note" text,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "plan_template_versions_uq" UNIQUE("template_id","version"),
	CONSTRAINT "plan_template_versions_version_ck" CHECK ("plan_template_versions"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "plan_templates" ADD COLUMN "profile_slug" text;--> statement-breakpoint
ALTER TABLE "plan_templates" ADD COLUMN "level_n" smallint;--> statement-breakpoint
ALTER TABLE "plan_templates" ADD COLUMN "population" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_templates" ADD COLUMN "equipment_slugs" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_templates" ADD COLUMN "kind" "plan_template_kind" DEFAULT 'training' NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_templates" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "plan_templates" ADD COLUMN "template_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_templates" ADD COLUMN "derived_from_template_id" uuid;--> statement-breakpoint
ALTER TABLE "training_plans" ADD COLUMN "based_on_template_version" integer;--> statement-breakpoint
ALTER TABLE "plan_template_versions" ADD CONSTRAINT "plan_template_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_template_versions" ADD CONSTRAINT "plan_template_versions_template_id_plan_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."plan_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plan_templates_filter_idx" ON "plan_templates" USING btree ("profile_slug","level_n","sessions_per_week");--> statement-breakpoint
ALTER TABLE "plan_templates" ADD CONSTRAINT "plan_templates_level_ck" CHECK ("plan_templates"."level_n" IS NULL OR "plan_templates"."level_n" BETWEEN 1 AND 3);--> statement-breakpoint
UPDATE "plan_templates" SET "level_n" = CASE "level" WHEN 'beginner' THEN 1 WHEN 'intermediate' THEN 2 WHEN 'advanced' THEN 3 END WHERE "level_n" IS NULL AND "level" IS NOT NULL;--> statement-breakpoint
INSERT INTO "plan_template_versions" ("id", "organization_id", "template_id", "version", "name", "definition", "created_at", "updated_at", "created_by")
  SELECT gen_random_uuid(), t."organization_id", t."id", 1, t."name", t."definition", t."created_at", t."updated_at", t."created_by"
  FROM "plan_templates" t
  WHERE NOT EXISTS (SELECT 1 FROM "plan_template_versions" v WHERE v."template_id" = t."id");--> statement-breakpoint
UPDATE "training_plans" SET "based_on_template_version" = 1 WHERE "based_on_template_id" IS NOT NULL AND "based_on_template_version" IS NULL;--> statement-breakpoint
UPDATE "plan_template_versions" v SET "used_at" = v."created_at" WHERE "used_at" IS NULL AND EXISTS (SELECT 1 FROM "training_plans" p WHERE p."based_on_template_id" = v."template_id" AND p."based_on_template_version" = v."version");
