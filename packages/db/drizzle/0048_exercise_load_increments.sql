CREATE TABLE "exercise_load_increments" (
	"organization_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"increment_kg" numeric NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exercise_load_increments_organization_id_exercise_id_pk" PRIMARY KEY("organization_id","exercise_id"),
	CONSTRAINT "exercise_load_increments_kg_ck" CHECK ("exercise_load_increments"."increment_kg" > 0 AND "exercise_load_increments"."increment_kg" <= 50)
);
--> statement-breakpoint
ALTER TABLE "exercise_load_increments" ADD CONSTRAINT "exercise_load_increments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_load_increments" ADD CONSTRAINT "exercise_load_increments_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;