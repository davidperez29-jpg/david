DROP INDEX "exercises_name_trgm_idx";--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "source_ref" text;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "needs_review" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "review_notes" text;--> statement-breakpoint
CREATE INDEX "exercises_status_idx" ON "exercises" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "exercises_name_trgm_idx" ON "exercises" USING gin (lower(immutable_unaccent("name")) gin_trgm_ops);