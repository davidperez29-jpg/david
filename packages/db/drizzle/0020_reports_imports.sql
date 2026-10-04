ALTER TABLE "import_jobs" ADD COLUMN "file_name" text;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "hash" text;