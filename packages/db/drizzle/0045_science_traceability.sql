CREATE TYPE "public"."claim_evidence_kind" AS ENUM('incidence_reduction', 'risk_factor_change', 'performance', 'mechanism', 'practical_criterion', 'insufficient');--> statement-breakpoint
CREATE TYPE "public"."evidence_origin" AS ENUM('user_document', 'external_literature', 'practical_proposal');--> statement-breakpoint
ALTER TYPE "public"."verification_status" ADD VALUE 'cited_in_document';--> statement-breakpoint
ALTER TYPE "public"."verification_status" ADD VALUE 'unverifiable';--> statement-breakpoint
CREATE TABLE "science_searches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"search_key" text,
	"topic" text NOT NULL,
	"objective" text NOT NULL,
	"population" text,
	"injury" text,
	"phase" text,
	"method" text,
	"test" text,
	"criterion" text,
	"query" text NOT NULL,
	"database" text DEFAULT 'PubMed' NOT NULL,
	"searched_on" date NOT NULL,
	"reviewed" integer,
	"selected_source_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "evidence_sources" ADD COLUMN "origin" "evidence_origin" DEFAULT 'external_literature' NOT NULL;--> statement-breakpoint
ALTER TABLE "evidence_sources" ADD COLUMN "cited_in" text;--> statement-breakpoint
ALTER TABLE "knowledge_claims" ADD COLUMN "evidence_kind" "claim_evidence_kind";--> statement-breakpoint
ALTER TABLE "knowledge_claims" ADD COLUMN "origin" "evidence_origin" DEFAULT 'external_literature' NOT NULL;--> statement-breakpoint
ALTER TABLE "science_searches" ADD CONSTRAINT "science_searches_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "science_searches_key_uq" ON "science_searches" USING btree (coalesce("organization_id", '00000000-0000-0000-0000-000000000000'::uuid),"search_key") WHERE "science_searches"."search_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "science_searches_topic_idx" ON "science_searches" USING btree ("topic","searched_on");