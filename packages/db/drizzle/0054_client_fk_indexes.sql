CREATE INDEX "invitations_client_idx" ON "invitations" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "exercise_sets_client_idx" ON "exercise_sets" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "mesocycles_client_idx" ON "mesocycles" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "microcycles_client_idx" ON "microcycles" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "phases_client_idx" ON "phases" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "plan_revisions_client_idx" ON "plan_revisions" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "session_blocks_client_idx" ON "session_blocks" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "session_exercises_client_idx" ON "session_exercises" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "exercise_feedback_client_idx" ON "exercise_feedback" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "integration_connections_client_idx" ON "integration_connections" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "injury_alerts_client_idx" ON "injury_alerts" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "injury_criterion_checks_client_idx" ON "injury_criterion_checks" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "injury_phase_history_client_idx" ON "injury_phase_history" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "injury_symptoms_client_idx" ON "injury_symptoms" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "rtp_decisions_client_idx" ON "rtp_decisions" USING btree ("client_id");