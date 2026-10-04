CREATE INDEX "client_history_client_idx" ON "client_history_entries" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "screening_client_idx" ON "screening_responses" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "assessment_results_test_idx" ON "assessment_results" USING btree ("test_id");--> statement-breakpoint
CREATE INDEX "derived_metrics_result_idx" ON "derived_metrics" USING btree ("result_id");--> statement-breakpoint
CREATE INDEX "session_exercises_exercise_idx" ON "session_exercises" USING btree ("exercise_id");--> statement-breakpoint
CREATE INDEX "exercise_feedback_session_idx" ON "exercise_feedback" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "substitutions_session_idx" ON "exercise_substitutions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "tolerances_client_idx" ON "exercise_tolerances" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "feedback_client_idx" ON "feedback" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "pain_logs_session_idx" ON "pain_logs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "set_logs_session_exercise_idx" ON "set_logs" USING btree ("session_exercise_id");--> statement-breakpoint
CREATE INDEX "manual_overrides_client_idx" ON "manual_overrides" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "files_client_idx" ON "files" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "privacy_requests_client_idx" ON "privacy_requests" USING btree ("client_id");