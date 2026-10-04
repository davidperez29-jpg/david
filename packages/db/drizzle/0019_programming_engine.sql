ALTER TYPE "public"."recommendation_status" ADD VALUE 'reverted';--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "auto_apply_load_progressions" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "training_plans" ADD COLUMN "generation_notes" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "recommendations" ADD COLUMN "plan_id" uuid;--> statement-breakpoint
ALTER TABLE "recommendations" ADD COLUMN "key" text;--> statement-breakpoint
ALTER TABLE "recommendations" ADD COLUMN "applied" jsonb;--> statement-breakpoint
CREATE INDEX "recommendations_key_idx" ON "recommendations" USING btree ("client_id","key");