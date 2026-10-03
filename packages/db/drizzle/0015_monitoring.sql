ALTER TABLE "sessions" ADD COLUMN "target_session_rpe" numeric(3, 1);--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "alert_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "alerts_live_key_uq" ON "alerts" USING btree ("client_id","alert_key") WHERE "alerts"."status" <> 'resolved' AND "alerts"."alert_key" IS NOT NULL;