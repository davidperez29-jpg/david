ALTER TYPE "public"."recommendation_status" ADD VALUE 'postponed';--> statement-breakpoint
CREATE TABLE "client_trait_flags" (
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"trait" text NOT NULL,
	"value" boolean NOT NULL,
	"note" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_trait_flags_client_id_trait_pk" PRIMARY KEY("client_id","trait")
);
--> statement-breakpoint
CREATE TABLE "decision_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"rule_set_version" integer NOT NULL,
	"input_hash" text NOT NULL,
	"context" jsonb NOT NULL,
	"result" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_trait_flags" ADD CONSTRAINT "client_trait_flags_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_trait_flags" ADD CONSTRAINT "client_trait_flags_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_runs" ADD CONSTRAINT "decision_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_runs" ADD CONSTRAINT "decision_runs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "decision_runs_client_idx" ON "decision_runs" USING btree ("client_id","created_at");