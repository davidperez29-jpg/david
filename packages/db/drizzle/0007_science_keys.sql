ALTER TABLE "evidence_findings" ADD COLUMN "finding_key" text;--> statement-breakpoint
ALTER TABLE "evidence_sources" ADD COLUMN "source_key" text;--> statement-breakpoint
ALTER TABLE "evidence_findings" ADD CONSTRAINT "evidence_findings_key_uq" UNIQUE NULLS NOT DISTINCT("organization_id","finding_key");--> statement-breakpoint
ALTER TABLE "evidence_sources" ADD CONSTRAINT "evidence_sources_key_uq" UNIQUE NULLS NOT DISTINCT("organization_id","source_key");