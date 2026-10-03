ALTER TABLE "session_exercises" ADD COLUMN "alternative_exercise_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL;--> statement-breakpoint
ALTER TABLE "exercise_substitutions" ADD COLUMN "client_mutation_id" text;--> statement-breakpoint
ALTER TABLE "set_logs" ADD COLUMN "needs_review" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "set_logs" ADD COLUMN "review_reason" text;--> statement-breakpoint
ALTER TABLE "exercise_substitutions" ADD CONSTRAINT "exercise_substitutions_client_mutation_id_unique" UNIQUE("client_mutation_id");