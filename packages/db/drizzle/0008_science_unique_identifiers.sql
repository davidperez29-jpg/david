ALTER TABLE "evidence_findings" DROP CONSTRAINT "evidence_findings_key_uq";--> statement-breakpoint
ALTER TABLE "evidence_sources" DROP CONSTRAINT "evidence_sources_doi_uq";--> statement-breakpoint
ALTER TABLE "evidence_sources" DROP CONSTRAINT "evidence_sources_key_uq";--> statement-breakpoint
ALTER TABLE "evidence_sources" DROP CONSTRAINT "evidence_sources_pmid_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_findings_key_uq" ON "evidence_findings" USING btree (coalesce("organization_id", '00000000-0000-0000-0000-000000000000'::uuid),"finding_key") WHERE "evidence_findings"."finding_key" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_sources_doi_uq" ON "evidence_sources" USING btree (coalesce("organization_id", '00000000-0000-0000-0000-000000000000'::uuid),"doi") WHERE "evidence_sources"."doi" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_sources_key_uq" ON "evidence_sources" USING btree (coalesce("organization_id", '00000000-0000-0000-0000-000000000000'::uuid),"source_key") WHERE "evidence_sources"."source_key" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_sources_pmid_uq" ON "evidence_sources" USING btree (coalesce("organization_id", '00000000-0000-0000-0000-000000000000'::uuid),"pmid") WHERE "evidence_sources"."pmid" IS NOT NULL;