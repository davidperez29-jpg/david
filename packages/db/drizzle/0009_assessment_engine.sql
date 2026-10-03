ALTER TABLE "assessment_tests" ADD COLUMN "is_estimate" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "planned_test_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL;--> statement-breakpoint
ALTER TABLE "assessment_results" ADD CONSTRAINT "assessment_results_one_per_side_uq" UNIQUE("assessment_id","test_id","side");--> statement-breakpoint
ALTER TABLE "derived_metrics" ADD CONSTRAINT "derived_metrics_assessment_metric_uq" UNIQUE("assessment_id","metric");