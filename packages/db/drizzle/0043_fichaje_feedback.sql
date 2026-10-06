CREATE TYPE "public"."discomfort_level" AS ENUM('none', 'some', 'a_lot');--> statement-breakpoint
CREATE TYPE "public"."effort_feel" AS ENUM('easy', 'normal', 'hard', 'very_hard');--> statement-breakpoint
ALTER TYPE "public"."attendance_status" ADD VALUE 'started' BEFORE 'completed';--> statement-breakpoint
ALTER TABLE "attendance" ALTER COLUMN "recorded_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "automatic" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "exercise_feedback" ADD COLUMN "feel" "effort_feel";--> statement-breakpoint
ALTER TABLE "exercise_feedback" ADD COLUMN "discomfort" "discomfort_level";--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "feel" "effort_feel";