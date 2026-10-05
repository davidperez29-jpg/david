CREATE TYPE "public"."formula_error_model" AS ENUM('difference', 'none');--> statement-breakpoint
ALTER TYPE "public"."aggregation" ADD VALUE 'median';--> statement-breakpoint
ALTER TYPE "public"."aggregation" ADD VALUE 'min';--> statement-breakpoint
ALTER TYPE "public"."aggregation" ADD VALUE 'max';--> statement-breakpoint
CREATE TABLE "client_group_members" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_group_members_uq" UNIQUE("group_id","client_id")
);
--> statement-breakpoint
CREATE TABLE "client_groups" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "client_groups_org_name_uq" UNIQUE("organization_id","name")
);
--> statement-breakpoint
CREATE TABLE "derived_formulas" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"expression" text NOT NULL,
	"constants" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"better_direction" "better_direction" NOT NULL,
	"is_estimate" boolean DEFAULT false NOT NULL,
	"error_model" "formula_error_model" DEFAULT 'none' NOT NULL,
	"sex" text,
	"definition" text NOT NULL,
	"status" "publication_status" DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "derived_formulas_org_slug_uq" UNIQUE NULLS NOT DISTINCT("organization_id","slug"),
	CONSTRAINT "derived_formulas_sex_ck" CHECK ("derived_formulas"."sex" IS NULL OR "derived_formulas"."sex" IN ('male', 'female')),
	CONSTRAINT "derived_formulas_expression_ck" CHECK (length("derived_formulas"."expression") <= 500)
);
--> statement-breakpoint
ALTER TABLE "assessment_tests" ADD COLUMN "plausible_min" numeric;--> statement-breakpoint
ALTER TABLE "assessment_tests" ADD COLUMN "plausible_max" numeric;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "group_id" uuid;--> statement-breakpoint
ALTER TABLE "reference_values" ADD COLUMN "condition" text;--> statement-breakpoint
ALTER TABLE "reference_values" ADD COLUMN "limitations" text;--> statement-breakpoint
ALTER TABLE "client_group_members" ADD CONSTRAINT "client_group_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_group_members" ADD CONSTRAINT "client_group_members_group_id_client_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."client_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_group_members" ADD CONSTRAINT "client_group_members_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_groups" ADD CONSTRAINT "client_groups_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "derived_formulas" ADD CONSTRAINT "derived_formulas_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_group_members_client_idx" ON "client_group_members" USING btree ("client_id");--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_group_id_client_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."client_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assessments_group_idx" ON "assessments" USING btree ("group_id","assessed_on");