-- Restructure phase 20 (A69): the legacy plaintext injury columns are no longer in the schema.
-- They are not dropped here: an instance of the previous version, which still reads them, may
-- be serving while this one starts. From now on the database refuses text in them (NOT VALID:
-- old rows are not checked; the start-up step moves them), and that step drops the columns on
-- the start after the one that marks them (packages/application/src/privacy.ts).
ALTER TABLE "injuries" ADD CONSTRAINT "injuries_mechanism_legacy_null_ck" CHECK ("mechanism" IS NULL) NOT VALID;
--> statement-breakpoint
ALTER TABLE "injuries" ADD CONSTRAINT "injuries_professional_legacy_null_ck" CHECK ("professional" IS NULL) NOT VALID;
--> statement-breakpoint
ALTER TABLE "injuries" ADD CONSTRAINT "injuries_restrictions_legacy_null_ck" CHECK ("restrictions" IS NULL) NOT VALID;
--> statement-breakpoint
ALTER TABLE "injuries" ADD CONSTRAINT "injuries_notes_legacy_null_ck" CHECK ("notes" IS NULL) NOT VALID;
--> statement-breakpoint
ALTER TABLE "injury_phase_history" ADD CONSTRAINT "injury_phase_history_note_legacy_null_ck" CHECK ("note" IS NULL) NOT VALID;
--> statement-breakpoint
ALTER TABLE "injury_alerts" ADD CONSTRAINT "injury_alerts_review_note_legacy_null_ck" CHECK ("review_note" IS NULL) NOT VALID;
--> statement-breakpoint
ALTER TABLE "injury_criterion_checks" ADD CONSTRAINT "injury_criterion_checks_note_legacy_null_ck" CHECK ("note" IS NULL) NOT VALID;
--> statement-breakpoint
ALTER TABLE "rtp_decisions" ADD CONSTRAINT "rtp_decisions_rationale_legacy_null_ck" CHECK ("rationale" IS NULL) NOT VALID;
