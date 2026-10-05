CREATE TABLE "programming_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"family" text NOT NULL,
	"description" text,
	"levels" jsonb NOT NULL,
	"default_goal_slug" text,
	"default_battery_slug" text,
	"radar_dimensions" text[] DEFAULT '{}' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "programming_profiles_org_slug_uq" UNIQUE NULLS NOT DISTINCT("organization_id","slug")
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "programming_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "programming_level" smallint;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "sport_id" uuid;--> statement-breakpoint
ALTER TABLE "programming_profiles" ADD CONSTRAINT "programming_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_programming_profile_id_programming_profiles_id_fk" FOREIGN KEY ("programming_profile_id") REFERENCES "public"."programming_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_sport_id_sports_id_fk" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_programming_level_ck" CHECK ("clients"."programming_level" BETWEEN 1 AND 3);