ALTER TABLE "reports" ADD COLUMN "shared_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "shared_by" uuid;