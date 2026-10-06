ALTER TABLE "injuries" ADD COLUMN "mechanism_enc" text;--> statement-breakpoint
ALTER TABLE "injuries" ADD COLUMN "professional_enc" text;--> statement-breakpoint
ALTER TABLE "injuries" ADD COLUMN "restrictions_enc" text;--> statement-breakpoint
ALTER TABLE "injuries" ADD COLUMN "notes_enc" text;--> statement-breakpoint
ALTER TABLE "injury_alerts" ADD COLUMN "review_note_enc" text;--> statement-breakpoint
ALTER TABLE "injury_criterion_checks" ADD COLUMN "note_enc" text;--> statement-breakpoint
ALTER TABLE "injury_phase_history" ADD COLUMN "note_enc" text;--> statement-breakpoint
ALTER TABLE "rtp_decisions" ADD COLUMN "rationale_enc" text;